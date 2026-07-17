import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/provider-contract.mjs");
const CONTRACT = "content-production-provider/v1";
const PROVIDER = "illustration-v1";
const SELECTION_KEYS = [
  "platform", "variant", "title_id", "title", "topic_phrase", "draft_path",
  "draft_sha256", "decision_rule"
];
const PLAN_KEYS = [
  "schema_version", "task_id", "status", "platform", "provider_platform", "variant",
  "source", "selection", "options", "analysis", "style", "brand", "generation_backend",
  "generation_geometry", "image_count", "anchors", "shot_list", "residual_risk"
];
const ANCHOR_KEYS = [
  "image_id", "placement", "source_excerpt", "core_meaning", "structure",
  "visual_metaphor", "main_action", "suggested_elements", "short_labels", "qa_risk"
];
const BUNDLE_KEYS = [
  "schema_version", "task_id", "status", "platform", "provider_platform", "variant",
  "source", "selection", "plan", "shot_list", "style", "brand", "generation_backend",
  "generation_geometry", "image_count", "manifest", "images", "residual_risk"
];
const IMAGE_KEYS = [
  "image_id", "file", "file_sha256", "source_file", "source_sha256", "prompt_path",
  "prompt_sha256", "placement", "core_meaning", "structure", "visual_metaphor",
  "content_qa_status", "style_qa_status", "brand_qa_status", "set_qa_status",
  "brand_overlay_status", "size_check_status", "generation_attempt", "requested_dimensions",
  "source_dimensions", "source_aspect_ratio", "source_artifact", "delivery_dimensions",
  "delivery_artifact", "native_output_preserved", "post_generation_actions",
  "geometry_attempts", "residual_risk"
];
const RESULT_KEYS = [
  "schema_version", "contract", "provider_contract", "task_id", "request_sha256", "status",
  "artifacts", "checks", "issues", "warnings"
];

function sameKeys(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

async function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => done({
      code,
      stdout,
      stderr,
      json: stdout.trim() ? JSON.parse(stdout) : null
    }));
  });
}

