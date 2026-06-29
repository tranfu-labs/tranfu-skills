---
name: tranfu-coolify-ops
version: 0.4.0
author: aquarius-wing
origin: own
updated_at: 2026-06-29
description: >
  把 tranfu-labs 下的 -app 仓库从源码部署到公司 Coolify 实例 (http://120.77.223.183:8000)，
  端到端走通：仓库代码侧四件套 (Dockerfile / .dockerignore / compose.yml / deploy.yml) + Coolify 端
  Service 资源 (Docker Compose Empty) + GitHub repo secrets/vars + 触发首次部署 + 公网可访问。
  唯一流程文档 scenarios/reconcile-deployment.md，9 个 Step 每步 check → diff → act 幂等模式：
  新项目部署 / 部署故障 / 临时改域名 / 改 env / 改 compose 全部走同一份流程，让流程识别要做什么。
  触发短语：把 tranfu-labs/<x>-app 上 coolify、把这个项目部署到 coolify、给这个仓库做 coolify onboard、
  改下这个项目的域名 / env / compose、部署挂了 / 部署没成功、coolify 上访问不了、redeploy / 重新部署。
  口语：「这个项目怎么挂到 coolify」「帮我把这个 app 跑到 coolify 上」「coolify 一下」。
  不要用于：非 tranfu-labs 仓库（命名不合规直接终止）；非公司 Coolify 实例；纯网页 UI 操作
  （如手工建 project / 删 volume / 看 logs）；与部署无关的代码改造。
---

# tranfu Coolify 部署运维

把 tranfu-labs/<x>-app 端到端部署到公司 Coolify 实例。新项目 / 故障修复 / 临时改动**全部走同一份 reconcile 流程**——流程自己识别要做什么，整套幂等可重跑。

## Token 纪律（硬约束，写在最前面）

`$COOLIFY_API_TOKEN` 是高敏感凭据。**全 skill 范围**遵守：

1. **校验脚本只输出 ✓ / ✗**——长度、前缀都不打（见 [assets/preflight.sh](assets/preflight.sh)）
2. **agent 给 Bash tool 的命令字符串里永远只引用 `$COOLIFY_API_TOKEN` 变量名**——token 原文只在 shell 内展开，不进对话转录
3. **禁止 `echo $COOLIFY_API_TOKEN`** 来"看一眼对不对"——校验只能通过 preflight.sh
4. **gh secret 用 `--body "$COOLIFY_API_TOKEN"`**，不写明文
5. **curl 用 `-H "Authorization: Bearer $COOLIFY_API_TOKEN"`**，不写明文
6. **Coolify 返回的 env value 是明文**——agent 拿来做 diff，**不展示**，hash 比较代替明文显示
7. **用户给的 `.env` 文件**——读完直接打 API，不在对话里 echo 内容

这套纪律比"四件套合规"还硬——违反一次 token 就外泄。

## 心智模型（读一遍再开干）

- **Docker Compose Empty = Service 资源**（不是 Application）——UI 上"+New Resource → Services → Docker Compose Empty"，API 走 `/api/v1/services` 命名空间。详见 [references/service-vs-application.md](references/service-vs-application.md)
- **一个 Service = 一份 compose + 内嵌 sub-applications 数组**——compose 里有 N 个 service，sub-applications 数组就有 N 条，每条有独立 uuid + fqdn
- **改域名走 `urls` 字段**（不是 `domains`、不是 `docker_compose_domains`、不是 compose 里 `SERVICE_FQDN_*`）——详见 [references/urls-vs-docker-compose-domains.md](references/urls-vs-docker-compose-domains.md)
- **`SERVICE_FQDN_*` 是 Coolify → 容器的 output**，不是 user → Coolify 的 input——compose 里写 `''` 即可，写真值无效。详见 [references/service-fqdn-trap.md](references/service-fqdn-trap.md)
- **部署链路**：GHA push GHCR → curl `$BASE/api/v1/deploy?uuid=...` → Coolify pull 重启。Coolify 上**关 Auto Deploy on Push / Webhook**，触发权归 workflow。详见 [commands/deploy-trigger.md](commands/deploy-trigger.md)
- **CLI 不靠谱**——Coolify CLI 1.x 命令未文档化，service create 的 type 字段语义不明。本 skill **全部走 HTTP API**，CLI 不依赖

## 唯一流程入口

[`scenarios/reconcile-deployment.md`](scenarios/reconcile-deployment.md)。所有触发都走它。

9 个 Step，每步 Check → Diff → Act：

| # | Step | 主要参考 |
|---|---|---|
| 0 | **preflight 独立脚本**（工具 / git / 命名 / GitHub 凭据+权限 / Coolify 凭据+活性+写权限 / GHCR ack）| [assets/preflight.sh](assets/preflight.sh) + [commands/prerequisites.md](commands/prerequisites.md) |
| 1 | (已并入 Step 0) | — |
| 2 | 仓库代码侧四件套 | [references/file-generation-rules.md](references/file-generation-rules.md) + [assets/deploy.yml.template](assets/deploy.yml.template) |
| 3 | Coolify Service 资源存在 | [commands/service-crud.md](commands/service-crud.md) |
| 4 | Compose 内容一致 | [commands/service-crud.md](commands/service-crud.md) §"更新 compose" |
| 5 | 域名 (sub-application.fqdn) | [commands/domain.md](commands/domain.md) |
| 6 | Env 变量 | [commands/service-env.md](commands/service-env.md) |
| 7 | GitHub repo secrets/vars | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"GitHub 端配置" |
| 8 | 触发 + 部署链路通 | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"reconcile Step 8" |
| 9 | 公网域名可访问 | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"reconcile Step 9" |

**不允许跳步**——即便用户说"只改一下域名"也要从 Step 0 顺序跑下来，前面已经对的 Step 会快速 skip（check ✓ 跳过 act），但跑全才能保证整套是一致状态。

**Act 前一律先把 diff 摆给用户确认**——动 Coolify 上活资源前的硬纪律。

## 不做什么

- ✗ 非 tranfu-labs 仓库 / 非公司 Coolify 实例（硬编码假设，扩展前不要套用）
- ✗ 替用户安装 gh / jq / curl
- ✗ 自动建 Coolify project / 挂 GHCR registry credential / 建 GitHub environment——这些是 UI / 人工一次性配置，agent 不替做
- ✗ 替用户 git commit / push（git 操作由用户拍板）
- ✗ Coolify UI 上的点击（agent 全走 API）
- ✗ DELETE service / 清空 volume / 删 project（破坏性操作，专门 reference 处理）
- ✗ 多 Coolify 实例 / 多 server 调度（公司目前单实例单 server，硬编码进 [commands/prerequisites.md](commands/prerequisites.md)）

## 文件树

```
own-skills/tranfu-coolify-ops/
├── SKILL.md                              ← 本文件
├── assets/
│   ├── preflight.sh                      ← Step 0 一次性全部前置 (独立脚本)
│   └── deploy.yml.template               ← Step 2 GHA workflow 模板
├── scenarios/
│   └── reconcile-deployment.md           ← 唯一流程文档，9 步幂等
├── commands/                             ← 实际操作速查（curl 命令片段 + CLI ad-hoc）
│   ├── prerequisites.md                  ← Step 0 索引 (preflight.sh 的人话说明)
│   ├── service-crud.md                   ← Step 3-4 (HTTP API)
│   ├── service-env.md                    ← Step 6 (HTTP API)
│   ├── domain.md                         ← Step 5 (HTTP API)
│   ├── deploy-trigger.md                 ← Step 7-9 (HTTP API + GHA)
│   ├── tranfu-naming.md                  ← Step 0 命名约束
│   ├── app.md                            ← CLI ad-hoc 速查 (排障 / 临时操作)
│   ├── context.md                        ← CLI ad-hoc 速查
│   ├── conventions.md                    ← CLI ad-hoc 全局 flag 约定
│   ├── project.md                        ← CLI ad-hoc 速查
│   └── server.md                         ← CLI ad-hoc 速查
└── references/                           ← 心智模型 / 字段语义 / 排障
    ├── service-vs-application.md         ← Service 不是 Application
    ├── service-fqdn-trap.md              ← SERVICE_FQDN_* 是 output 不是 input
    ├── urls-vs-docker-compose-domains.md ← 改域名走 urls, 不是 domains
    ├── coolify-api-fields.md             ← openapi 字段速查
    ├── file-generation-rules.md          ← 四件套生成 / 校验规范
    ├── archived-coolify-deploy.md        ← 旧 coolify-deploy skill 归档说明
    ├── coolify-compose-deploy-failure-triage.md  ← Step 8 排障 (DEPRECATED-CLI)
    ├── coolify-docker-inspection.md      ← Step 9 容器证据采集 (DEPRECATED-CLI)
    ├── coolify-clear-deployments-and-redeploy.md ← 清部署历史 + 重 deploy (DEPRECATED-CLI)
    ├── coolify-disk-capacity-and-prune.md← 服务器磁盘运维 (DEPRECATED-CLI)
    ├── coolify-cli-1.6.2-onboard-quirks.md ← CLI 1.6.2 onboard 怪癖 (ad-hoc)
    └── coolify-env-redeploy.md           ← CLI 改 env + redeploy (ad-hoc)
```

## 完成判据（可观测）

reconcile 跑完后：

- [ ] Step 0-9 全 ✓
- [ ] `curl -I <public-fqdn>` 返 2xx / 3xx
- [ ] Coolify UI service status = running
- [ ] GHA 最近一次 deploy.yml run = success
- [ ] 仓库根四件套（Dockerfile / .dockerignore / compose.yml / deploy.yml）全在且合规

任一未达 → reconcile 中止在对应 Step，按该 Step 的失败文案给用户。

<example>
用户："把 tranfu-labs/markdown-kits-app 上 coolify"

正确做法：
1. 进 reconcile，create 9 项 TODO
2. Step 0: 跑 preflight.sh → 全部 ✓（工具 / git / 命名 / GitHub 凭据+权限 / Coolify token+活性+写权限 / GHCR ack）
3. Step 2: 仓库根 Dockerfile / compose.yml / .dockerignore / .github/workflows/deploy.yml 都没有 → 按 file-generation-rules.md 生成四件套，给用户预览，确认后写入
5. Step 3: GET /api/v1/services 没找到同名 → 让用户选 project → POST /api/v1/services 带 compose + urls + project/server/env → 拿 $SERVICE_UUID
6. Step 4: GET 拿到 docker_compose_raw = 刚 POST 的内容 → ✓ skip（自动同步）
7. Step 5: GET applications[0].fqdn = "https://markdown-kits-app.tranfu.com:8787" → ✓ skip（POST 时一并设了）
8. Step 6: 用户给 .env → POST /envs 把每条加进去
9. Step 7: gh secret list / variable list → 缺什么补什么，environment 不存在让用户去 settings 手工建
10. Step 8: 让用户 git push → 跟 GHA logs → ✓ deploy.yml success
11. Step 9: curl -I https://markdown-kits-app.tranfu.com → 200 ✓
12. 输出最终报告
</example>

<example>
用户："markdown-kits-app 部署挂了，帮我看下"

正确做法：
1. 进 reconcile，create 9 项 TODO
2. Step 0: preflight ✓ skip（环境没变）
3. Step 2: 四件套都在且合规 → ✓ skip
4. Step 3: Service 已存在，拿 $SERVICE_UUID → ✓ skip
5. Step 4: compose 一致 → ✓ skip
6. Step 5: fqdn 是期望的 tranfu.com → ✓ skip
7. Step 6: envs 都齐 → ✓ skip
8. Step 7: secrets / vars 都齐 → ✓ skip
9. Step 8: gh run list → 上一次 failed → gh run view --log-failed → 发现是 GHCR 401 → 让用户去 GitHub repo settings → Actions → 看 GHCR token 权限
10. 终止，告诉用户：卡在 Step 8，原因 GHCR auth，给用户处理路径
</example>

<bad-example>
错误：
(a) 用户说"改一下域名"，agent 只跑 Step 5 然后 return —— 应该跑完全 9 步
(b) Step 4 Compose 不一致时，直接 PATCH 不给用户看 diff —— 必须 act 前展示
(c) Step 7 让用户 `gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"`，agent 自己把 token 原文嵌进字符串 —— 必须保持 $VAR 让 shell 展开
(d) Coolify 上 service 已存在，但 compose 内容不对，agent 直接 DELETE 重建 —— 应该 PATCH 修 compose（partial update 是支持的）
(e) Step 9 公网 404，agent 自己重启容器、改 traefik 配置 —— 应该指向 references 排障，让用户处理或决定
(f) 用户的 .env 内容 echo 到对话里 —— 永不
</bad-example>
