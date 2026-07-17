import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { renderStyleIndex } from "../scripts/generate-style-index.mjs";
import { installStyleBundle } from "../scripts/install-style-bundle.mjs";
import { validateInstalledRegistry, validateStyleBundle } from "../scripts/validate-style-bundle.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dimensions = [
  "color",
  "typography",
  "texture",
  "illustration",
  "spacing",
  "composition",
  "cross_content_adaptability"
];
const gates = {
  dimensions: true,
  aspect_ratio: true,
  safe_area: true,
  single_core_meaning: true,
  identity_leakage: true,
  brand_free: true
};
const platformFixtures = Object.freeze({
  xhs: Object.freeze({
    specPlatform: "xiaohongshu",
    canvas: Object.freeze({ width: 1080, height: 1440, ratio: "3:4", orientation: "vertical" }),
    contentSafeArea: Object.freeze({ x: 80, y: 96, width: 920, height: 1248 }),
    brandReservedArea: Object.freeze({ x: 842, y: 44, width: 208, height: 90 }),
    brandSlot: Object.freeze({ x: 872, y: 64, width: 148, height: 40 })
  }),
  weibo: Object.freeze({
    specPlatform: "weibo",
    canvas: Object.freeze({ width: 1080, height: 1440, ratio: "3:4", orientation: "vertical" }),
    contentSafeArea: Object.freeze({ x: 80, y: 96, width: 920, height: 1248 }),
    brandReservedArea: Object.freeze({ x: 842, y: 44, width: 208, height: 90 }),
    brandSlot: Object.freeze({ x: 872, y: 64, width: 148, height: 40 })
  }),
  toutiao: Object.freeze({
    specPlatform: "toutiao",
    canvas: Object.freeze({ width: 1600, height: 900, ratio: "16:9", orientation: "horizontal" }),
    outputCanvas: Object.freeze({ width: 1672, height: 941 }),
    contentSafeArea: Object.freeze({ x: 80, y: 70, width: 1440, height: 760 }),
    brandReservedArea: Object.freeze({ x: 1320, y: 44, width: 240, height: 100 }),
    brandSlot: Object.freeze({ x: 1350, y: 64, width: 170, height: 46 }),
    inputHandling: Object.freeze({
      preserveNativeOutput: true,
      ratioTolerance: 0.002,
      outputCanvasRole: "design-coordinate-system",
      allowPostGenerationResize: false,
      minShortEdge: 900,
      allowCrop: false,
      allowPadding: false,
      allowRotation: false,
      allowWrongRatioStretch: false,
      wrongRatioAction: "regenerate"
    })
  })
});

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function mutateJson(path, mutate) {
  const value = json(path);
  mutate(value);
  writeJson(path, value);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return output;
}

function pngHeader(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  return ihdr;
}

