#!/usr/bin/env node

import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import {
  appendEvent,
  atomicWriteJson,
  captureArtifactBaseline,
  detectOutlineDrift,
  failJson,
  invalidateArtifacts,
  nextStage,
  nowIso,
  outlineVersion,
  parseArgs,
  printJson,
  readManifest,
  sha256File,
  toRunRelative,
} from "./_lib.mjs";

const HELP = `draft-content set-outline-gate

Usage:
  node set-outline-gate.mjs --run PATH --outline PATH --state awaiting_approval
  node set-outline-gate.mjs --run PATH --outline PATH --state approved --expected-sha256 HASH

Options:
  --run PATH       Run directory containing manifest.json
  --outline PATH   Existing 01-outline/shared-outline.vNNN.md file; a relative
                   path is resolved from the run directory
  --state STATE    awaiting_approval | approved
  --expected-sha256 HASH
                   Required for approved; must equal both the awaiting gate hash
                   and the current outline hash
  --help           Show this help

The first outline must be v001. After approval, edits to that file are drift;
revision requires the next higher version. Files are never deleted.`;

function gateHistoryRecord(gate) {
  return {
    state: gate.state,
    path: gate.path,
    sha256: gate.sha256,
    version: gate.version,
    approved_at: gate.approved_at ?? null,
    superseded_at: nowIso(),
  };
}

