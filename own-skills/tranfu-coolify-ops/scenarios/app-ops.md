# 场景：app 日常运维（set-env / set-domain / redeploy / stop / start）

对**已存在**的 app 做五个最常用的运维动作。入口走自然语言 → 用户报一个项目指代（项目名 / GitHub URL /
UUID / 一句话描述），由场景把它落到唯一的 `${APP_UUID}` 上，再路由到对应动作。
整体仍是「先断言、后操作」的链路，任一定位 / 安全门失败立即终止，不替用户绕过。

## 触发

- 用户对**已经在 Coolify 上**的 app 说"改 env / 加域名 / 改域名 / redeploy / 重新部署 / restart / 重启 /
  停掉 / 关掉 / 启动 / 拉起来"等动词，并用任意自然语言指代某个项目。
- 项目指代可以是：完整 app 名（`order-mgmt-app`）、GitHub URL、app UUID、或一句模糊描述
  （"那个订单服务" / "用户中心"），由 Step 1 的定位逻辑收敛到唯一 UUID。

## 不触发

- onboard 新 app（→ `scenarios/onboard-new-app.md`）。
- 删 app / 删 project（破坏性，待未来 lifecycle-delete 场景）。
- 改 build pack / 改 git repository / 改 docker image 路径（`app update` 支持，但不是"日常运维"语义，
  待未来 change-config 场景细化）。
- 网页 UI 操作。

> 注：用户表达"改 env"但没给 key/value/文件路径时**仍然触发**本场景——
> 由 Step 3.A 的 A.1.5 卫语句拒绝并要求补全信息，**不在触发层拦截**。

## 输入

- `${nl-target}`：用户自然语言里指代项目的串。
- `${intent}`：路由后枚举之一：`set-env` / `set-domain` / `redeploy` / `stop` / `start`。

## 输出

- `${APP_UUID}` / `${APP_NAME}`：定位到的唯一 app。
- 动作执行结果（对应 CLI 命令的退出码 + 后续可观察入口）。

## 全局：动作命令失败兜底

下面 Step 3.A–E 里的写操作 CLI 命令统称"动作命令"（区别于断言 / 读类命令）。
**任一动作命令退出码非 0 时**：

1. **绝不重试、绝不替用户回滚**。资源此时可能处于半状态（例如 `app update --domains` 写了一半），
   重试或回滚都会让状态更难诊断。
2. 把 CLI 的 stderr 原文展示给用户，并打印：
   > 命令 `<cmd>` 失败（exit code = N）。资源 `${APP_NAME}`（context=`${context}`）可能处于半状态。
   > 不要在此基础上继续后续 Step。修复路径见 `scenarios/inspect-app.md`（待实现）；
   > 在那之前请去 Coolify 网页 UI 看实际状态。
3. **终止整个动作**，不进入收尾文案、不进入下一步、不跳到其它 Step。

读类命令（`app list` / `app get` / `app env list` / `coolify app deployments list` 等断言用途）
失败时按各 Step 自己的终止文案处理（通常是"找不到 ${APP_UUID}"类），不走本兜底。

## 流程骨架（共 4 段）

为下面的步骤建立一个 TODO 清单，并在每步完成后更新状态。

### Step 0 — 前置就绪

跳到 `commands/prerequisites.md` 跑 Step A + Step B。
拿到 `${context}`、`${SERVER_UUID}` 后回到本场景继续。任一断言失败按 `prerequisites.md` 的终止文案返回。

> 本场景不直接用 `${SERVER_UUID}`（写操作都按 app UUID 寻址），但仍跑 Step B 是为了在多 server 环境下
> 早早暴露"组织结构变了"的信号，避免到了 Step 3 才发现资源归属混乱。

### Step 1 — 把 `${nl-target}` 定位到唯一 `${APP_UUID}`

【安全等级：read-only】

按下面优先级判断，**命中即停**，不要叠加规则：