function encodePng(width, height, raw) {
  const ihdr = pngHeader(width, height);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function png(width, height) {
  return encodePng(width, height, Buffer.alloc((width + 1) * height));
}

function createSkillRoot(t) {
  const root = mkdtempSync(resolve(tmpdir(), "post-style-skill-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(resolve(repositoryRoot, "references"), resolve(root, "references"), { recursive: true });
  cpSync(resolve(repositoryRoot, "assets"), resolve(root, "assets"), { recursive: true });
  return root;
}

function removeWeiboRegistration(skillRoot) {
  const registryPath = resolve(skillRoot, "references/style-registry.json");
  mutateJson(registryPath, (registry) => {
    registry.platforms = registry.platforms.filter((platform) => platform.id !== "weibo");
    registry.styles = registry.styles.filter((style) => style.platform !== "weibo");
  });
  writeFileSync(
    resolve(skillRoot, "references/style-index.md"),
    renderStyleIndex(json(registryPath))
  );
}

function createBundle(t, id = "xhs-test-template", { platform = "xhs", makeDefault, outputCanvas } = {}) {
  const fixture = platformFixtures[platform];
  const generatedCanvas = outputCanvas ?? fixture.outputCanvas ?? fixture.canvas;
  const root = mkdtempSync(resolve(tmpdir(), "post-style-bundle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, "prompts"), { recursive: true });
  mkdirSync(resolve(root, "calibration"), { recursive: true });

  writeJson(resolve(root, "candidate.json"), {
    schemaVersion: 1,
    status: "approved",
    template_ready: true,
    style: {
      id,
      displayName: "Test template",
      platform,
      defaultUse: "Neutral explanatory knowledge cards.",
      aliases: [`${id} alias`],
      ...(makeDefault === undefined ? {} : { makeDefault }),
      brandPolicy: {
        defaultEnabled: true,
        userOverrideAllowed: true
      }
    },
    files: {
      styleMarkdown: "style.md",
      styleSpec: "style.spec.json",
      provenance: "provenance.json",
      styleReference: "calibration/style-reference.png",
      qa: "qa.json"
    },
    humanApproval: {
      status: "approved",
      approvedAt: "2026-07-16T08:00:00.000Z",
      note: null
    }
  });
  writeFileSync(resolve(root, "visual-dna.md"), "# Visual DNA\n");
  writeJson(resolve(root, "visual-dna.json"), {
    schema_version: 1,
    visual_dna_system: { mood: "clear" },
    design_signal: {
      observable: {
        color_roles: true,
        typography_hierarchy: true,
        composition: true,
        shape_components: true,
        material_texture: true,
        illustration_icon_language: false
      },
      identity_dominates: false,
      observable_count: 5,
      evidence_complete: true,
      missing_evidence: [],
      decision: "pass",
      reason: null
    }
  });
  writeFileSync(resolve(root, "style.md"), "# Test template\n");
  writeJson(resolve(root, "style.spec.json"), {
    id,
    styleFile: `references/styles/${id}.md`,
    platform: fixture.specPlatform,
    canvas: fixture.canvas,
    layout: {
      contentSafeArea: fixture.contentSafeArea,
      brandReservedArea: fixture.brandReservedArea
    },
    fixedComponents: {
      brandSlot: { enabled: true, anchor: "top-right", ...fixture.brandSlot, assetFit: "contain" }
    },
    brandPolicy: { defaultEnabled: true, userOverrideAllowed: true },
    inputHandling: fixture.inputHandling ?? {
      preserveNativeOutput: true,
      ratioTolerance: 0.002,
      outputCanvasRole: "design-coordinate-system",
      allowPostGenerationResize: false,
      allowCrop: false,
      allowPadding: false,
      allowRotation: false,
      allowWrongRatioStretch: false,
      wrongRatioAction: "regenerate"
    },
    generationConstraints: { forbidModelDrawnBrand: true, keepBrandReservedAreaClear: true },
    styleReference: {
      image: `assets/style-references/${id}.png`,
      usage: "QA only; never use for generation.",
      contentPolicy: "Ignore semantic content and compare only visual language.",
      isGenerationInput: false
    }
  });
  writeJson(resolve(root, "provenance.json"), {
    schema_version: 1,
    extraction_mode: "visual-dna",
    source: { kind: "provided-visual-dna" },
    confidence: 0.9,
    original_retained: false,
    used_as_generation_reference: false
  });

  const scores = Object.fromEntries(dimensions.map((dimension) => [dimension, 90]));
  const imageBytes = png(generatedCanvas.width, generatedCanvas.height);
  const images = ["concept", "process", "checklist"].map((imageId) => {
    writeFileSync(resolve(root, `prompts/${imageId}.md`), `# ${imageId}\n`);
    writeFileSync(resolve(root, `calibration/${imageId}.png`), imageBytes);
    return {
      id: imageId,
      file: `calibration/${imageId}.png`,
      prompt_file: `prompts/${imageId}.md`,
      total_score: 90,
      scores,
      hard_gates: gates,
      generation: { backend: "test", model: "test-model", width: generatedCanvas.width, height: generatedCanvas.height }
    };
  });
  writeFileSync(resolve(root, "calibration/style-reference.png"), imageBytes);
  writeFileSync(resolve(root, "calibration/contact-sheet.png"), imageBytes);
  writeJson(resolve(root, "qa.json"), {
    schemaVersion: 1,
    reviews: {
      style: {
        reviewer: "style-review-subagent",
        run_id: "style-run-1",
        backend: "codex",
        model: "test-review-model",
        reviewed_at: "2026-07-16T08:00:00.000Z",
        input_scope: "style-contract-and-all-calibration-images",
        source_visible: false,
        originality_review_visible: false,
        conclusion: "pass"
      },
      originality: {
        reviewer: "originality-review-subagent",
        run_id: "originality-run-1",
        backend: "codex",
        model: "test-review-model",
        reviewed_at: "2026-07-16T08:01:00.000Z",
        input_scope: "visual-dna-and-all-calibration-images",
        source_mode: "visual-dna",
        source_pixels_visible: false,
        style_scores_visible: false,
        limitation: "source-pixels-unavailable",
        conclusion: "pass"
      }
    },
    hard_gates: gates,
    calibration_images: images,
    average_score: 90,
    dimension_averages: scores,
    selected_reference: {
      image_id: "concept",
      source_image: "calibration/concept.png",
      path: "calibration/style-reference.png",
      unbranded: true
    },
    contact_sheet: "calibration/contact-sheet.png"
  });
  return root;
}

test("existing registry covers all valid production styles and renders deterministically", () => {
  const result = validateInstalledRegistry({ skillRoot: repositoryRoot });
  assert.equal(result.styles, 7);
  const registry = json(resolve(repositoryRoot, "references/style-registry.json"));
  assert.deepEqual(registry.styles.map((style) => style.id), [
    "wechat-doodle",
    "xhs-explainer-notebook",
    "xhs-cream-paper",
    "xhs-orange-card",
    "zhihu-tech",
    "weibo-signal-core",
    "toutiao-luminous-tech"
  ]);
  assert.deepEqual(registry.platforms.map((platform) => platform.id), ["wechat", "xhs", "zhihu", "weibo", "toutiao"]);
  assert.equal(registry.platforms.find((platform) => platform.id === "weibo").defaultStyleId, "weibo-signal-core");
  assert.equal(registry.platforms.find((platform) => platform.id === "toutiao").defaultStyleId, "toutiao-luminous-tech");
  assert.equal(renderStyleIndex(registry), renderStyleIndex(structuredClone(registry)));
});

test("valid approved bundle passes", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  const result = validateStyleBundle({ bundleDir, skillRoot });
  assert.equal(result.candidate.style.id, "xhs-test-template");
});

test("valid XHS bundle preserves native 1086x1448 calibration output", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "xhs-native-template", {
    outputCanvas: { width: 1086, height: 1448 }
  });
  const result = validateStyleBundle({ bundleDir, skillRoot });
  assert.equal(result.spec.inputHandling.preserveNativeOutput, true);
});

test("calibration generation metadata must match the native PNG", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "xhs-native-template", {
    outputCanvas: { width: 1086, height: 1448 }
  });
  mutateJson(resolve(bundleDir, "qa.json"), (qa) => { qa.calibration_images[0].generation.width = 1080; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /generation dimensions must match the actual PNG/);
});

test("valid approved Weibo bundle passes before Weibo is registered", (t) => {
  const skillRoot = createSkillRoot(t);
  removeWeiboRegistration(skillRoot);
  const bundleDir = createBundle(t, "weibo-test-template", { platform: "weibo" });
  const result = validateStyleBundle({ bundleDir, skillRoot });
  assert.equal(result.candidate.style.platform, "weibo");
  assert.equal(result.spec.platform, "weibo");
  assert.equal(json(resolve(skillRoot, "references/style-registry.json")).platforms.some((platform) => platform.id === "weibo"), false);
});

test("valid approved Toutiao bundle preserves native 1672x941 output", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "toutiao-test-template", { platform: "toutiao" });
  const result = validateStyleBundle({ bundleDir, skillRoot });
  assert.equal(result.candidate.style.platform, "toutiao");
  assert.equal(result.spec.inputHandling.preserveNativeOutput, true);
});

