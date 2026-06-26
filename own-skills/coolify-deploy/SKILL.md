---
name: coolify-deploy
description: 把一个项目从源码引导到可在 Coolify / Traefik 反向代理下部署——按需生成 Dockerfile、.dockerignore、compose.yml、.github/workflows/deploy.yml 并套用 Coolify 部署规范。触发于用户要"把项目部署/上线到 Coolify""让项目能在 Coolify 跑""给项目加 Docker 上 Coolify""把这个 compose 改成 Coolify 能用"，尤其当项目还没有任何 Docker / CI 文件、只有自己的构建命令时。不要用于与 Coolify 无关的通用 Dockerfile/compose 编写、Kubernetes/Helm/裸 docker run 部署，也不要用于 Coolify 界面上删资源/删卷/导环境变量等纯运维操作。
version: 0.3.1
author: aquarius-wing
updated_at: 2026-06-26
origin: own
---

# 把项目部署到 Coolify

引导一个**还没碰过 Docker 的项目**从源码走到 Coolify 可部署：按需生成 Dockerfile、`.dockerignore`、`compose.yml`、`.github/workflows/deploy.yml` 四件套，并套用 Coolify / Traefik 部署规范，让公网域名一次打得开。已有相关文件时只补缺失的、改造已有的。

**部署链路只支持一种**：GitHub Actions 跑测试 → 构建镜像 → 推 GHCR → 调 Coolify deploy API 拉新镜像。Coolify 应用类型选 "Docker Image"，**不**走 webhook、**不**让 Coolify 主机自建镜像，compose 里**不**写 `build:`。

核心心智：**用户往往只关心自己的构建（`npm run build` 之类），不关心 Docker / CI。** 你负责把"构建"翻译成镜像产物 + CI workflow，端口、密码、healthcheck、镜像推送、Coolify 触发这些坑替用户兜住。

## 何时触发

- 用户要"把项目部署/上线到 Coolify""让项目在 Coolify 跑起来""给项目加 Docker 上 Coolify"，且项目可能没有任何 Docker / CI 文件。
- 用户已有部分文件（如 `compose.yml`），要"改成适合 Coolify 部署"或"补上 CI 自动推 GHCR"。
- 用户在 Coolify 部署后遇到"域名打不开""容器一直 unhealthy""应用和数据库密码对不上""GHCR 拉不到镜像"。

## 何时不要触发

- 与 Coolify 无关的通用 Dockerfile / compose 编写或优化。
- Kubernetes、Helm、裸 `docker run` 或其他编排平台的部署。
- Coolify 界面上删资源、删卷、导环境变量等纯运维动作（本 skill 只产出文件，不替用户操作服务器）。
- 已 onboard 的 tranfu Coolify 实例上的运维操作（onboard / redeploy / 校验走 `tranfu-coolify-ops`）。

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO，逐步打勾，避免漏步或漏文件）。

1. **探测现状**：
   - 项目里有没有 `Dockerfile`、`compose.yml` / `docker-compose.yml`、`.dockerignore`、`.github/workflows/*.yml`
   - 仓库默认分支：`git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@'`，拿不到就 fallback 用 `main`
   - 当前 checkout 分支：`git branch --show-current`（用于决定是否要顺便生成 dev 链路，见 workflow 章节）

2. **识别构建方式**（缺信息就问用户，NEVER 瞎猜）：
   - 构建命令（如 `npm run build` / `pnpm build` / `pip install` / 无需构建）
   - 产物形态：静态站点（dist/）/ 长驻服务（Node/Python/Go 等）/ 其他
   - 运行时监听的端口（应用 listen 的端口）
   - 运行时类型与基础镜像倾向

3. **识别测试卡口**：扫这些位置决定 workflow 里要不要加 test step。命中 → 加；都没命中 → 不加、不卡口、**不生成假测试**（如 `echo "no tests"`）。
   - `package.json` 的 `scripts.test`（排除默认 `echo "Error: no test specified" && exit 1`）
   - `pyproject.toml` / `setup.cfg` / `pytest.ini` 含 pytest 配置 或仓库根有 `tests/` 目录
   - `Makefile` 有 `test` target
   - `go.mod` 存在 → 默认 `go test ./...`
   - `Cargo.toml` 存在 → 默认 `cargo test`
   - 同时命中多种（如本仓库 pytest + npm 都装）→ 全部并列

