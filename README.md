# claude-skills

公司团队共享的 Claude Code skill 仓库。

## 一次性 bootstrap

```bash
git clone git@github.com:aistore-labs/claude-skills.git ~/.aistore-labs/claude-skills

for s in publish-skill search-skills install-skill update-skills; do
  cp -r ~/.aistore-labs/claude-skills/$s ~/.claude/skills/$s
done
```

完成后重启 Claude Code，4 个 meta-skill 自动加载。

## 4 个使用场景

### 1. 我想发布本地 skill 到公司库
跟 Claude 说：**"把本地 X skill 发到公司库"**

→ 触发 `publish-skill`：自动检测/补全 frontmatter、复制到缓存仓库、`gh pr create`、回填本地 `published_*` 标记。

### 2. 我想用公司 skill
跟 Claude 说：**"搜公司 skill 关于 Y 的"**

→ 触发 `search-skills` 模糊匹配 description+name 返回 top N。

然后说：**"装第 N 个到 user 级（或 当前 project）"**

→ 触发 `install-skill`：强制问 scope，复制到目标位置。

### 3. 我想推荐外部 skill
跟 Claude 说：**"推荐这个外部 skill 到公司库"** + 提供 URL

→ 触发 `publish-skill --origin external`：仓库里仅存薄指针 (frontmatter + source_url)，install 时 `install-skill` 才走 source_url 拉最新内容并回写本仓库 stub 元数据。

### 4. 我想拿最新
跟 Claude 说：**"更新公司 skill 缓存"**

→ 触发 `update-skills`：`git pull --ff-only` + 自动升级 4 个 meta-skill 副本。

## 仓库结构

```
publish-skill/SKILL.md       meta-skill #1
search-skills/SKILL.md       meta-skill #2
install-skill/SKILL.md       meta-skill #3
update-skills/SKILL.md       meta-skill #4
<own-skill>/SKILL.md         公司原创 skill (frontmatter origin: own)
<external-skill>/SKILL.md    外部推荐薄指针 (frontmatter origin: external + source_url)
```

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

## 探针期声明

本仓库目前在 r2 探针阶段（2026-05-09 起）。设计与决策记录见 [aquarius-wing/goal-claude](https://github.com/aquarius-wing/) 仓库下 `company-agent-plan/goal-docs/`。

约束:
- main 受保护, 必须 PR 合并
- 探针期 solo dogfood, wing 用 admin override merge, 每次记录到 dogfood log
- bump 到 1.0.0+ 必须人手动 review approve, commit message 加 `[MAJOR]` 前缀

## License

私有 / 内部使用. external skill 的 source_url 上游各自的 license 不变.
