import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { rasterInfo } from '../scripts/package-contracts.mjs';

const skillDir = resolve(import.meta.dirname, '..');
const scriptsDir = join(skillDir, 'scripts');
const compressionSkill = resolve(skillDir, 'skills', 'compress-image', 'SKILL.md');
const compressionRoot = dirname(compressionSkill);
const compressionProvider = join(compressionRoot, 'scripts', 'provider-contract.mjs');
const layoutSkill = resolve(skillDir, 'skills', 'format-content', 'SKILL.md');
const layoutRoot = dirname(layoutSkill);
const layoutProvider = join(layoutRoot, 'scripts', 'provider_contract.py');
const layoutWrapper = join(layoutRoot, 'scripts', 'wrap_preview.py');
const sharpModule = resolve(skillDir, '..', 'node_modules', 'sharp');
const rasterFixture = resolve(skillDir, 'skills', 'wechat-sketch-cover', 'assets', 'style-reference.png');
const platforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
const titleCounts = { wechat: 3, xiaohongshu: 5, zhihu: 3, weibo: 2, toutiao: 4 };

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

function bind(runDir, path) {
  return { path, sha256: sha(join(runDir, path)) };
}

function run(script, args = []) {
  return spawnSync(process.execPath, [join(scriptsDir, script), ...args], {
    cwd: skillDir,
    encoding: 'utf8'
  });
}

function runCompressionProvider(args = []) {
  return spawnSync(process.execPath, [compressionProvider, ...args], {
    cwd: compressionRoot,
    encoding: 'utf8'
  });
}

function runLayoutProvider(args = []) {
  return spawnSync('python3', [layoutProvider, ...args], {
    cwd: layoutRoot,
    encoding: 'utf8'
  });
}

function runLayoutWrapper(clean, preview) {
  return spawnSync('python3', [layoutWrapper, clean, preview], {
    cwd: layoutRoot,
    encoding: 'utf8'
  });
}

function validWechatLayoutClean(imageRef) {
  return `<section style="max-width:677px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;color:#374151;line-height:1.75;overflow-x:hidden;">
  <p style="font-size:15px;background:#FEE2E2;"><span leaf="">开场内容。</span></p>
  <p style="font-size:15px;"><span leaf="">wechat 的压缩锚点。</span></p>
  <section style="margin:20px 0;"><span leaf=""><img src="${imageRef}" alt="正文配图" style="max-width:100%;height:auto;display:block;margin:0 auto;"></span></section>
  <p style="font-size:15px;"><span leaf="">结尾内容。</span></p>
  <section style="text-align:center;margin:0 0 32px;"><section style="display:flex;align-items:center;justify-content:center;"><span style="height:2px;width:60px;background:linear-gradient(to right,transparent,#DC2626);"><span leaf=""><br></span></span><span style="font-size:11px;color:#DC2626;letter-spacing:3px;font-weight:700;"><span leaf="">END</span></span><span style="height:2px;width:60px;background:linear-gradient(to left,transparent,#DC2626);"><span leaf=""><br></span></span></section></section>
  <section style="padding:0 10px;"><p style="margin-bottom:20px;font-size:15px;line-height:1.8;text-align:justify;"><span leaf="">如果你觉得今天这篇有收获，欢迎</span><strong style="color:#DC2626;"><span leaf="">点赞、在看、转发</span></strong><span leaf="">三连，我们下篇见。</span></p></section>
</section>`;
}

