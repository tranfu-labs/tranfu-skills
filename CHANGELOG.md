# CHANGELOG

公司 skill 库的 user-facing release notes. 每次 PR merge 后追加一条. 想看自己用的 skill 有没有更新, 决定要不要触发 `update-skills` 拉.

格式: `<日期>` 一组 → `**<skill 或 模块>** <版本变化>` — 一句话说改了啥 + (PR 链接)。探针期 (r2, 2026-05-09 起) 以 PR 粒度记录, 不打 repo-level tag。

---

## 2026-05-13

- **组织改名 `aistore-labs` → `tranfu-labs`** — 仓库 URL / 缓存路径 / 文案 / SVG 全链路替换. 4 个 meta-skill + INSTALL.md 顶部加 `§0.5 旧缓存路径迁移` 一次性兼容块: 检测 `~/.aistore-labs/claude-skills/` 在且 `~/.tranfu-labs/tranfu-skills/` 不在时, 静默 `mv` + 修 git remote URL. UNINSTALL.md 加双路径兜底删. 老用户首次 `update-skills` 后自动迁完, 后续无感; 新用户条件不满足, 整块静默跳过. (CLI 化下载后 `~/.tranfu-labs/` 也会废弃.)
- **install-skill** 0.2.0 → 0.2.1 — 加 §0.5 迁移.
- **update-skills** 0.2.0 → 0.2.1 — 加 §0.5 迁移.
- **search-skills** 0.1.1 → 0.1.2 — 加 §0.5 迁移.
- **publish-skill** 0.5.1 → 0.5.2 — 加 §0.5 迁移.

## 2026-05-12

- **OpenAI Codex CLI 支持** — bootstrap / install / uninstall / update / publish 全链路都按当前 runtime 自适应 skill 目录: Claude Code → `~/.claude/skills/`, Codex CLI → `~/.codex/skills/` (即 `$CODEX_HOME/skills/`)。agent 默认自报身份, 兜底问用户; 不靠 env var 自动猜 (Codex CLI 无稳定标记)。
- **新增 [`RUNTIME.md`](./RUNTIME.md)** — runtime 表 + 检测算法 + 加新 runtime 标准的单一真相; INSTALL / UNINSTALL / 4 个 meta-skill 都引用它, 改一处即全链路生效。
- **install-skill** 0.1.1 → 0.2.0 — 目标路径按 runtime 自适应 (`$TARGET_SKILLS_USER` / `$TARGET_SKILLS_PROJECT`); scope 二次确认文案路径实化; dogfood log 加 `runtime` 字段。
- **update-skills** 0.1.1 → 0.2.0 — meta-skill 副本同步目标改为 `$TARGET_SKILLS_USER`, 不再硬编码 `~/.claude/skills/`; dogfood log 加 `runtime` 字段。
- **publish-skill** — 本地 skill 定位路径按 runtime 自适应 (优先 `$TARGET_SKILLS_USER`, fallback `$TARGET_SKILLS_PROJECT`); 不 bump version (改动属于环境适配, 行为对 Claude Code 用户透明等价)。
- **search-skills** — 第 7 步提示文案去硬编码, 不再写死 `~/.claude/skills/` 给用户看; 不 bump version。

## 2026-05-09

- **仓库结构重组** — skill 按 `origin` 分文件夹: `meta-skills/` (4 个生命周期管理器), `own-skills/` (公司原创), `external-skills/` (外部薄指针). user 级加载点保持扁平, install / bootstrap cp 时去掉 category 中间层. ([#5](https://github.com/tranfu-labs/tranfu-skills/pull/5))
- **publish-skill** 0.1.1 → 0.1.2 — 按 origin 决定落 own-skills/ 或 external-skills/, 拒绝发布 meta-skill 名 (强制走仓库直接 PR 路径). ([#5](https://github.com/tranfu-labs/tranfu-skills/pull/5))
- **search-skills** 0.1.0 → 0.1.1 — 跨 3 子目录搜, meta-skill 结果末尾标 `[meta]` 标. ([#5](https://github.com/tranfu-labs/tranfu-skills/pull/5))
- **install-skill** 0.1.0 → 0.1.1 — 在 own-skills + external-skills 下查找 (跳过 meta-skills, 拒装 meta-skill 名). ([#5](https://github.com/tranfu-labs/tranfu-skills/pull/5))
- **update-skills** 0.1.0 → 0.1.1 — meta-skill 缓存源路径从根改为 `meta-skills/`, 拍扁 cp 到 `~/.claude/skills/`. ([#5](https://github.com/tranfu-labs/tranfu-skills/pull/5))
- **publish-skill** 0.1.0 → 0.1.1 — 加 §3.5 README.md 补全步骤 (给使用者), §7 PR body 改 checklist 模板 (给 reviewer); 视角分离. ([#2](https://github.com/tranfu-labs/tranfu-skills/pull/2))
- **bootstrap 流程改造** — `README.md` 安装区从 bash 脚本改为提示词驱动, 实际步骤搬到 [`INSTALL.md`](./INSTALL.md) 由 Claude Code 本地读取执行. ([#2](https://github.com/tranfu-labs/tranfu-skills/pull/2))
- **credibility-review** 0.1.0 — 首次发布. 文章可信度审稿 skill (踩坑记/养成记 dual-track + anti-pattern 检测). ([#1](https://github.com/tranfu-labs/tranfu-skills/pull/1))
- **claude-skills** 仓库初始化 — 4 个 meta-skill (publish-skill / search-skills / install-skill / update-skills) + README. (root commit `85fa516`)

---

## 怎么拉更新

跟你的 agentic CLI (Claude Code / Codex CLI) 说: **"更新公司 skill 缓存"** → 触发 `update-skills`。

它做的事:
- `git pull --ff-only` 本仓库缓存
- 检测 4 个 meta-skill 哪些 bump 了, 自动覆盖到当前 runtime 的 user 级 skill 目录 (Claude Code → `~/.claude/skills/`, Codex CLI → `~/.codex/skills/`)
- 报告普通 skill 的新增/更新, 由用户决定要不要 `install-skill`

## 通知通道 (探针期)

目前没有自动通知。Solo 探针期 (2026-05-09 起), wing 自己 push 自己也是用户, 不需要通道。v2 加人后再考虑 (e.g. Slack webhook / GitHub Release subscribe).
