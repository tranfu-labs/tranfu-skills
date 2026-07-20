export const ENGINE_VERSION = 'markdown-alignment-1';

const QUALIFIERS = {
  time: [
    /截至/g, /截止(?:到|至)?/g, /目前/g, /现阶段/g,
    /\d{4}\s*年(?:\s*\d{1,2}\s*月)?(?:\s*\d{1,2}\s*日)?/g,
    /\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?/g
  ],
  uncertainty: [/可能/g, /或许/g, /也许/g, /预计/g, /大约/g, /约/g, /有望/g, /不排除/g, /倾向于/g],
  scope: [/仅/g, /只(?=适用|面向|限于|有)/g, /部分/g, /某些/g, /少数/g, /最多/g, /至少/g, /不超过/g, /不少于/g, /试点/g, /范围内/g],
  frequency: [/通常/g, /一般/g, /有时/g, /往往/g, /偶尔/g, /经常/g, /多数情况下/g],
  condition: [/如果/g, /若(?:是|在|有)?/g, /仅当/g, /除非/g, /前提是/g, /在[^。！？；\n]{0,24}情况下/g],
  source_boundary: [
    /据[^，。！？；\n]{1,24}(?:称|表示|介绍|披露|报告)/g,
    /根据[^，。！？；\n]{1,24}(?:数据|报告|说明|公告|研究)/g,
    /(?:厂商|官方|公司|团队|研究者|报告)(?:表示|称|指出|介绍|披露|认为|预计)/g
  ]
};

const EFFECT_PATTERN = /提升|降低|节省|增长|翻倍|达到|改善|提高|减少|增加|加快|减慢/;
const CERTAINTY_PATTERN = /必然|一定|完全|肯定|毫无疑问|事实证明|绝对|从不|永远/g;
const ATTRIBUTION_PATTERN = /(?:表示|称|指出|写道|告诉|回应|宣布|认为|强调|介绍|披露)\s*[：:]?\s*$/;

function normalizeLineEndings(text) {
  return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function visibleMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(\s*(?:<[^>\n]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g, '$1')
    .replace(/^ {0,3}\[[^\]]+\]:\s*\S+.*$/gm, '')
    .replace(/(`+)([\s\S]*?)\1/g, '');
}

function sentenceText(value) {
  return visibleMarkdown(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchText(value) {
  return sentenceText(value).replace(/[\s，。！？、；：,.!?;:"“”'‘’（）()《》【】\[\]{}_`*#>\-—]/g, '').toLowerCase();
}

function splitSentences(text) {
  return text.split(/(?<=[。！？!?；;])|\n+/u)
    .map((item) => sentenceText(item).replace(/[。！？!?；;]+$/u, '').trim())
    .filter(Boolean);
}

function parseMarkdown(text) {
  const lines = normalizeLineEndings(text).split('\n');
  const units = [];
  const sections = [];
  let fenced = null;
  let frontmatter = lines[0]?.trim() === '---';
  let block = null;

  const sectionKey = () => sections.filter(Boolean).join(' > ');
  const flush = () => {
    if (!block) return;
    for (const value of splitSentences(block.lines.join(' '))) {
      units.push({ type: block.type, section: block.section, text: value, normalized: matchText(value) });
    }
    block = null;
  };
  const append = (type, value) => {
    const section = sectionKey();
    if (!block || block.type !== type || block.section !== section) {
      flush();
      block = { type, section, lines: [] };
    }
    block.lines.push(value);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (frontmatter) {
      if (index > 0 && line.trim() === '---') frontmatter = false;
      continue;
    }
    if (fenced) {
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === fenced.marker && close[1].length >= fenced.length) fenced = null;
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,}).*$/);
    if (opening) {
      flush();
      fenced = { marker: opening[1][0], length: opening[1].length };
      continue;
    }
    if (/^(?: {4,}|\t)/.test(line)) {
      flush();
      continue;
    }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const value = sentenceText(heading[2]);
      if (level === 1) continue;
      sections.length = level - 1;
      sections[level - 2] = value;
      units.push({ type: 'heading', section: sectionKey(), text: value, normalized: matchText(value) });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const quote = line.match(/^ {0,3}>\s?(.*)$/);
    if (quote) {
      append('quote', quote[1]);
      continue;
    }
    const list = line.match(/^\s*(?:[-+*]|\d+[.)])\s+(.+)$/);
    if (list) {
      flush();
      append('list', list[1]);
      flush();
      continue;
    }
    append('paragraph', line);
  }
  flush();
  return units.filter((item) => item.normalized);
}

function levenshtein(left, right) {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous.at(-1);
}

function lcsLength(left, right) {
  let previous = new Uint16Array(right.length + 1);
  for (let row = 1; row <= left.length; row += 1) {
    const current = new Uint16Array(right.length + 1);
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = left[row - 1] === right[column - 1]
        ? previous[column - 1] + 1
        : Math.max(previous[column], current[column - 1]);
    }
    previous = current;
  }
  return previous.at(-1);
}

function similarity(left, right) {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;
  const edit = 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  const containment = lcsLength(left, right) / Math.min(left.length, right.length);
  return Math.max(edit, containment);
}