| 优先级 | 判定 | 处理 |
|---|---|---|
| 1 | `${nl-target}` 是 UUID 格式（`^[0-9a-f-]{20,}$` 即可粗匹配） | 直接 `coolify app get --context="${context}" "${nl-target}"`；返回非 0 → 终止，文案见下「定位失败 - UUID 不存在」 |
| 2 | `${nl-target}` 形如 `https://github.com/...` 或 `git@github.com:...` | 跳 `commands/tranfu-naming.md` 解析出 `${repo}`，再按 `app.name == ${repo}` 反查 UUID |
| 3 | `${nl-target}` 等于某个 `app.name`（精确，区分大小写） | 直接拿对应 UUID |
| 4 | 以上都不命中 → 模糊匹配 | 见下「模糊匹配规则」 |

#### 模糊匹配规则（仅当优先级 1–3 都没命中）

一次性拿到所有候选源：

```bash
coolify app list --context="${context}" --format json > /tmp/apps.json
coolify project list --context="${context}" --format json > /tmp/projects.json
```

把 `${nl-target}` 切成关键词集合（按空格 / 中文分句切；中文场景里"订单 / 用户 / 商品"这类二字词单独成项），
对每一条 app 计算命中分：

- `app.name` 包含任一关键词 → +3
- `app.name` 所属 `project.name` 包含任一关键词 → +2
- `project.description` 包含任一关键词 → +1（`description` 字段不存在 / 为空时跳过，不报错）

按分数倒序排序，取分数 > 0 的所有候选：

- 候选数 == 1 → 拿 UUID，进 Step 2。
- 候选数 == 0 → 按下面「定位失败 - 零命中」文案终止。
- 候选数 ≥ 2 → 按下面「定位多命中」文案终止。

#### 定位失败 - UUID 不存在

> 在 context (`${context}`) 上没找到 UUID 为 `${nl-target}` 的 app。
> 跑 `coolify app list --context="${context}"` 看一遍现有 app，确认 UUID 没复制错再回来。

#### 定位失败 - 零命中

> 在 context (`${context}`) 上按 `${nl-target}` 没找到匹配的 app。当前 context 下所有 app 是：
>
> （列出 `app.name` / `project.name` / `project.description`（若有） / `app UUID` 表格）
>
> 请用其中一个 app.name 或 UUID 再说一遍。

#### 定位多命中

> 按 `${nl-target}` 在 context (`${context}`) 上找到多个候选：
>
> （按命中分倒序列出 `app.name` / `project.name` / `project.description`（若有） / `app UUID`，
>  最多 5 条；超过 5 条提示「还有 N 个未列出，请用更具体的关键词」）
>
> 告诉我你要操作哪一个（直接回 app.name 或 UUID）。

拿到唯一 `${APP_UUID}` 后，再跑一次 `coolify app get --context="${context}" "${APP_UUID}"` 拿到 `${APP_NAME}` 与当前域名 / 状态，
作为后续 Step 3 banner 信息的来源。

### Step 2 — 动作路由

根据 `${intent}` 跳到 Step 3.A–E 的对应小节。同一次会话里用户可以连续触发多个动作（先 set-env 再
redeploy 是常见组合），每个动作独立判断安全等级、独立打 banner，**不要打包合并**。

| `${intent}` | 跳转 |
|---|---|
| `set-env` | Step 3.A |
| `set-domain` | Step 3.B |
| `redeploy` | Step 3.C |
| `stop` | Step 3.D |
| `start` | Step 3.E |
| **其它**（看状态 / 看 logs / 删 app / 删 project / 改 build pack / 改 git repository / 改 docker image 路径 / 数据库 / 服务 / 防火墙 / 私钥 等） | **终止**，按下面文案返回 |

#### 路由失败 - intent 不在五个枚举内

