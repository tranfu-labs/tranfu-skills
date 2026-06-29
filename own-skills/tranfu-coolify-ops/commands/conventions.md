> ⚠️ **ad-hoc 速查**: 本文件是 CLI ad-hoc 速查（排障 / 临时操作用），reconcile flow 主链路不依赖；命令需要时手动跑。reconcile 主链路全走 HTTP API，见 [../scenarios/reconcile-deployment.md](../scenarios/reconcile-deployment.md) 和 [../references/coolify-api-fields.md](../references/coolify-api-fields.md)。

# 通用约定

这一份是所有场景共用的横切约定。跑任何场景前先把这里读懂，再去看 `prerequisites.md` 和具体的
`scenarios/<name>.md`，可以避免大量重复说明。

## 全局 flag

每条 `coolify` 命令都可以带这些通用 flag：

- `--context <name>`：临时切实例，单次有效，不会改 default context。多实例环境里慎用 default，
  涉及到生产 / 测试切换时 MUST 显式带 `--context=<name>`，NEVER 先 `coolify context use` 改 default 再跑命令。
- `--token <token>`：用一个外部 token 跑这条命令，覆盖当前 context 里存的 token。
- `--format <fmt>`：输出格式，可选 `table`（默认） / `json` / `pretty`。
- `--show-sensitive` 或 `-s`：显示被默认遮蔽的敏感字段（token、密码、IP、邮箱等）。
- `--debug`：打开 CLI 调试日志。出现疑似 CLI 自身行为不对时再开。

## 输出格式与解析

本 skill 的所有场景统一用 `--format json` + `jq` 来解析输出，目的：

- 用脚本可读的方式断言"列表是否为空 / 长度是否为 1 / 是否存在某个 name"，而不是肉眼看 table。
- 错误处理统一。`jq -e` 在结果为空或 false 时退出码非零，可以直接当作 if 条件用。

几个本 skill 反复用到的 jq 模式：

```bash
# 通过 name 找 UUID（例：找名为 foo-app 的 project）
coolify project list --format json \
  | jq -r '.[] | select(.name == "foo-app") | .uuid'

# 断言数组长度（例：要求恰好一个 GitHub App）
COUNT=$(coolify github list --format json | jq 'length')
[ "$COUNT" -eq 1 ] || echo "数量不是 1（实际 $COUNT），终止"

# 断言某条记录存在（jq -e 在空结果时退出码非零）
coolify github repos <github-app-uuid> --format json \
  | jq -e '.[] | select(.full_name == "tranfu-labs/foo-app")' > /dev/null \
  || echo "未找到该仓库，终止"
```

如果用户机器没有 jq，先让其安装：

- macOS：`brew install jq`
- Linux：`apt install jq` 或 `yum install jq`

## UUID 与 ID 的区别

Coolify 的资源标识规则只有一条例外：

- **几乎所有资源都用 UUID**：app / project / server / database / service / private-key / github-app / deployment 等。
- **唯一例外是 teams**：`coolify teams get <team_id>` 用的是数字 ID，不是 UUID。

涉及 teams 时不要把 UUID 当成 ID 来传。其它资源放心当 UUID 处理。

## 别名

CLI 命令树里大多数主名词都有别名，便于打字。这些别名是同一个命令的不同写法，文档里用主名词：

| 主名词 | 别名 |
|---|---|
| `app` | `apps` / `application` / `applications` |
| `database` | `databases` / `db` / `dbs` |
| `service` | `services` / `svc` |
| `github` | `gh` / `github-app` / `github-apps` |
| `private-key` | `private-keys` / `key` / `keys` |
| `project` | `projects` |
| `server` | `servers` |
| `resource` | `resources` |
| `team` | `teams` |

子命令也有少量别名，例如：

- `app env` ≡ `app envs` ≡ `app environment`
- `app start` ≡ `app deploy`
- `app storage` ≡ `app storages`

## 状态枚举

资源运行态在本 skill 的判断里只出现三种值：

- `running`：在跑。
- `stopped`：已停。
- `error`：报错。

部署单独还有它自己的状态（queued / in_progress / finished / failed 等），那是 `deployments list`
的输出，不要跟资源运行态混。

## 几个常踩坑的命令默认行为

- `app start` 等价于 `app deploy`，可加 `--force`（强制 rebuild）或 `--instant-deploy`（跳过排队）。
- `app env sync` 是**增改不删**：把文件里的变量同步到 Coolify，文件里没有的变量**不会**从 Coolify 删除。
  需要清空就显式 `app env delete`。
- `app logs` 默认拿 100 行；`app deployments logs` 默认 0 = 全量。差别明显，别想当然。
- `app logs` / `app deployments logs` 都支持 `--follow` (`-f`) 流式跟踪，和 `--lines` (`-n`) 控制行数。
- `app deployments logs` 多一个 `--debuglogs`，开了能看到 Coolify 内部操作日志，排查"为什么 build 卡住"时有用。

## 敏感字段

默认表格 / json 输出里 token、password、IP、email 等字段会被遮蔽成 `***`。需要看真值时加 `-s` /
`--show-sensitive`，但要意识到这个开关会把敏感值打到 stdout，注意当时所在的环境是否有日志收集。
