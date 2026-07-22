#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRasterInfo } from "./validate-style-bundle.mjs";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = "content-production-provider/v1";
const PROVIDER = "illustration-v1";
const PLATFORMS = new Set(["wechat", "xiaohongshu", "zhihu", "weibo", "toutiao"]);
const VARIANTS = new Set(["A", "B"]);
const keys = (value) => value.split(" ");
const REQUEST_KEYS = keys("schema_version contract task_id capability provider_contract run_dir run_mode mode attempt platform provider_platform variant selection inputs output_dir expected_artifacts options interaction_policy");
const OPTION_KEYS = keys("requested_output publishing_path style_id max_images brand_override backend_hint model_preference execution_strategy");
const SELECTION_KEYS = keys("platform variant title_id title topic_phrase draft_path draft_sha256 decision_rule");
const PLAN_KEYS = keys("schema_version task_id status platform provider_platform variant source selection options analysis style brand generation_backend generation_geometry image_count anchors shot_list residual_risk");
const ANALYSIS_KEYS = keys("main_line content_type expression_need");
const STYLE_KEYS = keys("id platform style_file style_spec style_reference");
const BRAND_KEYS = keys("enabled policy_default_enabled override policy_source disabled_reason");
const BACKEND_KEYS = keys("kind adapter endpoint_source resolved_model artifact_format credential_access model_check process_cleanup_plan process_cleanup_status");
const BOUNDED_BACKEND_KEYS = [...BACKEND_KEYS, "aspect_control", "structured_size"];
const GEOMETRY_KEYS = keys("geometry_profile resolved_model requested_dimensions target_aspect_ratio design_dimensions delivery_dimensions ratio_tolerance minimum_short_edge native_output_policy post_generation_resize");
const ANCHOR_KEYS = keys("image_id placement source_excerpt core_meaning structure visual_metaphor main_action suggested_elements short_labels qa_risk");
const BOUNDED_ANCHOR_KEYS = [...ANCHOR_KEYS, "text_mode"];
const BUNDLE_KEYS = keys("schema_version task_id status platform provider_platform variant source selection plan shot_list style brand generation_backend generation_geometry image_count manifest images residual_risk");
const IMAGE_KEYS = keys("image_id file file_sha256 source_file source_sha256 prompt_path prompt_sha256 placement core_meaning structure visual_metaphor content_qa_status style_qa_status brand_qa_status set_qa_status brand_overlay_status size_check_status generation_attempt requested_dimensions source_dimensions source_aspect_ratio source_artifact delivery_dimensions delivery_artifact native_output_preserved post_generation_actions geometry_attempts residual_risk");
const REF_KEYS = keys("path sha256");
const ARTIFACT_KEYS = keys("format bytes");
const DELIVERY_ARTIFACT_KEYS = keys("format bytes hard_limit_exporter");
const GEOMETRY_ATTEMPT_KEYS = keys("attempt requested_dimensions source_dimensions status");
const EXPRESSIONS = new Set([
  "Concept explanation", "Workflow/process", "Before-after comparison", "Layered framework",
  "Common mistakes or boundaries", "Decision tree", "Checklist or summary", "Story/state transition"
]);

