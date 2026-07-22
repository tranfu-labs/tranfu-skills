#!/usr/bin/env node
import { join } from 'node:path';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  gateIntegrity,
  gateOrder,
  inspectCapabilities,
  parseArgs,
  readJson,
  stageOrder,
  verifyQaFingerprints,
  writeJson
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const runDir = expandPath(args._[0]);

try {
  if (!runDir || !fileExists(join(runDir, 'run.json'))) throw new Error('Usage: inspect-run.mjs <run-dir> [--refresh-capabilities]');
  const statePath = join(runDir, 'run.json');
  const state = await readJson(statePath);
  const issues = await gateIntegrity(runDir, state);

  for (const [id, snapshot] of Object.entries(state.snapshots || {})) {
    if (!snapshot?.snapshot_path || !snapshot.sha256) continue;
    const path = join(runDir, snapshot.snapshot_path);
    if (!fileExists(path)) {
      issues.push({ code: 'input_snapshot_missing', snapshot: id, path: snapshot.snapshot_path });
    } else if (await fileSha256(path) !== snapshot.sha256) {
      issues.push({ code: 'input_snapshot_drift', snapshot: id, path: snapshot.snapshot_path });
    }
  }

  if (issues.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, next_stage: null, issues }, 2);
  } else if (state.status === 'completed' && state.gates?.final?.status === 'approved') {
    const qaPath = join(runDir, '09-qa', 'qa.json');
    const qa = fileExists(qaPath) ? await readJson(qaPath) : null;
    const fingerprintIssues = await verifyQaFingerprints(runDir, qa);
    if (qa?.status !== 'READY' || fingerprintIssues.length) {
      emitJson({ status: 'BLOCKED', run_dir: runDir, next_stage: 'final_qa', issues: fingerprintIssues.length ? fingerprintIssues : [{ code: 'completed_qa_invalid', message: 'Completed run QA is not READY.' }] }, 2);
    } else {
      emitJson({ status: 'COMPLETED', run_dir: runDir, next_stage: null, message: 'Run is complete; resume is a no-op.' });
    }
  } else {
    let capabilityReport = null;
    if (args.refresh_capabilities || state.capabilities?.status !== 'PASS') {
      capabilityReport = await inspectCapabilities(state.capabilities.config_path);
      if (args.refresh_capabilities) {
        await writeJson(join(runDir, '00-intake', 'capabilities.json'), capabilityReport);
        state.capabilities.status = capabilityReport.status;
        state.capabilities.config_sha256 = fileExists(state.capabilities.config_path) ? await fileSha256(state.capabilities.config_path) : null;
        state.capabilities.providers = Object.fromEntries(capabilityReport.capabilities.map((item) => [item.id, {
          skill_path: item.skill_path,
          skill_sha256: item.skill_sha256,
          status: item.status,
          required: item.required,
          contract: item.contract,
          profile: item.profile,
          ...(item.adapter_contract ? { adapter_contract: item.adapter_contract } : {}),
          ...(item.resources?.length ? { resources: item.resources } : {})
        }]));
        const now = new Date().toISOString();
        if (capabilityReport.status === 'PASS') {
          const next = state.gates?.topic?.status === 'approved' ? 'research' : 'discovery';
          state.status = 'running';
          state.current_stage = next;
          state.resume = { next_stage: next, reason: 'capabilities_restored' };
          if (state.stages?.init) state.stages.init = { ...state.stages.init, status: 'completed', error: null };
          const skipPath = join(runDir, '01-discovery', 'skip.json');
          if (state.gates?.topic?.status === 'approved' && state.stages?.discovery && fileExists(skipPath)) {
            state.stages.discovery = {
              ...state.stages.discovery,
              status: 'completed', error: null,
              artifacts: [{ path: '01-discovery/skip.json', sha256: await fileSha256(skipPath) }],
              completed_at: now, updated_at: now
            };
          }
        } else {
          state.status = 'blocked';
          state.current_stage = 'init';
          state.resume = { next_stage: 'init', reason: 'capability_blocked' };
        }
        state.updated_at = now;
        state.history = [...(state.history || []), { at: now, event: 'capabilities_refreshed', status: capabilityReport.status }];
        await writeJson(statePath, state);
      }
    }

    if (capabilityReport?.status === 'BLOCKED' || state.capabilities?.status === 'BLOCKED') {
      emitJson({ status: 'BLOCKED', run_dir: runDir, next_stage: 'init', issues: capabilityReport?.blockers || [], hint: 'Fix the capability mapping, then rerun with --refresh-capabilities.' }, 2);
    } else {
      const blockedStage = stageOrder.find((stage) => state.stages?.[stage]?.status === 'blocked');
      if (blockedStage) {
        emitJson({
          status: 'BLOCKED', run_dir: runDir, run_status: state.status,
          next_stage: blockedStage, blocked_stage: blockedStage,
          error: state.stages[blockedStage].error,
          hint: 'Resolve the stage blocker, then set the same stage to running for a new attempt.'
        }, 2);
        process.exit();
      }
      const waitingGate = gateOrder.find((gate) => ['awaiting_approval', 'blocked'].includes(state.gates?.[gate]?.status));
      const nextStage = waitingGate ? `${waitingGate}_approval` : state.resume?.next_stage || state.current_stage;
      emitJson({
        status: waitingGate ? (state.gates[waitingGate].status === 'blocked' ? 'BLOCKED' : 'AWAITING_APPROVAL') : 'READY_TO_RESUME',
        run_dir: runDir,
        run_status: state.status,
        next_stage: nextStage,
        waiting_gate: waitingGate || null
      }, waitingGate && state.gates[waitingGate].status === 'blocked' ? 2 : 0);
    }
  }
} catch (error) {
  emitJson({ status: 'BLOCKED', issues: [{ code: 'inspect_failed', message: error.message }] }, 2);
}