async function put(runDir, path, value) {
  const target = join(runDir, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
  return target;
}

async function digest(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function providerPlatform(platform) {
  return platform === "xiaohongshu" ? "xhs" : platform;
}

function names(platform, attempt, mode) {
  const base = `07-visual/${platform}`;
  const suffix = attempt === 1 ? "" : `.v${String(attempt).padStart(3, "0")}`;
  return {
    base,
    request: `${base}/illustration-${mode}${suffix}.request.json`,
    result: `${base}/illustration-${mode}${suffix}.result.json`,
    plan: `${base}/plan${suffix}.json`,
    shot: `${base}/shot-list${suffix}.md`,
    bundle: `${base}/bundle${suffix}.json`,
    manifest: `${base}/manifest${suffix}.md`,
    promptDir: `${base}/prompts${attempt === 1 ? "" : `/v${String(attempt).padStart(3, "0")}`}`,
    imageVersion: attempt === 1 ? "" : `/v${String(attempt).padStart(3, "0")}`
  };
}

function styleData(platform) {
  if (platform === "toutiao") {
    return {
      style: {
        id: "toutiao-luminous-tech",
        platform: "toutiao",
        style_file: "references/styles/toutiao-luminous-tech.md",
        style_spec: "references/styles/toutiao-luminous-tech.spec.json",
        style_reference: "assets/style-references/toutiao-luminous-tech.png"
      },
      brand: {
        enabled: false,
        policy_default_enabled: false,
        override: null,
        policy_source: "style-default",
        disabled_reason: "disabled-by-style-default"
      },
      geometry: {
        geometry_profile: "gpt-image-2-v1",
        resolved_model: "gpt-image-2",
        requested_dimensions: { width: 2048, height: 1152 },
        target_aspect_ratio: "16:9",
        design_dimensions: { width: 1600, height: 900 },
        delivery_dimensions: "source",
        ratio_tolerance: 0.002,
        minimum_short_edge: 900,
        native_output_policy: "preserve",
        post_generation_resize: "forbidden"
      },
      raster: "assets/style-references/toutiao-luminous-tech.png",
      dimensions: { width: 1672, height: 941 }
    };
  }
  return {
    style: {
      id: "wechat-doodle",
      platform: "wechat",
      style_file: "references/styles/wechat-style-doodle.md",
      style_spec: "references/styles/wechat-style-doodle.spec.json",
      style_reference: "assets/style-references/wechat-doodle.png"
    },
    brand: {
      enabled: true,
      policy_default_enabled: true,
      override: null,
      policy_source: "style-default",
      disabled_reason: null
    },
    geometry: {
      geometry_profile: "gpt-image-2-v1",
      resolved_model: "gpt-image-2",
      requested_dimensions: { width: 1600, height: 1200 },
      target_aspect_ratio: "4:3",
      design_dimensions: { width: 1600, height: 1200 },
      delivery_dimensions: "source",
      ratio_tolerance: 0.002,
      minimum_short_edge: null,
      native_output_policy: "preserve",
      post_generation_resize: "forbidden"
    },
    raster: "assets/style-references/wechat-doodle.png",
    dimensions: { width: 1448, height: 1086 }
  };
}

function options(platform) {
  return {
    requested_output: platform === "wechat" ? "body_illustrations"
      : platform === "xiaohongshu" ? "carousel" : "post_illustrations",
    publishing_path: null,
    style_id: null,
    max_images: 2,
    brand_override: null,
    backend_hint: "configured-api",
    model_preference: null,
    execution_strategy: "one_image_at_a_time"
  };
}

async function fixture(t, { platform = "wechat", attempt = 1 } = {}) {
  const runDir = await mkdtemp(join(tmpdir(), "illustration-provider-"));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  const variant = "A";
  const pathSet = names(platform, attempt, "plan");
  const sourcePath = `05-platforms/${platform}/${variant}/final.md`;
  const sourceText = "# 自动化边界\n\n跨系统写入前需要人工确认。先确认系统边界，再决定是否自动执行。\n";
  const sourceFile = await put(runDir, sourcePath, sourceText);
  const selection = {
    platform,
    variant,
    title_id: `${platform}-${variant}-1`,
    title: "先确认边界，再自动执行",
    topic_phrase: platform === "weibo" ? "#自动化边界#" : null,
    draft_path: sourcePath,
    draft_sha256: await digest(sourceFile),
    decision_rule: "promise_status=PASS,risk,recommended,rank,variant=A"
  };
  const selectionPath = "06-selection/selection.v001.json";
  const selectionFile = await put(runDir, selectionPath, `${JSON.stringify({
    schema_version: 1,
    revision: 1,
    status: "PROPOSED",
    titles_path: "06-selection/titles.json",
    titles_sha256: "a".repeat(64),
    decision_rule: selection.decision_rule,
    selections: [selection]
  }, null, 2)}\n`);
  await mkdir(join(runDir, pathSet.base), { recursive: true });
  const runId = "fixture-run";
  const state = {
    schema_version: 2,
    run_id: runId,
    run_mode: "autonomous",
    status: "running",
    current_stage: "visual",
    stages: { visual: { status: "running", attempt, artifacts: [] } },
    gates: {
      titles: {
        status: "approved",
        decision_ref: { path: selectionPath, sha256: await digest(selectionFile) },
        bound_artifacts: []
      },
      visual: { status: "pending", decision_ref: null, bound_artifacts: [] }
    }
  };
  await put(runDir, "run.json", `${JSON.stringify(state, null, 2)}\n`);
  const input = { role: "final_draft", path: sourcePath, sha256: await digest(sourceFile) };
  const titleInput = { role: "title_selection", path: selectionPath, sha256: await digest(selectionFile) };
  const request = {
    schema_version: 1,
    contract: CONTRACT,
    task_id: `illustration:${runId}:${platform}:${variant}:plan:attempt-${String(attempt).padStart(3, "0")}`,
    capability: "illustration",
    provider_contract: PROVIDER,
    run_dir: runDir,
    run_mode: "autonomous",
    mode: "plan",
    attempt,
    platform,
    provider_platform: providerPlatform(platform),
    variant,
    selection,
    inputs: [input, titleInput],
    output_dir: pathSet.base,
    expected_artifacts: [pathSet.plan, pathSet.shot],
    options: options(platform),
    interaction_policy: "return_to_orchestrator"
  };
  const requestPath = await put(runDir, pathSet.request, `${JSON.stringify(request, null, 2)}\n`);
  return { runDir, runId, platform, variant, pathSet, request, requestPath, sourceFile, sourceText, selection, state };
}

async function writePlan(data, mutate) {
  const style = styleData(data.platform);
  const anchor = {
    image_id: "01-boundary",
    placement: "after-introduction",
    source_excerpt: "跨系统写入前需要人工确认。",
    core_meaning: "自动化必须尊重系统边界。",
    structure: "Decision tree",
    visual_metaphor: "一道门在自动执行前检查通行条件。",
    main_action: "流程箭头在门前等待确认。",
    suggested_elements: ["gate", "workflow arrow", "check mark"],
    short_labels: ["边界", "确认", "执行"],
    qa_risk: "模型可能画出多余品牌标记。"
  };
  const shot = `---\nartifact: IllustrationShotList\nstatus: READY\ntask_id: ${data.request.task_id}\n---\n\n# 配图镜头表\n\n## ${anchor.image_id}\n\n- Placement or sequence: ${anchor.placement}\n- One core meaning: ${anchor.core_meaning}\n- Content expression structure: ${anchor.structure}\n- Visual metaphor: ${anchor.visual_metaphor}\n- Main actor/object action: ${anchor.main_action}\n- Suggested elements: ${anchor.suggested_elements.join(", ")}\n- Short labels: ${anchor.short_labels.join(", ")}\n- QA risk: ${anchor.qa_risk}\n`;
  const shotPath = await put(data.runDir, data.pathSet.shot, shot);
  const plan = {
    schema_version: 1,
    task_id: data.request.task_id,
    status: "READY",
    platform: data.platform,
    provider_platform: providerPlatform(data.platform),
    variant: data.variant,
    source: data.request.inputs[0],
    selection: data.selection,
    options: data.request.options,
    analysis: {
      main_line: "文章说明自动化执行前必须先判断系统边界。",
      content_type: "method",
      expression_need: "Decision tree"
    },
    style: style.style,
    brand: style.brand,
    generation_backend: {
      kind: "configured-api",
      adapter: "runtime-configured-adapter",
      endpoint_source: "active-runtime-config",
      resolved_model: "gpt-image-2",
      artifact_format: "png",
      credential_access: "pass",
      model_check: "pass",
      process_cleanup_plan: "verify-request-process-exit",
      process_cleanup_status: "not-run"
    },
    generation_geometry: style.geometry,
    image_count: 1,
    anchors: [anchor],
    shot_list: { path: data.pathSet.shot, sha256: await digest(shotPath) },
    residual_risk: "none"
  };
  if (mutate) await mutate(plan, { anchor, shotPath });
  const planPath = await put(data.runDir, data.pathSet.plan, `${JSON.stringify(plan, null, 2)}\n`);
  return { plan, planPath, shotPath, style };
}

async function generateFixture(t, options = {}) {
  const data = await fixture(t, options);
  const planData = await writePlan(data);
  const pathSet = names(data.platform, data.request.attempt, "generate");
  const planInput = { role: "illustration_plan", path: data.pathSet.plan, sha256: await digest(planData.planPath) };
  const shotInput = { role: "shot_list", path: data.pathSet.shot, sha256: await digest(planData.shotPath) };
  const request = {
    ...data.request,
    task_id: `illustration:${data.runId}:${data.platform}:${data.variant}:generate:attempt-${String(data.request.attempt).padStart(3, "0")}`,
    mode: "generate",
    inputs: [data.request.inputs[0], data.request.inputs[1], planInput, shotInput],
    expected_artifacts: [],
    output_dir: pathSet.base
  };
  const imageId = planData.plan.anchors[0].image_id;
  const prompt = `${pathSet.promptDir}/${imageId}.md`;
  const finalImage = planData.plan.brand.enabled
    ? `${pathSet.base}/images/branded${pathSet.imageVersion}/${imageId}.png`
    : `${pathSet.base}/images${pathSet.imageVersion}/${imageId}.png`;
  const sourceImage = planData.plan.brand.enabled
    ? `${pathSet.base}/images/unbranded${pathSet.imageVersion}/${imageId}.png` : null;
  request.expected_artifacts = [pathSet.bundle, pathSet.manifest, prompt, ...(sourceImage ? [sourceImage] : []), finalImage];
  const requestPath = await put(data.runDir, pathSet.request, `${JSON.stringify(request, null, 2)}\n`);
  const state = JSON.parse(await readFile(join(data.runDir, "run.json"), "utf8"));
  state.gates.visual = {
    status: "approved",
    decision_ref: null,
    bound_artifacts: [
      { path: data.pathSet.plan, sha256: await digest(planData.planPath) },
      { path: data.pathSet.shot, sha256: await digest(planData.shotPath) }
    ]
  };
  await put(data.runDir, "run.json", `${JSON.stringify(state, null, 2)}\n`);
  return { ...data, pathSet, request, requestPath, planData, prompt, finalImage, sourceImage };
}

async function writeBundle(data, mutate) {
  const imageId = data.planData.plan.anchors[0].image_id;
  const promptPath = await put(data.runDir, data.prompt, "Generate one boundary decision diagram. No logo, TF, Tranfu, watermark, badge, or reserve box.\n");
  if (data.sourceImage) {
    await mkdir(dirname(join(data.runDir, data.sourceImage)), { recursive: true });
    await copyFile(join(ROOT, data.planData.style.raster), join(data.runDir, data.sourceImage));
  }
  await mkdir(dirname(join(data.runDir, data.finalImage)), { recursive: true });
  await copyFile(join(ROOT, data.planData.style.raster), join(data.runDir, data.finalImage));
  if (data.sourceImage) await appendFile(join(data.runDir, data.finalImage), "brand-overlay");
  const finalStat = await stat(join(data.runDir, data.finalImage));
  const sourceStat = data.sourceImage ? await stat(join(data.runDir, data.sourceImage)) : finalStat;
  const dims = data.planData.style.dimensions;
  const disabled = data.planData.plan.brand.disabled_reason;
  const manifest = `post_illustration_bundle:\n  platform: ${data.request.provider_platform}\n  style_id: ${data.planData.plan.style.id}\n  images:\n    - image_id: ${imageId}\n      file: ${relative(data.pathSet.base, data.finalImage)}\n`;
  const manifestPath = await put(data.runDir, data.pathSet.manifest, manifest);
  const anchor = data.planData.plan.anchors[0];
  const image = {
    image_id: imageId,
    file: data.finalImage,
    file_sha256: await digest(join(data.runDir, data.finalImage)),
    source_file: data.sourceImage,
    source_sha256: data.sourceImage ? await digest(join(data.runDir, data.sourceImage)) : null,
    prompt_path: data.prompt,
    prompt_sha256: await digest(promptPath),
    placement: anchor.placement,
    core_meaning: anchor.core_meaning,
    structure: anchor.structure,
    visual_metaphor: anchor.visual_metaphor,
    content_qa_status: "pass",
    style_qa_status: "pass",
    brand_qa_status: disabled || "pass",
    set_qa_status: "pass",
    brand_overlay_status: data.sourceImage ? "applied" : disabled,
    size_check_status: "pass-native",
    generation_attempt: 1,
    requested_dimensions: data.planData.plan.generation_geometry.requested_dimensions,
    source_dimensions: dims,
    source_aspect_ratio: dims.width / dims.height,
    source_artifact: { format: "png", bytes: sourceStat.size },
    delivery_dimensions: dims,
    delivery_artifact: { format: "png", bytes: finalStat.size, hard_limit_exporter: null },
    native_output_preserved: true,
    post_generation_actions: data.sourceImage ? ["brand-overlay-native"] : [],
    geometry_attempts: [{
      attempt: 1,
      requested_dimensions: data.planData.plan.generation_geometry.requested_dimensions,
      source_dimensions: dims,
      status: "pass-native"
    }],
    residual_risk: "none"
  };
  const bundle = {
    schema_version: 1,
    task_id: data.request.task_id,
    status: "PASS",
    platform: data.platform,
    provider_platform: data.request.provider_platform,
    variant: data.variant,
    source: data.request.inputs[0],
    selection: data.selection,
    plan: { path: data.request.inputs[2].path, sha256: data.request.inputs[2].sha256 },
    shot_list: { path: data.request.inputs[3].path, sha256: data.request.inputs[3].sha256 },
    style: data.planData.plan.style,
    brand: data.planData.plan.brand,
    generation_backend: { ...data.planData.plan.generation_backend, process_cleanup_status: "pass" },
    generation_geometry: data.planData.plan.generation_geometry,
    image_count: 1,
    manifest: { path: data.pathSet.manifest, sha256: await digest(manifestPath) },
    images: [image],
    residual_risk: "none"
  };
  if (mutate) await mutate(bundle, { image, manifestPath, promptPath });
  const bundlePath = await put(data.runDir, data.pathSet.bundle, `${JSON.stringify(bundle, null, 2)}\n`);
  return { bundle, bundlePath };
}

test("skill advertises the illustration provider without replacing standalone routing", async () => {
  const skill = await readFile(join(ROOT, "SKILL.md"), "utf8");
  assert.match(skill, /content-production-provider: illustration-v1/);
  assert.match(skill, /references\/orchestrated-provider\.md/);
  assert.match(skill, /post-illustration-output\/<content-slug>\//);
});

test("plan validates and finalizes exactly plan plus shot list without touching source", async (t) => {
  const data = await fixture(t);
  const sourceHash = await digest(data.sourceFile);
  const validated = await run(["validate-request", data.requestPath]);
  assert.equal(validated.code, 0, validated.stderr || validated.stdout);
  const { plan } = await writePlan(data);
  sameKeys(plan, PLAN_KEYS);
  sameKeys(plan.selection, SELECTION_KEYS);
  sameKeys(plan.anchors[0], ANCHOR_KEYS);
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 0, finalized.stderr || finalized.stdout);
  assert.equal(finalized.json.status, "PASS");
  sameKeys(finalized.json, RESULT_KEYS);
  assert.deepEqual(finalized.json.artifacts.map((item) => item.role), ["illustration_plan", "shot_list"]);
  assert.equal(await digest(data.sourceFile), sourceHash);
});

test("request validation rejects extra inputs, wrong aliases, stale attempts, and symlink inputs", async (t) => {
  const extra = await fixture(t);
  extra.request.inputs.push({ ...extra.request.inputs[0], role: "extra" });
  await put(extra.runDir, extra.pathSet.request, `${JSON.stringify(extra.request, null, 2)}\n`);
  const extraResult = await run(["validate-request", extra.requestPath]);
  assert.equal(extraResult.code, 2);
  assert.ok(extraResult.json.issues.some((item) => item.code === "invalid_provider_inputs"));

  const alias = await fixture(t, { platform: "xiaohongshu" });
  const validAlias = await run(["validate-request", alias.requestPath]);
  assert.equal(validAlias.code, 0, validAlias.stderr || validAlias.stdout);
  alias.request.provider_platform = "xiaohongshu";
  await put(alias.runDir, alias.pathSet.request, `${JSON.stringify(alias.request, null, 2)}\n`);
  const aliasResult = await run(["validate-request", alias.requestPath]);
  assert.equal(aliasResult.code, 2);
  assert.ok(aliasResult.json.issues.some((item) => item.code === "invalid_provider_target"));

  const stale = await fixture(t, { attempt: 2 });
  stale.request.attempt = 1;
  await put(stale.runDir, stale.pathSet.request, `${JSON.stringify(stale.request, null, 2)}\n`);
  const staleResult = await run(["validate-request", stale.requestPath]);
  assert.equal(staleResult.code, 2);
  assert.ok(staleResult.json.issues.some((item) => item.code === "provider_attempt_mismatch"));

  const linked = await fixture(t);
  const selectionFile = join(linked.runDir, linked.request.inputs[1].path);
  const outside = await put(dirname(linked.runDir), `${linked.runId}-${Date.now()}.json`, await readFile(selectionFile));
  t.after(() => rm(outside, { force: true }));
  await rm(selectionFile);
  await symlink(outside, selectionFile);
  const linkedResult = await run(["validate-request", linked.requestPath]);
  assert.equal(linkedResult.code, 2);
  assert.ok(linkedResult.json.issues.some((item) => item.code === "provider_input_symlink"));
});

test("plan finalization rejects generated images, filler counts, stale shot hashes, and residual risk", async (t) => {
  const data = await fixture(t);
  await writePlan(data, async (plan) => {
    plan.image_count = 3;
    plan.residual_risk = "low";
    plan.shot_list.sha256 = "f".repeat(64);
  });
  await put(data.runDir, `${data.pathSet.base}/images/unbranded/01-boundary.png`, "not allowed in plan mode");
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 2);
  for (const code of ["illustration_count_exceeds_max", "illustration_lineage_drift", "illustration_residual_risk", "plan_contains_generated_assets"]) {
    assert.ok(finalized.json.issues.some((item) => item.code === code), code);
  }
});

test("generate finalizes exact branded prompts, sources, deliveries, native manifest, and bundle", async (t) => {
  const data = await generateFixture(t);
  const sourceHash = await digest(data.sourceFile);
  const validated = await run(["validate-request", data.requestPath]);
  assert.equal(validated.code, 0, validated.stderr || validated.stdout);
  const { bundle } = await writeBundle(data);
  sameKeys(bundle, BUNDLE_KEYS);
  sameKeys(bundle.images[0], IMAGE_KEYS);
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 0, finalized.stderr || finalized.stdout);
  assert.equal(finalized.json.status, "PASS");
  assert.deepEqual(finalized.json.artifacts.map((item) => item.path), data.request.expected_artifacts);
  assert.deepEqual(finalized.json.artifacts.map((item) => item.role), [
    "illustration_bundle", "native_manifest", "prompt", "source_image", "delivery_image"
  ]);
  assert.equal(await digest(data.sourceFile), sourceHash);
});

