# archived: coolify-deploy skill 已并入 tranfu-coolify-ops

`own-skills/coolify-deploy/` 这个独立 skill 在合并 PR 中被删除，所有内容已经吸收到本 skill。这份文件只是 pointer，避免后人去 git log 找历史。

## 删除的版本

- coolify-deploy v0.3.2，2026-06-26
- 删除前完整内容：`git show <merge-commit>~1:own-skills/coolify-deploy/SKILL.md`

## 原内容去了哪里

| coolify-deploy 原章节 | 现在去哪找 |
|---|---|
| Dockerfile 生成规范（多阶段、healthcheck 工具、EXPOSE 等） | [file-generation-rules.md](file-generation-rules.md) §Dockerfile |
| compose 部署规范（11 条规则：不写 ports / expose / 命名卷 / 魔法密码 / image 不写 build 等）| [file-generation-rules.md](file-generation-rules.md) §compose |
| .dockerignore 生成规则 | [file-generation-rules.md](file-generation-rules.md) §dockerignore |
| workflow 模板与占位符（`{{DEFAULT_BRANCH}}` / `{{TESTS_STEP}}` / 多环境扩展）| [../assets/deploy.yml.template](../assets/deploy.yml.template) + [file-generation-rules.md](file-generation-rules.md) §deploy.yml |
| 端口六处一致性、healthcheck 防代理、端口/Domain 形式 `https://x:port` 等原理 | [file-generation-rules.md](file-generation-rules.md) §原理与排障 |
| Coolify 端 + GitHub 端一次性配置清单 | [../scenarios/reconcile-deployment.md](../scenarios/reconcile-deployment.md) Step 3 / Step 7 |
| 部署链路（GHCR → curl deploy API）| [../commands/deploy-trigger.md](../commands/deploy-trigger.md) + [../assets/deploy.yml.template](../assets/deploy.yml.template) |

## 为什么合并

- 用户实际链路是「跑一次 skill 把代码改造 + Coolify 资源创建一气呵成」——分两个 skill 让用户记两个触发器、文档间互相 reference 不连贯。
- coolify-deploy 原本说"只产出文件，不替用户操作服务器"——但 tranfu 内部场景里两件事就是连着做的。
- 合并后职责仍然清晰：scenarios/reconcile-deployment.md 是流程，file-generation-rules.md 是文件内容规范，commands/ 是 API 速查。

## 非 tranfu 用户场景

如果你不是 tranfu 团队（用别的 Coolify 实例 / 别的 GHCR org），本 skill 的硬编码（`http://120.77.223.183:8000`、`tranfu-labs` 命名约束）不适用。你需要：

- fork 一份本 skill 改硬编码，或
- 走 `git show <merge-commit>~1:own-skills/coolify-deploy/SKILL.md` 拿回原 coolify-deploy 内容，手工跑 Coolify UI 配置（原 skill 的设计就是"只产出文件，UI 操作让用户做"）。
