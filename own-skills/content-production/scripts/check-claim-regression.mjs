#!/usr/bin/env node
import { analyzeClaimRegression } from '../skills/proofread-content/scripts/claim-regression.mjs';
import { emitJson, expandPath, parseArgs, readText, sha256, writeJson } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const beforePath = expandPath(args.before);
const afterPath = expandPath(args.after);
const claimsPath = expandPath(args.claims);

try {
  if (!beforePath || !afterPath || !claimsPath) throw new Error('Required: --before, --after, --claims');
  const before = await readText(beforePath);
  const after = await readText(afterPath);
  const claimsText = await readText(claimsPath);
  JSON.parse(claimsText);
  const analysis = analyzeClaimRegression(before, after);
  const blockers = analysis.blockers;

  const report = {
    engine_version: analysis.engine_version,
    alignment_status: analysis.alignment_status,
    status: blockers.length ? 'BLOCKED' : 'PENDING_SEMANTIC_REVIEW',
    automatic_status: blockers.length ? 'BLOCKED' : 'PASS',
    before: beforePath,
    after: afterPath,
    claims: claimsPath,
    before_sha256: sha256(before),
    after_sha256: sha256(after),
    claims_sha256: sha256(claimsText),
    phase: args.phase || null,
    blockers,
    semantic_review: {
      status: 'PENDING',
      checks: {
        new_conclusion: 'PENDING', scope_change: 'PENDING', causal_strength: 'PENDING',
        factual_addition: 'PENDING', factual_omission: 'PENDING', proper_noun_drift: 'PENDING'
      },
      notes: [], reviewer: null, recorded_by: null, reviewed_at: null
    }
  };
  if (args.output) await writeJson(expandPath(args.output), report);
  emitJson(report, blockers.length ? 2 : 0);
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'claim_regression_failed', message: error.message }] }, 2);
}
