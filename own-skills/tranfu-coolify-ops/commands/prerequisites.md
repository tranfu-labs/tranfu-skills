# Step 0：环境前置（reconcile flow 启动前）

reconcile flow 启动前的最少环境断言。**只读**，不动 Coolify 和不写仓库。任一失败 → 终止 + 给用户人话提示，不进 reconcile Step 1。

## 工作单元契约

- **输入**：当前 shell 环境 + 当前 git 仓库
- **输出**（命名产物，传给 reconcile flow）：
  - `${repo-org}` / `${repo-name}`：解析 git remote 拿
  - `${svc-name}`：用 tranfu 命名约束推导（通常 = `${repo-name}`）
  - 公司常量直接硬编码：`$BASE = http://120.77.223.183:8000`，`$SERVER_UUID = oz7r53ilv7aeaubx7ewuqw0m`
- **完成判据**（可观测）：下面 5 个 check 全过
- **Ownership**：read-only。任一 check 失败 → 输出原文 + 退出码 1。**MUST NEVER**：自动装工具、自动建 repo、自动跳过断言

## 5 个 check

跑 TODO list：

1. **`gh` CLI 已装 + 已认证**（Step 7 要 `gh secret set` / `gh variable set`）
2. **`jq` 已装**（curl 输出全程靠它）
3. **`curl` 已装**（应该都有，alpine docker 内可能没）
4. **当前在 git 仓库根**（agent 要改 Dockerfile / compose / deploy.yml）
5. **`$COOLIFY_API_TOKEN` 已设置**（暂不验活，验活留给 Step 1）

每条对应命令：

### Check 1: `gh` CLI

```bash
command -v gh >/dev/null 2>&1 || {
  echo "✗ gh CLI 未安装。装：brew install gh，或 https://cli.github.com"
  exit 1
}
gh auth status >/dev/null 2>&1 || {
  echo "✗ gh CLI 未认证。跑：gh auth login"
  exit 1
}
```

### Check 2 + 3: jq / curl

```bash
command -v jq >/dev/null 2>&1 || {
  echo "✗ jq 未安装。装：brew install jq"
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "✗ curl 未安装（少见）"
  exit 1
}
```

### Check 4: git 仓库 + 解析 org/name

```bash
git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "✗ 当前目录不是 git 仓库。在仓库根目录跑这个 skill"
  exit 1
}

# 解析 remote origin URL（支持 https / ssh / 带 .git 后缀）
ORIGIN=$(git remote get-url origin 2>/dev/null) || {
  echo "✗ 当前仓库没有 origin remote。先 git remote add origin <url>"
  exit 1
}

# 沿用 tranfu-naming.md 规则
REPO_PATH=$(echo "$ORIGIN" | sed -E 's#(.*github\.com[:/])([^/]+)/([^/]+?)(\.git)?/?$#\2/\3#')
REPO_ORG=$(echo "$REPO_PATH" | cut -d/ -f1)
REPO_NAME=$(echo "$REPO_PATH" | cut -d/ -f2)
```

### Check 5: token 存在

```bash
[ -n "${COOLIFY_API_TOKEN:-}" ] || {
  echo "✗ COOLIFY_API_TOKEN 未设置。在 shell 里 export COOLIFY_API_TOKEN=<token> 后重试"
  exit 1
}
```

**注意纪律**：不打印 token 任何字节（长度 / 前缀都不打）。`$COOLIFY_API_TOKEN` 只在 shell 内展开，永不在 agent 给 Bash tool 的命令字符串里以原文出现。

## 命名约束断言（沿用 [tranfu-naming.md](tranfu-naming.md)）

Check 4 拿到 `REPO_ORG` / `REPO_NAME` 后断言：

- `REPO_ORG == "tranfu-labs"`（除非用户在触发语里明说覆盖）
- `REPO_NAME` 烤肉串 + 全小写 + 以 `-app` 结尾
- 不含大写 / 空格 / 下划线 / 中文

不合规 → 终止：

```
✗ 仓库命名不合规
  origin:  $ORIGIN
  org:     $REPO_ORG  (期望 tranfu-labs)
  name:    $REPO_NAME (期望 烤肉串-app 形式，全小写)
本 skill 只服务 tranfu-labs/* 的 -app 仓库。
如确需在其它仓库跑，先讨论是否扩展本 skill，再回头来跑。
```

## 公司常量（写死，不动）

```bash
BASE="http://120.77.223.183:8000"
SERVER_UUID="oz7r53ilv7aeaubx7ewuqw0m"   # 公司唯一 server，4.1.2 实例上 GET /api/v1/servers 拿到
```

reconcile flow 任一 Step 用这两个常量直接引用，不重新探测。如果某天换 server / 换实例，**改本文件**（这是 single source of truth）。

## 不在这里做的事（避免越界）

- ✗ 验活 token（留给 reconcile Step 1）
- ✗ 探测 project_uuid（留给 reconcile Step 3，要么从 service 反查，要么让用户选）
- ✗ 自动建 project（人工 UI）
- ✗ 自动挂 GHCR registry credential（人工 UI）
- ✗ 修任何文件（reconcile Step 2 才碰）

## 输出（传给 reconcile flow）

```
${BASE}        = http://120.77.223.183:8000
${SERVER_UUID} = oz7r53ilv7aeaubx7ewuqw0m
${REPO_ORG}    = tranfu-labs
${REPO_NAME}   = <user-repo>
${SVC_NAME}    = ${REPO_NAME}   # 1:1 映射，命名规则保证 OK
```

5 个 check 全过 → 进入 reconcile flow Step 1。
