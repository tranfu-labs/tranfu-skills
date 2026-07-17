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
const verdictValues = new Set(["actionable", "already_satisfied", "blocker", "not_applicable"]);
const evidenceTypes = new Set(["screenshot", "dom", "a11y", "computed_style", "layout_box", "interaction_state"]);
const stageTerminalValues = new Set(["completed", "completed_with_blockers", "skipped_explicit_single_page"]);
const unitTerminalValues = new Set(["verified", "blocked"]);

const findingsById = new Map();
const coverageByKey = new Map();
const gapsById = new Map();

if (isObject(report)) {
  requireString(report.run_id, "polish_audit_report.run_id");
  const pages = requireArray(report.pages, "polish_audit_report.pages");
  const gaps = requireArray(report.gaps, "polish_audit_report.gaps");
  const blockers = requireArray(report.blockers, "polish_audit_report.blockers");

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
        const refs = requireArray(finding.evidence.refs, `${findingLocation}.evidence.refs`);
        if (refs.length === 0) fail(`${findingLocation}.evidence.refs must not be empty`);
        for (const ref of refs) {
          if (!nonEmptyString(ref)) {
            fail(`${findingLocation}.evidence.refs contains an empty ref`);
            continue;
          }
          if (ref.startsWith("browser:") || ref.startsWith("interaction:")) continue;
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
    requireString(unit.judge_task, `${unitLocation}.judge_task`);
    requireString(unit.verifier_task, `${unitLocation}.verifier_task`);
    if (unit.judge_task === unit.verifier_task) fail(`${unitLocation} reuses judge as verifier`);
    if (unit.status === "blocked") {
      const represented = report?.blockers?.some((blocker) => blocker.id === unit.id || blocker.unit_ids?.includes(unit.id));
      if (!represented) fail(`${unitLocation} is blocked but absent from report.blockers`);
    }
  }
}

const result = { verdict: errors.length === 0 ? "pass" : "fail", errors };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = errors.length === 0 ? 0 : 1;
