import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderTitleMatrix } from '../scripts/contracts.mjs';

const skillDir = resolve(import.meta.dirname, '..');
const scriptsDir = join(skillDir, 'scripts');
const coverSkill = resolve(skillDir, 'skills', 'wechat-sketch-cover', 'SKILL.md');
const coverRoot = dirname(coverSkill);
const coverProviderScript = join(coverRoot, 'scripts', 'provider-contract.mjs');
const platforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
const variants = ['A', 'B'];
const titleCounts = { wechat: 3, xiaohongshu: 5, zhihu: 3, weibo: 2, toutiao: 4 };
const semanticPassArgs = [
  '--new-conclusion', 'PASS', '--scope-change', 'PASS', '--causal-strength', 'PASS',
  '--factual-addition', 'PASS', '--factual-omission', 'PASS', '--proper-noun-drift', 'PASS'
];
const semanticPassChecks = {
  new_conclusion: 'PASS', scope_change: 'PASS', causal_strength: 'PASS',
  factual_addition: 'PASS', factual_omission: 'PASS', proper_noun_drift: 'PASS'
};
const capabilityMarkers = {
  topic_planning: ['name: content-topics', 'content-production-provider: topic-planning-v1'],
  source_research: ['name: collect-sources', 'content-production-provider: source-research-v1'],
  drafting: ['name: draft-content', 'content-production-provider: drafting-v1'],
  proofreading: ['name: proofread-content', 'content-production-provider: proofreading-v1'],
  title_generation: ['name: title-options', 'content-production-provider: title-generation-v1'],
  illustration: ['name: post-illustration-images', 'content-production-provider: illustration-v1'],
  wechat_cover: ['name: wechat-sketch-cover', 'content-production-provider: wechat-cover-v1'],
  image_compression: ['name: compress-image', 'content-production-provider: image-compression-v1'],
  wechat_layout: ['name: format-content', 'content-production-provider: wechat-layout-v1']
};
const capabilityIds = Object.keys(capabilityMarkers);

