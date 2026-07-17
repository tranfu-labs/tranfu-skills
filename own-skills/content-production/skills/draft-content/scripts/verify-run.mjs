#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BRANCHES,
  PLATFORMS,
  appendEvent,
  atomicWriteJson,
  checkInputSnapshots,
  collectMarkdown,
  detectOutlineDrift,
  expectedArtifactPaths,
  failJson,
  isDirectory,
  isRegularFile,
  nowIso,
  parseArgs,
  printJson,
  readManifest,
  sha256File,
  sha256Text,
} from "./_lib.mjs";

const HELP = `draft-content verify-run

Usage:
  node verify-run.mjs --run PATH
  node verify-run.mjs PATH

Options:
  --run PATH   Run directory containing manifest.json
  --help       Show this help

The command discovers the fixed A/B master and five-platform artifact paths,
registers their SHA-256 lineage in manifest.json, writes 04-qa/report.json, and
sets READY_FOR_PROOFREAD only when every check passes.`;

const PLACEHOLDERS = /\b(?:TODO|TBD)\b|待补|待确认/iu;

function addError(errors, code, message, artifactPath = null) {
  errors.push({ code, message, ...(artifactPath ? { path: artifactPath } : {}) });
}

function withStableRegistration(previous, record, registeredAt) {
  if (!record) return null;
  const previousWithoutTime = previous ? { ...previous } : null;
  if (previousWithoutTime) delete previousWithoutTime.registered_at;
  return {
    ...record,
    registered_at: previousWithoutTime && JSON.stringify(previousWithoutTime) === JSON.stringify(record)
      ? previous.registered_at
      : registeredAt,
  };
}

function artifactSetFingerprint(masters, platforms) {
  const stripTime = (record) => {
    if (!record) return null;
    const value = { ...record };
    delete value.registered_at;
    return value;
  };
  return sha256Text(JSON.stringify({
    masters: Object.fromEntries(BRANCHES.map((branch) => [branch, stripTime(masters[branch])])),
    platforms: Object.fromEntries(PLATFORMS.map((platform) => [
      platform,
      Object.fromEntries(BRANCHES.map((branch) => [branch, stripTime(platforms[platform][branch])])),
    ])),
  }));
}

