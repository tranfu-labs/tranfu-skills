// 验证 11.F 的孤字折行判据：Range 能否测出真实行数、三类嫌疑是否分得开
// 11.F 判据自检：验证孤字折行 / nowrap 裁切 / 省略号截断三类嫌疑分得开。
//   node scripts/fit-check.mjs                 # 跑内置对照页（带期望值断言）
//   node scripts/fit-check.mjs <url>           # 跑真实页面（只列出命中项）
// playwright 从环境解析；本 skill 不把它列为运行依赖，仅用于手动复验。
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(process.env.PLAYWRIGHT_FROM || `${process.cwd()}/package.json`);
const { chromium } = require("playwright");
const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const url = process.argv[2] || `file://${path.join(SKILL, "scripts", "fixtures", "fit.html")}`;
const isFixture = url.endsWith("/fit.html");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(url, { waitUntil: "load" });

const rows = await page.evaluate(() => {
  const sels = "button, span, p, a, [role=button]";
  const out = [];
  for (const el of document.querySelectorAll(sels)) {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const cs = getComputedStyle(el);

    // 关键：只对「叶子文本元素」测行数。对含子元素的元素调 selectNodeContents，
    // getClientRects 返回的是各子元素盒子的矩形数（button>span+svg 会得到 3），
    // 那不是行数。真正被折行的永远是承载文本的那一层。
    const kids = [...el.childNodes];
    const isLeafText = kids.length > 0 && kids.every((n) => n.nodeType === 3);
    if (!isLeafText) continue;

    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const lineCount = rects.length;
    const lastLineRatio = lineCount >= 2 ? rects[rects.length - 1].width / rects[0].width : 1;

    // 视觉隐藏元素（sr-only 等）不参与视觉贴合判定——它们的典型实现就是
    // width:1px + overflow:hidden + nowrap，必然假命中裁切。
    const rect = el.getBoundingClientRect();
    const visuallyHidden =
      rect.width <= 1 ||
      rect.height <= 1 ||
      /^rect\(0px,\s*0px,\s*0px,\s*0px\)$/.test(cs.clip) ||
      cs.clipPath === "inset(50%)" ||
      /\b(sr-only|visually-hidden|screen-reader-text)\b/.test(
        typeof el.className === "string" ? el.className : "",
      );
    if (visuallyHidden) continue;

    // 行内元素没有真正的滚动盒，scrollWidth/clientWidth 恒等，裁切判据对它无效。
    const hasScrollBox = cs.display !== "inline";
    // 亚像素舍入与字体度量误差通常 1–3px；低于门槛的溢出是噪声不是裁切。
    const OVERFLOW_NOISE_PX = 4;
    const overflowX = el.scrollWidth - el.clientWidth;
    const reallyClipped = overflowX >= OVERFLOW_NOISE_PX;
    // 孤字折行只对「本该一行放下的控件标签」成立；段落正文折行是正常排版。
    const roleAttr = el.getAttribute("role") || "";
    const isControl =
      /^(BUTTON|A|LABEL|SUMMARY|TH)$/.test(el.tagName) ||
      ["button", "tab", "menuitem", "link", "option"].includes(roleAttr) ||
      Boolean(el.closest("button, [role=button], [role=tab], a"));
    const isProse = /^(P|LI|BLOCKQUOTE|DD|TD|ARTICLE)$/.test(el.tagName);

    // 余量顶格：文字比内容盒还宽 = padding 被侵蚀。
    // 余量 == 0 是 auto 宽度按钮的正常态，不是缺陷；-1 门槛避开亚像素舍入。
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const contentBox = el.clientWidth - padL - padR;
    const textWidth = rects.length ? Math.max(...rects.map((r) => r.width)) : 0;
    const slack = contentBox > 0 && textWidth ? +(contentBox - textWidth).toFixed(1) : null;
    const cramped = slack !== null && slack < -1;

    const nowrapClip = cs.whiteSpace === "nowrap" && hasScrollBox && reallyClipped;
    const orphanWrap = isControl && !isProse && lineCount >= 2 && lastLineRatio < 0.6;
    const ellipsisClip = cs.textOverflow === "ellipsis" && hasScrollBox && reallyClipped;

    const hasCompletion = Boolean(el.title || el.getAttribute("aria-describedby"));
    const longText = text.length > 20;
    const intentionalMultiline = cs.whiteSpace === "pre-line" || cs.whiteSpace === "pre-wrap";

    // 按严重度归因，重的优先：文字看不见 > 排版坏 > 只是没余量。
    // 裁切的元素必然也余量为负，若顶格排前面会把所有裁切误标成顶格。
    const suspicion = nowrapClip
      ? "nowrap 裁切"
      : ellipsisClip
        ? "省略号截断"
        : orphanWrap
          ? "孤字折行"
          : cramped
            ? "余量顶格"
            : null;
    const released = hasCompletion || (orphanWrap && (longText || intentionalMultiline));

    out.push({
      rawId: el.id,
      id: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`,
      text: text.slice(0, 24),
      lineCount,
      lastLineRatio: Number(lastLineRatio.toFixed(2)),
      whiteSpace: cs.whiteSpace,
      overflowX,
      slack,
      suspicion,
      hasCompletion,
      longText,
      actionable: Boolean(suspicion) && !released,
    });
  }
  return out;
});
await browser.close();

// 期望：id → 是否该定罪
const EXPECT = {
  cramped: true,       // 固定宽度装不下，padding 被侵蚀
  autofit: false,      // auto 宽度，余量恰为 0 是正常态
  roomyfixed: false,   // 固定宽度但余量充裕
  orphan: true,        // 孤字折行
  clipped: true,       // nowrap 裁切
  noTitle: true,       // 省略号截断且无补全
  intentional: false,  // 有意多行
  hastitle: false,     // 有 title 补全
  fine: false,         // 宽敞单行
  longtext: false,     // 长文本正常折行
};

if (!isFixture) {
  const hits = rows.filter((r) => r.actionable);
  console.log(`${url}\n扫描 ${rows.length} 个元素，命中 ${hits.length} 项：\n`);
  for (const h of hits) {
    console.log(`  [${h.suspicion}] ${h.id}  "${h.text}"`);
    console.log(`      行数 ${h.lineCount}  末行比 ${h.lastLineRatio}  whiteSpace=${h.whiteSpace}`);
  }
  if (hits.length === 0) console.log("  （无命中）");
  process.exit(0);
}

console.log("id".padEnd(13), "行数".padEnd(5), "末行比".padEnd(7), "嫌疑".padEnd(14), "定罪  期望  结果");
console.log("-".repeat(72));
let bad = 0;
const seen = new Set();
for (const r of rows) {
  if (!(r.rawId in EXPECT)) continue;
  seen.add(r.rawId);
  const want = EXPECT[r.rawId];
  const ok = r.actionable === want;
  if (!ok) bad++;
  console.log(
    r.rawId.padEnd(13),
    String(r.lineCount).padEnd(5),
    String(r.lastLineRatio).padEnd(7),
    String(r.suspicion || "—").padEnd(14),
    String(r.actionable).padEnd(6),
    String(want).padEnd(6),
    ok ? "✓" : "✗ 不符",
  );
}
// 防假通过：期望用例必须全部被扫到，一个都不能漏
const missing = Object.keys(EXPECT).filter((k) => !seen.has(k));
if (missing.length) {
  console.log(`✗ 未扫到用例（判据把它们整个滤掉了）: ${missing.join(", ")}`);
  bad += missing.length;
}
console.log("-".repeat(72));
console.log(bad === 0 ? `✓ 孤字判据全部符合预期（${seen.size} 个用例）` : `✗ ${bad} 项不符`);
process.exit(bad === 0 ? 0 : 1);