> 你想做的是 `${用户原话动作}`，不在本场景（app 日常运维）支持的五个动作里
> （set-env / set-domain / redeploy / stop / start）。重定向建议：
>
> - 看状态 / 看 logs / 拿 app 详细信息 → `scenarios/inspect-app.md`（待实现）
> - 删 app / 删 project → `scenarios/lifecycle-delete.md`（待实现）
> - 改 build pack / 改 git repository / 改 docker image 路径 → `scenarios/change-config.md`（待实现）
> - 数据库 / 服务 / mesh / 防火墙 / 私钥 → 各自占位场景（待实现）
>
> 在那之前可以直接走 coolify CLI 或 Coolify 网页 UI；本场景到此结束。

### Step 3.A — set-env

【安全等级：mutating（不自动 redeploy）】

#### A.1 看现状

```bash
coolify app env list --context="${context}" "${APP_UUID}" --format json
```

把当前 env 列表（默认遮蔽 value）摘要给用户，让用户在「新增 / 改值 / 删除」之间确认意图。
用户已经明确给出 key + value 时，仍跑这一步——目的是发现「同 key 已存在 → 要走 update 而不是 create」
的隐藏分支。

#### A.1.5 校验输入完整性（卫语句）

**进 A.2 之前必须确认用户已经给出**下列任一组合：

- 新增 / 改值：明确的 `key` + `value`（value 不能是占位串如 `<your-value>`）。
- 删除：明确的 `key`（名字）。
- 批量同步：一个**存在的** `.env` 文件路径（agent **必须**先 `test -f` 确认文件存在）。

任一不满足 → **终止**，按下面文案返回：

> 要做 set-env 我需要先拿到：
> - 如果是新增 / 改值：要写的 `KEY=value`
> - 如果是删除：要删的 key 名
> - 如果是批量：一个可读的 `.env` 文件路径
>
> 当前你给的是 `<用户原话>`，信息不全。请补齐后再说一次。

#### A.2 路由到具体子命令

| 用户意图 | 命令 |
|---|---|
| key 不存在 + 给了 value | `coolify app env create --context="${context}" "${APP_UUID}" --key K --value V` |
| key 已存在 + 给了新 value | `coolify app env update --context="${context}" "${APP_UUID}" K --value V` |
| 要删某个 key | 先 `env list` 拿到该 key 的 UUID，再 `coolify app env delete --context="${context}" "${APP_UUID}" <env-uuid>`（**不带 `--force`**，让 CLI 自己问确认） |
| 用户给了一个 `.env` 文件路径，想批量 | `coolify app env sync --context="${context}" "${APP_UUID}" --file <path>` ——**提醒用户「sync 增改不删」**（见 conventions.md） |

子命令的完整参数表见 [commands/app-mutating.md](../commands/app-mutating.md) 对应小节。
默认 `--build-time=true` / `--runtime=true`，仅在 build 阶段 / 仅在运行时可见的需求要用户明确，不要替用户猜。

#### A.3 收尾提醒

执行成功后**显式**给一句：

> env 已写入 `${APP_NAME}`（context=`${context}`），但 **env 变更不自动生效**，需要走 redeploy
> （`coolify app start --context="${context}" "${APP_UUID}"`）才会被新一次部署读到。
> 要现在就重新部署吗？

用户说"要"→ 跳 Step 3.C（redeploy）；说"不"→ 结束本动作。

### Step 3.B — set-domain

【安全等级：mutating（Traefik 会刷路由 + Let's Encrypt 签证书，1–3 分钟内 503 正常）】

> **关键事实**：`coolify app update --domains "<list>"` 是**替换全集**语义——传过去的字符串
> 整体覆盖现有 domains 字段。`<list>` 里没写的旧域名会**被清掉**。所以"加一个域名"和
> "换一个域名"在 CLI 层是两条完全不同的命令构造，必须在场景层先拆开。

#### B.0 解析"追加 vs 替换"意图（卫语句）

按用户原话动词归类：

