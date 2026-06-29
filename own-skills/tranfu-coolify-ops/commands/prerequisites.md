# Step 0：preflight 索引（人话说明）

reconcile flow 的 Step 0 只做一件事：跑 [`../assets/preflight.sh`](../assets/preflight.sh)。本文档是脚本的「人话伴侣」——脚本里每条 check 的语义、失败的修复路径、为什么这样设计。脚本本身是 single source of truth，本文档落后于脚本时**以脚本为准**。

## 工作单元契约

- **输入**：当前 shell 环境（`$COOLIFY_API_TOKEN` + `gh` token）+ 当前 git 仓库 + 当前 cwd
- **输出**：退出码 0 / 1 / 2 + stdout 上的逐条 ✓ / ✗ / ⚠ + 5 个公共变量（agent 解析输出拿）：

  ```
  $BASE        = http://120.77.223.183:8000
  $SERVER_UUID = oz7r53ilv7aeaubx7ewuqw0m
  $REPO_ORG    = tranfu-labs
  $REPO_NAME   = <user-repo>
  $SVC_NAME    = $REPO_NAME
  ```

- **完成判据**：脚本退出码 0
- **Ownership**：read-only。脚本任一硬 check 失败 → 输出原文 + 退出码 1。**MUST NEVER**：自动装工具、自动建 repo、自动跳过断言

## 怎么跑

```bash
# 在目标项目根目录跑
bash <SKILL_ROOT>/assets/preflight.sh

# 或显式指定 base url
bash <SKILL_ROOT>/assets/preflight.sh http://120.77.223.183:8000
```

`<SKILL_ROOT>` = 本 skill 安装路径，通常是 `~/.claude/skills/own-skills/tranfu-coolify-ops/` 或 worktree 里的 `.claude/worktrees/.../own-skills/tranfu-coolify-ops/`。

## 退出码

| 退出码 | 含义 | 下一步 |
|---|---|---|
| `0` | 全 ✓ | 进 reconcile Step 2 |
| `1` | 任一硬 check ✗ | 终止，按脚本输出的 `✗ <reason>` 修完再跑 |
| `2` | 仅 ⚠（如 GHCR credential 未 ack）| 去 Coolify UI 配 ghcr.io credential，回来 ack 重跑 |

## check 清单 + 失败修复路径

按脚本输出顺序：

### ▸ 工具

| ✗ 原因 | 修 |
|---|---|
| `gh / jq / curl / git / base64` 任一缺 | `brew install <tool>` (macOS) 或对应平台包管理器 |

### ▸ Git 仓库状态

| ✗ 原因 | 修 |
|---|---|
| 当前 cwd 不在 git 仓库 | `cd` 到项目根目录 |
| 无 origin remote | `git remote add origin <url>` |
| `org ≠ tranfu-labs` | **不修**——本 skill 只服务 tranfu-labs 仓库；如确需扩展先讨论再改 skill |
| 命名不合规（不是 烤肉串-app 全小写）| 改 repo 名（GitHub UI → Settings → General → rename），同步本地 `git remote set-url origin ...` |
| working tree dirty | `git stash` 或 `git commit` 当前改动 |

### ▸ GitHub 凭据

| ✗ 原因 | 修 |
|---|---|
| `gh` 未 auth | `gh auth login` |
| token scope 缺 `'repo'` | `gh auth refresh -s repo` |
| 用户对 repo 无 admin permission | 让 repo owner 把你加为 admin collaborator（Settings → Collaborators） |
| repo 不存在 / 网络问题 | 检查 origin URL 拼写 / VPN |

### ▸ Coolify 凭据

| ✗ 原因 | 修 |
|---|---|
| `$COOLIFY_API_TOKEN` 未设置 | 去 Coolify UI → Keys & Tokens → 生成 Read & Write 权限 token，`export COOLIFY_API_TOKEN=<token>` |
| 拨 `/api/v1/version` → 401/403 | token 错或过期，重新生成 |
| 拨 `/api/v1/version` → 000（拨不通）| 检查公司内网 / VPN |
| PATCH dummy uuid → 401/403 | token 只读，回 Coolify 重新生成一个含 Write 权限的 |

### ▸ Coolify · GHCR Registry Credential

| ⚠ 原因 | 修 |
|---|---|
| 未 ack | Coolify UI → Sources / Container Registries → Add Registry：URL `ghcr.io` / Username = GitHub 用户名 / Password = 一个 scope 含 `read:packages` 的 GitHub PAT。挂上后回来重跑 preflight，ack 通过 |
| 非交互环境自动 ⚠ | 设环境变量 / 用 manual flag，或直接在 interactive shell 重跑 |

## 安全纪律

preflight.sh 设计上**永不打印 `$COOLIFY_API_TOKEN` 任何字节**：
- 长度 / 前缀 / 哈希都不打
- 失败原因只描述"哪一层挂了"，不暴露 token
- token 仅用 `-H "Authorization: Bearer $COOLIFY_API_TOKEN"` 形式传给 curl，shell 展开发生在执行时

agent 解析脚本输出时**也不要在对话里 echo token 任何字节**。

## 公司常量来源

`$BASE` / `$SERVER_UUID` 硬编码在 preflight.sh 顶部和 [reconcile-deployment.md](../scenarios/reconcile-deployment.md)。如果公司换 Coolify 实例 / 换 server：

1. 改 `assets/preflight.sh` 顶部默认 BASE
2. 改 `scenarios/reconcile-deployment.md` 里所有 BASE / SERVER_UUID 引用
3. 在 PR 描述里标 "更新公司 Coolify 实例 / server"

不要靠环境变量改 BASE——硬编码是 single source of truth，让 git history 能 audit 实例迁移历史。

## 不在 preflight 里做的事

明确**不做**（避免越界）：

- ✗ 探测 project_uuid（留给 reconcile Step 3，要么从已有 service 反查，要么让用户从 GET /api/v1/projects 选）
- ✗ 自动建 Coolify project / 挂 registry credential / 建 GitHub environment（人工 UI）
- ✗ 修任何文件（reconcile Step 2 才碰）
- ✗ 验证 `is_static` / `is_spa` / build 命令等**项目类型**信息（reconcile Step 2 + file-generation-rules.md 才碰）

## 输出（传给 reconcile flow）

preflight 退出码 0 → 进 reconcile Step 2，公共变量已就位。