function emit(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameKeys(value, keys) {
  return plain(value) && Object.keys(value).length === keys.length
    && new Set(Object.keys(value)).size === keys.length && keys.every((key) => key in value);
}

function sameItems(value, expected) {
  return Array.isArray(value) && value.length === expected.length
    && value.every((item, index) => item === expected[index]);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".."
    && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll("\\", "/");
}

function providerPlatform(platform) {
  return platform === "xiaohongshu" ? "xhs" : platform;
}

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: "visual", ...extra });
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (existsSync(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function names(platform, attempt, mode) {
  const base = `07-visual/${platform}`;
  const version = String(attempt).padStart(3, "0");
  const suffix = attempt === 1 ? "" : `.v${version}`;
  return {
    base,
    request: `${base}/illustration-${mode}${suffix}.request.json`,
    result: `${base}/illustration-${mode}${suffix}.result.json`,
    plan: `${base}/plan${suffix}.json`,
    shot: `${base}/shot-list${suffix}.md`,
    bundle: `${base}/bundle${suffix}.json`,
    manifest: `${base}/manifest${suffix}.md`,
    promptDir: `${base}/prompts${attempt === 1 ? "" : `/v${version}`}`,
    imageVersion: attempt === 1 ? "" : `/v${version}`
  };
}

async function safeFile(context, relativePath, issues, code) {
  if (typeof relativePath !== "string" || !relativePath || !context.runDir) {
    add(issues, code, `Missing file path: ${relativePath || "(missing)"}.`);
    return null;
  }
  const path = resolve(context.runDir, relativePath);
  if (!inside(context.runDir, path) || !existsSync(path)) {
    add(issues, code, `Missing or unsafe file: ${relativePath}.`, { path: relativePath });
    return null;
  }
  try {
    const fileStat = await lstat(path);
    const real = await realpath(path);
    if (fileStat.isSymbolicLink() || !fileStat.isFile()
      || await hasSymlinkComponent(context.runDir, path) || !inside(context.runRealDir, real)) {
      add(issues, code, `File must be real and remain inside run_dir: ${relativePath}.`, { path: relativePath });
      return null;
    }
    return path;
  } catch (error) {
    add(issues, code, error.message, { path: relativePath });
    return null;
  }
}

async function safeOutputTarget(context, relativePath) {
  if (!context.outputDir || typeof relativePath !== "string") return false;
  const path = resolve(context.runDir, relativePath);
  if (!inside(context.outputDir, path) || await hasSymlinkComponent(context.runDir, path, false)) return false;
  if (!existsSync(path)) return true;
  const fileStat = await lstat(path);
  return !fileStat.isSymbolicLink() && fileStat.isFile()
    && inside(context.outputRealDir, await realpath(path));
}

function validOptions(options, platform, bounded = false) {
  const expectedOutput = platform === "wechat" ? "body_illustrations"
    : platform === "xiaohongshu" ? "carousel" : "post_illustrations";
  return sameKeys(options, OPTION_KEYS)
    && options.requested_output === expectedOutput && options.publishing_path === null
    && (options.style_id === null || typeof options.style_id === "string" && Boolean(options.style_id.trim()))
    && (options.max_images === null || Number.isInteger(options.max_images)
      && options.max_images > 0 && (!bounded || options.max_images <= 8))
    && [null, "enabled", "disabled"].includes(options.brand_override)
    && ["runtime-native", "configured-api", "unknown"].includes(options.backend_hint)
    && (options.model_preference === null
      || typeof options.model_preference === "string" && Boolean(options.model_preference.trim()))
    && options.execution_strategy === (bounded ? "bounded_per_image" : "one_image_at_a_time");
}

function validSelection(selection, platform, variant) {
  return sameKeys(selection, SELECTION_KEYS) && selection.platform === platform
    && selection.variant === variant && typeof selection.title_id === "string" && Boolean(selection.title_id)
    && typeof selection.title === "string" && Boolean(selection.title.trim())
    && (platform === "weibo" ? typeof selection.topic_phrase === "string" : selection.topic_phrase === null)
    && selection.draft_path === `05-platforms/${platform}/${variant}/final.md`
    && /^[a-f0-9]{64}$/.test(selection.draft_sha256 || "")
    && typeof selection.decision_rule === "string" && Boolean(selection.decision_rule.trim());
}

async function validateRequest(input) {
  const context = {
    issues: [], requestPath: resolve(input || ""), request: null, requestSha256: null,
    runDir: null, runRealDir: null, outputDir: null, outputRealDir: null, state: null,
    spec: null, inputPaths: new Map(), plan: null
  };
  if (!input || !existsSync(context.requestPath)) {
    add(context.issues, "missing_provider_request", `Missing request: ${context.requestPath}.`);
    return context;
  }
  try {
    const requestStat = await lstat(context.requestPath);
    if (requestStat.isSymbolicLink() || !requestStat.isFile()) throw new Error("Request must be a real file.");
    context.request = JSON.parse(await readFile(context.requestPath, "utf8"));
    context.requestSha256 = await sha256(context.requestPath);
  } catch (error) {
    add(context.issues, "invalid_provider_request", error.message);
    return context;
  }

  const request = context.request;
  context.runDir = typeof request.run_dir === "string" && isAbsolute(request.run_dir)
    ? resolve(request.run_dir) : null;
  try {
    const runStat = await lstat(context.runDir || "");
    if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error("run_dir must be a real directory.");
    context.runRealDir = await realpath(context.runDir);
    if (!inside(context.runDir, context.requestPath)
      || await hasSymlinkComponent(context.runDir, context.requestPath)) {
      throw new Error("Request must remain inside run_dir.");
    }
  } catch (error) {
    add(context.issues, "invalid_provider_run_dir", error.message);
  }

  const targetValid = PLATFORMS.has(request.platform) && VARIANTS.has(request.variant)
    && request.provider_platform === providerPlatform(request.platform);
  if (!targetValid) add(context.issues, "invalid_provider_target", "Unsupported platform, alias, or variant.");
  const attemptValid = Number.isInteger(request.attempt) && request.attempt > 0;
  if (!attemptValid) add(context.issues, "provider_attempt_mismatch", "attempt must be a positive integer.");
  const modeValid = ["plan", "generate"].includes(request.mode);
  if (targetValid && attemptValid && modeValid) context.spec = names(request.platform, request.attempt, request.mode);

  if (context.runDir) {
    const statePath = await safeFile(context, "run.json", context.issues, "invalid_provider_state");
    if (statePath) {
      try { context.state = JSON.parse(await readFile(statePath, "utf8")); } catch (error) {
        add(context.issues, "invalid_provider_state", error.message);
      }
    }
  }
  if (context.state) {
    const visual = context.state.stages?.visual;
    if (context.state.schema_version !== 2 || typeof context.state.run_id !== "string"
      || context.state.status !== "running" || context.state.current_stage !== "visual"
      || visual?.status !== "running" || visual?.attempt !== request.attempt) {
      add(context.issues, "provider_attempt_mismatch", "Request must target the current running visual attempt.");
    }
    if (request.run_mode !== context.state.run_mode) {
      add(context.issues, "invalid_provider_request", "run_mode does not match run.json.");
    }
    const expectedTask = `illustration:${context.state.run_id}:${request.platform}:${request.variant}:${request.mode}:attempt-${String(request.attempt).padStart(3, "0")}`;
    if (request.task_id !== expectedTask) {
      add(context.issues, "invalid_provider_task", `task_id must be ${expectedTask}.`);
    }
  }

  const bounded = context.state?.capabilities?.providers?.illustration?.profile === "bounded-per-image";

  if (context.spec && context.runDir) {
    context.outputDir = resolve(context.runDir, context.spec.base);
    try {
      const outputStat = await lstat(context.outputDir);
      context.outputRealDir = await realpath(context.outputDir);
      if (outputStat.isSymbolicLink() || !outputStat.isDirectory()
        || await hasSymlinkComponent(context.runDir, context.outputDir)
        || !inside(context.runRealDir, context.outputRealDir)) {
        throw new Error("output_dir must be a real directory inside run_dir.");
      }
    } catch (error) {
      add(context.issues, "invalid_provider_output_dir", error.message);
    }
  }

  if (!sameKeys(request, REQUEST_KEYS) || request.schema_version !== 1 || request.contract !== CONTRACT
    || request.capability !== "illustration" || request.provider_contract !== PROVIDER
    || !["autonomous", "reviewed"].includes(request.run_mode) || !modeValid
    || request.interaction_policy !== "return_to_orchestrator" || request.output_dir !== context.spec?.base
    || !validOptions(request.options, request.platform, bounded) || !validSelection(request.selection, request.platform, request.variant)
    || context.spec && context.requestPath !== resolve(context.runDir, context.spec.request)) {
    add(context.issues, "invalid_provider_request", "Request does not match illustration-v1.");
  }

  const roles = request.mode === "plan"
    ? ["final_draft", "title_selection", "visual_coverage"]
    : ["final_draft", "title_selection", "visual_coverage", "illustration_plan", "shot_list"];
  if (!Array.isArray(request.inputs) || request.inputs.length !== roles.length
    || !request.inputs.every((item, index) => plain(item) && sameKeys(item, ["role", "path", "sha256"])
      && item.role === roles[index] && typeof item.path === "string" && /^[a-f0-9]{64}$/.test(item.sha256 || ""))) {
    add(context.issues, "invalid_provider_inputs", `inputs must be exactly: ${roles.join(", ")}.`);
  } else if (context.runRealDir) {
    for (const item of request.inputs) {
      const path = await safeFile(context, item.path, context.issues, "provider_input_symlink");
      if (path) {
        context.inputPaths.set(item.role, path);
        if (await sha256(path) !== item.sha256) {
          add(context.issues, "provider_input_drift", `Input hash is stale: ${item.path}.`, { path: item.path });
        }
      }
    }
  }

  const finalInput = request.inputs?.find((item) => item.role === "final_draft");
  const titleInput = request.inputs?.find((item) => item.role === "title_selection");
  const coverageInput = request.inputs?.find((item) => item.role === "visual_coverage");
  if (!finalInput || finalInput.path !== request.selection?.draft_path
    || finalInput.sha256 !== request.selection?.draft_sha256) {
    add(context.issues, "invalid_provider_inputs", "final_draft must exactly match selection lineage.");
  }
  const titleGate = context.state?.gates?.titles;
  if (titleGate?.status !== "approved" || !titleInput
    || titleGate.decision_ref?.path !== titleInput.path || titleGate.decision_ref?.sha256 !== titleInput.sha256) {
    add(context.issues, "title_selection_lineage_mismatch", "title_selection must be the approved titles decision.");
  }
  const selectionPath = context.inputPaths.get("title_selection");
  if (selectionPath) {
    try {
      const decision = JSON.parse(await readFile(selectionPath, "utf8"));
      const matches = Array.isArray(decision.selections)
        ? decision.selections.filter((item) => sameJson(item, request.selection)) : [];
      if (decision.status !== "PROPOSED" || matches.length !== 1
        || decision.decision_rule !== request.selection.decision_rule) {
        add(context.issues, "title_selection_lineage_mismatch", "selection must exactly match one approved decision item.");
      }
    } catch (error) {
      add(context.issues, "title_selection_lineage_mismatch", error.message);
    }
  }
  const coveragePath = context.inputPaths.get("visual_coverage");
  if (coveragePath) {
    try {
      context.coverage = JSON.parse(await readFile(coveragePath, "utf8"));
      const version = `v${String(request.attempt).padStart(3, "0")}`;
      const expectedCoveragePath = `07-visual/${request.platform}/coverage.${version}.json`;
      const expectedPolicyPath = `07-visual/policy.${version}.json`;
      const policyPath = await safeFile(context, context.coverage.policy_ref?.path, context.issues, "visual_policy_missing");
      if (!coverageInput || coverageInput.path !== expectedCoveragePath
        || context.coverage.status !== "READY" || context.coverage.run_id !== context.state?.run_id
        || context.coverage.visual_attempt !== request.attempt || context.coverage.platform !== request.platform
        || context.coverage.variant !== request.variant
        || !sameJson(context.coverage.source, { path: finalInput?.path, sha256: finalInput?.sha256 })
        || context.coverage.title_selection?.path !== titleInput?.path
        || context.coverage.title_selection?.sha256 !== titleInput?.sha256
        || context.coverage.title_selection?.title_id !== request.selection?.title_id
        || context.coverage.policy_ref?.path !== expectedPolicyPath
        || !policyPath || await sha256(policyPath) !== context.coverage.policy_ref?.sha256
        || context.coverage.cardinality?.request_max_images !== request.options?.max_images) {
        add(context.issues, "visual_coverage_invalid", "visual_coverage must bind the current READY policy, source, title, attempt, and max_images.");
      }
    } catch (error) {
      add(context.issues, "visual_coverage_invalid", error.message);
    }
  }

  if (request.mode === "plan") {
    if (!sameItems(request.expected_artifacts, context.spec ? [context.spec.plan, context.spec.shot] : [])) {
      add(context.issues, "invalid_expected_artifacts", "Plan must authorize exactly plan.json and shot-list.md for the current attempt.");
    }
    if (context.state?.gates?.visual?.status === "approved") {
      add(context.issues, "plan_after_approval", "An approved visual plan cannot be overwritten.");
    }
  } else if (request.mode === "generate") {
    const planInput = request.inputs?.find((item) => item.role === "illustration_plan");
    const shotInput = request.inputs?.find((item) => item.role === "shot_list");
    if (!planInput || planInput.path !== context.spec?.plan || !shotInput || shotInput.path !== context.spec?.shot) {
      add(context.issues, "illustration_lineage_drift", "Generate must bind the current attempt plan and shot list.");
    }
    const visualGate = context.state?.gates?.visual;
    const bound = new Map((visualGate?.bound_artifacts || []).map((item) => [item.path, item.sha256]));
    if (visualGate?.status !== "approved" || !planInput || !shotInput
      || bound.get(planInput.path) !== planInput.sha256 || bound.get(shotInput.path) !== shotInput.sha256) {
      add(context.issues, "illustration_plan_not_approved", "Generate requires the approved current plan and shot-list hashes.");
    }
    const planPath = context.inputPaths.get("illustration_plan");
    if (planPath) {
      try { context.plan = JSON.parse(await readFile(planPath, "utf8")); } catch (error) {
        add(context.issues, "invalid_illustration_plan", error.message);
      }
    }
    if (context.plan) {
      const expected = expectedGenerateArtifacts(context, context.plan);
      if (!sameItems(request.expected_artifacts, expected)) {
        add(context.issues, "invalid_expected_artifacts", "Generate expected_artifacts do not exactly match the approved plan.");
      }
    }
  }

  if (context.spec) {
    for (const path of request.expected_artifacts || []) {
      if (!await safeOutputTarget(context, path)) {
        add(context.issues, "provider_output_escape", `Unsafe output target: ${path}.`, { path });
      }
    }
  }
  return context;
}

function expectedGenerateArtifacts(context, plan) {
  if (!Array.isArray(plan?.anchors) || !context.spec) return [];
  if (context.state?.capabilities?.providers?.illustration?.profile === "bounded-per-image") {
    return [context.spec.bundle, context.spec.manifest];
  }
  const images = expectedImagePaths(context, plan);
  return [
    context.spec.bundle,
    context.spec.manifest,
    ...images.map((item) => item.prompt),
    ...images.map((item) => item.source).filter(Boolean),
    ...images.map((item) => item.delivery)
  ];
}

async function registryStyle(plan, issues) {
  try {
    const registry = JSON.parse(await readFile(join(SKILL_ROOT, "references/style-registry.json"), "utf8"));
    const entry = registry.styles?.find((item) => item.id === plan.style?.id);
    if (!entry || entry.platform !== plan.provider_platform
      || !sameJson(plan.style, {
        id: entry.id,
        platform: entry.platform,
        style_file: entry.styleFile,
        style_spec: entry.specFile,
        style_reference: entry.styleReference
      })) {
      add(issues, "invalid_illustration_style", "style must exactly match one registered platform style.");
      return null;
    }
    for (const relativePath of [entry.styleFile, entry.specFile, entry.styleReference]) {
      const path = resolve(SKILL_ROOT, relativePath);
      if (!inside(SKILL_ROOT, path) || !existsSync(path) || (await lstat(path)).isSymbolicLink()) {
        add(issues, "invalid_illustration_style", `Registered style asset is unavailable: ${relativePath}.`);
        return null;
      }
    }
    return { entry, spec: JSON.parse(await readFile(join(SKILL_ROOT, entry.specFile), "utf8")) };
  } catch (error) {
    add(issues, "invalid_illustration_style", error.message);
    return null;
  }
}

function expectedBrand(request, styleSpec) {
  const policyDefault = styleSpec.brandPolicy?.defaultEnabled ?? true;
  const override = request.options.brand_override;
  const enabled = override === "enabled" ? true : override === "disabled" ? false : policyDefault;
  return {
    enabled,
    policy_default_enabled: policyDefault,
    override,
    policy_source: override === null ? (styleSpec.brandPolicy ? "style-default" : "legacy-default") : "user-override",
    disabled_reason: enabled ? null : override === "disabled" ? "disabled-by-user" : "disabled-by-style-default"
  };
}

async function expectedGeometry(styleSpec) {
  const profile = JSON.parse(await readFile(join(SKILL_ROOT, "references/gpt-image-2-geometry.spec.json"), "utf8"));
  const request = profile.requestSizesByRatio?.[styleSpec.canvas?.ratio];
  return {
    geometry_profile: profile.id,
    resolved_model: profile.model,
    requested_dimensions: request,
    target_aspect_ratio: styleSpec.canvas.ratio,
    design_dimensions: { width: styleSpec.canvas.width, height: styleSpec.canvas.height },
    delivery_dimensions: "source",
    ratio_tolerance: styleSpec.inputHandling.ratioTolerance,
    minimum_short_edge: styleSpec.inputHandling.minShortEdge ?? null,
    native_output_policy: "preserve",
    post_generation_resize: "forbidden"
  };
}

function validBackend(backend, status, bounded = false, geometry = null) {
  return sameKeys(backend, bounded ? BOUNDED_BACKEND_KEYS : BACKEND_KEYS) && ["runtime-native", "configured-api"].includes(backend.kind)
    && ["adapter", "endpoint_source", "process_cleanup_plan"].every((key) =>
      typeof backend[key] === "string" && Boolean(backend[key].trim()))
    && backend.resolved_model === "gpt-image-2" && ["png", "jpeg", "jpg"].includes(backend.artifact_format)
    && backend.credential_access === "pass" && backend.model_check === "pass"
    && backend.process_cleanup_status === status
    && (!bounded || ["hard_parameter", "prompt_only"].includes(backend.aspect_control)
      && (backend.aspect_control === "prompt_only" && backend.structured_size === null
        || backend.aspect_control === "hard_parameter" && sameJson(backend.structured_size, geometry?.requested_dimensions)));
}

function validStringArray(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((item) => typeof item === "string" && Boolean(item.trim()));
}

function validOptionalStringArray(value) {
  return Array.isArray(value) && new Set(value).size === value.length
    && value.every((item) => typeof item === "string" && Boolean(item.trim()));
}

async function currentGeneratedFiles(context) {
  const output = [];
  const version = `v${String(context.request.attempt).padStart(3, "0")}`;
  async function walk(relativePath) {
    const absolute = resolve(context.runDir, relativePath);
    if (!existsSync(absolute) || (await lstat(absolute)).isSymbolicLink()) return;
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const child = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else output.push(child);
    }
  }
  await walk(`${context.spec.base}/prompts`);
  await walk(`${context.spec.base}/images`);
  if (context.request.attempt === 1) {
    return output.filter((path) => !path.includes(`/prompts/v`) && !/\/images\/(?:unbranded\/|branded\/)?v\d{3}\//.test(path));
  }
  return output.filter((path) => path.includes(`/prompts/${version}/`)
    || path.includes(`/images/${version}/`) || path.includes(`/images/unbranded/${version}/`)
    || path.includes(`/images/branded/${version}/`));
}

async function validatePlan(context, { rejectGenerated = true } = {}) {
  const issues = [];
  const expectedTask = context.state
    ? `illustration:${context.state.run_id}:${context.request.platform}:${context.request.variant}:plan:attempt-${String(context.request.attempt).padStart(3, "0")}`
    : null;
  const planPath = context.inputPaths.get("illustration_plan")
    || await safeFile(context, context.spec.plan, issues, "missing_illustration_plan");
  const shotPath = context.inputPaths.get("shot_list")
    || await safeFile(context, context.spec.shot, issues, "missing_illustration_shot_list");
  let plan = context.plan;
  if (!plan && planPath) {
    try { plan = JSON.parse(await readFile(planPath, "utf8")); } catch (error) {
      add(issues, "invalid_illustration_plan", error.message);
    }
  }
  if (!plan) return { issues, plan: null, planPath, shotPath };
  if (!sameKeys(plan, PLAN_KEYS) || plan.schema_version !== 1 || plan.task_id !== expectedTask
    || plan.status !== "READY" || plan.platform !== context.request.platform
    || plan.provider_platform !== context.request.provider_platform || plan.variant !== context.request.variant
    || !sameJson(plan.source, context.request.inputs[0]) || !sameJson(plan.selection, context.request.selection)
    || !sameJson(plan.options, context.request.options)) {
    add(issues, "invalid_illustration_plan", "plan.json has invalid schema, task lineage, or status.");
  }
  if (plan.residual_risk !== "none") add(issues, "illustration_residual_risk", "Plan residual_risk must be none.");
  if (!sameKeys(plan.analysis, ANALYSIS_KEYS)
    || ![plan.analysis?.main_line, plan.analysis?.content_type].every((item) => typeof item === "string" && Boolean(item.trim()))
    || !EXPRESSIONS.has(plan.analysis?.expression_need)) {
    add(issues, "invalid_illustration_analysis", "Plan analysis is incomplete.");
  }
  const bounded = context.state?.capabilities?.providers?.illustration?.profile === "bounded-per-image";
  if (!sameKeys(plan.style, STYLE_KEYS) || !sameKeys(plan.brand, BRAND_KEYS)
    || !sameKeys(plan.generation_geometry, GEOMETRY_KEYS)
    || !validBackend(plan.generation_backend, "not-run", bounded, plan.generation_geometry)) {
    add(issues, "invalid_illustration_plan", "Plan style, brand, backend, or geometry schema is invalid.");
  }
  const registered = await registryStyle(plan, issues);
  if (registered) {
    if (context.request.options.style_id !== null && context.request.options.style_id !== registered.entry.id) {
      add(issues, "invalid_illustration_style", "Selected style does not match options.style_id.");
    }
    const brand = expectedBrand(context.request, registered.spec);
    if (!sameJson(plan.brand, brand)) add(issues, "invalid_illustration_brand", "Brand policy resolution is incorrect.");
    if (plan.brand.enabled && plan.generation_backend.artifact_format !== "png") {
      add(issues, "invalid_illustration_brand", "Brand-enabled generation requires PNG source artifacts.");
    }
    const geometry = await expectedGeometry(registered.spec);
    if (!sameJson(plan.generation_geometry, geometry)) {
      add(issues, "invalid_illustration_geometry", "Generation geometry does not match the registered Style Spec.");
    }
  }
  const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];
  if (!Number.isInteger(plan.image_count) || plan.image_count < 1 || plan.image_count !== anchors.length
    || bounded && plan.image_count > 8) {
    add(issues, "invalid_illustration_count", "image_count must equal the non-empty anchor count.");
  }
  if (context.request.options.max_images !== null && plan.image_count > context.request.options.max_images) {
    add(issues, "illustration_count_exceeds_max", "image_count exceeds options.max_images.");
  }
  const coverage = context.coverage;
  const eligibleUnits = Array.isArray(coverage?.coverage_units)
    ? coverage.coverage_units.filter((unit) => unit.eligible) : [];
  const unitsByExcerpt = new Map(eligibleUnits.map((unit) => [unit.source_excerpt, unit]));
  const mappedUnits = anchors.map((anchor) => unitsByExcerpt.get(anchor.source_excerpt)).filter(Boolean);
  const coveredIds = new Set(mappedUnits.map((unit) => unit.unit_id));
  const requiredIds = eligibleUnits.filter((unit) => unit.required).map((unit) => unit.unit_id);
  if (!coverage || plan.image_count < coverage.cardinality?.minimum) {
    add(issues, "visual_image_count_below_policy_min", "image_count is below the current coverage minimum.");
  }
  if (coverage && plan.image_count > coverage.cardinality?.target) {
    add(issues, "visual_image_count_above_policy_max", "image_count exceeds the current coverage target.");
  }
  if (mappedUnits.length !== anchors.length) {
    add(issues, "visual_anchor_coverage_mismatch", "Every anchor source_excerpt must exactly map to one eligible coverage unit.");
  }
  if (coveredIds.size !== mappedUnits.length) {
    add(issues, "visual_anchor_duplicate_coverage", "Different anchors cannot map to the same coverage unit.");
  }
  if (requiredIds.some((unitId) => !coveredIds.has(unitId))) {
    add(issues, "visual_required_coverage_missing", "Plan anchors must cover every required coverage unit.");
  }
  if (context.request.platform === "xiaohongshu"
    && (anchors.length !== eligibleUnits.length || coveredIds.size !== eligibleUnits.length)) {
    add(issues, "visual_xhs_card_coverage_incomplete", "Xiaohongshu must map exactly one anchor to every carousel page.");
  }
  if (mappedUnits.some((unit, index) => index > 0 && mappedUnits[index - 1].ordinal >= unit.ordinal)) {
    add(issues, "visual_anchor_order_invalid", "Plan anchors must follow source ordinal order.");
  }
  const sourceText = context.inputPaths.get("final_draft")
    ? await readFile(context.inputPaths.get("final_draft"), "utf8") : "";
  const ids = new Set();
  const excerpts = new Set();
  const meanings = new Set();
  for (const anchor of anchors) {
    const excerpt = anchor?.source_excerpt?.replace(/\s+/g, " ").trim();
    const meaning = anchor?.core_meaning?.replace(/\s+/g, " ").trim();
    if (!sameKeys(anchor, bounded ? BOUNDED_ANCHOR_KEYS : ANCHOR_KEYS) || !/^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(anchor.image_id || "")
      || ids.has(anchor.image_id) || bounded && (excerpts.has(excerpt) || meanings.has(meaning)) || ![anchor.placement, anchor.source_excerpt, anchor.core_meaning,
        anchor.structure, anchor.visual_metaphor, anchor.main_action, anchor.qa_risk]
        .every((item) => typeof item === "string" && Boolean(item.trim()))
      || !validStringArray(anchor.suggested_elements) || (bounded
        ? !["icons_only", "allowlist"].includes(anchor.text_mode)
          || !validOptionalStringArray(anchor.short_labels)
          || anchor.text_mode === "icons_only" && anchor.short_labels.length !== 0
          || anchor.text_mode === "allowlist" && anchor.short_labels.length === 0
          || /(?:workflow|process|checklist)/i.test(anchor.structure) && anchor.text_mode !== "icons_only"
        : !validStringArray(anchor.short_labels))) {
      add(issues, "invalid_illustration_anchor", `Invalid anchor: ${anchor?.image_id || "(missing)"}.`);
      continue;
    }
    ids.add(anchor.image_id);
    excerpts.add(excerpt);
    meanings.add(meaning);
    if (!sourceText.includes(anchor.source_excerpt)) {
      add(issues, "unsupported_illustration_anchor", `source_excerpt is absent from final draft: ${anchor.image_id}.`);
    }
  }
  const expectedShot = { path: context.spec.shot, sha256: shotPath ? await sha256(shotPath) : null };
  if (!sameKeys(plan.shot_list, REF_KEYS) || !sameJson(plan.shot_list, expectedShot)) {
    add(issues, "illustration_lineage_drift", "Plan shot_list path or hash is stale.");
  }
  if (shotPath) {
    const shot = await readFile(shotPath, "utf8");
    if (!/^artifact:\s*IllustrationShotList\s*$/m.test(shot) || !/^status:\s*READY\s*$/m.test(shot)
      || !shot.includes(`task_id: ${expectedTask}`)) {
      add(issues, "invalid_illustration_shot_list", "shot-list.md has invalid frontmatter.");
    }
    for (const anchor of anchors) {
      const escaped = anchor.image_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const headings = shot.match(new RegExp(`^##\\s+${escaped}\\s*$`, "gm")) || [];
      if (headings.length !== 1 || !shot.includes(anchor.core_meaning)) {
        add(issues, "invalid_illustration_shot_list", `shot-list.md does not exactly cover ${anchor.image_id}.`);
      }
    }
  }
  if (rejectGenerated && (await currentGeneratedFiles(context)).length) {
    add(issues, "plan_contains_generated_assets", "Plan mode cannot create current-attempt prompts or images.");
  }
  return { issues, plan, planPath, shotPath };
}

async function rasterInfo(path) {
  try { return readRasterInfo(path); } catch { return null; }
}

function validDimensions(value) {
  return plain(value) && sameKeys(value, ["width", "height"])
    && Number.isInteger(value.width) && value.width > 0 && Number.isInteger(value.height) && value.height > 0;
}

function ratioOf(value) {
  const [width, height] = String(value).split(":").map(Number);
  return width / height;
}

async function validateGenerate(context, planValidation) {
  const issues = [];
  const expected = expectedGenerateArtifacts(context, planValidation.plan);
  const artifacts = [];
  const paths = new Map();
  for (const path of expected) {
    const safe = await safeFile(context, path, issues, "provider_artifact_symlink");
    if (safe) {
      paths.set(path, safe);
      artifacts.push({ role: artifactRole(context, path), path, sha256: await sha256(safe) });
    }
  }
  const expectedGenerated = expected.filter((path) => path.includes("/prompts/") || path.includes("/images/"));
  const actualGenerated = await currentGeneratedFiles(context);
  if (!sameItems([...actualGenerated].sort(), [...expectedGenerated].sort())) {
    add(issues, "unexpected_illustration_artifact", "Current-attempt prompts and images must exactly match expected_artifacts.");
  }
  const bundlePath = paths.get(context.spec.bundle);
  let bundle = null;
  if (bundlePath) {
    try { bundle = JSON.parse(await readFile(bundlePath, "utf8")); } catch (error) {
      add(issues, "invalid_illustration_bundle", error.message);
    }
  }
  const plan = planValidation.plan;
  if (!bundle || !plan) return { issues, artifacts, bundle };
  const expectedBackend = { ...plan.generation_backend, process_cleanup_status: "pass" };
  if (!sameKeys(bundle, BUNDLE_KEYS) || bundle.schema_version !== 1 || bundle.task_id !== context.request.task_id
    || bundle.status !== "PASS" || bundle.platform !== context.request.platform
    || bundle.provider_platform !== context.request.provider_platform || bundle.variant !== context.request.variant
    || !sameJson(bundle.source, context.request.inputs[0]) || !sameJson(bundle.selection, context.request.selection)
    || !sameJson(bundle.plan, { path: context.spec.plan, sha256: context.request.inputs[3].sha256 })
    || !sameJson(bundle.shot_list, { path: context.spec.shot, sha256: context.request.inputs[4].sha256 })
    || !sameJson(bundle.style, plan.style) || !sameJson(bundle.brand, plan.brand)
    || !sameJson(bundle.generation_backend, expectedBackend)
    || !sameJson(bundle.generation_geometry, plan.generation_geometry)
    || bundle.image_count !== plan.image_count) {
    add(issues, "invalid_illustration_bundle", "bundle.json has invalid schema, lineage, backend, or status.");
  }
  if (bundle.residual_risk !== "none") add(issues, "illustration_residual_risk", "Bundle residual_risk must be none.");
  const manifestPath = paths.get(context.spec.manifest);
  const expectedManifest = { path: context.spec.manifest, sha256: manifestPath ? await sha256(manifestPath) : null };
  if (!sameKeys(bundle.manifest, REF_KEYS) || !sameJson(bundle.manifest, expectedManifest)) {
    add(issues, "illustration_lineage_drift", "Native manifest path or hash is stale.");
  }
  const images = Array.isArray(bundle.images) ? bundle.images : [];
  const anchors = plan.anchors;
  if (images.length !== anchors.length || images.some((image, index) => image?.image_id !== anchors[index].image_id)) {
    add(issues, "illustration_image_ids_mismatch", "Bundle image IDs must exactly match approved plan order.");
  }
  if (manifestPath) {
    const manifest = await readFile(manifestPath, "utf8");
    if (!manifest.trim() || !manifest.includes("post_illustration_bundle:")) {
      add(issues, "invalid_native_manifest", "manifest.md must use the native post_illustration_bundle schema.");
    }
    for (const image of images) {
      if (!manifest.includes(image.image_id || "(missing)") || !manifest.includes(runRelative(context.outputDir, resolve(context.runDir, image.file || "")))) {
        add(issues, "invalid_native_manifest", `manifest.md does not bind ${image.image_id || "(missing)"}.`);
      }
    }
  }
  const expectedPaths = expectedImagePaths(context, plan);
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const anchor = anchors[index];
    const pathSet = expectedPaths[index];
    if (!sameKeys(image, IMAGE_KEYS) || !anchor || !pathSet) {
      add(issues, "invalid_illustration_image", `Invalid image row ${index + 1}.`);
      continue;
    }
    if (image.image_id !== anchor.image_id || image.placement !== anchor.placement
      || image.core_meaning !== anchor.core_meaning || image.structure !== anchor.structure
      || image.visual_metaphor !== anchor.visual_metaphor || image.prompt_path !== pathSet.prompt
      || image.source_file !== pathSet.source || image.file !== pathSet.delivery) {
      add(issues, "illustration_image_ids_mismatch", `Image row does not match approved anchor ${anchor.image_id}.`);
    }
    const promptPath = paths.get(pathSet.prompt);
    const sourcePath = pathSet.source ? paths.get(pathSet.source) : paths.get(pathSet.delivery);
    const deliveryPath = paths.get(pathSet.delivery);
    if (promptPath && image.prompt_sha256 !== await sha256(promptPath)) {
      add(issues, "provider_artifact_drift", `Prompt hash is stale: ${pathSet.prompt}.`, { path: pathSet.prompt });
    }
    if (promptPath && !(await readFile(promptPath, "utf8")).trim()) {
      add(issues, "invalid_illustration_prompt", `Prompt is empty: ${pathSet.prompt}.`, { path: pathSet.prompt });
    }
    if (deliveryPath && image.file_sha256 !== await sha256(deliveryPath)) {
      add(issues, "provider_artifact_drift", `Delivery hash is stale: ${pathSet.delivery}.`, { path: pathSet.delivery });
    }
    if (pathSet.source && sourcePath && image.source_sha256 !== await sha256(sourcePath)) {
      add(issues, "provider_artifact_drift", `Source hash is stale: ${pathSet.source}.`, { path: pathSet.source });
    }
    if (pathSet.source && sourcePath && deliveryPath && await sha256(sourcePath) === await sha256(deliveryPath)) {
      add(issues, "invalid_illustration_brand", `Brand overlay did not change delivery bytes: ${anchor.image_id}.`);
    }
    if (!pathSet.source && (image.source_file !== null || image.source_sha256 !== null)) {
      add(issues, "invalid_illustration_brand", "Brand-disabled delivery must not declare a second source file.");
    }
    const sourceInfo = sourcePath ? await rasterInfo(sourcePath) : null;
    const deliveryInfo = deliveryPath ? await rasterInfo(deliveryPath) : null;
    const targetRatio = ratioOf(plan.generation_geometry.target_aspect_ratio);
    const dimensionsMatch = sourceInfo && deliveryInfo && validDimensions(image.source_dimensions)
      && validDimensions(image.delivery_dimensions) && image.source_dimensions.width === sourceInfo.width
      && image.source_dimensions.height === sourceInfo.height && image.delivery_dimensions.width === deliveryInfo.width
      && image.delivery_dimensions.height === deliveryInfo.height && sourceInfo.width === deliveryInfo.width
      && sourceInfo.height === deliveryInfo.height && Math.abs(sourceInfo.width / sourceInfo.height - targetRatio)
        <= plan.generation_geometry.ratio_tolerance
      && (plan.generation_geometry.minimum_short_edge === null
        || Math.min(sourceInfo.width, sourceInfo.height) >= plan.generation_geometry.minimum_short_edge);
    if (!dimensionsMatch || image.size_check_status !== "pass-native"
      || image.native_output_preserved !== true || !sameJson(image.requested_dimensions, plan.generation_geometry.requested_dimensions)
      || !Number.isFinite(image.source_aspect_ratio) || sourceInfo
        && Math.abs(image.source_aspect_ratio - sourceInfo.width / sourceInfo.height) > 1e-9) {
      add(issues, "illustration_geometry_mismatch", `Geometry mismatch for ${anchor.image_id}.`);
    }
    if (!sameKeys(image.source_artifact, ARTIFACT_KEYS) || !sameKeys(image.delivery_artifact, DELIVERY_ARTIFACT_KEYS)
      || !sourceInfo || !deliveryInfo || image.source_artifact.format !== sourceInfo.format
      || image.source_artifact.bytes !== sourceInfo.bytes || image.delivery_artifact.format !== deliveryInfo.format
      || image.delivery_artifact.bytes !== deliveryInfo.bytes || image.delivery_artifact.hard_limit_exporter !== null) {
      add(issues, "illustration_artifact_metadata_mismatch", `Artifact metadata mismatch for ${anchor.image_id}.`);
    }
    if (!Number.isInteger(image.generation_attempt) || image.generation_attempt < 1 || image.generation_attempt > 3
      || !Array.isArray(image.geometry_attempts) || image.geometry_attempts.length < 1
      || image.geometry_attempts.length > 3) {
      add(issues, "illustration_attempt_limit", `Generation attempts must remain within 1..3 for ${anchor.image_id}.`);
    } else {
      for (const [attemptIndex, attempt] of image.geometry_attempts.entries()) {
        if (!sameKeys(attempt, GEOMETRY_ATTEMPT_KEYS) || attempt.attempt !== attemptIndex + 1
          || !sameJson(attempt.requested_dimensions, plan.generation_geometry.requested_dimensions)
          || !validDimensions(attempt.source_dimensions)
          || !["pass-native", "rejected-geometry", "rejected-qa"].includes(attempt.status)) {
          add(issues, "illustration_geometry_mismatch", `Invalid geometry attempt for ${anchor.image_id}.`);
        }
      }
      const last = image.geometry_attempts.at(-1);
      if (last?.status !== "pass-native" || image.generation_attempt !== last?.attempt) {
        add(issues, "illustration_attempt_limit", `Final accepted attempt is inconsistent for ${anchor.image_id}.`);
      }
    }
    const disabled = plan.brand.disabled_reason;
    const brandValid = plan.brand.enabled
      ? image.brand_qa_status === "pass" && image.brand_overlay_status === "applied"
        && sameJson(image.post_generation_actions, ["brand-overlay-native"])
      : image.brand_qa_status === disabled && image.brand_overlay_status === disabled
        && sameJson(image.post_generation_actions, []);
    if (image.content_qa_status !== "pass" || image.style_qa_status !== "pass"
      || image.set_qa_status !== "pass" || !brandValid) {
      add(issues, "illustration_qa_failed", `QA failed for ${anchor.image_id}.`);
    }
    if (image.residual_risk !== "none") {
      add(issues, "illustration_residual_risk", `Image residual_risk must be none: ${anchor.image_id}.`);
    }
  }
  return { issues, artifacts, bundle };
}