| 用户原话 | 模式 | `--domains` 传什么 |
|---|---|---|
| "加 / 增 / 追加 / 多挂一个 / 再加 X" | **追加** | `<现有 domains>,<新 domains>` |
| "改成 / 换成 / 改为 / 替换成 X" | **替换** | `<新 domains>` |
| "把 X 改成 Y"（明确指名替换某一个） | **替换其中一个** | 在客户端拼：把现有列表里 X 换成 Y，其它原样保留 |
| 表达不明（"改一下 X 的域名为 Y"） | **必须问** | 终止：见下「B.0 终止文案 - 意图不明」 |

**先**从 Step 1 拿到的 `app get` 结果里取出当前 domains 列表（命名为 `${OLD_DOMAINS}`，可能为空字符串）。
**再**按上表算出 `${NEW_DOMAINS}` 字符串。两者都要进 B.1 做格式校验。

##### B.0 终止文案 - 意图不明

> 你说"改 `${APP_NAME}` 的域名为 `<X>`"，但当前 `${APP_NAME}` 已有域名 `<OLD_DOMAINS>`。
> 你想要的是：
> 1. **追加** `<X>` 到现有列表（最终 = `${OLD_DOMAINS},<X>`）
> 2. **替换全集**为 `<X>`（旧域名 `${OLD_DOMAINS}` 全部清掉）
>
> 回 1 或 2 再继续。

#### B.1 格式校验（agent 在本地做，不打 CLI）

对 B.0 算出的 `${NEW_DOMAINS}` 里每一个域名（按英文逗号切）逐一校验：

- 不带 `http://` / `https://` 前缀。
- 不带尾斜杠。
- 不带端口号（端口由 compose / `--ports-exposes` 管）。
- 全小写。

任一不满足，先在客户端纠正一次给用户确认：

> 你给的 `<原文>` 不太对（理由：含 `http://` / 含尾斜杠 / 含端口）。我帮你规范化成 `<纠正后>`，对吗？

用户拒绝 → 终止；用户确认 → 用纠正后的字符串替换 `${NEW_DOMAINS}` 进 B.2。

#### B.2 banner + 写入

执行前打印：

> 即将把 `${APP_NAME}`（context=`${context}`）的域名改写为：
> - 新值：`${NEW_DOMAINS}`
> - 当前值：`${OLD_DOMAINS}`
> - 模式：`<追加 / 替换全集 / 替换其中一个>`（B.0 算出来的）
>
> 改完 Let's Encrypt 签证书一般 1–3 分钟，期间 503 是正常的。继续吗？
> 回 yes / 继续 / 确认 → 写入；其它（含"嗯" / "ok" / 沉默） → 终止：'没收到明确确认，本次未执行 app update。'

**只有**用户用强信号词（yes / 继续 / 确认 / 就这样改）回复才进下一步执行。其它一律按未确认文案终止，
**绝不替用户假定为同意**。

```bash
coolify app update --context="${context}" "${APP_UUID}" \
  --domains "${NEW_DOMAINS}"
```

CLI 退出码非 0 → 走「全局：动作命令失败兜底」。

#### B.3 收尾

set-domain 改完通常**不需要** redeploy（域名 / 流量层配置 Traefik 自己刷）。如果用户改的不止域名、
还顺手改了 `--health-check-path` / `--start-command` 这类「容器层」配置，那要按本场景的 Step 3.C 触发 redeploy
才会生效——这个判断由 agent 在改的字段集合上推断，不需要用户额外指示。

### Step 3.C — redeploy

【安全等级：mutating（有短暂停服窗口，取决于 compose 编排）】

#### C.1 banner

> 即将对 `${APP_NAME}`（context=`${context}`，UUID=`${APP_UUID}`）触发一次部署。
> 这会拉取 `<git-branch>` 上的最新代码、跑完 build 流水线、起新容器；切换瞬间可能有几秒不可用。
> 继续吗？
> 回 yes / 继续 / 确认 → 触发部署；其它（含"嗯" / "ok" / 沉默） → 终止：'没收到明确确认，本次未触发部署。'

如果用户在前一步说"要 redeploy 让 env / 配置生效"，banner 仍要打——这是 mutating 等级的标准化护栏。
**只有**用户用强信号词回复才进 C.2，其它一律按未确认文案终止，**绝不替用户假定为同意**。

