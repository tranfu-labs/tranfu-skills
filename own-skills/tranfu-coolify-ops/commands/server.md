> ⚠️ **ad-hoc 速查**: 本文件是 CLI ad-hoc 速查（排障 / 临时操作用），reconcile flow 主链路不依赖；命令需要时手动跑。reconcile 主链路全走 HTTP API，见 [../scenarios/reconcile-deployment.md](../scenarios/reconcile-deployment.md) 和 [../references/coolify-api-fields.md](../references/coolify-api-fields.md)。

# server 命令参考

本文件覆盖 onboard 场景实际用到的 `coolify server` 子命令。其它子命令（`domains` / `remove`）
未来扩展时再追加。

参数表按原文 1:1。全局 flag（`--context` / `--token` / `--format` / `--show-sensitive` / `--debug`）
不再重复，见 [conventions.md](conventions.md)。所有命令在 onboard 场景里都必须显式带
`--context="${context}"`（见 SKILL.md「全局守则」），下面的示例都已带上。

本文件覆盖的命令：

- [`coolify server list`](#coolify-server-list)：onboard Step 0（prerequisites）断言唯一 server。
- [`coolify server add`](#coolify-server-add-server-name-ip-address-private-key-uuid)：Step 0 终止文案里指引用户加 server。
- [`coolify server validate`](#coolify-server-validate-uuid)：Step 0 终止文案里指引用户验证 server。
- [`coolify server get`](#coolify-server-get-uuid)：辅助查看 server 详情。

---

## `coolify server list`

列出 Coolify 上所有 server。无参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| （无） | — | — | — | — |

onboard 场景用法（在 [prerequisites.md](prerequisites.md) Step B 断言只有一台 server）：

```bash
SERVER_COUNT=$(coolify server list --context="${context}" --format json | jq 'length')
# 必须 == 1
SERVER_UUID=$(coolify server list --context="${context}" --format json | jq -r '.[0].uuid')
```

---

## `coolify server add <server-name> <ip-address> <private-key-uuid>`

加一台新 server。**本 skill 不直接调**——只在 Step 0 终止文案里指引用户用此命令加 server。
加 server 涉及 SSH 私钥分发等手工动作，无法在 onboard 流程里自动完成。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<server-name>` | string | **是** | — | server 名（位置参数） |
| `<ip-address>` | string | **是** | — | server IP（位置参数） |
| `<private-key-uuid>` | string | **是** | — | 私钥 UUID（位置参数，先用 `coolify private-key add` 加） |
| `--port` (`-p`) | integer | 否 | `22` | SSH 端口 |
| `--user` (`-u`) | string | 否 | `root` | SSH 用户 |
| `--validate` | boolean | 否 | `false` | 加完立即调 validate |

终止文案模板（在 Step 0 server 数量 == 0 时用）：

> 当前 context (`${context}`) 上没有任何 server。先用
> `coolify server add --context="${context}" <name> <ip> <private-key-uuid>` 加一台，
> `coolify server validate --context="${context}" <uuid>` 验证通过后再跑这个流程。

---

## `coolify server validate <uuid>`

验证一台 server 是否可达且可被 Coolify 管控（SSH 连通、Docker 在跑、etc.）。
无 flag 参数，位置参数 `<uuid>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | server UUID（位置参数） |

终止文案模板里跟 `server add` 配套出现，让用户加完 server 验一遍。

---

## `coolify server get <uuid>`

按 UUID 拿一台 server 的详情。可选用 `--resources` 一起查它上面跑的资源。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | server UUID（位置参数） |
| `--resources` | boolean | 否 | `false` | 同时显示该 server 上的资源 |

onboard 场景里没直接用 `server get`。在 Step 0 多 server 终止时可以让用户用它（或 `server list` 看 name + ip）来挑哪台。