function expectedImagePaths(context, plan) {
  const ext = plan.generation_backend.artifact_format === "png" ? "png" : "jpg";
  return plan.anchors.map((anchor) => ({
    prompt: `${context.spec.promptDir}/${anchor.image_id}.md`,
    source: plan.brand.enabled
      ? `${context.spec.base}/images/unbranded${context.spec.imageVersion}/${anchor.image_id}.png` : null,
    delivery: plan.brand.enabled
      ? `${context.spec.base}/images/branded${context.spec.imageVersion}/${anchor.image_id}.png`
      : `${context.spec.base}/images${context.spec.imageVersion}/${anchor.image_id}.${ext}`
  }));
}

function artifactRole(context, path) {
  if (path === context.spec.plan) return "illustration_plan";
  if (path === context.spec.shot) return "shot_list";
  if (path === context.spec.bundle) return "illustration_bundle";
  if (path === context.spec.manifest) return "native_manifest";
  if (path.includes("/prompts/")) return "prompt";
  if (path.includes("/images/unbranded/")) return "source_image";
  return "delivery_image";
}

async function collectPlanArtifacts(context, validation) {
  const issues = [];
  const artifacts = [];
  for (const path of [context.spec.plan, context.spec.shot]) {
    const safe = await safeFile(context, path, issues, "provider_artifact_symlink");
    if (safe) artifacts.push({ role: artifactRole(context, path), path, sha256: await sha256(safe) });
  }
  return { issues: [...validation.issues, ...issues], artifacts };
}

