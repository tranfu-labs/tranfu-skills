# Social Media Login Collector

**中文** | [English](README_EN.md)

一个面向 Codex 的社媒后台登录采集 Skill。它在用户亲自完成登录后，通过 Codex 内置浏览器只读采集微信公众号、小红书、知乎、今日头条头条号和微博的数据，生成经过校验的 JSON、CSV、Excel 报告，并可选生成 `social-media-analytics-app` 兼容文件。

本项目不会自动登录、保存认证信息或绕过平台验证，也不能保证平台风控概率为零。其目标是把浏览器交互限制在完成采集所需的最小范围，并在出现风险信号时立即停止。

## 支持平台

| 平台 | 账号数据 | 内容数据 | 看板兼容 |
|---|---|---|---|
| 微信公众号 | 用户增长 | 内容趋势 | 支持 |
| 小红书 | 曝光、观看趋势 | 笔记累计快照 | 仅账号趋势；内容保留在通用报告 |
| 知乎 | 作品日报 | 日报作品指标 | 支持 |
| 今日头条头条号 | 作品趋势、粉丝趋势 | 作品指标 | 支持 |
| 微博 | 粉丝、阅读、互动趋势 | 基础版可见博文 | 独立工作簿，不进入 SQLite |

默认范围是 `Asia/Shanghai` 时区内截至昨天的 30 个完整自然日。用户可以明确指定其他范围。

## 安全边界

- 登录、扫码、短信、OTP、验证码和设备确认始终由用户完成。
- 不读取或保存 Cookie、Token、认证头、密码、手机号、浏览器 Storage 或认证文件。
- 不调用隐藏接口、不重放 XHR、不构造分页 URL，也不使用代理、指纹伪装或自动化绕过。
- 不执行发布、删除、关注、点赞、评论、私信、设置修改、购买或试用操作。
- 同一时间只操作一个平台、一个账号和一个标签页。
- 遇到 CAPTCHA、滑块、异常登录、访问频繁、403/429、重新认证或非预期跨域跳转时立即停止，不刷新、不重试。

完整规则见 [SKILL.md](SKILL.md)。

## 安装

需要支持 Skill 和内置浏览器控制的 Codex 环境。

```bash
git clone https://github.com/BruceL017/social-media-login-collector.git \
  ~/.codex/skills/social-media-login-collector
```

重新启动 Codex 或刷新 Skill 列表后即可使用。通用 Excel 导出需要 Codex bundled Python 提供的 `openpyxl`。看板兼容导出还需要目标项目已有的 `xlsx` 和 `tsx`。

## 使用

可以在 Codex 中直接提出明确采集请求：

```text
采集微信公众号最近 30 天的后台数据
采集小红书账号数据和笔记数据
采集全部五个平台的数据
```

典型流程：

1. Skill 打开或复用平台官方后台页面。
2. 未登录时由用户完成登录，并明确回复“已登录”。
3. Skill 确认账号和日期范围，每个所需数据模块优先使用且最多执行一次平台原生导出。
4. 原生导出不可用时，才使用平台 reference 定义的最小可见数据回退。
5. 生成标准 manifest，并执行日期覆盖、来源、汇总和内容唯一性校验。
6. 输出通用报告；符合条件时再生成看板兼容文件。
7. 看板文件通过目标解析器验证后仍需用户明确确认，才允许导入 SQLite。

## 输出

通用模式默认输出到：

```text
<cwd>/output/social-collections/<run-id>/<platform>/
```

每个平台包含：

```text
collection.json
account-daily.csv
contents.csv
collection.xlsx
collection-report.json
```

`collection-report.json` 记录覆盖情况、行数、派生指标、限制和文件 SHA-256。所有 CSV/XLSX 文本都会处理公式注入风险。

看板模式输出到独立批次目录：

```text
<dashboard-root>/data/imports/<run-id>/
```

生成器只接受通用导出器产生且哈希匹配的 `collection.json`。提交前，可导入看板的根目录文件会调用目标项目的 `parseSocialFile()` 做逐日往返校验；微博独立工作簿使用内置校验。生成器不会自动执行数据库导入。

## 数据完整性

只有满足以下条件才会标记为 `success`：

- 声明范围内每天恰好一行；
- 平台必采指标每天非空；
- 每个指标具有可追溯来源和汇总对账；
- 内容列表具有末页或空列表证据，并完成去重；
- 未使用无法证明精度的图形几何估算。

无法证明完整性时使用 `partial`；没有可用数据时使用 `failed`。未知值不会被改写为 `0`。

## 本地验证

所有测试均使用系统临时目录中的合成数据，不访问真实账号：

```bash
<bundled-python> scripts/self_test.py
<bundled-python> scripts/self_test.py --dashboard-root /path/to/social-media-analytics-app
node --check scripts/build_dashboard_exports.mjs
```

使用 Codex workspace dependency loader 获取 `<bundled-python>`；该运行时必须提供 `openpyxl`。

当前离线测试覆盖五个平台通用导出、24 个恶意或不完整输入，以及四个平台 6 类看板解析器往返校验。

## 目录结构

```text
.
├── README.md
├── README_EN.md
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── export_collection.py
│   ├── build_dashboard_exports.mjs
│   └── self_test.py
└── references/
    ├── manifest-schema.md
    ├── dashboard-adapter.md
    ├── wechat.md
    ├── xiaohongshu.md
    ├── zhihu.md
    ├── toutiao.md
    └── weibo.md
```

## 已知限制

- 平台页面和原生导出格式可能变化，真实采集前仍需验证当前页面结构。
- 当前看板解析器无法正确保留小红书内容快照日期和发布时间分钟，因此小红书内容兼容文件保持禁用；通用报告仍保留完整内容。
- 微博没有当前看板 SQLite 模型，只生成独立工作簿。
- 本项目不包含真实账号数据、Cookie、Token 或平台原始私有导出。

本项目不是上述平台的官方工具。使用者应遵守平台条款、账号权限和适用的数据保护要求。