async function inspectDocument(runDir, storedPath, errors) {
  const absolutePath = path.join(runDir, storedPath);
  if (!(await isRegularFile(absolutePath))) {
    addError(errors, "missing_artifact", "Required Markdown artifact is missing", storedPath);
    return null;
  }
  const content = await readFile(absolutePath, "utf8");
  if (!content.trim()) addError(errors, "empty_artifact", "Artifact is empty", storedPath);
  const h1Lines = content.split(/\r?\n/).filter((line) => /^#\s+\S.*$/u.test(line));
  if (h1Lines.length !== 1) addError(errors, "invalid_h1_count", "Artifact must contain exactly one non-empty H1 working title", storedPath);
  if (PLACEHOLDERS.test(content)) addError(errors, "placeholder", "Artifact contains TODO, TBD, 待补, or 待确认", storedPath);
  return { path: storedPath, sha256: await sha256File(absolutePath) };
}

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
    const errors = [];
    const checkedAt = nowIso();
    const previousFingerprint = manifest.artifacts.artifact_set_sha256 ?? null;
    const previousMasters = manifest.artifacts.masters ?? {};
    const previousPlatforms = manifest.artifacts.platforms ?? {};
    const drift = await detectOutlineDrift(runDir, manifest);
    if (manifest.outline_gate.state !== "approved") {
      addError(
        errors,
        drift.drifted ? "outline_drift" : "outline_not_approved",
        drift.drifted
          ? "The approved outline changed; create and approve the next outline version"
          : "The current shared outline is not approved",
        manifest.outline_gate.path,
      );
    }

    let outlineHash = null;
    if (manifest.outline_gate.state === "approved") {
      outlineHash = manifest.outline_gate.sha256;
    }

    errors.push(...(await checkInputSnapshots(runDir, manifest)));

    const expected = expectedArtifactPaths();
    const masterMarkdown = await collectMarkdown(path.join(runDir, "02-masters"));
    const platformMarkdown = await collectMarkdown(path.join(runDir, "03-platforms"));
    const expectedMasterSet = new Set(Object.values(expected.masters).map((value) => path.resolve(runDir, value)));
    const expectedPlatformSet = new Set(
      PLATFORMS.flatMap((platform) => BRANCHES.map((branch) => path.resolve(runDir, expected.platforms[platform][branch]))),
    );

    if (masterMarkdown.length !== 2 || masterMarkdown.some((filePath) => !expectedMasterSet.has(path.resolve(filePath)))) {
      addError(errors, "master_count", "02-masters must contain exactly A-master.md and B-master.md");
    }
    if (platformMarkdown.length !== 10 || platformMarkdown.some((filePath) => !expectedPlatformSet.has(path.resolve(filePath)))) {
      addError(errors, "platform_count", "03-platforms must contain exactly the ten fixed A/B platform Markdown files");
    }
    const platformBasenames = platformMarkdown.map((filePath) => path.basename(filePath));
    if (new Set(platformBasenames).size !== platformBasenames.length) {
      addError(errors, "duplicate_basename", "Platform artifact basenames must be unique");
    }

    const masterDocuments = {};
    for (const branch of BRANCHES) {
      masterDocuments[branch] = await inspectDocument(runDir, expected.masters[branch], errors);
    }

    const platformDocuments = {};
    for (const platform of PLATFORMS) {
      platformDocuments[platform] = {};
      for (const branch of BRANCHES) {
        platformDocuments[platform][branch] = await inspectDocument(runDir, expected.platforms[platform][branch], errors);
      }
    }

    const registeredAt = nowIso();
    const masterRecords = {};
    for (const branch of BRANCHES) {
      const document = masterDocuments[branch];
      const record = document
        ? {
            ...document,
            outline_sha256: outlineHash,
            style_sha256: branch === "A" ? null : manifest.inputs.style_b.sha256,
          }
        : null;
      masterRecords[branch] = withStableRegistration(previousMasters[branch], record, registeredAt);
    }
    const platformRecords = {};
    for (const platform of PLATFORMS) {
      platformRecords[platform] = {};
      for (const branch of BRANCHES) {
        const document = platformDocuments[platform][branch];
        const record = document
          ? {
              ...document,
              outline_sha256: outlineHash,
              source_master: branch,
              source_master_path: expected.masters[branch],
              source_master_sha256: masterRecords[branch]?.sha256 ?? null,
              style_sha256: branch === "A" ? null : manifest.inputs.style_b.sha256,
            }
          : null;
        platformRecords[platform][branch] = withStableRegistration(previousPlatforms[platform]?.[branch], record, registeredAt);
      }
    }
    manifest.artifacts.masters = masterRecords;
    manifest.artifacts.platforms = platformRecords;

    const baseline = manifest.artifacts.invalidation_baseline ?? {};
    for (const record of [
      ...BRANCHES.map((branch) => masterRecords[branch]),
      ...PLATFORMS.flatMap((platform) => BRANCHES.map((branch) => platformRecords[platform][branch])),
    ]) {
      if (record && baseline[record.path] === record.sha256) {
        addError(errors, "stale_artifact_reuse", "Artifact bytes predate the current outline approval and must be rewritten", record.path);
      }
    }

    const artifactFingerprint = artifactSetFingerprint(masterRecords, platformRecords);
    manifest.artifacts.artifact_set_sha256 = artifactFingerprint;
    manifest.artifacts.lineage_assurance = "deterministic_binding_not_causal_proof";

    const passed = errors.length === 0;
    manifest.artifacts.valid = passed;
    manifest.artifacts.verified_at = passed && previousFingerprint === artifactFingerprint && manifest.artifacts.verified_at
      ? manifest.artifacts.verified_at
      : passed ? checkedAt : null;
    manifest.artifacts.invalidated_at = passed ? null : checkedAt;
    const inputBlocked = errors.some((error) => error.code.startsWith("input_snapshot") || error.code.startsWith("style_snapshot"));
    manifest.artifacts.reason = passed ? null : drift.drifted ? drift.reason : inputBlocked ? "input_snapshot_invalid" : "verification_failed";
    if (passed) {
      manifest.status = "READY_FOR_PROOFREAD";
      manifest.artifacts.invalidation_baseline = {};
      const alreadyRecorded = manifest.events?.some((event) =>
        event.type === "verification_passed" &&
        event.outline_sha256 === outlineHash &&
        event.artifact_set_sha256 === artifactFingerprint);
      if (!alreadyRecorded) appendEvent(manifest, "verification_passed", { outline_sha256: outlineHash, artifact_set_sha256: artifactFingerprint });
    } else if (!drift.drifted && manifest.outline_gate.state === "approved") {
      manifest.status = inputBlocked ? "BLOCKED" : "DRAFTING";
      appendEvent(manifest, "verification_failed", { error_codes: [...new Set(errors.map((error) => error.code))] });
    }
    manifest.updated_at = nowIso();

    const report = {
      schema_version: 1,
      skill: "draft-content",
      run_id: manifest.run_id,
      checked_at: checkedAt,
      status: passed ? "PASS" : "FAIL",
      manifest_status: manifest.status,
      approved_outline_sha256: outlineHash,
      counts: {
        masters_found: masterMarkdown.length,
        platform_documents_found: platformMarkdown.length,
      },
      execution_strategy: manifest.execution?.strategy ?? null,
      lineage_assurance: "deterministic_binding_not_causal_proof",
      errors,
    };
    await atomicWriteJson(path.join(runDir, "04-qa", "report.json"), report);
    await atomicWriteJson(manifestPath, manifest);

    printJson({
      ok: passed,
      status: manifest.status,
      verification: report.status,
      report: path.join(runDir, "04-qa", "report.json"),
      errors,
      next_stage: passed
        ? "handoff_to_proofread"
        : drift.drifted
          ? "create_new_outline_version"
          : inputBlocked
            ? "restore_input_snapshots"
            : manifest.outline_gate.state === "approved"
              ? "complete_drafts"
              : "approve_outline",
    });
    if (!passed) process.exitCode = drift.drifted ? 2 : 1;
  } catch (error) {
    failJson(error);
  }
}

await main();
