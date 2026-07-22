import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  fileExists,
  fileSha256,
  filesUnder,
  markdownImageRefs,
  readJson,
  readText,
  skillDir
} from './lib.mjs';

const expectedPlatforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
const coverageKeys = [
  'schema_version', 'artifact', 'run_id', 'visual_attempt', 'platform', 'variant',
  'created_at', 'policy_ref', 'source', 'title_selection', 'platform_profile',
  'requested_output', 'strategy', 'user_directive', 'document_metrics',
  'coverage_units', 'cardinality', 'single_image_exception', 'checks', 'status', 'issues'
];
const coverageUnitKeys = [
  'unit_id', 'kind', 'ordinal', 'heading', 'start_line', 'end_line', 'content_sha256',
  'source_excerpt', 'source_excerpt_sha256', 'signals', 'score', 'eligible', 'required',
  'selection_rank', 'exclusion_reason'
];
const cardinalityKeys = [
  'mode', 'eligible_unit_count', 'minimum', 'target', 'provider_cap', 'request_max_images'
];
const policySnapshotKeys = [
  'schema_version', 'artifact', 'run_id', 'visual_attempt', 'created_at', 'policy_source', 'policy'
];
const visualDecisionKeys = [
  'schema_version', 'artifact', 'run_id', 'visual_attempt', 'created_at', 'created_by',
  'decision_rule', 'policy_ref', 'title_selection', 'platforms', 'cross_platform_checks',
  'checks', 'issues', 'status'
];
const visualPlatformKeys = [
  'platform', 'variant', 'coverage_contract', 'plan_request', 'plan_result', 'plan',
  'shot_list', 'source_structure', 'cardinality', 'coverage_result', 'exceptions', 'checks'
];

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'visual', ...extra };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function attemptVersion(state) {
  const attempt = Number.isInteger(state?.stages?.visual?.attempt) && state.stages.visual.attempt > 0
    ? state.stages.visual.attempt : 1;
  return { attempt, version: `v${String(attempt).padStart(3, '0')}` };
}

export function policyPathForAttempt(state) {
  return `07-visual/policy.${attemptVersion(state).version}.json`;
}

export function coveragePathForAttempt(state, platform) {
  return `07-visual/${platform}/coverage.${attemptVersion(state).version}.json`;
}

export function decisionPathForAttempt(state) {
  return `07-visual/visual-decision.${attemptVersion(state).version}.json`;
}

function countOccurrences(source, candidate) {
  if (!candidate) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(candidate, offset)) !== -1) {
    count += 1;
    offset += candidate.length;
  }
  return count;
}

function characterCount(value) {
  return Array.from(value.replace(/\s/g, '')).length;
}

function keywordCount(value, keywords) {
  return keywords.reduce((count, keyword) => {
    let offset = 0;
    let matches = 0;
    while ((offset = value.indexOf(keyword, offset)) !== -1) {
      matches += 1;
      offset += keyword.length;
    }
    return count + matches;
  }, 0);
}

