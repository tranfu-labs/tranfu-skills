# github 命令参考

本文件覆盖 onboard 场景实际用到的 `coolify github` 子命令（管理 Coolify 上的 GitHub App 集成）。
其它子命令（`branches` / `update` / `delete`）未来扩展时再追加。

参数表按原文 1:1。全局 flag（`--context` / `--token` / `--format` / `--show-sensitive` / `--debug`）
不再重复，见 [conventions.md](conventions.md)。

本文件覆盖的命令：

- [`coolify github list`](#coolify-github-list)：onboard Step 4 找唯一 GitHub App。
- [`coolify github repos`](#coolify-github-repos-app-uuid)：onboard Step 5 校验仓库可见性。
- [`coolify github create`](#coolify-github-create)：Step 4 终止文案里指引用户配 GitHub App。
- [`coolify github get`](#coolify-github-get-app-uuid)：辅助查看现有 GitHub App。

---

## `coolify github list`

列出 Coolify 上所有 GitHub App 集成。无参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| （无） | — | — | — | — |

onboard 场景用法（Step 4 断言 tranfu 团队只有一个 GitHub App）：

```bash
GH_COUNT=$(coolify github list --format json | jq 'length')
# 必须 == 1
GITHUB_APP_UUID=$(coolify github list --format json | jq -r '.[0].uuid')
```

---

## `coolify github repos <app-uuid>`

列出指定 GitHub App 可访问的所有仓库。无 flag 参数，位置参数 `<app-uuid>` 必填。
"可访问"由 GitHub 端 installation 的授权范围决定，不在 Coolify 控制范围。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app-uuid>` | string | **是** | — | GitHub App 集成的 UUID（位置参数） |

onboard 场景用法（Step 5 校验目标仓库在可访问列表里）：

```bash
coolify github repos "${GITHUB_APP_UUID}" --format json \
  | jq -e --arg fullname "tranfu-labs/${repo}" \
      '.[] | select(.full_name == $fullname)' > /dev/null
```

失败 → 指引用户去 `https://github.com/organizations/tranfu-labs/settings/installations`
把目标仓库加进 GitHub App installation 的可访问列表，再回来跑本流程。

---

## `coolify github create`

在 Coolify 上创建一个 GitHub App 集成。**本 skill 不直接调**——只在 Step 4 终止文案里
指引用户用此命令把 GitHub App 配上，因为创建一个 GitHub App 涉及 GitHub 端的注册、
installation、private key 上传等手工动作，无法在 onboard 流程里自动完成。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `--api-url` | string | **是** | — | GitHub API URL，例：`https://api.github.com` |
| `--app-id` | integer | **是** | `0` | GitHub App ID |
| `--client-id` | string | **是** | — | GitHub OAuth Client ID |
| `--client-secret` | string | **是** | — | GitHub OAuth Client Secret |
| `--custom-port` | integer | 否 | `0` | SSH 自定义端口（默认 22） |
| `--custom-user` | string | 否 | — | SSH 自定义用户（默认 `git`） |
| `--html-url` | string | **是** | — | GitHub HTML URL，例：`https://github.com` |
| `--installation-id` | integer | **是** | `0` | GitHub Installation ID |
| `--name` | string | **是** | — | GitHub App 名 |
| `--organization` | string | 否 | — | GitHub 组织 |
| `--private-key-uuid` | string | **是** | — | 已存在的私钥 UUID（先用 `coolify private-key add` 加） |
| `--system-wide` | boolean | 否 | `false` | 是否系统级（仅 cloud） |
| `--webhook-secret` | string | 否 | — | GitHub Webhook Secret |

终止文案模板（在 Step 4 GitHub App 数量 == 0 时用）：

> 当前 context 上没有 GitHub App 集成。先用 `coolify github create` 配一个
> （要 GitHub App ID / client id / client secret / installation id / private-key-uuid），
> 再跑本流程。

---

## `coolify github get <app-uuid>`

按 UUID 拿一个 GitHub App 集成的详情。无 flag 参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app-uuid>` | string | **是** | — | GitHub App 集成的 UUID（位置参数） |

onboard 场景里没直接用 `github get`，但 Step 4 多 GitHub App 终止时可以让用户用它看每个集成的详情。