4. **无 `.dockerignore` → 生成**：至少排除 `node_modules`、`.git`、构建缓存、本地 env 文件，否则构建上下文巨大、可能泄露密钥。

5. **无 `Dockerfile` → 生成**：按"Dockerfile 生成规范"产出多阶段 Dockerfile，含 `HEALTHCHECK` 指令。已有则核对端口、HEALTHCHECK、healthcheck 工具的前置条件。

6. **compose 处理**：
   - 无 `compose.yml` → 生成，并套用下方"compose 部署规范"全部规则。
   - 有 `compose.yml` → 直接套用"compose 部署规范"改造。
   - 镜像段一律 `image: ghcr.io/<org>/<repo>:<tag>`，**禁止 `build:`**。

7. **生成 / 改造 `.github/workflows/deploy.yml`**：拷 `assets/deploy.yml.template` 到 `.github/workflows/deploy.yml`，按下方"workflow 模板与占位符"替换。是否额外生成 dev 链路看下方"dev 链路触发规则"。

8. **端口六处一致性校验**：`PORT` 必须在「Dockerfile `EXPOSE` / 应用 listen / compose `expose` / `environment.PORT` / Dockerfile `HEALTHCHECK` / compose `healthcheck`」六处一致；不一致是 unhealthy 与反代失败的头号原因。

9. **输出全部完整文件**（不输出 diff）+ 简短说明：移除了哪些 `ports:`、哪个 service 配 Domain、内部端口多少、**用户要去 Coolify UI 做哪些一次性配置**（见 workflow 章节末尾）。Domain 写成 `https://example.com:4325` 形式——`:4325` 是容器内部端口，公网仍走 HTTPS 443。

## Dockerfile 生成规范

- **多阶段构建**：builder 阶段装依赖 + 跑构建命令，runtime 阶段只拷构建产物，镜像小、不带构建工具链。
- **runtime 必须自带能发本机 HTTP 的工具**（healthcheck 要用）：
  - alpine 系 → busybox `wget`（注意 busybox wget 不认 `no_proxy`，见排障）
  - python 系 → `python -c "import urllib.request; urllib.request.urlopen(...)"`，python urllib 默认会读 `HTTP_PROXY` 但识别 `NO_PROXY=127.0.0.1`
  - node 系 → node 自带 `fetch`（`node -e "fetch(...).then(...)"`）或 `apt install curl`
  - 若 runtime 既无 wget/curl 又无脚本运行时，healthcheck 命令直接 not found，容器永远 unhealthy
- **镜像层兜底加 `HEALTHCHECK` 指令**：让 `docker ps` 与 Coolify（沿用 image 元数据时）能感知容器就绪状态。compose 层的 healthcheck 仍可覆盖，两层互补：

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8788/healthz', timeout=8).read()" || exit 1
  ```

- **监听端口由 `PORT` 驱动**，`EXPOSE ${PORT}` 与应用实际 listen 一致，不写死成与 compose 不同的值。
- **不在 Dockerfile 写死密码或密钥**：走 compose 的 `${SERVICE_PASSWORD_*}` 与 environment。
- **按运行时分流**：
  - 静态站点（dist/）→ 拷进轻量静态服务器（如 `nginx:alpine` 或同类），监听内部端口。
  - 长驻服务（Node/Python/Go）→ runtime 用对应 slim/alpine 镜像，`CMD` 启动，`EXPOSE` 监听端口。

## compose 部署规范

无论新建还是改造，compose 必须满足以下 11 条（每条对应一个可核对的产物特征）：

1. **Web 服务不暴露宿主机端口**：删掉 `ports: ["4325:4325"]` 这类写法。
2. **保留容器内部监听端口**：应用听 `4325` 就继续听 `4325`，只是不映射宿主机。
3. **需要被反代的 Web 服务用 `expose`**：

   ```yaml
   expose:
     - "4325"
   ```

   不要用 `ports:`。
4. **内部服务（数据库 / Redis / worker）既不写 `ports:` 也不 `expose` 对外**，只允许同 stack 内用 service name 访问，如 `postgres:5432`、`redis:6379`。
5. **不自定义复杂 networks**，除非确实依赖。优先用 Coolify 自动创建的 compose 网络，避免 Traefik 选错网络。
6. **保留/正确声明 volumes**：数据库文件、SQLite、上传文件、持久化目录挂载路径不能错。持久化命名卷显式写 `name:`（如 `name: myapp-pg-data`），否则 Coolify 会套上资源 UUID 前缀，难找难删。
7. **整理端口环境变量**，如 `environment: { PORT: 4325 }`，与第 2 条监听端口一致。
8. **数据库连接串用 compose 内部服务名**：`DATABASE_URL=postgres://user:password@postgres:5432/dbname`，不用 `localhost` 或宿主机 IP。
9. **数据库密码一律用 Coolify 魔法变量**，不手填、不让部署者界面填：

   ```yaml
   postgres:
     environment:
       - POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
   app:
     environment:
       - DATABASE_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
   ```