test("generate accepts brand-disabled versioned output for the current attempt", async (t) => {
  const data = await generateFixture(t, { platform: "toutiao", attempt: 2 });
  assert.match(data.pathSet.bundle, /bundle\.v002\.json$/);
  assert.match(data.prompt, /prompts\/v002\//);
  assert.match(data.finalImage, /images\/v002\//);
  assert.equal(data.sourceImage, null);
  await writeBundle(data);
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 0, finalized.stderr || finalized.stdout);
  assert.equal(finalized.json.status, "PASS");
  assert.ok(!finalized.json.artifacts.some((item) => item.role === "source_image"));
});

test("generate rejects ID, hash, geometry, QA, retry, and residual-risk drift", async (t) => {
  const data = await generateFixture(t);
  const written = await writeBundle(data, async (bundle) => {
    const image = bundle.images[0];
    image.image_id = "02-extra";
    image.file_sha256 = "a".repeat(64);
    image.source_dimensions = { width: 1000, height: 1000 };
    image.content_qa_status = "fail";
    image.generation_attempt = 4;
    image.residual_risk = "medium";
  });
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 2);
  for (const code of [
    "illustration_image_ids_mismatch", "provider_artifact_drift", "illustration_geometry_mismatch",
    "illustration_qa_failed", "illustration_attempt_limit", "illustration_residual_risk"
  ]) assert.ok(finalized.json.issues.some((item) => item.code === code), code);
  assert.equal((await lstat(written.bundlePath)).isFile(), true);
});