function stripMarkdown(value) {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/^\[|\]\([^)]+\)$/g, ''))
    .replace(/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/gm, '')
    .replace(/[`*_>#|]/g, ' ')
    .trim();
}

function publicUnit(unit) {
  const { text: _text, body: _body, ...value } = unit;
  return value;
}

function exactCardinality(eligibleCount, providerCap, policy) {
  if (eligibleCount >= 3) {
    const minimum = Math.min(
      policy.longform.maximum_minimum,
      Math.max(2, Math.ceil(eligibleCount / 2))
    );
    return {
      minimum,
      target: Math.min(providerCap, eligibleCount, Math.max(minimum, Math.ceil(2 * eligibleCount / 3))),
      maximum: Math.min(providerCap, eligibleCount)
    };
  }
  if (eligibleCount === 2) return { minimum: 1, target: 2, maximum: 2 };
  if (eligibleCount === 1) return { minimum: 1, target: 1, maximum: 1 };
  return { minimum: 0, target: 0, maximum: 0 };
}

function ranked(units) {
  return [...units].sort((left, right) => right.score - left.score || left.ordinal - right.ordinal);
}

function selectRequired(units, minimum) {
  const ordered = [...units].sort((left, right) => left.ordinal - right.ordinal);
  if (!minimum) return [];
  if (minimum === 1) return ranked(ordered).slice(0, 1);
  const bucketCount = minimum === 2 ? 2 : 3;
  const selected = [];
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const members = ordered.filter((_, index) =>
      Math.min(bucketCount - 1, Math.floor(index * bucketCount / ordered.length)) === bucket);
    const winner = ranked(members)[0];
    if (winner) selected.push(winner);
  }
  const selectedIds = new Set(selected.map((unit) => unit.unit_id));
  for (const unit of ranked(ordered)) {
    if (selected.length >= minimum) break;
    if (!selectedIds.has(unit.unit_id)) {
      selected.push(unit);
      selectedIds.add(unit.unit_id);
    }
  }
  return selected;
}

function assignSelection(units, minimum, sourceText, excerptPolicy, issues) {
  const eligible = units.filter((unit) => unit.eligible);
  const required = selectRequired(eligible, minimum);
  const requiredIds = new Set(required.map((unit) => unit.unit_id));
  const priority = [...required, ...ranked(eligible).filter((unit) => !requiredIds.has(unit.unit_id))];
  const ranks = new Map(priority.map((unit, index) => [unit.unit_id, index + 1]));
  for (const unit of units) {
    unit.required = requiredIds.has(unit.unit_id);
    unit.selection_rank = ranks.get(unit.unit_id) || null;
    if (!unit.eligible) continue;
    const excerpt = selectUniqueSourceExcerpt({
      sourceText,
      unitText: unit.body,
      unitId: unit.unit_id,
      policy: excerptPolicy
    });
    unit.source_excerpt = excerpt;
    unit.source_excerpt_sha256 = excerpt ? sha256(excerpt) : null;
    if (!excerpt && unit.required) {
      issues.push(issue(
        'visual_unique_anchor_excerpt_unavailable',
        `Required coverage unit ${unit.unit_id} has no unique source excerpt.`,
        { unit_id: unit.unit_id }
      ));
    }
  }
}

function scoreUnit(heading, body, policy) {
  const lines = body.split('\n');
  const nonspaceChars = characterCount(stripMarkdown(body));
  const tableCount = lines.some((line) => /^\s*\|.*\|\s*$/.test(line)) ? 1 : 0;
  const listItemCount = lines.filter((line) => /^\s*(?:[-+*]|\d+[.)])\s+/.test(line)).length;
  const substantive = nonspaceChars >= policy.substantive_chars || tableCount >= 1 || listItemCount >= 3;
  if (!substantive) return { substantive, score: 0, signals: [], document: { nonspaceChars, tableCount, listItemCount } };

  let score = 1;
  const signals = ['substantive_h2'];
  const add = (name, points) => { signals.push(name); score += points; };
  if (nonspaceChars >= policy.long_section_chars) add('long_section', 1);
  if (tableCount >= 1) add('table', 2);
  if (listItemCount >= 3) add('list', 2);
  const numberCount = (body.match(/\d+(?:\.\d+)?%?/g) || []).length;
  if (numberCount >= 2 && keywordCount(body, policy.comparison_keywords) >= 1) add('numeric_comparison', 2);
  if (keywordCount(body, policy.process_keywords) >= 2) add('process_timeline', 2);
  if (keywordCount(body, policy.boundary_keywords) >= 2) add('boundary_risk', 2);
  if (keywordCount(body, policy.action_keywords) >= 2) add('judgment_action', 2);
  if (keywordCount(heading, policy.heading_keywords) >= 1) add('heading_keyword', 1);
  return { substantive, score, signals, document: { nonspaceChars, tableCount, listItemCount } };
}

export function parseMarkdownStructure(sourceText) {
  const normalized = sourceText.replace(/\r\n?/g, '\n');
  const rawLines = normalized.split('\n');
  const visible = [];
  let frontmatter = rawLines[0]?.trim() === '---';
  let fence = null;
  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index];
    if (frontmatter) {
      visible.push({ line: '', lineNumber: index + 1, ignored: true });
      if (index > 0 && /^(?:---|\.\.\.)\s*$/.test(line.trim())) frontmatter = false;
      continue;
    }
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      const symbol = marker[1][0];
      if (!fence) fence = { symbol, size: marker[1].length };
      else if (symbol === fence.symbol && marker[1].length >= fence.size) fence = null;
      visible.push({ line: '', lineNumber: index + 1, ignored: true });
      continue;
    }
    visible.push({ line: fence ? '' : line, lineNumber: index + 1, ignored: Boolean(fence) });
  }
  const headings = [];
  for (const row of visible) {
    const match = row.line.match(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (!match || !match[2].trim()) continue;
    headings.push({ level: match[1].length, text: match[2].trim(), line: row.lineNumber });
  }
  const h2 = headings.filter((heading) => heading.level === 2).map((heading) => {
    const next = headings.find((candidate) => candidate.line > heading.line && candidate.level <= 2);
    const endLine = next ? next.line - 1 : rawLines.length;
    const text = visible.slice(heading.line - 1, endLine).map((row) => row.line).join('\n').trim();
    const body = visible.slice(heading.line, endLine).map((row) => row.line).join('\n').trim();
    return {
      level: heading.level,
      heading: heading.text,
      line: heading.line,
      endLine,
      text,
      body,
      existingLocalImage: /!\[[^\]]*\]\((?!https?:\/\/|data:)[^)]+\)/i.test(body)
    };
  });
  return {
    normalized,
    lines: visible,
    headings,
    h2,
    body_nonspace_chars: characterCount(stripMarkdown(visible.map((row) => row.line).join('\n')))
  };
}

export function selectUniqueSourceExcerpt({ sourceText, unitText, policy = null }) {
  const normalizedSource = sourceText.replace(/\r\n?/g, '\n');
  const normalizedUnit = unitText.replace(/\r\n?/g, '\n').trim();
  const settings = policy || { sentence_min_chars: 24, sentence_max_chars: 120, paragraph_prefix_chars: [80, 120, 160, 240] };
  const sentences = normalizedUnit.match(/[^\n。！？!?]+[。！？!?]/g) || [];
  for (const value of sentences) {
    const candidate = value.trim();
    const size = Array.from(candidate).length;
    if (size >= settings.sentence_min_chars && size <= settings.sentence_max_chars
      && countOccurrences(normalizedSource, candidate) === 1) return candidate;
  }
  const paragraph = normalizedUnit.split(/\n\s*\n/).map((value) => value.trim()).find(Boolean);
  if (!paragraph) return null;
  for (const size of settings.paragraph_prefix_chars) {
    if (Array.from(paragraph).length < size) continue;
    const candidate = Array.from(paragraph).slice(0, size).join('');
    if (countOccurrences(normalizedSource, candidate) === 1) return candidate;
  }
  return countOccurrences(normalizedSource, paragraph) === 1 ? paragraph : null;
}

function baseUnit({ unitId, kind, ordinal, heading, startLine, endLine, text, body, score, signals, eligible, exclusionReason = null }) {
  return {
    unit_id: unitId,
    kind,
    ordinal,
    heading,
    start_line: startLine,
    end_line: endLine,
    content_sha256: sha256(text),
    source_excerpt: null,
    source_excerpt_sha256: null,
    signals,
    score,
    eligible,
    required: false,
    selection_rank: null,
    exclusion_reason: exclusionReason,
    text,
    body
  };
}

function deriveXiaohongshu(structure, policy, issues) {
  const container = structure.h2.find((section) => section.heading === '卡片文案');
  if (!container) {
    issues.push(issue('visual_xhs_card_container_missing', 'Xiaohongshu draft must contain an H2 卡片文案 section.'));
    return { strategy: 'carousel_pages', units: [], cardinality: { minimum: 0, target: 0, maximum: 0 } };
  }
  const rows = structure.lines.filter((row) => row.lineNumber > container.line && row.lineNumber <= container.endLine);
  const markers = [];
  for (const row of rows) {
    const heading = row.line.match(/^###[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (!heading) continue;
    const page = heading[1].trim().match(/^第[ \t]*(\d+)[ \t]*页$/);
    if (!page) {
      issues.push(issue('visual_xhs_page_number_invalid', `Invalid Xiaohongshu page heading at line ${row.lineNumber}.`));
      continue;
    }
    markers.push({ number: Number(page[1]), heading: heading[1].trim(), line: row.lineNumber });
  }
  const expected = markers.map((_, index) => index + 1);
  if (markers.length < policy.minimum_pages || markers.length > policy.maximum_pages) {
    issues.push(issue('visual_xhs_page_count_invalid', `Xiaohongshu requires ${policy.minimum_pages}..${policy.maximum_pages} pages.`, { page_count: markers.length }));
  }
  if (markers.some((marker, index) => marker.number !== expected[index])) {
    issues.push(issue('visual_xhs_page_sequence_invalid', 'Xiaohongshu page numbers must start at 1 and remain contiguous.'));
  }
  const units = markers.map((marker, index) => {
    const endLine = markers[index + 1]?.line - 1 || container.endLine;
    const text = structure.lines.slice(marker.line - 1, endLine).map((row) => row.line).join('\n').trim();
    const body = structure.lines.slice(marker.line, endLine).map((row) => row.line).join('\n').trim();
    if (!stripMarkdown(body)) issues.push(issue('visual_xhs_page_empty', `Xiaohongshu page ${marker.number} is empty.`, { page: marker.number }));
    return baseUnit({
      unitId: `xiaohongshu-page-${String(marker.number).padStart(2, '0')}`,
      kind: 'carousel_page', ordinal: marker.number, heading: marker.heading,
      startLine: marker.line, endLine, text, body, score: 0, signals: [], eligible: Boolean(stripMarkdown(body))
    });
  });
  const cardinality = { minimum: markers.length, target: markers.length, maximum: markers.length };
  assignSelection(units, cardinality.minimum, structure.normalized, policy.excerpt, issues);
  return { strategy: 'carousel_pages', units, cardinality };
}

function threadMarkers(structure) {
  return structure.lines.flatMap((row) => {
    const match = row.line.match(/^\s*(\d+)\/(\d+)(?:\s+|[：:])?(.*)$/);
    return match ? [{ line: row.lineNumber, number: Number(match[1]), total: Number(match[2]) }] : [];
  });
}

function deriveWeiboThread(structure, markers, policy, issues) {
  const total = markers[0]?.total || 0;
  const valid = total >= 2 && markers.length === total
    && markers.every((marker, index) => marker.total === total && marker.number === index + 1);
  if (!valid) {
    issues.push(issue('visual_weibo_thread_structure_invalid', 'Weibo thread markers must form one complete contiguous 1/N..N/N sequence.'));
    return null;
  }
  const units = markers.map((marker, index) => {
    const endLine = markers[index + 1]?.line - 1 || structure.lines.length;
    const text = structure.lines.slice(marker.line - 1, endLine).map((row) => row.line).join('\n').trim();
    const body = text;
    const scored = scoreUnit(`${marker.number}/${total}`, body, policy.longform);
    if (!stripMarkdown(body)) issues.push(issue('visual_weibo_thread_unit_empty', `Weibo thread unit ${marker.number}/${total} is empty.`));
    return baseUnit({
      unitId: `weibo-thread-${String(marker.number).padStart(2, '0')}`,
      kind: 'thread_unit', ordinal: marker.number, heading: `${marker.number}/${total}`,
      startLine: marker.line, endLine, text, body, score: 1 + Math.max(0, scored.score - 1),
      signals: scored.signals.filter((signal) => signal !== 'substantive_h2'), eligible: Boolean(stripMarkdown(body))
    });
  });
  const minimum = total < 4 ? 1 : 2;
  const target = total < 4 ? 1 : Math.min(total, policy.automatic_target_cap, Math.max(minimum, Math.ceil(total / 3)));
  const cardinality = { minimum, target, maximum: Math.min(total, policy.provider_cap) };
  assignSelection(units, minimum, structure.normalized, policy.excerpt, issues);
  return { strategy: 'weibo_thread', units, cardinality };
}

function deriveLongform(platform, structure, platformPolicy, policy, issues) {
  const units = structure.h2.map((section, index) => {
    const scored = scoreUnit(section.heading, section.body, policy.longform);
    const excluded = section.existingLocalImage;
    const eligible = scored.substantive && scored.score >= policy.longform.eligible_score_min && !excluded;
    return baseUnit({
      unitId: `${platform}-h2-${String(index + 1).padStart(2, '0')}`,
      kind: 'h2_section', ordinal: index + 1, heading: section.heading,
      startLine: section.line, endLine: section.endLine, text: section.text,
      body: section.body, score: scored.score, signals: scored.signals, eligible,
      exclusionReason: excluded ? 'existing_local_image' : eligible ? null : 'below_eligible_score'
    });
  });
  const substantiveCount = structure.h2.filter((section) => scoreUnit(section.heading, section.body, policy.longform).substantive).length;
  const longform = substantiveCount >= policy.longform.substantive_h2_count
    || structure.body_nonspace_chars >= policy.longform.document_chars;
  let eligible = units.filter((unit) => unit.eligible);
  if (!longform && eligible.length === 0 && structure.body_nonspace_chars > 0) {
    const text = structure.lines.map((row) => row.line).join('\n').trim();
    const whole = baseUnit({
      unitId: `${platform}-whole-01`, kind: 'whole_document', ordinal: 1, heading: null,
      startLine: 1, endLine: structure.lines.length, text, body: text, score: 1,
      signals: [], eligible: true
    });
    units.splice(0, units.length, whole);
    eligible = [whole];
  } else if (longform && eligible.length === 0) {
    const code = structure.body_nonspace_chars >= policy.longform.document_chars && structure.h2.length === 0
      ? 'visual_longform_structure_missing' : 'visual_longform_no_eligible_units';
    issues.push(issue(code, code === 'visual_longform_structure_missing'
      ? 'Long-form content requires usable H2 structure.'
      : 'Long-form content has no eligible visual coverage units.'));
  }
  const cardinality = exactCardinality(eligible.length, platformPolicy.provider_cap, policy);
  if (platform === 'weibo') {
    cardinality.target = Math.min(cardinality.target, platformPolicy.automatic_target_cap);
    cardinality.maximum = Math.min(cardinality.maximum, platformPolicy.provider_cap);
  }
  assignSelection(units, cardinality.minimum, structure.normalized, policy.excerpt, issues);
  return { strategy: 'longform_sections', units, cardinality };
}

export function deriveCoverageAnalysis({ platform, sourceText, policy }) {
  const issues = [];
  if (!expectedPlatforms.includes(platform) || !policy?.platforms?.[platform]) {
    return { strategy: null, document_metrics: {}, units: [], cardinality: null, issues: [issue('visual_coverage_platform_mismatch', `Unsupported platform: ${platform}.`)] };
  }
  const structure = parseMarkdownStructure(sourceText, platform, policy);
  const platformPolicy = { ...policy.platforms[platform], excerpt: policy.excerpt };
  let result;
  if (platform === 'xiaohongshu') {
    result = deriveXiaohongshu(structure, platformPolicy, issues);
  } else if (platform === 'weibo') {
    const markers = threadMarkers(structure);
    if (markers.length) result = deriveWeiboThread(structure, markers, { ...platformPolicy, longform: policy.longform }, issues);
    if (!result && !markers.length && structure.h2.length === 0
      && structure.body_nonspace_chars <= platformPolicy.short_post_max_chars && structure.body_nonspace_chars > 0) {
      const text = structure.lines.map((row) => row.line).join('\n').trim();
      const unit = baseUnit({
        unitId: 'weibo-whole-01', kind: 'whole_document', ordinal: 1, heading: null,
        startLine: 1, endLine: structure.lines.length, text, body: text, score: 1,
        signals: [], eligible: true
      });
      const cardinality = { minimum: 1, target: 1, maximum: 1 };
      assignSelection([unit], 1, structure.normalized, policy.excerpt, issues);
      result = { strategy: 'weibo_short', units: [unit], cardinality };
    }
    if (!result && !markers.length && structure.h2.length) {
      result = deriveLongform(platform, structure, platformPolicy, policy, issues);
    }
    if (!result && !markers.length) {
      issues.push(issue('visual_weibo_structure_missing', 'Long Weibo content requires a complete thread or usable H2 structure.'));
      result = { strategy: null, units: [], cardinality: { minimum: 0, target: 0, maximum: 0 } };
    }
  } else {
    result = deriveLongform(platform, structure, platformPolicy, policy, issues);
  }
  return {
    strategy: result.strategy,
    document_metrics: {
      nonspace_char_count: structure.body_nonspace_chars,
      h2_count: structure.h2.length,
      substantive_h2_count: structure.h2.filter((section) => scoreUnit(section.heading, section.body, policy.longform).substantive).length,
      eligible_unit_count: result.units.filter((unit) => unit.eligible).length
    },
    units: result.units.map(publicUnit),
    cardinality: result.cardinality,
    issues
  };
}

export function evaluateCrossPlatformCardinality(rows, { phase = 'pre-plan' } = {}) {
  const issues = [];
  const minimums = rows.map((row) => row.minimum);
  if (phase === 'pre-plan') {
    if (rows.length === 5 && rows.every((row) => row.target === 1) && minimums.some((value) => value > 1)) {
      issues.push(issue('visual_cardinality_policy_degenerate', 'All platform targets collapsed to one despite a multi-image minimum.'));
    }
    return issues;
  }
  if (rows.length === 5 && rows.every((row) => row.selected === 1) && minimums.some((value) => value > 1)) {
    issues.push(issue('visual_uniform_singleton_anomaly', 'All platform plans selected one image despite a multi-image minimum.'));
  }
  if (rows.filter((row) => row.selected === 1).length >= 4 && minimums.filter((value) => value > 1).length >= 2) {
    issues.push(issue('visual_cardinality_collapse', 'At least four platform plans collapsed to one image across multiple multi-image requirements.'));
  }
  return issues;
}

export function mapPlanAnchorsToCoverage(plan, coverage) {
  const issues = [];
  const units = Array.isArray(coverage?.coverage_units)
    ? coverage.coverage_units.filter((unit) => unit.eligible) : [];
  const anchors = Array.isArray(plan?.anchors) ? plan.anchors : [];
  const byExcerpt = new Map(units.map((unit) => [unit.source_excerpt, unit]));
  const anchorMappings = anchors.map((anchor) => {
    const unit = byExcerpt.get(anchor.source_excerpt) || null;
    if (!unit) {
      issues.push(issue('visual_anchor_coverage_mismatch',
        `Anchor ${anchor.image_id || '(missing)'} does not exactly match an eligible coverage excerpt.`));
    }
    return {
      image_id: anchor.image_id,
      unit_id: unit?.unit_id || null,
      source_excerpt: anchor.source_excerpt,
      ordinal: unit?.ordinal || null
    };
  });
  const mapped = anchorMappings.filter((mapping) => mapping.unit_id);
  const coveredUnitIds = [...new Set(mapped.map((mapping) => mapping.unit_id))];
  const duplicateUnitIds = [...new Set(mapped.map((mapping) => mapping.unit_id)
    .filter((unitId, index, values) => values.indexOf(unitId) !== index))];
  const requiredUnitIds = units.filter((unit) => unit.required).map((unit) => unit.unit_id);
  const missingRequiredUnitIds = requiredUnitIds.filter((unitId) => !coveredUnitIds.includes(unitId));
  if (duplicateUnitIds.length) {
    issues.push(issue('visual_anchor_duplicate_coverage', 'Different anchors map to the same coverage unit.', { unit_ids: duplicateUnitIds }));
  }
  if (missingRequiredUnitIds.length) {
    issues.push(issue('visual_required_coverage_missing', 'Plan omits required coverage units.', { unit_ids: missingRequiredUnitIds }));
  }
  if (mapped.some((mapping, index) => index > 0 && mapped[index - 1].ordinal >= mapping.ordinal)) {
    issues.push(issue('visual_anchor_order_invalid', 'Plan anchors must follow source ordinal order.'));
  }
  if (coverage?.platform === 'xiaohongshu'
    && (anchors.length !== units.length || coveredUnitIds.length !== units.length)) {
    issues.push(issue('visual_xhs_card_coverage_incomplete', 'Xiaohongshu requires exactly one anchor per carousel page.'));
  }
  return {
    anchor_mappings: anchorMappings,
    required_unit_ids: requiredUnitIds,
    covered_unit_ids: coveredUnitIds,
    missing_required_unit_ids: missingRequiredUnitIds,
    duplicate_unit_ids: duplicateUnitIds,
    waived_unit_ids: [],
    issues
  };
}

export function evaluatePlatformCardinality(plan, coverage) {
  const issues = [];
  const selected = plan?.image_count;
  const minimum = coverage?.cardinality?.minimum;
  const target = coverage?.cardinality?.target;
  if (!Number.isInteger(selected) || selected < minimum) {
    issues.push(issue('visual_image_count_below_policy_min', `${coverage?.platform || 'Platform'} plan is below its coverage minimum.`));
  }
  if (!Number.isInteger(selected) || selected > target) {
    issues.push(issue('visual_image_count_above_policy_max', `${coverage?.platform || 'Platform'} plan exceeds its coverage target.`));
  }
  if (plan?.options?.max_images !== coverage?.cardinality?.request_max_images) {
    issues.push(issue('illustration_request_max_policy_mismatch', 'Plan max_images differs from its coverage target.'));
  }
  if (!Array.isArray(plan?.anchors) || selected !== plan.anchors.length) {
    issues.push(issue('invalid_illustration_count', 'Plan image_count must equal its anchor count.'));
  }
  const coverageResult = mapPlanAnchorsToCoverage(plan, coverage);
  issues.push(...coverageResult.issues);
  return { issues, coverageResult };
}

export function createVisualDecision({ state, policyRef, titleBinding, platformRows, createdAt }) {
  const rows = expectedPlatforms.map((platform) => platformRows.find((row) => row.platform === platform));
  const issues = [];
  if (rows.some((row) => !row)) {
    issues.push(issue('visual_decision_invalid', 'Visual decision requires exactly one row for every platform.'));
  }
  issues.push(...evaluateCrossPlatformCardinality(rows.filter(Boolean).map((row) => ({
    platform: row.platform,
    minimum: row.cardinality.minimum,
    target: row.cardinality.target,
    selected: row.cardinality.selected
  })), { phase: 'post-plan' }));
  return {
    schema_version: 1,
    artifact: 'VisualDecision',
    run_id: state.run_id,
    visual_attempt: state.stages.visual.attempt,
    created_at: createdAt,
    created_by: 'orchestrator',
    decision_rule: 'content-production-visual-cardinality/1.0.0',
    policy_ref: policyRef,
    title_selection: titleBinding,
    platforms: rows.filter(Boolean),
    cross_platform_checks: {
      uniform_singleton: issues.some((value) => value.code === 'visual_uniform_singleton_anomaly') ? 'BLOCKED' : 'PASS',
      cardinality_collapse: issues.some((value) => value.code === 'visual_cardinality_collapse') ? 'BLOCKED' : 'PASS'
    },
    checks: { policy: 'PASS', coverage: 'PASS', lineage: 'PASS', cardinality: issues.length ? 'BLOCKED' : 'PASS' },
    issues,
    status: issues.length ? 'BLOCKED' : 'PROPOSED'
  };
}

export function validateVisualDecision(value, { state, policyRef, titleBinding, platformRows }) {
  const issues = [];
  if (!exactKeys(value, visualDecisionKeys)
    || !Array.isArray(value?.platforms) || value.platforms.length !== expectedPlatforms.length
    || value.platforms.some((row) => !exactKeys(row, visualPlatformKeys))) {
    return [issue('visual_decision_invalid', 'Visual decision schema is invalid.')];
  }
  const expected = createVisualDecision({
    state, policyRef, titleBinding, platformRows, createdAt: value.created_at
  });
  if (!isDeepStrictEqual(value, expected) || value.status !== 'PROPOSED' || value.issues.length) {
    issues.push(issue('visual_decision_invalid', 'Visual decision is stale, non-canonical, or blocked.'));
  }
  return issues;
}

export async function buildVisualPlatformRows(runDir, tasks, coverages) {
  const rows = [];
  for (const platform of expectedPlatforms) {
    const task = tasks.find((value) => value.platform === platform);
    const coverage = coverages.get(platform);
    if (!task?.request || !task?.result || !task?.plan || !coverage) continue;
    const evaluated = evaluatePlatformCardinality(task.plan, coverage.value);
    rows.push({
      platform,
      variant: task.plan.variant,
      coverage_contract: { path: coverage.path, sha256: coverage.sha256 },
      plan_request: { path: task.paths.planRequest, sha256: await fileSha256(join(runDir, task.paths.planRequest)) },
      plan_result: { path: task.paths.planResult, sha256: await fileSha256(join(runDir, task.paths.planResult)) },
      plan: { path: task.paths.plan, sha256: await fileSha256(join(runDir, task.paths.plan)) },
      shot_list: { path: task.paths.shotList, sha256: await fileSha256(join(runDir, task.paths.shotList)) },
      source_structure: {
        strategy: coverage.value.strategy,
        document_metrics: coverage.value.document_metrics
      },
      cardinality: {
        minimum: coverage.value.cardinality.minimum,
        target: coverage.value.cardinality.target,
        selected: task.plan.image_count
      },
      coverage_result: {
        anchor_mappings: evaluated.coverageResult.anchor_mappings,
        required_unit_ids: evaluated.coverageResult.required_unit_ids,
        covered_unit_ids: evaluated.coverageResult.covered_unit_ids,
        missing_required_unit_ids: evaluated.coverageResult.missing_required_unit_ids,
        duplicate_unit_ids: evaluated.coverageResult.duplicate_unit_ids,
        waived_unit_ids: []
      },
      exceptions: [],
      checks: {
        lineage: 'PASS', cardinality: evaluated.issues.length ? 'BLOCKED' : 'PASS', coverage: evaluated.issues.length ? 'BLOCKED' : 'PASS'
      }
    });
  }
  return rows;
}

export async function validateCurrentVisualDecision(runDir, state, tasks, coverageValidation = null) {
  const coverage = coverageValidation || await validateVisualCoverageSet(runDir, state);
  if (coverage.legacy) return { issues: [], path: null, value: null, legacy: true };
  const issues = [...coverage.issues];
  const relativePath = decisionPathForAttempt(state);
  const path = await safeCurrentFile(runDir, relativePath, issues, 'visual_decision_missing');
  if (!path || !coverage.policyRef) return { issues, path: relativePath, value: null };
  try {
    const value = await readJson(path);
    const rows = await buildVisualPlatformRows(runDir, tasks, coverage.coverages);
    issues.push(...validateVisualDecision(value, {
      state,
      policyRef: coverage.policyRef,
      titleBinding: state.gates.titles.decision_ref,
      platformRows: rows
    }));
    return { issues, path: relativePath, value, sha256: await fileSha256(path) };
  } catch (error) {
    issues.push(issue('visual_decision_invalid', error.message, { path: relativePath }));
    return { issues, path: relativePath, value: null };
  }
}

export function createPolicySnapshot({ state, policy, policySource, createdAt }) {
  return {
    schema_version: 1,
    artifact: 'VisualCardinalityPolicySnapshot',
    run_id: state.run_id,
    visual_attempt: state.stages.visual.attempt,
    created_at: createdAt,
    policy_source: policySource,
    policy
  };
}

export function validatePolicySnapshot(value, { state, policy, policySource }) {
  const issues = [];
  if (!exactKeys(value, policySnapshotKeys) || value.schema_version !== 1
    || value.artifact !== 'VisualCardinalityPolicySnapshot'
    || value.run_id !== state.run_id || value.visual_attempt !== state.stages.visual.attempt
    || !isDeepStrictEqual(value.policy_source, policySource) || !isDeepStrictEqual(value.policy, policy)) {
    issues.push(issue('visual_policy_invalid', 'Current visual cardinality policy snapshot is invalid or stale.'));
  }
  return issues;
}

export function deriveCoverageContract({
  state,
  platform,
  selection,
  titleBinding,
  profileBinding,
  policyRef,
  policy,
  sourceText,
  createdAt
}) {
  const analysis = deriveCoverageAnalysis({ platform, sourceText, policy });
  const platformPolicy = policy.platforms[platform];
  return {
    contract: {
      schema_version: 1,
      artifact: 'VisualCoverageContract',
      run_id: state.run_id,
      visual_attempt: state.stages.visual.attempt,
      platform,
      variant: selection.variant,
      created_at: createdAt,
      policy_ref: policyRef,
      source: { path: selection.draft_path, sha256: selection.draft_sha256 },
      title_selection: { path: titleBinding.path, sha256: titleBinding.sha256, title_id: selection.title_id },
      platform_profile: profileBinding,
      requested_output: platformPolicy.requested_output,
      strategy: analysis.strategy,
      user_directive: { mode: 'auto', count: null, authority: null },
      document_metrics: analysis.document_metrics,
      coverage_units: analysis.units,
      cardinality: {
        mode: 'auto',
        eligible_unit_count: analysis.document_metrics.eligible_unit_count,
        minimum: analysis.cardinality.minimum,
        target: analysis.cardinality.target,
        provider_cap: platformPolicy.provider_cap,
        request_max_images: analysis.cardinality.target
      },
      single_image_exception: analysis.cardinality.target === 1 ? analysis.strategy : null,
      checks: { structure: 'PASS', excerpts: 'PASS', cardinality: 'PASS' },
      status: analysis.issues.length ? 'BLOCKED' : 'READY',
      issues: analysis.issues
    },
    issues: analysis.issues
  };
}

export function validateCoverageContract(value, context) {
  const issues = [];
  if (!exactKeys(value, coverageKeys)
    || !Array.isArray(value?.coverage_units)
    || value.coverage_units.some((unit) => !exactKeys(unit, coverageUnitKeys))
    || !exactKeys(value?.cardinality, cardinalityKeys)) {
    return [issue('visual_coverage_invalid', `Coverage contract has an invalid schema for ${context.platform}.`, { platform: context.platform })];
  }
  const expected = deriveCoverageContract({ ...context, createdAt: value.created_at });
  if (expected.issues.length) issues.push(...expected.issues);
  if (!isDeepStrictEqual(value, expected.contract)) {
    issues.push(issue('visual_coverage_stale', `Coverage contract differs from current ${context.platform} inputs.`, { platform: context.platform }));
  }
  if (value.status !== 'READY' || value.issues.length) {
    issues.push(issue('visual_coverage_invalid', `Coverage contract is not READY for ${context.platform}.`, { platform: context.platform }));
  }
  return issues;
}

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function safeCurrentFile(runDir, relativePath, issues, missingCode) {
  const absolute = resolve(runDir, relativePath || '');
  if (!relativePath || !inside(runDir, absolute) || !fileExists(absolute)) {
    issues.push(issue(missingCode, `Missing current visual control artifact: ${relativePath || '(missing)'}.`, { path: relativePath || null }));
    return null;
  }
  try {
    const stat = await lstat(absolute);
    const runReal = await realpath(runDir);
    if (stat.isSymbolicLink() || !stat.isFile() || !inside(runReal, await realpath(absolute))) throw new Error('unsafe file');
  } catch {
    issues.push(issue('visual_coverage_invalid', `Unsafe current visual control artifact: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  return absolute;
}

export async function validateVisualCoverageSet(runDir, state) {
  const issues = [];
  const expectedPolicyPath = policyPathForAttempt(state);
  if (!fileExists(join(runDir, expectedPolicyPath)) && state.stages?.visual?.status === 'completed') {
    return { issues, policy: null, policyRef: null, coverages: new Map(), legacy: true };
  }
  const policySourcePath = join(skillDir, 'references', 'visual-cardinality-policy.json');
  const policy = await readJson(policySourcePath);
  const policySource = {
    path: 'references/visual-cardinality-policy.json',
    sha256: await fileSha256(policySourcePath)
  };
  const policyRelative = policyPathForAttempt(state);
  const policyPath = await safeCurrentFile(runDir, policyRelative, issues, 'visual_policy_missing');
  let snapshot = null;
  let policyRef = null;
  if (policyPath) {
    try {
      snapshot = await readJson(policyPath);
      issues.push(...validatePolicySnapshot(snapshot, { state, policy, policySource }));
      policyRef = { path: policyRelative, sha256: await fileSha256(policyPath) };
    } catch (error) {
      issues.push(issue('visual_policy_invalid', error.message, { path: policyRelative }));
    }
  }

  const titleBinding = state.gates?.titles?.decision_ref;
  const titlePath = titleBinding?.path
    ? await safeCurrentFile(runDir, titleBinding.path, issues, 'visual_coverage_invalid') : null;
  let titleDecision = null;
  if (titlePath && await fileSha256(titlePath) === titleBinding.sha256) {
    try { titleDecision = await readJson(titlePath); } catch (error) {
      issues.push(issue('visual_coverage_invalid', error.message, { path: titleBinding.path }));
    }
  } else if (titlePath) {
    issues.push(issue('visual_coverage_stale', 'Approved title selection changed after coverage creation.'));
  }
  const profileSnapshot = state.snapshots?.platform_profiles;
  const profileBinding = profileSnapshot?.snapshot_path && profileSnapshot?.sha256
    ? { path: profileSnapshot.snapshot_path, sha256: profileSnapshot.sha256 } : null;
  const profilePath = profileBinding
    ? await safeCurrentFile(runDir, profileBinding.path, issues, 'visual_coverage_invalid') : null;
  if (profilePath && await fileSha256(profilePath) !== profileBinding.sha256) {
    issues.push(issue('visual_coverage_stale', 'Platform profile snapshot changed after coverage creation.'));
  }

  const coverages = new Map();
  for (const platform of expectedPlatforms) {
    const relativePath = coveragePathForAttempt(state, platform);
    const path = await safeCurrentFile(runDir, relativePath, issues, 'visual_coverage_missing');
    if (!path || !policyRef || !titleDecision || !profileBinding) continue;
    const selection = titleDecision.selections?.find((item) => item.platform === platform);
    if (!selection) {
      issues.push(issue('visual_coverage_platform_mismatch', `No approved selection exists for ${platform}.`, { platform }));
      continue;
    }
    const sourcePath = await safeCurrentFile(runDir, selection.draft_path, issues, 'visual_coverage_invalid');
    if (!sourcePath || await fileSha256(sourcePath) !== selection.draft_sha256) {
      issues.push(issue('visual_coverage_stale', `Selected source changed for ${platform}.`, { platform }));
      continue;
    }
    try {
      const value = await readJson(path);
      const sourceText = await readFile(sourcePath, 'utf8');
      issues.push(...validateCoverageContract(value, {
        state, platform, selection, titleBinding, profileBinding, policyRef, policy, sourceText
      }));
      coverages.set(platform, { path: relativePath, sha256: await fileSha256(path), value });
    } catch (error) {
      issues.push(issue('visual_coverage_invalid', error.message, { platform, path: relativePath }));
    }
  }
  if (coverages.size === expectedPlatforms.length) {
    issues.push(...evaluateCrossPlatformCardinality([...coverages].map(([platform, row]) => ({
      platform,
      minimum: row.value.cardinality.minimum,
      target: row.value.cardinality.target
    })), { phase: 'pre-plan' }));
  }
  return { issues, policy, policyRef, coverages };
}

export async function recountGeneratedVisualAssets(runDir, state) {
  const issues = [];
  const rows = [];
  const visualAttempt = attemptVersion(state);
  const visualSuffix = visualAttempt.attempt === 1 ? '' : `.${visualAttempt.version}`;
  const packageAttempt = Number.isInteger(state?.stages?.package?.attempt) && state.stages.package.attempt > 0
    ? state.stages.package.attempt : 1;
  const packageVersion = `v${String(packageAttempt).padStart(3, '0')}`;
  const packageSuffix = packageAttempt === 1 ? '' : `.${packageVersion}`;
  const packageVersionDir = packageAttempt === 1 ? '' : `/${packageVersion}`;
  for (const platform of expectedPlatforms) {
    const base = `07-visual/${platform}`;
    const publishBase = `08-publish-pack/${platform}`;
    const planPath = `${base}/plan${visualSuffix}.json`;
    const bundlePath = `${base}/bundle${visualSuffix}.json`;
    const nativeManifestPath = `${base}/manifest${visualSuffix}.md`;
    const publishManifestPath = `${base}/manifest${packageSuffix}.json`;
    const finalPath = `${publishBase}/final${packageSuffix}.md`;
    const imagesDir = `${publishBase}/images${packageVersionDir}`;
    try {
      const [plan, bundle, publishManifest, nativeManifest, finalMarkdown] = await Promise.all([
        readJson(join(runDir, planPath)),
        readJson(join(runDir, bundlePath)),
        readJson(join(runDir, publishManifestPath)),
        readText(join(runDir, nativeManifestPath)),
        readText(join(runDir, finalPath))
      ]);
      const sourceText = await readText(join(runDir, plan.source.path));
      const originalRefs = new Set(markdownImageRefs(sourceText));
      const publishedRefs = markdownImageRefs(finalMarkdown).filter((ref) => !originalRefs.has(ref));
      const publishItems = Array.isArray(publishManifest.items) ? publishManifest.items : [];
      const actualImages = await filesUnder(join(runDir, imagesDir));
      const counts = {
        plan: plan.image_count,
        bundle: Array.isArray(bundle.images) ? bundle.images.length : -1,
        native_manifest: [...nativeManifest.matchAll(/^\s*-\s+image_id:\s*\S+/gm)].length,
        publish_manifest: publishItems.length,
        publish_directory: actualImages.length,
        markdown_references: publishedRefs.length
      };
      const expected = plan.image_count;
      const manifestRefs = new Set(publishItems.map((item) => item.markdown_ref));
      if (Object.values(counts).some((count) => count !== expected)
        || publishedRefs.some((ref) => !manifestRefs.has(ref))) {
        issues.push(issue('visual_asset_recount_mismatch',
          `${platform} generated body-image counts differ across plan, bundle, manifests, publish directory, or Markdown.`,
          { platform, counts }));
      }
      rows.push({ platform, expected, counts, excluded: ['source_draft_images', ...(platform === 'wechat' ? ['wechat_cover'] : [])] });
    } catch (error) {
      issues.push(issue('visual_asset_recount_mismatch', error.message, { platform }));
    }
  }
  return { issues, rows, total: rows.reduce((sum, row) => sum + row.expected, 0) };
}