async function safeOutlinePath(runDir, suppliedPath) {
  const outlinePath = path.isAbsolute(suppliedPath)
    ? path.resolve(suppliedPath)
    : path.resolve(runDir, suppliedPath);
  const outlineRoot = path.join(runDir, "01-outline");
  if (path.dirname(outlinePath) !== outlineRoot) {
    throw new Error(`Outline must be directly inside ${outlineRoot}`);
  }
  const [rootMetadata, metadata] = await Promise.all([lstat(outlineRoot), lstat(outlinePath)]);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Run outline directory must be a regular non-symlink directory");
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Outline must be a regular non-symlink file");
  }
  const [realRun, realRoot, realOutline] = await Promise.all([realpath(runDir), realpath(outlineRoot), realpath(outlinePath)]);
  if (path.dirname(realRoot) !== realRun || path.dirname(realOutline) !== realRoot) {
    throw new Error("Outline resolves outside the run outline directory");
  }
  return outlinePath;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), { values: ["run", "outline", "state", "expected-sha256"] });
  } catch (error) {
    failJson(error);
    return;
  }
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (options._.length > 0) {
    failJson(new Error(`Unexpected positional arguments: ${options._.join(" ")}`));
    return;
  }
  if (!options.run || !options.outline || !options.state) {
    failJson(new Error("--run, --outline, and --state are required"));
    return;
  }
  if (!new Set(["awaiting_approval", "approved"]).has(options.state)) {
    failJson(new Error("--state must be awaiting_approval or approved"));
    return;
  }

  try {
    const { runDir, manifestPath, manifest } = await readManifest(options.run);
    const outlinePath = await safeOutlinePath(runDir, options.outline);
    const version = outlineVersion(outlinePath);
    const hash = await sha256File(outlinePath);
    const relativePath = toRunRelative(runDir, outlinePath);
    const current = manifest.outline_gate;

    const beforeDriftState = current.state;
    const drift = await detectOutlineDrift(runDir, manifest);
    if (drift.drifted && beforeDriftState === "approved") {
      manifest.updated_at = nowIso();
      await atomicWriteJson(manifestPath, manifest);
    }

    const hasBoundVersion = Number.isInteger(current.version);
    const sameVersion = hasBoundVersion && version === current.version;
    const sameBinding = sameVersion && relativePath === current.path;

    if (options.state === "approved") {
      const expectedHash = options["expected-sha256"]?.toLocaleLowerCase();
      if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
        throw new Error("approved requires --expected-sha256 with the hash shown at awaiting_approval");
      }
      if (current.state === "approved" && sameBinding) {
        if (expectedHash !== current.sha256 || hash !== expectedHash) {
          throw new Error("Approved outline hash does not match --expected-sha256");
        }
        printJson({
          ok: true,
          status: manifest.status,
          outline_gate: current,
          next_stage: nextStage(manifest),
          idempotent: true,
        });
        return;
      }
      if (current.state !== "awaiting_approval" || !sameBinding) {
        throw new Error("Bind this exact outline as awaiting_approval before approving it");
      }
      if (expectedHash !== current.sha256 || hash !== expectedHash) {
        throw new Error("Current outline hash differs from the awaiting gate or --expected-sha256; bind it again for review");
      }
      const baseline = await captureArtifactBaseline(runDir);
      manifest.artifacts.invalidation_baseline = {
        ...(manifest.artifacts.invalidation_baseline ?? {}),
        ...baseline,
      };
      current.state = "approved";
      current.approved_at = nowIso();
      delete current.drifted_at;
      delete current.actual_sha256;
      manifest.status = "DRAFTING";
      invalidateArtifacts(manifest, "drafts_not_verified");
      appendEvent(manifest, "outline_approved", { path: relativePath, sha256: hash, version });
      manifest.updated_at = nowIso();
      await atomicWriteJson(manifestPath, manifest);
      printJson({
        ok: true,
        status: manifest.status,
        outline_gate: {
          state: current.state,
          path: current.path,
          sha256: current.sha256,
          version: current.version,
        },
        artifacts_invalidated: true,
        next_stage: nextStage(manifest),
      });
      return;
    }

    if (options["expected-sha256"]) throw new Error("--expected-sha256 is only valid with --state approved");
    if (current.state === "approved" && sameBinding) {
      throw new Error("An approved outline cannot be downgraded to awaiting_approval");
    }
    if (!hasBoundVersion && version !== 1) {
      throw new Error("The first bound outline must be shared-outline.v001.md");
    }
    if (hasBoundVersion && !sameBinding && version !== current.version + 1) {
      throw new Error(`Outline revision must use shared-outline.v${String(current.version + 1).padStart(3, "0")}.md`);
    }
    if (current.state === "drifted" && sameBinding) {
      throw new Error(`A drifted outline requires shared-outline.v${String(current.version + 1).padStart(3, "0")}.md`);
    }
    if (current.state === "awaiting_approval" && sameBinding && hash === current.sha256) {
      printJson({
        ok: true,
        status: manifest.status,
        outline_gate: current,
        next_stage: nextStage(manifest),
        idempotent: true,
      });
      return;
    }

    const isNewVersion = !sameBinding;
    if (isNewVersion && hasBoundVersion) {
      current.history ??= [];
      current.history.push(gateHistoryRecord(current));
      invalidateArtifacts(manifest, "outline_revision");
      appendEvent(manifest, "outline_superseded", {
        previous_path: current.path,
        previous_sha256: current.sha256,
        next_path: relativePath,
        next_sha256: hash,
      });
    }

    const baseline = await captureArtifactBaseline(runDir);
    manifest.artifacts.invalidation_baseline = {
      ...(manifest.artifacts.invalidation_baseline ?? {}),
      ...baseline,
    };

    const history = current.history ?? [];
    manifest.outline_gate = {
      state: "awaiting_approval",
      path: relativePath,
      sha256: hash,
      version,
      approved_at: null,
      history,
    };
    manifest.status = "AWAITING_OUTLINE_APPROVAL";
    invalidateArtifacts(manifest, "outline_not_approved");
    appendEvent(manifest, "outline_bound", {
      path: relativePath,
      sha256: hash,
      version,
    });
    manifest.updated_at = nowIso();
    await atomicWriteJson(manifestPath, manifest);

    printJson({
      ok: true,
      status: manifest.status,
      outline_gate: {
        state: manifest.outline_gate.state,
        path: manifest.outline_gate.path,
        sha256: manifest.outline_gate.sha256,
        version: manifest.outline_gate.version,
      },
      artifacts_invalidated: true,
      next_stage: nextStage(manifest),
    });
  } catch (error) {
    failJson(error);
  }
}

await main();
