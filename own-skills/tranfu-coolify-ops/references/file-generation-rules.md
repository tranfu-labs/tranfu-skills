# 仓库代码侧四件套生成 / 校验规范

> 术语见 SKILL.md ## 心智模型。

reconcile Step 2 用这份规范判断「仓库现状是否合规」，不合规时按下面规则生成 / 改造。**check 和 act 都引用这份文件**，避免规则散落。

四件套：
1. `Dockerfile`
2. `.dockerignore`
3. `compose.yml`
4. `.github/workflows/deploy.yml`

每件 MUST 完整覆盖写入; NEVER 输出 diff。

---

## §Dockerfile

### Check 规则

| # | 检查项 | 不合规处理 |
|---|---|---|
| D1 | 多阶段构建（至少 builder + runtime 两阶段） | 重写为多阶段 |
| D2 | runtime 自带能发本机 HTTP 的工具：busybox `wget`（alpine）/ python urllib（python 镜像）/ node fetch（node 镜像）/ `curl` | 缺则 `apt install curl` 或换 runtime 镜像 |
| D3 | 有 `HEALTHCHECK` 指令 + 端口与应用 listen 一致 | 加 HEALTHCHECK |
| D4 | `EXPOSE ${PORT}` 与应用 listen 一致 | 修正 |
| D5 | 无明文密码 / 密钥（grep `PASSWORD=` `TOKEN=` `KEY=` 等硬编码值） | 改走 compose `${SERVICE_PASSWORD_*}` |

### 生成原则（缺文件时）

- **多阶段**：builder 装依赖 + 跑构建命令；runtime 只拷构建产物，镜像小、不带工具链。
- **按运行时分流**：
  - 静态站点（dist/）→ 拷进轻量静态服务器（`nginx:alpine` 之类）
  - 长驻服务（Node/Python/Go）→ runtime 用对应 slim/alpine 镜像，`CMD` 启动
- **healthcheck 工具表**：

  | runtime | 自带工具 | healthcheck 命令片段 |
  |---|---|---|
  | alpine 系 | busybox `wget`（不识别 `no_proxy`，要直接 unset） | `HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= wget --spider -q http://127.0.0.1:${PORT}/healthz \|\| exit 1` |
  | python 系 | urllib（认 `NO_PROXY`） | `python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${PORT}/healthz', timeout=8).read()" \|\| exit 1` |
  | node 系 | node 自带 fetch | `node -e "fetch('http://127.0.0.1:${PORT}/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` |
  | runtime 啥都没 | 装 curl | `apt-get install -y --no-install-recommends curl` |