test("Toutiao bundle rejects output below the 900px short-edge floor", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "toutiao-test-template", {
    platform: "toutiao",
    outputCanvas: { width: 1598, height: 899 }
  });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /short edge/i);
});

test("Toutiao bundle rejects output outside the 16:9 tolerance", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "toutiao-test-template", {
    platform: "toutiao",
    outputCanvas: { width: 1672, height: 900 }
  });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /aspect ratio/i);
});

test("candidate makeDefault must be boolean when present", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "candidate.json"), (candidate) => { candidate.style.makeDefault = "yes"; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /style\.makeDefault must be boolean/);
});

test("a registered Weibo platform must match its baseline", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(skillRoot, "references/style-registry.json"), (registry) => {
    registry.platforms.find((platform) => platform.id === "weibo").canvas = {
      width: 1600,
      height: 1200,
      ratio: "4:3",
      orientation: "horizontal"
    };
  });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /weibo baseline canvas is invalid/);
});

test("incomplete Visual DNA evidence cannot be installed", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "visual-dna.json"), (dna) => {
    dna.design_signal.evidence_complete = false;
    dna.design_signal.missing_evidence = ["identity_analysis"];
  });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /evidence must be complete/);
});

test("missing independent review evidence cannot be installed", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "qa.json"), (qa) => { delete qa.reviews; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /reviews are required/);
});

