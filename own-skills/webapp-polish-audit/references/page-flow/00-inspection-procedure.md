# 00. 逐页探寻流程 / Per-Page Inspection Procedure

这是**流程文件**，和 `14/15/16` 同级，不是一条审查维度。`14/15/16` 管跨页编排（发现 / 派发 / 逐页调度），本文件管"在一个页面内，怎么把界面和状态完整翻出来"。

任何维度判断之前，必须先按本流程把这一页探寻一遍，产出一个**证据包**；然后 `page.md` 里选中的每条维度，各自拿自己的形式目录去比对同一个证据包。**采集共享，判断各自独立。**

维度文档（`09…13`）不重写探寻机制，只声明三件事：① 本维度向引擎申请的**额外探查**；② **形式目录**；③ **判定**。

## 何时运行

- 单页与多页一致：阶段 3 的探索 subagent 在采集时跑一次本流程（`16` 会引本文件）。
- 仅当运行时没有只读 SubAgent 机制、走 `local sequential fallback` 时，才由主 agent 在主会话本地跑本流程。

## 输入 / 输出

输入：

- `page.url`
- `page.md`：本页选中的维度数组（= 本页要查哪些维度）。
- `evidenceScript`：`scripts/page-evidence-probe.mjs`。

输出（证据包）——每项 MUST 落进最终输出的对应槽位，不许只留在工作记忆里。标准模式 = 阶段 3 manifest（`16` 输出 YAML）的 `screenshots` / `inventory` / `states_opened` / `probe_pool` / `gaps` 槽位；`local sequential fallback` = 最终回复里的同名清单：

- 双视口整页截图（含长页覆盖结果），逐张登记进截图清单（视口、覆盖范围、`kind: full`）。
- 元素盘点（脚本输出：`selector` / `text` / `box` / 样式向量 / 溢出标志 / `wrapSuspect`）。
- 关键 CTA 与嫌疑控件的放大特写，逐张登记（`kind: closeup`，对应 `closeupTargets` 条目）。
- 环节二翻出的各状态截图与盘点，翻开的状态逐个登记（`states_opened`）。
- **缺口清单**（`gaps`）：没截到 / 没翻到 / 副作用阻挡 / 视口不可用 / 脚本缺字段的，逐条记。

## 环节一 — 通用采集（维度无关，只跑一次）

脚本盘点用证据脚本的主入口一次跑完双视口：

```js
const { collectPageEvidence } = await import(
  "file://{ABSOLUTE_SKILL_DIR}/scripts/page-evidence-probe.mjs"
);
// 注意：签名是 (browser, tab, options)，比 14/15 的脚本多一个 browser 参数（用于切视口）。
// NEVER 照搬 14/15 的 (tab, options) 调用模式。
const evidence = await collectPageEvidence(browser, tab, { url: page.url });
// evidence.viewports.desktop / evidence.viewports.narrow：两档视口的盘点（1.3 字段契约）。
// evidence.viewportCoverage：记录每档视口是否真正切换成功。
// evidence.blockers：脚本层失败原因，逐条记入缺口清单。
```

### 1.1 双视口

桌面 `>=1280x720` 与 窄屏 `<=390x844`，两档都要。视口控制不可用就如实记进缺口清单。

### 1.2 整页截图覆盖

- 默认：从上到下完整截图，不漏首屏外内容。
- 若有横向溢出（`overflowX`），右边界也要截到。
- 每张整页 / 分段截图都登记进截图清单（视口、覆盖范围、`kind: full`）。没登记的截图不算证据。
- **长页面分支**：先判断中段是「真同质」还是「伪同质」，再决定能不能省。
  - 真同质 = 散文正文 / 同一模板无逐项状态地重复。
  - 伪同质 = 一串各自带状态的列表项 / 卡片（任意一项可能单独坏）。
  - **判断方法**：在中段取 1–2 个采样点比对，确认确实同质，才能下结论。**不抽样不许跳。**
  - 真同质：抽样确认后，**跳到页尾，从底往上扫**（页尾 / 页脚是下一处不同内容）。
  - 伪同质：**不许跳**，逐屏覆盖。

### 1.3 元素盘点（字段契约）

枚举所有可见候选元素，每个至少记录：