#### C.2 触发部署

```bash
coolify app start --context="${context}" "${APP_UUID}"
```

可选 flag（由 agent 根据用户表达推断，**不要默认带**）：

- 用户提"无缓存 / 强制重建 / 怀疑 build 缓存污染" → 加 `--force`。
- 用户提"紧急上线 / 不要排队 / instant" → 加 `--instant-deploy`。

CLI 退出码非 0 → 走「全局：动作命令失败兜底」。

#### C.3 跟踪部署

复用 onboard Step 7 的写法拿最新一条 deployment UUID：

```bash
DEPLOYMENT_UUID=$(coolify app deployments list --context="${context}" "${APP_UUID}" --format json \
  | jq -r 'sort_by(.created_at // .id) | last | .uuid')
```

如果 `${DEPLOYMENT_UUID}` 为 `null` 或空，按下面文案终止：

> 已触发 `app start` 但 deployments list 拿不到新部署。跑
> `coolify app deployments list --context="${context}" "${APP_UUID}" --format pretty` 看原始输出排查。

拿到 UUID 后给用户流式入口：

```bash
coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --follow
```

部署最终是否 running 由用户在 logs 流里观察，不在本场景判据里——这点跟 onboard Step 7 一致。

### Step 3.D — stop

【安全等级：disruptive（对外服务中断）】

#### D.1 强提醒 banner

执行前必须打印（**醒目**，例如用 `!!!` 或加粗）：

> ⚠️ 这是停服操作。即将停掉：
> - app: `${APP_NAME}`
> - context: `${context}`
> - 对外域名: `<列出当前所有域名>`
> - 当前状态: `<running / stopped / error>`
>
> 停掉后这些域名会返回 502 / 503，对外不可访问，直到你显式 `app start`。
> 要继续吗？请明确回复 **yes** / **确认停服** / **就是要停**，其它含糊回答（嗯 / ok / 行）一律视为未确认。

#### D.2 解析用户回复

只有用户用上面列出的强信号词回复，才进 D.3。其它一律按下面文案终止：

> 没收到明确停服确认，本次未执行 `app stop`。如要继续，明确回复 yes / 确认停服。

#### D.3 执行

```bash
coolify app stop --context="${context}" "${APP_UUID}"
```

CLI 自己**不会**问 prompt（参考 [commands/app-mutating.md](../commands/app-mutating.md) `app stop` 小节），
所以二次确认的护栏完全靠本 Step 在场景层兜住，不能省。

#### D.4 收尾

> `${APP_NAME}` 已停。要重启走 `coolify app start --context="${context}" "${APP_UUID}"`（会走一次部署）
> 或 `coolify app restart --context="${context}" "${APP_UUID}"`（就地拉起现有容器，不重新 build）。

### Step 3.E — start

【安全等级：mutating，非破坏】

#### E.1 区分用户真实意图

用户说"启动 / 拉起来 / 开机"时，先在客户端判断他要的是哪一种：

- **想让最新代码 / 改完的 env 生效** → 这是 redeploy，走 Step 3.C，**不要**在这里继续。
- **app 当前是 stopped，想用现有镜像跑起来** → 真正的 start，进 E.2。
- **app 当前 running，想"踢一脚"重启** → 这是 restart，跳 E.3。

用户表达不明时直接问一句：

> 你想要的是：
> 1. 重新部署最新代码（redeploy） → 我会跑 `app start`
> 2. 用现有镜像把停掉的容器启起来 → 我会跑 `app start`（CLI 没有"纯启动不部署"的入口，会走一次部署，但用现有 git 状态）
> 3. 就地重启现有容器，不重新拉代码 → 我会跑 `app restart`

#### E.2 真正的 start（app 在 stopped 状态）

```bash
coolify app start --context="${context}" "${APP_UUID}"
```

跟 Step 3.C 的 redeploy 走同一条 CLI 命令，区别只在用户预期：start 场景下用户希望"恢复跑起来"，
所以收尾文案侧重"容器现在又在跑了"，不是"新版本上线了"。

