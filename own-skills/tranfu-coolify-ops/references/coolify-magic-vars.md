# Coolify 魔法变量清单 — compose 声明 = Coolify 自动注入, **不要在 service envs 重复**

## 一句话规则

魔法变量在 compose.yml 的 `environment:` 段里**声明一次** (值给 `''` 空字符串或直接引用), Coolify 部署时会:

1. 自动生成符合该前缀语义的随机值 (首次部署时, 永久持久化)
2. 注入到容器 env 里, 应用代码用 `process.env.SERVICE_PASSWORD_FOO` 之类读到值
3. 写回 Coolify service 的 envs 表 (UI 可见但**不可改**, 改了下次部署还会被覆盖)

**所以 reconcile Step 6I / 更新分支 C 路径绝不再往 service envs endpoint POST 一遍** — 重复写要么被忽略, 要么冲突 (取决于 Coolify 版本), 还会让 .env 同步逻辑误判 "Coolify 上多了一个 key"。

## 完整前缀清单

| 前缀模式 | 含义 | 适用场景 |
|---|---|---|
| `SERVICE_PASSWORD_<ID>` | 普通随机密码, **无特殊符号** (字母数字混合) | 数据库密码 / 普通 service 间认证 — 怕 shell 转义就选这个 |
| `SERVICE_PASSWORD_64_<ID>` | 64 位随机密码, 无特殊符号 | 同上, 但要更长 |
| `SERVICE_PASSWORDWITHSYMBOLS_<ID>` | 含特殊符号的随机密码 | 应用层认证 (强度要求高); **不要塞进数据库密码** (PostgreSQL/MySQL 连接串里 `$` `#` 会出问题) |
| `SERVICE_PASSWORDWITHSYMBOLS_64_<ID>` | 64 位含特殊符号 | 同上, 但要更长 |
| `SERVICE_REALBASE64_<ID>` | 真实 Base64 编码随机串 | JWT secret / cookie session key / 任何要求"Base64 valid"的字段 |
| `SERVICE_REALBASE64_64_<ID>` | 64 位 Base64 | 同上, 更长 |
| `SERVICE_HEX_32_<ID>` | 32 位十六进制随机串 | 通用 token / API key |
| `SERVICE_HEX_64_<ID>` | 64 位十六进制 | encryption key / signing key (推荐, 长度合适) |
| `SERVICE_HEX_128_<ID>` | 128 位十六进制 | 高强度 encryption key |
| `SERVICE_FQDN_<SVC>_<PORT>` | output 方向: Coolify 注入"这个 service 对外的 fqdn" | 应用代码需要自己的对外 URL 做回链 / 跳转时声明; 详见 [service-fqdn-trap.md](service-fqdn-trap.md) |

`<ID>` 是任意大写 + 下划线后缀, 标识"这个值用在哪儿" — 例如 `SERVICE_PASSWORD_REDIS`, `SERVICE_HEX_64_JWT`, `SERVICE_REALBASE64_SESSION`。

**多个 service 引用同一 `<ID>` = 同一个值** (Coolify 按 `<ID>` 持久化, 不按 service 持久化), 应用栈内不会出现"应用持的密码和数据库持的密码对不上"。

## 选哪个的口诀

| 需求 | 选 |
|---|---|
| 数据库密码 (PG / MySQL / Mongo) | `SERVICE_PASSWORD_<DB>` — 无特殊符号, 防连接串吞字符 |
| Redis password | `SERVICE_PASSWORD_REDIS` — 同上 |
| JWT signing secret | `SERVICE_REALBASE64_JWT` 或 `SERVICE_HEX_64_JWT` |
| Cookie session key | `SERVICE_REALBASE64_SESSION` |
| API token / 通用 secret | `SERVICE_HEX_32_<NAME>` (短) / `SERVICE_HEX_64_<NAME>` (长) |
| OAuth client secret (要求强随机) | `SERVICE_PASSWORDWITHSYMBOLS_<NAME>` |
| Encryption key (AES-256) | `SERVICE_HEX_64_<NAME>` (32 字节 = 64 hex) |

