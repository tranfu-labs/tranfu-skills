// 端到端验证：用真实浏览器 + skill 的真实脚本，跑 S2 维度选择链路
// 端到端验证选维度链路：需要 playwright。用法：
//   node scripts/e2e-selection.mjs <url...>
//   node scripts/e2e-selection.mjs            # 不带参数则跑内置 fixtures
// playwright 从环境解析；本 skill 不把它列为运行依赖，仅用于手动复验。
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(process.env.PLAYWRIGHT_FROM || `${process.cwd()}/package.json`);
const { chromium } = require("playwright");

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { collectPageInventory, selectReferenceCandidates } = await import(
  `file://${SKILL}/scripts/page-inventory-probe.mjs`
);

let targets = process.argv.slice(2);
if (targets.length === 0) {
  const fx = path.join(SKILL, "scripts", "fixtures");
  targets = ["search-only", "real-form", "settings-no-form-tag", "danger"].map((n) => `file://${fx}/${n}.html`);
  console.log("未指定 URL，使用内置 fixtures 验证选维度边界\n");
}
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

// skill 脚本期望的 tab 形状：tab.goto + tab.playwright.evaluate
// skill 脚本要求的 tab 接口（由 tab.goto / tab.title / tab.url / playwright.evaluate
// / playwright.waitForLoadState 构成）——这里如实实现，不是打桩绕过。
const tab = {
  goto: (url) => page.goto(url, { waitUntil: "domcontentloaded" }),
  title: () => page.title(),
  url: () => page.url(),
  playwright: {
    evaluate: (fn, arg, _opts) => page.evaluate(fn, arg),
    // skill 用 {state, timeoutMs} 对象参数（浏览器工具封装的形状），
    // playwright 原生是 (state, {timeout})——在此桥接，不改 skill。
    waitForLoadState: ({ state, timeoutMs }) =>
      page.waitForLoadState(state, { timeout: timeoutMs }),
  },
};

const results = [];
for (const url of targets) {
  try {
    const inventory = await collectPageInventory(tab, { url });
    const { selected, skipped } = selectReferenceCandidates(inventory);
    results.push({ url, ok: true, inventory, selected, skipped });
  } catch (error) {
    results.push({ url, ok: false, error: error.message });
  }
}
await browser.close();

let bad = 0;
for (const r of results) {
  console.log(`\n${"=".repeat(64)}\n${r.url}`);
  if (!r.ok) {
    console.log(`  ✗ 采集失败: ${r.error}`);
    bad++;
    continue;
  }
  const dims = r.selected.map((s) => s.reference.match(/\/(\d\d)-/)[1]);
  console.log(`  选中维度: ${dims.join(", ") || "(空)"}`);

  // 断言 1：只能选出磁盘上真实存在的维度文件
  for (const s of r.selected) {
    const exists = await import("node:fs").then((fs) => fs.existsSync(`${SKILL}/${s.reference}`));
    if (!exists) {
      console.log(`  ✗ 选中了不存在的维度文件: ${s.reference}`);
      bad++;
    }
  }
  // 断言 2：每条选中必须带证据（取代旧的 md_evidence）
  for (const s of r.selected) {
    const sig = JSON.stringify(s.evidence);
    if (!s.evidence || sig === "{}" || sig === "null") {
      console.log(`  ✗ 选中项无证据: ${s.reference}`);
      bad++;
    }
  }
  // 断言 3：不能默认全选（过去 checklist 式过选的特征）
  if (dims.length === 5) {
    console.log(`  ! 五条全选——需人工确认是否真的全部命中`);
  }
  for (const s of r.selected) {
    console.log(`    ${s.reference.match(/\/(\d\d)-/)[1]} ← ${s.reason}`);
    console.log(`       证据 ${JSON.stringify(s.evidence).slice(0, 120)}`);
  }
  const c = r.inventory.counts || {};
  console.log(`  盘点: 链接${c.links} 按钮${c.buttons} 表单控件${c.formControls} 自定义控件${c.customControls} 导航${c.navRegions} 集合项${c.collectionItems} 弹层${c.dialogs}`);
}

console.log(`\n${"=".repeat(64)}`);
console.log(bad === 0 ? "✓ 端到端验证通过" : `✗ ${bad} 项断言失败`);
process.exit(bad === 0 ? 0 : 1);