function makeJpeg(source, target, { orientation = null } = {}) {
  const script = [
    `const sharp = require(${JSON.stringify(sharpModule)});`,
    `let image = sharp(${JSON.stringify(source)}).jpeg({ quality: 90 });`,
    orientation ? `image = image.withMetadata({ orientation: ${orientation} });` : '',
    `image.toFile(${JSON.stringify(target)})`,
    `.catch((error) => { console.error(error); process.exitCode = 1; });`
  ].join('');
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function makeOrientedRaster(source, target, format) {
  const script = [
    `const sharp = require(${JSON.stringify(sharpModule)});`,
    `sharp(${JSON.stringify(source)}).resize(40, 20).toFormat(${JSON.stringify(format)})`,
    `.withMetadata({ orientation: 6 }).toFile(${JSON.stringify(target)})`,
    `.catch((error) => { console.error(error); process.exitCode = 1; });`
  ].join('');
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function moveJpegExifAfterSof(path) {
  const input = readFileSync(path);
  const segments = [];
  let offset = 2;
  let tail = null;
  while (offset + 4 <= input.length) {
    assert.equal(input[offset], 0xff);
    const marker = input[offset + 1];
    if (marker === 0xda) {
      tail = input.subarray(offset);
      break;
    }
    const length = input.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    assert.ok(length >= 2 && end <= input.length);
    segments.push({ marker, bytes: input.subarray(offset, end) });
    offset = end;
  }
  const exifIndex = segments.findIndex((item) => item.marker === 0xe1
    && item.bytes.toString('ascii', 4, 10) === 'Exif\0\0');
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  assert.ok(exifIndex >= 0 && tail);
  const [exif] = segments.splice(exifIndex, 1);
  const sofIndex = segments.findIndex((item) => sof.has(item.marker));
  assert.ok(sofIndex >= 0);
  segments.splice(sofIndex + 1, 0, exif);
  writeFileSync(path, Buffer.concat([input.subarray(0, 2), ...segments.map((item) => item.bytes), tail]));
}

function sharpMetadata(path) {
  const script = [
    `const sharp = require(${JSON.stringify(sharpModule)});`,
    `sharp(${JSON.stringify(path)}).metadata()`,
    `.then((value) => process.stdout.write(JSON.stringify(value)))`,
    `.catch((error) => { console.error(error); process.exitCode = 1; });`
  ].join('');
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function fixture({ packageAttempt = 1, symlinkSource = false, orientedJpeg = false } = {}) {
  const runDir = mkdtempSync(join(tmpdir(), 'content-production-compression-'));
  const selections = [];
  const visualArtifacts = [];
  const visualBindings = [];

  for (const platform of platforms) {
    const variant = 'A';
    const excerpt = `${platform} 的压缩锚点。`;
    const draftPath = `05-platforms/${platform}/${variant}/final.md`;
    write(join(runDir, draftPath), `# ${platform} 工作标题\n\n开场内容。\n\n${excerpt}\n\n结尾内容。`);
    const selection = {
      platform,
      variant,
      title_id: `${platform}-${variant}-1`,
      title: platform === 'wechat'
        ? '我们为什么把模拟面试做成了一个复盘工作台？'
        : `${platform} 入选标题`,
      topic_phrase: platform === 'weibo' ? '#自动化边界#' : null,
      draft_path: draftPath,
      draft_sha256: sha(join(runDir, draftPath)),
      decision_rule: 'reviewed-choice'
    };
    selections.push(selection);

    const base = `07-visual/${platform}`;
    const sourceFormat = platform === 'weibo' ? 'jpeg' : 'png';
    const imagePath = `${base}/images/01-main.${sourceFormat === 'jpeg' ? 'jpg' : 'png'}`;
    mkdirSync(dirname(join(runDir, imagePath)), { recursive: true });
    if (symlinkSource && platform === 'weibo') {
      const outside = join(runDir, 'outside.jpg');
      makeJpeg(rasterFixture, outside);
      symlinkSync(outside, join(runDir, imagePath));
    } else if (sourceFormat === 'jpeg') {
      makeJpeg(rasterFixture, join(runDir, imagePath), { orientation: orientedJpeg ? 6 : null });
    } else {
      copyFileSync(rasterFixture, join(runDir, imagePath));
    }
    const planPath = `${base}/plan.json`;
    const shotPath = `${base}/shot-list.md`;
    const bundlePath = `${base}/bundle.json`;
    const nativeManifestPath = `${base}/manifest.md`;
    write(join(runDir, planPath), JSON.stringify({
      schema_version: 1,
      status: 'READY',
      platform,
      variant,
      anchors: [{
        image_id: '01-main',
        source_excerpt: excerpt,
        core_meaning: `${platform} 正文配图`
      }]
    }, null, 2));
    write(join(runDir, shotPath), `# ${platform} Shot List\n\n- 01-main`);
    write(join(runDir, bundlePath), JSON.stringify({
      schema_version: 1,
      status: 'PASS',
      platform,
      variant,
      selection,
      plan: bind(runDir, planPath),
      image_count: 1,
      images: [{
        image_id: '01-main',
        file: imagePath,
        file_sha256: sha(join(runDir, imagePath)),
        delivery_dimensions: orientedJpeg && platform === 'weibo'
          ? { width: 818, height: 1923 }
          : { width: 1923, height: 818 },
        delivery_artifact: { format: sourceFormat, bytes: statSync(join(runDir, imagePath)).size }
      }]
    }, null, 2));
    write(join(runDir, nativeManifestPath), `platform: ${platform}\nimage_id: 01-main`);
    visualArtifacts.push(planPath, shotPath, bundlePath, nativeManifestPath);
    visualBindings.push(planPath, shotPath);
  }

  write(join(runDir, '06-selection', 'titles.json'), '{}');
  write(join(runDir, '06-selection', 'title-matrix.md'), '# Title Matrix');
  const decisionPath = '06-selection/selection.v001.json';
  write(join(runDir, decisionPath), JSON.stringify({
    schema_version: 1,
    revision: 1,
    status: 'PROPOSED',
    titles_path: '06-selection/titles.json',
    titles_sha256: sha(join(runDir, '06-selection', 'titles.json')),
    decision_rule: 'reviewed-choice',
    selections
  }, null, 2));

  const coverPath = '07-visual/wechat-cover/cover.png';
  const coverMetadataPath = '07-visual/wechat-cover/cover.json';
  mkdirSync(dirname(join(runDir, coverPath)), { recursive: true });
  copyFileSync(rasterFixture, join(runDir, coverPath));
  write(join(runDir, coverMetadataPath), JSON.stringify({
    schema_version: 1,
    contract: 'wechat-cover-v1',
    status: 'PASS',
    attempt: 1,
    platform: 'wechat',
    variant: 'A',
    selection: selections[0],
    cover: {
      path: coverPath,
      sha256: sha(join(runDir, coverPath)),
      format: 'png',
      width: 1923,
      height: 818
    },
    residual_risk: 'none'
  }, null, 2));
  visualArtifacts.push(coverPath, coverMetadataPath);

  for (const platform of platforms) mkdirSync(join(runDir, '08-publish-pack', platform, 'images'), { recursive: true });
  const state = {
    schema_version: 2,
    run_id: 'fixture-run',
    run_mode: 'autonomous',
    status: 'running',
    current_stage: 'package',
    capabilities: {
      config_path: join(skillDir, 'capabilities.yaml'),
      status: 'PASS',
      providers: {
        image_compression: {
          status: 'PASS',
          contract: 'image-compression-v1',
          skill_path: compressionSkill,
          skill_sha256: sha(compressionSkill)
        }
      }
    },
    stages: {
      titles: { status: 'completed', attempt: 1, artifacts: [] },
      visual: {
        status: 'completed',
        attempt: 1,
        artifacts: visualArtifacts.map((path) => bind(runDir, path))
      },
      package: { status: 'running', attempt: packageAttempt, artifacts: [] },
      final_qa: { status: 'pending', attempt: 0, artifacts: [] }
    },
    gates: {
      titles: {
        status: 'approved',
        revision: 1,
        decision_ref: bind(runDir, decisionPath),
        bound_artifacts: [
          bind(runDir, '06-selection/titles.json'),
          bind(runDir, '06-selection/title-matrix.md'),
          bind(runDir, decisionPath)
        ]
      },
      visual: {
        status: 'approved',
        revision: 1,
        decision_ref: null,
        bound_artifacts: visualBindings.map((path) => bind(runDir, path))
      },
      final: { status: 'pending', revision: 0, decision_ref: null, bound_artifacts: [] }
    },
    platform_selections: Object.fromEntries(selections.map((item) => [item.platform, item])),
    invalidations: [],
    history: []
  };
  write(join(runDir, 'run.json'), JSON.stringify(state, null, 2));
  return { runDir, selections };
}

function installValidTitles(runDir, selections) {
  const labels = { wechat: '公众号', xiaohongshu: '小红书', zhihu: '知乎', weibo: '微博', toutiao: '头条' };
  const selectionByPlatform = Object.fromEntries(selections.map((item) => [item.platform, item]));
  const titlePlatforms = {};
  for (const platform of platforms) {
    titlePlatforms[platform] = {};
    for (const variant of ['A', 'B']) {
      const draftPath = `05-platforms/${platform}/${variant}/final.md`;
      if (variant === 'B') write(join(runDir, draftPath), `# ${labels[platform]} B 稿\n\n开场内容。\n\nB 稿正文。`);
      const selection = selectionByPlatform[platform];
      const candidates = Array.from({ length: titleCounts[platform] }, (_, index) => {
        const selected = variant === selection.variant && index === 0;
        return {
          id: `${platform}-${variant}-${index + 1}`,
          title: selected ? selection.title : `${labels[platform]}${variant}候选标题${index + 1}`,
          rank: index + 1,
          strategy_id: 'VALUE_FIRST',
          recommended: index < Math.min(3, titleCounts[platform]),
          promise_map: ['开场内容'],
          promise_status: 'PASS',
          risk: 'none',
          topic_phrase: platform === 'weibo'
            ? selected ? selection.topic_phrase : `#自动化边界${variant}${index + 1}#`
            : null
        };
      });
      titlePlatforms[platform][variant] = {
        draft_path: draftPath,
        draft_sha256: sha(join(runDir, draftPath)),
        candidates
      };
    }
  }
  const titlesPath = join(runDir, '06-selection', 'titles.json');
  write(titlesPath, JSON.stringify({ schema_version: 1, status: 'PASS', platforms: titlePlatforms }, null, 2));
  const decisionPath = join(runDir, '06-selection', 'selection.v001.json');
  const decision = readJson(decisionPath);
  decision.titles_sha256 = sha(titlesPath);
  write(decisionPath, JSON.stringify(decision, null, 2));
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.gates.titles.decision_ref = bind(runDir, '06-selection/selection.v001.json');
  state.gates.titles.bound_artifacts = [
    bind(runDir, '06-selection/titles.json'),
    bind(runDir, '06-selection/title-matrix.md'),
    bind(runDir, '06-selection/selection.v001.json')
  ];
  write(statePath, JSON.stringify(state, null, 2));
}

function installLayoutCapability(runDir) {
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.capabilities.providers.wechat_layout = {
    status: 'PASS',
    contract: 'wechat-layout-v1',
    skill_path: layoutSkill,
    skill_sha256: sha(layoutSkill)
  };
  write(statePath, JSON.stringify(state, null, 2));
}

test('raster metadata normalizes EXIF display dimensions for PNG, JPEG, and WebP', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'content-production-raster-'));
  try {
    for (const [format, extension] of [['png', 'png'], ['jpeg', 'jpg'], ['webp', 'webp']]) {
      const target = join(directory, `oriented.${extension}`);
      makeOrientedRaster(rasterFixture, target, format);
      const info = await rasterInfo(target);
      assert.deepEqual(
        { format: info.format, width: info.width, height: info.height },
        { format, width: 20, height: 40 }
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('JPEG display dimensions honor an EXIF segment after SOF', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'content-production-late-exif-'));
  try {
    const target = join(directory, 'oriented.jpg');
    makeOrientedRaster(rasterFixture, target, 'jpeg');
    moveJpegExifAfterSof(target);
    assert.equal(sharpMetadata(target).orientation, 6);
    const info = await rasterInfo(target);
    assert.deepEqual(
      { format: info.format, width: info.width, height: info.height },
      { format: 'jpeg', width: 20, height: 40 }
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('compression request builder derives one body task per bundle image plus the WeChat cover', () => {
  const { runDir } = fixture();
  try {
    const result = run('create-compression-requests.mjs', [runDir]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'PASS');
    assert.equal(output.task_count, 6);
    assert.equal(output.request_paths.length, 6);
    assert.equal(relative(runDir, output.plan_path), '08-publish-pack/_compression/compression-plan.json');

    const wechatRequestPath = output.request_paths.find((path) => path.includes('/wechat/01-main/'));
    const wechatRequest = readJson(wechatRequestPath);
    assert.equal(wechatRequest.task_id, 'image-compression:fixture-run:wechat:A:01-main:package-001');
    assert.equal(wechatRequest.mode, 'compress_one');
    assert.equal(wechatRequest.asset_kind, 'body_image');
    assert.deepEqual(wechatRequest.inputs, [{
      role: 'source_image',
      path: '07-visual/wechat/images/01-main.png',
      sha256: sha(join(runDir, '07-visual/wechat/images/01-main.png'))
    }]);
    assert.deepEqual(wechatRequest.expected_artifacts, [
      '08-publish-pack/_compression/wechat/01-main/candidate.webp'
    ]);
    assert.deepEqual(wechatRequest.options, {
      format: 'webp',
      quality: 80,
      lossless: false,
      preserve_source: true,
      preserve_display_dimensions: true,
      selection_policy: 'strictly-smaller-else-source'
    });
    const coverRequest = readJson(output.request_paths.find((path) => path.includes('/wechat/wechat-cover/')));
    assert.equal(coverRequest.asset_id, 'wechat-cover');
    assert.equal(coverRequest.asset_kind, 'wechat_cover');
    assert.deepEqual(coverRequest.expected_artifacts, [
      '08-publish-pack/_compression/wechat/wechat-cover/candidate.png'
    ]);
    assert.deepEqual(coverRequest.options, {
      format: 'png',
      quality: null,
      lossless: true,
      preserve_source: true,
      preserve_display_dimensions: true,
      selection_policy: 'strictly-smaller-else-source'
    });
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('compression request builder versions package controls and rejects symlinked visual sources', () => {
  const versioned = fixture({ packageAttempt: 2 });
  try {
    const result = run('create-compression-requests.mjs', [versioned.runDir]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(relative(versioned.runDir, output.plan_path), '08-publish-pack/_compression/v002/compression-plan.json');
    assert.ok(output.request_paths.every((path) => path.includes('/_compression/v002/')));
  } finally {
    rmSync(versioned.runDir, { recursive: true, force: true });
  }

  const unsafe = fixture({ symlinkSource: true });
  try {
    assert.equal(lstatSync(join(unsafe.runDir, '07-visual/weibo/images/01-main.jpg')).isSymbolicLink(), true);
    const result = run('create-compression-requests.mjs', [unsafe.runDir]);
    assert.equal(result.status, 2);
    assert.ok(JSON.parse(result.stdout).blockers.some((item) => item.code === 'compression_source_unsafe'));
  } finally {
    rmSync(unsafe.runDir, { recursive: true, force: true });
  }

  const linkedParent = fixture();
  try {
    const visualRoot = join(linkedParent.runDir, '07-visual', 'weibo');
    renameSync(join(visualRoot, 'images'), join(visualRoot, 'real-images'));
    symlinkSync('real-images', join(visualRoot, 'images'), 'dir');
    const result = run('create-compression-requests.mjs', [linkedParent.runDir]);
    assert.equal(result.status, 2);
    assert.ok(JSON.parse(result.stdout).blockers.some((item) => item.code === 'compression_source_unsafe'));
  } finally {
    rmSync(linkedParent.runDir, { recursive: true, force: true });
  }

  for (const target of ['request', 'plan']) {
    const dangling = fixture();
    try {
      const base = join(dangling.runDir, '08-publish-pack', '_compression');
      mkdirSync(join(base, 'wechat', '01-main'), { recursive: true });
      const path = target === 'request'
        ? join(base, 'wechat', '01-main', 'compression.request.json')
        : join(base, 'compression-plan.json');
      symlinkSync('missing-target.json', path);
      const result = run('create-compression-requests.mjs', [dangling.runDir]);
      assert.equal(result.status, 2);
      assert.equal(lstatSync(path).isSymbolicLink(), true);
    } finally {
      rmSync(dangling.runDir, { recursive: true, force: true });
    }
  }
});

test('reopening a completed package versions compression work and invalidates only final QA', () => {
  const { runDir, selections } = fixture();
  try {
    const statePath = join(runDir, 'run.json');
    const state = readJson(statePath);
    state.stages.package = { status: 'completed', attempt: 1, artifacts: [], error: null };
    state.stages.final_qa = { status: 'completed', attempt: 1, artifacts: [], error: null };
    state.gates.final = { status: 'approved', revision: 1, decision_ref: null, bound_artifacts: [] };
    state.current_stage = 'final_qa';
    write(statePath, JSON.stringify(state, null, 2));

    const reopened = run('set-stage.mjs', [runDir, 'package', 'running']);
    assert.equal(reopened.status, 0, reopened.stderr || reopened.stdout);
    const current = readJson(statePath);
    assert.equal(current.stages.package.attempt, 2);
    assert.equal(current.stages.final_qa.status, 'pending');
    assert.equal(current.gates.final.status, 'pending');
    assert.equal(current.gates.visual.status, 'approved');
    assert.equal(current.gates.titles.status, 'approved');
    assert.deepEqual(current.platform_selections, Object.fromEntries(selections.map((item) => [item.platform, item])));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('a hashed compression provider cannot complete package through the legacy path without a plan', () => {
  const { runDir } = fixture();
  try {
    const result = run('set-stage.mjs', [
      runDir,
      'package',
      'completed',
      '--artifact',
      join(runDir, '07-visual', 'wechat', 'plan.json')
    ]);
    assert.equal(result.status, 2);
    assert.ok(JSON.parse(result.stdout).issues.some((item) => item.code === 'invalid_compression_plan'));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }


  const malformed = fixture();
  try {
    const statePath = join(malformed.runDir, 'run.json');
    const state = readJson(statePath);
    delete state.capabilities.providers.image_compression.skill_path;
    write(statePath, JSON.stringify(state, null, 2));
    const result = run('set-stage.mjs', [
      malformed.runDir,
      'package',
      'completed',
      '--artifact',
      join(malformed.runDir, '07-visual', 'wechat', 'plan.json')
    ]);
    assert.equal(result.status, 2);
    assert.ok(JSON.parse(result.stdout).issues.some((item) => item.code === 'compression_provider_unavailable'));
  } finally {
    rmSync(malformed.runDir, { recursive: true, force: true });
  }
});

test('provider candidates assemble five publish packs and a larger candidate falls back to source bytes', () => {
  const { runDir, selections } = fixture({ orientedJpeg: true });
  try {
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    const planOutput = JSON.parse(planned.stdout);
    for (const requestPath of planOutput.request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }

    const fallbackRequestPath = planOutput.request_paths.find((path) => path.includes('/weibo/01-main/'));
    const fallbackRequest = readJson(fallbackRequestPath);
    const fallbackResultPath = join(dirname(fallbackRequestPath), 'compression.result.json');
    const fallbackCandidatePath = join(runDir, fallbackRequest.expected_artifacts[0]);
    const fallbackSourcePath = join(runDir, fallbackRequest.inputs[0].path);
    const padded = Buffer.concat([
      readFileSync(fallbackCandidatePath),
      Buffer.alloc(statSync(fallbackSourcePath).size + 1024)
    ]);
    writeFileSync(fallbackCandidatePath, padded);
    const fallbackResult = readJson(fallbackResultPath);
    fallbackResult.artifacts[0].sha256 = sha(fallbackCandidatePath);
    fallbackResult.compression.candidate.sha256 = sha(fallbackCandidatePath);
    fallbackResult.compression.candidate.bytes = padded.length;
    fallbackResult.compression.saved_bytes = statSync(fallbackSourcePath).size - padded.length;
    fallbackResult.compression.saved_percent = Math.round(
      (fallbackResult.compression.saved_bytes / statSync(fallbackSourcePath).size) * 10000
    ) / 100;
    fallbackResult.compression.recommended_selection = 'source';
    fallbackResult.warnings = [];
    write(fallbackResultPath, JSON.stringify(fallbackResult, null, 2));
    const missingWarning = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(missingWarning.status, 2);
    assert.ok(JSON.parse(missingWarning.stdout).issues.some((item) => item.code === 'invalid_compression_result'));

    fallbackResult.warnings = [{
      code: 'compression_candidate_not_smaller',
      message: 'Candidate is not smaller; retain source for publication.'
    }];
    write(fallbackResultPath, JSON.stringify(fallbackResult, null, 2));

    const assembled = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout);
    const output = JSON.parse(assembled.stdout);
    assert.equal(output.status, 'PASS');
    assert.equal(output.package_attempt, 1);
    assert.equal(output.artifacts.length, 26);

    for (const selection of selections) {
      const platform = selection.platform;
      const pack = join(runDir, '08-publish-pack', platform);
      const manifest = readJson(join(runDir, '07-visual', platform, 'manifest.json'));
      const optimization = readJson(join(pack, 'optimization.json'));
      const metadata = readJson(join(pack, 'metadata.json'));
      const markdown = readFileSync(join(pack, 'final.md'), 'utf8');
      assert.match(markdown, new RegExp(`^# ${selection.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
      assert.equal(manifest.schema_version, 2);
      assert.equal(manifest.items.length, 1);
      assert.equal(optimization.schema_version, 2);
      assert.equal(optimization.items.length, 1);
      assert.equal(metadata.manifest.sha256, sha(join(runDir, '07-visual', platform, 'manifest.json')));
      assert.ok(markdown.includes(`](${manifest.items[0].markdown_ref})`));
      assert.equal(optimization.cover === null, platform !== 'wechat');
    }

    const weiboOptimization = readJson(join(runDir, '08-publish-pack', 'weibo', 'optimization.json'));
    assert.equal(weiboOptimization.items[0].selection, 'source');
    assert.equal(weiboOptimization.items[0].reason, 'candidate_not_smaller');
    assert.equal(weiboOptimization.items[0].publish.format, 'jpeg');
    assert.match(weiboOptimization.items[0].publish.path, /\.jpg$/);
    assert.equal(
      weiboOptimization.items[0].publish.sha256,
      sha(join(runDir, '07-visual', 'weibo', 'images', '01-main.jpg'))
    );
    assert.equal(
      sha(join(runDir, weiboOptimization.items[0].publish.path)),
      weiboOptimization.items[0].publish.sha256
    );

    const wechatOptimization = readJson(join(runDir, '08-publish-pack', 'wechat', 'optimization.json'));
    assert.equal(wechatOptimization.cover.asset_id, 'wechat-cover');
    assert.equal(wechatOptimization.cover.publish.path, '08-publish-pack/wechat/cover.png');
    assert.equal(wechatOptimization.cover.publish.format, 'png');
    assert.deepEqual(
      [wechatOptimization.cover.publish.width, wechatOptimization.cover.publish.height],
      [1923, 818]
    );

    const premature = run('set-stage.mjs', [
      runDir, 'package', 'completed',
      ...output.artifacts.flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(premature.status, 2);
    assert.ok(JSON.parse(premature.stdout).issues.some((item) => item.code === 'invalid_package_artifact_binding'));

    const repeated = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('a current WeChat layout provider rejects arbitrary files that only satisfy package existence checks', () => {
  const { runDir } = fixture();
  try {
    installLayoutCapability(runDir);
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    for (const requestPath of JSON.parse(planned.stdout).request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }
    const assembled = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout);
    const packageArtifacts = JSON.parse(assembled.stdout).artifacts;
    const layoutArtifacts = [
      '08-publish-pack/wechat/article.html',
      '08-publish-pack/wechat/article-preview.html',
      '08-publish-pack/wechat/layout-result.json'
    ];
    write(join(runDir, layoutArtifacts[0]), '<section><p><span leaf="">占位排版</span></p></section>');
    write(join(runDir, layoutArtifacts[1]), '<html><body>占位预览</body></html>');
    write(join(runDir, layoutArtifacts[2]), JSON.stringify({ status: 'PASS' }));

    const completed = run('set-stage.mjs', [
      runDir, 'package', 'completed',
      ...[...packageArtifacts, ...layoutArtifacts].flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(completed.status, 2);
    assert.ok(JSON.parse(completed.stdout).issues.some((item) =>
      ['invalid_wechat_layout_request', 'invalid_wechat_layout_result', 'wechat_layout_provider_unavailable']
        .includes(item.code)));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('WeChat layout request binds the current publish inputs and all fixed child resources', () => {
  const { runDir } = fixture();
  try {
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    for (const requestPath of JSON.parse(planned.stdout).request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }
    const assembled = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout);

    const unavailable = run('create-wechat-layout-request.mjs', [runDir]);
    assert.equal(unavailable.status, 2);
    assert.ok(JSON.parse(unavailable.stdout).blockers.some((item) =>
      item.code === 'wechat_layout_provider_unavailable'));

    installLayoutCapability(runDir);
    const created = run('create-wechat-layout-request.mjs', [runDir]);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    const output = JSON.parse(created.stdout);
    assert.equal(output.status, 'PASS');
    assert.equal(relative(runDir, output.request_path), '08-publish-pack/_layout/wechat-layout.request.json');
    const request = readJson(output.request_path);
    assert.deepEqual(Object.keys(request), [
      'schema_version', 'contract', 'task_id', 'capability', 'provider_contract',
      'run_dir', 'run_mode', 'mode', 'attempt', 'platform', 'variant', 'inputs',
      'output_dir', 'expected_artifacts', 'options', 'interaction_policy'
    ]);
    assert.equal(request.task_id, 'wechat-layout:fixture-run:wechat:A:package-001');
    assert.equal(request.mode, 'format_wechat');
    assert.deepEqual(request.inputs, [
      bind(runDir, '08-publish-pack/wechat/final.md'),
      bind(runDir, '07-visual/wechat/manifest.json')
    ].map((item, index) => ({
      role: index === 0 ? 'source_markdown' : 'publish_manifest',
      ...item
    })));
    assert.deepEqual(request.expected_artifacts, [
      '08-publish-pack/_layout/staging/article.html',
      '08-publish-pack/_layout/staging/article-preview.html'
    ]);
    assert.deepEqual(Object.keys(request.options.resource_bindings), [
      'skill', 'theme', 'common_components', 'validator', 'wrapper',
      'preview_template', 'provider_script'
    ]);
    assert.deepEqual(
      Object.fromEntries(Object.entries(request.options.resource_bindings).map(([key, value]) => [key, value.path])),
      {
        skill: 'SKILL.md',
        theme: 'references/theme-red-white.md',
        common_components: 'references/common-components.md',
        validator: 'scripts/validate_gzh_html.py',
        wrapper: 'scripts/wrap_preview.py',
        preview_template: 'assets/preview-template.html',
        provider_script: 'scripts/provider_contract.py'
      }
    );
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('child layout finalize and total promotion complete the exact N+24 package contract', () => {
  const { runDir } = fixture();
  try {
    installLayoutCapability(runDir);
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    for (const requestPath of JSON.parse(planned.stdout).request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }
    const assembled = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout);
    const packageArtifacts = JSON.parse(assembled.stdout).artifacts;

    const created = run('create-wechat-layout-request.mjs', [runDir]);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    const requestPath = JSON.parse(created.stdout).request_path;
    const validated = runLayoutProvider(['validate-request', requestPath]);
    assert.equal(validated.status, 0, validated.stderr || validated.stdout);
    const manifest = readJson(join(runDir, '07-visual/wechat/manifest.json'));
    write(
      join(runDir, '08-publish-pack/_layout/staging/article.html'),
      validWechatLayoutClean(manifest.items[0].markdown_ref)
    );
    const finalized = runLayoutProvider(['finalize', requestPath]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    assert.equal(JSON.parse(finalized.stdout).status, 'PASS');

    const promoted = run('promote-wechat-layout.mjs', [runDir]);
    assert.equal(promoted.status, 0, promoted.stderr || promoted.stdout);
    const promotedOutput = JSON.parse(promoted.stdout);
    assert.deepEqual(promotedOutput.artifacts, [
      '08-publish-pack/wechat/article.html',
      '08-publish-pack/wechat/article-preview.html',
      '08-publish-pack/wechat/layout-result.json'
    ]);
    const layout = readJson(join(runDir, '08-publish-pack/wechat/layout-result.json'));
    assert.equal(layout.schema_version, 2);
    assert.equal(layout.status, 'PASS');
    assert.equal(layout.validation.validator_errors, 0);
    assert.equal(layout.validation.validator_warnings, 0);
    assert.equal(layout.validation.source_blocks_in_order, true);
    assert.equal(layout.validation.manifest_images_exact, true);
    assert.equal(layout.validation.preview_embedding_byte_identical, true);

    const repeated = run('promote-wechat-layout.mjs', [runDir]);
    assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);

    const completed = run('set-stage.mjs', [
      runDir, 'package', 'completed',
      ...[...packageArtifacts, ...promotedOutput.artifacts].flatMap((path) => ['--artifact', path])
    ]);
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
    const state = readJson(join(runDir, 'run.json'));
    assert.equal(state.stages.package.status, 'completed');
    assert.equal(state.stages.package.artifacts.length, packageArtifacts.length + 3);

    const verified = run('verify-run.mjs', [runDir]);
    assert.equal(verified.status, 2);
    const verificationIssues = JSON.parse(verified.stdout).issues;
    assert.equal(verificationIssues.some((item) => /layout|wechat_html|html_body/i.test(item.code)), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('total promotion independently rejects hidden body text after a forged provider artifact update', () => {
  const { runDir } = fixture();
  try {
    installLayoutCapability(runDir);
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    for (const requestPath of JSON.parse(planned.stdout).request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }
    assert.equal(run('assemble-publish-packs.mjs', [runDir]).status, 0);
    const created = run('create-wechat-layout-request.mjs', [runDir]);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    const requestPath = JSON.parse(created.stdout).request_path;
    const manifest = readJson(join(runDir, '07-visual/wechat/manifest.json'));
    const cleanPath = join(runDir, '08-publish-pack/_layout/staging/article.html');
    const previewPath = join(runDir, '08-publish-pack/_layout/staging/article-preview.html');
    const resultPath = join(runDir, '08-publish-pack/_layout/wechat-layout.result.json');
    write(cleanPath, validWechatLayoutClean(manifest.items[0].markdown_ref));
    const finalized = runLayoutProvider(['finalize', requestPath]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);

    write(
      cleanPath,
      readFileSync(cleanPath, 'utf8').replace(
        '<p style="font-size:15px;"><span leaf="">结尾内容。</span></p>',
        '<p style="font-size:15px;"><span style="display:none"><span leaf="">结尾内容。</span></span></p>'
      )
    );
    const wrapped = runLayoutWrapper(cleanPath, previewPath);
    assert.equal(wrapped.status, 0, wrapped.stderr || wrapped.stdout);
    const forged = readJson(resultPath);
    forged.artifacts[0].sha256 = sha(cleanPath);
    forged.artifacts[1].sha256 = sha(previewPath);
    write(resultPath, JSON.stringify(forged, null, 2));

    const promoted = run('promote-wechat-layout.mjs', [runDir]);
    assert.equal(promoted.status, 2);
    assert.ok(JSON.parse(promoted.stdout).issues.some((item) =>
      item.code === 'unsafe_wechat_layout_html'));
    assert.equal(existsSync(join(runDir, '08-publish-pack/wechat/article.html')), false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('package attempt two isolates layout controls and business files under v002 paths', () => {
  const { runDir } = fixture({ packageAttempt: 2 });
  try {
    installLayoutCapability(runDir);
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    for (const requestPath of JSON.parse(planned.stdout).request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }
    const assembled = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout);
    const created = run('create-wechat-layout-request.mjs', [runDir]);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    const requestPath = JSON.parse(created.stdout).request_path;
    assert.equal(relative(runDir, requestPath), '08-publish-pack/_layout/v002/wechat-layout.request.json');

    const legacyClean = join(runDir, '08-publish-pack/wechat/article.html');
    write(legacyClean, 'attempt-one-sentinel');
    const manifest = readJson(join(runDir, '07-visual/wechat/manifest.v002.json'));
    write(
      join(runDir, '08-publish-pack/_layout/v002/staging/article.html'),
      validWechatLayoutClean(manifest.items[0].markdown_ref)
    );
    const finalized = runLayoutProvider(['finalize', requestPath]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    const promoted = run('promote-wechat-layout.mjs', [runDir]);
    assert.equal(promoted.status, 0, promoted.stderr || promoted.stdout);
    assert.deepEqual(JSON.parse(promoted.stdout).artifacts, [
      '08-publish-pack/wechat/article.v002.html',
      '08-publish-pack/wechat/article-preview.v002.html',
      '08-publish-pack/wechat/layout-result.v002.json'
    ]);
    assert.equal(readFileSync(legacyClean, 'utf8'), 'attempt-one-sentinel\n');
    const layout = readJson(join(runDir, '08-publish-pack/wechat/layout-result.v002.json'));
    assert.equal(layout.package_attempt, 2);
    assert.equal(layout.source_markdown.path, '08-publish-pack/wechat/final.v002.md');
    assert.equal(layout.manifest.path, '07-visual/wechat/manifest.v002.json');
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('provider package final QA accepts schema v2 lineage and writes current v002 handoff paths', () => {
  const { runDir, selections } = fixture({ packageAttempt: 2 });
  try {
    installValidTitles(runDir, selections);
    const planned = run('create-compression-requests.mjs', [runDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    for (const requestPath of JSON.parse(planned.stdout).request_paths) {
      const executed = runCompressionProvider(['execute', requestPath]);
      assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    }
    const assembled = run('assemble-publish-packs.mjs', [runDir]);
    assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout);

    const verified = run('verify-run.mjs', [runDir]);
    assert.equal(verified.status, 2);
    const qa = JSON.parse(verified.stdout);
    assert.equal(qa.issues.some((item) => item.code === 'manifest_lineage_mismatch'), false);
    const handoff = readFileSync(join(runDir, '09-qa', 'handoff.md'), 'utf8');
    assert.match(handoff, /08-publish-pack\/<platform>\/images\/v002\//);
    assert.match(handoff, /08-publish-pack\/wechat\/cover\.v002\.png/);
    assert.match(handoff, /08-publish-pack\/wechat\/article\.v002\.html/);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});
