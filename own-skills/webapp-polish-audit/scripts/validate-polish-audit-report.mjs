#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [reportPath, statePath, runDirArg] = process.argv.slice(2);
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(filePath, label) {
  if (!filePath) {
    fail(`${label} path is required`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not readable JSON: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireString(value, location) {
  if (!nonEmptyString(value)) fail(`${location} must be a non-empty string`);
}

function requireArray(value, location) {
  if (!Array.isArray(value)) {
    fail(`${location} must be an array`);
    return [];
  }
  return value;
}

function coverageKey(page, dimension, className) {
  return `${page}\u0000${dimension}\u0000${className}`;
}

const reportDocument = readJson(reportPath, "report");
const state = readJson(statePath, "audit state");
const runDir = path.resolve(runDirArg || (reportPath ? path.dirname(reportPath) : "."));

const report = reportDocument?.polish_audit_report;
if (!isObject(report)) fail("polish_audit_report must be an object");

const severityValues = new Set(["BLOCKER", "HIGH", "MEDIUM", "LOW"]);
const verdictValues = new Set([
  "actionable",
  "already_satisfied",
  "blocker",
  "not_applicable",
  // 技术上验得了但需用户授权的路径——待决策项，不是缺陷。
  "pending_authorization",
]);
const pendingAuthById = new Map();
// screenshot 仅经 §0「受限截图」例外产生：上限 3 张、须留痕、且不能独立成立。
const evidenceTypes = new Set(["screenshot", "dom", "a11y", "computed_style", "layout_box", "interaction_state"]);
const SCREENSHOT_LIMIT = 3;
const screenshotFindings = [];
// skipped_micro_audit：走 §4.5 快速通道时 S3–S6 的合法终态，缺它会让 micro-audit 必然 fail。
const stageTerminalValues = new Set([
  "completed",
  "completed_with_blockers",
  "skipped_explicit_single_page",
  "skipped_micro_audit",
]);
const unitTerminalValues = new Set(["verified", "blocked"]);

const findingsById = new Map();
const coverageByKey = new Map();
const gapsById = new Map();

if (isObject(report)) {
  requireString(report.run_id, "polish_audit_report.run_id");
  const pages = requireArray(report.pages, "polish_audit_report.pages");
  const gaps = requireArray(report.gaps, "polish_audit_report.gaps");
  const blockers = requireArray(report.blockers, "polish_audit_report.blockers");
  // 待授权路径：可选数组，但一旦有 class 判为 pending_authorization 就必须有对应条目。
  const pendingAuths = Array.isArray(report.pending_authorizations) ? report.pending_authorizations : [];
  for (const [authIndex, auth] of pendingAuths.entries()) {
    const authLocation = `pending_authorizations[${authIndex}]`;
    if (!isObject(auth)) {
      fail(`${authLocation} must be an object`);
      continue;
    }
    // 五字段全必填——只写"需要授权"而不说清怎么授权、代价是什么，用户无法决策。
    for (const field of [
      "id",
      "page",
      "dimension",
      "class",
      "discovered",
      "would_verify",
      "cost_if_skipped",
      "how_to_authorize",
    ]) {
      requireString(auth[field], `${authLocation}.${field}`);
    }
    if (pendingAuthById.has(auth.id)) fail(`duplicate pending_authorization id: ${auth.id}`);
    else pendingAuthById.set(auth.id, auth);
  }

  if (pages.length === 0) fail("polish_audit_report.pages must not be empty");

  for (const [pageIndex, page] of pages.entries()) {
    const pageLocation = `pages[${pageIndex}]`;
    if (!isObject(page)) {
      fail(`${pageLocation} must be an object`);
      continue;
    }
    requireString(page.url, `${pageLocation}.url`);
    if (typeof page.page_family !== "string") fail(`${pageLocation}.page_family must be a string`);
    const viewports = requireArray(page.viewports_anchored, `${pageLocation}.viewports_anchored`);
    if (viewports.length < 2) fail(`${pageLocation}.viewports_anchored must contain desktop and narrow viewports`);
    const findings = requireArray(page.findings, `${pageLocation}.findings`);
    const coverage = requireArray(page.class_coverage, `${pageLocation}.class_coverage`);
    requireArray(page.disposition_history, `${pageLocation}.disposition_history`);

    for (const [findingIndex, finding] of findings.entries()) {
      const findingLocation = `${pageLocation}.findings[${findingIndex}]`;
      if (!isObject(finding)) {
        fail(`${findingLocation} must be an object`);
        continue;
      }
      requireString(finding.id, `${findingLocation}.id`);
      if (findingsById.has(finding.id)) fail(`duplicate finding id: ${finding.id}`);
      else findingsById.set(finding.id, finding);
      if (!severityValues.has(finding.severity)) fail(`${findingLocation}.severity is invalid`);
      if (!verdictValues.has(finding.disposition)) fail(`${findingLocation}.disposition is invalid`);
      if (!/^\d{2}$/.test(finding.dimension || "")) fail(`${findingLocation}.dimension must be two digits`);
      if (typeof finding.class !== "string") fail(`${findingLocation}.class must be a string`);
      if (!isObject(finding.location)) fail(`${findingLocation}.location must be an object`);
      else {
        requireString(finding.location.page, `${findingLocation}.location.page`);
        requireString(finding.location.viewport, `${findingLocation}.location.viewport`);
        requireString(finding.location.target, `${findingLocation}.location.target`);
      }
      if (!isObject(finding.evidence)) fail(`${findingLocation}.evidence must be an object`);
      else {
        if (!evidenceTypes.has(finding.evidence.type)) fail(`${findingLocation}.evidence.type is invalid`);
        if (finding.evidence.type === "screenshot") {
          screenshotFindings.push({ finding, location: findingLocation });
          // 截图只能补强，不能独立成立：必须并列非截图证据。
          const refs = Array.isArray(finding.evidence.refs) ? finding.evidence.refs : [];
          const hasNonScreenshotRef = refs.some(
            (ref) => typeof ref === "string" && (ref.startsWith("script:") || ref.endsWith(".json")),
          );
          if (!hasNonScreenshotRef) {
            fail(
              `${findingLocation} relies on a screenshot alone; screenshot evidence must accompany script:/JSON evidence for the same class`,
            );
          }
        }
        const refs = requireArray(finding.evidence.refs, `${findingLocation}.evidence.refs`);
        if (refs.length === 0) fail(`${findingLocation}.evidence.refs must not be empty`);
        for (const ref of refs) {
          if (!nonEmptyString(ref)) {
            fail(`${findingLocation}.evidence.refs contains an empty ref`);
            continue;
          }
          // 逻辑引用（非文件路径）：browser: 指浏览器锚定，interaction: 指交互态，
          // script:<dim>.<class> 指脚本直判输出。三者都不该走文件存在性检查——
          // 漏掉 script: 会逼执行者去创建名为 "script:10.A" 的畸形文件来满足校验。
          if (
            ref.startsWith("browser:") ||
            ref.startsWith("interaction:") ||
            ref.startsWith("script:")
          ) {
            // script: 引用必须能在 runDir 里找到对应的 probe JSON，否则等于无证据。
            if (ref.startsWith("script:")) {
              const key = ref.slice("script:".length).replace(".", "-");
              const hasProbe = fs
                .readdirSync(runDir)
                .some((name) => name.includes(key) && name.endsWith(".json"));
              if (!hasProbe) {
                fail(
                  `${findingLocation}.evidence ref ${ref} has no matching probe JSON in runDir (expected a file containing "${key}")`,
                );
              }
            }
            continue;
          }
          const resolved = path.resolve(runDir, ref);
          if (!resolved.startsWith(`${runDir}${path.sep}`) && resolved !== runDir) {
            fail(`${findingLocation}.evidence ref escapes runDir: ${ref}`);
          } else if (!fs.existsSync(resolved)) {
            fail(`${findingLocation}.evidence ref does not exist: ${ref}`);
          }
        }
      }
      for (const field of ["observation", "expected", "user_impact", "reference_doc", "fix_recommendation"]) {
        requireString(finding[field], `${findingLocation}.${field}`);
      }
    }

    for (const [coverageIndex, item] of coverage.entries()) {
      const coverageLocation = `${pageLocation}.class_coverage[${coverageIndex}]`;
      if (!isObject(item)) {
        fail(`${coverageLocation} must be an object`);
        continue;
      }
      if (!/^\d{2}$/.test(item.dimension || "")) fail(`${coverageLocation}.dimension must be two digits`);
      if (typeof item.class !== "string") fail(`${coverageLocation}.class must be a string`);
      if (!verdictValues.has(item.verdict)) fail(`${coverageLocation}.verdict is invalid`);
      const refs = requireArray(item.evidence_refs, `${coverageLocation}.evidence_refs`);
      const key = coverageKey(page.url, item.dimension, item.class);
      if (coverageByKey.has(key)) fail(`duplicate class coverage: ${page.url} ${item.dimension}.${item.class}`);
      else coverageByKey.set(key, item);

      if (item.verdict === "not_applicable" && refs.length !== 0) {
        fail(`${coverageLocation}.evidence_refs must be empty for not_applicable`);
      }
      if ((item.verdict === "actionable" || item.verdict === "already_satisfied") && refs.length === 0) {
        fail(`${coverageLocation}.evidence_refs must reference findings`);
      }
      // 判成待授权就必须指向一条说清「怎么授权、不授权的代价」的记录，
      // 否则用户看到的只是"没查"，无从决策——那正是把它降级成 blocker 的老毛病。
      if (item.verdict === "pending_authorization") {
        if (refs.length === 0) {
          fail(`${coverageLocation}.evidence_refs must reference pending_authorizations entries`);
        }
        for (const ref of refs) {
          if (!pendingAuthById.has(ref)) {
            fail(`${coverageLocation} references unknown pending_authorization: ${ref}`);
          }
        }
      }
      if (item.verdict === "blocker" && !nonEmptyString(item.blocker_reason)) {
        fail(`${coverageLocation}.blocker_reason is required for blocker`);
      }
    }
  }

  for (const [gapIndex, gap] of gaps.entries()) {
    const gapLocation = `gaps[${gapIndex}]`;
    if (!isObject(gap)) {
      fail(`${gapLocation} must be an object`);
      continue;
    }
    for (const field of ["id", "page", "dimension", "class", "reason"]) requireString(gap[field], `${gapLocation}.${field}`);
    if (gapsById.has(gap.id)) fail(`duplicate gap id: ${gap.id}`);
    else gapsById.set(gap.id, gap);
    const coverage = coverageByKey.get(coverageKey(gap.page, gap.dimension, gap.class));
    if (!coverage || coverage.verdict !== "blocker") fail(`${gapLocation} has no matching blocker class_coverage`);
    else if (!coverage.evidence_refs.includes(gap.id)) fail(`${gapLocation} is not referenced by matching blocker class_coverage`);
  }

  const referencedGapIds = new Set();
  for (const [blockerIndex, blocker] of blockers.entries()) {
    const blockerLocation = `blockers[${blockerIndex}]`;
    if (!isObject(blocker)) {
      fail(`${blockerLocation} must be an object`);
      continue;
    }
    for (const field of ["id", "stage", "page", "reason"]) requireString(blocker[field], `${blockerLocation}.${field}`);
    for (const gapId of requireArray(blocker.gap_ids, `${blockerLocation}.gap_ids`)) referencedGapIds.add(gapId);
  }

  for (const [key, coverage] of coverageByKey.entries()) {
    const [pageUrl, dimension, className] = key.split("\u0000");
    if (coverage.verdict === "actionable" || coverage.verdict === "already_satisfied") {
      for (const ref of coverage.evidence_refs) {
        const finding = findingsById.get(ref);
        if (!finding) {
          fail(`coverage ${pageUrl} ${dimension}.${className} references missing finding: ${ref}`);
          continue;
        }
        if (finding.location?.page !== pageUrl || finding.dimension !== dimension || finding.class !== className) {
          fail(`coverage ${pageUrl} ${dimension}.${className} references mismatched finding: ${ref}`);
        }
        if (finding.disposition !== coverage.verdict) {
          fail(`coverage ${pageUrl} ${dimension}.${className} verdict conflicts with finding ${ref}`);
        }
      }
    }
    if (coverage.verdict === "blocker") {
      if (coverage.evidence_refs.length === 0) fail(`blocker coverage ${pageUrl} ${dimension}.${className} must reference gap ids`);
      for (const gapId of coverage.evidence_refs) {
        const gap = gapsById.get(gapId);
        if (!gap) fail(`blocker coverage ${pageUrl} ${dimension}.${className} references missing gap: ${gapId}`);
        if (gap && (gap.page !== pageUrl || gap.dimension !== dimension || gap.class !== className)) {
          fail(`blocker coverage ${pageUrl} ${dimension}.${className} references mismatched gap: ${gapId}`);
        }
      }
    }
  }

  for (const gapId of gapsById.keys()) {
    if (!referencedGapIds.has(gapId)) fail(`gap is not referenced by a top-level blocker: ${gapId}`);
  }
}

if (!isObject(state)) fail("audit state must be an object");
else {
  requireString(state.run_id, "audit_state.run_id");
  if (report?.run_id && state.run_id !== report.run_id) fail("audit state run_id does not match report run_id");
  if (!isObject(state.stages)) fail("audit_state.stages must be an object");
  else {
    for (const stage of ["S0", "S1", "S2", "S3", "S4", "S5", "S6"]) {
      if (!stageTerminalValues.has(state.stages[stage])) fail(`audit_state.stages.${stage} is not terminal`);
    }
    if (!new Set([...stageTerminalValues, "running"]).has(state.stages.S7)) fail("audit_state.stages.S7 is invalid");
  }
  const units = requireArray(state.judgement_units, "audit_state.judgement_units");
  for (const [unitIndex, unit] of units.entries()) {
    const unitLocation = `audit_state.judgement_units[${unitIndex}]`;
    if (!isObject(unit)) {
      fail(`${unitLocation} must be an object`);
      continue;
    }
    requireString(unit.id, `${unitLocation}.id`);
    if (!unitTerminalValues.has(unit.status)) fail(`${unitLocation}.status is not terminal`);
    // 双 Judge 并行 tie-breaker 取代了旧的 Judge + 独立 Verifier 结构：
    // 至少两个互不相同的 judge 上下文，分歧时追加的 tie-breaker 也必须是新上下文。
    const judgeTasks = requireArray(unit.judge_tasks, `${unitLocation}.judge_tasks`);
    for (const [taskIndex, task] of judgeTasks.entries()) {
      requireString(task, `${unitLocation}.judge_tasks[${taskIndex}]`);
    }
    if (judgeTasks.length < 2) {
      fail(`${unitLocation}.judge_tasks must contain at least two independent judges`);
    }
    if (new Set(judgeTasks).size !== judgeTasks.length) {
      fail(`${unitLocation} reuses the same judge context more than once`);
    }
    if (unit.status === "blocked") {
      const represented = report?.blockers?.some((blocker) => blocker.id === unit.id || blocker.unit_ids?.includes(unit.id));
      if (!represented) fail(`${unitLocation} is blocked but absent from report.blockers`);
    }
  }
}

// §0「受限截图」例外：上限 3 张、每张必须留痕说明脚本为何不够。
// 截图是逃生舱不是工具——超限说明判据本身有问题，该补判据而不是多截几张。
{
  const log = state?.screenshot_log;
  if (screenshotFindings.length > 0) {
    if (!Array.isArray(log) || log.length === 0) {
      fail(
        `report uses screenshot evidence but audit_state.screenshot_log is missing; each screenshot must record why script evidence was insufficient`,
      );
    } else {
      for (const [index, entry] of log.entries()) {
        const entryLocation = `audit_state.screenshot_log[${index}]`;
        if (!isObject(entry)) {
          fail(`${entryLocation} must be an object`);
          continue;
        }
        for (const field of ["dimension", "class", "script_gave", "why_insufficient", "confirms"]) {
          requireString(entry[field], `${entryLocation}.${field}`);
        }
      }
    }
  }
  if (Array.isArray(log) && log.length > SCREENSHOT_LIMIT) {
    fail(
      `audit_state.screenshot_log has ${log.length} entries, over the limit of ${SCREENSHOT_LIMIT}; fix the class criteria instead of taking more screenshots`,
    );
  }
}

const result = { verdict: errors.length === 0 ? "pass" : "fail", errors };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = errors.length === 0 ? 0 : 1;