function lockExact(before, after) {
  const remainingBefore = new Set(before.map((_, index) => index));
  const remainingAfter = new Set(after.map((_, index) => index));
  const buckets = new Map();
  after.forEach((item, index) => {
    const values = buckets.get(item.text) || [];
    values.push(index);
    buckets.set(item.text, values);
  });
  const pairs = [];
  before.forEach((item, beforeIndex) => {
    const candidates = buckets.get(item.text);
    if (!candidates?.length) return;
    const afterIndex = candidates.shift();
    remainingBefore.delete(beforeIndex);
    remainingAfter.delete(afterIndex);
    pairs.push({ before: item, after: after[afterIndex], score: 1, exact: true });
  });
  return { remainingBefore, remainingAfter, pairs };
}

function alignRemaining(before, after, exact) {
  const pairs = [...exact.pairs];
  const ambiguous = [];
  const candidates = new Map();
  for (const beforeIndex of exact.remainingBefore) {
    const source = before[beforeIndex];
    const values = [];
    for (const afterIndex of exact.remainingAfter) {
      const target = after[afterIndex];
      if (source.type !== target.type || source.section !== target.section) continue;
      const score = similarity(source.normalized, target.normalized);
      if (score >= 0.72) values.push({ beforeIndex, afterIndex, score });
    }
    values.sort((left, right) => right.score - left.score || left.afterIndex - right.afterIndex);
    if (values.length) candidates.set(beforeIndex, values);
  }

  const usedAfter = new Set();
  for (const [beforeIndex, values] of candidates) {
    const available = values.filter((item) => !usedAfter.has(item.afterIndex));
    if (!available.length) continue;
    const [best, second] = available;
    const competing = [...candidates.entries()]
      .filter(([otherIndex]) => otherIndex !== beforeIndex)
      .map(([, other]) => other.find((item) => item.afterIndex === best.afterIndex))
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);
    const sourceMargin = second ? best.score - second.score : 1;
    const targetMargin = competing[0] ? best.score - competing[0].score : 1;
    if (sourceMargin < 0.05 || targetMargin < 0.05) {
      ambiguous.push({ source: before[beforeIndex].text, candidates: available.slice(0, 3).map((item) => after[item.afterIndex].text) });
      continue;
    }
    usedAfter.add(best.afterIndex);
    pairs.push({ before: before[beforeIndex], after: after[best.afterIndex], score: best.score, exact: false });
  }
  return { pairs, ambiguous };
}

function matches(text, patterns) {
  const found = new Set();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) found.add(match[0].replace(/\s+/g, ''));
  }
  return found;
}

function difference(left, right) {
  return [...left].filter((item) => !right.has(item));
}

function numbers(text) {
  return new Set(text.match(/\d+(?:\.\d+)?(?:%|％|天|日|周|月|年|小时|分钟|秒|倍|元|万|亿|GB|MB|人|个)?/gi) || []);
}

function quotations(text) {
  const values = [];
  const pattern = /“([^”\n]{2,120})”|"([^"\n]{2,120})"/g;
  for (const match of text.matchAll(pattern)) {
    const content = (match[1] || match[2]).trim();
    values.push({ content, index: match.index, prefix: text.slice(Math.max(0, match.index - 32), match.index) });
  }
  return values;
}