跟踪部署同 Step 3.C 的 C.3。

#### E.3 restart（就地重启）

```bash
coolify app restart --context="${context}" "${APP_UUID}"
```

**注意**：restart 不重新拉代码、不重新 build。容器已经被 stop 停掉的状态下，restart 是否能拉起来取决于
Coolify 版本，不要依赖；安全的路径是停了之后走 E.2 的 `app start`。

restart 不返回 deployment UUID（它不触发部署），所以不用走 deployments list / logs --follow 这一套；
用 `coolify app logs --context="${context}" "${APP_UUID}" --follow` 看应用日志即可。

<example>
用户：把 order-mgmt-app 重新部署一下，最近改了几个 env

执行：

Step 0：跑 `coolify context list` → default 是 `prod`，用户确认 `${context}=prod`；
跑 `coolify server list --context=prod --format json | jq 'length'` → 1，通过。

Step 1：`${nl-target}=order-mgmt-app`，匹配优先级 3（精确名）→
`coolify app list --context=prod --format json | jq -r --arg n order-mgmt-app '.[] | select(.name == $n) | .uuid'` →
`${APP_UUID}=44444444-...`。
跑 `coolify app get --context=prod 44444444-...` 拿到 `${APP_NAME}=order-mgmt-app`、当前域名 `order.tranfu.com`、状态 `running`。

Step 2：`${intent}=redeploy` → 跳 Step 3.C。

Step 3.C：
- banner：
  > 即将对 order-mgmt-app（context=prod，UUID=44444444-...）触发一次部署。
  > 这会拉取 main 上的最新代码、跑完 build 流水线、起新容器；切换瞬间可能有几秒不可用。
  > 继续吗？
- 用户：好的继续。
- 跑 `coolify app start --context=prod 44444444-...`
- 拿新 `${DEPLOYMENT_UUID}=55555555-...`
- 给入口：`coolify app deployments logs --context=prod 44444444-... 55555555-... --follow`
- 结束。
</example>

<example>
用户：把那个商品服务停掉

执行：

Step 0：同上拿到 `${context}=prod`。

Step 1：`${nl-target}=商品服务`，优先级 1–3 都不命中，进模糊匹配。
关键词集合 = {"商品", "服务"}。算分：
- `commodity-app`（project.description="商品中台：SKU / 类目 / 价格"）→ 0 + 0 + 1 = 1
- `goods-app`（project.description="商品上下架与详情聚合服务"）→ 0 + 0 + 2 = 2（"商品""服务"各 +1）

候选 ≥ 2 → 列候选让用户选：
> 按"商品服务"在 context (prod) 上找到多个候选：
> | app.name | project.name | project.description | UUID |
> |---|---|---|---|
> | goods-app | goods-app | 商品上下架与详情聚合服务 | 66666666-... |
> | commodity-app | commodity-app | 商品中台：SKU / 类目 / 价格 | 77777777-... |
>
> 告诉我你要操作哪一个。

用户：goods-app。回到 Step 1 拿 `${APP_UUID}=66666666-...`、当前域名 `goods.tranfu.com`、状态 `running`。

Step 2：`${intent}=stop` → 跳 Step 3.D。

Step 3.D：
- 打强提醒 banner：
  > ⚠️ 这是停服操作。即将停掉：
  > - app: goods-app
  > - context: prod
  > - 对外域名: goods.tranfu.com
  > - 当前状态: running
  > 停掉后这些域名会返回 502 / 503，对外不可访问，直到你显式 app start。
  > 要继续吗？请明确回复 yes / 确认停服 / 就是要停。
- 用户：yes
- 跑 `coolify app stop --context=prod 66666666-...`
- 收尾文案：
  > goods-app 已停。要重启走 coolify app start --context=prod 66666666-... 或 coolify app restart --context=prod 66666666-...
</example>