test("generate rejects a symlinked business artifact before delivery", async (t) => {
  const data = await generateFixture(t);
  await writeBundle(data);
  const external = await put(dirname(data.runDir), `${data.runId}-${Date.now()}.md`, "unsafe prompt");
  t.after(() => rm(external, { force: true }));
  await rm(join(data.runDir, data.prompt));
  await symlink(external, join(data.runDir, data.prompt));
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 2);
  assert.ok(finalized.json.issues.some((item) =>
    ["provider_output_escape", "provider_artifact_symlink"].includes(item.code)));
});

test("generate rejects an undeclared current-attempt prompt or image", async (t) => {
  const data = await generateFixture(t);
  await writeBundle(data);
  await put(data.runDir, `${data.pathSet.promptDir}/99-extra.md`, "undeclared prompt\n");
  const finalized = await run(["finalize", data.requestPath]);
  assert.equal(finalized.code, 2);
  assert.ok(finalized.json.issues.some((item) => item.code === "unexpected_illustration_artifact"));
});

test("block writes the canonical mode result and no business artifacts", async (t) => {
  const data = await fixture(t);
  const blocked = await run(["block", data.requestPath, "图像后端模型通道不可用。"]);
  assert.equal(blocked.code, 2);
  assert.equal(blocked.json.status, "BLOCKED");
  assert.deepEqual(blocked.json.artifacts, []);
  assert.equal(blocked.json.issues[0].code, "illustration_provider_blocked");
  assert.equal((await lstat(join(data.runDir, data.pathSet.result))).isFile(), true);
});
