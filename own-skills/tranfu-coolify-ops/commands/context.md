# context 命令参考

context 是 coolify CLI 的"多实例切换"概念：每个 context 对应一个 Coolify 实例（URL + token），
default context 决定不带 `--context` 时命令落到哪个实例。

本文件覆盖 onboard 场景实际用到的子命令 + Step 0 终止文案里指引的辅助子命令。其它子命令
（`delete` / `set-default` / `set-token` / `update` / `get` / `version`）未来扩展时再追加。

参数表按原文 1:1。全局 flag（`--context` / `--token` / `--format` / `--show-sensitive` / `--debug`）
不再重复，见 [conventions.md](conventions.md)。

本文件覆盖的命令：

- [`coolify context list`](#coolify-context-list)：onboard Step 0 让用户确认在哪个实例。
- [`coolify context add`](#coolify-context-add-context-name-url-token)：Step 0 终止文案里指引用户配 context。
- [`coolify context use`](#coolify-context-use-context-name)：永久切 default context。
- [`coolify context verify`](#coolify-context-verify)：验证当前 context 能连通能认证。

---

## `coolify context list`

列出所有已配置的 context。无参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| （无） | — | — | — | — |

onboard 场景用法（在 [prerequisites.md](prerequisites.md) Step A 让用户确认在哪个实例）：

```bash
coolify context list
```

读 `default` 列里有星号或被标记为 active 的那一项，向用户报"当前 default context 是
`<name>`（生产 / 测试 / 其它），需要切别的就 `--context=<other>` 临时切，或
`coolify context use <other>` 永久切"。

---

## `coolify context add <context-name> <url> <token>`

加一个新 context。**本 skill 不直接调**——只在 Step 0 终止文案里指引用户用此命令配上。
context 涉及实例 URL 与 API token，需要用户从 Coolify 网页 `/security/api-tokens` 拿 token。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<context-name>` | string | **是** | — | context 名（位置参数） |
| `<url>` | string | **是** | — | Coolify 实例 URL（位置参数） |
| `<token>` | string | **是** | — | API token（位置参数） |
| `--default` (`-d`) | boolean | 否 | `false` | 加完立即设为 default |
| `--force` (`-f`) | boolean | 否 | `false` | 同名 context 已存在时强制覆盖 |

终止文案模板（在 Step 0 `context list` 返回空时用）：

> 没有可用 context。先按 https://github.com/coollabsio/coolify-cli 安装 CLI，再用
> `coolify context add <name> <url> <token>` 添加一个，然后回头再跑这个流程。

---

## `coolify context use <context-name>`

切到另一个 context（设为 default）。无 flag 参数，位置参数 `<context-name>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<context-name>` | string | **是** | — | 要切到的 context 名（位置参数） |

本 skill **不替用户调** `context use`——切 default context 是有副作用的全局行为，应该让用户
自己跑或者用 `--context=<name>` 单条覆盖。Step 0 终止文案里把 `--context=<name>` 和
`coolify context use <name>` 两种切换方式都告诉用户，让他自己挑。

---

## `coolify context verify`

验证当前 context 能连通能认证。无参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| （无） | — | — | — | — |

onboard 场景没强制跑（`context list` 已经能看到 default），但用户刚加完新 context 后
用它做一次连通性自检很合理。
