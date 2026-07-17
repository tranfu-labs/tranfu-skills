#!/usr/bin/env node

import path from "node:path";
import {
  appendEvent,
  atomicWriteJson,
  checkInputSnapshots,
  checkRegisteredArtifacts,
  detectOutlineDrift,
  failJson,
  invalidateArtifacts,
  nextStage,
  nowIso,
  parseArgs,
  printJson,
  readManifest,
  sha256Text,
} from "./_lib.mjs";

const HELP = `draft-content inspect-run

Usage:
  node inspect-run.mjs --run PATH
  node inspect-run.mjs PATH

Options:
  --run PATH   Run directory containing manifest.json
  --help       Show this help

The command validates the manifest, detects approved-outline hash drift, and
prints the current status and deterministic next stage as JSON.`;

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), { values: ["run"] });
  } catch (error) {
    failJson(error);
    return;
  }
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (options._.length > 1 || (options.run && options._.length > 0)) {
    failJson(new Error("Provide the run directory once, with --run or as a positional argument"));
    return;
  }

  const suppliedRun = options.run ?? options._[0];
  if (!suppliedRun) {
    failJson(new Error("Missing --run PATH"));
    return;
  }

  try {
    const { runDir, manifestPath, manifest } = await readManifest(suppliedRun);
    const beforeState = manifest.outline_gate.state;
    const wasReady = manifest.status === "READY_FOR_PROOFREAD";
    const drift = await detectOutlineDrift(runDir, manifest);
    const integrityErrors = drift.drifted ? [] : await checkInputSnapshots(runDir, manifest);
    if (wasReady && !drift.drifted) integrityErrors.push(...(await checkRegisteredArtifacts(runDir, manifest)));
    if (integrityErrors.length > 0) {
      const signature = sha256Text(JSON.stringify(integrityErrors.map((issue) => [issue.code, issue.path ?? issue.label ?? null])));
      manifest.status = "BLOCKED";
      invalidateArtifacts(manifest, wasReady ? "ready_integrity_drift" : "input_snapshot_invalid");
      const alreadyRecorded = manifest.events?.some((event) => event.type === "run_integrity_drift" && event.signature === signature);
      if (!alreadyRecorded) appendEvent(manifest, "run_integrity_drift", { signature, error_codes: [...new Set(integrityErrors.map((issue) => issue.code))] });
    }
    if ((drift.drifted && beforeState === "approved") || integrityErrors.length > 0) {
      manifest.updated_at = nowIso();
      await atomicWriteJson(manifestPath, manifest);
    }
    printJson({
      ok: !drift.drifted && integrityErrors.length === 0,
      status: manifest.status,
      run_dir: path.resolve(runDir),
      outline_gate: {
        state: manifest.outline_gate.state,
        path: manifest.outline_gate.path,
        sha256: manifest.outline_gate.sha256,
        version: manifest.outline_gate.version,
      },
      artifacts_valid: manifest.artifacts.valid,
      next_stage: nextStage(manifest),
      ...(drift.drifted ? { reason: drift.reason, actual_outline_sha256: drift.actualHash } : {}),
      ...(integrityErrors.length > 0 ? { reason: manifest.artifacts.reason, integrity_errors: integrityErrors } : {}),
    });
    if (drift.drifted || integrityErrors.length > 0) process.exitCode = 2;
  } catch (error) {
    failJson(error);
  }
}

await main();
