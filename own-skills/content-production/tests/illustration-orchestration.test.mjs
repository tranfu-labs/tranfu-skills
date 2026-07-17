import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
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

const skillDir = resolve(import.meta.dirname, '..');
const scriptsDir = join(skillDir, 'scripts');
const providerRoot = resolve(skillDir, 'skills', 'post-illustration-images');
const providerSkill = join(providerRoot, 'SKILL.md');
const providerScript = join(providerRoot, 'scripts', 'provider-contract.mjs');
const coverSkill = resolve(skillDir, 'skills', 'wechat-sketch-cover', 'SKILL.md');
const coverRoot = dirname(coverSkill);
const coverProviderScript = join(coverRoot, 'scripts', 'provider-contract.mjs');
const platforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
const imageCounts = { wechat: 2, xiaohongshu: 3, zhihu: 1, weibo: 2, toutiao: 1 };

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

function anchor(index) {
  const excerpts = [
    '跨系统写入前需要人工确认。',
    '自动化必须先确认系统边界。',
    '完成检查后再进入执行。'
  ];
  const number = String(index + 1).padStart(2, '0');
  return {
    image_id: `${number}-${['boundary', 'flow', 'checklist'][index]}`,
    placement: index === 0 ? 'after-introduction' : `after-section-${index + 1}`,
    source_excerpt: excerpts[index],
    core_meaning: ['自动化必须尊重系统边界。', '确认先于自动执行。', '检查通过后才能继续。'][index],
    structure: ['Decision tree', 'Process flow', 'Checklist'][index],
    visual_metaphor: ['一道门检查通行条件。', '流程箭头在确认节点等待。', '检查清单控制执行开关。'][index],
    main_action: ['流程在门前等待确认。', '箭头通过确认节点。', '逐项勾选后开启执行。'][index],
    suggested_elements: ['gate', 'workflow arrow', 'check mark'],
    short_labels: ['边界', '确认', '执行'],
    qa_risk: '模型可能画出多余品牌标记。'
  };
}

function fixture() {
  const runDir = mkdtempSync(join(tmpdir(), 'content-production-illustration-'));
  const selections = platforms.map((platform) => {
    const draftPath = `05-platforms/${platform}/A/final.md`;
    write(join(runDir, draftPath), `# ${platform} final\n\n跨系统写入前需要人工确认。\n\n自动化必须先确认系统边界。\n\n完成检查后再进入执行。`);
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
    capabilities: {
      status: 'PASS',
      providers: {
        illustration: {
          status: 'PASS',
          contract: 'illustration-v1',
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
  return { runDir, selections };
}

function createPlans(runDir) {
  const artifacts = [];
  for (const platform of platforms) {
    const built = run('create-illustration-request.mjs', [
      runDir, 'plan', '--platform', platform,
      '--max-images', String(imageCounts[platform]), '--backend-hint', 'configured-api'
    ]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const requestPath = JSON.parse(built.stdout).request_path;
    const request = readJson(requestPath);
    const paths = request.expected_artifacts;
    const anchors = Array.from({ length: imageCounts[platform] }, (_, index) => anchor(index));
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
        kind: 'configured-api',
        adapter: 'runtime-configured-adapter',
        endpoint_source: 'active-runtime-config',
        resolved_model: 'gpt-image-2',
        artifact_format: 'png',
        credential_access: 'pass',
        model_check: 'pass',
        process_cleanup_plan: 'verify-request-process-exit',
        process_cleanup_status: 'not-run'
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

function createGeneration(runDir) {
  const coreArtifacts = [];
  for (const platform of platforms) {
    const built = run('create-illustration-request.mjs', [runDir, 'generate', '--platform', platform]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const requestPath = JSON.parse(built.stdout).request_path;
    const request = readJson(requestPath);
    const plan = readJson(join(runDir, request.inputs[2].path));
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
      copyFileSync(style.raster, join(runDir, finalFile));
      if (sourceFile) appendFileSync(join(runDir, finalFile), 'brand-overlay');
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
      plan: { path: request.inputs[2].path, sha256: request.inputs[2].sha256 },
      shot_list: { path: request.inputs[3].path, sha256: request.inputs[3].sha256 },
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
    coreArtifacts.push(request.inputs[2].path, request.inputs[3].path, bundlePath, manifestPath);
  }
  return coreArtifacts;
}

function createCover(runDir) {
  const built = run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'configured-api']);
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
    backend: { hint: 'configured-api', method: 'fixture-renderer', model: null },
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
        backend: { method: 'fixture-renderer', model: null },
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
      }
    ]);
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
    const decision = '07-visual/visual-decision.v001.json';
    write(join(runDir, decision), JSON.stringify({ status: 'APPROVED', attempt: 1 }, null, 2));
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
    const decision = '07-visual/visual-decision.v001.json';
    write(join(runDir, decision), JSON.stringify({ status: 'APPROVED', attempt: 1 }, null, 2));
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
    const planPath = join(runDir, '07-visual', 'wechat', 'plan.json');
    const plan = readJson(planPath);
    plan.residual_risk = 'low';
    write(planPath, JSON.stringify(plan, null, 2));
    const decision = '07-visual/visual-decision.v001.json';
    write(join(runDir, decision), JSON.stringify({ status: 'APPROVED', attempt: 1 }, null, 2));
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
    const decision = '07-visual/visual-decision.v001.json';
    write(join(runDir, decision), JSON.stringify({ status: 'APPROVED', attempt: 1 }, null, 2));
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
