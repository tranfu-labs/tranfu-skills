#!/usr/bin/env node
import { emitJson, expandPath, fileExists, fileSha256, parseArgs, readJson, writeJson } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const reportPath = expandPath(args._[0]);
const checks = {
  new_conclusion: args.new_conclusion,
  scope_change: args.scope_change,
  causal_strength: args.causal_strength,
  factual_addition: args.factual_addition,
  factual_omission: args.factual_omission,
  proper_noun_drift: args.proper_noun_drift
};
const allowed = ['PASS', 'BLOCKED'];

async function assertCurrent(report) {
  if (report.automatic_status !== 'PASS' || report.blockers?.length) {
    throw new Error('Automatic claim regression is blocked; semantic review cannot override it.');
  }
  const paths = { before_sha256: report.before, after_sha256: report.after, claims_sha256: report.claims };
  for (const [field, path] of Object.entries(paths)) {
    if (!fileExists(path) || await fileSha256(path) !== report[field]) {
      throw new Error(`${field} no longer matches ${path}. Rerun claim regression.`);
    }
  }
}

try {
  const reusePath = typeof args.reuse_from === 'string' ? expandPath(args.reuse_from) : null;
  const independent = typeof args.reviewer === 'string' && Boolean(args.reviewer.trim())
    && Object.values(checks).every((value) => allowed.includes(value));
  if (!reportPath || Boolean(reusePath) === independent) throw new Error(
    'Usage: set-semantic-review.mjs <report.json> (--reuse-from <passed-report.json> | --reviewer <id> --new-conclusion <PASS|BLOCKED> --scope-change <PASS|BLOCKED> --causal-strength <PASS|BLOCKED> --factual-addition <PASS|BLOCKED> --factual-omission <PASS|BLOCKED> --proper-noun-drift <PASS|BLOCKED> [--notes text])'
  );
  const report = await readJson(reportPath);
  await assertCurrent(report);
  if (reusePath) {
    if (reusePath === reportPath || !fileExists(reusePath)) throw new Error('Reusable semantic review must be a different existing report.');
    const source = await readJson(reusePath);
    await assertCurrent(source);
    const tuple = ['before_sha256', 'after_sha256', 'claims_sha256', 'engine_version'];
    if (source.status !== 'PASS' || source.semantic_review?.status !== 'PASS'
      || tuple.some((field) => source[field] !== report[field])) {
      throw new Error('Reusable semantic review must be PASS with the identical before, after, claims, and engine tuple.');
    }
    report.semantic_review = {
      ...source.semantic_review,
      review_mode: 'reused',
      reused_from: { path: reusePath, sha256: await fileSha256(reusePath) }
    };
    report.status = 'PASS';
    await writeJson(reportPath, report);
    emitJson(report);
    process.exit();
  }
  const status = Object.values(checks).every((value) => value === 'PASS') ? 'PASS' : 'BLOCKED';
  report.semantic_review = {
    status,
    checks,
    notes: args.notes ? [args.notes] : [],
    reviewer: args.reviewer,
    recorded_by: 'set-semantic-review.mjs',
    reviewed_at: new Date().toISOString(),
    review_mode: 'independent',
    reused_from: null,
    before_sha256: report.before_sha256,
    after_sha256: report.after_sha256,
    claims_sha256: report.claims_sha256
  };
  report.status = status;
  await writeJson(reportPath, report);
  emitJson(report, status === 'PASS' ? 0 : 2);
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'semantic_review_failed', message: error.message }] }, 2);
}