- `selector` / `text` / 包围盒（`box`：x / y / 宽 / 高）
- 样式向量（`style`）：背景色 / 文字色 / 边框 / 圆角 / 字号 / 字重 / 内边距 / 行高
- **溢出标志**（`overflow.clipX` / `overflow.clipY`）：`scrollWidth > clientWidth`（横向裁切）、`scrollHeight > clientHeight`（被容器夹掉）——**只判裁切，不判换行**。
- **换行嫌疑**（`wrapSuspect`）：内容高度 ≥ 1.8 × 行高。这是高查全信号，定罪必须走放大视觉判定。

这是**盘点的字段契约**，`page-evidence-probe.mjs` 按此契约输出。脚本跑完 MUST 做一步**对账**：逐字段核对脚本实际输出与上面清单，缺失字段逐条记进缺口清单，不要凭空填——维度判定读不存在的数据 = 幻觉。

注意：控件文字**换不换行 / 装不装得下**不靠 `getClientRects().length`——它对 `button`、`td` 等块级 / inline-block / table-cell 控件**恒为 1**，内部换行测不出；这类一律走**放大视觉判定**（→ `09` G / `06` A）。

**关键 CTA 的操作定义** = 脚本输出的 `closeupTargets` 清单：有填充底色且处于首屏 1.5 屏内的控件（`primary-cta`）、`wrap-suspect` 命中项、`clip-suspect` 命中项、全页文字最长的控件（`longest-label`）。维度判定 MUST NOT 缩小这份清单，可以追加。

对 `closeupTargets` 的**每一条**，用脚本的特写助手裁剪放大重采一张特写并登记进截图清单（`kind: closeup`）；做不到的逐条进缺口清单：

```js
const { prepareCloseup, resetCloseup } = await import(
  "file://{ABSOLUTE_SKILL_DIR}/scripts/page-evidence-probe.mjs"
);
await prepareCloseup(tab, target.selector, { scale: 3 }); // 视觉放大，不重排版，换行状态保持原样
// → 用 Browser 截一张当前视口截图，登记为该 target 的特写
await resetCloseup(tab);
```

### 1.4 翻开静态可达的隐藏面

点开 tab、菜单、手风琴、下拉、popover 等**不产生副作用就能到达**的状态。每翻开一个，对新状态重做 1.3 的盘点（并按需补截图）。

### 1.5 可达性记录

记录：翻到了哪些状态（逐个进 `states_opened`）、哪些没翻到、为什么没翻到。没翻到的进缺口清单。

## 环节二 — 维度探查池化（维度驱动，合并去重后只跑一次）

一个页面常被多条维度同时查（例如 `page.md = [09, 10, 12]`）。**不要每条维度各自把页面重截、重点一遍**——那会三遍覆盖不一致，发现无法对齐。改成：采集一次，各维度的额外探查**合并去重后**一次执行。

### 2.1 收集探查请求

读 `page.md` 每个维度文档的"额外探查"声明（各维度自己列），汇总成一张探查清单。

### 2.2 取并集去重，先写清单再执行

同一个交互 / 状态只做一次。例：两条维度都要"打开那个菜单" → 只开一次，证据共用。

合并后的探查清单 MUST **先写出来再执行**——这就是 `probe_pool` 产物，随证据包一起交付。先列清单后执行，跳过的条目会在清单上留洞；不列清单，跳过就无痕蒸发。

### 2.3 一次执行

按 `probe_pool` 逐条执行（点击 / hover / 键盘 Tab / 缩放 / 到达只读可达的 loading·空·错态……）。每到一个新状态，重做盘点 + 按需截图，并入证据包；执行不了的条目逐条进缺口清单。

### 2.4 副作用约束（一等公民）

本 skill 只读、禁副作用。若某维度声明的状态需要提交 / 删除 / 写数据 / 触发外部副作用才能到达：

- **不执行副作用。**
- 记成「声明了但只读被阻挡」的缺口，挂在该维度名下。
- 这是**缺口**，不是失败，更不是"查过了"。

## 缺口诚实

截断、够不到的状态、副作用阻挡、视口控制不可用、脚本缺字段——全部显式进缺口清单。维度判定阶段对相关缺口要输出 `blocker`，**绝不静默当全清**。漏掉的证据就是下一个被放过的缺陷。

缺口清单不是工作记忆：标准模式写进阶段 3 manifest 的 `gaps`；`local sequential fallback` 写进最终回复。`gaps` 键 MUST 存在，哪怕为空数组——空数组是"查过了没缺口"的显式声明，缺这个键 = 没做对账。

## 交给维度

证据包就绪后，`page.md` 里每条维度各自跑自己的「形式目录 + 判定」。本流程到此结束，不做任何视觉 / 产品判断。