function makeResult(context, status, artifacts, issues, requestValid = true) {
  return {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request?.task_id || "unknown",
    request_sha256: context.requestSha256,
    status,
    artifacts,
    checks: {
      request_valid: requestValid,
      mode: context.request?.mode || null,
      attempt: context.request?.attempt || null,
      platform: context.request?.platform || null,
      provider_platform: context.request?.provider_platform || null
    },
    issues,
    warnings: []
  };
}

async function writeResult(context, status, artifacts, issues, requestValid = true) {
  if (!await safeOutputTarget(context, context.spec.result)) {
    throw new Error("Unsafe canonical illustration result target.");
  }
  const value = makeResult(context, status, artifacts, issues, requestValid);
  await writeFile(resolve(context.runDir, context.spec.result), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return value;
}

async function requestFailure(context) {
  if (context.request && context.spec && await safeOutputTarget(context, context.spec.result)) {
    const value = await writeResult(context, "BLOCKED", [], context.issues, false);
    emit(value, 2);
  } else {
    emit(makeResult(context, "BLOCKED", [], context.issues, false), 2);
  }
}

async function main() {
  const [command, requestInput, detail] = process.argv.slice(2);
  const validBlock = command !== "block" || typeof detail === "string" && Boolean(detail.trim());
  if (!["validate-request", "finalize", "block"].includes(command) || !requestInput || !validBlock) {
    emit({ status: "BLOCKED", issues: [{
      code: "invalid_provider_command",
      message: "Usage: provider-contract.mjs validate-request <request.json> | finalize <request.json> | block <request.json> <reason>",
      resume_from: "visual"
    }] }, 2);
    return;
  }
  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    await requestFailure(context);
    return;
  }
  if (command === "validate-request") {
    emit({
      status: "PASS",
      task_id: context.request.task_id,
      run_dir: context.runDir,
      output_dir: context.spec.base,
      mode: context.request.mode,
      attempt: context.request.attempt,
      issues: []
    });
    return;
  }
  if (command === "block") {
    const issues = [];
    add(issues, "illustration_provider_blocked", detail.trim());
    const value = await writeResult(context, "BLOCKED", [], issues);
    emit(value, 2);
    return;
  }
  const planValidation = await validatePlan(context, { rejectGenerated: context.request.mode === "plan" });
  const validation = context.request.mode === "plan"
    ? await collectPlanArtifacts(context, planValidation)
    : (() => validateGenerate(context, planValidation))();
  const resolved = await validation;
  const issues = context.request.mode === "plan"
    ? resolved.issues : [...planValidation.issues, ...resolved.issues];
  const status = issues.length ? "FAILED" : "PASS";
  const value = await writeResult(context, status, resolved.artifacts, issues);
  emit(value, status === "PASS" ? 0 : 2);
}

main().catch((error) => emit({
  status: "FAILED",
  issues: [{ code: "illustration_provider_failed", message: error.message, resume_from: "visual" }]
}, 2));