- **HEALTHCHECK 模板**（不写死时间，下面是默认值）：

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
    CMD <healthcheck 工具表里的命令> || exit 1
  ```

---

## §.dockerignore

### Check 规则

| # | 检查项 | 不合规处理 |
|---|---|---|
| I1 | 排除 `node_modules` | 加 |
| I2 | 排除 `.git` | 加 |
| I3 | 排除常见构建缓存目录（`dist/` `build/` `.next/` `target/` `__pycache__` `.cache/`） | 视项目类型加 |
| I4 | 排除本地 env 文件（`.env` `.env.local` `*.env.local`） | 必加（防泄密） |

### 生成原则（缺文件时）

按项目类型组合：

- **永远加**：`node_modules`、`.git`、`.env*`、`*.log`、`.DS_Store`、`Dockerfile`、`.dockerignore`、`docker-compose*.yml`、`README.md`
- **Node**：`coverage/`、`.next/`、`dist/`、`build/`
- **Python**：`__pycache__/`、`*.pyc`、`.venv/`、`venv/`、`.pytest_cache/`
- **Go**：`vendor/`、`*.test`
- **Rust**：`target/`

---

## §compose.yml

### Check 规则（11 条，每条对应一个可核对的产物特征）

| # | 规则 | 不合规处理 |
|---|---|---|
| C1 | Web 服务**没有** `ports:` 字段映射宿主机端口 | 删 `ports:` |
| C2 | 容器内部监听端口保留（应用听 4325 仍听 4325，只是不映射宿主） | 不动 listen |
| C3 | 反代 Web 服务用 `expose:` 而非 `ports:` | 改 |
| C4 | 内部服务（db / redis / worker）既无 `ports:` 也无 `expose` | 删 |
| C5 | 不自定义复杂 networks（除非应用确实依赖） | 删自定义 networks，让 Coolify 自动管 |
| C6 | volumes 显式写 `name:`（避免 Coolify 自动套 UUID 前缀难找难删） | 加 `name:` |
| C7 | `environment.PORT` 与监听端口一致 | 修正 |
| C8 | 数据库连接串用 compose service name（不用 localhost / 宿主机 IP） | 改 |
| C9 | 数据库密码用 `${SERVICE_PASSWORD_<NAME>}` 魔法变量（不手填、不让部署者界面填） | 改 |
| C10 | 镜像段只写 image:, **MUST NEVER 出现 build: 段** | 删 `build:`，改 `image: ghcr.io/<org>/<repo>:<tag>` |
| C11 | healthcheck 防代理（wget 系清环境变量；python urllib 走 NO_PROXY=127.0.0.1） | 修写法 |

### 额外约束（reconcile-specific）

- 每个对外 service 在 `environment:` 段写 `SERVICE_FQDN_<UPPERCASE_NAME>_<PORT>: ''`（空值即可）——这是声明"这个 service 要对外、内部端口 X"。详见 [service-fqdn-trap.md](service-fqdn-trap.md)。**值永远写 `''`，不要写真域名**（写了也无效）。
- 多服务时所有 service 名必须能映射成合法 env 变量名（破折号在 SERVICE_FQDN 里要转下划线大写：`markdown-kits-app` → `MARKDOWN_KITS_APP`）

### 域名 / 端口的归位

- compose 里**不写真域名**——`SERVICE_FQDN_*` 给 `''`
- 真域名走 `PATCH /api/v1/services/{uuid}` 的 `urls` 字段（reconcile Step 5）
- 域名形式 `https://<svc>.tranfu.com:<container-port>` —— `:port` 是容器内部端口，公网仍走 443

---

## §.github/workflows/deploy.yml

### Check 规则

| # | 检查项 | 不合规处理 |
|---|---|---|
| W1 | 文件存在且和 [`../assets/deploy.yml.template`](../assets/deploy.yml.template) 结构同构 | 重新拷模板 |
| W2 | 所有 `{{...}}` 占位符已替换（除 `${{ github.* }}` / `${{ vars.* }}` / `${{ secrets.* }}` / `${{ env.* }}`）| 替换 |
| W3 | `permissions: packages: write` 在 | 加 |
| W4 | 登录 GHCR 用 `secrets.GITHUB_TOKEN`（不是手填 PAT）| 改 |
| W5 | curl 触发 Coolify 只用 `--fail-with-body`（不和 `-f` 同时出现，curl 8.x 互斥）| 改 |
| W6 | 三个 var 引用全部走 `${{ vars.* }}` 而不是 inline UUID | 改 |
| W7 | `jobs.*.environment: ${{ github.ref_name }}` 保留 | 不允许删除 |
| W8 | `on.push.branches:` 是纵向 yaml list（每分支一行），不是 inline `[main]` | 改纵向 |

### 占位符替换表

| 占位符 | 含义 | 处理 |
|---|---|---|
| `{{DEFAULT_BRANCH}}` | 仓库默认分支 | `git symbolic-ref --short refs/remotes/origin/HEAD` 拿；拿不到 fallback `main` |
| `{{TESTS_STEP}}` | 测试卡口 step | 见下面"测试探测 + 拼装规则"；未探测到 → 整段连同前后空行一起删，不留占位 |

### 测试探测 + 拼装规则

| 探测命中 | 加什么 step |
|---|---|
| `package.json` `scripts.test`（排除默认 `echo "Error: no test specified" && exit 1`）| `actions/setup-node` + `npm ci` + `npm test`，cache=`npm`, cache-dependency-path 指向真正 lockfile |
| `pyproject.toml` / `setup.cfg` / `pytest.ini` / `tests/` | `actions/setup-python` + `pip install -r <requirements>` + `python -m pytest tests/ -q` |
| `Makefile` 有 `test` target | `make test` |
| `go.mod` | `go test ./...` |
| `Cargo.toml` | `cargo test` |
| 多种命中 | 全部并列 |
| 都没命中 | **不加 step，不生成假 `echo "no tests"`** |

**MUST 把 build step 排在 test step 之前**, 当满足:【grep 找到 package.json 中独立 build 脚本】且【test 脚本引用 dist/ 或类似构建产物路径】(典型：monorepo 子包跨包 import 编译出的 `dist`)。