10. **镜像段只写 `image:`，禁止 `build:`**：

    ```yaml
    app:
      image: ghcr.io/<org>/<repo>:latest   # 与 deploy.yml 推的滚动 tag 完全一致
    ```

    Coolify 应用配置里的 image 也填这个值，两边同步。

11. **healthcheck 访问 `127.0.0.1` 时必须防代理劫持**。具体写法看 runtime 工具：

    - busybox `wget`（alpine）—— 不认 `no_proxy`，必须直接置空：

      ```yaml
      healthcheck:
        test: ["CMD-SHELL", "HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= wget --spider -q http://127.0.0.1:${PORT:-4173}/healthz || exit 1"]
        interval: 30s
        timeout: 5s
      ```

    - python `urllib`（python 镜像）—— 走 `urlopen`，靠 `NO_PROXY=127.0.0.1` 兜代理；环境里没强制代理时直接用，不必清：

      ```yaml
      healthcheck:
        test:
          - CMD
          - python
          - -c
          - "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8788/healthz', timeout=8).read()"
        interval: 30s
        timeout: 10s
        retries: 5
        start_period: 10s
      ```

12. **输出完整 `compose.yml`，不要只输出 diff。**

## workflow 模板与占位符

模板：`assets/deploy.yml.template`（默认 prod 链路：`{{DEFAULT_BRANCH}}` 推到 `:latest` + prod UUID）。

拷到 `.github/workflows/deploy.yml` 后替换以下占位符：

| 占位符 | 含义 | 处理方式 |
|---|---|---|
| `{{DEFAULT_BRANCH}}` | 仓库默认分支 | 工作流第 1 步探测，通常 `main` 或 `master`；探不到就 `main` |
| `{{COOLIFY_APP_UUID}}` | Coolify 里 prod 应用的 UUID | 形如 `rsg5x2xurne2r2lddjfa0dro`。用户**首次部署前还拿不到**，留占位 `REPLACE_ME_AFTER_COOLIFY_SETUP` 并在输出说明里点明 |
| `{{TESTS_STEP}}` | 测试卡口 step | 见下面拼装规则；没命中 → 整行连同前后空行一起删 |

`{{TESTS_STEP}}` 拼装规则（命中几种就并列装几种）：

- 命中 Python：

  ```yaml
        - uses: actions/setup-python@v5
          with:
            python-version: "3.11"
            cache: pip
        - name: 装 Python 依赖
          run: pip install -r <requirements_path>
        - name: 跑 Python 测试
          run: python -m pytest tests/ -q
  ```

- 命中 Node（注意 `cache-dependency-path` 指向真正的 lockfile）：

  ```yaml
        - uses: actions/setup-node@v4
          with:
            node-version: "20"
            cache: npm
            cache-dependency-path: <path/to/package-lock.json>
        - name: 装 Node 依赖
          run: npm ci --prefix <dir>
        - name: 跑 Node 测试
          run: npm --prefix <dir> test
  ```

- 命中 Makefile：`make test`
- 命中 Go：`go test ./...`
- 命中 Rust：`cargo test`

**特别情况**：测试依赖前端构建产物（如 pytest 用例要访问 `frontend/dist`），就把 `npm run build` 作为前置 step 加进去；本仓库 `tranfu-agents-app` 就是这种模式。

