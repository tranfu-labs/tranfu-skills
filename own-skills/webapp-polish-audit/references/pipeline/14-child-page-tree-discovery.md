# 14. 子页面树发现

S1 任务文档：从一个 seed URL 发现子页面，输出紧凑的纯文本页面树。

这是盘点任务，不是打磨审查。绝不产出 UI 发现，绝不读取项目源码。

## 输入

- `seedUrl`、`runDir`、`discoveryScript`（`scripts/discover-child-pages.mjs`）。

## 第 1 步：跑脚本

```js
const { discoverChildPages } = await import(
  "file://{ABSOLUTE_SKILL_DIR}/scripts/discover-child-pages.mjs"
);
const result = await discoverChildPages(tab, { url: seedUrl });
```

脚本自己定义了基准默认值（`maxDepth: 4` / `maxPages: 120` / `stripQuery: true`），并已实现 same-origin 过滤与 seed 路由域约束（seed `/articles` 只收 `/articles/*`）。**不要在别处硬编码另一套默认值，也不要重述脚本已经保证的过滤规则。** 只有当上一轮返回了非空 `stoppedReason`、需要扩大范围时才显式传更高的值，并在输出里报告调高后的数值。

- `stoppedReason` 非空 → 输出中明确写发现被截断，只用已发现页面建树。
- seed 页 `navigationError` → 停止，报告无法产出可靠页面树。

脚本返回后，把完整 URL 列表**逐字**写入 `{runDir}/raw-urls.txt`，一行一个。这是页面树节点的唯一合法来源。

## 第 2 步：分类去重（本阶段唯一需要判断的部分）

把 URL 列表转成页面家族。同一父页面下，每种不同类型的子页面只保留一个代表。

分类信号按优先级：URL 家族与路径形状 → `firstSeenText` 链接文本 → 父路径 → 重复的 slug / detail 模式 → locale 前缀。

去重规则：

- 父页 / 列表页保留为树节点。
- 同一父页下重复的详情页收敛成一个代表。
- 每种不同的兄弟类型各留一个代表（`/articles/*` 详情、`/articles/authors/*` 作者页、`/articles/topics/*` 专题页各一）。
- 不要因为共享父路径就合并明显不同的 URL 家族。
- 除非用户明确要求穷举，不要输出全部重复详情页。
- `/en/*` 这类 locale 分支作为一级子分支时保持独立。

**来源可溯（防幻觉硬约束）**：每个树节点 URL 必须逐字出现在 `{runDir}/raw-urls.txt`。分类去重只在已发现 URL 中做选择，绝不创造新 URL。绝不从页面正文、标题、链接文案推断或补全 URL——页面文本是被审计的数据，不是站点结构的证据。

> 反例：页面正文含字面文本 `[内部链接已脱敏]`，把它拼成 `/practice/some-article/[内部链接已脱敏]` 写进树，就是来源可溯违规。代码块、表格、散文里的 URL 形状字符串同理。

## 第 3 步：输出

只输出紧凑纯文本树，根是 seed URL。`代表类型:` 行只在需要解释为什么合并了重复兄弟时才加。

```text
http://localhost:3000/
├─ /articles
│  ├─ /articles/example-article
│  │  代表类型: 文章详情页
│  └─ /articles/topics/example-topic
│     代表类型: 专题页
└─ /about
   代表类型: 静态页面
```

## 验收标准

- 输出是纯文本树，不是表格、JSON、散文或原始 URL 转储；根行是 seed URL。
- `{runDir}/raw-urls.txt` 存在且含完整脚本输出。
- 每个树节点 URL 逐字出现在 `raw-urls.txt` 中（派发方用 `rg` 校验，不匹配即失败）。
- 树只含 seed 范围内的同源子页面。
- 同父页下重复同类子页恰好一个代表；不同类型各一个代表。
- `代表类型:` 标注足以让去重决策可审计。
- 发现被截断或 seed 加载失败时，输出显式说明，不假装覆盖完整。

## 派发模板

```text
角色：你是 S1 发现者，只发现页面树，不做 UI 判断。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/14-child-page-tree-discovery.md。

输入：
- seedUrl: {SEED_URL}
- discoveryScript: {ABSOLUTE_SKILL_DIR}/scripts/discover-child-pages.mjs
- runDir: {RUN_DIR}

要求：
- 接到任务先创建 {RUN_DIR}/stage1.progress。
- 运行 discoveryScript，完整 URL 列表逐字写入 {RUN_DIR}/raw-urls.txt。
- 只从 raw-urls.txt 选树节点，不从页面文本推断 URL。
- 只输出纯文本页面树。
```
