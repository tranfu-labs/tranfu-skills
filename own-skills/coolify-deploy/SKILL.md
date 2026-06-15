---
name: coolify-deploy
description: 把一个项目从源码引导到可在 Coolify / Traefik 反向代理下部署——按需生成 Dockerfile、.dockerignore、compose.yml 并套用 Coolify 部署规范。触发于用户要"把项目部署/上线到 Coolify""让项目能在 Coolify 跑""给项目加 Docker 上 Coolify""把这个 compose 改成 Coolify 能用"，尤其当项目还没有任何 Docker 文件、只有自己的构建命令时。不要用于与 Coolify 无关的通用 Dockerfile/compose 编写、Kubernetes/Helm/裸 docker run 部署，也不要用于 Coolify 界面上删资源/删卷/导环境变量等纯运维操作。
version: 0.1.0
author: aquarius-wing
updated_at: 2026-06-15
origin: own
---

# 把项目部署到 Coolify

引导一个**还没碰过 Docker 的项目**从源码走到 Coolify 可部署：按需生成 Dockerfile、`.dockerignore`、`compose.yml`，并套用 Coolify / Traefik 部署规范，让公网域名一次打得开。已有 Docker 文件时只补缺失的、改造已有的。

核心心智：**用户往往只关心自己的构建（`npm run build` 之类），不关心 Docker。** 你负责把"构建"翻译成可部署的容器产物，端口、密码、healthcheck 这些坑替用户兜住。

## 何时触发

- 用户要"把项目部署/上线到 Coolify""让项目在 Coolify 跑起来""给项目加 Docker 上 Coolify"，且项目可能没有任何 Docker 文件。
- 用户已有 `compose.yml`，要"改成适合 Coolify 部署"。
- 用户在 Coolify 部署后遇到"域名打不开""容器一直 unhealthy""应用和数据库密码对不上"。

## 何时不要触发

- 与 Coolify 无关的通用 Dockerfile / compose 编写或优化。
- Kubernetes、Helm、裸 `docker run` 或其他编排平台的部署。
- Coolify 界面上删资源、删卷、导环境变量等纯运维动作（本 skill 只产出文件，不替用户操作服务器）。

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO，逐步打勾，避免漏步或漏文件）。

1. **探测现状**：项目里有没有 `Dockerfile`、`compose.yml` / `docker-compose.yml`、`.dockerignore`。决定后续哪些要新建、哪些要改造。
2. **识别构建方式**（缺信息就问用户，NEVER 瞎猜）：
   - 构建命令（如 `npm run build` / `pnpm build` / `pip install` / 无需构建）
   - 产物形态：静态站点（dist/）/ 长驻服务（Node/Python/Go 等）/ 其他
   - 运行时监听的端口（应用 listen 的端口）
   - 运行时类型与基础镜像倾向
3. **无 `.dockerignore` → 生成**：至少排除 `node_modules`、`.git`、构建缓存、本地 env 文件，否则构建上下文巨大、可能泄露密钥。
4. **无 `Dockerfile` → 生成**：按"Dockerfile 生成规范"产出多阶段 Dockerfile。已有则核对端口与 healthcheck 前置条件。
5. **compose 处理**：
   - 无 `compose.yml` → 生成，并套用下方"compose 部署规范"全部规则。
   - 有 `compose.yml` → 直接套用"compose 部署规范"改造。
6. **端口一致性校验**：`PORT` 必须在「Dockerfile `EXPOSE` / 应用 listen / compose `expose` / `environment.PORT`」四处一致；不一致是 unhealthy 与反代失败的头号原因。
7. **输出全部完整文件**（不输出 diff）+ 简短说明：移除了哪些 `ports:`、哪个 service 配 Domain、内部端口多少。Domain 写成 `https://example.com:4325` 形式——`:4325` 是容器内部端口，公网仍走 HTTPS 443。

## Dockerfile 生成规范

- **多阶段构建**：builder 阶段装依赖 + 跑构建命令，runtime 阶段只拷构建产物，镜像小、不带构建工具链。
- **runtime 用 alpine 系基础镜像**：busybox 自带 `wget`，才能配合 compose 里清代理的 healthcheck（见"原理与排障"）。若 runtime 镜像没有 `wget`/`curl`，healthcheck 命令直接报 not found，容器永远 unhealthy。
- **监听端口由 `PORT` 驱动**，`EXPOSE ${PORT}` 与应用实际 listen 一致，不写死成与 compose 不同的值。
- **不在 Dockerfile 写死密码或密钥**：走 compose 的 `${SERVICE_PASSWORD_*}` 与 environment。
- **按运行时分流**：
  - 静态站点（dist/）→ 拷进轻量静态服务器（如 `nginx:alpine` 或同类），监听内部端口。
  - 长驻服务（Node/Python/Go）→ runtime 用对应 alpine 镜像，`CMD` 启动，`EXPOSE` 监听端口。

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

10. **healthcheck 访问 `127.0.0.1` 时必须先置空代理变量**：

    ```yaml
    healthcheck:
      test: ["CMD-SHELL", "HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= wget --spider -q http://127.0.0.1:${PORT:-4173}/ || exit 1"]
      interval: 30s
      timeout: 5s
    ```

11. **输出完整 `compose.yml`，不要只输出 diff。**