test("duplicate style ID is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "xhs-cream-paper");
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /Style ID already exists/);
});

test("invalid platform ratio is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "style.spec.json"), (spec) => { spec.canvas.ratio = "4:3"; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /canvas\.ratio must be 3:4/);
});

test("missing required bundle file is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  rmSync(resolve(bundleDir, "prompts/checklist.md"));
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /calibration prompt checklist is missing/);
});

test("missing calibration contact sheet is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  rmSync(resolve(bundleDir, "calibration/contact-sheet.png"));
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /calibration contact sheet is missing/);
});

test("incompatible input handling is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "style.spec.json"), (spec) => { spec.inputHandling.allowCrop = true; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /inputHandling\.allowCrop must be false/);
});

test("out-of-bounds content safe area is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "style.spec.json"), (spec) => { spec.layout.contentSafeArea.width = 1200; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /contentSafeArea exceeds canvas width/);
});

test("in-bounds geometry that differs from the platform baseline is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "style.spec.json"), (spec) => { spec.layout.contentSafeArea.x = 81; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /contentSafeArea must match the platform baseline/);
});

test("brand slot outside its reserved area is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "style.spec.json"), (spec) => { spec.fixedComponents.brandSlot.x = 800; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /brandSlot starts outside brandReservedArea/);
});

test("invalid selected reference PNG is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  writeFileSync(resolve(bundleDir, "calibration/style-reference.png"), "not png");
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /too short to be a PNG/);
});

test("a PNG header stub is rejected as undecodable", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  const stub = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(stub, 0);
  stub.writeUInt32BE(13, 8);
  stub.write("IHDR", 12, "ascii");
  stub.writeUInt32BE(1080, 16);
  stub.writeUInt32BE(1440, 20);
  writeFileSync(resolve(bundleDir, "calibration/style-reference.png"), stub);
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /PNG chunk|IDAT/);
});

test("a PNG with too little inflated pixel data is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  writeFileSync(resolve(bundleDir, "calibration/style-reference.png"), encodePng(1080, 1440, Buffer.from([0])));
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /inflates to 1 bytes|IDAT cannot be inflated/);
});

test("duplicate PNG IHDR chunks are rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  const malformed = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", pngHeader(1080, 1440)),
    pngChunk("IHDR", pngHeader(1080, 1440)),
    pngChunk("IDAT", deflateSync(Buffer.alloc((1080 + 1) * 1440))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  writeFileSync(resolve(bundleDir, "calibration/style-reference.png"), malformed);
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /exactly one IHDR/);
});

test("PNG dimensions above the validation cap are rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  const malformed = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", pngHeader(1, 0xffffffff)),
    pngChunk("IDAT", deflateSync(Buffer.from([0]))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  writeFileSync(resolve(bundleDir, "calibration/style-reference.png"), malformed);
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /dimensions exceed the validation limit/);
});

test("selected reference must be the highest-scoring calibration image", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "qa.json"), (qa) => {
    qa.calibration_images[1].total_score = 95;
    qa.calibration_images[1].scores = Object.fromEntries(dimensions.map((dimension) => [dimension, 95]));
    qa.average_score = 275 / 3;
    qa.dimension_averages = Object.fromEntries(dimensions.map((dimension) => [dimension, 275 / 3]));
  });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /must select highest-scoring image process/);
});