function effectFingerprint(text) {
  const match = text.match(EFFECT_PATTERN);
  if (!match) return null;
  const verb = match[0];
  const direction = /降低|节省|减少|减慢/.test(verb) ? 'decrease'
    : /提升|增长|翻倍|提高|增加|加快/.test(verb) ? 'increase' : 'change';
  const subject = matchText(text.slice(0, match.index).replace(CERTAINTY_PATTERN, ''));
  CERTAINTY_PATTERN.lastIndex = 0;
  const target = matchText(text.slice(match.index + verb.length));
  const magnitude = [...numbers(text)].sort();
  const certainty = text.match(CERTAINTY_PATTERN)?.sort() || [];
  CERTAINTY_PATTERN.lastIndex = 0;
  const scope = [...matches(text, QUALIFIERS.scope)].sort();
  return { direction, subject, target, magnitude, certainty, scope };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function unitKey(unit) {
  return `${unit.type}\u0000${unit.section}\u0000${unit.text}`;
}

function automaticBlockers(beforeText, afterText, alignment) {
  const blockers = [];
  const beforeNumbers = numbers(beforeText);
  const newNumbers = [...numbers(afterText)].filter((value) => !beforeNumbers.has(value));
  if (newNumbers.length) blockers.push({
    code: 'new_numeric_claim', values: newNumbers,
    message: `Edited text introduced numeric claims: ${newNumbers.join(', ')}`
  });

  const beforeQuotes = new Set(quotations(beforeText).map((item) => item.content));
  for (const quote of quotations(afterText)) {
    if (beforeQuotes.has(quote.content)) continue;
    if (ATTRIBUTION_PATTERN.test(quote.prefix)) {
      blockers.push({ code: 'new_attributed_quotation', values: [quote.content], message: 'Edited text introduced a new attributed quotation.' });
    } else if (matchText(beforeText).includes(matchText(quote.content))) {
      blockers.push({ code: 'new_quote_wrapping', values: [quote.content], message: 'Edited text added quotation marks around existing prose.' });
    } else {
      blockers.push({ code: 'new_quote_wrapping', values: [quote.content], message: 'Edited text introduced newly quoted text.' });
    }
  }

  const beforeUnits = parseMarkdown(beforeText);
  const beforeExact = new Set(beforeUnits.map((item) => item.text));
  const personalPattern = /(?:我|我们|本人).{0,24}(?:用过|用了|使用|试过|试了|测试|体验|遇到|发现|做过|连续|亲自|上周|昨天|曾经|之前)/;
  const newPersonal = parseMarkdown(afterText).filter((item) => personalPattern.test(item.text) && !beforeExact.has(item.text));
  if (newPersonal.length) blockers.push({
    code: 'new_personal_experience', sentences: newPersonal.map((item) => item.text),
    message: 'Edited text introduced unsupported personal-experience claims.'
  });

  const beforeCertainty = beforeText.match(CERTAINTY_PATTERN)?.length || 0;
  CERTAINTY_PATTERN.lastIndex = 0;
  const afterCertainty = afterText.match(CERTAINTY_PATTERN)?.length || 0;
  CERTAINTY_PATTERN.lastIndex = 0;
  if (afterCertainty > beforeCertainty) blockers.push({
    code: 'certainty_strengthened', message: 'Edited text strengthened certainty beyond the source.'
  });

  for (const pair of alignment.pairs.filter((item) => !item.exact)) {
    for (const [category, patterns] of Object.entries(QUALIFIERS)) {
      const removed = difference(matches(pair.before.text, patterns), matches(pair.after.text, patterns));
      if (removed.length) blockers.push({
        code: 'qualifier_removed', category, values: removed,
        sentences: [pair.before.text], aligned_sentence: pair.after.text,
        message: `Edited text removed a ${category} qualifier.`
      });
    }
    const beforeEffect = effectFingerprint(pair.before.text);
    const afterEffect = effectFingerprint(pair.after.text);
    if (beforeEffect && afterEffect && !sameJson(beforeEffect, afterEffect)) blockers.push({
      code: 'effect_claim_changed', before: beforeEffect, after: afterEffect,
      sentences: [pair.before.text, pair.after.text],
      message: 'Edited text changed an effect claim subject, target, direction, magnitude, scope, or certainty.'
    });
  }

  const alignedBefore = new Set(alignment.pairs.map((item) => unitKey(item.before)));
  const alignedAfter = new Set(alignment.pairs.map((item) => unitKey(item.after)));
  const remainingBeforeEffects = beforeUnits
    .filter((item) => EFFECT_PATTERN.test(item.text) && !alignedBefore.has(unitKey(item)));
  const remainingAfterEffects = parseMarkdown(afterText)
    .filter((item) => EFFECT_PATTERN.test(item.text) && !alignedAfter.has(unitKey(item)));
  const consumedBefore = new Set();
  const genuinelyNew = [];
  for (const target of remainingAfterEffects) {
    const targetEffect = effectFingerprint(target.text);
    const candidate = remainingBeforeEffects
      .map((source, index) => ({ source, index, effect: effectFingerprint(source.text) }))
      .filter((item) => !consumedBefore.has(item.index)
        && item.source.type === target.type && item.source.section === target.section
        && item.effect?.direction === targetEffect?.direction)
      .map((item) => ({ ...item, score: similarity(item.effect.target, targetEffect.target) }))
      .filter((item) => item.score >= 0.6)
      .sort((left, right) => right.score - left.score)[0];
    if (!candidate) {
      genuinelyNew.push(target.text);
      continue;
    }
    consumedBefore.add(candidate.index);
    if (!sameJson(candidate.effect, targetEffect)) blockers.push({
      code: 'effect_claim_changed', before: candidate.effect, after: targetEffect,
      sentences: [candidate.source.text, target.text],
      message: 'Edited text changed an effect claim subject, target, direction, magnitude, scope, or certainty.'
    });
  }
  if (genuinelyNew.length && !newNumbers.length) blockers.push({
    code: 'new_effect_claim', sentences: genuinelyNew,
    message: 'Edited text introduced an unsupported effect claim.'
  });
  return blockers;
}

export function analyzeClaimRegression(beforeText, afterText) {
  if (beforeText === afterText) {
    return { engine_version: ENGINE_VERSION, alignment_status: 'IDENTICAL', blockers: [] };
  }
  const before = parseMarkdown(beforeText);
  const after = parseMarkdown(afterText);
  const alignment = alignRemaining(before, after, lockExact(before, after));
  const blockers = alignment.ambiguous.map((item) => ({
    code: 'ambiguous_alignment', ...item,
    message: 'Markdown sentence alignment is ambiguous and cannot be automatically approved.'
  }));
  blockers.push(...automaticBlockers(beforeText, afterText, alignment));
  return {
    engine_version: ENGINE_VERSION,
    alignment_status: alignment.ambiguous.length ? 'AMBIGUOUS' : 'ALIGNED',
    blockers
  };
}
