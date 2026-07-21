# 16. 页面证据采集

S3 任务文档：对**一个**代表页面采集结构化证据，输出一份证据包 YAML。

**本 skill 不截图。** 所有判定的输入都是脚本采到的 DOM / a11y / 可见文本 / 计算样式 / 布局盒 / 交互状态 JSON。维度判定不看像素——需要视觉才能判的问题不在当前五维度覆盖范围内。

纯采集任务。绝不做维度判定，绝不产出 UI 发现、建议或实现意见。

## 输入

- `page.url` / `page.md`：S2 选出的该页维度数组。只读每份维度文档的「额外探查」一节用于探查池化，读到判定内容也绝不执行。
- `runDir`、`evidenceScript`（`scripts/page-evidence-probe.mjs`）、`originAllowlist`。

## 跨源与链接门禁

`originAllowlist` 是硬边界，任何时刻只允许 navigate 到清单内 origin。子域与主域视作不同 origin（`tranfu.com` ≠ `offerpilot-app.tranfu.com`）。

- **指向清单外 origin 的 `<a href>`**：只记录 href + 可见文本到证据包。不悬停触发 preload，不点击，不开 new-tab。
- **带 `target="_blank"` 或 `rel` 含 `external` / `noopener`**：无论 origin 是否在清单内，一律不开 new-tab。
- **同源但指向其他路由**：不点击进入。本任务只采一个页面，其他路由由主代理另派采集者。
- **nav 展开态 / dropdown / mega-menu**：允许悬停或键盘 focus 展开并重盘点；展开态里的链接按上述规则处理，只记录不打开。
- **`window.open` / JS navigate**：同 `<a>` 规则；无法预判目标 origin 时不触发。

违反任一条即视作副作用，验收失败。被门禁挡下的探寻记入 `gaps`：

```yaml
gaps:
  - kind: "cross-origin-not-inspected"
    href: "https://offerpilot-app.tranfu.com/"
    reason: "originAllowlist 未包含该 origin，仅记录链接不打开"
    surfaces: ["nav", "product-cta"]
```

`gaps` 是「查过了、按边界该停」的显式声明，不是失败。

## 采集流程

### 第 1 步：通用采集（维度无关，只跑一次）

```js
const { collectPageEvidence } = await import(
  "file://{ABSOLUTE_SKILL_DIR}/scripts/page-evidence-probe.mjs"
);
// 签名是 (browser, tab, options)，比 14 的脚本多一个 browser 参数（用于切视口）。
const evidence = await collectPageEvidence(browser, tab, { url: page.url });
// evidence.viewports.desktop / .narrow：两档视口盘点
// evidence.viewportCoverage：每档视口是否真正切换成功
// evidence.blockers：脚本层失败原因，逐条记入 gaps
```

**双视口**：桌面 `>=1280x720` 与窄屏 `<=390x844`，两档都要盘点。视口控制不可用如实记 `gaps`。

> 验窄屏必须真正切到目标宽度：先 resize，再 `evaluate_script` 断言 `window.innerWidth === 375`（或目标值）后才采数。窗口最小宽度限制可能让 resize 静默失败，不断言就会拿到桌面数据当窄屏结论。

**元素盘点字段契约**（`page-evidence-probe.mjs` 按此输出）：

- `selector` / `text` / `ariaLabel` / 包围盒 `box`（x / y / 宽 / 高）
- 样式向量 `style`：背景色 / 文字色 / 边框 / 圆角 / 字号 / 字重 / 内边距 / 行高
- **溢出标志** `overflow.clipX` / `clipY`：`scrollWidth > clientWidth`（横向裁切）、`scrollHeight > clientHeight`（被容器夹掉）——**只判裁切，不判换行**
- **换行嫌疑** `wrapSuspect`：内容高度 ≥ 1.8 × 行高

脚本跑完必须 **对账**：逐字段核对实际输出与上面清单，缺失字段逐条记 `gaps`，不要凭空填——维度判定读不存在的数据 = 幻觉。

注意：控件文字换不换行**不靠** `getClientRects().length`——它对 `button`、`td` 等块级 / inline-block / table-cell 控件恒为 1，内部换行测不出。用 `scrollWidth`/`clientWidth` 与行高比值判。

**翻开静态可达的隐藏面**：点开 tab、菜单、手风琴、下拉、popover 等**不产生副作用**就能到达的状态。每翻开一个，对新状态重做盘点，逐个登记进 `states_opened`；没翻到的记 `gaps` 并写明原因。

### 第 2 步：维度探查池化

一个页面常被多条维度同时查。**不要每条维度各自把页面重盘一遍**——那会造成盘点不一致、发现无法对齐。

1. 读 `page.md` 每份维度文档的「额外探查」声明，汇总成清单。
2. 取并集去重：同一个交互 / 状态只做一次（两条维度都要"打开那个菜单" → 只开一次，证据共用）。
3. **先写出 `probe_pool` 再执行**——先列清单后执行，跳过的条目会在清单上留洞；不列清单，跳过就无痕蒸发。
4. 逐条执行，每到新状态重做盘点；执行不了的逐条进 `gaps`。

**副作用约束**：若某状态需要提交 / 删除 / 写数据才能到达——**不执行**，记成「声明了但只读被阻挡」的 `gaps`，挂该维度名下。这是缺口，不是失败，更不是"查过了"。

