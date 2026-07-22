import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const skillDir = resolve(import.meta.dirname, '..');
const scriptsDir = join(skillDir, 'scripts');
const providerRoot = resolve(skillDir, 'skills', 'post-illustration-images');
const providerSkill = join(providerRoot, 'SKILL.md');
const providerScript = join(providerRoot, 'scripts', 'provider-contract.mjs');
const childProviderScript = join(providerRoot, 'scripts', 'child-contract.mjs');
const setQaProviderScript = join(providerRoot, 'scripts', 'set-qa-contract.mjs');
const coverSkill = resolve(skillDir, 'skills', 'wechat-sketch-cover', 'SKILL.md');
const coverRoot = dirname(coverSkill);
const coverProviderScript = join(coverRoot, 'scripts', 'provider-contract.mjs');
const platforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
const imageCounts = { wechat: 2, xiaohongshu: 4, zhihu: 1, weibo: 2, toutiao: 1 };

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function run(script, args = []) {
  return spawnSync(process.execPath, [join(scriptsDir, script), ...args], {
    cwd: skillDir,
    encoding: 'utf8'
  });
}

function runProvider(args = []) {
  return spawnSync(process.execPath, [providerScript, ...args], {
    cwd: providerRoot,
    encoding: 'utf8'
  });
}

function runChildProvider(args = []) {
  return spawnSync(process.execPath, [childProviderScript, ...args], {
    cwd: providerRoot,
    encoding: 'utf8'
  });
}

function runSetQaProvider(args = []) {
  return spawnSync(process.execPath, [setQaProviderScript, ...args], {
    cwd: providerRoot,
    encoding: 'utf8'
  });
}

function runCoverProvider(args = []) {
  return spawnSync(process.execPath, [coverProviderScript, ...args], {
    cwd: coverRoot,
    encoding: 'utf8'
  });
}

function dimensions(path) {
  const value = readFileSync(path);
  return { width: value.readUInt32BE(16), height: value.readUInt32BE(20) };
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
  const name = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return output;
}