function tempDir(name) {
  return mkdtempSync(join(tmpdir(), `content-production-${name}-`));
}

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function writeBinary(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeResearchPackage(runDir, { criticalStatus = 'verified' } = {}) {
  const researchStatus = criticalStatus === 'verified' ? 'complete' : 'partial';
  write(join(runDir, '02-research', 'brief.md'), `---
artifact: ResearchBrief
status: PASS
research_status: ${researchStatus}
---

# 研究简报

## 研究对象与边界

仅研究受控 AI Agent 工作流。

## 核心结论

- 跨系统写入前需要人工确认。[c-001; s-001]

## 关键事实

- 该约束见受控来源。[c-001; s-001]

## 限制与未知

- 普遍效率收益仍待确认，不外推到所有 Agent 产品。

## 下游写作约束

- 只能描述本次受控工作流。`);
  write(join(runDir, '02-research', 'source-log.md'), `---
artifact: SourceLog
status: PASS
research_status: ${researchStatus}
---

# 来源日志

## s-001

- 来源类型：primary
- 标题：受控来源
- 发布者/作者：测试夹具
- 发布/更新日期：2026-07-16
- 访问日期：2026-07-16
- 来源定位：https://example.com/source
- 语言：zh
- 独立来源组：origin-001
- 抓取状态：fetched
- 支持主张：c-001
- 证据摘录：跨系统写入前需要人工确认。
- 中文释义：该约束仅适用于测试夹具。
- 核实限制：不能证明普遍适用性。`);
  write(join(runDir, '02-research', 'claims.json'), JSON.stringify({
    schema_version: 1,
    research_status: researchStatus,
    claims: [{
      id: 'c-001',
      text: '在该受控工作流中，跨系统写入前必须人工确认。',
      critical: true,
      status: criticalStatus,
      source_ids: ['s-001'],
      scope: '仅限本次受控测试工作流',
      risk: criticalStatus === 'verified' ? 'low' : 'high',
      evidence_level: criticalStatus === 'verified' ? 'L3' : 'L1',
      use_gate: criticalStatus === 'verified' ? 'ready' : 'caveat',
      as_of: '2026-07-16',
      limitations: ['不代表所有 Agent 产品']
    }]
  }, null, 2));
  write(join(runDir, '02-research', 'evidence-map.md'), `---
artifact: EvidenceMap
status: PASS
research_status: ${researchStatus}
---

# 证据映射

## c-001

- 状态：${criticalStatus}
- 来源：s-001
- 范围：仅限本次受控测试工作流
- 限制：不代表所有 Agent 产品
- 可进入下游：${criticalStatus === 'verified' ? 'yes' : 'no'}`);
}

function writeResearchProviderEnvelope(runDir, { status = 'PASS', issue = null } = {}) {
  const expectedArtifacts = [
    '02-research/brief.md',
    '02-research/source-log.md',
    '02-research/claims.json',
    '02-research/evidence-map.md'
  ];
  const state = readJson(join(runDir, 'run.json'));
  const requestPath = join(runDir, '02-research', 'source-research.request.json');
  const request = existsSync(requestPath)
    ? readJson(requestPath)
    : {
        schema_version: 1,
        contract: 'content-production-provider/v1',
        task_id: `source-research:${state.run_id}`,
        capability: 'source_research',
        provider_contract: 'source-research-v1',
        run_dir: runDir,
        run_mode: state.run_mode,
        mode: 'research',
        inputs: [],
        output_dir: '02-research',
        expected_artifacts: expectedArtifacts,
        options: { input_mode: state.input_mode },
        interaction_policy: 'return_to_orchestrator'
      };
  write(requestPath, JSON.stringify(request, null, 2));
  write(join(runDir, '02-research', 'provider-result.json'), JSON.stringify({
    schema_version: 1,
    contract: 'content-production-provider/v1',
    provider_contract: 'source-research-v1',
    task_id: request.task_id,
    status,
    artifacts: status === 'PASS'
      ? expectedArtifacts.map((path) => ({ role: path.split('/').at(-1), path, sha256: sha(join(runDir, path)) }))
      : [],
    checks: {},
    issues: issue ? [issue] : [],
    warnings: []
  }, null, 2));
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

function makeCapabilityConfig(root, { missing = null } = {}) {
  const capabilities = {};

  for (const [id, markers] of Object.entries(capabilityMarkers)) {
    const path = join(root, 'skills', id, 'SKILL.md');
    if (id !== missing) {
      write(path, `---\nname: ${markers[0].slice(6)}\ndescription: fixture\n---\n${markers.slice(1).join('\n')}\n`);
    }
    capabilities[id] = {
      skill_path: path,
      required: true,
      contract: markers[1].split(': ')[1],
      required_markers: markers
    };
  }

  const config = join(root, 'capabilities.yaml');
  write(config, JSON.stringify({ version: 2, capabilities }, null, 2));
  return config;
}

function baseRun(runDir, { runMode = 'autonomous' } = {}) {
  const briefPath = join(runDir, '00-intake', 'brief.md');
  const coreAudiencePath = join(runDir, '00-intake', 'core-audience.md');
  const platformProfilesPath = join(runDir, '00-intake', 'platform-profiles.json');
  const articleAudiencePath = join(runDir, '00-intake', 'article-audience.md');
  const topicHistoryPath = join(runDir, '00-intake', 'topic-history.md');
  const materialsPath = join(runDir, '00-intake', 'materials.json');
  write(briefPath, '# 创作简述\n\n明确题目。');
  write(coreAudiencePath, '# 核心画像\n\n职场读者。');
  write(platformProfilesPath, JSON.stringify({ profile_set: { version: '1.0.0' } }, null, 2));
  write(articleAudiencePath, '# 本篇细分受众\n\n未指定。');
  write(topicHistoryPath, '# 历史选题\n\n空集合。');
  write(materialsPath, JSON.stringify({ items: [] }, null, 2));
  const claimsPath = join(runDir, '02-research', 'claims.json');
  write(claimsPath, JSON.stringify({
    claims: [{ id: 'c-001', text: '可验证事实', critical: true, source_ids: ['s-001'], status: 'verified' }]
  }, null, 2));
  write(join(runDir, '02-research', 'brief.md'), '# Brief\n\n可验证事实；影响范围仍待确认。');
  write(join(runDir, '02-research', 'source-log.md'), '# 来源\n\n- s-001：原始来源。');
  write(join(runDir, '02-research', 'evidence-map.md'), '# 证据映射\n\n- c-001 -> s-001');
  write(join(runDir, '03-outline', 'control-outline.md'), '# Control Outline\n\n- c-001：已确认结构。');
  for (const file of ['A-structure.md', 'B-structure.md']) write(join(runDir, '03-outline', file), `# ${file}\n\n已确认结构。`);
  const stylePath = join(runDir, '00-intake', 'style-b.md');
  write(stylePath, '# B 风格\n\n老同事聊干货。');

  for (const variant of variants) {
    const master = join(runDir, '04-masters', variant);
    write(join(master, 'final.md'), `# ${variant} 母稿\n\n可验证事实。`);
    write(join(master, 'review.md'), '# 母稿审校\n\n通过。');
    write(join(master, 'provenance.json'), JSON.stringify({
      model: 'fixture-model', parameters: { temperature: 0.4 },
      input_hashes: {
        style_b: variant === 'A' ? null : sha(stylePath),
        claims: sha(claimsPath),
        control_outline: sha(join(runDir, '03-outline', 'control-outline.md')),
        structure: sha(join(runDir, '03-outline', `${variant}-structure.md`))
      },
      input_paths: {
        claims: '02-research/claims.json',
        control_outline: '03-outline/control-outline.md',
        structure: `03-outline/${variant}-structure.md`,
        style_b: variant === 'A' ? null : '00-intake/style-b.md'
      }
    }, null, 2));
  }

  const titleData = { schema_version: 1, provider_contract: 'title-generation-v1', attempt: 1, platforms: {} };
  const selections = [];
  for (const platform of platforms) {
    titleData.platforms[platform] = {};
    for (const variant of variants) {
      const base = join(runDir, '05-platforms', platform, variant);
      const section = '在本次受控工作流中，跨系统写入前需要人工确认；这个边界只适用于当前材料，不能外推到所有产品。';
      const draftBody = platform === 'xiaohongshu'
        ? `# ${platform} ${variant} 初稿

## 发布正文

${section.repeat(5)}

## 卡片文案

${Array.from({ length: 6 }, (_, index) => `### 第 ${index + 1} 页\n\n采用边界要点 ${index + 1}：${section}`).join('\n\n')}

## 标签

#AI工具 #工作流 #团队协作 #风险控制 #知识工作`
        : platform === 'weibo'
          ? `# ${platform} ${variant} 初稿\n\n${section.repeat(3)}`
          : `# ${platform} ${variant} 初稿

## 问题与边界

${section.repeat(4)}

## 核心解释

${section.repeat(4)}

## 行动建议

${section.repeat(4)}`;
      write(join(base, 'draft.md'), draftBody);
      write(join(base, 'audience-snapshot.md'), `# ${platform} 受众\n\n职场读者。`);
      write(join(base, 'audience-snapshot.json'), JSON.stringify({
        schema_version: 1, platform, variant,
        merge_order: ['core_audience', 'platform_overlay', 'article_segment'],
        sources: {
          core_audience: { path: '00-intake/core-audience.md', sha256: sha(coreAudiencePath) },
          platform_profiles: {
            path: '00-intake/platform-profiles.json', sha256: sha(platformProfilesPath),
            profile_set_version: '1.0.0', platform_id: platform
          },
          article_audience: { path: '00-intake/article-audience.md', sha256: sha(articleAudiencePath), empty: true }
        },
        merged_snapshot: {
          path: `05-platforms/${platform}/${variant}/audience-snapshot.md`,
          sha256: sha(join(base, 'audience-snapshot.md'))
        }
      }, null, 2));
      write(join(base, 'provenance.json'), JSON.stringify({
        source_master_path: `04-masters/${variant}/final.md`,
        source_master_sha256: sha(join(runDir, '04-masters', variant, 'final.md')),
        audience_snapshot_sha256: sha(join(base, 'audience-snapshot.md'))
      }, null, 2));
      const baseRelative = `05-platforms/${platform}/${variant}`;
      const expectedProofread = [
        `${baseRelative}/logic-final.md`, `${baseRelative}/humanized.md`, `${baseRelative}/final.md`,
        `${baseRelative}/reviews/logic.md`, `${baseRelative}/reviews/humanize.md`, `${baseRelative}/reviews/detail.md`,
        `${baseRelative}/reviews/proofread-result.json`
      ];
      const proofreadRequest = {
        schema_version: 1,
        contract: 'content-production-provider/v1',
        task_id: `proofread:fixture-run:${platform}:${variant}:attempt-001`,
        capability: 'proofreading',
        provider_contract: 'proofreading-v1',
        run_dir: runDir,
        run_mode: runMode,
        mode: 'proofread',
        platform,
        variant,
        inputs: [{ role: 'draft', path: `${baseRelative}/draft.md`, sha256: sha(join(base, 'draft.md')) }],
        output_dir: baseRelative,
        expected_artifacts: expectedProofread,
        options: { execution_strategy: 'parallel_subagents', model: 'fixture-model', parameters: { temperature: 0.2 } },
        interaction_policy: 'return_to_orchestrator'
      };
      write(join(base, 'reviews', 'proofreading.request.json'), JSON.stringify(proofreadRequest, null, 2));
      writeProofreadingProviderArtifacts(runDir, proofreadRequest);
      const proofreadRoles = [
        'logic_checkpoint', 'humanized_checkpoint', 'final',
        'logic_review', 'humanize_review', 'detail_review', 'proofread_result'
      ];
      write(join(base, 'reviews', 'proofreading.result.json'), JSON.stringify({
        schema_version: 1,
        contract: 'content-production-provider/v1',
        provider_contract: 'proofreading-v1',
        task_id: proofreadRequest.task_id,
        request_sha256: sha(join(base, 'reviews', 'proofreading.request.json')),
        status: 'PASS',
        artifacts: expectedProofread.map((path, index) => ({ role: proofreadRoles[index], path, sha256: sha(join(runDir, path)) })),
        checks: { request_valid: true, mode: 'proofread' },
        issues: [],
        warnings: []
      }, null, 2));
      for (const [phase, after] of [['humanize', 'humanized.md'], ['final', 'final.md']]) {
        write(join(base, 'reviews', `claim-regression-${phase}.json`), JSON.stringify({
          status: 'PASS', automatic_status: 'PASS', phase, blockers: [],
          before: join(base, 'draft.md'), after: join(base, after), claims: claimsPath,
          before_sha256: sha(join(base, 'draft.md')),
          after_sha256: sha(join(base, after)),
          claims_sha256: sha(claimsPath),
          semantic_review: {
            status: 'PASS', recorded_by: 'set-semantic-review.mjs', reviewer: 'fixture-reviewer',
            reviewed_at: '2026-07-16T00:00:00.000Z',
            checks: semanticPassChecks,
            before_sha256: sha(join(base, 'draft.md')),
            after_sha256: sha(join(base, after)),
            claims_sha256: sha(claimsPath)
          }
        }, null, 2));
      }
      const titleOutputDir = `06-selection/providers/${platform}/${variant}`;
      const titleRequest = {
        schema_version: 1,
        contract: 'content-production-provider/v1',
        task_id: `title:fixture-run:${platform}:${variant}:attempt-001`,
        capability: 'title_generation',
        provider_contract: 'title-generation-v1',
        run_dir: runDir,
        run_mode: runMode,
        mode: 'generate_titles',
        platform,
        variant,
        inputs: [{ role: 'final_draft', path: `${baseRelative}/final.md`, sha256: sha(join(base, 'final.md')) }],
        output_dir: titleOutputDir,
        expected_artifacts: [`${titleOutputDir}/candidates.json`],
        options: {
          count: titleCounts[platform], language: 'zh-CN', titles_only: true,
          old_title: null, brand_reference: null, verification_scope: 'none',
          execution_strategy: 'parallel_subagents', model: 'fixture-model', parameters: { temperature: 0.4 }
        },
        interaction_policy: 'return_to_orchestrator'
      };
      const titleRequestPath = join(runDir, titleOutputDir, 'title-generation.request.json');
      const titleResultPath = join(runDir, titleOutputDir, 'title-generation.result.json');
      write(titleRequestPath, JSON.stringify(titleRequest, null, 2));
      const titleCandidatePath = writeTitleProviderArtifact(runDir, titleRequest);
      write(titleResultPath, JSON.stringify({
        schema_version: 1,
        contract: 'content-production-provider/v1',
        provider_contract: 'title-generation-v1',
        task_id: titleRequest.task_id,
        request_sha256: sha(titleRequestPath),
        status: 'PASS',
        artifacts: [{ role: 'title_candidates', path: titleRequest.expected_artifacts[0], sha256: sha(titleCandidatePath) }],
        checks: { request_valid: true, mode: 'generate_titles' },
        issues: [],
        warnings: []
      }, null, 2));
      titleData.platforms[platform][variant] = {
        task_id: titleRequest.task_id,
        request_path: `${titleOutputDir}/title-generation.request.json`,
        request_sha256: sha(titleRequestPath),
        result_path: `${titleOutputDir}/title-generation.result.json`,
        result_sha256: sha(titleResultPath),
        candidate_path: titleRequest.expected_artifacts[0],
        candidate_sha256: sha(titleCandidatePath),
        draft_path: titleRequest.inputs[0].path,
        draft_sha256: titleRequest.inputs[0].sha256,
        candidates: readJson(titleCandidatePath).candidates
      };
    }
    selections.push({
      platform,
      variant: 'A',
      title_id: `${platform}-A-1`,
      title: `${platform} A 标题 1`,
      topic_phrase: platform === 'weibo' ? '#AI工作流采用边界#' : null,
      draft_path: `05-platforms/${platform}/A/final.md`,
      draft_sha256: sha(join(runDir, '05-platforms', platform, 'A', 'final.md')),
      decision_rule: 'promise_status=PASS,risk,recommended,rank,variant=A'
    });

    const visual = join(runDir, '07-visual', platform);
    write(join(visual, 'plan.json'), JSON.stringify({
      platform, variant: 'A', status: 'READY',
      source_draft_sha256: sha(join(runDir, '05-platforms', platform, 'A', 'final.md'))
    }, null, 2));
    write(join(visual, 'shot-list.md'), `# ${platform} Shot List\n\n- 01-cover`);
    write(join(visual, 'images', '01-cover.png'), 'fixture image');
    write(join(visual, 'bundle.json'), JSON.stringify({
      platform,
      variant: 'A',
      status: 'PASS',
      source_draft_sha256: sha(join(runDir, '05-platforms', platform, 'A', 'final.md')),
      images: [{
        image_id: '01-cover',
        file: 'images/01-cover.png',
        placement: 'cover',
        content_qa_status: 'pass',
        style_qa_status: 'pass',
        brand_qa_status: 'pass',
        set_qa_status: 'pass',
        residual_risk: 'none'
      }]
    }, null, 2));

    const pack = join(runDir, '08-publish-pack', platform);
    write(join(pack, 'images', '01-cover.png'), 'fixture image');
    write(join(pack, 'final.md'), `# ${platform} A 标题 1\n\n![封面](images/01-cover.png)\n\n可验证事实。`);
    write(join(visual, 'manifest.json'), JSON.stringify({
      platform, variant: 'A', status: 'PASS',
      source_draft_sha256: sha(join(runDir, '05-platforms', platform, 'A', 'final.md')),
      items: [{
        image_id: '01-cover', bundle_file: 'images/01-cover.png',
        bundle_sha256: sha(join(visual, 'images', '01-cover.png')),
        publish_file: 'images/01-cover.png', publish_sha256: sha(join(pack, 'images', '01-cover.png')),
        markdown_ref: 'images/01-cover.png'
      }]
    }, null, 2));
    write(join(pack, 'metadata.json'), JSON.stringify({
      platform, variant: 'A', title_id: `${platform}-A-1`, title: `${platform} A 标题 1`,
      source_draft_sha256: sha(join(runDir, '05-platforms', platform, 'A', 'final.md')),
      visual_bundle_sha256: sha(join(visual, 'bundle.json')),
      manifest_sha256: sha(join(visual, 'manifest.json')),
      final_md_sha256: sha(join(pack, 'final.md'))
    }, null, 2));
    write(join(pack, 'optimization.json'), JSON.stringify({
      schema_version: 1,
      status: 'PASS',
      platform,
      items: [{
        file: 'images/01-cover.png',
        source_sha256: sha(join(visual, 'images', '01-cover.png')),
        output_sha256: sha(join(pack, 'images', '01-cover.png')),
        format: 'png'
      }]
    }, null, 2));
    if (platform === 'wechat') {
      write(join(pack, 'article.html'), '<section><img src="images/01-cover.png"><p>可验证事实。</p></section>');
      write(join(pack, 'article-preview.html'), '<html><body><main id="gzh-content"><section><img src="images/01-cover.png"><p>可验证事实。</p></section></main></body></html>');
      write(join(pack, 'layout-result.json'), JSON.stringify({
        schema_version: 1,
        status: 'PASS',
        source_markdown_sha256: sha(join(pack, 'final.md')),
        clean_file: 'article.html',
        clean_sha256: sha(join(pack, 'article.html')),
        preview_file: 'article-preview.html',
        preview_sha256: sha(join(pack, 'article-preview.html')),
        errors: 0,
        warnings: 0
      }, null, 2));
      const coverSource = join(runDir, '07-visual', 'wechat-cover', 'cover.png');
      const coverPublish = join(pack, 'cover.png');
      writeBinary(coverSource, pngHeader(1923, 818));
      writeBinary(coverPublish, pngHeader(1923, 818));
      write(join(runDir, '07-visual', 'wechat-cover', 'cover.json'), JSON.stringify({
        schema_version: 1,
        status: 'PASS',
        title_id: 'wechat-A-1',
        source_draft_sha256: sha(join(runDir, '05-platforms', 'wechat', 'A', 'final.md')),
        source_file: 'cover.png',
        source_sha256: sha(coverSource),
        publish_file: '08-publish-pack/wechat/cover.png',
        publish_sha256: sha(coverPublish),
        width: 1923,
        height: 818,
        format: 'png',
        title_exact: true,
        optimization: { status: 'PASS', format: 'png' }
      }, null, 2));
    }
  }
  const titlesPath = join(runDir, '06-selection', 'titles.json');
  write(titlesPath, JSON.stringify(titleData, null, 2));
  const selectionData = {
    schema_version: 1,
    revision: 1,
    status: 'PROPOSED',
    titles_path: '06-selection/titles.json',
    titles_sha256: sha(titlesPath),
    decision_rule: 'promise_status=PASS,risk,recommended,rank,variant=A',
    selections
  };
  write(join(runDir, '06-selection', 'selection.v001.json'), JSON.stringify(selectionData, null, 2));
  write(join(runDir, '06-selection', 'title-matrix.md'), renderTitleMatrix(titleData, selectionData));
  write(join(runDir, '01-discovery', 'skip.json'), JSON.stringify({
    stage: 'discovery', status: 'SKIPPED', mode: 'topic_provided',
    reason: 'user_provided_topic', input_sha256: 'b'.repeat(64)
  }, null, 2));

  const bind = (path) => ({ path, sha256: sha(join(runDir, path)) });
  const platformStagePaths = platforms.flatMap((platform) => variants.flatMap((variant) => {
    const base = `05-platforms/${platform}/${variant}`;
    return [`${base}/draft.md`, `${base}/audience-snapshot.md`, `${base}/audience-snapshot.json`, `${base}/provenance.json`];
  }));
  const editingStagePaths = platforms.flatMap((platform) => variants.flatMap((variant) => {
    const base = `05-platforms/${platform}/${variant}`;
    return [
      `${base}/logic-final.md`, `${base}/humanized.md`, `${base}/final.md`,
      `${base}/reviews/logic.md`, `${base}/reviews/humanize.md`, `${base}/reviews/detail.md`,
      `${base}/reviews/proofread-result.json`,
      `${base}/reviews/claim-regression-humanize.json`, `${base}/reviews/claim-regression-final.json`
    ];
  }));
  const titleStagePaths = [
    ...platforms.flatMap((platform) => variants.map((variant) =>
      `06-selection/providers/${platform}/${variant}/candidates.json`)),
    '06-selection/titles.json',
    '06-selection/title-matrix.md'
  ];
  const gates = {
    topic: { status: 'approved', revision: 1, decision_ref: { inline: 'fixture-topic', sha256: createHash('sha256').update('fixture-topic').digest('hex') }, bound_artifacts: [] },
    outline: { status: 'approved', revision: 1, bound_artifacts: ['03-outline/control-outline.md', '03-outline/A-structure.md', '03-outline/B-structure.md'].map(bind) },
    titles: {
      status: 'approved', revision: 1,
      decision_ref: bind('06-selection/selection.v001.json'),
      bound_artifacts: [bind('06-selection/titles.json'), bind('06-selection/title-matrix.md'), bind('06-selection/selection.v001.json')]
    },
    visual: {
      status: 'approved', revision: 1,
      bound_artifacts: platforms.flatMap((platform) => [bind(`07-visual/${platform}/plan.json`), bind(`07-visual/${platform}/shot-list.md`)])
    },
    final: { status: 'awaiting_approval', revision: 0, bound_artifacts: [] }
  };
  write(join(runDir, 'run.json'), JSON.stringify({
    schema_version: 2, run_id: 'fixture-run', mode: 'topic_provided', input_mode: 'topic', run_mode: runMode, status: 'running', current_stage: 'final_qa',
    capabilities: {
      status: 'PASS',
      providers: Object.fromEntries(capabilityIds.map((id) => [id, {
        status: 'PASS',
        contract: capabilityMarkers[id][1].split(': ')[1],
        skill_sha256: 'a'.repeat(64)
      }]))
    },
    snapshots: {
      brief: { snapshot_path: '00-intake/brief.md', sha256: sha(briefPath) },
      core_audience: { snapshot_path: '00-intake/core-audience.md', sha256: sha(coreAudiencePath) },
      platform_profiles: { snapshot_path: '00-intake/platform-profiles.json', sha256: sha(platformProfilesPath) },
      style_b: { snapshot_path: '00-intake/style-b.md', sha256: sha(stylePath) },
      materials: { snapshot_path: '00-intake/materials.json', sha256: sha(materialsPath) },
      topic_history: { snapshot_path: '00-intake/topic-history.md', sha256: sha(topicHistoryPath), empty: true },
      article_audience: { snapshot_path: '00-intake/article-audience.md', sha256: sha(articleAudiencePath), empty: true }
    },
    stages: Object.fromEntries(
      ['init', 'discovery', 'research', 'outline', 'masters', 'platforms', 'editing', 'titles', 'visual', 'package', 'final_qa']
        .map((stage) => [stage, {
          status: stage === 'final_qa' ? 'running' : 'completed',
          attempt: 1,
          artifacts: stage === 'platforms'
            ? platformStagePaths.map(bind)
            : stage === 'editing'
              ? editingStagePaths.map(bind)
              : stage === 'titles' ? titleStagePaths.map(bind) : []
        }])
    ),
    gates,
    platform_selections: Object.fromEntries(selections.map((item) => [item.platform, item])),
    invalidations: [], history: []
  }, null, 2));
}

function replaceLegacyCoverWithProvider(runDir) {
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.capabilities.providers.wechat_cover = {
    status: 'PASS',
    contract: 'wechat-cover-v1',
    skill_path: coverSkill,
    skill_sha256: sha(coverSkill)
  };
  state.stages.visual = { ...state.stages.visual, status: 'running', attempt: 1, artifacts: [] };
  state.current_stage = 'visual';
  write(statePath, JSON.stringify(state, null, 2));
  rmSync(join(runDir, '07-visual', 'wechat-cover', 'cover.png'));
  rmSync(join(runDir, '07-visual', 'wechat-cover', 'cover.json'));

  const built = run('create-wechat-cover-request.mjs', [runDir, '--backend-hint', 'configured-api']);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const requestPath = JSON.parse(built.stdout).request_path;
  const request = readJson(requestPath);
  const sourcePath = `${request.output_dir}/source.md`;
  const promptPath = `${request.output_dir}/prompts/attempt-01.md`;
  const candidatePath = `${request.output_dir}/candidates/attempt-01.png`;
  const [coverPath, metadataPath] = request.expected_artifacts;
  write(join(runDir, sourcePath), `# Cover source\n\nExact title: ${request.selection.title}`);
  write(join(runDir, promptPath), `Render the exact title on the left: ${request.selection.title}`);
  mkdirSync(dirname(join(runDir, candidatePath)), { recursive: true });
  copyFileSync(join(coverRoot, 'assets', 'style-reference.png'), join(runDir, candidatePath));
  copyFileSync(join(runDir, candidatePath), join(runDir, coverPath));
  copyFileSync(join(runDir, coverPath), join(runDir, '08-publish-pack', 'wechat', 'cover.png'));
  const resource = (path) => ({ path, sha256: sha(join(coverRoot, path)) });
  const coverHash = sha(join(runDir, coverPath));
  write(join(runDir, metadataPath), JSON.stringify({
    schema_version: 1,
    contract: 'wechat-cover-v1',
    task_id: request.task_id,
    status: 'PASS',
    attempt: 1,
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

  const completed = readJson(statePath);
  completed.stages.visual.status = 'completed';
  completed.stages.visual.artifacts = [coverPath, metadataPath].map((path) => ({
    path,
    sha256: sha(join(runDir, path))
  }));
  completed.current_stage = 'final_qa';
  write(statePath, JSON.stringify(completed, null, 2));
  return metadataPath;
}

test('capability preflight passes complete config and blocks a missing skill', () => {
  const root = tempDir('capabilities');
  const complete = makeCapabilityConfig(join(root, 'complete'));
  const pass = run('check-capabilities.mjs', ['--config', complete]);
  assert.equal(pass.status, 0, pass.stderr);
  assert.equal(JSON.parse(pass.stdout).status, 'PASS');

  const missing = makeCapabilityConfig(join(root, 'missing'), { missing: 'proofreading' });
  const blocked = run('check-capabilities.mjs', ['--config', missing]);
  assert.equal(blocked.status, 2);
  assert.equal(JSON.parse(blocked.stdout).status, 'BLOCKED');

});

test('workspace capability registry points to all local skills and passes every required adapter', () => {
  const result = run('check-capabilities.mjs', ['--config', join(skillDir, 'capabilities.yaml')]);
  assert.equal(result.status, 0, result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'PASS');
  assert.equal(report.capabilities.length, capabilityIds.length);
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.warnings, []);
  assert.ok(report.capabilities.filter((item) => item.required).every((item) => item.status === 'PASS'));
});

test('topic planning contract defines the exact request that the adapter accepts', () => {
  const contract = readFileSync(join(skillDir, 'references', 'capability-contracts.md'), 'utf8');
  for (const phrase of [
    '`mode: plan`',
    '`00-intake/brief.md`',
    '`00-intake/materials.json`',
    '`00-intake/core-audience.md`',
    '`00-intake/platform-profiles.json`',
    '`00-intake/topic-history.md`',
    '`material:<id>`',
    '`00-intake/<snapshot_path>`',
    '`interaction_policy: return_to_orchestrator`',
    '派发前完成 request validation'
  ]) {
    assert.ok(contract.includes(phrase), phrase);
  }
});

test('source research contract defines the exact request and canonical four-file package', () => {
  const contract = readFileSync(join(skillDir, 'references', 'capability-contracts.md'), 'utf8');
  for (const phrase of [
    'node scripts/create-source-request.mjs <run-dir>',
    '`mode: research`',
    '`research_subject` -> `01-discovery/research-subject.json`',
    '`brief` -> `00-intake/brief.md`',
    '`materials` -> `00-intake/materials.json`',
    '`core_audience` -> `00-intake/core-audience.md`',
    '`article_audience` -> `00-intake/article-audience.md`',
    '`material:<id>` -> `00-intake/<snapshot_path>`',
    '`topic_decision`',
    '`discovery_skip`',
    '`provided_outline`',
    '`02-research/brief.md`',
    '`02-research/source-log.md`',
    '`02-research/claims.json`',
    '`02-research/evidence-map.md`',
    '`interaction_policy: return_to_orchestrator`'
  ]) {
    assert.ok(contract.includes(phrase), phrase);
  }
});

test('provider result validator enforces task, output ownership, expected artifacts, and hashes', () => {
  const root = tempDir('provider-result');
  const runDir = join(root, 'run');
  const outputDir = join(runDir, '02-research');
  const artifactPath = join(outputDir, 'brief.md');
  const requestPath = join(root, 'request.json');
  const resultPath = join(root, 'result.json');
  write(artifactPath, '# Research brief\n\nVerified.');
  write(requestPath, JSON.stringify({
    schema_version: 1,
    contract: 'content-production-provider/v1',
    task_id: 'research:main',
    capability: 'source_research',
    provider_contract: 'source-research-v1',
    run_dir: runDir,
    run_mode: 'autonomous',
    mode: 'research',
    inputs: [],
    output_dir: '02-research',
    expected_artifacts: ['02-research/brief.md'],
    interaction_policy: 'return_to_orchestrator'
  }, null, 2));
  write(resultPath, JSON.stringify({
    schema_version: 1,
    contract: 'content-production-provider/v1',
    provider_contract: 'source-research-v1',
    task_id: 'research:main',
    status: 'PASS',
    artifacts: [{ role: 'brief', path: '02-research/brief.md', sha256: sha(artifactPath) }],
    issues: [],
    warnings: []
  }, null, 2));

  assert.equal(run('check-provider-result.mjs', [requestPath, resultPath]).status, 0);

  const escapedPath = join(runDir, 'outside.md');
  write(escapedPath, '# Outside');
  const escaped = readJson(resultPath);
  escaped.artifacts[0] = { role: 'brief', path: 'outside.md', sha256: sha(escapedPath) };
  write(resultPath, JSON.stringify(escaped, null, 2));
  const blocked = run('check-provider-result.mjs', [requestPath, resultPath]);
  assert.equal(blocked.status, 2);
  assert.ok(JSON.parse(blocked.stdout).issues.some((item) => item.code === 'provider_artifact_escape'));

  const external = join(root, 'external.md');
  write(external, '# External');
  rmSync(artifactPath);
  symlinkSync(external, artifactPath);
  escaped.artifacts[0] = { role: 'brief', path: '02-research/brief.md', sha256: sha(external) };
  write(resultPath, JSON.stringify(escaped, null, 2));
  const symlinked = run('check-provider-result.mjs', [requestPath, resultPath]);
  assert.equal(symlinked.status, 2);
  assert.ok(JSON.parse(symlinked.stdout).issues.some((item) => item.code === 'provider_artifact_symlink'));

  write(resultPath, JSON.stringify({
    schema_version: 1,
    contract: 'content-production-provider/v1',
    provider_contract: 'source-research-v1',
    task_id: 'research:main',
    status: 'BLOCKED',
    artifacts: [],
    issues: [{ code: 'critical_claim_unverified', message: 'Critical claim is not verified.', resume_from: 'research' }],
    warnings: []
  }, null, 2));
  const diagnostic = run('check-provider-result.mjs', [requestPath, resultPath]);
  assert.equal(diagnostic.status, 2);
  assert.equal(JSON.parse(diagnostic.stdout).status, 'BLOCKED');
  assert.equal(JSON.parse(diagnostic.stdout).provider_status, 'BLOCKED');
  assert.ok(JSON.parse(diagnostic.stdout).issues.some((item) => item.code === 'critical_claim_unverified'));
});

test('init-run creates an isolated run, snapshots inputs, and records hashes', () => {
  const root = tempDir('init');
  const config = makeCapabilityConfig(root);
  const audience = join(root, 'audience.md');
  const style = join(root, 'style.md');
  const material = join(root, 'source.md');
  write(audience, '# 核心画像\n\n职场读者。');
  write(style, '# B 风格\n\n老同事聊干货。');
  write(material, '# 用户素材\n\n原始材料。');

  const result = run('init-run.mjs', [
    '测试主题', '--root', join(root, 'runs'), '--capabilities', config,
    '--core-audience', audience, '--style-b', style, '--material', material,
    '--brief', '写一篇解释 AI Agent 工作流的文章'
  ]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const state = readJson(join(output.run_dir, 'run.json'));
  assert.equal(state.status, 'running');
  assert.equal(state.run_mode, 'autonomous');
  assert.equal(state.mode, 'brief');
  assert.equal(state.gates.topic.status, 'pending');
  assert.match(state.snapshots.brief.sha256, /^[a-f0-9]{64}$/);
  assert.match(state.snapshots.core_audience.sha256, /^[a-f0-9]{64}$/);
  assert.match(state.snapshots.style_b.sha256, /^[a-f0-9]{64}$/);
  assert.equal(readJson(join(output.run_dir, '00-intake', 'materials.json')).items.length, 1);
  assert.ok(readFileSync(join(output.run_dir, '00-intake', 'core-audience.md'), 'utf8').includes('职场读者'));
});

test('topic request builder derives an adapter-valid packet from init-run material snapshots', () => {
  const root = tempDir('topic-request');
  const config = makeCapabilityConfig(root);
  const material = join(root, 'source.md');
  write(material, '# 用户素材\n\n一份原始材料。');

  const initialized = run('init-run.mjs', [
    '组包测试', '--root', join(root, 'runs'), '--capabilities', config,
    '--material', material, '--brief', '判断 AI Agent 工作流是否值得采用'
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  const runDir = JSON.parse(initialized.stdout).run_dir;

  const built = run('create-topic-request.mjs', [runDir]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const requestPath = JSON.parse(built.stdout).request_path;
  const request = readJson(requestPath);
  assert.equal(request.mode, 'plan');
  assert.equal(request.output_dir, '01-discovery');
  assert.equal(request.interaction_policy, 'return_to_orchestrator');
  assert.deepEqual(request.expected_artifacts, [
    '01-discovery/discovery.md',
    '01-discovery/topic-candidates.md',
    '01-discovery/topic-candidates.json'
  ]);
  assert.deepEqual(
    request.inputs.slice(0, 6).map((item) => item.role),
    ['brief', 'materials', 'core_audience', 'platform_profiles', 'topic_history', 'article_audience']
  );
  const materialInput = request.inputs.find((item) => item.role === 'material:m-001');
  assert.equal(materialInput.path, '00-intake/raw/01-source.md');
  assert.equal(materialInput.sha256, sha(join(runDir, materialInput.path)));

  const adapter = resolve(skillDir, 'skills/content-topics/scripts/provider-contract.mjs');
  assert.ok(existsSync(adapter), adapter);
  const validated = spawnSync(process.execPath, [adapter, 'validate-request', requestPath], {
    cwd: skillDir,
    encoding: 'utf8'
  });
  assert.equal(validated.status, 0, validated.stderr || validated.stdout);
  assert.equal(JSON.parse(validated.stdout).status, 'PASS');

  const outsideOutput = join(root, 'outside-output');
  mkdirSync(outsideOutput);
  symlinkSync(outsideOutput, join(runDir, '01-discovery', 'link'));
  const escapedOutput = run('create-topic-request.mjs', [
    runDir, '--output', '01-discovery/link/request.json'
  ]);
  assert.equal(escapedOutput.status, 2);
  assert.ok(JSON.parse(escapedOutput.stdout).blockers.some((item) => item.code === 'topic_request_output_symlink'));
  assert.ok(!existsSync(join(outsideOutput, 'request.json')));

  const snapshotPath = join(runDir, materialInput.path);
  rmSync(snapshotPath);
  symlinkSync(material, snapshotPath);
  const tampered = run('create-topic-request.mjs', [runDir]);
  assert.equal(tampered.status, 2);
  assert.ok(JSON.parse(tampered.stdout).blockers.some((item) => item.code === 'material_snapshot_symlink'));
});

test('source request builder creates adapter-valid packets for brief, topic, and outline entries', () => {
  const root = tempDir('source-request');
  const config = makeCapabilityConfig(root);
  const material = join(root, 'source.md');
  const outline = join(root, 'outline.md');
  write(material, '# 用户素材\n\n受控工作流要求跨系统写入前人工确认。');
  write(outline, '# 用户大纲\n\n解释 AI Agent 工作流的采用边界。');
  const adapter = resolve(skillDir, 'skills/collect-sources/scripts/provider-contract.mjs');
  assert.ok(existsSync(adapter), adapter);

  const entries = [
    { mode: 'topic', args: ['--topic', 'AI Agent 工作流的采用边界'], expectedRole: 'discovery_skip' },
    { mode: 'outline', args: ['--outline', outline], expectedRole: 'provided_outline' },
    { mode: 'brief', args: ['--brief', '判断 AI Agent 工作流是否值得采用'], expectedRole: 'topic_decision' }
  ];

  for (const entry of entries) {
    const initialized = run('init-run.mjs', [
      `研究组包-${entry.mode}`, '--root', join(root, `runs-${entry.mode}`), '--capabilities', config,
      '--material', material, ...entry.args
    ]);
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    const runDir = JSON.parse(initialized.stdout).run_dir;

    if (entry.mode === 'brief') {
      const candidates = Array.from({ length: 5 }, (_, index) => ({
        id: `t-${index + 1}`, topic: `AI Agent 选题 ${index + 1}`, reader_problem: '采用边界不清楚',
        core_promise: '给出可核验边界', material_fit: 'high', timeliness: 'evergreen',
        differentiation: '聚焦受控写入', evidence_availability: 'high', risk: 'low',
        rank: index + 1, recommended: index === 0
      }));
      write(join(runDir, '01-discovery', 'discovery.md'), '# 选题发现\n\n受控证据信号。');
      write(join(runDir, '01-discovery', 'topic-candidates.md'), '# 五个选题候选\n\n已生成。');
      write(join(runDir, '01-discovery', 'topic-candidates.json'), JSON.stringify({ schema_version: 1, status: 'PASS', candidates }, null, 2));
      write(join(runDir, '01-discovery', 'topic-decision.v001.json'), JSON.stringify({ topic_id: 't-1' }, null, 2));
      assert.equal(run('set-stage.mjs', [runDir, 'discovery', 'running']).status, 0);
      assert.equal(run('set-stage.mjs', [
        runDir, 'discovery', 'completed',
        '--artifact', '01-discovery/discovery.md',
        '--artifact', '01-discovery/topic-candidates.md',
        '--artifact', '01-discovery/topic-candidates.json'
      ]).status, 0);
      const approved = run('set-gate.mjs', [
        runDir, 'topic', 'approved', '--decision', '01-discovery/topic-decision.v001.json',
        '--artifact', '01-discovery/topic-candidates.json'
      ]);
      assert.equal(approved.status, 0, approved.stderr || approved.stdout);
    }

    const built = run('create-source-request.mjs', [runDir]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const requestPath = JSON.parse(built.stdout).request_path;
    const request = readJson(requestPath);
    assert.equal(request.options.input_mode, entry.mode);
    assert.equal(request.mode, 'research');
    assert.equal(request.output_dir, '02-research');
    assert.equal(request.interaction_policy, 'return_to_orchestrator');
    assert.deepEqual(request.expected_artifacts, [
      '02-research/brief.md',
      '02-research/source-log.md',
      '02-research/claims.json',
      '02-research/evidence-map.md'
    ]);
    assert.ok(request.inputs.some((item) => item.role === 'research_subject'));
    assert.ok(request.inputs.some((item) => item.role === entry.expectedRole));
    assert.ok(request.inputs.some((item) => item.role === 'material:m-001'));

    const validated = spawnSync(process.execPath, [adapter, 'validate-request', requestPath], {
      cwd: skillDir,
      encoding: 'utf8'
    });
    assert.equal(validated.status, 0, validated.stderr || validated.stdout);
    assert.equal(JSON.parse(validated.stdout).status, 'PASS');

    if (entry.mode === 'topic') {
      const materialInput = request.inputs.find((item) => item.role === 'material:m-001');
      const snapshotPath = join(runDir, materialInput.path);
      rmSync(snapshotPath);
      symlinkSync(material, snapshotPath);
      const tampered = run('create-source-request.mjs', [runDir]);
      assert.equal(tampered.status, 2);
      assert.ok(JSON.parse(tampered.stdout).blockers.some((item) => item.code === 'source_input_symlink'));
    }
    if (entry.mode === 'outline') {
      const statePath = join(runDir, 'run.json');
      const outsideState = join(root, 'outside-run-state.json');
      write(outsideState, readFileSync(statePath, 'utf8'));
      rmSync(statePath);
      symlinkSync(outsideState, statePath);
      const tampered = run('create-source-request.mjs', [runDir]);
      assert.equal(tampered.status, 2);
      assert.ok(JSON.parse(tampered.stdout).blockers.some((item) => item.code === 'source_request_build_failed'));
    }
    if (entry.mode === 'brief') {
      write(join(runDir, '01-discovery', 'discovery.md'), '# 选题发现\n\n批准后被原地修改。');
      const tampered = run('create-source-request.mjs', [runDir]);
      assert.equal(tampered.status, 2);
      assert.ok(JSON.parse(tampered.stdout).blockers.some((item) => item.code === 'source_authority_drift'));
    }
  }
});

test('init-run requires exactly one creative brief, explicit topic, or outline', () => {
  const root = tempDir('intake-guard');
  const config = makeCapabilityConfig(root);
  const audience = join(root, 'audience.md');
  const style = join(root, 'style.md');
  const outline = join(root, 'outline.md');
  write(audience, '# 核心画像\n\n职场读者。');
  write(style, '# B 风格\n\n老同事聊干货。');
  write(outline, '# 大纲\n\n内容。');

  const missing = run('init-run.mjs', [
    '缺输入', '--root', join(root, 'runs'), '--capabilities', config,
    '--core-audience', audience, '--style-b', style
  ]);
  assert.equal(missing.status, 2);
  assert.ok(JSON.parse(missing.stdout).blockers.some((item) => item.code === 'missing_entry_input'));

  const ambiguous = run('init-run.mjs', [
    '双输入', '--root', join(root, 'runs'), '--capabilities', config,
    '--core-audience', audience, '--style-b', style,
    '--brief', '一句话', '--outline', outline
  ]);
  assert.equal(ambiguous.status, 2);
  assert.ok(JSON.parse(ambiguous.stdout).blockers.some((item) => item.code === 'ambiguous_entry_input'));
});

test('provided outline takes the fast entry but still stops at research', () => {
  const root = tempDir('outline-entry');
  const config = makeCapabilityConfig(root);
  const audience = join(root, 'audience.md');
  const style = join(root, 'style.md');
  const outline = join(root, 'outline.md');
  write(audience, '# 核心画像\n\n职场读者。');
  write(style, '# B 风格\n\n老同事聊干货。');
  write(outline, '# 用户大纲\n\n未经核验的结构。');
  const result = run('init-run.mjs', [
    '大纲入口', '--root', join(root, 'runs'), '--capabilities', config,
    '--core-audience', audience, '--style-b', style, '--outline', outline
  ]);
  assert.equal(result.status, 0, result.stdout);
  const state = readJson(join(JSON.parse(result.stdout).run_dir, 'run.json'));
  assert.equal(state.mode, 'outline_provided');
  assert.equal(state.gates.topic.status, 'approved');
  assert.equal(state.gates.outline.status, 'pending');
  assert.equal(state.current_stage, 'research');
  assert.equal(state.stages.discovery.status, 'completed');
  assert.equal(readJson(join(JSON.parse(result.stdout).run_dir, '01-discovery', 'skip.json')).mode, 'outline_provided');
});

test('a capability-blocked fast run resumes after the capability is restored', () => {
  const root = tempDir('capability-resume');
  const config = makeCapabilityConfig(root, { missing: 'proofreading' });
  const audience = join(root, 'audience.md');
  const style = join(root, 'style.md');
  write(audience, '# 核心画像\n\n职场读者。');
  write(style, '# B 风格\n\n老同事聊干货。');
  const initialized = run('init-run.mjs', [
    '恢复测试', '--root', join(root, 'runs'), '--capabilities', config,
    '--core-audience', audience, '--style-b', style, '--topic', '明确题目'
  ]);
  assert.equal(initialized.status, 2);
  const runDir = JSON.parse(initialized.stdout).run_dir;
  const proofreadingMarkers = capabilityMarkers.proofreading;
  write(join(root, 'skills', 'proofreading', 'SKILL.md'), `---\nname: proofread-content\ndescription: fixture\n---\n${proofreadingMarkers[1]}\n`);
  const resumed = run('inspect-run.mjs', [runDir, '--refresh-capabilities']);
  assert.equal(resumed.status, 0, resumed.stdout);
  assert.equal(JSON.parse(resumed.stdout).next_stage, 'research');
  const state = readJson(join(runDir, 'run.json'));
  assert.equal(state.stages.init.status, 'completed');
  assert.equal(state.stages.discovery.status, 'completed');
});

test('gate updates enforce order and invalidate downstream approvals', () => {
  const root = tempDir('gates');
  const runDir = join(root, 'run');
  mkdirSync(runDir, { recursive: true });
  write(join(runDir, 'run.json'), JSON.stringify({
    schema_version: 1,
    run_id: 'gate-run',
    status: 'running',
    current_stage: 'discovery',
    gates: Object.fromEntries(['topic', 'outline', 'titles', 'visual', 'final'].map((gate) => [gate, { status: 'pending' }]))
  }, null, 2));

  const tooEarly = run('set-gate.mjs', [runDir, 'outline', 'approved']);
  assert.equal(tooEarly.status, 2);

  assert.equal(run('set-gate.mjs', [runDir, 'topic', 'approved', '--decision', 'topic-1']).status, 0);
  write(join(runDir, 'control-outline.md'), '# 大纲 v1\n\n已确认。');
  write(join(runDir, 'A-structure.md'), '# A 结构\n\n基础。');
  write(join(runDir, 'B-structure.md'), '# B 结构\n\n风格。');
  assert.equal(run('set-gate.mjs', [
    runDir, 'outline', 'approved', '--decision', 'control-outline.md',
    '--artifact', 'A-structure.md', '--artifact', 'B-structure.md'
  ]).status, 0);
  const staged = readJson(join(runDir, 'run.json'));
  staged.gates.titles = { status: 'approved', revision: 1, bound_artifacts: [] };
  staged.gates.visual = { status: 'approved', revision: 1, bound_artifacts: [] };
  write(join(runDir, 'run.json'), JSON.stringify(staged, null, 2));
  write(join(runDir, 'control-outline.v002.md'), '# 大纲 v2\n\n修订后待确认。');
  write(join(runDir, 'A-structure.v002.md'), '# A 结构 v2\n\n基础。');
  write(join(runDir, 'B-structure.v002.md'), '# B 结构 v2\n\n风格。');
  assert.equal(run('set-gate.mjs', [
    runDir, 'outline', 'awaiting_approval', '--decision', 'control-outline.v002.md',
    '--artifact', 'A-structure.v002.md', '--artifact', 'B-structure.v002.md'
  ]).status, 0);
  const state = readJson(join(runDir, 'run.json'));
  assert.equal(state.gates.topic.status, 'approved');
  assert.equal(state.gates.outline.status, 'awaiting_approval');
  assert.equal(state.gates.titles.status, 'pending');
  assert.equal(state.gates.visual.status, 'pending');
});

test('autonomous runs record orchestrator decisions without awaiting approval', () => {
  const root = tempDir('autonomous-gate');
  const runDir = join(root, 'run');
  mkdirSync(runDir, { recursive: true });
  write(join(runDir, 'run.json'), JSON.stringify({
    schema_version: 2,
    run_id: 'auto-run',
    run_mode: 'autonomous',
    status: 'running',
    stages: { discovery: { status: 'completed' } },
    gates: Object.fromEntries(['topic', 'outline', 'titles', 'visual', 'final'].map((gate) => [gate, { status: 'pending', revision: 0, bound_artifacts: [] }])),
    invalidations: [],
    history: []
  }, null, 2));

  const waiting = run('set-gate.mjs', [runDir, 'topic', 'awaiting_approval']);
  assert.equal(waiting.status, 2);

  const approved = run('set-gate.mjs', [runDir, 'topic', 'approved', '--decision', '自动选择的题目']);
  assert.equal(approved.status, 0, approved.stdout);
  const state = readJson(join(runDir, 'run.json'));
  assert.equal(state.gates.topic.actor, 'orchestrator');
  assert.equal(state.gates.topic.approval_mode, 'autonomous');
});

test('approved artifact drift blocks subsequent gate operations', () => {
  const root = tempDir('gate-drift');
  const runDir = join(root, 'run');
  mkdirSync(runDir, { recursive: true });
  write(join(runDir, 'run.json'), JSON.stringify({
    schema_version: 1, run_id: 'drift-run', status: 'running', invalidations: [],
    gates: Object.fromEntries(['topic', 'outline', 'titles', 'visual', 'final'].map((gate) => [gate, { status: 'pending', revision: 0, bound_artifacts: [] }]))
  }, null, 2));
  assert.equal(run('set-gate.mjs', [runDir, 'topic', 'approved', '--decision', 'topic-1']).status, 0);
  write(join(runDir, 'control-outline.md'), '# 大纲\n\n第一版。');
  write(join(runDir, 'A-structure.md'), '# A 结构\n\n第一版。');
  write(join(runDir, 'B-structure.md'), '# B 结构\n\n第一版。');
  assert.equal(run('set-gate.mjs', [
    runDir, 'outline', 'approved', '--decision', 'control-outline.md',
    '--artifact', 'A-structure.md', '--artifact', 'B-structure.md'
  ]).status, 0);
  write(join(runDir, 'control-outline.md'), '# 大纲\n\n被原地覆盖。');
  const blocked = run('set-gate.mjs', [runDir, 'titles', 'awaiting_approval']);
  assert.equal(blocked.status, 2);
  assert.ok(JSON.parse(blocked.stdout).issues.some((item) => item.code === 'approved_artifact_drift'));
});

test('an awaiting decision may change before approval without leaving a stale binding', () => {
  const root = tempDir('decision-refresh');
  const runDir = join(root, 'run');
  mkdirSync(runDir, { recursive: true });
  write(join(runDir, 'run.json'), JSON.stringify({
    schema_version: 1, run_id: 'decision-run', status: 'running', invalidations: [],
    gates: Object.fromEntries(['topic', 'outline', 'titles', 'visual', 'final'].map((gate) => [gate, { status: 'pending', revision: 0, bound_artifacts: [] }]))
  }, null, 2));
  const topicCandidates = Array.from({ length: 5 }, (_, index) => ({
    id: `t-${index + 1}`, topic: `选题 ${index + 1}`, reader_problem: '问题', core_promise: '承诺',
    material_fit: 'high', timeliness: 'evergreen', differentiation: 'clear',
    evidence_availability: 'high', risk: 'low', rank: index + 1, recommended: index === 0
  }));
  write(join(runDir, 'topic-decision.v001.json'), JSON.stringify({ topic_id: 't-1' }, null, 2));
  write(join(runDir, 'topic-candidates.json'), JSON.stringify({ candidates: topicCandidates }, null, 2));
  assert.equal(run('set-gate.mjs', [
    runDir, 'topic', 'awaiting_approval', '--decision', 'topic-decision.v001.json', '--artifact', 'topic-candidates.json'
  ]).status, 0);
  write(join(runDir, 'topic-decision.v001.json'), JSON.stringify({ topic_id: 't-2' }, null, 2));
  topicCandidates[0].topic = '更新后的选题 1';
  write(join(runDir, 'topic-candidates.json'), JSON.stringify({ candidates: topicCandidates }, null, 2));
  assert.equal(run('set-gate.mjs', [runDir, 'topic', 'approved', '--decision', 'topic-decision.v001.json']).status, 0);
  assert.equal(run('set-gate.mjs', [runDir, 'topic', 'approved']).status, 0);
  const state = readJson(join(runDir, 'run.json'));
  assert.equal(state.gates.topic.decision_ref.sha256, sha(join(runDir, 'topic-decision.v001.json')));
  assert.equal(state.gates.topic.bound_artifacts.find((item) => item.path === 'topic-decision.v001.json').sha256, sha(join(runDir, 'topic-decision.v001.json')));
  assert.equal(state.gates.topic.bound_artifacts.find((item) => item.path === 'topic-candidates.json').sha256, sha(join(runDir, 'topic-candidates.json')));
});

test('stage state writer enforces prerequisites and records artifacts', () => {
  const root = tempDir('stages');
  const config = makeCapabilityConfig(root);
  const audience = join(root, 'audience.md');
  const style = join(root, 'style.md');
  write(audience, '# 核心画像\n\n职场读者。');
  write(style, '# B 风格\n\n老同事聊干货。');
  const initialized = run('init-run.mjs', [
    '阶段测试', '--root', join(root, 'runs'), '--capabilities', config,
    '--core-audience', audience, '--style-b', style, '--brief', '阶段测试主题'
  ]);
  const runDir = JSON.parse(initialized.stdout).run_dir;
  assert.equal(run('set-stage.mjs', [runDir, 'research', 'running']).status, 2);
  assert.equal(run('set-stage.mjs', [runDir, 'discovery', 'running']).status, 0);
  write(join(runDir, '01-discovery', 'topic-candidates.json'), JSON.stringify({ candidates: [] }, null, 2));
  assert.equal(run('set-stage.mjs', [runDir, 'discovery', 'completed', '--artifact', '01-discovery/topic-candidates.json']).status, 0);
  assert.equal(run('set-gate.mjs', [runDir, 'topic', 'approved', '--decision', 'fixture-topic']).status, 0);
  assert.equal(run('set-stage.mjs', [runDir, 'research', 'running']).status, 0);
  assert.equal(readJson(join(runDir, 'run.json')).stages.research.status, 'running');
  assert.equal(run('set-stage.mjs', [runDir, 'research', 'blocked', '--error', '关键来源冲突']).status, 0);
  const inspected = run('inspect-run.mjs', [runDir]);
  assert.equal(inspected.status, 2);
  assert.equal(JSON.parse(inspected.stdout).blocked_stage, 'research');
});

test('research stage completes only with a valid canonical evidence package', () => {
  const root = tempDir('research-stage');
  const config = makeCapabilityConfig(root);
  const createRun = (slug) => {
    const initialized = run('init-run.mjs', [
      slug, '--root', join(root, 'runs'), '--capabilities', config,
      '--topic', 'AI Agent 工作流的采用边界'
    ]);
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    return JSON.parse(initialized.stdout).run_dir;
  };
  const artifacts = [
    '02-research/brief.md',
    '02-research/source-log.md',
    '02-research/claims.json',
    '02-research/evidence-map.md'
  ];

  const passingRun = createRun('有效研究包');
  assert.equal(run('set-stage.mjs', [passingRun, 'research', 'running']).status, 0);
  writeResearchPackage(passingRun);
  writeResearchProviderEnvelope(passingRun);
  const completed = run('set-stage.mjs', [
    passingRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  assert.equal(readJson(join(passingRun, 'run.json')).stages.research.status, 'completed');

  const blockedRun = createRun('无效研究包');
  assert.equal(run('set-stage.mjs', [blockedRun, 'research', 'running']).status, 0);
  writeResearchPackage(blockedRun, { criticalStatus: 'unverified' });
  writeResearchProviderEnvelope(blockedRun);
  const blocked = run('set-stage.mjs', [
    blockedRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(blocked.status, 2);
  assert.ok(JSON.parse(blocked.stdout).issues.some((item) => item.code === 'critical_claim_unverified'));
  assert.equal(readJson(join(blockedRun, 'run.json')).stages.research.status, 'running');

  const symlinkRun = createRun('链接研究包');
  assert.equal(run('set-stage.mjs', [symlinkRun, 'research', 'running']).status, 0);
  writeResearchPackage(symlinkRun);
  writeResearchProviderEnvelope(symlinkRun);
  const claimsPath = join(symlinkRun, '02-research', 'claims.json');
  const outsideClaims = join(root, 'outside-claims.json');
  write(outsideClaims, readFileSync(claimsPath, 'utf8'));
  rmSync(claimsPath);
  symlinkSync(outsideClaims, claimsPath);
  const symlinked = run('set-stage.mjs', [
    symlinkRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(symlinked.status, 2);
  assert.ok(JSON.parse(symlinked.stdout).issues.some((item) => item.code === 'research_artifact_symlink'));
  assert.equal(readJson(join(symlinkRun, 'run.json')).stages.research.status, 'running');

  const missingResultRun = createRun('缺少 provider 结果');
  assert.equal(run('set-stage.mjs', [missingResultRun, 'research', 'running']).status, 0);
  writeResearchPackage(missingResultRun);
  const missingResult = run('set-stage.mjs', [
    missingResultRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(missingResult.status, 2);
  assert.ok(JSON.parse(missingResult.stdout).issues.some((item) => item.code === 'missing_research_provider_result'));

  const providerBlockedRun = createRun('provider 阻断');
  assert.equal(run('set-stage.mjs', [providerBlockedRun, 'research', 'running']).status, 0);
  writeResearchPackage(providerBlockedRun);
  writeResearchProviderEnvelope(providerBlockedRun, {
    status: 'BLOCKED',
    issue: { code: 'source_research_blocked', message: 'Evidence is insufficient.', resume_from: 'research' }
  });
  const providerBlocked = run('set-stage.mjs', [
    providerBlockedRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(providerBlocked.status, 2);
  assert.ok(JSON.parse(providerBlocked.stdout).issues.some((item) => item.code === 'research_provider_not_pass'));

  const inconsistentRun = createRun('证据映射不一致');
  assert.equal(run('set-stage.mjs', [inconsistentRun, 'research', 'running']).status, 0);
  writeResearchPackage(inconsistentRun);
  const evidencePath = join(inconsistentRun, '02-research', 'evidence-map.md');
  write(evidencePath, readFileSync(evidencePath, 'utf8')
    .replace('- 状态：verified', '- 状态：unverified')
    .replace('- 可进入下游：yes', '- 可进入下游：no'));
  writeResearchProviderEnvelope(inconsistentRun);
  const inconsistent = run('set-stage.mjs', [
    inconsistentRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(inconsistent.status, 2);
  assert.ok(JSON.parse(inconsistent.stdout).issues.some((item) => item.code === 'evidence_claim_mismatch'));

  const sourceSetRun = createRun('证据来源集合不一致');
  assert.equal(run('set-stage.mjs', [sourceSetRun, 'research', 'running']).status, 0);
  writeResearchPackage(sourceSetRun);
  const sourceSetEvidence = join(sourceSetRun, '02-research', 'evidence-map.md');
  write(sourceSetEvidence, readFileSync(sourceSetEvidence, 'utf8').replace(
    '- 来源：s-001', '- 来源：s-001, s-999'
  ));
  writeResearchProviderEnvelope(sourceSetRun);
  const sourceSet = run('set-stage.mjs', [
    sourceSetRun, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(sourceSet.status, 2);
  assert.ok(JSON.parse(sourceSet.stdout).issues.some((item) => item.code === 'evidence_source_set_mismatch'));
});

test('claim regression blocks new numbers and personal-experience claims', () => {
  const root = tempDir('claims');
  const before = join(root, 'before.md');
  const after = join(root, 'after.md');
  const claims = join(root, 'claims.json');
  write(before, '# 正文\n\n这个功能更方便。');
  write(after, '# 正文\n\n我连续用了 7 天，工作效率提升了 30%。');
  write(claims, JSON.stringify({ claims: [] }, null, 2));

  const result = run('check-claim-regression.mjs', ['--before', before, '--after', after, '--claims', claims]);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.blockers.some((item) => item.code === 'new_numeric_claim'));
  assert.ok(report.blockers.some((item) => item.code === 'new_personal_experience'));

  write(after, '# 正文\n\n工作效率提升了 30%。');
  write(claims, JSON.stringify({
    claims: [{ id: 'c-001', status: 'verified', text: '工作效率提升了 30%。' }]
  }, null, 2));
  const verifiedButNew = run('check-claim-regression.mjs', ['--before', before, '--after', after, '--claims', claims]);
  assert.equal(verifiedButNew.status, 2);
  assert.ok(JSON.parse(verifiedButNew.stdout).blockers.some((item) => item.code === 'new_numeric_claim'));
});

test('claim regression blocks stronger certainty and removed qualifiers', () => {
  const root = tempDir('claim-strength');
  const before = join(root, 'before.md');
  const after = join(root, 'after.md');
  const claims = join(root, 'claims.json');
  write(before, '# 正文\n\n这项研究可能提高团队效率。');
  write(after, '# 正文\n\n这项研究一定提高团队效率。');
  write(claims, JSON.stringify({ claims: [] }, null, 2));
  const result = run('check-claim-regression.mjs', ['--before', before, '--after', after, '--claims', claims, '--phase', 'humanize']);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blockers.some((item) => item.code === 'certainty_strengthened'));
  assert.ok(report.blockers.some((item) => item.code === 'qualifier_removed'));
  assert.match(report.before_sha256, /^[a-f0-9]{64}$/);
  assert.match(report.after_sha256, /^[a-f0-9]{64}$/);
  assert.match(report.claims_sha256, /^[a-f0-9]{64}$/);
});

test('semantic review is required and can block a non-numeric new conclusion', () => {
  const root = tempDir('semantic-review');
  const before = join(root, 'before.md');
  const after = join(root, 'after.md');
  const claims = join(root, 'claims.json');
  const reportPath = join(root, 'report.json');
  write(before, '# 正文\n\n这是一款工具。');
  write(after, '# 正文\n\n这是一款工具。因此它会改变整个行业。');
  write(claims, JSON.stringify({ claims: [] }, null, 2));
  const automatic = run('check-claim-regression.mjs', [
    '--before', before, '--after', after, '--claims', claims, '--phase', 'final', '--output', reportPath
  ]);
  assert.equal(automatic.status, 0);
  assert.equal(readJson(reportPath).status, 'PENDING_SEMANTIC_REVIEW');
  const anonymous = run('set-semantic-review.mjs', [
    reportPath, '--reviewer', ...semanticPassArgs
  ]);
  assert.equal(anonymous.status, 2);
  const reviewed = run('set-semantic-review.mjs', [
    reportPath, '--reviewer', 'fixture-reviewer', '--new-conclusion', 'BLOCKED',
    '--scope-change', 'PASS', '--causal-strength', 'PASS',
    '--factual-addition', 'BLOCKED', '--factual-omission', 'PASS', '--proper-noun-drift', 'PASS',
    '--notes', '新增了行业级结论'
  ]);
  assert.equal(reviewed.status, 2);
  assert.equal(readJson(reportPath).semantic_review.status, 'BLOCKED');
});

test('final verification accepts a complete package and rejects a broken image reference', () => {
  const root = tempDir('verify');
  const runDir = join(root, 'run');
  baseRun(runDir);

  const ready = run('verify-run.mjs', [runDir]);
  assert.equal(ready.status, 0, ready.stderr);
  assert.equal(JSON.parse(ready.stdout).status, 'READY');
  assert.equal(readJson(join(runDir, '09-qa', 'qa.json')).status, 'READY');
  assert.ok(readFileSync(join(runDir, '09-qa', 'handoff.md'), 'utf8').includes('人工发布'));

  write(join(runDir, '08-publish-pack', 'zhihu', 'final.md'), '# 知乎\n\n![缺图](images/missing.png)');
  const blocked = run('verify-run.mjs', [runDir]);
  assert.equal(blocked.status, 2);
  const report = JSON.parse(blocked.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.issues.some((item) => item.code === 'completed_artifact_drift'));
});

test('final verification accepts provider-owned WeChat cover metadata without package fields', () => {
  const root = tempDir('provider-cover');
  const runDir = join(root, 'run');
  baseRun(runDir);
  const metadataPath = replaceLegacyCoverWithProvider(runDir);
  const metadata = readJson(join(runDir, metadataPath));
  assert.equal(Object.hasOwn(metadata, 'publish_file'), false);
  assert.equal(Object.hasOwn(metadata, 'optimization'), false);

  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).status, 'READY');
});

test('final verification requires the completed editing stage to retain exact 90-file bindings', () => {
  const root = tempDir('editing-bindings');
  const runDir = join(root, 'run');
  baseRun(runDir);
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.stages.editing.artifacts.pop();
  write(statePath, JSON.stringify(state, null, 2));
  const blocked = run('verify-run.mjs', [runDir]);
  assert.equal(blocked.status, 2);
  assert.ok(JSON.parse(blocked.stdout).issues.some((item) => item.code === 'invalid_proofreading_editing_binding'));
});

test('final verification requires a complete manifest with no untracked pack images', () => {
  const root = tempDir('manifest');
  const runDir = join(root, 'run');
  baseRun(runDir);
  rmSync(join(runDir, '07-visual', 'weibo', 'manifest.json'));
  write(join(runDir, '08-publish-pack', 'zhihu', 'images', 'unused.png'), 'unused');
  write(join(runDir, '08-publish-pack', 'wechat', 'article.html'), '<html><body><img src="images/01-cover.png"></body></html>');
  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.issues.some((item) => item.code === 'missing_visual_manifest'));
  assert.ok(report.issues.some((item) => item.code === 'untracked_publish_image'));
  assert.ok(report.issues.some((item) => item.code === 'html_body_loss'));
});

test('final verification requires five optimization reports and a dedicated 1923x818 WeChat cover', () => {
  const root = tempDir('delivery-contract');
  const runDir = join(root, 'run');
  baseRun(runDir);

  writeBinary(join(runDir, '08-publish-pack', 'wechat', 'cover.png'), pngHeader(1200, 628));
  rmSync(join(runDir, '08-publish-pack', 'weibo', 'optimization.json'));

  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.issues.some((item) => item.code === 'invalid_wechat_cover_dimensions'));
  assert.ok(report.issues.some((item) => item.code === 'missing_optimization_report'));
});

test('standard mode cannot finish without discovery artifacts and a bound topic decision', () => {
  const root = tempDir('standard-discovery');
  const runDir = join(root, 'run');
  baseRun(runDir);
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.mode = 'standard';
  write(statePath, JSON.stringify(state, null, 2));
  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.issues.some((item) => item.code === 'missing_artifact' && item.path === '01-discovery/discovery.md'));
  assert.ok(report.issues.some((item) => item.code === 'topic_decision_not_bound'));
});

test('final verification enforces exact title counts and B style provenance', () => {
  const root = tempDir('contract-blockers');
  const runDir = join(root, 'run');
  baseRun(runDir);
  const titlesPath = join(runDir, '06-selection', 'titles.json');
  const titles = readJson(titlesPath);
  titles.platforms.weibo.B.candidates.pop();
  write(titlesPath, JSON.stringify(titles, null, 2));
  const provenancePath = join(runDir, '04-masters', 'B', 'provenance.json');
  const provenance = readJson(provenancePath);
  provenance.input_hashes.style_b = null;
  write(provenancePath, JSON.stringify(provenance, null, 2));
  const audiencePath = join(runDir, '05-platforms', 'wechat', 'A', 'audience-snapshot.json');
  const audience = readJson(audiencePath);
  audience.merge_order = ['platform_overlay', 'core_audience', 'article_segment'];
  write(audiencePath, JSON.stringify(audience, null, 2));

  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.issues.some((item) => item.code === 'incorrect_title_count'));
  assert.ok(report.issues.some((item) => item.code === 'b_style_missing'));
  assert.ok(report.issues.some((item) => item.code === 'audience_snapshot_contract_mismatch'));
});

test('titles gate refuses approval without one matching title matrix', () => {
  const root = tempDir('title-matrix-gate');
  const runDir = join(root, 'run');
  baseRun(runDir);
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.gates.titles = { status: 'awaiting_approval', revision: 1, decision_ref: null, bound_artifacts: [] };
  state.gates.visual = { status: 'pending', revision: 0, bound_artifacts: [] };
  state.gates.final = { status: 'pending', revision: 0, bound_artifacts: [] };
  write(statePath, JSON.stringify(state, null, 2));
  const result = run('set-gate.mjs', [
    runDir, 'titles', 'approved', '--decision', '06-selection/selection.v001.json',
    '--artifact', '06-selection/titles.json'
  ]);
  assert.equal(result.status, 2);
  assert.match(JSON.parse(result.stdout).message, /exactly one title-matrix/);
});

test('reviewed title choices remain valid through final QA', () => {
  const root = tempDir('reviewed-title-choice');
  const runDir = join(root, 'run');
  baseRun(runDir, { runMode: 'reviewed' });

  const titles = readJson(join(runDir, '06-selection', 'titles.json'));
  const selected = titles.platforms.wechat.A.candidates[1];
  const selectionPath = join(runDir, '06-selection', 'selection.v001.json');
  const decision = readJson(selectionPath);
  decision.decision_rule = 'reviewed_user_choice';
  decision.selections = decision.selections.map((item) => ({
    ...item,
    ...(item.platform === 'wechat' ? { title_id: selected.id, title: selected.title } : {}),
    decision_rule: 'reviewed_user_choice'
  }));
  write(selectionPath, JSON.stringify(decision, null, 2));

  const packPath = join(runDir, '08-publish-pack', 'wechat', 'final.md');
  write(packPath, readFileSync(packPath, 'utf8').replace(/^# [^\n]+/u, `# ${selected.title}`));
  const metadataPath = join(runDir, '08-publish-pack', 'wechat', 'metadata.json');
  const metadata = readJson(metadataPath);
  metadata.title_id = selected.id;
  metadata.title = selected.title;
  metadata.final_md_sha256 = sha(packPath);
  write(metadataPath, JSON.stringify(metadata, null, 2));
  const layoutPath = join(runDir, '08-publish-pack', 'wechat', 'layout-result.json');
  const layout = readJson(layoutPath);
  layout.source_markdown_sha256 = sha(packPath);
  write(layoutPath, JSON.stringify(layout, null, 2));
  const coverPath = join(runDir, '07-visual', 'wechat-cover', 'cover.json');
  const cover = readJson(coverPath);
  cover.title_id = selected.id;
  write(coverPath, JSON.stringify(cover, null, 2));

  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  const bind = (path) => ({ path, sha256: sha(join(runDir, path)) });
  state.gates.titles.decision_ref = bind('06-selection/selection.v001.json');
  state.gates.titles.bound_artifacts = state.gates.titles.bound_artifacts.map((item) =>
    item.path === '06-selection/selection.v001.json' ? bind(item.path) : item);
  state.platform_selections = Object.fromEntries(decision.selections.map((item) => [item.platform, item]));
  write(statePath, JSON.stringify(state, null, 2));

  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).status, 'READY');
});

test('final verification follows versioned outline and visual artifacts bound by approved gates', () => {
  const root = tempDir('active-versions');
  const runDir = join(root, 'run');
  baseRun(runDir);
  write(join(runDir, '03-outline', 'control-outline.v002.md'), '# 大纲 v2\n\n- c-001：已批准的新结构。');
  write(join(runDir, '03-outline', 'A-structure.v002.md'), '# A 结构 v2\n\n基础。');
  write(join(runDir, '03-outline', 'B-structure.v002.md'), '# B 结构 v2\n\n风格。');
  for (const platform of platforms) {
    write(join(runDir, '07-visual', platform, 'plan.v002.json'), readFileSync(join(runDir, '07-visual', platform, 'plan.json'), 'utf8'));
    write(join(runDir, '07-visual', platform, 'shot-list.v002.md'), readFileSync(join(runDir, '07-visual', platform, 'shot-list.md'), 'utf8'));
  }
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  const bind = (path) => ({ path, sha256: sha(join(runDir, path)) });
  state.gates.outline.decision_ref = bind('03-outline/control-outline.v002.md');
  state.gates.outline.bound_artifacts = [
    bind('03-outline/control-outline.v002.md'), bind('03-outline/A-structure.v002.md'), bind('03-outline/B-structure.v002.md')
  ];
  state.gates.visual.bound_artifacts = platforms.flatMap((platform) => [
    bind(`07-visual/${platform}/plan.v002.json`), bind(`07-visual/${platform}/shot-list.v002.md`)
  ]);
  for (const variant of variants) {
    const provenancePath = join(runDir, '04-masters', variant, 'provenance.json');
    const provenance = readJson(provenancePath);
    provenance.input_hashes.control_outline = sha(join(runDir, '03-outline', 'control-outline.v002.md'));
    provenance.input_paths.control_outline = '03-outline/control-outline.v002.md';
    provenance.input_hashes.structure = sha(join(runDir, '03-outline', `${variant}-structure.v002.md`));
    provenance.input_paths.structure = `03-outline/${variant}-structure.v002.md`;
    write(provenancePath, JSON.stringify(provenance, null, 2));
  }
  write(statePath, JSON.stringify(state, null, 2));
  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).status, 'READY');
});

test('final verification blocks an unverified critical claim', () => {
  const root = tempDir('critical-claim');
  const runDir = join(root, 'run');
  baseRun(runDir);
  const claimsPath = join(runDir, '02-research', 'claims.json');
  const claims = readJson(claimsPath);
  claims.claims[0].status = 'unverified';
  claims.claims[0].source_ids = [];
  write(claimsPath, JSON.stringify(claims, null, 2));
  const result = run('verify-run.mjs', [runDir]);
  assert.equal(result.status, 2);
  assert.ok(JSON.parse(result.stdout).issues.some((item) => item.code === 'unverified_critical_claim'));
});

test('READY run can pass the final gate and completed resume is idempotent', () => {
  const root = tempDir('complete');
  const runDir = join(root, 'run');
  baseRun(runDir);
  assert.equal(run('verify-run.mjs', [runDir]).status, 0);
  const approve = run('set-gate.mjs', [runDir, 'final', 'approved', '--decision', '09-qa/qa.json']);
  assert.equal(approve.status, 0, approve.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).status, 'completed');
  const inspect = run('inspect-run.mjs', [runDir]);
  assert.equal(inspect.status, 0);
  assert.equal(JSON.parse(inspect.stdout).status, 'COMPLETED');
  assert.equal(run('verify-run.mjs', [runDir]).status, 0);
  const linkedPath = join(runDir, '05-platforms', 'wechat', 'A', 'final.md');
  const linkedBytes = readFileSync(linkedPath, 'utf8');
  const external = join(root, 'external-final.md');
  write(external, linkedBytes);
  rmSync(linkedPath);
  symlinkSync(external, linkedPath);
  const inspectSymlink = run('inspect-run.mjs', [runDir]);
  assert.equal(inspectSymlink.status, 2);
  assert.ok(JSON.parse(inspectSymlink.stdout).issues.some((item) => item.code === 'completed_artifact_symlink'));
  const verifySymlink = run('verify-run.mjs', [runDir]);
  assert.equal(verifySymlink.status, 2);
  assert.ok(JSON.parse(verifySymlink.stdout).issues.some((item) => item.code === 'completed_artifact_symlink'));
  rmSync(linkedPath);
  write(linkedPath, linkedBytes);
  write(join(runDir, '08-publish-pack', 'zhihu', 'final.md'), '# 被修改的已完成交付\n\n内容漂移。');
  const inspectDrift = run('inspect-run.mjs', [runDir]);
  assert.equal(inspectDrift.status, 2);
  assert.ok(JSON.parse(inspectDrift.stdout).issues.some((item) => item.code === 'completed_artifact_drift'));
  const drift = run('verify-run.mjs', [runDir]);
  assert.equal(drift.status, 2);
  assert.ok(JSON.parse(drift.stdout).issues.some((item) => item.code === 'completed_artifact_drift'));
});

test('final gate rechecks QA fingerprints immediately before approval', () => {
  const root = tempDir('final-race');
  const runDir = join(root, 'run');
  baseRun(runDir);
  assert.equal(run('verify-run.mjs', [runDir]).status, 0);
  write(join(runDir, '08-publish-pack', 'weibo', 'final.md'), '# QA 后被修改\n\n漂移。');
  write(join(runDir, '08-publish-pack', 'weibo', 'images', 'after-qa.png'), 'late file');
  const approval = run('set-gate.mjs', [runDir, 'final', 'approved', '--decision', '09-qa/qa.json']);
  assert.equal(approval.status, 2);
  const report = JSON.parse(approval.stdout);
  assert.ok(report.issues.some((item) => item.code === 'completed_artifact_drift'));
  assert.ok(report.issues.some((item) => item.code === 'untracked_post_qa_artifact'));
  const inspected = run('inspect-run.mjs', [runDir]);
  assert.equal(inspected.status, 2);
  assert.ok(JSON.parse(inspected.stdout).issues.some((item) => item.code === 'completed_artifact_drift'));
});

function runDraftingAdapter(args) {
  const adapter = resolve(skillDir, 'skills', 'draft-content', 'scripts', 'provider-contract.mjs');
  return spawnSync(process.execPath, [adapter, ...args], { cwd: skillDir, encoding: 'utf8' });
}

function runProofreadingAdapter(args) {
  const adapter = resolve(skillDir, 'skills', 'proofread-content', 'scripts', 'provider-contract.mjs');
  return spawnSync(process.execPath, [adapter, ...args], { cwd: skillDir, encoding: 'utf8' });
}

function runTitleAdapter(args) {
  const adapter = resolve(skillDir, 'skills', 'title-options', 'scripts', 'provider-contract.mjs');
  return spawnSync(process.execPath, [adapter, ...args], { cwd: skillDir, encoding: 'utf8' });
}

function prepareTitleStageRun(runDir) {
  baseRun(runDir);
  const statePath = join(runDir, 'run.json');
  const state = readJson(statePath);
  state.status = 'running';
  state.current_stage = 'titles';
  state.resume = { next_stage: 'titles', reason: 'stage_pending' };
  state.stages.titles = { status: 'pending', attempt: 0, artifacts: [], error: null };
  for (const stage of ['visual', 'package', 'final_qa']) {
    state.stages[stage] = { status: 'pending', attempt: state.stages[stage]?.attempt || 0, artifacts: [], error: null };
  }
  for (const gate of ['titles', 'visual', 'final']) {
    state.gates[gate] = { status: 'pending', revision: state.gates[gate]?.revision || 0, decision_ref: null, bound_artifacts: [] };
  }
  state.platform_selections = {};
  write(statePath, JSON.stringify(state, null, 2));
  for (const path of [
    '06-selection/titles.json', '06-selection/title-matrix.md', '06-selection/selection.v001.json'
  ]) rmSync(join(runDir, path), { force: true });
  rmSync(join(runDir, '06-selection', 'providers'), { recursive: true, force: true });
}

function writeTitleProviderArtifact(runDir, request) {
  const anchor = '在本次受控工作流中，跨系统写入前需要人工确认；这个边界只适用于当前材料，不能外推到所有产品。';
  const strategies = ['BOUNDARY_CLARITY', 'DECISION_GUIDE', 'VALUE_FIRST', 'PROBLEM_ANSWER', 'PERSPECTIVE'];
  const count = titleCounts[request.platform];
  const candidates = Array.from({ length: count }, (_, index) => ({
    id: `${request.platform}-${request.variant}-${index + 1}`,
    title: `${request.platform} ${request.variant} 标题 ${index + 1}`,
    rank: index + 1,
    strategy_id: strategies[index],
    recommended: index < Math.min(3, count),
    promise_map: [anchor],
    promise_status: 'PASS',
    risk: index === 0 ? 'none' : 'low',
    topic_phrase: request.platform === 'weibo' ? '#AI工作流采用边界#' : null
  }));
  const output = {
    schema_version: 1,
    task_id: request.task_id,
    status: 'PASS',
    platform: request.platform,
    variant: request.variant,
    source: request.inputs[0],
    target_count: count,
    recommendation_count: Math.min(3, count),
    candidates
  };
  const path = join(runDir, request.expected_artifacts[0]);
  write(path, JSON.stringify(output, null, 2));
  return path;
}

function createDraftingRun(root, slug = 'drafting-run') {
  const config = makeCapabilityConfig(root);
  const initialized = run('init-run.mjs', [
    slug, '--root', join(root, 'runs'), '--capabilities', config,
    '--topic', 'AI Agent 工作流的采用边界'
  ]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const runDir = JSON.parse(initialized.stdout).run_dir;
  assert.equal(run('set-stage.mjs', [runDir, 'research', 'running']).status, 0);
  assert.equal(run('create-source-request.mjs', [runDir]).status, 0);
  writeResearchPackage(runDir);
  writeResearchProviderEnvelope(runDir);
  const artifacts = ['brief.md', 'source-log.md', 'claims.json', 'evidence-map.md']
    .map((name) => `02-research/${name}`);
  const completed = run('set-stage.mjs', [
    runDir, 'research', 'completed', ...artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  return runDir;
}

function writeOutlineProviderArtifacts(runDir, request) {
  const [controlRelative, aRelative, bRelative] = request.expected_artifacts;
  const controlPath = join(runDir, controlRelative);
  write(controlPath, `---
artifact: ControlOutline
status: PASS
---
# 控制大纲

## 写作目标

解释 AI Agent 工作流的采用边界。

## 证据结构

### c-001

跨系统写入前需要人工确认。

## 事实边界

不外推到所有 Agent 产品。

## 平台适配约束

五个平台只改变表达，不改变事实。`);
  const controlHash = sha(controlPath);
  for (const [variant, relative] of [['A', aRelative], ['B', bRelative]]) {
    write(join(runDir, relative), `---
artifact: BranchStructure
status: PASS
variant: ${variant}
control_outline_path: ${controlRelative}
control_outline_sha256: ${controlHash}
---
# ${variant} 结构

## 开场

从采用边界进入。

## 主体

沿用 c-001。

## 收束

给出判断。`);
  }
  return request;
}

function writeMasterProviderArtifacts(runDir, request) {
  const { variant } = request.options;
  const base = join(runDir, '04-masters', variant);
  const finalPath = join(base, 'final.md');
  const section = '在本次受控工作流中，跨系统写入前需要人工确认；这个边界只适用于当前材料，不能外推到所有产品。';
  write(finalPath, `# ${variant} 母稿

## 问题与边界

${section.repeat(5)}

## 核心论证

${section.repeat(5)}

## 行动判断

${section.repeat(5)}`);
  write(join(base, 'review.md'), `---
artifact: DraftingReview
status: PASS
---
# 母稿检查

## 事实边界

PASS

## 结构检查

PASS

## 越界检查

PASS`);
  const inputs = Object.fromEntries(request.inputs.map((item) => [item.role, item]));
  const inputPaths = Object.fromEntries(Object.entries(inputs).map(([role, item]) => [role, item.path]));
  const inputHashes = Object.fromEntries(Object.entries(inputs).map(([role, item]) => [role, item.sha256]));
  inputPaths.style_b ??= null;
  inputHashes.style_b ??= null;
  write(join(base, 'provenance.json'), JSON.stringify({
    schema_version: 1,
    task_id: request.task_id,
    mode: 'master',
    variant,
    model: request.options.model,
    parameters: request.options.parameters,
    claim_ids: ['c-001'],
    input_paths: inputPaths,
    input_hashes: inputHashes,
    style_b_path: inputs.style_b?.path ?? null,
    style_b_sha256: inputs.style_b?.sha256 ?? null,
    output_path: `04-masters/${variant}/final.md`,
    output_sha256: sha(finalPath)
  }, null, 2));
}

function writeAdaptProviderArtifacts(runDir, request) {
  const { platform, variant } = request.options;
  const base = join(runDir, '05-platforms', platform, variant);
  const draftPath = join(base, 'draft.md');
  const audiencePath = join(base, 'audience-snapshot.md');
  const section = '在本次受控工作流中，跨系统写入前需要人工确认；这个边界只适用于当前材料，不能外推到所有产品。';
  const body = platform === 'xiaohongshu'
    ? `# 小红书 ${variant} 初稿

## 发布正文

${section.repeat(5)}

## 卡片文案

${Array.from({ length: 6 }, (_, index) => `### 第 ${index + 1} 页\n\n采用边界要点 ${index + 1}：${section}`).join('\n\n')}

## 标签

#AI工具 #工作流 #团队协作 #风险控制 #知识工作`
    : platform === 'weibo'
      ? `# 微博 ${variant} 初稿

${section.repeat(3)}`
      : `# ${platform} ${variant} 初稿

## 问题与边界

${section.repeat(4)}

## 核心解释

${section.repeat(4)}

## 行动建议

${section.repeat(4)}`;
  write(draftPath, body);
  const inputs = Object.fromEntries(request.inputs.map((item) => [item.role, item]));
  assert.equal(inputs.audience_snapshot.path, `05-platforms/${platform}/${variant}/audience-snapshot.md`);
  assert.equal(inputs.audience_snapshot.sha256, sha(audiencePath));
  assert.equal(inputs.audience_manifest.path, `05-platforms/${platform}/${variant}/audience-snapshot.json`);
  assert.equal(inputs.audience_manifest.sha256, sha(join(base, 'audience-snapshot.json')));
  write(join(base, 'provenance.json'), JSON.stringify({
    schema_version: 1,
    task_id: request.task_id,
    mode: 'adapt',
    platform,
    variant,
    model: request.options.model,
    parameters: request.options.parameters,
    source_master_path: inputs.source_master.path,
    source_master_sha256: inputs.source_master.sha256,
    master_provenance_path: inputs.master_provenance.path,
    master_provenance_sha256: inputs.master_provenance.sha256,
    audience_snapshot_path: `05-platforms/${platform}/${variant}/audience-snapshot.md`,
    audience_snapshot_sha256: sha(audiencePath),
    style_b_path: inputs.style_b?.path ?? null,
    style_b_sha256: inputs.style_b?.sha256 ?? null,
    output_path: `05-platforms/${platform}/${variant}/draft.md`,
    output_sha256: sha(draftPath)
  }, null, 2));
}

function writeProofreadingProviderArtifacts(runDir, request) {
  const { platform, variant } = request;
  const base = join(runDir, '05-platforms', platform, variant);
  const draftRelative = `05-platforms/${platform}/${variant}/draft.md`;
  const draft = readFileSync(join(runDir, draftRelative), 'utf8');
  const checkpoints = {
    logic: `05-platforms/${platform}/${variant}/logic-final.md`,
    humanize: `05-platforms/${platform}/${variant}/humanized.md`,
    detail: `05-platforms/${platform}/${variant}/final.md`
  };
  for (const path of Object.values(checkpoints)) write(join(runDir, path), draft);
  const chain = {
    logic: { source: draftRelative, output: checkpoints.logic },
    humanize: { source: checkpoints.logic, output: checkpoints.humanize },
    detail: { source: checkpoints.humanize, output: checkpoints.detail }
  };
  const reviews = {};
  for (const phase of ['logic', 'humanize', 'detail']) {
    const reviewPath = `05-platforms/${platform}/${variant}/reviews/${phase}.md`;
    write(join(runDir, reviewPath), `---
artifact: ProofreadReview
status: PASS
phase: ${phase}
source_path: ${chain[phase].source}
source_sha256: ${sha(join(runDir, chain[phase].source))}
output_path: ${chain[phase].output}
output_sha256: ${sha(join(runDir, chain[phase].output))}
---
# ${phase} 审校

本轮检查通过。`);
    reviews[phase] = reviewPath;
  }
  const checkpointBindings = Object.fromEntries(['logic', 'humanize', 'detail'].map((phase) => [phase, {
    path: checkpoints[phase], sha256: sha(join(runDir, checkpoints[phase])),
    review_path: reviews[phase], review_sha256: sha(join(runDir, reviews[phase]))
  }]));
  write(join(base, 'reviews', 'proofread-result.json'), JSON.stringify({
    schema_version: 1,
    task_id: request.task_id,
    status: 'PASS',
    platform,
    variant,
    source: request.inputs[0],
    checkpoints: checkpointBindings,
    hard_gates: {
      title: 'PASS', heading_structure: 'PASS', frontmatter: 'PASS',
      protected_literals: 'PASS', markdown_semantics: 'PASS', no_fabrication: 'PASS',
      humanizer_ledger: 'PASS', platform_register: 'PASS'
    },
    humanizer_ledger: Array.from({ length: 24 }, (_, index) => ({ id: index + 1, status: 'no_hit', reason: null })),
    changes: { pass_1: '完成逻辑检查。', pass_2: '完成自然化检查。', pass_3: '完成细节检查。' }
  }, null, 2));
}

test('title requests aggregate ten isolated provider tasks into 34 candidates and five winners', () => {
  const root = tempDir('title-pipeline');
  const runDir = join(root, 'run');
  prepareTitleStageRun(runDir);

  const pending = run('create-title-request.mjs', [runDir, '--platform', 'wechat', '--variant', 'A']);
  assert.equal(pending.status, 2);
  assert.ok(JSON.parse(pending.stdout).blockers.some((item) => item.code === 'title_request_stage_mismatch'));
  assert.equal(run('set-stage.mjs', [runDir, 'titles', 'running']).status, 0);

  const tooEarly = run('aggregate-titles.mjs', [runDir]);
  assert.equal(tooEarly.status, 2);

  const tasks = {};
  const candidateArtifacts = [];
  for (const platform of platforms) {
    for (const variant of variants) {
      const sourcePath = join(runDir, '05-platforms', platform, variant, 'final.md');
      const sourceHash = sha(sourcePath);
      const built = run('create-title-request.mjs', [
        runDir, '--platform', platform, '--variant', variant,
        '--model', 'fixture-model', '--parameters-json', '{"temperature":0.4}'
      ]);
      assert.equal(built.status, 0, built.stderr || built.stdout);
      const requestPath = JSON.parse(built.stdout).request_path;
      const request = readJson(requestPath);
      tasks[`${platform}:${variant}`] = { request, requestPath };
      assert.equal(request.task_id, `title:${readJson(join(runDir, 'run.json')).run_id}:${platform}:${variant}:attempt-001`);
      assert.deepEqual(request.inputs.map((item) => item.role), ['final_draft']);
      assert.equal(request.inputs[0].path, `05-platforms/${platform}/${variant}/final.md`);
      assert.equal(request.inputs[0].sha256, sourceHash);
      assert.equal(request.options.count, titleCounts[platform]);
      assert.equal(request.options.verification_scope, 'none');
      assert.equal(runTitleAdapter(['validate-request', requestPath]).status, 0);
      writeTitleProviderArtifact(runDir, request);
      const finalized = runTitleAdapter(['finalize', requestPath]);
      assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
      assert.equal(sha(sourcePath), sourceHash);
      candidateArtifacts.push(request.expected_artifacts[0]);
    }
  }
  assert.equal(candidateArtifacts.length, 10);

  const upstreamReviewPath = join(runDir, '05-platforms', 'wechat', 'A', 'reviews', 'logic.md');
  const upstreamReviewBytes = readFileSync(upstreamReviewPath);
  write(upstreamReviewPath, `${upstreamReviewBytes.toString('utf8')}\n上游完成后漂移。`);
  const upstreamDrift = run('aggregate-titles.mjs', [runDir]);
  assert.equal(upstreamDrift.status, 2);
  assert.ok(JSON.parse(upstreamDrift.stdout).issues.some((item) =>
    ['proofreading_provider_artifact_drift', 'proofreading_editing_binding_drift'].includes(item.code)));
  writeFileSync(upstreamReviewPath, upstreamReviewBytes);

  const mismatchPath = tasks['wechat:B'].requestPath;
  const mismatch = readJson(mismatchPath);
  mismatch.options.model = 'different-model';
  write(mismatchPath, JSON.stringify(mismatch, null, 2));
  assert.equal(runTitleAdapter(['finalize', mismatchPath]).status, 0);
  const mismatched = run('aggregate-titles.mjs', [runDir]);
  assert.equal(mismatched.status, 2);
  assert.ok(JSON.parse(mismatched.stdout).issues.some((item) => item.code === 'ab_title_request_parameter_mismatch'));
  mismatch.options.model = 'fixture-model';
  write(mismatchPath, JSON.stringify(mismatch, null, 2));
  assert.equal(runTitleAdapter(['finalize', mismatchPath]).status, 0);

  const forgedCandidatesPath = join(runDir, tasks['zhihu:A'].request.expected_artifacts[0]);
  const forgedCandidates = readJson(forgedCandidatesPath);
  forgedCandidates.candidates[0].promise_status = 'BLOCKED';
  write(forgedCandidatesPath, JSON.stringify(forgedCandidates, null, 2));
  const forgedResultPath = join(runDir, '06-selection/providers/zhihu/A/title-generation.result.json');
  const forgedResult = readJson(forgedResultPath);
  forgedResult.artifacts[0].sha256 = sha(forgedCandidatesPath);
  write(forgedResultPath, JSON.stringify(forgedResult, null, 2));
  const forged = run('aggregate-titles.mjs', [runDir]);
  assert.equal(forged.status, 2);
  assert.ok(JSON.parse(forged.stdout).issues.some((item) => item.code === 'invalid_title_candidate'));
  writeTitleProviderArtifact(runDir, tasks['zhihu:A'].request);
  assert.equal(runTitleAdapter(['finalize', tasks['zhihu:A'].requestPath]).status, 0);

  const aggregated = run('aggregate-titles.mjs', [runDir]);
  assert.equal(aggregated.status, 0, aggregated.stderr || aggregated.stdout);
  const aggregateResult = JSON.parse(aggregated.stdout);
  assert.equal(aggregateResult.total_candidates, 34);
  const titles = readJson(aggregateResult.titles_path);
  const selection = readJson(aggregateResult.selection_path);
  assert.equal(selection.selections.length, 5);
  assert.ok(selection.selections.every((item) => item.variant === 'A' && item.title_id.endsWith('-A-1')));
  assert.ok(titles.platforms.weibo.A.candidates.every((item) => !item.title.includes('#') && /^#[^#]+#$/.test(item.topic_phrase)));

  const stageArtifacts = [...candidateArtifacts, '06-selection/titles.json', '06-selection/title-matrix.md'];
  assert.equal(stageArtifacts.length, 12);
  const aggregatePath = join(runDir, '06-selection', 'titles.json');
  const aggregateBytes = readFileSync(aggregatePath);
  const outsideAggregate = join(root, 'outside-titles.json');
  writeFileSync(outsideAggregate, aggregateBytes);
  rmSync(aggregatePath);
  symlinkSync(outsideAggregate, aggregatePath);
  const symlinkedAggregate = run('set-stage.mjs', [
    runDir, 'titles', 'completed', ...stageArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(symlinkedAggregate.status, 2);
  assert.ok(JSON.parse(symlinkedAggregate.stdout).issues.some((item) => item.code === 'title_aggregate_symlink'));
  rmSync(aggregatePath);
  writeFileSync(aggregatePath, aggregateBytes);

  const incomplete = run('set-stage.mjs', [
    runDir, 'titles', 'completed', ...stageArtifacts.slice(1).flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(incomplete.status, 2);
  assert.ok(JSON.parse(incomplete.stdout).issues.some((item) => item.code === 'invalid_title_artifact_binding'));

  const complete = run('set-stage.mjs', [
    runDir, 'titles', 'completed', ...stageArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(complete.status, 0, complete.stderr || complete.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).current_stage, 'titles_approval');

  const completedCandidatePath = join(runDir, candidateArtifacts[0]);
  const completedCandidateBytes = readFileSync(completedCandidatePath);
  write(completedCandidatePath, `${completedCandidateBytes.toString('utf8')}\n`);
  const titleDrift = run('verify-run.mjs', [runDir]);
  assert.equal(titleDrift.status, 2);
  assert.ok(JSON.parse(titleDrift.stdout).issues.some((item) => item.code === 'title_stage_artifact_drift'));
  writeFileSync(completedCandidatePath, completedCandidateBytes);

  const downgrade = run('set-stage.mjs', [runDir, 'titles', 'blocked', '--error', 'audit']);
  assert.equal(downgrade.status, 2);
  const outsideSelection = join(root, 'selection.v001.json');
  writeFileSync(outsideSelection, readFileSync(join(runDir, '06-selection', 'selection.v001.json')));
  const externalDecision = run('set-gate.mjs', [
    runDir, 'titles', 'approved', '--decision', outsideSelection,
    '--artifact', '06-selection/titles.json', '--artifact', '06-selection/title-matrix.md',
    '--actor', 'orchestrator', '--approval-mode', 'autonomous'
  ]);
  assert.equal(externalDecision.status, 2);

  const selectionPath = join(runDir, '06-selection', 'selection.v001.json');
  const validSelection = readJson(selectionPath);
  const staleSelection = structuredClone(validSelection);
  staleSelection.titles_sha256 = '0'.repeat(64);
  write(selectionPath, JSON.stringify(staleSelection, null, 2));
  const staleDecision = run('set-gate.mjs', [
    runDir, 'titles', 'approved', '--decision', '06-selection/selection.v001.json',
    '--artifact', '06-selection/titles.json', '--artifact', '06-selection/title-matrix.md',
    '--actor', 'orchestrator', '--approval-mode', 'autonomous'
  ]);
  assert.equal(staleDecision.status, 2);
  assert.ok(JSON.parse(staleDecision.stdout).issues.some((item) => item.code === 'title_selection_lineage_mismatch'));
  write(selectionPath, JSON.stringify(validSelection, null, 2));

  const approved = run('set-gate.mjs', [
    runDir, 'titles', 'approved', '--decision', '06-selection/selection.v001.json',
    '--artifact', '06-selection/titles.json', '--artifact', '06-selection/title-matrix.md',
    '--actor', 'orchestrator', '--approval-mode', 'autonomous'
  ]);
  assert.equal(approved.status, 0, approved.stderr || approved.stdout);
  const approvedState = readJson(join(runDir, 'run.json'));
  assert.equal(approvedState.current_stage, 'visual');
  assert.equal(Object.keys(approvedState.platform_selections).length, 5);

  const reopened = run('set-stage.mjs', [runDir, 'titles', 'running']);
  assert.equal(reopened.status, 0, reopened.stderr || reopened.stdout);
  const reopenedState = readJson(join(runDir, 'run.json'));
  assert.equal(reopenedState.stages.titles.attempt, 2);
  assert.deepEqual(reopenedState.stages.titles.artifacts, []);
  assert.equal(reopenedState.gates.titles.status, 'pending');
  assert.equal(reopenedState.stages.visual.status, 'pending');
  const stale = run('aggregate-titles.mjs', [runDir]);
  assert.equal(stale.status, 2);
  const rebuilt = run('create-title-request.mjs', [runDir, '--platform', 'wechat', '--variant', 'A']);
  assert.equal(rebuilt.status, 0);
  assert.ok(readJson(JSON.parse(rebuilt.stdout).request_path).task_id.endsWith(':attempt-002'));
});

test('drafting and proofreading requests run two masters, ten adaptations, and ten editing tasks end to end', () => {
  const root = tempDir('drafting-pipeline');
  const runDir = createDraftingRun(root);

  assert.equal(run('set-stage.mjs', [runDir, 'outline', 'running']).status, 0);
  const outlineBuild = run('create-drafting-request.mjs', [runDir, 'outline']);
  assert.equal(outlineBuild.status, 0, outlineBuild.stderr || outlineBuild.stdout);
  const outlineRequestPath = JSON.parse(outlineBuild.stdout).request_path;
  const outlineRequest = readJson(outlineRequestPath);
  assert.deepEqual(outlineRequest.expected_artifacts, [
    '03-outline/control-outline.md', '03-outline/A-structure.md', '03-outline/B-structure.md'
  ]);
  assert.ok(!outlineRequest.inputs.some((item) => item.role === 'style_b'));
  assert.equal(runDraftingAdapter(['validate-request', outlineRequestPath]).status, 0);
  writeOutlineProviderArtifacts(runDir, outlineRequest);
  assert.equal(runDraftingAdapter(['finalize', outlineRequestPath]).status, 0);
  const outlineArtifacts = outlineRequest.expected_artifacts;
  const outlineComplete = run('set-stage.mjs', [
    runDir, 'outline', 'completed', ...outlineArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(outlineComplete.status, 0, outlineComplete.stderr || outlineComplete.stdout);
  assert.equal(run('set-gate.mjs', [
    runDir, 'outline', 'approved', '--decision', '03-outline/control-outline.md',
    '--actor', 'orchestrator', '--approval-mode', 'autonomous'
  ]).status, 0);

  const reopenOutline = run('set-stage.mjs', [runDir, 'outline', 'running']);
  assert.equal(reopenOutline.status, 0, reopenOutline.stderr || reopenOutline.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).gates.outline.status, 'pending');
  const revisionBuild = run('create-drafting-request.mjs', [runDir, 'outline']);
  assert.equal(revisionBuild.status, 0, revisionBuild.stderr || revisionBuild.stdout);
  const revisionRequestPath = JSON.parse(revisionBuild.stdout).request_path;
  const revisionRequest = readJson(revisionRequestPath);
  assert.equal(revisionRequest.options.revision, 2);
  assert.deepEqual(revisionRequest.expected_artifacts, [
    '03-outline/control-outline.v002.md', '03-outline/A-structure.v002.md', '03-outline/B-structure.v002.md'
  ]);
  assert.equal(runDraftingAdapter(['validate-request', revisionRequestPath]).status, 0);
  writeOutlineProviderArtifacts(runDir, revisionRequest);
  assert.equal(runDraftingAdapter(['finalize', revisionRequestPath]).status, 0);
  const revisionComplete = run('set-stage.mjs', [
    runDir, 'outline', 'completed', ...revisionRequest.expected_artifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(revisionComplete.status, 0, revisionComplete.stderr || revisionComplete.stdout);
  const mixedRevision = run('set-gate.mjs', [
    runDir, 'outline', 'approved', '--decision', '03-outline/control-outline.v002.md',
    '--artifact', '03-outline/A-structure.md', '--artifact', '03-outline/B-structure.v002.md',
    '--actor', 'orchestrator', '--approval-mode', 'autonomous'
  ]);
  assert.equal(mixedRevision.status, 2);
  const revisionApproval = run('set-gate.mjs', [
    runDir, 'outline', 'approved', '--decision', '03-outline/control-outline.v002.md',
    '--actor', 'orchestrator', '--approval-mode', 'autonomous'
  ]);
  assert.equal(revisionApproval.status, 0, revisionApproval.stderr || revisionApproval.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).gates.outline.revision, 2);

  assert.equal(run('set-stage.mjs', [runDir, 'masters', 'running']).status, 0);
  const masterArtifacts = [];
  const masterRequests = [];
  for (const variant of variants) {
    const built = run('create-drafting-request.mjs', [
      runDir, 'master', '--variant', variant,
      '--model', 'fixture-model', '--parameters-json', '{"temperature":0.4}'
    ]);
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const requestPath = JSON.parse(built.stdout).request_path;
    const request = readJson(requestPath);
    masterRequests.push(request);
    assert.equal(request.inputs.some((item) => item.role === 'style_b'), variant === 'B');
    assert.equal(runDraftingAdapter(['validate-request', requestPath]).status, 0);
    writeMasterProviderArtifacts(runDir, request);
    assert.equal(runDraftingAdapter(['finalize', requestPath]).status, 0);
    masterArtifacts.push(...request.expected_artifacts);
  }
  assert.deepEqual(masterRequests[0].options.parameters, masterRequests[1].options.parameters);
  assert.ok(masterRequests.every((request) => request.task_id.endsWith(':attempt-001')));

  const emptyMasterPath = join(runDir, '04-masters/A/final.md');
  const realProse = '跨系统写入前需要人工确认，且结论只适用于当前材料。'.repeat(30);
  write(emptyMasterPath, `# c-001 母稿\n\n${realProse}\n\n~~~markdown\n## 假章节一\n代码内容\n## 假章节二\n代码内容\n## 假章节三\n代码内容\n~~~\n`);
  const emptyProvenancePath = join(runDir, '04-masters/A/provenance.json');
  const emptyProvenance = readJson(emptyProvenancePath);
  emptyProvenance.output_sha256 = sha(emptyMasterPath);
  write(emptyProvenancePath, JSON.stringify(emptyProvenance, null, 2));
  const emptyResultPath = join(runDir, '04-masters/A/drafting-master.result.json');
  const emptyResult = readJson(emptyResultPath);
  emptyResult.artifacts.find((item) => item.path.endsWith('/final.md')).sha256 = sha(emptyMasterPath);
  emptyResult.artifacts.find((item) => item.path.endsWith('/provenance.json')).sha256 = sha(emptyProvenancePath);
  write(emptyResultPath, JSON.stringify(emptyResult, null, 2));
  const emptyMasterBlocked = run('set-stage.mjs', [
    runDir, 'masters', 'completed', ...masterArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(emptyMasterBlocked.status, 2);
  assert.ok(JSON.parse(emptyMasterBlocked.stdout).issues.some((item) => item.code === 'incomplete_drafting_body'));
  writeMasterProviderArtifacts(runDir, masterRequests[0]);
  assert.equal(runDraftingAdapter(['finalize', join(runDir, '04-masters/A/drafting-master.request.json')]).status, 0);

  const mastersComplete = run('set-stage.mjs', [
    runDir, 'masters', 'completed', ...masterArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(mastersComplete.status, 0, mastersComplete.stderr || mastersComplete.stdout);

  assert.equal(run('set-stage.mjs', [runDir, 'platforms', 'running']).status, 0);
  const platformArtifacts = [];
  const adaptTasks = {};
  for (const platform of platforms) {
    for (const variant of variants) {
      const built = run('create-drafting-request.mjs', [
        runDir, 'adapt', '--platform', platform, '--variant', variant,
        '--model', 'fixture-model', '--parameters-json', '{"temperature":0.4}'
      ]);
      assert.equal(built.status, 0, built.stderr || built.stdout);
      const requestPath = JSON.parse(built.stdout).request_path;
      const request = readJson(requestPath);
      adaptTasks[`${platform}:${variant}`] = { request, requestPath };
      assert.ok(request.task_id.endsWith(':attempt-001'));
      assert.equal(request.inputs.find((item) => item.role === 'source_master').path, `04-masters/${variant}/final.md`);
      assert.equal(request.inputs.some((item) => item.role === 'style_b'), variant === 'B');
      if (platform === 'wechat' && variant === 'A') {
        const rendered = readFileSync(join(runDir, request.inputs.find((item) => item.role === 'audience_snapshot').path), 'utf8');
        for (const heading of ['# wechat 受众快照', '## 核心受众', '## 平台覆盖层', '## 本篇细分受众', '```json']) {
          assert.ok(rendered.includes(heading), heading);
        }
      }
      assert.equal(runDraftingAdapter(['validate-request', requestPath]).status, 0);
      writeAdaptProviderArtifacts(runDir, request);
      assert.equal(runDraftingAdapter(['finalize', requestPath]).status, 0);
      platformArtifacts.push(...request.expected_artifacts);
    }
  }

  const shortTask = adaptTasks['weibo:A'];
  const shortDraftPath = join(runDir, '05-platforms/weibo/A/draft.md');
  write(shortDraftPath, '# 微博 A 初稿\n\n一句话。');
  const shortProvenancePath = join(runDir, '05-platforms/weibo/A/provenance.json');
  const shortProvenance = readJson(shortProvenancePath);
  shortProvenance.output_sha256 = sha(shortDraftPath);
  write(shortProvenancePath, JSON.stringify(shortProvenance, null, 2));
  const shortResultPath = join(runDir, '05-platforms/weibo/A/drafting-adapt.result.json');
  const shortResult = readJson(shortResultPath);
  shortResult.artifacts.find((item) => item.path.endsWith('/draft.md')).sha256 = sha(shortDraftPath);
  shortResult.artifacts.find((item) => item.path.endsWith('/provenance.json')).sha256 = sha(shortProvenancePath);
  write(shortResultPath, JSON.stringify(shortResult, null, 2));
  const shortBlocked = run('set-stage.mjs', [
    runDir, 'platforms', 'completed', ...platformArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(shortBlocked.status, 2);
  assert.ok(JSON.parse(shortBlocked.stdout).issues.some((item) => item.code === 'incomplete_drafting_body'));
  writeAdaptProviderArtifacts(runDir, shortTask.request);
  assert.equal(runDraftingAdapter(['finalize', shortTask.requestPath]).status, 0);

  const audienceTask = adaptTasks['wechat:A'];
  const audiencePath = join(runDir, '05-platforms/wechat/A/audience-snapshot.md');
  write(audiencePath, `${readFileSync(audiencePath, 'utf8')}\n被篡改。`);
  const audienceBlocked = run('set-stage.mjs', [
    runDir, 'platforms', 'completed', ...platformArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(audienceBlocked.status, 2);
  assert.ok(JSON.parse(audienceBlocked.stdout).issues.some((item) => [
    'drafting_provider_input_drift', 'drafting_provider_artifact_drift', 'audience_snapshot_contract_mismatch'
  ].includes(item.code)));
  const rebuiltAudience = run('create-drafting-request.mjs', [
    runDir, 'adapt', '--platform', 'wechat', '--variant', 'A',
    '--model', 'fixture-model', '--parameters-json', '{"temperature":0.4}'
  ]);
  assert.equal(rebuiltAudience.status, 0, rebuiltAudience.stderr || rebuiltAudience.stdout);
  assert.equal(runDraftingAdapter(['finalize', JSON.parse(rebuiltAudience.stdout).request_path]).status, 0);

  const platformsComplete = run('set-stage.mjs', [
    runDir, 'platforms', 'completed', ...platformArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(platformsComplete.status, 0, platformsComplete.stderr || platformsComplete.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).current_stage, 'editing');

  const pendingProofread = run('create-proofreading-request.mjs', [
    runDir, '--platform', 'wechat', '--variant', 'A'
  ]);
  assert.equal(pendingProofread.status, 2);
  assert.ok(JSON.parse(pendingProofread.stdout).blockers.some((item) => item.code === 'proofreading_request_stage_mismatch'));
  assert.equal(run('set-stage.mjs', [runDir, 'editing', 'running']).status, 0);
  const editingArtifacts = [];
  const proofreadingTasks = {};
  for (const platform of platforms) {
    for (const variant of variants) {
      const draftPath = join(runDir, '05-platforms', platform, variant, 'draft.md');
      const draftHash = sha(draftPath);
      const built = run('create-proofreading-request.mjs', [
        runDir, '--platform', platform, '--variant', variant,
        '--model', 'fixture-model', '--parameters-json', '{"temperature":0.2}'
      ]);
      assert.equal(built.status, 0, built.stderr || built.stdout);
      const requestPath = JSON.parse(built.stdout).request_path;
      const request = readJson(requestPath);
      proofreadingTasks[`${platform}:${variant}`] = { request, requestPath };
      assert.equal(request.task_id, `proofread:${readJson(join(runDir, 'run.json')).run_id}:${platform}:${variant}:attempt-001`);
      assert.deepEqual(request.inputs.map((item) => item.role), ['draft']);
      assert.equal(request.inputs[0].path, `05-platforms/${platform}/${variant}/draft.md`);
      assert.equal(runProofreadingAdapter(['validate-request', requestPath]).status, 0);
      writeProofreadingProviderArtifacts(runDir, request);
      assert.equal(runProofreadingAdapter(['finalize', requestPath]).status, 0);
      assert.equal(sha(draftPath), draftHash);

      editingArtifacts.push(...request.expected_artifacts);
      for (const [phase, after] of [
        ['humanize', join(runDir, '05-platforms', platform, variant, 'humanized.md')],
        ['final', join(runDir, '05-platforms', platform, variant, 'final.md')]
      ]) {
        const reportRelative = `05-platforms/${platform}/${variant}/reviews/claim-regression-${phase}.json`;
        const reportPath = join(runDir, reportRelative);
        const regression = run('check-claim-regression.mjs', [
          '--before', draftPath, '--after', after, '--claims', join(runDir, '02-research/claims.json'),
          '--phase', phase, '--output', reportPath
        ]);
        assert.equal(regression.status, 0, regression.stderr || regression.stdout);
        const semantic = run('set-semantic-review.mjs', [
          reportPath, '--reviewer', 'orchestrator', ...semanticPassArgs
        ]);
        assert.equal(semantic.status, 0, semantic.stderr || semantic.stdout);
        editingArtifacts.push(reportRelative);
      }
    }
  }
  assert.equal(editingArtifacts.length, 90);

  const mismatchRequestPath = proofreadingTasks['wechat:B'].requestPath;
  const mismatchRequest = readJson(mismatchRequestPath);
  mismatchRequest.options.model = 'different-model';
  write(mismatchRequestPath, JSON.stringify(mismatchRequest, null, 2));
  assert.equal(runProofreadingAdapter(['finalize', mismatchRequestPath]).status, 0);
  const mismatchedExperiment = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(mismatchedExperiment.status, 2);
  assert.ok(JSON.parse(mismatchedExperiment.stdout).issues.some((item) => item.code === 'ab_proofreading_request_parameter_mismatch'));
  mismatchRequest.options.model = 'fixture-model';
  write(mismatchRequestPath, JSON.stringify(mismatchRequest, null, 2));
  assert.equal(runProofreadingAdapter(['finalize', mismatchRequestPath]).status, 0);

  const incompleteEditing = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.slice(1).flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(incompleteEditing.status, 2);
  assert.ok(JSON.parse(incompleteEditing.stdout).issues.some((item) => item.code === 'invalid_proofreading_artifact_binding'));

  const emptyReviewPath = join(runDir, '05-platforms/wechat/A/reviews/logic.md');
  const emptyReview = readFileSync(emptyReviewPath, 'utf8').replace(/\n本轮检查通过。\s*$/, '\n');
  write(emptyReviewPath, emptyReview);
  const emptyReviewReportPath = join(runDir, '05-platforms/wechat/A/reviews/proofread-result.json');
  const emptyReviewReport = readJson(emptyReviewReportPath);
  emptyReviewReport.checkpoints.logic.review_sha256 = sha(emptyReviewPath);
  write(emptyReviewReportPath, JSON.stringify(emptyReviewReport, null, 2));
  const emptyReviewProviderPath = join(runDir, '05-platforms/wechat/A/reviews/proofreading.result.json');
  const emptyReviewProvider = readJson(emptyReviewProviderPath);
  emptyReviewProvider.artifacts.find((item) => item.role === 'logic_review').sha256 = sha(emptyReviewPath);
  emptyReviewProvider.artifacts.find((item) => item.role === 'proofread_result').sha256 = sha(emptyReviewReportPath);
  write(emptyReviewProviderPath, JSON.stringify(emptyReviewProvider, null, 2));
  const forgedReview = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(forgedReview.status, 2);
  assert.ok(JSON.parse(forgedReview.stdout).issues.some((item) => item.code === 'invalid_proofreading_review'));
  writeProofreadingProviderArtifacts(runDir, proofreadingTasks['wechat:A'].request);
  assert.equal(runProofreadingAdapter(['finalize', proofreadingTasks['wechat:A'].requestPath]).status, 0);

  const proofreadReportPath = join(runDir, '05-platforms/wechat/A/reviews/proofread-result.json');
  const proofreadReport = readJson(proofreadReportPath);
  proofreadReport.humanizer_ledger.pop();
  write(proofreadReportPath, JSON.stringify(proofreadReport, null, 2));
  const providerResultPath = join(runDir, '05-platforms/wechat/A/reviews/proofreading.result.json');
  const providerResult = readJson(providerResultPath);
  providerResult.artifacts.find((item) => item.role === 'proofread_result').sha256 = sha(proofreadReportPath);
  write(providerResultPath, JSON.stringify(providerResult, null, 2));
  const forgedLedger = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(forgedLedger.status, 2);
  assert.ok(JSON.parse(forgedLedger.stdout).issues.some((item) => item.code === 'invalid_proofread_result'));
  writeProofreadingProviderArtifacts(runDir, proofreadingTasks['wechat:A'].request);
  assert.equal(runProofreadingAdapter(['finalize', proofreadingTasks['wechat:A'].requestPath]).status, 0);

  const semanticReportPath = join(runDir, '05-platforms/wechat/A/reviews/claim-regression-final.json');
  const semanticReport = readJson(semanticReportPath);
  semanticReport.status = 'BLOCKED';
  semanticReport.semantic_review.status = 'BLOCKED';
  write(semanticReportPath, JSON.stringify(semanticReport, null, 2));
  const forgedSemantic = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(forgedSemantic.status, 2);
  assert.ok(JSON.parse(forgedSemantic.stdout).issues.some((item) => item.code === 'invalid_proofreading_regression'));
  assert.equal(run('set-semantic-review.mjs', [
    semanticReportPath, '--reviewer', 'orchestrator', ...semanticPassArgs
  ]).status, 0);

  const semanticBytes = readFileSync(semanticReportPath, 'utf8');
  const externalRegression = join(root, 'external-regression.json');
  write(externalRegression, semanticBytes);
  rmSync(semanticReportPath);
  symlinkSync(externalRegression, semanticReportPath);
  const regressionSymlink = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(regressionSymlink.status, 2);
  assert.ok(JSON.parse(regressionSymlink.stdout).issues.some((item) => item.code === 'proofreading_regression_symlink'));
  rmSync(semanticReportPath);
  write(semanticReportPath, semanticBytes);

  const editingComplete = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(editingComplete.status, 0, editingComplete.stderr || editingComplete.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).current_stage, 'titles');

  const illegalDowngrade = run('set-stage.mjs', [runDir, 'editing', 'blocked', '--error', 'audit']);
  assert.equal(illegalDowngrade.status, 2);
  assert.equal(readJson(join(runDir, 'run.json')).stages.editing.status, 'completed');

  const reopenedEditing = run('set-stage.mjs', [runDir, 'editing', 'running']);
  assert.equal(reopenedEditing.status, 0, reopenedEditing.stderr || reopenedEditing.stdout);
  const editingState = readJson(join(runDir, 'run.json'));
  assert.equal(editingState.stages.editing.attempt, 2);
  assert.deepEqual(editingState.stages.editing.artifacts, []);
  const staleEditing = run('set-stage.mjs', [
    runDir, 'editing', 'completed', ...editingArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(staleEditing.status, 2);
  assert.ok(JSON.parse(staleEditing.stdout).issues.some((item) => item.code === 'invalid_proofreading_provider_request'));

  const reopenedPlatforms = run('set-stage.mjs', [runDir, 'platforms', 'running']);
  assert.equal(reopenedPlatforms.status, 0, reopenedPlatforms.stderr || reopenedPlatforms.stdout);
  assert.equal(readJson(join(runDir, 'run.json')).stages.platforms.attempt, 2);
  const stalePlatforms = run('set-stage.mjs', [
    runDir, 'platforms', 'completed', ...platformArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(stalePlatforms.status, 2);
  assert.ok(JSON.parse(stalePlatforms.stdout).issues.some((item) => item.code === 'invalid_drafting_provider_request'));

  const reopened = run('set-stage.mjs', [runDir, 'masters', 'running']);
  assert.equal(reopened.status, 0, reopened.stderr || reopened.stdout);
  const reopenedState = readJson(join(runDir, 'run.json'));
  assert.equal(reopenedState.stages.masters.attempt, 2);
  assert.equal(reopenedState.current_stage, 'masters');
  assert.equal(reopenedState.stages.platforms.status, 'pending');
  assert.equal(reopenedState.stages.editing.status, 'pending');
  assert.equal(reopenedState.gates.titles.status, 'pending');
  assert.ok(reopenedState.history.some((item) => item.event === 'stage_reopened' && item.stage === 'masters'));
  const staleMasters = run('set-stage.mjs', [
    runDir, 'masters', 'completed', ...masterArtifacts.flatMap((path) => ['--artifact', path])
  ]);
  assert.equal(staleMasters.status, 2);
  assert.ok(JSON.parse(staleMasters.stdout).issues.some((item) => item.code === 'invalid_drafting_provider_request'));
});

test('drafting stages reject incomplete packages', () => {
  const root = tempDir('drafting-stage-guards');
  const runDir = createDraftingRun(root, 'guard-run');
  const pendingRequest = run('create-drafting-request.mjs', [runDir, 'outline']);
  assert.equal(pendingRequest.status, 2);
  assert.ok(JSON.parse(pendingRequest.stdout).blockers.some((item) => item.code === 'drafting_request_stage_mismatch'));
  assert.equal(run('set-stage.mjs', [runDir, 'outline', 'running']).status, 0);
  write(join(runDir, '03-outline', 'control-outline.md'), '# 空壳大纲');
  const incomplete = run('set-stage.mjs', [
    runDir, 'outline', 'completed', '--artifact', '03-outline/control-outline.md'
  ]);
  assert.equal(incomplete.status, 2);
  assert.ok(JSON.parse(incomplete.stdout).issues.some((item) => item.code === 'invalid_drafting_artifact_binding'));
});
