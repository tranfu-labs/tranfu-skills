import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  deriveCoverageAnalysis,
  evaluateCrossPlatformCardinality,
  selectUniqueSourceExcerpt,
  validateVisualCoverageSet
} from '../scripts/visual-cardinality.mjs';

const policy = JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../references/visual-cardinality-policy.json'),
  'utf8'
));

function section(index, { heading = `步骤 ${index}`, length = 210 } = {}) {
  const sentence = `第${index}部分需要先核对输入边界，再比较两个数字并记录判断依据，完成检查后才能继续执行后续流程。`;
  return `## ${heading}\n\n${sentence}${'这是用于形成稳定正文长度的补充说明。'.repeat(Math.ceil(length / 18))}`;
}

test('all provider caps are 8 and xiaohongshu accepts only 4..8 contiguous pages', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(policy.platforms)
    .map(([platform, value]) => [platform, value.provider_cap])), {
    wechat: 8,
    xiaohongshu: 8,
    zhihu: 8,
    weibo: 8,
    toutiao: 8
  });

  for (const count of [4, 8]) {
    const pages = Array.from({ length: count }, (_, index) =>
      `### 第 ${index + 1} 页\n\n第 ${index + 1} 页保留独立完整的卡片内容。`).join('\n\n');
    const value = deriveCoverageAnalysis({
      platform: 'xiaohongshu',
      sourceText: `# 小红书稿\n\n## 卡片文案\n\n${pages}`,
      policy
    });
    assert.equal(value.issues.length, 0);
    assert.equal(value.cardinality.minimum, count);
    assert.equal(value.cardinality.target, count);
    assert.equal(value.cardinality.maximum, count);
    assert.equal(value.units.every((unit) => unit.required), true);
  }

  for (const count of [3, 9]) {
    const pages = Array.from({ length: count }, (_, index) =>
      `### 第 ${index + 1} 页\n\n第 ${index + 1} 页保留独立完整的卡片内容。`).join('\n\n');
    const value = deriveCoverageAnalysis({
      platform: 'xiaohongshu',
      sourceText: `# 小红书稿\n\n## 卡片文案\n\n${pages}`,
      policy
    });
    assert.equal(value.issues.some((item) => item.code === 'visual_xhs_page_count_invalid'), true);
  }
});

test('long-form coverage follows the eligible-section minimum and target formula', () => {
  const sourceText = ['---', 'title: ignored', '---', '# 长文',
    ...Array.from({ length: 7 }, (_, index) => section(index + 1)),
    '```md', '## 代码围栏里的伪标题', '```'].join('\n\n');
  const value = deriveCoverageAnalysis({ platform: 'wechat', sourceText, policy });

  assert.equal(value.issues.length, 0);
  assert.equal(value.document_metrics.eligible_unit_count, 7);
  assert.deepEqual(value.cardinality, { minimum: 4, target: 5, maximum: 7 });
  assert.equal(value.units.filter((unit) => unit.required).length, 4);
  assert.equal(value.units.some((unit) => unit.heading === '代码围栏里的伪标题'), false);
});

test('short non-long-form content becomes one whole-document unit', () => {
  const value = deriveCoverageAnalysis({
    platform: 'toutiao',
    sourceText: '# 短稿\n\n这是一段完整但很短的发布正文，用于验证单图路由。',
    policy
  });
  assert.equal(value.issues.length, 0);
  assert.equal(value.strategy, 'longform_sections');
  assert.deepEqual(value.cardinality, { minimum: 1, target: 1, maximum: 1 });
  assert.equal(value.units[0].required, true);
});

test('long-form content without usable H2 structure is rejected', () => {
  const value = deriveCoverageAnalysis({
    platform: 'zhihu',
    sourceText: `# 无结构长稿\n\n${'这段正文持续展开论点但没有可供稳定定位的二级标题。'.repeat(70)}`,
    policy
  });
  assert.equal(value.issues.some((item) => item.code === 'visual_longform_structure_missing'), true);
});

test('weibo prefers a complete numbered thread and keeps short posts singleton', () => {
  const thread = Array.from({ length: 5 }, (_, index) =>
    `${index + 1}/5 第${index + 1}段给出独立论点、判断依据和下一步行动。`).join('\n\n');
  const routed = deriveCoverageAnalysis({ platform: 'weibo', sourceText: thread, policy });
  assert.equal(routed.issues.length, 0);
  assert.equal(routed.strategy, 'weibo_thread');
  assert.deepEqual(routed.cardinality, { minimum: 2, target: 2, maximum: 5 });
  assert.equal(routed.units.filter((unit) => unit.required).length, 2);

  const short = deriveCoverageAnalysis({
    platform: 'weibo',
    sourceText: '一条不超过一千字、没有分线程标记的完整微博。',
    policy
  });
  assert.equal(short.strategy, 'weibo_short');
  assert.deepEqual(short.cardinality, { minimum: 1, target: 1, maximum: 1 });
});

test('source excerpt selection is deterministic and unique', () => {
  const sourceText = [
    '## 第一节',
    '这个相同句子会在两节重复出现，因此不能作为唯一锚点。',
    '第一节还有一条只出现一次的判断句，可以稳定回查原稿位置。',
    '## 第二节',
    '这个相同句子会在两节重复出现，因此不能作为唯一锚点。'
  ].join('\n\n');
  const excerpt = selectUniqueSourceExcerpt({
    sourceText,
    unitText: sourceText.split('## 第二节')[0],
    unitId: 'h2-001'
  });
  assert.equal(excerpt, '第一节还有一条只出现一次的判断句，可以稳定回查原稿位置。');
});

test('cross-platform checks reject uniform singleton and four-platform collapse', () => {
  const rows = [
    { platform: 'wechat', minimum: 2, target: 3, selected: 1 },
    { platform: 'xiaohongshu', minimum: 4, target: 4, selected: 1 },
    { platform: 'zhihu', minimum: 1, target: 1, selected: 1 },
    { platform: 'weibo', minimum: 2, target: 2, selected: 1 },
    { platform: 'toutiao', minimum: 1, target: 1, selected: 1 }
  ];
  const issues = evaluateCrossPlatformCardinality(rows, { phase: 'post-plan' });
  assert.equal(issues.some((item) => item.code === 'visual_uniform_singleton_anomaly'), true);
  assert.equal(issues.some((item) => item.code === 'visual_cardinality_collapse'), true);
});

test('completed historical runs remain read-only when no policy snapshot exists', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'visual-cardinality-history-'));
  try {
    const result = await validateVisualCoverageSet(runDir, {
      stages: { visual: { status: 'completed', attempt: 1 } }
    });
    assert.equal(result.legacy, true);
    assert.deepEqual(result.issues, []);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});