## 原理与排障

被改造方决定不照搬时，引用以下原理，而不是临场编：

- **healthcheck 恒败 → 域名打不开**：部署服务器会给容器注入 `HTTP_PROXY` 等代理变量，wget 访问本机被劫持到代理，代理连不上容器内 `127.0.0.1`，healthcheck 永远失败 → 容器 unhealthy → Traefik 拒绝路由 → 公网域名打不开。只在 healthcheck 命令这一层清代理，不要删容器全局代理变量（应用对外请求可能依赖代理）。
- **`NO_PROXY=127.0.0.1` 没用**：Alpine 的 busybox wget 不识别 `no_proxy`，必须直接清空 `http_proxy` 系列。这也是 Dockerfile runtime 必须自带 wget 的原因。
- **端口四处必须一致**：Dockerfile `EXPOSE`、应用 listen、compose `expose`、`environment.PORT` 任一不一致 → Traefik 转发到没人监听的端口，或 healthcheck 探错端口，表现为 unhealthy / 502。
- **魔法变量密码为何一致**：Coolify 首次部署自动生成 `SERVICE_PASSWORD_*` 并永久持久化，之后重部署值不变；栈内引用同一变量值必然相同，杜绝"应用和数据库密码对不上"。
- **PostgreSQL 密码只在首次初始化生效**：官方镜像只在数据目录为空时采用 `POSTGRES_PASSWORD`，之后改环境变量不改库内真实密码。密码必须首次部署前定下来、生命周期与数据卷绑定；MySQL/MariaDB 的 root 密码同理。
- **命名卷的代价**：固定卷名放弃多环境隔离（单实例生产无妨）；在 Coolify 删资源再重建 ≠ 重置，新部署会原样挂回同名旧卷，旧密码旧数据复活。真正重置 = 删 Coolify 资源 + 上服务器 `docker volume ls | grep <appname>` 找出来 `docker volume rm`，两步缺一不可。删资源前必须先导出备份全部环境变量（`JWT_SECRET` 这类丢了会废掉所有登录态）。
- **手动设密码时**：用 `openssl rand -hex 32` 生成纯十六进制，严禁含 `$`、`#` 等特殊字符——会被 compose 变量插值吞掉，造成"密码设对了却认证失败"的假象。

## 验收清单

产出的文件必须逐项满足：

- [ ] 若新建 Dockerfile：多阶段构建、runtime 为带 wget 的 alpine 系、`EXPOSE` = 应用监听端口
- [ ] 若新建 `.dockerignore`：排除了 node_modules / .git / 本地 env
- [ ] 没有任何 Web 服务写 `ports:` 映射宿主机端口
- [ ] 需要反代的 Web 服务有 `expose:` 且端口 = 应用监听端口
- [ ] 数据库 / Redis / worker 既无 `ports:` 也无对外 `expose`
- [ ] 持久化命名卷显式写了 `name:`
- [ ] 数据库连接串用 service name，不用 localhost / 宿主机 IP
- [ ] 数据库密码用 `${SERVICE_PASSWORD_*}`，应用与数据库引用同一变量
- [ ] 访问 127.0.0.1 的 healthcheck 命令前置空了 `HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`
- [ ] `PORT` 在 Dockerfile / 应用 listen / compose expose / environment 四处一致
- [ ] 输出的是完整文件，不是 diff
- [ ] 附了端口/Domain 说明，Domain 为 `https://host:内部端口` 形式

## 失败路径

- 用户没说构建命令、产物目录或监听端口，且项目里看不出来：先问，不要凭框架默认值瞎填；问不到就把该处写成 `unknown / 需用户确认`。
- 项目类型无法判定（既非静态站也非已知长驻服务）：让用户描述启动命令与监听端口，再决定 runtime 镜像。
- 原 compose 用了自定义 networks 且应用确实依赖：保留它，并在说明里点出"这会让 Traefik 可能选错网络，确认无误后再部署"。

<example>
用户："我这是个 Vite 前端，npm run build 出 dist，想部署到 Coolify，但我没写过 Docker。"

正确做法：
1. 探测：无 Dockerfile、无 compose、无 .dockerignore，全要新建。
2. 识别：构建命令 npm run build，产物 dist/（静态站点），需要一个静态服务器监听内部端口（如 4173）。
3. 生成 .dockerignore（排除 node_modules、.git）。
4. 生成多阶段 Dockerfile：node:alpine builder 跑 npm ci + npm run build → nginx:alpine runtime 拷 dist，EXPOSE 内部端口。
5. 生成 compose.yml：web 服务 expose 内部端口、无 ports、healthcheck 清代理、无数据库则不加 db。
6. 校验端口四处一致。
7. 输出 Dockerfile + .dockerignore + compose.yml 完整内容 + 说明："给 web 配 Domain https://example.com:4173，4173 是内部端口。"
</example>

<bad-example>
错误："直接 docker run -p 4173:4173 跑起来就行" / 在 Dockerfile 里 `RUN echo PASSWORD=123`。

为什么错：(1) Coolify 由 Traefik 经 compose 网络反代，Web 服务不该暴露宿主机端口，也不该用裸 docker run；(2) 密码写进 Dockerfile 会进镜像层、不可轮换，必须走 compose 的 `${SERVICE_PASSWORD_*}`。
</bad-example>