test("image totals cannot exceed their dimension mean", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "qa.json"), (qa) => { qa.calibration_images[0].total_score = 95; });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /total_score must not exceed its dimension mean/);
});

test("generated style index drift is rejected", (t) => {
  const skillRoot = createSkillRoot(t);
  writeFileSync(resolve(skillRoot, "references/style-index.md"), "# stale\n");
  assert.throws(() => validateInstalledRegistry({ skillRoot }), /does not match style-registry/);
});

test("registry index path cannot collide with a candidate artifact", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(skillRoot, "references/style-registry.json"), (registry) => {
    registry.indexFile = "references/styles/xhs-test-template.md";
  });
  assert.throws(() => validateStyleBundle({ bundleDir, skillRoot }), /indexFile collides with a destination/);
});

test("installer rejects an unapproved candidate without changing the registry", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mutateJson(resolve(bundleDir, "candidate.json"), (candidate) => {
    candidate.status = "ready_for_review";
    candidate.humanApproval.status = "pending";
    candidate.humanApproval.approvedAt = null;
  });
  const before = readFileSync(resolve(skillRoot, "references/style-registry.json"));
  assert.throws(() => installStyleBundle({ bundleDir, skillRoot }), /status must be approved/);
  assert.ok(readFileSync(resolve(skillRoot, "references/style-registry.json")).equals(before));
});

test("installer refuses a concurrent install lock without changing the registry", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  mkdirSync(resolve(skillRoot, ".style-install.lock"));
  const registryPath = resolve(skillRoot, "references/style-registry.json");
  const before = readFileSync(registryPath);
  assert.throws(() => installStyleBundle({ bundleDir, skillRoot }), /Another style installation is in progress/);
  assert.ok(readFileSync(registryPath).equals(before));
  assert.equal(json(resolve(bundleDir, "candidate.json")).status, "approved");
});

test("installer installs without overwrite and regenerates the index", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  const result = installStyleBundle({ bundleDir, skillRoot });
  assert.equal(result.styleId, "xhs-test-template");
  assert.ok(existsSync(resolve(skillRoot, "references/styles/xhs-test-template.md")));
  assert.ok(existsSync(resolve(skillRoot, "references/styles/xhs-test-template.spec.json")));
  assert.ok(existsSync(resolve(skillRoot, "references/styles/xhs-test-template.provenance.json")));
  assert.ok(existsSync(resolve(skillRoot, "assets/style-references/xhs-test-template.png")));
  const installed = json(resolve(skillRoot, "references/style-registry.json")).styles.at(-1);
  assert.equal(installed.provenanceFile, "references/styles/xhs-test-template.provenance.json");
  assert.equal(json(resolve(skillRoot, "references/style-registry.json")).platforms.find((platform) => platform.id === "xhs").defaultStyleId, "xhs-explainer-notebook");
  assert.match(readFileSync(resolve(skillRoot, "references/style-index.md"), "utf8"), /xhs-test-template/);
  assert.equal(json(resolve(bundleDir, "candidate.json")).status, "installed");
  assert.throws(() => installStyleBundle({ bundleDir, skillRoot }), /status must be approved/);
});

test("first Weibo install atomically registers the platform and new default", (t) => {
  const skillRoot = createSkillRoot(t);
  removeWeiboRegistration(skillRoot);
  const bundleDir = createBundle(t, "weibo-test-template", { platform: "weibo" });
  const result = installStyleBundle({ bundleDir, skillRoot });
  const registry = json(resolve(skillRoot, "references/style-registry.json"));
  const platform = registry.platforms.find((entry) => entry.id === "weibo");

  assert.equal(result.defaultStyleId, "weibo-test-template");
  assert.deepEqual(platform, {
    id: "weibo",
    specPlatform: "weibo",
    displayName: "Weibo",
    defaultStyleId: "weibo-test-template",
    canvas: { width: 1080, height: 1440, ratio: "3:4", orientation: "vertical" },
    routingPhrases: ["微博", "微博配图", "微博竖版配图", "微博竖版信息图"]
  });
  assert.equal(validateInstalledRegistry({ skillRoot }).styles, 7);
  assert.match(readFileSync(resolve(skillRoot, "references/style-index.md"), "utf8"), /Use Weibo when the user says:/);
});

