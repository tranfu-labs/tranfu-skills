# 共用前置

任一场景脚本的 Step 0 都是跑这一份。目的：在做任何写操作之前，先确认"在哪个实例上"和
"server 唯一性"，把后续命令需要的 `${server-uuid}` 准备好。

## Step A：确认当前在哪个 Coolify 实例

```bash
coolify context list
```

读 `default` 列里有星号或被标记为 active 的那一项，向用户报：

> 当前 default context 是 `<context-name>`（生产 / 测试 / 其它）。如果你想在另一个实例上跑，
> 告诉我目标 context 名，我后续所有命令都带 `--context=<name>` 跑；
> 或者你自己先 `coolify context use <name>` 永久切。

用户确认后把目标 context 名记为 `${context}`（如果用户接受 default，就用 default 列里的那个名字）。
未确认或用户拒答之前，**不要进行任何写操作**，连读类命令（list / get）也都先停下来。
确认后**每一条后续命令都带 `--context="${context}"`**——见 SKILL.md「全局守则」第二条。

如果 `coolify context list` 返回空或报错，说明用户机器上 CLI 没装 / 没初始化 / context 未配置。
按下面文案返回：

> 没有可用 context。先按 https://github.com/coollabsio/coolify-cli 安装 CLI，再用
> `coolify context add <name> <url> <token>` 添加一个，然后回头再跑这个流程。

## Step B：断言 server 数量恰好为 1

本 skill 当前默认 tranfu 团队只用一台 server。一旦多 server 出现，说明组织结构变了，需要让用户
明确指定走哪台，不能让 skill 默默选第一个。

```bash
coolify server list --context="${context}" --format json
```

按返回数组长度分支：

```bash
SERVER_COUNT=$(coolify server list --context="${context}" --format json | jq 'length')
```

- `SERVER_COUNT == 1`：
  - 拿 server uuid：`SERVER_UUID=$(coolify server list --context="${context}" --format json | jq -r '.[0].uuid')`
  - 拿到 `${server-uuid}`，传给后续场景脚本使用。
- `SERVER_COUNT == 0`：终止。返回文案：
  > 当前 context (`${context}`) 上没有任何 server。先用
  > `coolify server add --context="${context}" <name> <ip> <private-key-uuid>` 加一台，
  > `coolify server validate --context="${context}" <uuid>` 验证通过后再跑这个流程。
- `SERVER_COUNT > 1`：终止。返回文案：
  > 当前 context (`${context}`) 上有 `${SERVER_COUNT}` 台 server，本 skill 默认 tranfu 团队只用单 server。
  > 列出来让我决定：
  > （列出 `coolify server list --context="${context}"` 的 name + uuid + ip）
  > 如果确实需要在多 server 环境上跑，告诉我目标 server-uuid，再跑这个流程；
  > 同时考虑扩展本 skill 让它支持多 server。

## 输出

跑完 Step A + Step B，对场景脚本提供：

- `${context}`：用户已确认的目标 context 名。**场景脚本里的每条 CLI 命令都必须显式带
  `--context="${context}"`**（见 SKILL.md「全局守则」），不要依赖 default。
- `${server-uuid}`：唯一一台 server 的 UUID。

## 失败语义

任一步失败一律按上面对应的"返回文案"原文返回给用户。**不要替用户自动建 server、自动选默认 context、
自动跳过断言**。前置断言的意义就是"在你确认之前，写操作一律拒绝"。
