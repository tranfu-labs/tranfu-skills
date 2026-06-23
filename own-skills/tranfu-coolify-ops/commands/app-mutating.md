# app 写操作命令参考

本文件覆盖 `scenarios/app-ops.md` 场景里五个动作（set-env / set-domain / redeploy / stop / start）
实际用到的 `coolify app` 子命令完整参数。延续 [app.md](app.md) 的「1:1 抄录」风格——
读类命令（`app list` / `app get` / `app deployments list` / `app deployments logs`）已在 app.md 里覆盖，
本文件**不重复**，专放会改 Coolify 状态的子命令。

参数表统一按原文 1:1 抄录：`参数`、`类型`、`必填`、`默认值`、`说明`。
每条命令都会带 `--context` / `--token` / `--format` / `--show-sensitive` / `--debug`
这些全局 flag（见 [conventions.md](conventions.md)），下表不再重复。所有命令在 app-ops 场景里
都必须显式带 `--context="${context}"`（见 SKILL.md「全局守则」），下面的示例都已带上。

本文件覆盖的命令：

- [`coolify app env list`](#coolify-app-env-list-app_uuid)：动作前先看现状，避免覆盖未察觉的同 key。
- [`coolify app env create`](#coolify-app-env-create-app_uuid)：新增一个 env 变量。
- [`coolify app env update`](#coolify-app-env-update-app_uuid-env_uuid_or_key)：改一个已存在的 env 变量。
- [`coolify app env delete`](#coolify-app-env-delete-app_uuid-env_uuid)：删一个 env 变量（破坏性）。
- [`coolify app env sync`](#coolify-app-env-sync-app_uuid)：从 `.env` 文件批量同步（增改不删）。
- [`coolify app update`](#coolify-app-update-uuid)：通用 update，set-domain 走的就是这一个。
- [`coolify app start`](#coolify-app-start-uuid)：触发一次部署（≡ `app deploy`）。redeploy / start 动作的主命令。
- [`coolify app stop`](#coolify-app-stop-uuid)：停服。**破坏性**，对外服务中断。
- [`coolify app restart`](#coolify-app-restart-uuid)：就地重启容器，**不重新拉代码、不重新 build**，跟 `start/deploy` 不是一回事。

---

## `coolify app env list <app_uuid>`

列出 app 的所有环境变量。位置参数 `<app_uuid>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app_uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `--all` | boolean | 否 | `false` | 同时列出 regular + preview（先 regular 后 preview） |
| `--preview` | boolean | 否 | `false` | 只列 preview 环境的变量，而不是 regular |

app-ops 场景用法（set-env 动作的 Step 3.A 第一件事是 list 看现状）：

```bash
coolify app env list --context="${context}" "${APP_UUID}" --format json
```

默认输出会把 `value` 字段遮蔽成 `***`，要看真值加 `-s` / `--show-sensitive`。注意这会把明文打到 stdout，
当前环境如果有日志收集会留痕。

---

## `coolify app env create <app_uuid>`

新增一个环境变量。位置参数 `<app_uuid>` 必填，`--key` / `--value` 也必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app_uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `--key` | string | **是** | — | 变量名 |
| `--value` | string | **是** | — | 变量值 |
| `--build-time` | boolean | 否 | `true` | 在 build 阶段可见 |
| `--runtime` | boolean | 否 | `true` | 在运行时可见 |
| `--preview` | boolean | 否 | `false` | 只在 preview 部署里可见 |
| `--is-literal` | boolean | 否 | `false` | 把 value 当字面量处理，**不**做 `$VAR` 插值 |
| `--is-multiline` | boolean | 否 | `false` | 多行值 |
| `--comment` | string | 否 | — | 注释 |

app-ops 场景用法：

```bash
coolify app env create --context="${context}" "${APP_UUID}" \
  --key DATABASE_URL --value "postgres://..."
```

已知坑：

- **CLI 没有 `app env set` / `app env unset`。** 新增用 `env create`，改值用 `env update`，删用 `env delete`。
  对应到自然语言里"加 / 设 / 改 / 删 env"，要明确路由到不同子命令。
- 默认 `build-time=true` / `runtime=true`。如果只想在 build 阶段用、运行时不暴露，要显式 `--runtime=false`。
- 值里有 `$` 又不想被插值时要 `--is-literal`，否则 Coolify 会按 `$VAR` 替换。
- 新建 env **不会自动 redeploy**，要让改动生效得显式触发 `app start`（见下）。

---

## `coolify app env update <app_uuid> <env_uuid_or_key>`

改一个已存在的 env 变量。第二个位置参数支持 UUID 或 key 名两种写法。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app_uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `<env_uuid_or_key>` | string | **是** | — | env 变量的 UUID 或 key 名（位置参数） |
| `--value` | string | **是** | — | 新值 |
| `--key` | string | 否 | — | 改 key 名（rename） |
| `--build-time` | boolean | 否 | `true` | 在 build 阶段可见 |
| `--runtime` | boolean | 否 | `true` | 在运行时可见 |
| `--preview` | boolean | 否 | `false` | 只在 preview 部署里可见 |
| `--is-literal` | boolean | 否 | `false` | 字面量，不做插值 |
| `--is-multiline` | boolean | 否 | `false` | 多行值 |
| `--comment` | string | 否 | — | 注释 |

app-ops 场景用法（改一个已有的 `DATABASE_URL`）：

```bash
coolify app env update --context="${context}" "${APP_UUID}" DATABASE_URL \
  --value "postgres://new-host:5432/..."
```

已知坑：

- 第二个位置参数用 key 名最直观，但**同 key 重复出现在 regular / preview 各一份时存在歧义**——
  跑前先用 `env list --all` 看清楚目标到底是哪一条，必要时用 UUID 精确指代。
- `--value` 在 update 里仍是 required（即便只想改 `--build-time` 标志，也必须把现值原样再传一次）。

---

## `coolify app env delete <app_uuid> <env_uuid>`

删一个 env 变量。**破坏性**，本 skill 任何场景都不替用户带 `--force`，让 CLI 自己问确认。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app_uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `<env_uuid>` | string | **是** | — | env 变量 UUID（位置参数，**这里只接 UUID，不接 key 名**） |
| `--force` (`-f`) | boolean | 否 | `false` | 跳过 CLI 自带的确认 prompt |

app-ops 场景用法：

```bash
# 先 list 拿到目标 env 的 uuid
ENV_UUID=$(coolify app env list --context="${context}" "${APP_UUID}" --format json \
  | jq -r --arg k OLD_KEY '.[] | select(.key == $k) | .uuid')

# 再删（不带 --force，让 CLI 问确认）
coolify app env delete --context="${context}" "${APP_UUID}" "${ENV_UUID}"
```

已知坑：

- 第二个位置参数**只接 UUID，不接 key 名**，跟 `env update` / `env get` 不一致（那两个支持 key）。
- 本 skill 永远不替用户加 `--force`，参考 SKILL.md「全局守则」。

---

## `coolify app env sync <app_uuid>`

从一个 `.env` 文件批量同步多个变量。**增改不删**：文件里有的会写入 / 更新，文件里没有但 Coolify 里有的
**不会**被清除（参考 [conventions.md](conventions.md)「几个常踩坑的命令默认行为」）。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app_uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `--file` (`-f`) | string | **是** | — | `.env` 文件路径 |
| `--build-time` | boolean | 否 | `true` | 所有变量都在 build 阶段可见 |
| `--runtime` | boolean | 否 | `true` | 所有变量都在运行时可见 |
| `--preview` | boolean | 否 | `false` | 所有变量都进 preview 环境 |
| `--is-literal` | boolean | 否 | `false` | 所有值都按字面量处理，不做插值 |

app-ops 场景用法（批量同步）：

```bash
coolify app env sync --context="${context}" "${APP_UUID}" --file .env.production
```

已知坑：

- **不删**：要把 Coolify 里的某个 key 清掉，文件里少写没用，得显式 `env delete`。
- `--file` 是必填，没有 stdin / 命令行批量写多个 key 的入口。要从命令行一次写多个，只能多次调 `env create`。

---

## `coolify app update <uuid>`

通用 update，**所有「改应用元数据 / 配置」都从这里走**——本场景里 set-domain 动作的主命令就是它，
未来改 description / 改健康检查路径 / 改 build / start command 也都是它。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `--domains` | string | 否 | — | 域名，**多域名用英文逗号分隔** |
| `--description` | string | 否 | — | 应用描述 |
| `--name` | string | 否 | — | 应用名 |
| `--git-repository` | string | 否 | — | Git 仓库 URL |
| `--git-branch` | string | 否 | — | Git 分支 |
| `--docker-image` | string | 否 | — | Docker 镜像名（dockerimage build-pack 时） |
| `--docker-tag` | string | 否 | — | Docker 镜像 tag |
| `--dockerfile` | string | 否 | — | Dockerfile 内容（dockerfile build-pack 时） |
| `--dockerfile-target-build` | string | 否 | — | Dockerfile target build stage |
| `--base-directory` | string | 否 | — | 仓库内子目录 |
| `--build-command` | string | 否 | — | 自定义 build 命令 |
| `--install-command` | string | 否 | — | 自定义 install 命令 |
| `--start-command` | string | 否 | — | 自定义 start 命令 |
| `--publish-directory` | string | 否 | — | static 构建产物目录 |
| `--ports-exposes` | string | 否 | — | 暴露端口 |
| `--ports-mappings` | string | 否 | — | 端口映射 `host:container` |
| `--health-check-enabled` | boolean | 否 | `false` | 启用健康检查 |
| `--health-check-path` | string | 否 | — | 健康检查路径 |

app-ops 场景用法（set-domain，把域名改成两个）：

```bash
coolify app update --context="${context}" "${APP_UUID}" \
  --domains "user.tranfu.com,api.user.tranfu.com"
```

已知坑：

- **未传的字段不会被改**（字段级 PATCH）。单独传 `--domains` 不会把 `--git-branch` 之类置空。
- **但传了的字段是"整体覆盖"，不是 merge**：尤其 `--domains` 是**替换全集**——
  传 `--domains "b.com"` 时旧 domains（哪怕只是 `a.com`）会**被清掉**，不是追加。
  想"加一个域名"必须在客户端先 `app get` 拿到现有 domains，自己拼接成 `<old>,<new>` 再 update；
  场景层处理见 `scenarios/app-ops.md` Step 3.B 的 B.0（解析"追加 vs 替换"意图）。
- **域名格式**：传给 `--domains` 的字符串里**不要带 `http://` / `https://` 前缀、不要带尾斜杠**，
  也不要带端口号（端口由 compose / `--ports-exposes` 管）。Coolify 会自动给每个域名签 Let's Encrypt 证书。
- **多域名分隔符是英文逗号**，不是空格、不是分号。
- **改完域名生效需要 Traefik 重新发现 + Let's Encrypt 签证书**，一般 1–3 分钟，期间 503 是正常的。
- `app update` 改完**不会自动 redeploy**，但对域名 / 健康检查路径这种"流量层"配置，Traefik 会自己刷新，
  不强求重部署；如果改的是 build / start command 之类"容器层"配置，那就必须再走 `app start` 触发部署。

---

## `coolify app start <uuid>`

触发一次部署（**≡ `coolify app deploy`**，二者完全等价，见 [conventions.md](conventions.md)）。
"redeploy"动作与"start"动作都走这条命令。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `--force` | boolean | 否 | `false` | 强制无缓存重新 build（rebuild） |
| `--instant-deploy` | boolean | 否 | `false` | 跳过排队，立即部署 |

app-ops 场景用法：

```bash
# redeploy：让最新代码 / env / 配置生效，走默认排队
coolify app start --context="${context}" "${APP_UUID}"

# redeploy 且要无缓存重建（怀疑 build 缓存污染时）
coolify app start --context="${context}" "${APP_UUID}" --force

# redeploy 且不要排队（紧急上线）
coolify app start --context="${context}" "${APP_UUID}" --instant-deploy
```

已知坑：

- **`app start` 不是"开关"，是"触发部署"**：它会拉取最新代码、走完 build 流水线、起新容器。对一个原本就在
  `running` 的 app 跑 `app start`，相当于一次 redeploy，**会有短暂的停服窗口**（取决于 compose 编排策略）。
  想"无副作用地把停掉的容器开起来"——CLI 当前没有这种入口，要么用 `app restart`（如果容器还在），
  要么接受会走一次部署。
- `--force` 用来解 build 缓存污染（例如基础镜像 latest 已更新但 Coolify 仍走老缓存）。日常 redeploy 不带。
- `--instant-deploy` 跳过的是 Coolify 内部的部署排队队列。如果当前没有其它部署排队，加不加都一样。

---

## `coolify app stop <uuid>`

停服。**破坏性**，对外服务会中断。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | 应用 UUID（位置参数） |

app-ops 场景用法（**必须先经过场景里的 Step 3.D 二次确认 banner**）：

```bash
coolify app stop --context="${context}" "${APP_UUID}"
```

已知坑：

- **没有 `--force` 跳确认**：CLI 自己**不会**问 prompt，命令一发就停。所以"二次确认"这个责任在
  scenarios/app-ops.md Step 3.D 那一层，不在 CLI 这一层。本 skill 不能省。
- 停掉之后 Traefik 路由还在，但后端没人响应，对外是 502 / 503。要彻底摘流量得另外改域名 / 删 app。
- 停掉之后想重启：跑 `app start`（会走一次部署）或 `app restart`（如果容器还在）。

---

## `coolify app restart <uuid>`

就地重启容器。**不重新拉代码、不重新 build**，跟 `start/deploy` 是两回事。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | 应用 UUID（位置参数） |

app-ops 场景用法：

```bash
coolify app restart --context="${context}" "${APP_UUID}"
```

已知坑：

- **跟 redeploy 不一样**。`restart` 用现有镜像 + 现有配置重启容器；想让最新代码 / 改完的 env 生效**必须** redeploy
  （= `app start`）。用户说"重启"时要追问"是想让最新改动生效（→ redeploy / app start）还是只是想踢一脚现有容器
  （→ app restart）"。
- 容器已经被 `app stop` 停掉的情况下，`restart` 是否能拉起来取决于 Coolify 版本，不要依赖。安全的路径是
  停了之后走 `app start`。
