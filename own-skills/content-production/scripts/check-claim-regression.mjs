#!/usr/bin/env node
import { emitJson, expandPath, parseArgs, readText, sha256, writeJson } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const beforePath = expandPath(args.before);
const afterPath = expandPath(args.after);
const claimsPath = expandPath(args.claims);

function numbers(text) {
  return new Set(text.match(/\d+(?:\.\d+)?(?:%|％|天|日|周|月|年|小时|分钟|秒|倍|元|万|亿|GB|MB|人|个)?/gi) || []);
}

function quotes(text) {
  const found = [];
  for (const match of text.matchAll(/[“"]([^”"\n]{2,80})[”"]/g)) found.push(match[1].trim());
  return new Set(found);
}

function sentences(text) {
  return text.split(/[。！？!?\n]+/).map((part) => part.trim()).filter(Boolean);
}

function occurrences(text, pattern) {
  return text.match(pattern)?.length || 0;
}

function chars(text) {
  return new Set(text.replace(/[\s，。！？、；：“”"'（）()《》]/g, '').split(''));
}

function overlap(left, right) {
  const a = chars(left);
  const b = chars(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const value of a) if (b.has(value)) common += 1;
  return common / Math.min(a.size, b.size);
}

try {
  if (!beforePath || !afterPath || !claimsPath) throw new Error('Required: --before, --after, --claims');
  const before = await readText(beforePath);
  const after = await readText(afterPath);
  const claimsText = await readText(claimsPath);
  JSON.parse(claimsText);
  const allowedCorpus = before;
  const blockers = [];

  const allowedNumbers = numbers(allowedCorpus);
  const newNumbers = [...numbers(after)].filter((value) => !allowedNumbers.has(value));
  if (newNumbers.length) {
    blockers.push({ code: 'new_numeric_claim', values: newNumbers, message: `Humanized text introduced numeric claims: ${newNumbers.join(', ')}` });
  }

  const allowedQuotes = quotes(allowedCorpus);
  const newQuotes = [...quotes(after)].filter((value) => !allowedQuotes.has(value));
  if (newQuotes.length) {
    blockers.push({ code: 'new_quotation', values: newQuotes, message: 'Humanized text introduced quotations not present in the verified corpus.' });
  }

  const personalPattern = /(?:我|我们|本人).{0,24}(?:用过|用了|使用|试过|试了|测试|体验|遇到|发现|做过|连续|亲自|上周|昨天|曾经|之前)/;
  const beforeSentences = new Set(sentences(allowedCorpus));
  const newPersonal = sentences(after).filter((sentence) => personalPattern.test(sentence) && !beforeSentences.has(sentence));
  if (newPersonal.length) {
    blockers.push({ code: 'new_personal_experience', sentences: newPersonal, message: 'Humanized text introduced unsupported personal-experience claims.' });
  }

  const effectPattern = /(?:提升|降低|节省|增长|翻倍|达到|改善|提高|减少|增加).{0,16}(?:效率|成本|时间|速度|效果|收入|用户|转化|准确率)?/;
  const newEffects = sentences(after).filter((sentence) => effectPattern.test(sentence) && !allowedCorpus.includes(sentence));
  if (newEffects.length && !blockers.some((item) => item.code === 'new_numeric_claim')) {
    blockers.push({ code: 'new_effect_claim', sentences: newEffects, message: 'Humanized text introduced unsupported effect claims.' });
  }

  const certaintyPattern = /(?:必然|一定|完全|肯定|毫无疑问|事实证明|绝对|从不|永远)/g;
  if (occurrences(after, certaintyPattern) > occurrences(allowedCorpus, certaintyPattern)) {
    blockers.push({ code: 'certainty_strengthened', message: 'Edited text strengthened certainty beyond the verified corpus.' });
  }

  const qualifierPattern = /(?:可能|通常|一般|大约|约|部分|有时|往往|倾向于|截至|在[^。！？\n]{0,12}情况下)/g;
  const beforeQualified = sentences(before).filter((sentence) => qualifierPattern.test(sentence));
  qualifierPattern.lastIndex = 0;
  const afterSentences = sentences(after);
  const qualifierRemovals = beforeQualified.filter((source) => {
    qualifierPattern.lastIndex = 0;
    return afterSentences.some((candidate) => {
      qualifierPattern.lastIndex = 0;
      return overlap(source, candidate) >= 0.72 && !qualifierPattern.test(candidate);
    });
  });
  if (qualifierRemovals.length) {
    blockers.push({ code: 'qualifier_removed', sentences: qualifierRemovals, message: 'Edited text appears to remove a factual qualifier.' });
  }

  const report = {
    status: blockers.length ? 'BLOCKED' : 'PENDING_SEMANTIC_REVIEW',
    automatic_status: blockers.length ? 'BLOCKED' : 'PASS',
    before: beforePath,
    after: afterPath,
    claims: claimsPath,
    before_sha256: sha256(before),
    after_sha256: sha256(after),
    claims_sha256: sha256(claimsText),
    phase: args.phase || null,
    blockers,
    semantic_review: {
      status: 'PENDING',
      checks: {
        new_conclusion: 'PENDING', scope_change: 'PENDING', causal_strength: 'PENDING',
        factual_addition: 'PENDING', factual_omission: 'PENDING', proper_noun_drift: 'PENDING'
      },
      notes: [], reviewer: null, recorded_by: null, reviewed_at: null
    }
  };
  if (args.output) await writeJson(expandPath(args.output), report);
  emitJson(report, blockers.length ? 2 : 0);
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'claim_regression_failed', message: error.message }] }, 2);
}
