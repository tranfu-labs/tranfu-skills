# project 命令参考

本文件覆盖 onboard 场景实际用到的 `coolify project` 子命令。project 一共就 3 个子命令，
全部抄录如下。

参数表按原文 1:1。全局 flag（`--context` / `--token` / `--format` / `--show-sensitive` / `--debug`）
不再重复，见 [conventions.md](conventions.md)。

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
PROJECT_UUID=$(coolify project list --format json \
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
coolify project create --name "${repo}"
```

约定：project 名 == 仓库名（见 [tranfu-naming.md](tranfu-naming.md)）。
本 skill 不传 `--description`。

---

## `coolify project get <uuid>`

按 UUID 拿一个 project 的详情。无 flag 参数，位置参数 `<uuid>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | project UUID（位置参数） |

onboard 场景里没直接用 `project get`。保留以便扩展场景调用。
