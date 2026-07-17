import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateWechatCover } from '../scripts/wechat-cover-contracts.mjs';

const skillDir = resolve(import.meta.dirname, '..');
const scriptsDir = join(skillDir, 'scripts');
const coverSkill = resolve(skillDir, 'skills', 'wechat-sketch-cover', 'SKILL.md');
const coverRoot = dirname(coverSkill);
const coverProviderScript = join(coverRoot, 'scripts', 'provider-contract.mjs');
const platforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];

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

function runCoverProvider(args = []) {
  return spawnSync(process.execPath, [coverProviderScript, ...args], {
    cwd: coverRoot,
    encoding: 'utf8'
  });
}

function fixture({ title = '我们为什么把模拟面试做成了一个复盘工作台？', attempt = 1, visualApproved = true } = {}) {
  const runDir = mkdtempSync(join(tmpdir(), 'content-production-cover-'));
  const selections = platforms.map((platform) => {
    const variant = 'A';
    const draftPath = `05-platforms/${platform}/${variant}/final.md`;
    write(join(runDir, draftPath), `# ${platform} 工作标题\n\n跨系统写入前需要人工确认。`);
    return {
      platform,
      variant,
      title_id: `${platform}-${variant}-1`,
      title: platform === 'wechat' ? title : `${platform} 已选标题`,
      topic_phrase: platform === 'weibo' ? '#自动化边界#' : null,
      draft_path: draftPath,
      draft_sha256: sha(join(runDir, draftPath)),
      decision_rule: 'reviewed-choice'
    };
  });
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
  const bind = (path) => ({ path, sha256: sha(join(runDir, path)) });
  write(join(runDir, 'run.json'), JSON.stringify({
    schema_version: 2,
    run_id: 'fixture-run',
    run_mode: 'reviewed',
    status: 'running',
    current_stage: 'visual',
    capabilities: {
      status: 'PASS',
      providers: {
        wechat_cover: {
          status: 'PASS', contract: 'wechat-cover-v1',
          skill_path: coverSkill, skill_sha256: sha(coverSkill)
        }
      }
    },
    stages: {
      titles: { status: 'completed', attempt: 1, artifacts: [] },
      visual: { status: 'running', attempt, artifacts: [] },
      package: { status: 'pending', attempt: 0, artifacts: [] },
      final_qa: { status: 'pending', attempt: 0, artifacts: [] }
    },
    gates: {
      titles: {
        status: 'approved', revision: 1,
        decision_ref: bind(decisionPath),
        bound_artifacts: [
          bind('06-selection/titles.json'),
          bind('06-selection/title-matrix.md'),
          bind(decisionPath)
        ]
      },
      visual: {
        status: visualApproved ? 'approved' : 'pending', revision: visualApproved ? 1 : 0,
        decision_ref: null, bound_artifacts: []
      },
      final: { status: 'pending', revision: 0, decision_ref: null, bound_artifacts: [] }
    },
    platform_selections: Object.fromEntries(selections.map((item) => [item.platform, item])),
    invalidations: [],
    history: []
  }, null, 2));
  return { runDir, selection: selections[0], decisionPath };
}

function createValidCover(runDir, { backendHint = 'configured-api' } = {}) {
  const built = run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', backendHint]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const requestPath = JSON.parse(built.stdout).request_path;
  const request = readJson(requestPath);
  const suffix = request.attempt === 1 ? '' : `.v${String(request.attempt).padStart(3, '0')}`;
  const versionDir = request.attempt === 1 ? '' : `v${String(request.attempt).padStart(3, '0')}/`;
  const base = request.output_dir;
  const sourcePath = `${base}/source${suffix}.md`;
  const promptPath = `${base}/prompts/${versionDir}attempt-01.md`;
  const candidatePath = `${base}/candidates/${versionDir}attempt-01.png`;
  const coverPath = request.expected_artifacts[0];
  const metadataPath = request.expected_artifacts[1];
  write(join(runDir, sourcePath), `# Cover source\n\nExact title: ${request.selection.title}\n\nSource: ${request.selection.draft_path}`);
  write(join(runDir, promptPath), `Render the exact title on the left: ${request.selection.title}`);
  mkdirSync(dirname(join(runDir, candidatePath)), { recursive: true });
  copyFileSync(join(coverRoot, 'assets', 'style-reference.png'), join(runDir, candidatePath));
  copyFileSync(join(runDir, candidatePath), join(runDir, coverPath));
  const coverHash = sha(join(runDir, coverPath));
  const resource = (path) => ({ path, sha256: sha(join(coverRoot, path)) });
  const gates = {
    title_accuracy: 'PASS', additional_text: 'PASS', composition: 'PASS', safe_margin: 'PASS',
    underline_accents: 'PASS', spacing: 'PASS', visual_style: 'PASS', semantic_fidelity: 'PASS',
    forbidden_elements: 'PASS', dimensions: 'PASS'
  };
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
    backend: { hint: backendHint, method: 'fixture-renderer', model: null },
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
        gates,
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
  return { request, requestPath, coverPath, metadataPath };
}

