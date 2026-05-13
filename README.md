# tranfu-skills

公司团队共享的 Claude Code skill 仓库。

## 一次性 bootstrap

支持 **Claude Code** 和 **OpenAI Codex CLI** — 两边都能跑同一段提示词, agent 会自己识别 runtime 并装到对应目录 (Claude Code → `~/.claude/skills/`, Codex CLI → `~/.codex/skills/`)。

复制下面这段提示词, 粘贴给当前在用的 agentic CLI (任意目录开会话即可)：

```text
请阅读 https://github.com/tranfu-labs/tranfu-skills/blob/main/INSTALL.md 并按文档步骤帮我安装公司 skill 库。
```

CLI 会自己 WebFetch 文档, 按里面的步骤跑 git clone + cp + 自检, 结束后告诉你重启即可。具体细节看 [INSTALL.md](./INSTALL.md)。

## 4 个使用场景

### 1. 我想发布本地 skill 到公司库

```text
把本地 X skill 发到公司库
```

→ 触发 `publish-skill`：自动检测/补全 frontmatter、复制到缓存仓库、`gh pr create`、回填本地 `published_*` 标记。

### 2. 我想用公司 skill

```text
搜公司 skill 关于 Y 的
```

→ 触发 `search-skills` 模糊匹配 description+name 返回 top N。

```text
装第 N 个到 user 级（或 当前 project）
```

→ 触发 `install-skill`：强制问 scope，复制到目标位置。

### 3. 我想推荐外部 skill

```text
推荐这个外部 skill 到公司库：<URL>
```

→ 触发 `publish-skill --origin external`：仓库里仅存薄指针 (frontmatter + source_url)，install 时 `install-skill` 才走 source_url 拉最新内容并回写本仓库 stub 元数据。

### 4. 我想拿最新

```text
更新公司 skill 缓存
```

→ 触发 `update-skills`：`git pull --ff-only` + 自动升级 4 个 meta-skill 副本。

## 仓库结构

按 `origin` 分类目, 落点零歧义; user 级加载时自动拍扁。

```
meta-skills/                  4 个生命周期管理器 (仓库自带, 不通过 publish-skill 流程)
  publish-skill/SKILL.md
  search-skills/SKILL.md
  install-skill/SKILL.md
  update-skills/SKILL.md

own-skills/                   公司原创 (frontmatter origin: own)
  <skill-name>/SKILL.md
  <skill-name>/README.md      给使用者看的入门文档
  ...

external-skills/              外部推荐薄指针 (frontmatter origin: external + source_url)
  <skill-name>/SKILL.md       仅 frontmatter, body = "首次 install 时从 source_url 拉最新"
  ...
```

> user 级 skill 目录必须扁平加载, install / bootstrap cp 时自动去掉子目录中间层 (e.g. `meta-skills/publish-skill/` → `$TARGET_SKILLS_USER/publish-skill/`)。具体路径按 runtime: Claude Code → `~/.claude/skills/`, OpenAI Codex CLI → `~/.codex/skills/` (详见 [RUNTIME.md](./RUNTIME.md))。规模到 20+ own skill 后再考虑二级分类 (e.g. `own-skills/content/`, `own-skills/engineering/`), 现在不过早设计。

## frontmatter 字段

| 字段 | own | external | 说明 |
|---|---|---|---|
| name | ✓ | ✓ | kebab-case = 目录名 |
| description | ✓ | ✓ | ≤ 100 字, 含触发场景 |
| version | ✓ | ✓ | semver |
| author | ✓ | ✓ | 原作者 GitHub handle |
| updated_at | ✓ | ✓ | ISO8601 仅日期 |
| origin | ✓ | ✓ | `own` 或 `external` |
| source_url | — | ✓ | 上游 URL |
| recommend_reason | — | ✓ | ≤ 200 字 |

`published_*` 字段仅写在**本地** skill 的 SKILL.md（由 publish-skill 回填）, 不进本仓库。

## 怎么拉更新

复制下面这段提示词，粘贴给 Claude Code：

```text
更新公司 skill 缓存
```

→ 触发 `update-skills`。它会 `git pull` 本仓库 + 自动覆盖当前 runtime user 级 skill 目录下的 4 个 meta-skill (有 bump 时), 并报告普通 skill 的新增/更新由用户决定要不要 install。

最近改了什么 → 看 [CHANGELOG.md](./CHANGELOG.md)。

## 怎么完整卸载

复制下面这段提示词, 粘贴给当前在用的 agentic CLI:

```text
请阅读 https://github.com/tranfu-labs/tranfu-skills/blob/main/UNINSTALL.md 并按文档步骤帮我卸载公司 skill 库。
```

具体细节看 [UNINSTALL.md](./UNINSTALL.md)。

## 探针期声明

本仓库目前在 r2 探针阶段（2026-05-09 起）。设计与决策记录见 [aquarius-wing/goal-claude](https://github.com/aquarius-wing/) 仓库下 `company-agent-plan/goal-docs/`。

约束:
- main 受保护, 必须 PR 合并
- 探针期 solo dogfood, wing 用 admin override merge, 每次记录到 dogfood log
- bump 到 1.0.0+ 必须人手动 review approve, commit message 加 `[MAJOR]` 前缀

## License

私有 / 内部使用. external skill 的 source_url 上游各自的 license 不变.
