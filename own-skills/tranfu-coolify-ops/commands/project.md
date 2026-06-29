> ⚠️ **ad-hoc 速查**: 本文件是 CLI ad-hoc 速查（排障 / 临时操作用），reconcile flow 主链路不依赖；命令需要时手动跑。reconcile 主链路全走 HTTP API，见 [../scenarios/reconcile-deployment.md](../scenarios/reconcile-deployment.md) 和 [../references/coolify-api-fields.md](../references/coolify-api-fields.md)。

# project 命令参考

本文件覆盖 onboard 场景实际用到的 `coolify project` 子命令。project 一共就 3 个子命令，
全部抄录如下。

> **注意**：coolify CLI 当前**不暴露 `project delete`** 命令。删 project 只能去 Coolify 网页 UI
> 操作。本 skill 任何提到"删 project"的地方都意味着"去网页 UI 删"——这是 SKILL.md 「任务的本质」
> 段落里强调"回滚成本高"的原因之一。

参数表按原文 1:1。全局 flag（`--context` / `--token` / `--format` / `--show-sensitive` / `--debug`）
不再重复，见 [conventions.md](conventions.md)。所有命令在 onboard 场景里都必须显式带
`--context="${context}"`（见 SKILL.md「全局守则」）。

本文件覆盖的命令：

- [`coolify project list`](#coolify-project-list)：onboard Step 3 找同名 project。
- [`coolify project create`](#coolify-project-create)：onboard Step 3 没找到时建。
- [`coolify project get`](#coolify-project-get-uuid)：辅助查看现状。

---

## `coolify project list`

列出 Coolify 上所有 project。无参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| （无） | — | — | — | — |

onboard 场景用法（在 Step 3 查名 == 仓库名的 project 是否存在）：

```bash
PROJECT_UUID=$(coolify project list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

---

## `coolify project create`

创建一个新 project。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `--description` | string | 否 | — | project 描述 |
| `--name` | string | **是** | — | project 名 |

onboard 场景用法（Step 3 找不到同名 project 时建一个 1:1 命名的）：

```bash
coolify project create --context="${context}" --name "${repo}"
```

约定：project 名 == 仓库名（见 [tranfu-naming.md](tranfu-naming.md)）。
本 skill 不传 `--description`。

**回滚提醒**：如果新建 project 后下游步骤（Step 6 `app create github`）失败，**没办法用 CLI 删**
这个 project（CLI 不暴露 `project delete`）。要么留着复用（project 名跟仓库名 1:1，等下次重跑
本流程时 Step 3 会复用，不会重建），要么去 Coolify 网页 UI 手动删。

---

## `coolify project get <uuid>`

按 UUID 拿一个 project 的详情。无 flag 参数，位置参数 `<uuid>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | project UUID（位置参数） |

onboard 场景里没直接用 `project get`。保留以便扩展场景调用。