**`脚本直判` class 的操作卡优先**：维度 md 内声明为 `脚本直判` 的 class 各自带「操作卡 · 怎么做」与「操作卡 · 绝对不要」。这些 class 的证据由操作卡直接指定的 `evaluate_script` / `resize_page` / `press_key` 采集，**不经过本文件的通用盘点**。操作卡里的「绝对不要」是硬边界，其中已明确禁止截图与派判断者。

### 采证 scope 收窄

采什么完全由 `page.md` 驱动，**不做全套默认采集**：

| `page.md` 不含 | 不采 |
| --- | --- |
| `03` | 破坏性动作的样式分桶、confirm dialog 静态盘点 |
| `07` | 表单字段契约、只读可达校验态、字段状态分组 |
| `10` | 仅悬停探测、Tab 走查、触摸目标尺寸、对比度计算、缩放重排、纯图标盘点 |
| `11` | 窄视口重盘点、横向溢出排查、弹层小屏几何、跨视口 label 比对 |
| `13` | CTA / dialog 文案盘点 |

`page.md` 为空则只采 desktop 默认元素盘点一次。

### 第 3 步：落盘

盘点输出按视口与状态写成 JSON 文件：

```text
{pageSlug}__{state}__{device}__inventory.json
```

- `pageSlug`：URL 路径 `/` 换 `-`，根路径用 `home`（`/resources/` → `resources`）
- `state`：`default` / `nav-open` / `validation-error` …；每个状态取一个稳定短名
- `device`：`desktop` / `mobile`

维度专属探查（操作卡产出）另写成 `{pageSlug}__{dimension}-{class}__probe.json`，如 `settings__07-C__probe.json`。

所有文件只写 `runDir`。没落盘的数据不算证据，记 `gaps`。

## 输出证据包

```yaml
page:
  url: "http://localhost:3000/settings/"
  page_type: "设置表单页"
  run_dir: "/tmp/webapp-polish-audit/20260611-153042-settings"
  inventory:
    - file: "settings__default__desktop__inventory.json"
      state: "default"
      device: "desktop"
      viewport: "1280x720"
      surfaces: ["nav", "form", "footer"]
    - file: "settings__default__mobile__inventory.json"
      state: "default"
      device: "mobile"
      viewport: "375x812"
      surfaces: ["nav", "form"]
  probes:
    - file: "settings__07-C__probe.json"
      dimension: "07"
      class: "C"
      note: "只读可达校验态：漏填必填 + 错误格式"
  states_opened: ["主导航移动端菜单", "邮箱字段校验失败态"]
  probe_pool:
    - "打开主导航移动端菜单（10/11 合并）"
    - "触发只读可达前端校验（07.C）"
  gaps:
    - kind: "readonly-blocked"
      dimension: "07"
      class: "D"
      reason: "提交成功 / 失败态需真实提交，只读不可达"
```

`surfaces` 是该盘点覆盖的界面类型标签（`nav` / `form` / `table` / `card-list` / `list` / `modal` / `toast` / `footer` / `button`）。`gaps` 键必须存在，空数组是「查过了没缺口」的显式声明。

## 验收标准

- 合法 YAML，顶层键 `page`；`url` / `page_type` / `run_dir` / `inventory` / `probes` / `states_opened` / `probe_pool` / `gaps` 全部存在。
- 每个 `inventory` / `probes` 项的 `file` 在 `run_dir` 中真实存在且是合法 JSON。
- 双视口盘点齐全，或对应缺口在 `gaps` 中；窄视口数据须有 `innerWidth` 断言通过的证明。
- `page.md` 中每个 `脚本直判` class 都有对应 `probes` 条目或 `gaps` 条目。
- `probe_pool` 先列后执行，每条反映在 `states_opened` 或 `gaps` 中。
- 元素盘点字段契约逐字段对账完成，缺失字段已进 `gaps`。
- **输出不含任何 PNG 引用**——本流程不截图。
- 输出不含任何问题发现、建议或源码引用；`runDir` 之外零写入。
- 网络访问只落在 `originAllowlist` 内。验收者观察到越界访问即判失败。

## 派发模板

采集者：

```text
角色：你是 S3 采集者，只采集一个代表页面的结构化证据，不截图、不做 UI 判断。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/16-page-exploration-and-capture.md，以及 page.md 中的额外探查声明与各 class 的操作卡。

输入：
- page: {PAGE_PLAN}
- runDir: {RUN_DIR}
- originAllowlist: {ORIGIN_ALLOWLIST}
- evidenceScript: {ABSOLUTE_SKILL_DIR}/scripts/page-evidence-probe.mjs

要求：
- 接到任务先创建 stage3 progress 文件。
- 先列 probe_pool，再执行安全可达状态；副作用状态写 gaps。
- 切窄视口后必须断言 innerWidth 再采数。
- 只输出本文定义的证据包 YAML。
```

验收者（独立上下文）：

```text
角色：你是独立 S3 验收者，未参与当前页面采集。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/16-page-exploration-and-capture.md 的验收标准。

输入：
- pagePlan: {PAGE_PLAN}
- evidenceBundle: {EVIDENCE_BUNDLE}
- runDir: {RUN_DIR}

验证证据包结构、JSON 文件存在性与可解析性、双视口断言、probe 覆盖、probe_pool、gaps 与 origin 合规。
只输出 JSON：{"verdict":"pass|fail","errors":["..."]}
```
