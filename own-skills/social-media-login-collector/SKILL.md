---
name: social-media-login-collector
description: >-
  Use when the user explicitly asks Codex to log in to, collect, export, or download
  authenticated analytics from WeChat Official Accounts, Xiaohongshu, Zhihu, Toutiao,
  or Weibo, including one platform or all supported platforms. The skill performs
  human-in-the-loop login and read-only collection, validates the result, and emits
  generic reports plus optional social-media-analytics-app compatibility files. Do NOT
  trigger when the user asks for public-web research, passive analysis of existing data,
  publishing or editing content, account changes, engagement actions, authentication
  bypass, or collection from unsupported platforms.
version: 0.1.0
author: BruceL017
updated_at: 2026-07-24
origin: own
allow_exec: true
---

# 社媒登录采集器

## 安全边界

只执行用户明确要求的只读采集。让用户亲自完成扫码、密码、短信、OTP、验证码和设备确认。不得读取、打印、复制或保存 Cookie、Token、认证头、手机号、验证码、密码、localStorage、sessionStorage 和认证文件。

只使用 `browser:control-in-app-browser` Skill 控制 Codex 内置浏览器，并在任何浏览器动作前完整读取该 Skill。复用当前浏览器配置和登录态；不得切换到外部浏览器、独立 Playwright、代理、伪装指纹或其他控制机制。

不得发文、删除、关注、取关、点赞、评论、私信、修改设置、购买服务或开启试用。不得调用隐藏接口、重放 XHR、构造分页 URL、清理浏览器存储或自动切换账号。

严格串行执行：同一时间只操作一个平台、一个账号、一个标签页。不要添加随机“真人化”动作或无证据的固定等待；每次动作后等待页面可见状态稳定。

## 选择模式

1. 默认一次采集一个平台；用户说“采集全部平台”时按微信、小红书、知乎、头条、微博顺序执行。
2. 默认范围为 `Asia/Shanghai` 时区内截至昨天的 30 个完整自然日。用户指定范围时使用用户范围；平台无法精确选择时记录实际范围并标记 `partial`。
3. 同一批多平台采集共用一个安全的 `run-id`。
4. 当当前目录或父目录同时满足以下条件时启用看板模式：
   - `package.json.name` 为 `social-media-analytics-app`
   - 存在 `lib/import/parsers.ts`
   - 存在 `scripts/import-social-data.ts`
5. 其他情况使用通用模式，输出到 `<cwd>/output/social-collections/<run-id>/<platform>/`。

开始采集前读取 [manifest-schema.md](references/manifest-schema.md)。看板模式再读取 [dashboard-adapter.md](references/dashboard-adapter.md)。只读取当前平台的 reference：

- 微信：[wechat.md](references/wechat.md)
- 小红书：[xiaohongshu.md](references/xiaohongshu.md)
- 知乎：[zhihu.md](references/zhihu.md)
- 头条：[toutiao.md](references/toutiao.md)
- 微博：[weibo.md](references/weibo.md)

## 执行流程

1. 连接 Codex 内置浏览器并优先复用当前官方后台标签页；没有合适标签页时只打开 reference 中的官方入口。
2. 检查登录状态。未登录时显示浏览器并让用户完成登录，然后结束当前回复，等待用户确认“已登录”。
3. 登录后确认账号名称。存在多个账号且当前账号不明确时，让用户选择；不得自动切换。
4. 通过可见菜单进入数据页并选择日期范围。每个所需数据模块最多执行一次平台原生导出，使用结构化表格解析器检查文件签名、表头、日期和行数；不要把“已下载”当作“已采集完成”。
5. 原生下载不可用时，只使用当前平台 reference 中最少交互的可见数据回退。定位失败最多重新读取一次 DOM 快照；分页只点击可见“下一页”，页码不前进、首尾记录重复或日期越界时立即停止。
6. 建立标准 manifest。只保留 reference 列出的指标字段；不得保存整页 DOM、iframe URL、网络请求、脚本状态或未知页面对象。后台 `source_url` 只写 `https://host/path`，删除 query、fragment 和 userinfo。
7. 按 manifest 契约完成日期覆盖、必采指标、来源、内容唯一性和平台汇总对账。只有唯一算术关系可产生派生值，并标记 `method: derived`、`confidence: derived`。
8. 使用 bundled Python 运行通用导出：

```bash
<bundled-python> {baseDir}/scripts/export_collection.py --manifest <manifest.json>
```

使用 `codex_app__load_workspace_dependencies` 获取 `<bundled-python>`；不要硬编码本机运行时路径。后续只使用导出器生成并带哈希报告的 `collection.json`。

9. 看板模式生成当前批次文件：

```bash
node {baseDir}/scripts/build_dashboard_exports.mjs \
  --manifest <generic-output>/collection.json \
  --project-root <dashboard-root> \
  --output <dashboard-root>/data/imports/<run-id>
```

10. 看板生成器必须用目标项目的 `parseSocialFile()` 验证可导入看板的根目录文件；微博独立工作簿使用内置校验。校验完成后先报告结果并等待用户确认；只有明确确认后才能运行：

```bash
pnpm import:social-data -- --dir data/imports/<run-id> --trigger browser_collect
```

不得把“采集数据”解释为已经授权写入 SQLite，也不得导入共享的 `data/imports` 根目录。

## 完整性门槛

- `success` 必须覆盖声明范围的每个日期；必采指标每天非空，并具有来源和汇总。
- `followers_total` 必须取范围最后一天的值；未知值不得改写为 `0`。
- 内容必须按公开内容 ID 去重；没有 ID 时使用标题、发布时间和公开 URL 的复合键。
- 必须记录页面或导出的总数、末页证据和平台上限。无法证明末页、达到导出上限、遇到付费限制或汇总不一致时使用 `partial`。
- Tooltip、表格和原生导出中的精确数值可标记 `exact`。仅凭 SVG 路径或像素坐标估算的值不得标记 `exact`，不得进入看板。
- `partial` 和 `failed` 只生成通用报告；微博可额外生成带限制说明的独立工作簿，但永不进入 SQLite。

## 风控停机规则

出现 CAPTCHA、滑块、异常登录、设备或实名确认、短信验证、访问频繁、403/429、重新认证或非预期跨域跳转时：

1. 立即停止全部浏览器动作，不刷新、不重试、不点击验证控件。
2. 显示当前页面，让用户处理并等待明确确认。
3. 恢复后重新确认同一账号、日期范围和数据模块。
4. 同一任务再次出现风险信号时终止采集，按已有数据标记 `partial` 或 `failed`。

## 完成报告

报告平台、账号、实际日期范围、状态、每类数据行数、核心汇总、文件绝对路径、精确与派生指标、缺失或付费字段、看板解析结果，以及 SQLite 是否仍待确认。随后停止。
