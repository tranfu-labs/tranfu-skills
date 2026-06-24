# 共用前置

任一场景脚本的 Step 0 都是跑这一份。目的：在做任何写操作之前，先确认"在哪个实例上"和
"server 唯一性"，把后续命令需要的 `${server-uuid}` 准备好。

## 工作单元契约

- **输入**：当前会话上下文中可选的触发语覆盖项 `<other-context>`（用户在触发语里明说「用 `<other-context>` 部署 xxx」时出现，否则为空）。
- **输出**（命名产物）：
  - `${context}`：目标 Coolify context 名。
  - `${server-uuid}`：唯一一台 server 的 UUID。
- **完成判据**（可观测）：上述两个变量均为非空字符串，且 `coolify server list --context="${context}" --format json | jq 'length'` 返回 `1`。
- **Ownership**：本前置脚本只跑只读 CLI（`coolify context list` / `coolify server list`），MUST NEVER 调用任何写操作命令（add / create / deploy / restart 等），MUST NEVER 编辑用户文件。失败时只按下方"返回文案"原文回话，不替用户做任何修复。

## 执行流程

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 跑 Step A 锁定 `${context}`。若拿不到 → 按对应返回文案输出并退出。      # 卫语句·用前必校
2. 跑 Step B 锁定 `${server-uuid}`。若 server 数 ≠ 1 → 按对应返回文案输出并退出。  # 卫语句·失败有出口
3. 产出 `${context}` 与 `${server-uuid}`，交给后续场景脚本，结束。          # 显式终止

失败出口：Step A / Step B 任一返回文案触发即终止整条前置流程，MUST NEVER 继续往下跑 Step B 或交付变量。

## Step A：确认当前在哪个 Coolify 实例

```bash
coolify context list --format json
```

**MUST 直接读 default / active 的那一项，记为 `${context}`，MUST NEVER 向用户确认。** 后续所有命令都显式带
`--context="${context}"`（见 SKILL.md「全局守则」）。

```bash
CONTEXT=$(coolify context list --format json | jq -r '
  ( .[] | select(.is_default == true or .active == true or .default == true) | .name )
  // (.[0].name)
')
[ -n "$CONTEXT" ] && [ "$CONTEXT" != "null" ] || { echo "STOP: 拿不到 default context"; exit 1; }
```

为什么不问用户：tranfu 团队日常都用同一个 default context，每次反问都是噪音。需要换实例的入口
**由用户主动声明**——用户在触发语里明说「用 `<other-context>` 部署 xxx」，agent 解析出来覆盖
`${context}` 即可，MUST NEVER 主动征求确认。

只在下面两种情况停下来：

- `coolify context list` 返回空或报错 → context 未配置 / CLI 未装。MUST 按下面文案原文返回并退出：

  > 没有可用 context。先按 https://github.com/coollabsio/coolify-cli 安装 CLI，再用
  > `coolify context add <name> <url> <token>` 添加一个，然后回头再跑这个流程。

- `context list` 有多项但**没有任何一项是 default / active**（用户从来没 `coolify context use` 过）→
  无法静默决定，MUST 按下面文案原文返回并退出：

  > 你机器上有多个 Coolify context 但没有标记 default 的。先用
  > `coolify context use <name>` 选定一个作为 default，再跑这个流程；
  > 或者直接在触发语里说「用 `<name>` context 部署 xxx」让我临时覆盖。

## Step B：断言 server 数量恰好为 1

本 skill 当前默认 tranfu 团队只用一台 server。一旦多 server 出现，说明组织结构变了，MUST 让用户
明确指定走哪台，MUST NEVER 让 skill 默默选第一个。

```bash
coolify server list --context="${context}" --format json
```

按返回数组长度分支（穷尽，三选一）：

```bash
SERVER_COUNT=$(coolify server list --context="${context}" --format json | jq 'length')
```

- `SERVER_COUNT == 1`：
  - 拿 server uuid：`SERVER_UUID=$(coolify server list --context="${context}" --format json | jq -r '.[0].uuid')`
  - 拿到 `${server-uuid}`，传给后续场景脚本使用。
- `SERVER_COUNT == 0`：终止。MUST 按下面文案原文返回并退出：
  > 当前 context (`${context}`) 上没有任何 server。先用
  > `coolify server add --context="${context}" <name> <ip> <private-key-uuid>` 加一台，
  > `coolify server validate --context="${context}" <uuid>` 验证通过后再跑这个流程。
- `SERVER_COUNT > 1`：终止。MUST 按下面文案原文返回并退出：
  > 当前 context (`${context}`) 上有 `${SERVER_COUNT}` 台 server，本 skill 默认 tranfu 团队只用单 server。
  > 列出来让我决定：
  > （列出 `coolify server list --context="${context}"` 的 name + uuid + ip）
  > 如果确实需要在多 server 环境上跑，告诉我目标 server-uuid，再跑这个流程；
  > 同时考虑扩展本 skill 让它支持多 server。
- 其它（jq 解析失败 / 命令报错 / SERVER_COUNT 非数字）：终止。返回文案：
  > 拿不到 `${context}` 上的 server 列表（命令报错或解析失败）。检查 `coolify server list --context="${context}" --format json` 输出，修好再跑这个流程。

## 输出

跑完 Step A + Step B，对场景脚本提供：

- `${context}`：用户已确认的目标 context 名。**场景脚本里的每条 CLI 命令都 MUST 显式带
  `--context="${context}"`**（见 SKILL.md「全局守则」），MUST NEVER 依赖 default。
- `${server-uuid}`：唯一一台 server 的 UUID。

产出上述两个变量后，本前置流程结束。

## 失败语义

任一步失败一律按上面对应的"返回文案"原文返回给用户。**MUST NEVER 替用户自动建 server、
MUST NEVER 替用户跳过断言、MUST NEVER 在 context 既没 default 又没用户声明时硬挑一个**。
Step A 允许"直接采用 default context 而不问用户"——这是 reduce friction，不是跳过断言；
真正的写操作仍由后续场景脚本里的命名 / 同名 / GH App / 仓库可见性等断言保护。
