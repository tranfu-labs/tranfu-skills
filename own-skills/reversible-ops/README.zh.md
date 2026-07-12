---
prompt_examples:
  - prompt: 我能跑 `docker compose down -v` 吗？
    scene: 命令粘贴
  - prompt: 帮我把 /var/log/nginx/ 下旧的 access.log 清一下。
    scene: 口语清理
  - prompt: 我写了个 Python 清缓存脚本, 跑之前你先逐条审。
    scene: 脚本审查
  - prompt: 把 Coolify 上 8f3a-staging-uuid 这个 app 摘掉, 加了 --force。
    scene: Coolify 删除
  - prompt: 帮我改一下 service abc-uuid 的 DATABASE_URL 环境变量。
    scene: 改环境变量
  - prompt: 用 `git reset --hard origin/main` 把我这个 feature 分支拉回主线。
    scene: git 危险
---

[English](./README.md) | [中文](./README.zh.md)

# 运维可回滚守则

运维写命令的安全网——默认不替你执行, 可恢复的改写成可恢复命令让你复制着跑, 不可恢复的直接拒。

## 什么时候用它

**命令粘贴**:

我要跑一条 `rm` / `docker rm` / `git reset --hard` / `coolify app delete`, 想先让 skill 判它能不能撤回再决定。

**口语请求**:

我说「帮我删一下 logs」「清掉这些旧镜像」, 想让 skill 把口语翻成可以恢复的具体命令。

**脚本审查**:

我写了个 Python 或 shell 脚本要跑, 想让 skill 逐条按四条铁律审一遍, 有问题的段落改写。

**Coolify 高危**:

我要动 Coolify 上的 app / database / service, 尤其是 delete / env / private-key, 想让 skill 用黑名单加 bootstrap 窗口判定挡一层。

**不接**:

写 Dockerfile / compose.yml 让仓库能部署到 Coolify → **coolify-deploy**; 仓库里的代码任务 (新功能 / 重构) → **openspec-driven-development**; tranfu 团队 Coolify 业务流程 (onboard / redeploy) → **tranfu-coolify-ops** (本 skill 是它的安全底座, 不替代业务流程本身)。

## 它会产出什么 / 你会看到什么

**默认不替你执行任何写命令**——最反常识的一点。

- **可恢复改写**: 把 `rm` 改成 `mv` 到 `/tmp/trash-<时间戳>/`, 把覆盖 `.env` 改成先 `cp` 备份再改, 命令粘出来让你复制着跑
- **不可恢复拒绝**: 四段输出——原命令、拒绝原因、可恢复替代、若坚持原命令请自己在终端手动复制
- **回执对照表**: 每次写操作跑完输出「原位置 → 新位置」加「恢复命令」两栏, 一条一行
- **六类白名单可直接执行**: CI/CD 重跑、单 app 新增 env、tfs 维护、资源新建、对称启停、bootstrap 窗口 PATCH——每类都锁死前提条件
- **黑名单硬拒**: Coolify 实例本体 / 持久卷 / 集成根、DELETE RESTful 端点、危险标志 (`--force` / `--yes` / `--delete-volumes`)——任何窗口任何授权都不放行
- **绝不会做**: 替你跑黑名单命令、主动加 `--force` / `--yes` 类危险标志、把敏感值 (env get 明文 / `.env` 内容 / 密钥) 贴回聊天窗口

## 前置条件与边界

**前置**:

本地 bash / Docker / Coolify 环境; Coolify 相关命令依赖 `coolify-cli-llm.txt` 存在, 否则按不透明命令走拒绝流程, 我不会去猜命令名。

**相邻 skill 分工**:

| 场景 | 交给 |
|---|---|
| 写 Dockerfile / compose.yml 让仓库能部署到 Coolify | **coolify-deploy** |
| 仓库里的代码任务 (新功能 / bugfix / 重构) | **openspec-driven-development** |
| tranfu 团队 Coolify 业务流程 (onboard / redeploy) | **tranfu-coolify-ops** (本 skill 是安全底座) |

**不接的场景**:

- 纯只读命令 (`ls` / `cat` 非敏感文件 / `docker ps` / `docker inspect` / `coolify list`)——直接放行, 不用绕本 skill
- 项目文档、SEO、图表、设计类任务
- 只查文档 (直接答即可)

**微妙边界**:

- 「删 project / environment / team」→ Coolify CLI 故意不提供 (级联删里面所有 app / database / service), 引导你走 UI 并警告级联范围
- Bootstrap 窗口内 PATCH 放行 (资源从没成功部署过), 出了窗口 PATCH 退回只审不跑, 不降级
- 用户「我授权 / 我确定 / 出事我负责」不能绕过黑名单——黑名单先于所有其他判定
- 单 app 新增 env (KEY 不存在) 任何窗口都放行; 覆盖已有 KEY 只在 app 的 bootstrap 窗口内放行
- 读 `.env` 或 `coolify env get <SECRET>` 拿值——硬拒, 你自己 cat, 别让我贴回会话
