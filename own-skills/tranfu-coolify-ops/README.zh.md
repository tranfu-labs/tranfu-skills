---
description: "在公司 Coolify 上部署、更新或排查 tranfu-labs 应用，直到公网地址可以正常访问。"
prompt_examples:
  - prompt: 帮忙确认并部署 https://github.com/tranfu-labs/markdown-kits-app
    scene: 首次部署项目
  - prompt: markdown-kits-app 重新部署一下。
    scene: 发布新版本
  - prompt: markdown-kits-app 改域名到 board.tranfu.com。
    scene: 修改访问域名
---

# Tranfu Coolify 部署

把 `tranfu-labs/<x>-app` 端到端部署 / 改配置 / 排障到公司 Coolify——一份流程自动识别做什么, 全程自主到公网可访问才收尾, 不依赖你的当前目录。

## 什么时候用它

**首次部署项目**:

我拿到一个 `tranfu-labs/<x>-app` 仓库, 想让它一口气跑完 clone、补齐 Docker 四件套 (Dockerfile / .dockerignore / compose.yml / deploy.yml)、建 Coolify 项目和 Application、配 GitHub secrets 与 env、推 commit, 一路盯到公网 2xx 才收尾。

**发布新版本**:

我改了个 env 或者只想验证一次滚动更新, 直接说「重新部署 / redeploy / 重启」, 它只调一次 Coolify deploy API, 不主动核对源码, 不多改一个字。

**改域名 / 改 env**:

我要把域名切到 `board.tranfu.com`, 或者补一条 `DATABASE_URL`, 它直接调 Coolify HTTP API 改, env 改完自动重新部署, 全程只显示 key 与哈希, 不 echo 敏感值。

**部署代码更新**:

我要动 `compose.yml` 或 `Dockerfile`——它自己 `mktemp -d` 临时目录 clone、派子 agent 按 `references/file-generation-rules.md` 改、自动 `git add / commit / git push -u`, 不用我先 `cd` 到仓库, 也不污染我的工作目录。

**排查部署问题**:

我说「部署挂了 / Coolify 访问不了」, 它不默认重新部署, 先反问要走 (a) 拉一份 GHA + Coolify status 诊断 (b) 直接重新部署试一次 (c) 改某个具体配置, 三选一。

**不接**:

非 `tranfu-labs` 仓库 / 非公司 Coolify 实例 → 硬编码假设外, 直接终止; Coolify UI 上的手动操作 (装 GitHub App integration、挂 GHCR credential) → 那是 ops 一次性配置, 本 skill 只走 API; 与部署无关的普通功能开发 → 走 **openspec-driven-development**。

## 它会产出什么 / 你会看到什么

**给完初始指令后它一路跑到公网 2xx 才停, 中途 GET 只是为了事后告知改动, 不是等你确认**——最反常识的一点, 不要期待每步都能拦住。

- **API 调用**: 走 Coolify HTTP API (`/api/v1/projects` / `/api/v1/applications` / `/api/v1/deploy`) 建资源、改配置、触发部署; 已存在的 Application 走更新分支, 乐观假设已经部署好, 只做用户指派的一个最小动作
- **git 动作**: 临时目录 clone `tranfu-labs/<x>-app`, 派子 agent 按 `references/file-generation-rules.md` 改文件, 自动 `git add / commit / git push -u`, 推完告知 commit sha + 改动摘要 + GitHub 链接
- **GitHub 端配置**: `gh secret set` 写 `COOLIFY_API_TOKEN` / `COOLIFY_BASE_URL`, `gh api PUT` 自动建 environment (不让你去 settings 手工点), `gh variable set` 写 `COOLIFY_APP_UUID`
- **收尾三关**: 等 GHA 通过且无「缺变量」类静默失败、30 秒内看到 Coolify 进入 `deploying`、5 分钟内轮询公网域名返回 2xx / 3xx; 5 分钟硬上限, 到点就交出排障入口
- **敏感值纪律**: 全程只引用 `$COOLIFY_API_TOKEN` 变量名; 你的 `.env` 内容、Coolify 返回的 env value、你贴进对话的 secret 都不 echo, 也不硬编码进脚本
- **绝不会做**: 挂 GHCR credential、装 Coolify GitHub App integration、DELETE Application、清 volume、碰旧 `/services` namespace、在你当前目录直接 clone、意图模糊时默认重新部署、无限轮询

## 前置条件 / 边界

**前置**:

Coolify 实例已一次性挂好 GitHub App integration (organization = `tranfu-labs`), 由 ops 配好后所有 tranfu-labs 项目复用同一份; 本地有 `gh` / `jq` / `curl`; 环境变量 `COOLIFY_API_TOKEN` 与 `COOLIFY_BASE_URL` 已注入 (末尾斜杠会自动 strip)。

**硬范围**:

只接 `tranfu-labs/<x>-app` 仓库、单一公司 Coolify 实例、单 server 调度; `REPO_NAME == PROJECT_NAME == APP_NAME` 是命名硬约束, 不让你从列表挑名字, 也不建其他名字的项目。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 通用项目 Docker / CI 冷启动 (非 Coolify) | **coolify-deploy** |
| 打 tag / 写 changelog / 定版本号 | **release** |
| 有风险的 DELETE / 清 volume / 删重复项 | **reversible-ops** |
| 与部署无关的普通功能开发 | **openspec-driven-development** |

**不接的场景**:

- 非 `tranfu-labs` 仓库、非公司 Coolify 实例、多 server 调度
- Coolify UI 上的手动点击 (装 GitHub App integration、挂 GHCR credential、UI 上删资源)
- 意图模糊时默认重新部署——必先反问三选一
- 已存在 Application 时主动核对源码或多改一个字——更新分支乐观假设已部署好

**微妙边界**:

- 已存在 0.8 形态 Application (Application + `private-github-app` + `dockercompose`) → 走更新分支, 按用户意图挑最小动作
- 已存在的是 0.7 旧 Service 残留 → 终止并请你手动 DELETE 旧 service 后重跑, 本 skill 不旁路创建
- 只有 Coolify UI URL → 做只读归一化反推 `git_repository`, 再重新套 `tranfu-labs/<x>-app` 硬范围校验, 旧形态 Application 不接管
- 会话里出现「停止部署 / stop / cancel / 暂停」→ 立即硬取消, 不再 push、不再 PATCH、不再触发部署, 明确报告已发生与未发生的边界
