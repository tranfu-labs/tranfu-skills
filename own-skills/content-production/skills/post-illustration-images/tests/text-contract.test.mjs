import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  compileGenerationPrompt,
  readableTextForVariant
} from "../scripts/compile-generation-prompt.mjs";
import { readableTextIssue } from "../scripts/child-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/compile-generation-prompt.mjs");
const textContent = {
  primary: {
    headline: "先确认边界",
    headline_source_terms: ["确认", "边界"],
    labels: ["边界", "确认", "执行"],
    supporting_copy: "跨系统写入前",
    footer: null
  },
  compact: {
    headline: "确认边界",
    headline_source_terms: ["确认", "边界"],
    labels: ["边界", "确认"],
    supporting_copy: null,
    footer: null
  }
};

function input(textVariant = "primary") {
  return {
    styleSpec: {
      generationPrompt: "Create a warm hand-drawn explainer with clear hierarchy.",
      textPolicy: { defaultMode: "allowlist", iconsOnlyAllowed: false },
      layout: { contentSafeArea: { x: 80, y: 80, width: 1440, height: 1040 } }
    },
    anchor: {
      core_meaning: "自动化必须尊重系统边界。",
      structure: "Decision tree",
      visual_metaphor: "一道门检查通行条件。",
      main_action: "流程箭头在门前等待确认。",
      suggested_elements: ["gate", "workflow arrow", "check mark"],
      text_content: textContent
    },
    textVariant,
    generationGeometry: { target_aspect_ratio: "4:3" },
    brand: { enabled: true }
  };
}

test("compiler help is executable", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /compile\|check/);
});

test("prompt compilation is deterministic and binds only the active text variant", () => {
  const first = compileGenerationPrompt(input("primary"));
  const second = compileGenerationPrompt(structuredClone(input("primary")));
  assert.equal(first, second);
  for (const value of readableTextForVariant(input().anchor, "primary")) {
    assert.match(first, new RegExp(value));
  }
  assert.doesNotMatch(first, /Headline: "确认边界"/);
  assert.doesNotMatch(first, /\/Users\/|\/home\/|[A-Za-z]:\\/);
});

test("compact compilation switches only the approved text variant", () => {
  const prompt = compileGenerationPrompt(input("compact"));
  assert.deepEqual(readableTextForVariant(input().anchor, "compact"), ["确认边界", "边界", "确认"]);
  assert.match(prompt, /确认边界/);
  assert.doesNotMatch(prompt, /跨系统写入前/);
});

test("compiler rejects icons-only policy and absolute local paths", () => {
  const iconsOnly = input();
  iconsOnly.styleSpec.textPolicy.iconsOnlyAllowed = true;
  assert.throws(() => compileGenerationPrompt(iconsOnly), /allowlist text/);

  const localPath = input();
  localPath.anchor.core_meaning = "Read /Users/example/private.txt";
  assert.throws(() => compileGenerationPrompt(localPath), /absolute local path/);
});

test("child QA rejects missing, duplicated, misspelled, and extra readable text with one code", () => {
  const anchor = input().anchor;
  const expected = readableTextForVariant(anchor, "primary");
  assert.equal(readableTextIssue({ readable_text: expected }, anchor, "primary"), null);
  for (const observed of [
    expected.slice(0, -1),
    [...expected, expected[0]],
    expected.map((value, index) => index === 0 ? `${value}错` : value),
    [...expected, "额外文字"]
  ]) {
    assert.equal(readableTextIssue({ readable_text: observed }, anchor, "primary").code,
      "illustration_candidate_text");
  }
});
