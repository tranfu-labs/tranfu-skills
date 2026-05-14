# tranfu-skills

公司团队共享的 Claude Code / OpenAI Codex CLI skill 仓库. 通过 npm CLI [`tranfu-skills`](https://www.npmjs.com/package/tranfu-skills) (二进制 `tfs`) 分发, 不再需要 `git clone`.

## 一次性 bootstrap

支持 **Claude Code** 和 **OpenAI Codex CLI** — 两边都能跑同一段提示词, CLI 会自己识别 runtime 并装到对应目录 (Claude Code → `~/.claude/skills/`, Codex CLI → `~/.codex/skills/`).

复制下面这段提示词, 粘贴给当前在用的 agentic CLI (任意目录开会话即可):

```text
请阅读 https://github.com/tranfu-labs/tranfu-skills/blob/main/INSTALL.md 并按文档步骤帮我安装公司 skill 库.
```

CLI 会按文档跑 `npm i -g tranfu-skills` + `tfs init --both` + `tfs doctor` 自检, 结束后告诉你重启即可. 具体细节看 [INSTALL.md](./INSTALL.md).

## 从旧 git-clone 装法升级 (老用户)

老版本通过 git clone 装, 现在切到 npm CLI. 跑上面 bootstrap 段就行 — `INSTALL.md §0.5` 会**静默清理**旧残留 (旧缓存 `~/.tranfu-labs/` + 旧 4 个 meta-skill `search-skills` / `install-skill` / `update-skills` / `publish-skill`), 然后装新版. 不需要手动 `rm`.

想自己手动来也行:

```bash
# 删旧 git-clone 缓存
rm -rf ~/.tranfu-labs ~/.aistore-labs
# 删旧 4 个 meta-skill (Claude Code 路径示例; Codex 把 .claude 换成 .codex)
rm -rf ~/.claude/skills/{search-skills,install-skill,update-skills,publish-skill}
# 装新 CLI
npm i -g tranfu-skills && tfs init --both
```

## 4 个使用场景

装完后跟你的 agentic CLI 说自然语言即可, 两个新 meta-skill 自动接住:

### 1. 我想发布本地 skill 到公司库

```text
把本地 X skill 发到公司库
```

→ 触发 `tranfu-publish`: 自动检测 / 补全 frontmatter, 复制到工作仓库, `gh pr create`, 回填本地 `published_*` 标记.

### 2. 我想搜并装公司 skill

```text
搜公司 skill 关于 Y 的
```

→ 触发 `tranfu-router`, 调 `tfs search "Y"` 返回 top N.

```text
装第 N 个到 user 级 (或 当前 project)
```

→ 触发 `tranfu-router`, 调 `tfs install <name> --scope user|project`. CLI 远程拉 skill 内容写到目标位置, 装机戳 (`installed_by/installed_version/installed_source/installed_at`) 自动回填到 SKILL.md.

### 3. 我想推荐外部 skill

```text
推荐这个外部 skill 到公司库: <URL>
```

→ 触发 `tranfu-publish` 的 external 分支: 仓库里仅存薄指针 (frontmatter + `source_url`), install 时 `tfs install` 才走 source_url 拉最新内容.

### 4. 我想拿最新

```text
升级公司 skill
```

→ 触发 `tranfu-router`, 调 `tfs update`. 默认升 CLI 自身 (`npm i -g tranfu-skills@latest`) + 升所有已装的公司 skill. 想只升 CLI / 只升 skill: 加 `--self` / `--skills-only`.

```text
列已装的公司 skill
```

→ 跑 `tfs installed`, 看当前本地从公司库装了哪些. 想看远端全量 → `tfs list`.

## 仓库结构

按 `type` 分类目, 落点零歧义; CLI 装到本地时自动拍扁 (`type` 中间层去掉).

```
meta-skills/                  生命周期管理器 (仓库自带, 不通过 publish 流程)
  tranfu-router/SKILL.md      搜 / 装 / 列 / 卸载 / 升级
  tranfu-publish/SKILL.md     发布到公司库

own-skills/                   公司原创 (frontmatter origin: own)
  <skill-name>/SKILL.md
  <skill-name>/README.md      给使用者看的入门文档
  ...

external-skills/              外部推荐薄指针 (frontmatter origin: external + source_url)
  <skill-name>/SKILL.md       仅 frontmatter, body = "首次 install 时从 source_url 拉最新"
  ...

index.json                    CI 自动生成 (build-index.yml), tfs search/list 拉这个
```

> CLI 装到 runtime 时一律扁平 (e.g. `meta-skills/tranfu-router/` → `~/.claude/skills/tranfu-router/`). 规模到 20+ own skill 后再考虑二级分类 (e.g. `own-skills/content/`), 现在不过早设计.

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

`published_*` 字段仅写在**本地** skill 的 SKILL.md (由 tranfu-publish 回填), 不进本仓库.
`installed_*` 字段仅写在**装机端** SKILL.md (由 `tfs install` 回填), 也不进本仓库.

## 怎么拉更新

```text
升级公司 skill
```

→ 触发 `tranfu-router` 调 `tfs update`. 它会:

- 检查 npm registry, 如有新版 `tranfu-skills` → `npm i -g tranfu-skills@latest`
- 远程拉 index.json, 对比本地已装 skill 的 `installed_version` (sha 戳), 有 bump 的直接覆盖
- 报告 deleted-upstream 的 skill (远端删了但本地还在), 用户决定是否 `tfs uninstall` / `--ack-deletions` 静默

最近改了什么 → 看 [CHANGELOG.md](./CHANGELOG.md).

## 怎么完整卸载

复制下面这段提示词, 粘贴给当前在用的 agentic CLI:

```text
请阅读 https://github.com/tranfu-labs/tranfu-skills/blob/main/UNINSTALL.md 并按文档步骤帮我卸载公司 skill 库.
```

具体细节看 [UNINSTALL.md](./UNINSTALL.md).

## 探针期声明

本仓库目前在 r2 探针阶段 (2026-05-09 起). 设计与决策记录见 [aquarius-wing/goal-claude](https://github.com/aquarius-wing/) 仓库下 `company-agent-plan/goal-docs/` 与 `claude-skills-goal-docs/`.

约束:
- main 受保护, 必须 PR 合并
- 探针期 solo dogfood, wing 用 admin override merge
- bump 到 1.0.0+ 必须人手 review approve, commit message 加 `[MAJOR]` 前缀

## License

私有 / 内部使用. external skill 的 source_url 上游各自的 license 不变.
