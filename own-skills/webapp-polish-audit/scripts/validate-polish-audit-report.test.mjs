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
  if (withEvidence) fs.writeFileSync(path.join(runDir, "home__07-D__probe.json"), "{}");
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
      id: "home-07-D",
      dimension: "07",
      class: "D",
      evidence: ["home__07-D__probe.json"],
      status: "verified",
      judge_tasks: ["judge-a-home-07-D", "judge-b-home-07-D"],
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
            id: "home-07-E-1",
            severity: "MEDIUM",
            disposition: "actionable",
            dimension: "07",
            class: "E",
            location: {
              page: "http://localhost:3000/",
              viewport: "1280x720",
              target: "copy button",
            },
            evidence: { type: "dom", refs: ["home__07-D__probe.json"] },
            observation: "Download icon is used for copy.",
            expected: "Copy uses a copy icon.",
            user_impact: "The action is ambiguous.",
            reference_doc: "references/dimensions/07-form-completion-confidence.md",
            fix_recommendation: "Use a copy icon.",
          },
        ],
        class_coverage: [
          {
            dimension: "07",
            class: "E",
            verdict: "actionable",
            evidence_refs: ["home-07-E-1"],
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
  "07": { E: "actionable" },
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

// micro-audit 通道把 S3–S6 记为 skipped_micro_audit，必须是合法终态。
const microAuditState = structuredClone(state);
microAuditState.path = "micro-audit";
for (const stage of ["S3", "S4", "S5", "S6"]) microAuditState.stages[stage] = "skipped_micro_audit";
microAuditState.judgement_units = [];
const microResult = runValidator(validReport, microAuditState);
assert.equal(microResult.status, 0, microResult.stderr || microResult.stdout);
assert.equal(microResult.output.verdict, "pass");

// 双 Judge 隔离：单个 judge、或同一上下文重复使用，都必须被拒。
const singleJudgeState = structuredClone(state);
singleJudgeState.judgement_units[0].judge_tasks = ["judge-a-home-07-D"];
const singleJudgeResult = runValidator(validReport, singleJudgeState);
assert.equal(singleJudgeResult.output.verdict, "fail");
assert.ok(
  singleJudgeResult.output.errors.some((error) => error.includes("at least two independent judges")),
  singleJudgeResult.stdout,
);

const reusedJudgeState = structuredClone(state);
reusedJudgeState.judgement_units[0].judge_tasks = ["judge-a-home-07-D", "judge-a-home-07-D"];
const reusedJudgeResult = runValidator(validReport, reusedJudgeState);
assert.equal(reusedJudgeResult.output.verdict, "fail");
assert.ok(
  reusedJudgeResult.output.errors.some((error) => error.includes("reuses the same judge context")),
  reusedJudgeResult.stdout,
);

// ── §0「受限截图」例外 ────────────────────────────────────────────────
// 截图不能独立成立：必须并列同 class 的脚本/JSON 证据。
const shotAlone = structuredClone(validReport);
shotAlone.polish_audit_report.pages[0].findings[0].evidence = {
  type: "screenshot",
  refs: ["home__07-D__probe.json"], // 文件存在，但下面改成纯截图 ref 以触发校验
};
shotAlone.polish_audit_report.pages[0].findings[0].evidence.refs = ["browser:viewport-1280x720"];
const shotAloneState = structuredClone(state);
shotAloneState.screenshot_log = [
  { dimension: "07", class: "D", script_gave: "disabled=false", why_insufficient: "无法区分成功态", confirms: "提交后是否有可见反馈" },
];
const shotAloneResult = runValidator(shotAlone, shotAloneState);
assert.equal(shotAloneResult.output.verdict, "fail");
assert.ok(
  shotAloneResult.output.errors.some((e) => e.includes("relies on a screenshot alone")),
  shotAloneResult.stdout,
);

// 用了截图证据却没留痕 → 失败
const shotNoLog = structuredClone(validReport);
shotNoLog.polish_audit_report.pages[0].findings[0].evidence = {
  type: "screenshot",
  refs: ["home__07-D__probe.json", "browser:viewport-1280x720"],
};
const shotNoLogResult = runValidator(shotNoLog, state);
assert.equal(shotNoLogResult.output.verdict, "fail");
assert.ok(
  shotNoLogResult.output.errors.some((e) => e.includes("screenshot_log is missing")),
  shotNoLogResult.stdout,
);

// 留痕齐全且并列了 JSON 证据 → 通过
const shotOk = structuredClone(shotNoLog);
const shotOkState = structuredClone(state);
shotOkState.screenshot_log = [
  { dimension: "07", class: "D", script_gave: "disabled=false, aria_busy 缺失", why_insufficient: "脚本无法表征提交后的可见变化", confirms: "提交态是否对用户可见" },
];
const shotOkResult = runValidator(shotOk, shotOkState);
assert.equal(shotOkResult.output.verdict, "pass", shotOkResult.stdout);

// 超过 3 张上限 → 失败（该补判据，不是多截图）
const shotOverState = structuredClone(shotOkState);
shotOverState.screenshot_log = Array.from({ length: 4 }, (_, i) => ({
  dimension: "07",
  class: "D",
  script_gave: `s${i}`,
  why_insufficient: `w${i}`,
  confirms: `c${i}`,
}));
const shotOverResult = runValidator(shotOk, shotOverState);
assert.equal(shotOverResult.output.verdict, "fail");
assert.ok(
  shotOverResult.output.errors.some((e) => e.includes("over the limit")),
  shotOverResult.stdout,
);

// ── pending_authorization：待用户拍板的路径，不是缺陷 ──────────────────
const AUTH_ENTRY = {
  id: "home-03-B-auth-1",
  page: "http://localhost:3000/",
  dimension: "03",
  class: "B",
  discovered: "「清空全部数据」按钮，静态 DOM 无 confirm 信号",
  would_verify: "拦截写请求后模拟点击，500ms 比对 DOM 确认是否弹出二次确认",
  cost_if_skipped: "无法区分「真的没保护」与「保护存在但静态不可见」；03.B 悬置",
  how_to_authorize: "在 staging/localhost 重跑并写明「允许模拟破坏性动作」",
};
const withPendingCoverage = (report) => {
  report.polish_audit_report.pages[0].class_coverage.push({
    dimension: "03",
    class: "B",
    verdict: "pending_authorization",
    evidence_refs: ["home-03-B-auth-1"],
  });
  return report;
};

// 判成待授权但没有对应条目 → 失败（这正是"降级成 blocker 一笔带过"的老毛病）
const authOrphan = withPendingCoverage(structuredClone(validReport));
const authOrphanResult = runValidator(authOrphan, state);
assert.equal(authOrphanResult.output.verdict, "fail");
assert.ok(
  authOrphanResult.output.errors.some((e) => e.includes("unknown pending_authorization")),
  authOrphanResult.stdout,
);

// 条目缺「怎么授权」→ 失败（只说"需要授权"用户无从决策）
const authIncomplete = withPendingCoverage(structuredClone(validReport));
const { how_to_authorize, ...missingHow } = AUTH_ENTRY;
authIncomplete.polish_audit_report.pending_authorizations = [missingHow];
const authIncompleteResult = runValidator(authIncomplete, state);
assert.equal(authIncompleteResult.output.verdict, "fail");
assert.ok(
  authIncompleteResult.output.errors.some((e) => e.includes("how_to_authorize")),
  authIncompleteResult.stdout,
);

// 五字段齐全且被正确引用 → 通过
const authOk = withPendingCoverage(structuredClone(validReport));
authOk.polish_audit_report.pending_authorizations = [AUTH_ENTRY];
const authOkResult = runValidator(authOk, state);
assert.equal(authOkResult.output.verdict, "pass", authOkResult.stdout);

// ── script: 逻辑引用不走文件路径校验，但背后必须有 probe JSON ──────────
// 回归：validator 曾漏掉 script: 前缀，逼得执行者创建名为 "script:10.A" 的畸形文件。
const scriptRef = structuredClone(validReport);
scriptRef.polish_audit_report.pages[0].findings[0].evidence = {
  type: "layout_box",
  refs: ["script:07.D"],
};
// runValidator 的 fixture 会写 home__07-D__probe.json，key "07-D" 能匹配上
const scriptRefResult = runValidator(scriptRef, state);
assert.equal(scriptRefResult.output.verdict, "pass", scriptRefResult.stdout);

// script: 引用背后没有任何 probe JSON → 失败（等于无证据）
const scriptRefOrphan = structuredClone(validReport);
scriptRefOrphan.polish_audit_report.pages[0].findings[0].evidence = {
  type: "layout_box",
  refs: ["script:99.Z"],
};
const scriptRefOrphanResult = runValidator(scriptRefOrphan, state);
assert.equal(scriptRefOrphanResult.output.verdict, "fail");
assert.ok(
  scriptRefOrphanResult.output.errors.some((e) => e.includes("no matching probe JSON")),
  scriptRefOrphanResult.stdout,
);

process.stdout.write("validate-polish-audit-report tests passed\n");