function pngImage(width, height, shade = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const stride = width + 1;
  const pixels = Buffer.alloc(stride * height);
  if (shade) {
    for (let row = 0; row < height; row += 1) pixels.fill(shade, row * stride + 1, (row + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(pixels, { level: 1 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngHeaderStub(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function completeChild(runDir, requestPath, {
  width = null,
  height = null,
  expectedStatus = 0,
  candidateBytes = null,
  deliveryBytes = null
} = {}) {
  const request = readJson(requestPath);
  const labels = request.anchor.text_mode === 'icons_only'
    ? 'Use icons-only with no readable text.'
    : `Use only the readable label “${request.anchor.short_labels[0]}”.`;
  const ratio = request.generation_geometry.target_aspect_ratio === '3:4'
    ? 'Aspect ratio 0.75. Exclude 2:3 and 1024x1536.'
    : `Aspect ratio ${request.generation_geometry.target_aspect_ratio}.`;
  write(join(runDir, request.artifacts.prompt), `Create one clear explainer. ${labels} ${ratio}`);
  assert.equal(runChildProvider(['preflight', requestPath]).status, 0);
  const design = request.generation_geometry.design_dimensions;
  const size = { width: width ?? design.width, height: height ?? design.height };
  mkdirSync(dirname(join(runDir, request.artifacts.candidate)), { recursive: true });
  mkdirSync(dirname(join(runDir, request.artifacts.delivery)), { recursive: true });
  writeFileSync(join(runDir, request.artifacts.candidate), candidateBytes || pngImage(size.width, size.height));
  if (request.artifacts.delivery !== request.artifacts.candidate) {
    writeFileSync(join(runDir, request.artifacts.delivery), deliveryBytes || pngImage(size.width, size.height, 1));
  }
  write(join(runDir, request.artifacts.qa), JSON.stringify({
    schema_version: 1,
    status: 'PASS',
    content_qa_status: 'pass',
    style_qa_status: 'pass',
    brand_qa_status: request.brand.enabled ? 'pass' : request.brand.disabled_reason,
    failed_gates: [],
    readable_text: request.anchor.text_mode === 'icons_only' ? [] : [request.anchor.short_labels[0]],
    residual_risk: 'none',
    reviewer: 'fixture-reviewer',
    reviewed_at: '2026-07-20T00:00:00.000Z'
  }, null, 2));
  const finalized = runChildProvider(['finalize', requestPath]);
  assert.equal(finalized.status, expectedStatus, finalized.stderr || finalized.stdout);
}

function completeSetQa(runDir, requestPath, { failedImageIds = [] } = {}) {
  const request = readJson(requestPath);
  const status = failedImageIds.length ? 'FAILED' : 'PASS';
  const checks = Object.fromEntries([
    'style_consistency', 'color', 'visual_density', 'composition_duplication', 'narrative_order'
  ].map((key) => [key, status === 'PASS' ? 'PASS' : 'BLOCKED']));
  write(join(runDir, request.review_path), JSON.stringify({
    schema_version: 1,
    status,
    checks,
    failed_image_ids: failedImageIds,
    reasons: failedImageIds.map((imageId) => ({ image_id: imageId, reason: '与整套叙事顺序不一致。' })),
    blocking_reason: null,
    reviewer: 'fixture-set-reviewer',
    reviewed_at: '2026-07-20T00:00:02.000Z'
  }, null, 2));
  const finalized = runSetQaProvider(['finalize', requestPath]);
  assert.equal(finalized.status, status === 'PASS' ? 0 : 2, finalized.stderr || finalized.stdout);
}

function styleData(platform) {
  const values = {
    wechat: ['wechat-doodle', 'wechat', 'wechat-style-doodle', 'wechat-doodle', '4:3', 1600, 1200, 1600, 1200, null, true],
    xiaohongshu: ['xhs-explainer-notebook', 'xhs', 'xhs-style-explainer-notebook', 'xhs-explainer-notebook', '3:4', 1152, 1536, 1086, 1448, null, true],
    zhihu: ['zhihu-tech', 'zhihu', 'zhihu-style-title', 'zhihu-tech', '16:9', 2048, 1152, 1600, 900, null, true],
    weibo: ['weibo-signal-core', 'weibo', 'weibo-signal-core', 'weibo-signal-core', '3:4', 1152, 1536, 1080, 1440, null, true],
    toutiao: ['toutiao-luminous-tech', 'toutiao', 'toutiao-luminous-tech', 'toutiao-luminous-tech', '16:9', 2048, 1152, 1600, 900, 900, false]
  }[platform];
  const [id, providerPlatform, fileStem, referenceStem, ratio, requestWidth, requestHeight,
    designWidth, designHeight, minimumShortEdge, brandEnabled] = values;
  return {
    style: {
      id,
      platform: providerPlatform,
      style_file: `references/styles/${fileStem}.md`,
      style_spec: `references/styles/${fileStem}.spec.json`,
      style_reference: `assets/style-references/${referenceStem}.png`
    },
    brand: {
      enabled: brandEnabled,
      policy_default_enabled: brandEnabled,
      override: null,
      policy_source: 'style-default',
      disabled_reason: brandEnabled ? null : 'disabled-by-style-default'
    },
    geometry: {
      geometry_profile: 'gpt-image-2-v1',
      resolved_model: 'gpt-image-2',
      requested_dimensions: { width: requestWidth, height: requestHeight },
      target_aspect_ratio: ratio,
      design_dimensions: { width: designWidth, height: designHeight },
      delivery_dimensions: 'source',
      ratio_tolerance: 0.002,
      minimum_short_edge: minimumShortEdge,
      native_output_policy: 'preserve',
      post_generation_resize: 'forbidden'
    },
    raster: join(providerRoot, 'assets', 'style-references', `${referenceStem}.png`)
  };
}

function anchor(index, { bounded = false } = {}) {
  const excerpts = [
    '跨系统写入前需要人工确认。',
    '自动化必须先确认系统边界。',
    '完成检查后再进入执行。'
  ];
  const number = String(index + 1).padStart(2, '0');
  const suffix = ['boundary', 'flow', 'checklist'][index] || `detail-${number}`;
  const sourceExcerpt = excerpts[index] || `第 ${index + 1} 个独立配图锚点。`;
  const coreMeaning = ['自动化必须尊重系统边界。', '确认先于自动执行。', '检查通过后才能继续。'][index]
    || `第 ${index + 1} 个独立核心含义。`;
  return {
    image_id: `${number}-${suffix}`,
    placement: index === 0 ? 'after-introduction' : `after-section-${index + 1}`,
    source_excerpt: sourceExcerpt,
    core_meaning: coreMeaning,
    structure: ['Decision tree', 'Process flow', 'Checklist'][index] || 'Concept explanation',
    visual_metaphor: ['一道门检查通行条件。', '流程箭头在确认节点等待。', '检查清单控制执行开关。'][index] || `第 ${index + 1} 个视觉隐喻。`,
    main_action: ['流程在门前等待确认。', '箭头通过确认节点。', '逐项勾选后开启执行。'][index] || `主体执行第 ${index + 1} 个动作。`,
    suggested_elements: ['gate', 'workflow arrow', 'check mark'],
    short_labels: bounded && (index === 1 || index === 2) ? [] : ['边界', '确认', '执行'],
    qa_risk: '模型可能画出多余品牌标记。',
    ...(bounded ? { text_mode: index === 1 || index === 2 ? 'icons_only' : 'allowlist' } : {})
  };
}

function longformSectionCount(target) {
  for (let count = 1; count <= 20; count += 1) {
    const minimum = count >= 3 ? Math.min(5, Math.max(2, Math.ceil(count / 2))) : 1;
    const computed = count >= 3 ? Math.min(8, count, Math.max(minimum, Math.ceil(2 * count / 3))) : count;
    if (computed === target) return count;
  }
  throw new Error(`No fixture section count for target ${target}.`);
}

function coverageSource(platform, count) {
  if (platform === 'xiaohongshu') {
    return ['# xiaohongshu final', '', '## 卡片文案', '',
      ...Array.from({ length: count }, (_, index) => [
        `### 第 ${index + 1} 页`, '',
        `第${index + 1}页用一条只出现一次的完整判断句解释内容边界，并给出清晰可执行的下一步行动。`, ''
      ]).flat()
    ].join('\n');
  }
  if (platform === 'weibo') {
    if (count === 1) return '# weibo final\n\n这是一条只出现一次的完整短微博判断句，说明确认边界之后才能执行下一步行动。';
    const total = count === 2 ? 4 : count * 3 - 2;
    return Array.from({ length: total }, (_, index) =>
      `${index + 1}/${total} 第${index + 1}段用一条只出现一次的完整判断句说明流程边界，并要求检查确认后再执行行动。`).join('\n\n');
  }
  const sections = longformSectionCount(count);
  return [`# ${platform} final`, '', ...Array.from({ length: sections }, (_, index) => [
    `## 步骤 ${index + 1}`, '',
    `第${index + 1}部分用一条只出现一次的完整判断句说明流程边界，要求先检查输入、确认限制，再记录结论并执行行动。`, '',
    '这段补充说明用于形成稳定的实质章节长度。'.repeat(12), ''
  ]).flat()].join('\n');
}

function fixture({ bounded = false, counts = imageCounts, coverage = true, lease = true } = {}) {
  const runDir = mkdtempSync(join(tmpdir(), 'content-production-illustration-'));
  const profilePath = join(runDir, '00-intake', 'platform-profiles.json');
  mkdirSync(dirname(profilePath), { recursive: true });
  copyFileSync(join(skillDir, 'references', 'platform-profiles.json'), profilePath);
  const selections = platforms.map((platform) => {
    const draftPath = `05-platforms/${platform}/A/final.md`;
    write(join(runDir, draftPath), coverageSource(platform, counts[platform]));
    return {
      platform,
      variant: 'A',
      title_id: `${platform}-A-1`,
      title: platform === 'wechat'
        ? '我们为什么把模拟面试做成了一个复盘工作台？'
        : `${platform} 已选标题`,
      topic_phrase: platform === 'weibo' ? '#已选话题#' : null,
      draft_path: draftPath,
      draft_sha256: sha(join(runDir, draftPath)),
      decision_rule: 'reviewed-choice'
    };
  });
  write(join(runDir, '06-selection', 'titles.json'), '{}');
  write(join(runDir, '06-selection', 'title-matrix.md'), '# Title Matrix');
  const selectionPath = join(runDir, '06-selection', 'selection.v001.json');
  write(selectionPath, JSON.stringify({
    schema_version: 1,
    revision: 1,
    status: 'PROPOSED',
    titles_path: '06-selection/titles.json',
    titles_sha256: sha(join(runDir, '06-selection', 'titles.json')),
    decision_rule: 'reviewed-choice',
    selections
  }, null, 2));

  const binding = (path) => ({ path, sha256: sha(join(runDir, path)) });
  const completedStage = { status: 'completed', attempt: 1, artifacts: [], error: null };
  const pendingStage = { status: 'pending', attempt: 0, artifacts: [], error: null };
  const approvedGate = { status: 'approved', revision: 1, decision_ref: null, bound_artifacts: [] };
  const state = {
    schema_version: 2,
    run_id: 'fixture-run',
    run_mode: 'reviewed',
    status: 'running',
    current_stage: 'visual',
    snapshots: {
      platform_profiles: {
        source_path: join(skillDir, 'references', 'platform-profiles.json'),
        snapshot_path: '00-intake/platform-profiles.json',
        sha256: sha(profilePath)
      }
    },
    capabilities: {
      status: 'PASS',
      providers: {
        illustration: {
          status: 'PASS',
          contract: 'illustration-v1',
          ...(bounded ? { profile: 'bounded-per-image' } : {}),
          adapter_contract: 'illustration-orchestrated-coverage-v1',
          resources: [
            {
              path: join(providerRoot, 'scripts', 'provider-contract.mjs'),
              sha256: sha(join(providerRoot, 'scripts', 'provider-contract.mjs'))
            },
            {
              path: join(providerRoot, 'references', 'orchestrated-provider.md'),
              sha256: sha(join(providerRoot, 'references', 'orchestrated-provider.md'))
            }
          ],
          skill_path: providerSkill,
          skill_sha256: 'a'.repeat(64)
        },
        wechat_cover: {
          status: 'PASS',
          contract: 'wechat-cover-v1',
          skill_path: coverSkill,
          skill_sha256: sha(coverSkill)
        }
      }
    },
    stages: {
      init: completedStage,
      discovery: completedStage,
      research: completedStage,
      outline: completedStage,
      masters: completedStage,
      platforms: completedStage,
      editing: completedStage,
      titles: completedStage,
      visual: { status: 'running', attempt: 1, artifacts: [], error: null },
      package: pendingStage,
      final_qa: pendingStage
    },
    gates: {
      topic: approvedGate,
      outline: approvedGate,
      titles: {
        status: 'approved',
        revision: 1,
        decision_ref: binding('06-selection/selection.v001.json'),
        bound_artifacts: [
          binding('06-selection/titles.json'),
          binding('06-selection/title-matrix.md'),
          binding('06-selection/selection.v001.json')
        ]
      },
      visual: { status: 'pending', revision: 0, decision_ref: null, bound_artifacts: [] },
      final: { status: 'pending', revision: 0, decision_ref: null, bound_artifacts: [] }
    },
    platform_selections: Object.fromEntries(selections.map((item) => [item.platform, item])),
    invalidations: [],
    history: []
  };
  write(join(runDir, 'run.json'), JSON.stringify(state, null, 2));
  if (coverage) {
    const created = run('create-visual-coverage.mjs', [runDir, '--all']);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    if (lease) {
      const selected = run('backend-lease.mjs', [runDir, 'create', '--native-status', 'available']);
      assert.equal(selected.status, 0, selected.stderr || selected.stdout);
    }
  }
  return { runDir, selections };
}

function createPlans(runDir, { counts = imageCounts } = {}) {
  const artifacts = [];
  for (const platform of platforms) {
    const built = run('create-illustration-request.mjs', [
      runDir, 'plan', '--platform', platform,
      '--max-images', String(counts[platform]), '--backend-hint', 'runtime-native'
    ]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const requestPath = JSON.parse(built.stdout).request_path;
    const request = readJson(requestPath);
    const paths = request.expected_artifacts;
    const bounded = request.options.execution_strategy === 'bounded_per_image';
    const coverage = readJson(join(runDir, `07-visual/${platform}/coverage.v001.json`));
    const selectedUnits = coverage.coverage_units.filter((unit) => unit.eligible)
      .sort((left, right) => left.selection_rank - right.selection_rank)
      .slice(0, counts[platform])
      .sort((left, right) => left.ordinal - right.ordinal);
    const anchors = selectedUnits.map((unit, index) => ({
      ...anchor(index, { bounded }),
      source_excerpt: unit.source_excerpt
    }));
    const shot = [
      '---', 'artifact: IllustrationShotList', 'status: READY', `task_id: ${request.task_id}`, '---', '',
      '# 配图镜头表', '',
      ...anchors.flatMap((item) => [
        `## ${item.image_id}`, '',
        `- Placement or sequence: ${item.placement}`,
        `- Source excerpt: ${item.source_excerpt}`,
        `- One core meaning: ${item.core_meaning}`,
        `- Content expression structure: ${item.structure}`,
        `- Visual metaphor: ${item.visual_metaphor}`,
        `- Main actor/object action: ${item.main_action}`,
        `- Suggested elements: ${item.suggested_elements.join(', ')}`,
        `- Short labels: ${item.short_labels.join(', ')}`,
        `- QA risk: ${item.qa_risk}`, ''
      ])
    ].join('\n');
    write(join(runDir, paths[1]), shot);
    const style = styleData(platform);
    const plan = {
      schema_version: 1,
      task_id: request.task_id,
      status: 'READY',
      platform,
      provider_platform: request.provider_platform,
      variant: request.variant,
      source: request.inputs[0],
      selection: request.selection,
      options: request.options,
      analysis: {
        main_line: '文章说明自动化执行前必须先判断系统边界。',
        content_type: 'method',
        expression_need: 'Decision tree'
      },
      style: style.style,
      brand: style.brand,
      generation_backend: {
        kind: 'runtime-native',
        adapter: 'runtime-native:image-generation',
        endpoint_source: 'runtime-native',
        resolved_model: 'gpt-image-2',
        artifact_format: 'png',
        credential_access: 'pass',
        model_check: 'pass',
        process_cleanup_plan: 'verify-request-process-exit',
        process_cleanup_status: 'not-run',
        ...(bounded ? {
          aspect_control: 'hard_parameter',
          structured_size: style.geometry.requested_dimensions
        } : {})
      },
      generation_geometry: style.geometry,
      image_count: anchors.length,
      anchors,
      shot_list: { path: paths[1], sha256: sha(join(runDir, paths[1])) },
      residual_risk: 'none'
    };
    write(join(runDir, paths[0]), JSON.stringify(plan, null, 2));
    const finalized = runProvider(['finalize', requestPath]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    artifacts.push(...paths);
  }
  return artifacts;
}

function createDecision(runDir) {
  const created = run('create-visual-decision.mjs', [runDir]);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  return JSON.parse(created.stdout).decision_path.slice(runDir.length + 1);
}

function prepareBoundedVisual(counts, { cover = true } = {}) {
  const { runDir } = fixture({ bounded: true, counts });
  const plans = createPlans(runDir, { counts });
  const decision = createDecision(runDir);
  assert.equal(run('set-gate.mjs', [
    runDir, 'visual', 'approved', '--decision', decision,
    ...plans.flatMap((path) => ['--artifact', path])
  ]).status, 0);
  for (const platform of platforms) {
    assert.equal(run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]).status, 0);
  }
  if (cover) assert.equal(run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'runtime-native']).status, 0);
  assert.equal(run('illustration-queue.mjs', [runDir, 'init']).status, 0);
  return runDir;
}

function createGeneration(runDir) {
  const coreArtifacts = [];
  for (const platform of platforms) {
    const built = run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const requestPath = JSON.parse(built.stdout).request_path;
    const request = readJson(requestPath);
    const plan = readJson(join(runDir, request.inputs[3].path));
    const bundlePath = request.expected_artifacts[0];
    const manifestPath = request.expected_artifacts[1];
    const style = styleData(platform);
    const images = [];
    for (const item of plan.anchors) {
      const promptPath = request.expected_artifacts.find((path) => path.includes('/prompts/') && path.endsWith(`/${item.image_id}.md`));
      const sourceFile = request.expected_artifacts.find((path) => path.includes('/images/unbranded/') && path.endsWith(`/${item.image_id}.png`)) || null;
      const finalFile = request.expected_artifacts.find((path) => !path.includes('/images/unbranded/')
        && path.includes('/images/') && path.endsWith(`/${item.image_id}.png`));
      write(join(runDir, promptPath), 'Generate one clear explainer. No logo, TF, Tranfu, watermark, page badge, or reserve box.');
      if (sourceFile) {
        mkdirSync(dirname(join(runDir, sourceFile)), { recursive: true });
        copyFileSync(style.raster, join(runDir, sourceFile));
      }
      mkdirSync(dirname(join(runDir, finalFile)), { recursive: true });
      if (sourceFile) {
        const sourceSize = dimensions(join(runDir, sourceFile));
        writeFileSync(join(runDir, finalFile), pngImage(sourceSize.width, sourceSize.height, 1));
      } else {
        copyFileSync(style.raster, join(runDir, finalFile));
      }
      const size = dimensions(join(runDir, finalFile));
      const finalStat = statSync(join(runDir, finalFile));
      const sourceStat = sourceFile ? statSync(join(runDir, sourceFile)) : finalStat;
      const disabled = plan.brand.disabled_reason;
      images.push({
        image_id: item.image_id,
        file: finalFile,
        file_sha256: sha(join(runDir, finalFile)),
        source_file: sourceFile,
        source_sha256: sourceFile ? sha(join(runDir, sourceFile)) : null,
        prompt_path: promptPath,
        prompt_sha256: sha(join(runDir, promptPath)),
        placement: item.placement,
        core_meaning: item.core_meaning,
        structure: item.structure,
        visual_metaphor: item.visual_metaphor,
        content_qa_status: 'pass',
        style_qa_status: 'pass',
        brand_qa_status: disabled || 'pass',
        set_qa_status: 'pass',
        brand_overlay_status: sourceFile ? 'applied' : disabled,
        size_check_status: 'pass-native',
        generation_attempt: 1,
        requested_dimensions: plan.generation_geometry.requested_dimensions,
        source_dimensions: size,
        source_aspect_ratio: size.width / size.height,
        source_artifact: { format: 'png', bytes: sourceStat.size },
        delivery_dimensions: size,
        delivery_artifact: { format: 'png', bytes: finalStat.size, hard_limit_exporter: null },
        native_output_preserved: true,
        post_generation_actions: sourceFile ? ['brand-overlay-native'] : [],
        geometry_attempts: [{
          attempt: 1,
          requested_dimensions: plan.generation_geometry.requested_dimensions,
          source_dimensions: size,
          status: 'pass-native'
        }],
        residual_risk: 'none'
      });
    }
    write(join(runDir, manifestPath), [
      'post_illustration_bundle:',
      `  platform: ${request.provider_platform}`,
      `  style_id: ${plan.style.id}`,
      '  images:',
      ...images.map((image) => `    - image_id: ${image.image_id}\n      file: ${image.file}`)
    ].join('\n'));
    const bundle = {
      schema_version: 1,
      task_id: request.task_id,
      status: 'PASS',
      platform,
      provider_platform: request.provider_platform,
      variant: request.variant,
      source: request.inputs[0],
      selection: request.selection,
      plan: { path: request.inputs[3].path, sha256: request.inputs[3].sha256 },
      shot_list: { path: request.inputs[4].path, sha256: request.inputs[4].sha256 },
      style: plan.style,
      brand: plan.brand,
      generation_backend: { ...plan.generation_backend, process_cleanup_status: 'pass' },
      generation_geometry: plan.generation_geometry,
      image_count: images.length,
      manifest: { path: manifestPath, sha256: sha(join(runDir, manifestPath)) },
      images,
      residual_risk: 'none'
    };
    write(join(runDir, bundlePath), JSON.stringify(bundle, null, 2));
    const finalized = runProvider(['finalize', requestPath]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    coreArtifacts.push(request.inputs[3].path, request.inputs[4].path, bundlePath, manifestPath);
  }
  return coreArtifacts;
}

function createCover(runDir) {
  const built = run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'runtime-native']);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const requestPath = JSON.parse(built.stdout).request_path;
  const request = readJson(requestPath);
  const suffix = request.attempt === 1 ? '' : `.v${String(request.attempt).padStart(3, '0')}`;
  const versionDir = request.attempt === 1 ? '' : `v${String(request.attempt).padStart(3, '0')}/`;
  const sourcePath = `${request.output_dir}/source${suffix}.md`;
  const promptPath = `${request.output_dir}/prompts/${versionDir}attempt-01.md`;
  const candidatePath = `${request.output_dir}/candidates/${versionDir}attempt-01.png`;
  const [coverPath, metadataPath] = request.expected_artifacts;
  write(join(runDir, sourcePath), `# Cover source\n\nExact title: ${request.selection.title}`);
  write(join(runDir, promptPath), `Render the exact title on the left: ${request.selection.title}`);
  mkdirSync(dirname(join(runDir, candidatePath)), { recursive: true });
  copyFileSync(join(coverRoot, 'assets', 'style-reference.png'), join(runDir, candidatePath));
  copyFileSync(join(runDir, candidatePath), join(runDir, coverPath));
  const resource = (path) => ({ path, sha256: sha(join(coverRoot, path)) });
  const coverHash = sha(join(runDir, coverPath));
  write(join(runDir, metadataPath), JSON.stringify({
    schema_version: 1,
    contract: 'wechat-cover-v1',
    task_id: request.task_id,
    status: 'PASS',
    attempt: request.attempt,
    platform: 'wechat',
    variant: request.variant,
    request: { path: requestPath.slice(runDir.length + 1), sha256: sha(requestPath) },
    selection: request.selection,
    inputs: request.inputs,
    style: {
      id: 'warm-hand-drawn-notebook-v1',
      skill_file: resource('SKILL.md'),
      style_spec: resource('references/style-spec.md'),
      style_reference: resource('assets/style-reference.png'),
      normalizer: resource('scripts/normalize_cover.py')
    },
    source: { path: sourcePath, sha256: sha(join(runDir, sourcePath)) },
    backend: { hint: 'runtime-native', method: 'runtime-native:image-generation', model: 'gpt-image-2' },
    generation: {
      max_attempts: 3,
      attempt_count: 1,
      selected_attempt: 1,
      attempts: [{
        attempt: 1,
        prompt: { path: promptPath, sha256: sha(join(runDir, promptPath)) },
        candidate: {
          path: candidatePath,
          sha256: sha(join(runDir, candidatePath)),
          format: 'png', width: 1923, height: 818
        },
        backend: { method: 'runtime-native:image-generation', model: 'gpt-image-2' },
        status: 'PASS',
        failed_gates: [], absolute_failures: [], visible_title_defects: []
      }],
      selected_qa: {
        inspection: {
          method: 'model_visual_inspection',
          artifact_path: coverPath,
          artifact_sha256: coverHash,
          reviewer: 'fixture-visual-reviewer',
          reviewed_at: '2026-07-17T12:00:00.000Z'
        },
        title_evidence: {
          claim: 'provider_observed_exact',
          expected_title: request.selection.title,
          observed_title: request.selection.title,
          comparison: 'exact',
          evidence_class: 'provider_visual_observation',
          ocr_status: 'not_performed',
          readable: true,
          position: 'left',
          line_count: 3,
          extra_readable_text: false
        },
        gates: {
          title_accuracy: 'PASS', additional_text: 'PASS', composition: 'PASS', safe_margin: 'PASS',
          underline_accents: 'PASS', spacing: 'PASS', visual_style: 'PASS', semantic_fidelity: 'PASS',
          forbidden_elements: 'PASS', dimensions: 'PASS'
        },
        failed_gates: [], absolute_failures: [], visible_title_defects: [],
        verification_limitations: [
          'No deterministic OCR was performed; title exactness is a provider visual observation bound to this artifact hash.'
        ]
      }
    },
    cover: {
      path: coverPath,
      sha256: coverHash,
      format: 'png', width: 1923, height: 818,
      selected_candidate_path: candidatePath,
      selected_candidate_sha256: sha(join(runDir, candidatePath)),
      byte_identical: true
    },
    residual_risk: 'none'
  }, null, 2));
  const finalized = runCoverProvider(['finalize', requestPath]);
  assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
  return [coverPath, metadataPath];
}

test('all current coverage contracts must exist before any illustration plan request', () => {
  const { runDir } = fixture({ coverage: false });
  try {
    const blocked = run('create-illustration-request.mjs', [runDir, 'plan', '--platform', 'wechat']);
    assert.equal(blocked.status, 2);
    assert.ok(JSON.parse(blocked.stdout).blockers.some((item) => item.code === 'visual_policy_missing'));
    assert.equal(existsSync(join(runDir, '07-visual/wechat/illustration-plan.request.json')), false);

    const created = run('create-visual-coverage.mjs', [runDir, '--all']);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    assert.equal(existsSync(join(runDir, '07-visual/policy.v001.json')), true);
    assert.equal(platforms.every((platform) =>
      existsSync(join(runDir, `07-visual/${platform}/coverage.v001.json`))), true);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('invalid Xiaohongshu page counts block atomically before requests, queue, prompts, or images', () => {
  for (const pageCount of [3, 9]) {
    const counts = { ...imageCounts, xiaohongshu: pageCount };
    const { runDir } = fixture({ counts, coverage: false });
    try {
      const result = run('create-visual-coverage.mjs', [runDir, '--all']);
      assert.equal(result.status, 2);
      assert.ok(JSON.parse(result.stdout).issues.some((item) => item.code === 'visual_xhs_page_count_invalid'));
      assert.equal(existsSync(join(runDir, '07-visual/policy.v001.json')), false);
      assert.equal(platforms.some((platform) =>
        existsSync(join(runDir, `07-visual/${platform}/coverage.v001.json`))), false);
      assert.equal(existsSync(join(runDir, '07-visual/generation-queue.json')), false);
      assert.equal(existsSync(join(runDir, '07-visual/xiaohongshu/prompts')), false);
      assert.equal(existsSync(join(runDir, '07-visual/xiaohongshu/images')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  }
});

test('duplicate coverage anchors block decision before queue, prompt, or image creation', () => {
  const { runDir } = fixture();
  try {
    createPlans(runDir);
    const planPath = join(runDir, '07-visual/wechat/plan.json');
    const plan = readJson(planPath);
    plan.anchors[1].source_excerpt = plan.anchors[0].source_excerpt;
    write(planPath, JSON.stringify(plan, null, 2));
    const decision = run('create-visual-decision.mjs', [runDir]);
    assert.equal(decision.status, 2);
    assert.ok(JSON.parse(decision.stdout).issues.some((item) => item.code === 'visual_anchor_duplicate_coverage'));
    assert.equal(existsSync(join(runDir, '07-visual/generation-queue.json')), false);
    assert.equal(existsSync(join(runDir, '07-visual/wechat/prompts')), false);
    assert.equal(existsSync(join(runDir, '07-visual/wechat/images')), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('missing required coverage blocks decision before queue, prompt, or image creation', () => {
  const counts = { ...imageCounts, wechat: 3 };
  const { runDir } = fixture({ counts });
  try {
    createPlans(runDir, { counts });
    const coverage = readJson(join(runDir, '07-visual/wechat/coverage.v001.json'));
    const planPath = join(runDir, '07-visual/wechat/plan.json');
    const plan = readJson(planPath);
    const covered = new Set(plan.anchors.map((anchor) => anchor.source_excerpt));
    const required = coverage.coverage_units.find((unit) => unit.required);
    const unused = coverage.coverage_units.find((unit) => unit.eligible && !covered.has(unit.source_excerpt));
    const anchor = plan.anchors.find((item) => item.source_excerpt === required.source_excerpt);
    anchor.source_excerpt = unused.source_excerpt;
    write(planPath, JSON.stringify(plan, null, 2));

    const decision = run('create-visual-decision.mjs', [runDir]);
    assert.equal(decision.status, 2);
    assert.ok(JSON.parse(decision.stdout).issues.some((item) => item.code === 'visual_required_coverage_missing'));
    assert.equal(existsSync(join(runDir, '07-visual/generation-queue.json')), false);
    assert.equal(existsSync(join(runDir, '07-visual/wechat/prompts')), false);
    assert.equal(existsSync(join(runDir, '07-visual/wechat/images')), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('illustration plan request binds the approved winner and maps Xiaohongshu to xhs', () => {
  const { runDir, selections } = fixture();
  try {
    const result = run('create-illustration-request.mjs', [runDir, 'plan', '--platform', 'xiaohongshu']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    const request = readJson(output.request_path);
    const selected = selections.find((item) => item.platform === 'xiaohongshu');
    assert.equal(request.mode, 'plan');
    assert.equal(request.platform, 'xiaohongshu');
    assert.equal(request.provider_platform, 'xhs');
    assert.deepEqual(request.selection, selected);
    assert.deepEqual(request.inputs, [
      { role: 'final_draft', path: selected.draft_path, sha256: selected.draft_sha256 },
      {
        role: 'title_selection',
        path: '06-selection/selection.v001.json',
        sha256: sha(join(runDir, '06-selection', 'selection.v001.json'))
      },
      {
        role: 'visual_coverage',
        path: '07-visual/xiaohongshu/coverage.v001.json',
        sha256: sha(join(runDir, '07-visual/xiaohongshu/coverage.v001.json'))
      }
    ]);
    assert.equal(request.options.max_images, 4);
    assert.deepEqual(request.expected_artifacts, [
      '07-visual/xiaohongshu/plan.json',
      '07-visual/xiaohongshu/shot-list.md'
    ]);
    const earlyGenerate = run('create-illustration-request.mjs', [runDir, 'generate', '--platform', 'xiaohongshu']);
    assert.equal(earlyGenerate.status, 2);
    assert.ok(JSON.parse(earlyGenerate.stdout).blockers.some((item) => item.code === 'illustration_plan_not_approved'));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('visual plan approval happens inside the running visual stage', () => {
  const { runDir } = fixture();
  try {
    const artifacts = createPlans(runDir).flatMap((path) => ['--artifact', path]);
    const decision = createDecision(runDir);
    const result = run('set-gate.mjs', [runDir, 'visual', 'approved', '--decision', decision, ...artifacts]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const state = readJson(join(runDir, 'run.json'));
    assert.equal(state.gates.visual.status, 'approved');
    assert.equal(state.stages.visual.status, 'running');
    assert.equal(state.current_stage, 'visual');
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('visual completion enters package and reopening preserves title winners only', () => {
  const { runDir, selections } = fixture();
  try {
    const statePath = join(runDir, 'run.json');
    const plans = createPlans(runDir);
    const decision = createDecision(runDir);
    const approved = run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(approved.status, 0, approved.stderr || approved.stdout);
    const artifacts = createGeneration(runDir);

    const missingCover = run('set-stage.mjs', [
      runDir, 'visual', 'completed',
      ...artifacts.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(missingCover.status, 2);
    assert.ok(JSON.parse(missingCover.stdout).issues.some((item) => item.code === 'invalid_visual_artifact_binding'));

    artifacts.push(...createCover(runDir));
    const completed = run('set-stage.mjs', [
      runDir, 'visual', 'completed',
      ...artifacts.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
    let current = readJson(statePath);
    assert.equal(current.current_stage, 'package');

    current.stages.package = { status: 'completed', attempt: 1, artifacts: [], error: null };
    current.stages.final_qa = { status: 'completed', attempt: 1, artifacts: [], error: null };
    current.gates.final = { status: 'approved', revision: 1, decision_ref: null, bound_artifacts: [] };
    current.status = 'running';
    current.current_stage = 'package';
    write(statePath, JSON.stringify(current, null, 2));

    const reopened = run('set-stage.mjs', [runDir, 'visual', 'running']);
    assert.equal(reopened.status, 0, reopened.stderr || reopened.stdout);
    current = readJson(statePath);
    assert.equal(current.stages.visual.attempt, 2);
    assert.deepEqual(current.stages.visual.artifacts, []);
    assert.equal(current.gates.visual.status, 'pending');
    assert.equal(current.stages.package.status, 'pending');
    assert.equal(current.stages.final_qa.status, 'pending');
    assert.equal(current.gates.final.status, 'pending');
    assert.equal(current.gates.titles.status, 'approved');
    assert.deepEqual(current.platform_selections, Object.fromEntries(selections.map((item) => [item.platform, item])));
    const blockedNextPlan = run('create-illustration-request.mjs', [runDir, 'plan', '--platform', 'wechat']);
    assert.equal(blockedNextPlan.status, 2);
    assert.ok(JSON.parse(blockedNextPlan.stdout).blockers.some((item) => item.code === 'visual_policy_missing'));
    const nextCoverage = run('create-visual-coverage.mjs', [runDir, '--all']);
    assert.equal(nextCoverage.status, 0, nextCoverage.stderr || nextCoverage.stdout);
    const nextLease = run('backend-lease.mjs', [runDir, 'create', '--native-status', 'available']);
    assert.equal(nextLease.status, 0, nextLease.stderr || nextLease.stdout);
    const nextPlan = run('create-illustration-request.mjs', [runDir, 'plan', '--platform', 'wechat']);
    assert.equal(nextPlan.status, 0, nextPlan.stderr || nextPlan.stdout);
    const nextRequest = readJson(JSON.parse(nextPlan.stdout).request_path);
    assert.match(JSON.parse(nextPlan.stdout).request_path, /illustration-plan\.v002\.request\.json$/);
    assert.deepEqual(nextRequest.expected_artifacts, [
      '07-visual/wechat/plan.v002.json',
      '07-visual/wechat/shot-list.v002.md'
    ]);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('visual approval rejects a stale or risky plan package', () => {
  const { runDir } = fixture();
  try {
    const plans = createPlans(runDir);
    const decision = createDecision(runDir);
    const planPath = join(runDir, '07-visual', 'wechat', 'plan.json');
    const plan = readJson(planPath);
    plan.residual_risk = 'low';
    write(planPath, JSON.stringify(plan, null, 2));
    const result = run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(result.status, 2);
    const issues = JSON.parse(result.stdout).issues;
    assert.ok(issues.some((item) => item.code === 'invalid_illustration_plan'));
    assert.ok(issues.some((item) => item.code === 'illustration_plan_result_drift'));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('restarting a blocked visual generation creates a new attempt', () => {
  const { runDir, selections } = fixture();
  try {
    const plans = createPlans(runDir);
    const decision = createDecision(runDir);
    assert.equal(run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]).status, 0);
    assert.equal(run('set-stage.mjs', [runDir, 'visual', 'blocked', '--error', 'backend unavailable']).status, 0);
    const restarted = run('set-stage.mjs', [runDir, 'visual', 'running']);
    assert.equal(restarted.status, 0, restarted.stderr || restarted.stdout);
    const state = readJson(join(runDir, 'run.json'));
    assert.equal(state.stages.visual.attempt, 2);
    assert.equal(state.gates.visual.status, 'pending');
    assert.equal(state.gates.titles.status, 'approved');
    assert.deepEqual(state.platform_selections, Object.fromEntries(selections.map((item) => [item.platform, item])));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('bounded illustration plans derive max_images from coverage without changing the public contract', () => {
  const { runDir } = fixture({ bounded: true });
  try {
    const built = run('create-illustration-request.mjs', [
      runDir, 'plan', '--platform', 'wechat', '--backend-hint', 'runtime-native'
    ]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const request = readJson(JSON.parse(built.stdout).request_path);
    assert.equal(request.provider_contract, 'illustration-v1');
    assert.equal(request.options.max_images, 2);
    assert.equal(request.options.execution_strategy, 'bounded_per_image');

    const tooMany = run('create-illustration-request.mjs', [
      runDir, 'plan', '--platform', 'zhihu', '--max-images', '9'
    ]);
    assert.equal(tooMany.status, 2);
    assert.ok(JSON.parse(tooMany.stdout).blockers.some((item) => item.code === 'illustration_request_max_policy_mismatch'));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('current visual attempt requires one immutable backend lease before provider planning', () => {
  const { runDir } = fixture({ bounded: true, lease: false });
  try {
    const requestPath = join(runDir, '07-visual', 'wechat', 'illustration-plan.request.json');
    const missing = run('create-illustration-request.mjs', [runDir, 'plan', '--platform', 'wechat']);
    assert.equal(missing.status, 2);
    assert.ok(JSON.parse(missing.stdout).blockers.some((item) => item.code === 'backend_lease_missing'));
    assert.equal(existsSync(requestPath), false);

    const selected = run('backend-lease.mjs', [runDir, 'create', '--native-status', 'available']);
    assert.equal(selected.status, 0, selected.stderr || selected.stdout);
    assert.equal(JSON.parse(selected.stdout).backend_kind, 'runtime-native');

    const promptPath = join(runDir, '07-visual', 'wechat', 'prompts', 'lease-check.md');
    const outputPath = join(runDir, '07-visual', 'wechat', 'images', 'lease-check.png');
    write(promptPath, 'Generate one test image.');
    const native = run('run-image-generation.mjs', [
      runDir, '--prompt-file', promptPath, '--output', outputPath
    ]);
    assert.equal(native.status, 0, native.stderr || native.stdout);
    assert.equal(JSON.parse(native.stdout).status, 'NATIVE_TOOL_CALL_REQUIRED');
    assert.equal(existsSync(outputPath), false);
    const formatMismatch = run('run-image-generation.mjs', [
      runDir, '--prompt-file', promptPath, '--output', outputPath, '--output-format', 'jpeg'
    ]);
    assert.equal(formatMismatch.status, 2);
    assert.equal(existsSync(outputPath), false);
    rmSync(dirname(promptPath), { recursive: true, force: true });

    const switched = run('backend-lease.mjs', [runDir, 'create', '--backend', 'configured-api']);
    assert.equal(switched.status, 2);
    assert.ok(JSON.parse(switched.stdout).issues.some((item) => item.code === 'backend_switch_forbidden'));

    const built = run('create-illustration-request.mjs', [runDir, 'plan', '--platform', 'wechat']);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const request = readJson(JSON.parse(built.stdout).request_path);
    assert.equal(request.options.backend_hint, 'runtime-native');

    const plans = createPlans(runDir);
    const decision = createDecision(runDir);
    const approved = run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(approved.status, 0, approved.stderr || approved.stdout);
    const cover = run('create-wechat-cover-request.mjs', [runDir]);
    assert.equal(cover.status, 0, cover.stderr || cover.stdout);
    const coverRequest = readJson(JSON.parse(cover.stdout).request_path);
    assert.equal(coverRequest.options.backend_hint, 'runtime-native');
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('backend outcomes stay on the selected route and only irrecoverable errors block the attempt', () => {
  const { runDir } = fixture({ bounded: true });
  try {
    const leasePath = join(runDir, '07-visual', 'backend-lease.v001.json');
    const leaseHash = sha(leasePath);
    const quality = run('backend-lease.mjs', [runDir, 'record', '--outcome', 'quality-failure']);
    assert.equal(quality.status, 0, quality.stderr || quality.stdout);
    assert.deepEqual(JSON.parse(quality.stdout), {
      status: 'PASS', action: 'retry-candidate', retry_backend: 'runtime-native', block_attempt: false
    });
    assert.equal(sha(leasePath), leaseHash);

    const transient = run('backend-lease.mjs', [runDir, 'record', '--outcome', 'transient-error']);
    assert.equal(transient.status, 0, transient.stderr || transient.stdout);
    assert.equal(JSON.parse(transient.stdout).retry_backend, 'runtime-native');
    assert.equal(sha(leasePath), leaseHash);

    const failed = run('backend-lease.mjs', [runDir, 'record', '--outcome', 'irrecoverable-execution-error']);
    assert.equal(failed.status, 2);
    const state = readJson(join(runDir, 'run.json'));
    assert.equal(state.status, 'blocked');
    assert.equal(state.stages.visual.status, 'blocked');
    assert.equal(state.stages.visual.attempt, 1);
    assert.equal(existsSync(join(runDir, '07-visual', 'wechat', 'illustration-plan.request.json')), false);
    assert.equal(existsSync(join(runDir, '07-visual', 'wechat', 'prompts')), false);

    const restarted = run('set-stage.mjs', [runDir, 'visual', 'running']);
    assert.equal(restarted.status, 0, restarted.stderr || restarted.stdout);
    const next = readJson(join(runDir, 'run.json'));
    assert.equal(next.stages.visual.attempt, 2);
    assert.equal(existsSync(join(runDir, '07-visual', 'backend-lease.v002.json')), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('bounded queue dispatches only canaries before suite approval and caps global generation at four', () => {
  const counts = { wechat: 3, xiaohongshu: 4, zhihu: 2, weibo: 2, toutiao: 2 };
  const { runDir } = fixture({ bounded: true, counts });
  try {
    const plans = createPlans(runDir, { counts });
    const decision = createDecision(runDir);
    const approved = run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(approved.status, 0, approved.stderr || approved.stdout);
    for (const platform of platforms) {
      const generated = run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const request = readJson(JSON.parse(generated.stdout).request_path);
      assert.deepEqual(request.expected_artifacts, [
        `07-visual/${platform}/bundle.json`, `07-visual/${platform}/manifest.md`
      ]);
    }
    const cover = run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'runtime-native']);
    assert.equal(cover.status, 0, cover.stderr || cover.stdout);
    const initialized = run('illustration-queue.mjs', [runDir, 'init']);
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    const dispatched = run('illustration-queue.mjs', [runDir, 'dispatch']);
    assert.equal(dispatched.status, 0, dispatched.stderr || dispatched.stdout);
    const output = JSON.parse(dispatched.stdout);
    assert.ok(output.generation_requests.length > 0);
    assert.ok(output.generation_requests.length <= 4);
    const activeSuites = new Set();
    for (const path of output.generation_requests) {
      const request = readJson(path);
      if (request.mode === 'generate_image') {
        const plan = readJson(join(runDir, `07-visual/${request.platform}/plan.json`));
        assert.equal(request.anchor.image_id, plan.anchors[0].image_id);
        activeSuites.add(request.platform);
      }
    }
    assert.equal(activeSuites.size, output.generation_requests.filter((path) => readJson(path).mode === 'generate_image').length);
    for (const platform of platforms) {
      const plan = readJson(join(runDir, `07-visual/${platform}/plan.json`));
      for (const anchor of plan.anchors.slice(1)) {
        assert.equal(existsSync(join(runDir, `07-visual/${platform}/children/${anchor.image_id}`)), false);
      }
    }
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('coverage tampering after approval blocks queue initialization without prompts or images', () => {
  const { runDir } = fixture({ bounded: true });
  try {
    const plans = createPlans(runDir);
    const decision = createDecision(runDir);
    assert.equal(run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]).status, 0);
    for (const platform of platforms) {
      assert.equal(run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]).status, 0);
    }
    assert.equal(run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'runtime-native']).status, 0);
    const coveragePath = join(runDir, '07-visual/wechat/coverage.v001.json');
    const coverage = readJson(coveragePath);
    coverage.cardinality.minimum = 2;
    write(coveragePath, JSON.stringify(coverage, null, 2));

    const initialized = run('illustration-queue.mjs', [runDir, 'init']);
    assert.equal(initialized.status, 2);
    assert.ok(JSON.parse(initialized.stdout).issues.some((item) =>
      ['visual_coverage_stale', 'visual_decision_invalid'].includes(item.code)));
    assert.equal(existsSync(join(runDir, '07-visual/generation-queue.json')), false);
    assert.equal(existsSync(join(runDir, '07-visual/wechat/prompts')), false);
    assert.equal(existsSync(join(runDir, '07-visual/wechat/images')), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('eight-image suite waits for its canary and then dispatches 2+2+2+1 within queue limits', () => {
  const counts = { wechat: 1, xiaohongshu: 8, zhihu: 1, weibo: 1, toutiao: 1 };
  const runDir = prepareBoundedVisual(counts, { cover: false });
  try {
    const batches = [];
    for (let cycle = 0; cycle < 12; cycle += 1) {
      const dispatched = run('illustration-queue.mjs', [runDir, 'dispatch']);
      assert.equal(dispatched.status, 0, dispatched.stderr || dispatched.stdout);
      const output = JSON.parse(dispatched.stdout);
      const requests = output.generation_requests.map((path) => ({ path, request: readJson(path) }));
      const xhs = requests.filter((item) => item.request.platform === 'xiaohongshu');
      if (cycle === 0) {
        assert.deepEqual(xhs.map((item) => item.request.anchor.image_id), ['01-boundary']);
      } else if (xhs.length) {
        assert.ok(xhs.every((item) => item.request.anchor.image_id !== '01-boundary'));
        batches.push(xhs.length);
      }
      const queue = readJson(join(runDir, '07-visual/generation-queue.json'));
      const event = queue.events.at(-1);
      assert.ok(event.active_generation_count <= 4);
      assert.ok(Object.values(event.active_generation_by_suite).every((count) => count <= 2));
      for (const item of requests) completeChild(runDir, item.path);
      const xhsChildren = readJson(join(runDir, '07-visual/generation-queue.json')).suites.xiaohongshu.children;
      if (Object.values(xhsChildren).every((child) => child.selected_attempt !== null)) break;
    }
    assert.deepEqual(batches, [2, 2, 2, 1]);
    const queue = readJson(join(runDir, '07-visual/generation-queue.json'));
    assert.equal(Object.keys(queue.suites.xiaohongshu.children).length, 8);
    assert.ok(Object.values(queue.suites.xiaohongshu.children).every((child) => child.attempts.length === 1));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('transport release reuses the same child candidate attempt', () => {
  const counts = { wechat: 1, xiaohongshu: 4, zhihu: 1, weibo: 1, toutiao: 1 };
  const runDir = prepareBoundedVisual(counts);
  try {
    const first = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    const requestPath = first.generation_requests.find((path) => readJson(path).mode === 'generate_image');
    const request = readJson(requestPath);
    const released = run('illustration-queue.mjs', [
      runDir, 'release', '--task-id', request.task_id, '--reason', 'transport'
    ]);
    assert.equal(released.status, 0, released.stderr || released.stdout);
    const retried = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    assert.ok(retried.generation_requests.includes(requestPath));
    const queue = readJson(join(runDir, '07-visual/generation-queue.json'));
    const child = queue.suites[request.platform].children[request.anchor.image_id];
    assert.equal(child.attempts.length, 1);
    assert.equal(child.attempts[0].transport_retries, 1);
    assert.equal(readJson(requestPath).candidate_attempt, 1);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('tampered queue limits are blocked before any generation dispatch', () => {
  const counts = { wechat: 1, xiaohongshu: 8, zhihu: 1, weibo: 1, toutiao: 1 };
  const runDir = prepareBoundedVisual(counts, { cover: false });
  try {
    const queuePath = join(runDir, '07-visual/generation-queue.json');
    const queue = readJson(queuePath);
    queue.global_limit = 10;
    queue.suite_limit = 10;
    write(queuePath, JSON.stringify(queue, null, 2));
    const dispatched = run('illustration-queue.mjs', [runDir, 'dispatch']);
    assert.equal(dispatched.status, 2);
    assert.ok(JSON.parse(dispatched.stdout).issues.some((item) => item.code === 'invalid_illustration_queue'));
    assert.equal(existsSync(join(runDir, '07-visual/xiaohongshu/children')), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('three failed canary candidates block only that suite', () => {
  const counts = { wechat: 1, xiaohongshu: 4, zhihu: 1, weibo: 1, toutiao: 1 };
  const runDir = prepareBoundedVisual(counts);
  try {
    let requestPath = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout)
      .generation_requests.find((path) => readJson(path).platform === 'xiaohongshu');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      assert.equal(readJson(requestPath).candidate_attempt, attempt);
      completeChild(runDir, requestPath, { width: 1024, height: 1536, expectedStatus: 2 });
      const dispatched = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
      requestPath = dispatched.generation_requests.find((path) => readJson(path).platform === 'xiaohongshu');
    }
    assert.equal(requestPath, undefined);
    const queue = readJson(join(runDir, '07-visual/generation-queue.json'));
    const suite = queue.suites.xiaohongshu;
    assert.equal(suite.status, 'blocked');
    assert.equal(suite.children[suite.canary_id].attempts.length, 3);
    assert.equal(queue.suites.wechat.status === 'blocked', false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('truncated PNG header stubs fail child raster decoding', () => {
  const counts = { wechat: 1, xiaohongshu: 4, zhihu: 1, weibo: 1, toutiao: 1 };
  const runDir = prepareBoundedVisual(counts);
  try {
    const output = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    const requestPath = output.generation_requests.find((path) => readJson(path).platform === 'xiaohongshu');
    const stub = pngHeaderStub(1086, 1448);
    completeChild(runDir, requestPath, {
      expectedStatus: 2,
      candidateBytes: stub,
      deliveryBytes: Buffer.concat([stub, Buffer.from('brand')])
    });
    const result = readJson(join(dirname(requestPath), 'result.json'));
    assert.ok(result.issues.some((item) => item.code === 'illustration_candidate_geometry'));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('bounded child rejects 2:3, retries only that image, and accepts native 1086x1448', () => {
  const counts = { wechat: 1, xiaohongshu: 4, zhihu: 1, weibo: 1, toutiao: 1 };
  const { runDir } = fixture({ bounded: true, counts });
  try {
    const plans = createPlans(runDir, { counts });
    const decision = createDecision(runDir);
    assert.equal(run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]).status, 0);
    for (const platform of platforms) {
      assert.equal(run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]).status, 0);
    }
    assert.equal(run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'runtime-native']).status, 0);
    assert.equal(run('illustration-queue.mjs', [runDir, 'init']).status, 0);
    const first = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    const firstPath = first.generation_requests.find((path) => readJson(path).platform === 'xiaohongshu');
    const firstRequest = readJson(firstPath);
    const originalRequest = readFileSync(firstPath, 'utf8');
    const escapedRequest = {
      ...firstRequest,
      artifacts: { ...firstRequest.artifacts, prompt: '07-visual/xiaohongshu/bundle.json' }
    };
    escapedRequest.expected_artifacts = [...new Set(Object.values(escapedRequest.artifacts))];
    write(firstPath, JSON.stringify(escapedRequest, null, 2));
    assert.equal(runChildProvider(['validate-request', firstPath]).status, 2);
    writeFileSync(firstPath, originalRequest, 'utf8');
    write(join(runDir, firstRequest.artifacts.prompt), [
      'Create one 3:4 explainer at aspect ratio 0.75.',
      'Render the words FORBIDDEN_COPY in the image.',
      'Exclude 2:3 and 1024x1536.'
    ].join('\n'));
    const ordinaryTextCommand = runChildProvider(['preflight', firstPath]);
    assert.equal(ordinaryTextCommand.status, 2);
    assert.ok(JSON.parse(ordinaryTextCommand.stdout).issues.some((item) => item.code === 'illustration_prompt_text_not_allowed'));
    write(join(runDir, firstRequest.artifacts.prompt), [
      'Create one 3:4 explainer at aspect ratio 0.75.',
      'Use only the readable label “边界”. Footer: 未授权说明。',
      'Exclude 2:3 and 1024x1536. No other readable text.'
    ].join('\n'));
    const outsideAllowlist = runChildProvider(['preflight', firstPath]);
    assert.equal(outsideAllowlist.status, 2);
    assert.ok(JSON.parse(outsideAllowlist.stdout).issues.some((item) => item.code === 'illustration_prompt_text_not_allowed'));
    write(join(runDir, firstRequest.artifacts.prompt), [
      'Create one 3:4 explainer at aspect ratio 0.75 and render at 2:3.',
      'Use only the readable label “边界”. No other readable text.'
    ].join('\n'));
    const conflictingRatio = runChildProvider(['preflight', firstPath]);
    assert.equal(conflictingRatio.status, 2);
    assert.ok(JSON.parse(conflictingRatio.stdout).issues.some((item) => item.code === 'illustration_prompt_aspect_conflict'));
    write(join(runDir, firstRequest.artifacts.prompt), [
      'Create one 3:4 explainer at aspect ratio 0.75.',
      'Use only the readable label “边界”.',
      'Exclude 2:3 and 1024x1536. No other readable text.'
    ].join('\n'));
    const preflight = runChildProvider(['preflight', firstPath]);
    assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
    mkdirSync(dirname(join(runDir, firstRequest.artifacts.candidate)), { recursive: true });
    mkdirSync(dirname(join(runDir, firstRequest.artifacts.delivery)), { recursive: true });
    writeFileSync(join(runDir, firstRequest.artifacts.candidate), pngImage(1024, 1536));
    writeFileSync(join(runDir, firstRequest.artifacts.delivery), pngImage(1024, 1536, 1));
    write(join(runDir, firstRequest.artifacts.qa), JSON.stringify({
      schema_version: 1,
      status: 'PASS',
      content_qa_status: 'pass',
      style_qa_status: 'pass',
      brand_qa_status: 'pass',
      failed_gates: [],
      readable_text: ['边界'],
      residual_risk: 'none',
      reviewer: 'fixture-reviewer',
      reviewed_at: '2026-07-20T00:00:00.000Z'
    }, null, 2));
    const rejected = runChildProvider(['finalize', firstPath]);
    assert.equal(rejected.status, 2, rejected.stderr || rejected.stdout);
    assert.ok(readJson(join(dirname(firstPath), 'result.json')).issues.some((item) => item.code === 'illustration_candidate_geometry'));

    const secondDispatch = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    const secondPath = secondDispatch.generation_requests.find((path) => {
      const request = readJson(path);
      return request.platform === 'xiaohongshu' && request.anchor.image_id === firstRequest.anchor.image_id;
    });
    const secondRequest = readJson(secondPath);
    assert.equal(secondRequest.candidate_attempt, 2);
    write(join(runDir, secondRequest.artifacts.prompt), [
      'Create one 3:4 explainer at aspect ratio 0.75.',
      'Use only the readable label “边界”.',
      'Exclude 2:3 and 1024x1536. No other readable text.'
    ].join('\n'));
    assert.equal(runChildProvider(['preflight', secondPath]).status, 0);
    mkdirSync(dirname(join(runDir, secondRequest.artifacts.candidate)), { recursive: true });
    mkdirSync(dirname(join(runDir, secondRequest.artifacts.delivery)), { recursive: true });
    writeFileSync(join(runDir, secondRequest.artifacts.candidate), pngImage(1086, 1448));
    writeFileSync(join(runDir, secondRequest.artifacts.delivery), pngImage(1086, 1448, 1));
    write(join(runDir, secondRequest.artifacts.qa), JSON.stringify({
      schema_version: 1,
      status: 'PASS',
      content_qa_status: 'pass',
      style_qa_status: 'pass',
      brand_qa_status: 'pass',
      failed_gates: [],
      readable_text: ['边界'],
      residual_risk: 'none',
      reviewer: 'fixture-reviewer',
      reviewed_at: '2026-07-20T00:00:01.000Z'
    }, null, 2));
    assert.equal(runChildProvider(['finalize', secondPath]).status, 0);
    const acceptedHash = sha(join(runDir, secondRequest.artifacts.candidate));
    const thirdDispatch = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    assert.ok(thirdDispatch.generation_requests.some((path) => {
      const request = readJson(path);
      return request.platform === 'xiaohongshu' && request.anchor.image_id !== firstRequest.anchor.image_id;
    }));
    assert.equal(sha(join(runDir, secondRequest.artifacts.candidate)), acceptedHash);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('set QA retries only named images, preserves frozen hashes, orders bundles, and keeps 22 bindings', () => {
  const counts = { wechat: 1, xiaohongshu: 4, zhihu: 1, weibo: 1, toutiao: 1 };
  const { runDir } = fixture({ bounded: true, counts });
  try {
    const plans = createPlans(runDir, { counts });
    const decision = createDecision(runDir);
    assert.equal(run('set-gate.mjs', [
      runDir, 'visual', 'approved', '--decision', decision,
      ...plans.flatMap((path) => ['--artifact', path])
    ]).status, 0);
    for (const platform of platforms) {
      assert.equal(run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]).status, 0);
    }
    assert.equal(run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'runtime-native']).status, 0);
    assert.equal(run('illustration-queue.mjs', [runDir, 'init']).status, 0);

    let failedOnce = false;
    let frozenCanaryHash = null;
    for (let cycle = 0; cycle < 30; cycle += 1) {
      const dispatched = run('illustration-queue.mjs', [runDir, 'dispatch']);
      assert.equal(dispatched.status, 0, dispatched.stderr || dispatched.stdout);
      const output = JSON.parse(dispatched.stdout);
      for (const requestPath of output.generation_requests) {
        const request = readJson(requestPath);
        if (request.mode !== 'generate_image') continue;
        completeChild(runDir, requestPath);
        if (request.platform === 'xiaohongshu' && request.anchor.image_id === '01-boundary') {
          frozenCanaryHash = sha(join(runDir, request.artifacts.candidate));
        }
      }
      for (const requestPath of output.qa_requests) {
        const request = readJson(requestPath);
        if (request.platform === 'xiaohongshu' && !failedOnce) {
          completeSetQa(runDir, requestPath, { failedImageIds: ['02-flow'] });
          failedOnce = true;
        } else {
          completeSetQa(runDir, requestPath);
        }
      }
      if (platforms.every((platform) => existsSync(join(runDir, `07-visual/${platform}/bundle.json`)))) break;
    }
    assert.equal(failedOnce, true);
    assert.ok(frozenCanaryHash);
    const queue = readJson(join(runDir, '07-visual/generation-queue.json'));
    assert.equal(queue.suites.xiaohongshu.children['01-boundary'].attempts.length, 1);
    assert.equal(queue.suites.xiaohongshu.children['02-flow'].attempts.length, 2);
    const canaryRequest = readJson(join(runDir, queue.suites.xiaohongshu.children['01-boundary'].attempts[0].request_path));
    assert.equal(sha(join(runDir, canaryRequest.artifacts.candidate)), frozenCanaryHash);
    const bundle = readJson(join(runDir, '07-visual/xiaohongshu/bundle.json'));
    assert.deepEqual(bundle.images.map((image) => image.image_id), [
      '01-boundary', '02-flow', '03-checklist', '04-detail-04'
    ]);
    assert.deepEqual(bundle.images.map((image) => image.generation_attempt), [1, 2, 1, 1]);

    const noRegeneration = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
    assert.ok(noRegeneration.generation_requests.every((path) => readJson(path).mode !== 'generate_image'));
    const coverArtifacts = createCover(runDir);
    assert.equal(run('illustration-queue.mjs', [runDir, 'dispatch']).status, 0);
    const visualArtifacts = platforms.flatMap((platform) => [
      `07-visual/${platform}/plan.json`, `07-visual/${platform}/shot-list.md`,
      `07-visual/${platform}/bundle.json`, `07-visual/${platform}/manifest.md`
    ]);
    visualArtifacts.push(...coverArtifacts);
    assert.equal(visualArtifacts.length, 22);
    const extraControl = join(runDir, '07-visual/xiaohongshu/children/extra/result.json');
    write(extraControl, '{}');
    const undeclared = run('set-stage.mjs', [
      runDir, 'visual', 'completed', ...visualArtifacts.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(undeclared.status, 2);
    assert.ok(JSON.parse(undeclared.stdout).issues.some((item) => item.code === 'undeclared_illustration_control'));
    rmSync(dirname(extraControl), { recursive: true, force: true });
    const completed = run('set-stage.mjs', [
      runDir, 'visual', 'completed', ...visualArtifacts.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('unlocalized Set QA failure blocks the suite instead of regenerating every image', () => {
  const counts = { wechat: 1, xiaohongshu: 4, zhihu: 1, weibo: 1, toutiao: 1 };
  const runDir = prepareBoundedVisual(counts);
  try {
    let target = null;
    for (let cycle = 0; cycle < 6 && !target; cycle += 1) {
      const output = JSON.parse(run('illustration-queue.mjs', [runDir, 'dispatch']).stdout);
      for (const requestPath of output.generation_requests) {
        if (readJson(requestPath).mode === 'generate_image') completeChild(runDir, requestPath);
      }
      for (const requestPath of output.qa_requests) {
        if (readJson(requestPath).platform === 'xiaohongshu') target = requestPath;
        else completeSetQa(runDir, requestPath);
      }
    }
    assert.ok(target);
    const request = readJson(target);
    write(join(runDir, request.review_path), JSON.stringify({
      schema_version: 1,
      status: 'FAILED',
      checks: {
        style_consistency: 'BLOCKED',
        color: 'BLOCKED',
        visual_density: 'BLOCKED',
        composition_duplication: 'BLOCKED',
        narrative_order: 'BLOCKED'
      },
      failed_image_ids: [],
      reasons: [],
      blocking_reason: null,
      reviewer: 'fixture-set-reviewer',
      reviewed_at: '2026-07-20T00:00:02.000Z'
    }, null, 2));
    const finalized = runSetQaProvider(['finalize', target]);
    assert.equal(finalized.status, 2);
    assert.equal(readJson(join(dirname(target), 'result.json')).status, 'BLOCKED');
    assert.equal(run('illustration-queue.mjs', [runDir, 'dispatch']).status, 0);
    const queue = readJson(join(runDir, '07-visual/generation-queue.json'));
    assert.equal(queue.suites.xiaohongshu.status, 'blocked');
    assert.equal(queue.suites.xiaohongshu.children['01-boundary'].attempts.length, 1);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});
