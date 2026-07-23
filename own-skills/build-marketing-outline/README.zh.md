---
description: "把产品 URL 或源码项目转化为证据绑定的 TranFu 正式发布策略与六渠道编辑大纲。"
prompt_examples:
  - prompt: "使用 $build-marketing-outline 分析 https://example.com，生成正式发布营销大纲执行包。"
    scene: 分析已上线产品
  - prompt: "使用 $build-marketing-outline 分析 /absolute/project/path，并识别发布阻塞项。"
    scene: 分析未发布项目
  - prompt: "同时分析这个产品 URL 和 /absolute/project/path，对照运行态与源码证据。"
    scene: 合并运行态与源码
---

# TranFu 产品营销大纲 Skill

[English](./README.md)

`build-marketing-outline` 是一个 TranFu 专用 Codex Skill。它读取产品 URL、未发布产品的项目目录，或同时读取两者，把产品证据转化为正式发布营销策略和六渠道编辑级内容大纲。

它只生成策略与大纲，不生成完整正文、配图、平台草稿，也不执行发布动作。

> 当前版本内置 `tranfu.com` 与「Agent 公司养成记」叙事，默认使用中文、Asia/Shanghai 时区和六个中国内容渠道，并把执行包写入 `~/Documents/product-marketing`。它不是通用营销 Skill。

## 核心能力

- 支持公开产品 URL、绝对项目目录、当前项目目录，以及 URL 与源码合并分析。
- 区分页面证据、现有结果、端到端实测、源码实现、推断、假设和冲突。
- 即使产品尚未上线，也按正式发布目标生成策略，同时明确发布阻塞项。
- 固定输出小红书、微信公众号、知乎、头条号、微博和官网六渠道大纲。
- 生成可交给后续内容生产流程的九段式通用母大纲。
- 保持产品只读，不自动安装依赖、修改源码或触发产品侧写操作。

## 安装

公司 Skill 库安装（推荐）：

```bash
tfs install build-marketing-outline --scope user
```

从独立 GitHub 仓库安装：

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/BruceL017/build-marketing-outline.git \
  ~/.codex/skills/build-marketing-outline
```

更新：

```bash
git -C ~/.codex/skills/build-marketing-outline pull
```

安装后重新打开 Codex 任务，或让 Codex 重新发现可用 Skills。

## 运行要求

- 支持 Skills 的 Codex 环境。
- URL 模式需要网络访问；有浏览器能力时可检查运行态，没有浏览器时会降级为 HTML 证据并降低发布判定。
- 项目模式需要源码读取权限；Git 用于比较前后状态，本地运行只使用已经安装的依赖和文档明确的命令。
- 只应对可信项目启用本地运行态检查。该检查可能执行项目自身的开发命令，不构成独立代码沙箱。

## 使用方式

分析产品 URL：

```text
$build-marketing-outline https://example.com
```

分析未发布产品项目：

```text
$build-marketing-outline /absolute/project/path
```

在产品项目根目录直接调用：

```text
$build-marketing-outline
```

合并运行态与源码证据：

```text
$build-marketing-outline https://example.com /absolute/project/path
```

也可以在请求中显式指定输出根目录。输出位置必须在被分析的产品项目之外。

只提供不含凭证的公开 URL。包含 userinfo、token、API key、签名、授权值或登录 code 的 URL 会被拒绝，不会被访问或写入产物。

## 输出内容

每次运行都会新建一个带时间戳的目录：

```text
{产品名}_营销内容大纲执行包_{YYYYMMDD-HHmm}/
```

正常运行固定包含六份文档：

1. `00_执行摘要与发布判定.md`
2. `01_产品证据与用户路径.md`
3. `02_营销策略与内容矩阵.md`
4. `03_六渠道编辑大纲.md`
5. `04_通用母大纲.md`
6. `05_素材清单与发布门禁.md`

只有输入完全不可访问或没有任何可识别产品证据时，才只输出诊断文档。

## 证据等级

| 等级 | 含义 |
|---|---|
| `E0-P` | 当前页面可见或明确陈述的内容 |
| `E0-R` | 已存在的结果、样例或制品 |
| `E0-T` | 本次运行中完成了从输入到产品结果的完整路径 |
| `E0-S` | 源码、路由、测试或结构直接实现的能力 |
| `E1` | 多个直接信号支持的强推断 |
| `E2` | 待验证的受众、需求、收益或定位假设 |
| `E3` | 无证据、冲突或无法核验的主张 |

HTTP 200、页面加载、渲染页面壳或仅完成导航只能算 `E0-P`，不能算 `E0-T`。`E0-S` 只能证明项目实现了某项能力，不能单独证明用户当前可用。

## 只读与安全边界

运行期间不会自动执行以下操作：

- 安装或升级依赖。
- 修改产品文件、配置或数据库。
- 提交表单、上传文件、保存设置或清空数据。
- 调用 AI 生成、批改、支付、邮件、消息或发布接口。
- 登录用户或管理员账号。
- 读取 `.env*`、密钥、真实用户数据、数据库内容或生产日志。
- 进行站外竞品、关键词、趋势、价格或市场规模研究。

项目模式会在运行前后比较完整 Git 状态，并在检查结束后关闭本地服务。

生成文档会保留无凭证的输入 URL 和本地绝对证据路径。对外分享执行包前，应检查并脱敏本地用户名、目录结构和其他内部路径。

## 发布判定

Skill 使用以下四种判定：

- `可进入发布制作`
- `待补证据或产品条件`
- `仅内部使用`
- `无法形成可信大纲`

前三种判定始终保留正式发布营销目标，不会自动改写成预热内容或开发日志。

## 仓库结构

```text
.
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── evidence-and-readiness.md
│   ├── output-contract.md
│   └── tranfu-marketing-framework.md
├── README.md
└── README.zh.md
```

## 验证状态

- 核心 Skill 内容已在独立源仓库通过 Codex `quick_validate.py`；本目录使用公司 catalog frontmatter，并通过 `tranfu-skills` 校验器检查。
- 已完成隔离的 URL 模式与项目目录模式前向测试。
- 已验证六文档契约、六渠道大纲、证据编号、TranFu 回流和发布门禁。
- 已验证项目测试不会修改产品仓库或遗留本地服务。

## 许可证

许可证以承载本 Skill 的仓库根目录 `LICENSE` 为准；若仓库未提供 `LICENSE`，公开可见不自动授予复制、修改或分发权利。
