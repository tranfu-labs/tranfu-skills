#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const validatorPath = path.join(scriptDir, "validate-polish-audit-report.mjs");

function runValidator(report, state, withEvidence = true) {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "polish-report-test-"));
  if (withEvidence) fs.writeFileSync(path.join(runDir, "evidence.png"), "fixture");
  const reportPath = path.join(runDir, "polish-audit-report.json");
  const statePath = path.join(runDir, "audit-state.json");
  fs.writeFileSync(reportPath, JSON.stringify(report));
  fs.writeFileSync(statePath, JSON.stringify(state));
  const result = spawnSync(process.execPath, [validatorPath, reportPath, statePath, runDir], {
    encoding: "utf8",
  });
  return { ...result, output: JSON.parse(result.stdout) };
}

const state = {
  run_id: "test-run",
  scope: "explicit-single-page",
  stages: {
    S0: "completed",
    S1: "skipped_explicit_single_page",
    S2: "completed",
    S3: "completed",
    S4: "completed",
    S5: "completed",
    S6: "completed",
    S7: "running",
  },
  judgement_units: [
    {
      id: "home-default-desktop",
      kind: "single",
      files: ["evidence.png"],
      status: "verified",
      judge_task: "judge-home-default-desktop",
      verifier_task: "verify-home-default-desktop",
    },
  ],
};

const validReport = {
  polish_audit_report: {
    run_id: "test-run",
    pages: [
      {
        url: "http://localhost:3000/",
        page_family: "",
        viewports_anchored: ["1280x720", "390x844"],
        findings: [
          {
            id: "home-09-E-1",
            severity: "MEDIUM",
            disposition: "actionable",
            dimension: "09",
            class: "E",
            location: {
              page: "http://localhost:3000/",
              viewport: "1280x720",
              target: "copy button",
            },
            evidence: { type: "screenshot", refs: ["evidence.png"] },
            observation: "Download icon is used for copy.",
            expected: "Copy uses a copy icon.",
            user_impact: "The action is ambiguous.",
            reference_doc: "references/dimensions/09-visual-trust-and-consistency.md",
            fix_recommendation: "Use a copy icon.",
          },
        ],
        class_coverage: [
          {
            dimension: "09",
            class: "E",
            verdict: "actionable",
            evidence_refs: ["home-09-E-1"],
          },
        ],
        disposition_history: [],
      },
    ],
    gaps: [],
    blockers: [],
  },
};

const validResult = runValidator(validReport, state);
assert.equal(validResult.status, 0, validResult.stderr || validResult.stdout);
assert.equal(validResult.output.verdict, "pass");

const invalidPreviousShape = structuredClone(validReport);
invalidPreviousShape.polish_audit_report.pages[0].class_coverage = {
  "09": { E: "actionable" },
};
invalidPreviousShape.polish_audit_report.gaps = [
  {
    id: "home-03-B-gap-1",
    page: "http://localhost:3000/",
    dimension: "03",
    class: "B",
    reason: "pressed state was not captured",
  },
];
invalidPreviousShape.polish_audit_report.blockers = [];

const invalidResult = runValidator(invalidPreviousShape, state);
assert.equal(invalidResult.status, 1);
assert.equal(invalidResult.output.verdict, "fail");
assert.ok(
  invalidResult.output.errors.some((error) => error.includes("class_coverage must be an array")),
  invalidResult.stdout,
);
assert.ok(
  invalidResult.output.errors.some((error) => error.includes("no matching blocker class_coverage")),
  invalidResult.stdout,
);

process.stdout.write("validate-polish-audit-report tests passed\n");