### 多环境扩展规则

只在以下两种情况下额外生成默认分支以外的部署链路：

1. 用户**明确说**要 dev / staging
2. 当前 git checkout 就在 `dev` 分支上

不满足任一条件 → MUST 只配默认分支, NEVER 主动询问用户。

扩展时机械执行两步：
1. 在 yml 的 `on.push.branches:` list 下加一行
2. 提示用户去 GitHub Settings → Environments 建**同名** environment，配齐三个 vars（`COOLIFY_APP_UUID` / `IMAGE_TAG_ROLLING` / `IMAGE_TAG_SHA_PREFIX`）

**禁止**（识别到这些旧形态就拒绝套用）：
- 复制 job 为 `build-and-publish-dev`
- 加 `if: github.ref == ...` 条件
- 给变量加 `_PROD` / `_DEV` 后缀
- 把 UUID 写进 yml

### 端口六处一致性

`PORT` 在以下六处必须一致：

1. Dockerfile `EXPOSE`
2. 应用 listen
3. compose `expose:`
4. compose `environment.PORT`
5. Dockerfile `HEALTHCHECK` 探测端口
6. compose `healthcheck:` 探测端口

任一不一致 → Traefik 转发到没人监听的端口 / healthcheck 探错 → unhealthy / 502。

---

## §原理与排障（被改造方决定不照搬时引用）

- **healthcheck 恒败 → 域名打不开**：部署机给容器注入 `HTTP_PROXY` 等代理变量，wget 访问 `127.0.0.1` 被劫持到代理 → 代理连不上 → healthcheck 失败 → unhealthy → Traefik 拒绝路由 → 公网域名打不开。**只在 healthcheck 命令这一层清代理**，不要删容器全局代理变量（应用对外请求可能依赖代理）。

- **`NO_PROXY=127.0.0.1` 是否管用看工具**：busybox wget（alpine）不识别 `no_proxy`，必须直接清空 `http_proxy` 系列；python urllib / curl / node fetch 通常认 `NO_PROXY`。runtime 自带哪种工具，healthcheck 就用哪种写法。

- **端口六处必须一致**：见上。

- **魔法变量密码为何一致**：Coolify 首次部署自动生成 `SERVICE_PASSWORD_*` 并永久持久化，之后重部署值不变；栈内引用同一变量必同值，杜绝"应用和数据库密码对不上"。

- **PostgreSQL 密码只在首次初始化生效**：官方镜像只在数据目录为空时采用 `POSTGRES_PASSWORD`，之后改环境变量不改库内真实密码。密码必须首次部署前定下来、生命周期与数据卷绑定；MySQL/MariaDB 的 root 密码同理。

- **命名卷的代价**：固定卷名放弃多环境隔离（单实例生产无妨）；在 Coolify 删资源再重建 ≠ 重置，新部署会原样挂回同名旧卷。真正重置 = 删 Coolify 资源 + 上服务器 `docker volume rm <appname>-*`，两步缺一不可。删资源前必须先导出备份所有环境变量。

- **手动设密码时**：用 `openssl rand -hex 32` 生成纯十六进制，严禁含 `$` / `#` 等特殊字符——会被 compose 变量插值吞掉。

- **`curl -f --fail-with-body` 双开必炸**：curl 8.x 把这两个选项标记互斥，CI 直接 `exit 2`。只保留 `--fail-with-body`。这条对所有 GHA 里用 curl 通知 webhook 的步骤通用。

- **Coolify deploy API 返回 200 但应用没动**：通常镜像没真换 digest（tag 同名但内容相同），Coolify 视作"已是最新"跳过。要么改 tag（加 sha 后缀），要么 `force=true`——但 `force=true` 强制重启，副作用大，少用。

- **GHCR 401 / not found**：Coolify 没挂 registry credential，或 GHCR 包默认 private 而 token 没 `read:packages`。把 GHCR 包改 public 是最简单的解，公司项目则在 Coolify 里挂 credential。

- **GHCR 镜像名带大写跑不动**：`${{ github.repository }}` 原样保留仓库名大小写，但 GHCR 强制全小写。仓库名含大写时要在 workflow 里手动 `tr '[:upper:]' '[:lower:]'`，或干脆把仓库名改成全小写。