### dev 链路触发规则

只在以下两种情况下额外生成 dev 链路（在同一个 workflow 里**追加** job 或多写一段触发分支，**不要替换** prod 链路）：

1. 用户**明确说**要 dev 环境 / dev 链路 / "也帮我配 dev"。
2. 当前 git checkout 就在 `dev` 分支上（执行 skill 时的工作分支，说明项目本来就是 main+dev 双环境）。

不满足任一条件 → 沉默，只产 prod 链路，**不主动问**。

dev 链路改 prod 链路四处即可：

| 参数 | prod | dev |
|---|---|---|
| 触发分支 | `{{DEFAULT_BRANCH}}` | `dev` |
| 滚动 tag | `:latest` | `:dev` |
| 溯源 tag | `:${{ github.sha }}` | `:dev-${{ github.sha }}` |
| `COOLIFY_APP_UUID` | prod 应用 UUID | dev 应用 UUID（需用户提供） |

简单做法：在同一个 yml 里复制 `build-and-publish` job 改名为 `build-and-publish-dev`，把上面四处全改成 dev 版；触发条件用 `if: github.ref == 'refs/heads/dev'`、prod job 加 `if: github.ref == 'refs/heads/{{DEFAULT_BRANCH}}'`，两个 job 不会冲突。

### Coolify 端一次性配置（必须告知用户）

输出文件后，提醒用户在 Coolify UI 完成（skill 不替用户做）：

1. 应用类型选 **Docker Image**（不是 Docker Compose / Public Repo），填镜像名（如 `ghcr.io/<org>/<repo>:latest`）。
2. 私有镜像在 Coolify 里挂 GHCR registry credential（用户名 = GitHub 账号；密码 = 有 `read:packages` 的 PAT 或细粒度 token）；公开镜像可跳过。
3. 应用 settings 里**关掉 "Auto Deploy on Push / Webhook"** —— 触发权归 workflow。
4. 记下应用 UUID，回填到 `.github/workflows/deploy.yml` 的 `{{COOLIFY_APP_UUID}}` 占位处。
5. Coolify Keys & Tokens 生成一个 deploy 权限的 API token；GitHub 仓库 Settings → Secrets and variables → Actions 里配：
   - `COOLIFY_API_TOKEN` = 上一步的 token
   - `COOLIFY_BASE_URL` = Coolify 实例地址（如 `http://120.77.223.183:8000`）

## 原理与排障

被改造方决定不照搬时，引用以下原理，而不是临场编：