<bad-example>
错误做法 1：用户说"重启 order-mgmt-app"，agent 直接跑 `coolify app restart --context=prod <uuid>` 重启容器。

问题：用户说"重启"通常是想让最近的代码 / env 改动生效，期望的是 redeploy（`app start`）而不是
就地 restart。两者效果差很多——restart 用的还是旧镜像，用户改的 env 没生效会以为没改成功。

正确做法：在 Step 3.E 的 E.1 里**显式问用户**真实意图，三选一，不要默认走 restart。
</bad-example>

<bad-example>
错误做法 2：用户说"把 user-app 关掉"，agent 走 Step 3.D，但 banner 只说了一句"我要停 user-app 了，
确认吗？"用户回"嗯"，agent 就执行了。

问题：
- banner 信息不全（没列域名 / 没列当前状态 / 没列 context），用户回"嗯"时不知道在确认什么。
- "嗯"不是强信号词。本 Step 明确规定必须 yes / 确认停服 / 就是要停才算确认，含糊回答一律按未确认处理。
- `app stop` CLI 自己不会再问 prompt，命令一发即停，没有后悔药。

正确做法：banner 完整列出 app 名 + UUID + context + 当前域名 + 当前状态；只有强信号词才推进。
</bad-example>

<bad-example>
错误做法 3：用户说"给 user-app 加个域名 https://user.tranfu.com/"，agent 直接拼：

```bash
coolify app update --context=prod <uuid> --domains "https://user.tranfu.com/"
```

问题：`--domains` 不接受协议前缀 / 尾斜杠，Coolify 收下后域名匹配会失败。

正确做法：Step 3.B B.1 在客户端先纠正成 `user.tranfu.com`，告诉用户"我帮你规范化成 X，对吗？"，
拿到确认再走 update。
</bad-example>

## 验收用例

跑完 skill 后，应该满足以下用例的预期行为：

| 编号 | 输入 / 状态 | 期望 |
|---|---|---|
| 1 | "把 order-mgmt-app 重新部署一下" + 当前 context 有同名 app | Step 1 精确命中；Step 3.C banner + 用户确认后跑 `app start`；拿到新 `${DEPLOYMENT_UUID}` + logs 流式入口 |
| 2 | "停掉商品服务" 模糊匹配到 commodity-app / goods-app 两个 | Step 1 列候选让用户选；选定后进 Step 3.D |
| 3 | 上述选定 goods-app 后用户回 "yes" | Step 3.D 执行 `app stop`；收尾给出 restart / start 入口 |
| 4 | 上述选定 goods-app 后用户回 "嗯" 或换话题 | Step 3.D 拒绝执行，按未确认文案返回 |
| 5 | "给 user-app 加个域名 user.tranfu.com" | Step 3.B 域名格式合规，banner + 用户确认后跑 `app update --domains`；提示 1–3 分钟生效 |
| 6 | "给 user-app 加个域名 https://user.tranfu.com/" | Step 3.B B.1 在客户端纠正成 `user.tranfu.com`，让用户确认后再写 |
| 7 | "user-app 加 env DATABASE_URL=xxx" + 该 key 不存在 | Step 3.A.2 走 `env create`；A.3 提醒需 redeploy 才生效，并询问是否立刻 redeploy |
| 8 | 同 7 但 key 已存在 | Step 3.A.1 list 时发现同 key；A.2 改走 `env update`，不创建新条目 |
| 9 | `${nl-target}` 是一个不存在的 UUID | Step 1 优先级 1 终止，提示 list 看一眼再回来 |
| 10 | 自然语言零关键词命中（例如说"那个项目"） | Step 1 模糊匹配零命中，列当前 context 全 app 让用户重表达 |
| 11 | 用户说"重启 user-app" 没说是要让改动生效还是就地重启 | Step 3.E E.1 显式问三选一，不默认走 restart 或 start |
| 12 | 用户说"sync env" 给了 `.env` 文件 | Step 3.A.2 路由到 `env sync`，并**显式**提醒"sync 增改不删，文件里没的不会被清掉" |