test('WeChat cover request binds the approved exact title and fixed cover contract', () => {
  const { runDir, selection, decisionPath } = fixture();
  try {
    const result = run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'configured-api']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    const request = readJson(output.request_path);
    assert.equal(request.task_id, 'wechat-cover:fixture-run:wechat:A:attempt-001');
    assert.equal(request.capability, 'wechat_cover');
    assert.equal(request.provider_contract, 'wechat-cover-v1');
    assert.equal(request.mode, 'generate_cover');
    assert.equal(request.attempt, 1);
    assert.equal(request.platform, 'wechat');
    assert.equal(request.variant, 'A');
    assert.deepEqual(request.selection, selection);
    assert.deepEqual(request.inputs, [
      { role: 'final_draft', path: selection.draft_path, sha256: selection.draft_sha256 },
      { role: 'title_selection', path: decisionPath, sha256: sha(join(runDir, decisionPath)) }
    ]);
    assert.equal(request.output_dir, '07-visual/wechat-cover');
    assert.deepEqual(request.expected_artifacts, [
      '07-visual/wechat-cover/cover.png',
      '07-visual/wechat-cover/cover.json'
    ]);
    assert.deepEqual(request.options, {
      width: 1923,
      height: 818,
      format: 'png',
      style_id: 'warm-hand-drawn-notebook-v1',
      exact_title_required: true,
      best_effort_allowed: false,
      max_attempts: 3,
      backend_hint: 'configured-api',
      execution_strategy: 'one_candidate_at_a_time'
    });
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('WeChat cover request rejects unsupported titles and versions a reopened visual attempt', () => {
  const early = fixture({ visualApproved: false });
  try {
    const blocked = run('create-wechat-cover-request.mjs', [early.runDir]);
    assert.equal(blocked.status, 2);
    assert.ok(JSON.parse(blocked.stdout).blockers.some((item) => item.code === 'wechat_cover_visual_gate_missing'));
  } finally {
    rmSync(early.runDir, { recursive: true, force: true });
  }

  const invalid = fixture({ title: 'A'.repeat(36) });
  try {
    const blocked = run('create-wechat-cover-request.mjs', [invalid.runDir]);
    assert.equal(blocked.status, 2);
    assert.ok(JSON.parse(blocked.stdout).blockers.some((item) => item.code === 'wechat_cover_title_unsupported'));
  } finally {
    rmSync(invalid.runDir, { recursive: true, force: true });
  }

  const versioned = fixture({ attempt: 2 });
  try {
    const result = run('create-wechat-cover-request.mjs', [versioned.runDir]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    const request = readJson(output.request_path);
    assert.match(output.request_path, /wechat-cover\.v002\.request\.json$/);
    assert.deepEqual(request.expected_artifacts, [
      '07-visual/wechat-cover/cover.v002.png',
      '07-visual/wechat-cover/cover.v002.json'
    ]);
  } finally {
    rmSync(versioned.runDir, { recursive: true, force: true });
  }
});

test('child provider PASS is accepted by the total cover validator', async () => {
  const { runDir } = fixture();
  try {
    const output = createValidCover(runDir);
    const state = readJson(join(runDir, 'run.json'));
    const validation = await validateWechatCover(runDir, state);
    assert.deepEqual(validation.issues, []);

    const metadata = readJson(join(runDir, output.metadataPath));
    metadata.generation.selected_qa.title_evidence.observed_title = '错误标题';
    write(join(runDir, output.metadataPath), JSON.stringify(metadata, null, 2));
    const rejected = await validateWechatCover(runDir, state);
    assert.ok(rejected.issues.some((item) => item.code === 'wechat_cover_title_evidence_invalid'));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});