- **healthcheck 恒败 → 域名打不开**：部署服务器会给容器注入 `HTTP_PROXY` 等代理变量，wget 访问本机被劫持到代理，代理连不上容器内 `127.0.0.1`，healthcheck 永远失败 → 容器 unhealthy → Traefik 拒绝路由 → 公网域名打不开。只在 healthcheck 命令这一层清代理，不要删容器全局代理变量（应用对外请求可能依赖代理）。
- **`NO_PROXY=127.0.0.1` 是否管用看工具**：Alpine 的 busybox wget 不识别 `no_proxy`，必须直接清空 `http_proxy` 系列；python urllib、curl、node fetch 通常认 `NO_PROXY`。runtime 自带哪种工具，healthcheck 就用哪种写法。
- **端口六处必须一致**：Dockerfile `EXPOSE`、应用 listen、compose `expose`、`environment.PORT`、Dockerfile `HEALTHCHECK`、compose `healthcheck` 任一不一致 → Traefik 转发到没人监听的端口，或 healthcheck 探错端口，表现为 unhealthy / 502。
- **魔法变量密码为何一致**：Coolify 首次部署自动生成 `SERVICE_PASSWORD_*` 并永久持久化，之后重部署值不变；栈内引用同一变量值必然相同，杜绝"应用和数据库密码对不上"。
- **PostgreSQL 密码只在首次初始化生效**：官方镜像只在数据目录为空时采用 `POSTGRES_PASSWORD`，之后改环境变量不改库内真实密码。密码必须首次部署前定下来、生命周期与数据卷绑定；MySQL/MariaDB 的 root 密码同理。
- **命名卷的代价**：固定卷名放弃多环境隔离（单实例生产无妨）；在 Coolify 删资源再重建 ≠ 重置，新部署会原样挂回同名旧卷，旧密码旧数据复活。真正重置 = 删 Coolify 资源 + 上服务器 `docker volume ls | grep <appname>` 找出来 `docker volume rm`，两步缺一不可。删资源前必须先导出备份全部环境变量（`JWT_SECRET` 这类丢了会废掉所有登录态）。
- **手动设密码时**：用 `openssl rand -hex 32` 生成纯十六进制，严禁含 `$`、`#` 等特殊字符——会被 compose 变量插值吞掉，造成"密码设对了却认证失败"的假象。
- **`curl -f --fail-with-body` 双开必炸**：curl 8.x 把这两个选项标记为互斥，CI 上直接 `exit 2`，看不到一次实际请求。只保留 `--fail-with-body`。这条规律对所有 GHA 里用 curl 通知部署/Webhook 的步骤通用，不仅是 Coolify。
- **Coolify deploy API 返回 200 但应用没动**：通常是镜像没真的换 digest（tag 同名但内容相同），Coolify 视作"已是最新"跳过。要么改 tag（加 sha 后缀），要么 `force=true`——但 `force=true` 会强制重启，副作用更大，少用。
- **GHCR 拉镜像 401 / not found**：Coolify 没挂 registry credential，或 GHCR 包默认 private 而 token 没 `read:packages`。把 GHCR 包改 public 是最简单的解，公司项目则在 Coolify 里挂 credential。
- **GHCR 镜像名带大写跑不动**：`${{ github.repository }}` 原样保留仓库名大小写，但 GHCR 强制全小写。仓库名含大写时要在 workflow 里手动 `tr '[:upper:]' '[:lower:]'`，或干脆把仓库名改成全小写。

## 验收清单

**核心文件**：

- [ ] 若新建 Dockerfile：多阶段构建、runtime 自带能发本机 HTTP 的工具（wget / curl / python urllib / node fetch 任一）、`EXPOSE` = 应用监听端口、含 `HEALTHCHECK` 指令兜底
- [ ] 若新建 `.dockerignore`：排除了 node_modules / .git / 本地 env
- [ ] 没有任何 Web 服务写 `ports:` 映射宿主机端口
- [ ] 需要反代的 Web 服务有 `expose:` 且端口 = 应用监听端口
- [ ] 数据库 / Redis / worker 既无 `ports:` 也无对外 `expose`
- [ ] 持久化命名卷显式写了 `name:`
- [ ] 数据库连接串用 service name，不用 localhost / 宿主机 IP
- [ ] 数据库密码用 `${SERVICE_PASSWORD_*}`，应用与数据库引用同一变量
- [ ] compose 镜像段写的是 `image: ghcr.io/...:tag`，**不出现 `build:`**
- [ ] healthcheck 工具与代理处理与 runtime 匹配（wget 系清代理；python urllib 走 NO_PROXY=127.0.0.1）
- [ ] `PORT` 在 Dockerfile EXPOSE / 应用 listen / compose expose / environment / Dockerfile HEALTHCHECK / compose healthcheck 六处一致

**deploy.yml 三件套**：

- [ ] `.github/workflows/deploy.yml` 含「前置 secret 检查 → 测试卡口（项目有测试时）→ buildx 推 GHCR → curl Coolify deploy API」四段顺序
- [ ] workflow 同时打了滚动 tag（如 `:latest` / `:dev`）和溯源 tag（如 `:${{ github.sha }}` / `:dev-${{ github.sha }}`）
- [ ] `permissions:` 给了 `packages: write`，登录 GHCR 用的是 `secrets.GITHUB_TOKEN`，不是手填 PAT
- [ ] 通知 Coolify 的 curl **只用 `--fail-with-body`，不和 `-f` 同时出现**
- [ ] `COOLIFY_APP_UUID` 明文写在 workflow env，`COOLIFY_API_TOKEN` 与 `COOLIFY_BASE_URL` 走 secret
- [ ] compose `image:` tag 与 workflow 推送的滚动 tag 完全一致
- [ ] 模板里所有 `{{...}}` 占位符已全部替换（`grep '{{' .github/workflows/deploy.yml` 应该 0 命中，除非是 `${{ github.* }}` 这种 GHA 表达式）
- [ ] dev 链路只在用户明确要 / 当前分支是 dev 时出现；其他情况只产 prod 链路

