# CHANGELOG

公司 skill 库的 user-facing release notes. 每次 PR merge 后追加一条. 想看自己用的 skill 有没有更新, 决定要不要触发 `update-skills` 拉.

格式: `<日期>` 一组 → `**<skill 或 模块>** <版本变化>` — 一句话说改了啥 + (PR 链接)。探针期 (r2, 2026-05-09 起) 以 PR 粒度记录, 不打 repo-level tag。

---

## 2026-05-09

- **仓库结构重组** — skill 按 `origin` 分文件夹: `meta-skills/` (4 个生命周期管理器), `own-skills/` (公司原创), `external-skills/` (外部薄指针). user 级加载点保持扁平, install / bootstrap cp 时去掉 category 中间层. ([#5](https://github.com/aistore-labs/claude-skills/pull/5))
- **publish-skill** 0.1.1 → 0.1.2 — 按 origin 决定落 own-skills/ 或 external-skills/, 拒绝发布 meta-skill 名 (强制走仓库直接 PR 路径). ([#5](https://github.com/aistore-labs/claude-skills/pull/5))
- **search-skills** 0.1.0 → 0.1.1 — 跨 3 子目录搜, meta-skill 结果末尾标 `[meta]` 标. ([#5](https://github.com/aistore-labs/claude-skills/pull/5))
- **install-skill** 0.1.0 → 0.1.1 — 在 own-skills + external-skills 下查找 (跳过 meta-skills, 拒装 meta-skill 名). ([#5](https://github.com/aistore-labs/claude-skills/pull/5))
- **update-skills** 0.1.0 → 0.1.1 — meta-skill 缓存源路径从根改为 `meta-skills/`, 拍扁 cp 到 `~/.claude/skills/`. ([#5](https://github.com/aistore-labs/claude-skills/pull/5))
- **publish-skill** 0.1.0 → 0.1.1 — 加 §3.5 README.md 补全步骤 (给使用者), §7 PR body 改 checklist 模板 (给 reviewer); 视角分离. ([#2](https://github.com/aistore-labs/claude-skills/pull/2))
- **bootstrap 流程改造** — `README.md` 安装区从 bash 脚本改为提示词驱动, 实际步骤搬到 [`INSTALL.md`](./INSTALL.md) 由 Claude Code 本地读取执行. ([#2](https://github.com/aistore-labs/claude-skills/pull/2))
- **credibility-review** 0.1.0 — 首次发布. 文章可信度审稿 skill (踩坑记/养成记 dual-track + anti-pattern 检测). ([#1](https://github.com/aistore-labs/claude-skills/pull/1))
- **claude-skills** 仓库初始化 — 4 个 meta-skill (publish-skill / search-skills / install-skill / update-skills) + README. (root commit `85fa516`)

---

## 怎么拉更新

跟 Claude Code 说: **"更新公司 skill 缓存"** → 触发 `update-skills`。

它做的事:
- `git pull --ff-only` 本仓库缓存
- 检测 4 个 meta-skill 哪些 bump 了, 自动覆盖到 `~/.claude/skills/`
- 报告普通 skill 的新增/更新, 由用户决定要不要 `install-skill`

## 通知通道 (探针期)

目前没有自动通知。Solo 探针期 (2026-05-09 起), wing 自己 push 自己也是用户, 不需要通道。v2 加人后再考虑 (e.g. Slack webhook / GitHub Release subscribe).
