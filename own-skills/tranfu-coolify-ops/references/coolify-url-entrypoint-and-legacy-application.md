# Coolify UI URL 入口与旧/非 0.8 Application 判定

当用户只给 Coolify UI URL（例如 `/project/<project_uuid>/environment/<env_uuid>/application/<app_uuid>`）而不是 GitHub URL 时，不能直接套初始化/更新分支，也不能凭 UI URL 原地 PATCH。先做只读归一化：

1. 从 URL 提取 `project_uuid`、`environment_uuid`、`app_uuid`。
2. 只读 `GET /api/v1/applications/<app_uuid>`，必要时只读 `GET /api/v1/projects` 定位 project 名。
3. 从 Application 返回的 `git_repository` 推导 repo，并重新检查硬范围：`owner == tranfu-labs` 且 repo 匹配 `^[a-z][a-z0-9-]*-app$`。不满足则停止。
4. 判定是否为 0.8 可接管形态：
   - `build_pack == "dockercompose"`
   - `github_app_uuid` 非空且等于 preflight 找到的 tranfu-labs GitHub App integration
   - `is_auto_deploy_enabled == false`
   - `project_uuid` 与 URL/project 同名锚点一致
   - `git_repository == tranfu-labs/<repo>`
   - `git_branch` 非空
   - `docker_compose_location` 为 `compose.yml`（不要带前导 `/`）
   - `name` 只作为显示名参考，不作为 0.8 硬失败条件；Coolify 可能显示派生名（如 `<repo>:<branch>-<uuid>`），以 `git_repository` / `git_branch` / `project_uuid` / `github_app_uuid` 等绑定字段为准。
5. 如果关键绑定字段为空、`null`、前导路径异常，或 GitHub App / repo / branch / project 绑定不符合 0.8 要求，把它归类为“旧/非 0.8 Application 形态”。即使它 `status=running:healthy`、`build_pack=dockercompose`、GHA 成功，也不要认为它是 0.8 资源。不要仅因 `name` 是 Coolify 派生显示名而判定失败。

处理策略：

- 0.8 可接管形态：按 Step 1 结果进入更新分支；仍需根据用户意图选择 A/B/C/D/E。
- 旧/非 0.8 Application：只读报告差异，停止；不要原地 PATCH `github_app_uuid`、`is_auto_deploy_enabled`、`project_uuid`、`name`、`docker_compose_location` 等核心字段。
- 推荐迁移路径是新建并行 0.8 Application（临时测试域名、独立验证 env/GHCR/GHA/公网健康后再切正式域名）。若用户坚持原地迁移，按 `reversible-ops` 输出手动 PATCH 与回滚模板，AI 不直接执行线上原地 PATCH。

Token 纪律仍然适用：命令字符串只引用 `$COOLIFY_API_TOKEN`，不要打印 token 或 env 值。