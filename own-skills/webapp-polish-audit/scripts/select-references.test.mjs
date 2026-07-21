#!/usr/bin/env node
// selectReferenceCandidates 的回归测试：锁住"按证据选维度、不默认全选"。
// realFormTask 等浏览器端判据由 scripts/e2e-selection.mjs 在真实页面上覆盖。
import assert from "node:assert/strict";
import { selectReferenceCandidates } from "./page-inventory-probe.mjs";

const dims = (inventory) =>
  selectReferenceCandidates(inventory)
    .selected.map((s) => s.reference.match(/\/(\d\d)-/)[1])
    .sort();

const inv = (surfaces, counts = {}, evidence = {}) => ({ surfaces, counts, evidence });

// 纯内容页：无动作、无表单、无控件 —— 一条都不该选
assert.deepEqual(dims(inv({})), [], "纯内容页不应选中任何维度");

// 只有导航的页面：只触发响应式连续性
assert.deepEqual(dims(inv({ responsiveRisk: true })), ["11"]);

// 破坏性动作触发 03；仅有普通按钮不该触发
assert.deepEqual(dims(inv({ destructiveActionRisk: true })), ["03"]);
assert.deepEqual(dims(inv({ actions: true })), [], "仅有普通可点元素不得触发 03");

// 表单任务触发 07
assert.deepEqual(dims(inv({ formTask: true })), ["07"]);

// 自定义控件 / 纯图标动作触发 10
assert.deepEqual(dims(inv({ inputPerceptionRisk: true })), ["10"]);

// 关键 CTA 或确认弹层触发 13
assert.deepEqual(dims(inv({ criticalCtaOrConfirmDialog: true })), ["13"]);

// 全命中时五条齐出
assert.deepEqual(
  dims(
    inv({
      destructiveActionRisk: true,
      formTask: true,
      inputPerceptionRisk: true,
      responsiveRisk: true,
      criticalCtaOrConfirmDialog: true,
    }),
  ),
  ["03", "07", "10", "11", "13"],
);

// 每条选中必须自带证据（取代已废止的 md_evidence 人工填写）
const withEvidence = selectReferenceCandidates(
  inv({ destructiveActionRisk: true }, { dialogs: 0 }, { destructiveActions: ["删除项目"] }),
);
for (const item of withEvidence.selected) {
  assert.ok(item.evidence && Object.keys(item.evidence).length > 0, `${item.reference} 缺证据`);
  assert.ok(item.reason && item.reason.length > 0, `${item.reference} 缺 reason`);
}

// 未选中的必须落在 skipped 并说明原因——不能静默消失
const partial = selectReferenceCandidates(inv({ formTask: true }));
assert.equal(partial.selected.length + partial.skipped.length, 5, "五条维度必须全部有去向");
for (const item of partial.skipped) {
  assert.ok(item.reason && item.reason.length > 0, `${item.reference} 未说明跳过原因`);
}

// 绝不引用磁盘上不存在的维度文件
const fs = await import("node:fs");
const path = await import("node:path");
const skillDir = path.dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, "");
const all = selectReferenceCandidates(
  inv({
    destructiveActionRisk: true,
    formTask: true,
    inputPerceptionRisk: true,
    responsiveRisk: true,
    criticalCtaOrConfirmDialog: true,
  }),
);
for (const item of [...all.selected, ...all.skipped]) {
  assert.ok(fs.existsSync(path.join(skillDir, item.reference)), `引用了不存在的维度文件: ${item.reference}`);
}

process.stdout.write("select-references tests passed\n");