**输出说明**：

- [ ] 输出的是完整文件，不是 diff
- [ ] 附了端口/Domain 说明，Domain 为 `https://host:内部端口` 形式
- [ ] 告知用户 Coolify UI 端一次性配置：应用类型 Docker Image、关 Auto Deploy on Push、私有镜像挂 registry credential、回填 UUID、配 GitHub `COOLIFY_API_TOKEN` / `COOLIFY_BASE_URL` secret

## 失败路径

- 用户没说构建命令、产物目录或监听端口，且项目里看不出来：先问，不要凭框架默认值瞎填；问不到就把该处写成 `unknown / 需用户确认`。
- 项目类型无法判定（既非静态站也非已知长驻服务）：让用户描述启动命令与监听端口，再决定 runtime 镜像。
- 原 compose 用了自定义 networks 且应用确实依赖：保留它，并在说明里点出"这会让 Traefik 可能选错网络，确认无误后再部署"。
- 用户的仓库默认分支既不是 main 也不是 master（如 `trunk`、`prod`）：按实际默认分支替换 `{{DEFAULT_BRANCH}}`，不要硬改成 main。
- 项目没探测到任何测试：`{{TESTS_STEP}}` 整段去掉，**不要**生成 `echo "no tests"` 占位 step——在输出说明里点一句"未探测到测试，已跳过卡口；建议补 smoke test"提醒用户。

<example>
用户："我这是个 Vite 前端 + Express 后端的单仓库，前端 npm run build 出 dist 给 Express 静态托管，想部署到 Coolify。"

正确做法：
1. 探测：无 Dockerfile / compose / .dockerignore / deploy.yml；默认分支 main；当前 checkout 也在 main → 不产 dev 链路。
2. 识别：构建命令 `npm run build`（前端），运行 `node server/index.js`（长驻 Express），listen 3000。
3. 测试探测：package.json 有 `"test": "vitest run"` → `{{TESTS_STEP}}` 装 setup-node + npm ci + npm test。
4. 生成 .dockerignore（排除 node_modules、.git、dist）。
5. 生成多阶段 Dockerfile：node:20-slim builder 跑 npm ci + npm run build → node:20-slim runtime 拷 dist + server，EXPOSE 3000，HEALTHCHECK 用 `node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`。
6. 生成 compose.yml：app 服务 `image: ghcr.io/<user>/<repo>:latest`、expose 3000、healthcheck 与 Dockerfile 等价、无 ports、无 db。
7. 拷 `assets/deploy.yml.template` → `.github/workflows/deploy.yml`，替换 `{{DEFAULT_BRANCH}}=main`、`{{COOLIFY_APP_UUID}}=REPLACE_ME_AFTER_COOLIFY_SETUP`、`{{TESTS_STEP}}=` 那段 Node test。
8. 校验端口六处一致（3000 全场）。
9. 输出四个完整文件 + 说明："给 app 配 Domain https://example.com:3000；去 Coolify 建 Docker Image 应用、关 Auto Deploy、记 UUID 回填到 deploy.yml；GitHub 仓库 Settings 里配 COOLIFY_API_TOKEN / COOLIFY_BASE_URL。"
</example>

<bad-example>
错误："直接 docker run -p 3000:3000 跑起来就行" / 在 compose 里写 `build: .` 让 Coolify 自己 build / 在 Dockerfile 里 `RUN echo PASSWORD=123` / 项目没测试时硬塞一个 `echo "no tests"` step。

为什么错：(1) Coolify 由 Traefik 经 compose 网络反代，Web 服务不该暴露宿主机端口，也不该用裸 docker run；(2) 本 skill 只支持 GHCR 镜像模式，compose 必须 `image:`，构建走 GHA 不走 Coolify；(3) 密码写进 Dockerfile 会进镜像层、不可轮换，必须走 compose 的 `${SERVICE_PASSWORD_*}`；(4) 假测试 step 没意义还掩盖了"该补测试"的信号，不如直接不加。
</bad-example>