test("first Toutiao install registers a flexible 16:9 platform default", (t) => {
  const skillRoot = createSkillRoot(t);
  const registryPath = resolve(skillRoot, "references/style-registry.json");
  mutateJson(registryPath, (registry) => {
    registry.platforms = registry.platforms.filter((platform) => platform.id !== "toutiao");
    registry.styles = registry.styles.filter((style) => style.platform !== "toutiao");
  });
  writeFileSync(
    resolve(skillRoot, "references/style-index.md"),
    renderStyleIndex(json(registryPath))
  );
  const bundleDir = createBundle(t, "toutiao-test-template", { platform: "toutiao" });
  const result = installStyleBundle({ bundleDir, skillRoot });
  const platform = json(resolve(skillRoot, "references/style-registry.json")).platforms.find((entry) => entry.id === "toutiao");

  assert.equal(result.defaultStyleId, "toutiao-test-template");
  assert.deepEqual(platform, {
    id: "toutiao",
    specPlatform: "toutiao",
    displayName: "Toutiao",
    defaultStyleId: "toutiao-test-template",
    canvas: {
      width: 1600,
      height: 900,
      ratio: "16:9",
      orientation: "horizontal",
      sizing: "flexible",
      minShortEdge: 900
    },
    routingPhrases: ["头条号", "今日头条", "头条配图", "头条号配图"]
  });
  assert.equal(validateInstalledRegistry({ skillRoot }).styles, 7);
});

test("makeDefault true replaces an existing platform default", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t, "xhs-new-default", { makeDefault: true });
  const result = installStyleBundle({ bundleDir, skillRoot });
  const platform = json(resolve(skillRoot, "references/style-registry.json")).platforms.find((entry) => entry.id === "xhs");

  assert.equal(result.defaultStyleId, "xhs-new-default");
  assert.equal(platform.defaultStyleId, "xhs-new-default");
  validateInstalledRegistry({ skillRoot });
});

test("installer rolls back files and registry when index generation fails", (t) => {
  const skillRoot = createSkillRoot(t);
  const bundleDir = createBundle(t);
  const registryPath = resolve(skillRoot, "references/style-registry.json");
  mutateJson(registryPath, (registry) => { registry.indexFile = "blocked/style-index.md"; });
  writeFileSync(resolve(skillRoot, "blocked"), "not a directory");
  const registryBefore = readFileSync(registryPath);
  assert.throws(() => installStyleBundle({ bundleDir, skillRoot }), /Style installation failed/);
  assert.ok(readFileSync(registryPath).equals(registryBefore));
  assert.equal(json(resolve(bundleDir, "candidate.json")).status, "approved");
  assert.equal(existsSync(resolve(skillRoot, "references/styles/xhs-test-template.md")), false);
  assert.equal(existsSync(resolve(skillRoot, "references/styles/xhs-test-template.spec.json")), false);
  assert.equal(existsSync(resolve(skillRoot, "references/styles/xhs-test-template.provenance.json")), false);
  assert.equal(existsSync(resolve(skillRoot, "assets/style-references/xhs-test-template.png")), false);
});

test("failed first Weibo install rolls back the platform registration", (t) => {
  const skillRoot = createSkillRoot(t);
  removeWeiboRegistration(skillRoot);
  const bundleDir = createBundle(t, "weibo-test-template", { platform: "weibo" });
  const registryPath = resolve(skillRoot, "references/style-registry.json");
  mutateJson(registryPath, (registry) => { registry.indexFile = "blocked/style-index.md"; });
  writeFileSync(resolve(skillRoot, "blocked"), "not a directory");
  const registryBefore = readFileSync(registryPath);

  assert.throws(() => installStyleBundle({ bundleDir, skillRoot }), /Style installation failed/);
  assert.ok(readFileSync(registryPath).equals(registryBefore));
  assert.equal(json(registryPath).platforms.some((platform) => platform.id === "weibo"), false);
  assert.equal(json(resolve(bundleDir, "candidate.json")).status, "approved");
  assert.equal(existsSync(resolve(skillRoot, "references/styles/weibo-test-template.md")), false);
});
