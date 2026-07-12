---
prompt_examples:
  - prompt: 把这个项目推到 GitHub 主分支。
    scene: 常规交付
  - prompt: 这个产品首次提交, 帮我建仓库、补 README、推主分支。
    scene: 新建仓库
  - prompt: 已有仓库, 帮我补 README 部署说明、本地验证后推送。
    scene: 更新仓库
  - prompt: 帮我检查这个项目能不能安装、构建、启动和验证。
    scene: 交付前自检
  - prompt: 帮我整理成技术能直接部署的项目, 部署配置写清。
    scene: 交付给技术
---

[English](./README.md) | [中文](./README.zh.md)

# GitHub 交付检查

把产品项目整理成可部署、可交接、可追踪的 GitHub 交付状态——自动判断项目类型, 补齐 README 部署说明, 本地验证通过后默认直推主分支。

## 什么时候用它

**常规交付**:

产品代码基本完成, 我想让 skill 直接把它推到 GitHub 主分支, 而不是先开 PR 再合并。

**新建仓库**:

这个产品第一次进 GitHub, 我要它建仓库、按 tranfu 命名规范起名 (小写 + 连字符 + `-app`)、生成生产链接、补 README 再推主分支。

**更新仓库**:

已有 GitHub remote, 我只想让它对齐 README 部署说明、跑本地验证, 然后把最新改动推到主分支。

**交付前自检**:

我要它跑真实命令验证项目能装、能建、能启、能跑 (Node 装依赖跑 build/test, Web 起 server 打 HTTP, Docker 起 compose), 不做纯静态扫描。

**交付给技术**:

技术同学要拿这个项目部署, 我要它输出 GitHub 交付卡, 把环境变量字段名和目标位置列清楚, 真实值走私密渠道。

**不接**: 普通改代码 → 走常规编码流程; 代码审查 → 走 `review`; 生产部署 (不涉及 GitHub 交付) → 走 `deploy`; 打 tag / 发版号 → 走 `release`; 明说「先讨论 / 别推」时它只报告, 不动 Git。

## 它会产出什么

**默认直推主分支, 不默认开 PR**, 这是最反常识的一点——只有分支保护、权限阻塞、仓库不是团队直接维护, 或用户主动要求时才走 PR。

- **项目类型判断**: 前端 / 后端 / 全栈 / Docker / 静态站 / 服务端部署, 先看文件再问用户, 不倒过来。
- **首次提交产品元数据**: 中文名、英文名、简介、仓库名 (小写连字符 + `-app`)、生产链接 (`https://{repo}.tranfu.com/`)、GitHub owner——齐了才推。
- **密钥前置扫描**: 跟踪文件、暂存区、隐藏文件 (排除 `.git` / 依赖目录 / build 输出) 全过一遍; 已进 Git 历史的密钥直接判 `暂不建议推送`。
- **README 部署说明门禁**: 装依赖、跑本地、build、环境变量、端口、部署、生产链接、健康检查任一缺失都补齐再推。
- **本地真实验证**: Node 跑 build/test/lint, Web 打 HTTP 200, API 打健康端点, Docker 跑 build/compose——失败就修再跑, 不能跑就判 `未推送: 需先修复`。
- **GitHub 交付卡**: 结论只有 `已推送完成` / `未推送: 待 GitHub 授权` / `未推送: 需先修复` / `暂不建议推送` 四种; 卡里列环境变量字段名 + 目标位置, 真实值说「私下提供」。
- **绝不会做**: 说「推 GitHub 就等于生产上线」; 编授权码 / 仓库 URL / 生产 URL; 提交 `.env` / 私钥 / 数据库 / 依赖目录 / build 缓存; 未经许可开 PR 代替直推。

## 前置条件 / 边界

**前置**:

目标目录可读, `git` 可用; 推 GitHub 需要 `gh` CLI 或等价的 GitHub 工具已授权 (`gh auth status`); 需要本地验证时, 对应 runtime (Node / Docker / Python 等) 本地可用。

**同类 skill 分工**:

| 场景 | 走 |
|---|---|
| 把当前改动发 PR 走审查 | `github:yeet` |
| 完整发版 + changelog + 版本号 | `ship` / `release` |
| 冷启动搭 `AGENTS.md` + `openspec/` | `project-init-docs` |

**微妙边界**:

- 真实密钥可以放在本地未提交的 `.env` 或服务器环境变量; 不能进 GitHub、README、`.env.example`、截图、最终回复。
- GitHub 未授权时, 它会把 `gh auth login --web` 印出的真实链接和一次性授权码交给用户, 绝不自己编。
- 仓库存在性冲突 (`owner/repo` 已存在但可能是别的项目) → 停在 `未推送: 需先修复`, 让用户确认再推。
- 「推 GitHub 主分支」触发本 skill;「合到主分支上线」不触发 (那是 `deploy`); 代码落地前的风险审查不触发 (那是 `review`)。