## compose 里怎么用

```yaml
services:
  redis:
    image: redis:7-alpine
    environment:
      # 声明: Coolify 你来生成
      SERVICE_PASSWORD_REDIS: ''
      # 引用: 应用栈内用同一个 <ID> 拿同一个值
      REDIS_PASSWORD: ${SERVICE_PASSWORD_REDIS}
    command: redis-server --requirepass $${REDIS_PASSWORD}
    # ↑ 注意 $$ 转义, 让 Coolify 不要再解析这层

  app:
    image: ghcr.io/tranfu-labs/markdown-kits-app:latest
    environment:
      SERVICE_HEX_64_JWT: ''
      JWT_SECRET: ${SERVICE_HEX_64_JWT}
      DATABASE_URL: "postgres://postgres:${SERVICE_PASSWORD_POSTGRES}@postgres:5432/app"
      SERVICE_FQDN_APP_3000: ''       # 声明对外, 端口 3000
```

关键点:
- **声明** 行 (`SERVICE_PASSWORD_REDIS: ''`) 必须有, 否则 Coolify 不知道要生成
- **引用** 行 (`REDIS_PASSWORD: ${SERVICE_PASSWORD_REDIS}`) 才是应用真正读的 key
- 同一 `<ID>` 可以在多个 service 里引用 (postgres + app 都用 `${SERVICE_PASSWORD_POSTGRES}`), 拿到的是同一个值
- 应用代码读 `REDIS_PASSWORD` / `JWT_SECRET`, 不读 `SERVICE_PASSWORD_REDIS` / `SERVICE_HEX_64_JWT` 这种 Coolify 内部名字 (虽然两个都注入了, 但应用层用业务名)

## reconcile 自动 skip 规则

[../commands/service-env.md §"对比仓库 .env 与 Coolify 现状"](../commands/service-env.md) 的 .env diff 必须 grep 过滤这些前缀:

```bash
MAGIC_PREFIXES='^(SERVICE_PASSWORD_|SERVICE_PASSWORDWITHSYMBOLS_|SERVICE_REALBASE64_|SERVICE_HEX_|SERVICE_FQDN_)'

REMOTE_KEYS=$(curl ... | jq -r '.[].key' | grep -vE "$MAGIC_PREFIXES" | sort)
LOCAL_KEYS=$(grep -v '^\s*#' .env | grep '=' | cut -d= -f1 | grep -vE "$MAGIC_PREFIXES" | sort)
```

理由: Coolify 会在 service envs 表里**自动塞一份**魔法变量记录 (供 UI 查看), 但这些不是用户配置出来的。把它们参与 .env diff 会导致每次都"Coolify 多了一堆 key"误诊, 而且 agent 永远不要 POST 这些 key (会冲突)。

## 真实事故

[coolify-env-redeploy.md](coolify-env-redeploy.md) L69 记录过一次:

> `Invalid expression; variable cycle not allowed for SERVICE_PASSWORD_JWT`

原因: 应用 secret (如 `JWT_SECRET`) 在 Coolify UI 里被直接写成 `${SERVICE_PASSWORD_JWT}` 这种 placeholder-style 引用 — 但 Coolify 解析这个引用时认为自我循环。

正确做法: `JWT_SECRET` 写**实际的随机值**, 或者在 compose 里通过 `JWT_SECRET: ${SERVICE_PASSWORD_JWT}` 一次性绑定 (而不是 UI 上写 placeholder 字符串)。**魔法变量只在 compose 里展开, 不在 service envs 表里展开**。

## 安全纪律

- 永不 echo / 打印魔法变量的 value (Coolify 生成的强随机串, 一旦泄露就要全部 rotate, 而 rotate 又涉及"删卷重建"链路)
- 看 Coolify 返回的 envs list 时, 把 `value` 字段直接丢掉 (`jq 'del(.[].value)'`)
