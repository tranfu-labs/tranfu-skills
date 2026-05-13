---
name: publish-skill
description: 当用户说"把本地 X 发到公司库 / 这个 skill 不错分享给公司 / 给公司推荐 <url> / 给 X 加个案例"时, 完成发布 / 推荐 / 加案例流程. 在 §1 自动选 own 直路 / external in-context / external cold-start / 仅加 case 四条路径之一. 自动补全 frontmatter, 整理案例, 起草 §同类 Skill 对比 (内/外 ≤3+3 候选 + 独特价值), 引导起草 §使用技巧 (材料方案 / 推荐用法 / 已知限制 3 子段), 按 templates/ 创建 PR. Do NOT trigger when: 用户只是询问某个 skill 的用法 / 想搜公司库有没有 X (走 search-skills) / 想装某个公司 skill 到本地 (走 install-skill) / 想拉公司库最新 (走 update-skills).
version: 0.6.0
author: aquarius-wing
updated_at: 2026-05-13
origin: own
---

# Publish / Recommend / Add-case 到 tranfu-labs/claude-skills

## When to use

四类触发, 对应四条内部路径 (A/B/C/D). 路径选择由 AI 在 §1 自动决定, 不需用户指明.

| 路径 | 触发语示例 | 适用 |
|---|---|---|
| **A. own 直路发布** | "把本地 my-cool-skill 发到公司库" / "publish X" / "推到 tranfu-labs" | 自己写的 skill |
| **B. external in-context 推荐** | "这个 skill 不错, 分享给公司" / "把刚才那个推上去" | 上下文里刚用过的 external skill |
| **C. external cold-start 推荐** | "给公司推荐 https://github.com/foo/bar-skill" | 听说 / 看到的外部 skill, 未必用过 |
| **D. 加案例** | "我也用过 <external-skill>, 给它加个案例" | 已在 external-skills/ 的 skill, 想补 case |

## Constants

- 公司仓库: `tranfu-labs/claude-skills` (private)
- 本地缓存: `~/.tranfu-labs/claude-skills/`
- own 落点: `<cache>/own-skills/<name>/`
- external 落点: `<cache>/external-skills/<name>/`
- case 落点: `<cache>/external-skills/<name>/cases/<recommender>.md`
- dogfood log: `<cache>/.dogfood-r1.log`
- 模板 (同目录): `templates/pr-body.md`, `templates/case-file.md`
- 本地 skill 查找路径按 runtime 自适应: `$TARGET_SKILLS_USER/<name>/` (Claude Code → `~/.claude/skills/`, Codex CLI → `~/.codex/skills/`), fallback `$TARGET_SKILLS_PROJECT/<name>/`。详见 [RUNTIME.md](../../RUNTIME.md)

## 完成标准 (强制门禁, 读这里再开干)

发布**完成** = §1.7 预览门禁 pass + `gh pr create` 成功 + §1.8 发布后回查全 pass.

`gh pr create` 成功 / PR open 只是中间一步, **不是**完成标准. 把 "PR 开出来了" 当任务结束 = 失败 (历史教训: PR #37 用 GitHub 通用 `## Summary / ## Validation` 习惯写法替代了 `templates/pr-body.md` 模板段, 直到 merge 后才被发现).

阻塞门禁:

| 门 | 时机 | 阻塞动作 | 通过条件 |
|---|---|---|---|
| §1.7 | commit 后, `gh pr create` 前 | 不允许 `gh pr create` | 用户回 `[1] 确认发` |
| §1.8 | `gh pr create` 后, 任务结束前 | 不允许向用户报"发布完成" | 模板段完整 / files 范围对 / state=open |

跳任一门 = 流程失败. 用户说 "继续 / 代填" 只是放弃**逐段决策**, 不是放弃**门禁** (详见 §1.5/§1.6 共同约定的"用户授权代填"协议).

## §0. 运行时识别

按 [RUNTIME.md](../../RUNTIME.md) 第 2 节识别你自己, 取 `$TARGET_SKILLS_USER` / `$TARGET_SKILLS_PROJECT`。默认自报身份, 别问用户。

## §0.5. 旧缓存路径迁移 (一次性兼容)

公司库从 `aistore-labs` 改名到 `tranfu-labs`. 如检测到旧 `~/.aistore-labs/claude-skills/`, 新路径不在, 静默迁移:

```bash
if [ -d ~/.aistore-labs/claude-skills ] && [ ! -d ~/.tranfu-labs/claude-skills ]; then
  mkdir -p ~/.tranfu-labs
  mv ~/.aistore-labs/claude-skills ~/.tranfu-labs/claude-skills
  cd ~/.tranfu-labs/claude-skills && \
    git remote get-url origin 2>/dev/null | grep -q aistore-labs && \
    git remote set-url origin git@github.com:tranfu-labs/claude-skills.git
fi
```

新装用户条件不满足, 静默跳过.

## §1. 入口路由 (必跑, 决定走哪条路径)

```
Step 1.1 — 解析用户触发短语
  - 含 url? → 走路径 C (cold-start)
  - 含 "加案例 / add case"? → 走路径 D
  - 其他 → 进 §1.2

Step 1.2 — 候选 skill 推断
  扫当前会话上下文, 找最近被调用 / 提及的 skill 名集合.
  - 0 个 → 问用户: "你想发布 / 推荐的是哪个 skill? (给名字或路径)"
  - 1 个 → 进 §1.3, 告诉用户 "我理解你说的是 <name>, 对吗?"
  - ≥2 个 → 列编号清单:
      "上下文出现了多个 skill, 你说的是哪个?
       [1] <name-1>  ← 最近调用
       [2] <name-2>
       [_] 其他 (给名字)"

Step 1.3 — origin 检测 (决定走 A 还是 B)
  对已定的 <name>:
    - 本地查: ls $TARGET_SKILLS_USER/<name>/SKILL.md (按 §0 runtime), 读 frontmatter author
    - gh api user -q .login 拿当前 user handle
    - 网搜判定 (可选): 是否在公开 GitHub / NPM / blog 命中
  判定矩阵:
    * 本地存在 + author = 当前 user + 无外部命中     → own        (走 §2)
    * 本地存在 + author ≠ 当前 user 或 有网搜命中     → external   (走 §3)
    * 本地不存在                                    → external   (走 §3, 另一台机器看到的)
    * 两边都有迹象 / 信号不清                        → MUST 问用户:
        "我没法 100% 判断这个 skill 是自己写的 (own) 还是从外部抄来的 (external).
         - own: 我们 / 你自己写的
         - external: 从 <网站 / 朋友 / ...> 看到的 → 请给 source_url"
```

## §1.5 / §1.6 共同约定

两段都是 SKILL.md body 新 section, **不**进 frontmatter (search-skills 仅搜 frontmatter, 契约不动). 焦点严格区分, 互不引用:

| § | 段标题 | 焦点 | 模板 |
|---|---|---|---|
| 1.5 | 同类 Skill 对比 | **横向** — 谁在做, 我和他们差别 | `templates/section-同类对比.md` |
| 1.6 | 使用技巧 | **纵向** — 选定后怎么用好 | `templates/section-使用技巧.md` |

**时机** (D 始终跳过):

| 路径 | §1.5 触发点 | §1.6 紧随其后 | 落点 |
|---|---|---|---|
| A | §2 步骤 4 README 后 → 跑 §1.5 → §1.6 | 进步骤 5 bump | `own-skills/<name>/SKILL.md`, `## When to use` 之后 |
| B | B.4 CASE_DEFERRED 后 → §1.5 → §1.6 | 进 B.5 PR | `external-skills/<name>/SKILL.md` (薄指针) 末尾 append |
| C | C.4 CASE_OPTIONAL 后 → §1.5 → §1.6 | 进 C.5 PR | 同 B |
| D | **跳过** | **跳过** | case-only PR 不动 SKILL.md |

**用户签字协议 (两段通用)** — AI 草稿后输出:

```
我起草了 §{同类对比|使用技巧} (将写入 SKILL.md). 看一眼:
---
<展示草稿 markdown>
---
[1] 用这个 (默认)  [2] 我改一改 (你给指示)
[3] 自己另写       [4] 跳过本节, 写"暂无 (推荐者跳过)" 占位
```

**"用户授权代填" 协议** — 用户中途说 "继续 / 代填吧 / 你帮我完成 / 不用问我了 / 跳过追问":

这是用户放弃**自己的逐段决策** (上面 `[1] [2] [3] [4]` 那种选择题), **不是**放弃流程. 模板 / §1.7 预览门禁 / §1.8 回查 / 自检清单 / PR body 模板段 — 一样跑.

具体行为:

- §1.5 §1.6 的逐段 sign-off: AI 一律走默认 `[1] 用这个`, 不再逐段问用户
- §1.5.3 外部 WebFetch 验活 / §1.6.2 引导设问起草 / §1.6.3 整合 — 照常跑, 用户没说话不等于这几步可以省
- 自检清单逐项: AI 代评估并勾选 (不是跳过)
- **§1.7 预览门禁仍必跑** — 把所有代填结果汇成一次最终预览给用户看, 一次性签字 (不是逐段决策, 是 "看一眼最终成品要不要发")
- **§1.8 回查仍必跑** — 与用户授不授权无关
- PR body 仍 MUST 用 `templates/pr-body.md` 渲染, 不能换成 `## Summary / ## Validation` 这类 GitHub 通用习惯写法

NEVER 把 "继续上传 / 你帮我完成" 理解为 "AI 自行跳过模板和门禁直接 push". 用户授权 ⊂ 用户决策权, 不 ⊂ 流程门禁.

## §1.5 同类 Skill 对比

### §1.5.1 提取关键词

输入: frontmatter `description`. AI 自抽 ≤5 个关键词 (动作 / 对象 / 场景 / 触发短语). 不反向问用户.

### §1.5.2 公司库内搜索

MUST 用 Grep 工具 (NOT bash `rg` / `grep`):

```
pattern: "<kw1>|<kw2>|<kw3>"
path: "~/.tranfu-labs/claude-skills"
glob: "{own-skills,external-skills}/*/SKILL.md"
-i: true
output_mode: "files_with_matches"
```

跳过本 skill 自己 → 用 Read 读命中文件 description → 选 ≤3 个最相似. 0 命中 → 段内写"暂无".

### §1.5.3 外部世界搜索

- `WebSearch`: ≤5 关键词 + `"claude skill"` / `"claude code skill"`
- 优先: `anthropics/skills` / GitHub topic `claude-skill` `claude-code-skill` / Anthropic marketplace / 公开 skill 集合 repo
- 候选 URL ≤3 个, **每个** `WebFetch` 验活 (HTTP 200 + 是 skill 不是博文). 0 命中 / 全死链 → "暂无", 不硬编 / 不编造

### §1.5.4 差异化草稿

对每条命中 (内 + 外) 一行:

```
- [<name>](<link>) — <对方 1 句话做什么>; **本 skill 区别**: <1 句, 具体到场景 / 输入输出>
```

再写本 skill 独特价值 ≤3 句, 每句 ≤30 字. 每句 MUST 含至少一个具体名词 (工具名 / 场景名 / 输入输出格式) 用以可机检"是否空话". NEVER 写 "更快 / 更好 / 更优雅 / 更轻量" 这类无名词形容词句.

### §1.5.5 用户签字 + 写入

签字协议见 §1.5/§1.6 共同约定. 写入位置 + 模板见同节. 不动 frontmatter, 不加 `related:` 字段.

## §1.6 使用技巧

### §1.6.1 入场公告 (必须明确, 不沉默触发)

AI 输出:

```
下面给 SKILL.md 加一段 §使用技巧 (作者经验 / 推荐者经验).
我基于本会话起 3-5 条引导问, 你逐条作答.
  - 单条 'skip' → 该子段不收录
  - 'skip all' → 整段跳过, 写"暂无 (推荐者跳过)"占位
[回车] 开始 / [skip all] 跳过
```

`skip all` → 跳到 §1.6.4 写空占位; 其他 → 进 §1.6.2.

### §1.6.2 AI 起草引导设问 (≥3 ≤5 条)

输入: 本会话上下文 (skill 行为 / 边界 / 失败 / 决策) + `description` + (B/C 时) `source_url` README. 输出 3-5 条问, 每条标注子段:

| 子段 | 设问示例 |
|---|---|
| 材料方案 | "你做这个 skill 时考虑过 A/B/C 哪些做法? 为什么选 A?" |
| 推荐用法 | "第一次跑这个 skill, 你建议先做 X 还是 Y?" |
| 已知限制 | "你之前提到 <场景>, 现在跑不动还是修了?" |

约束:
- MUST 具体命名当前 skill 的能力 / 场景 / 边界
- NEVER 出空问 — "你有什么经验 / 哪些场景适合" 全删 (反过来让发布者自写采访稿)

### §1.6.3 用户作答 + AI 整合

AI 一次列出问, 用户顺序作答 (短/长皆可) / 单条 `skip` / `skip all` / 答完回 `done`. **AI 不追问.**

整合 → §使用技巧 markdown 3 子段 (模板见 `templates/section-使用技巧.md`). 整合约束:

- ✅ 保留具体名词 (skill / 工具 / 场景), 短句, 每子段 ≤3 bullet, 全段 ≤9 bullet ≤500 字
- ❌ 不加料 (用户没说的不写) / 不丢信息 (边界 / 痛点必收) / 不空话 / 不引用 §1.5 内容
- 超限 (>500 字 / >9 bullet / 单子段 >3 bullet) → AI 主动压缩并告知用户. 告知时 MUST 说明压缩前 bullet 数 → 压缩后 bullet 数, 以及哪个子段被砍最多 (例: `"压缩 11→9 bullet, 主要砍'材料方案' 4→2 (合并 A/B 同类做法)"`)

某子段 0 条 → 写"暂无". 整段空 → "暂无 (推荐者跳过)" 占位.

### §1.6.4 用户签字 + 写入

签字协议见 §1.5/§1.6 共同约定. 写入位置见同节. 不动 frontmatter.

## §1.7. 发布预览门禁 (阻塞, 所有路径 PR 必跑)

在 §2/§3/§4/§5 的 PR 步骤里, **commit 之后**, **`gh pr create` 之前**, MUST 输出最终预览给用户, 拿到 `[1]` 显式确认才继续. 不允许跳过, 不允许"我心里过一遍就发".

### §1.7.1 渲染 PR body

MUST 从 `templates/pr-body.md` 按 `variant=` (own / external / add-case) + (external 时) `entry=` (B / C) 完整渲染, 填齐每个 `{占位符}`. NEVER 自写简化版 (`## Summary / ## Validation / ## Test plan / ## Publish notes / ## Rollback` 这些是 GitHub 通用 PR 习惯写法, 不是本 skill 模板段, 一概禁用).

### §1.7.2 自检清单代评估

对 `templates/pr-body.md` 里 variant 对应的"自检清单 (作者勾)"逐项评估:

- AI 能直接判定 (eg 文件存在 / frontmatter 字段齐 / README 含 4 段) → 自己勾 `- [x]`
- AI 不能判定 (eg "本地 dogfood 至少跑过 1 次") → 留 `- [ ]` 并在预览里**显式列出**让用户回答 / 跳过 / N/A
- N/A 项 → 改 `- [~] N/A — <一句原因>`

不允许把没勾的项偷偷换成"已勾"; 不允许把整段自检清单从 PR body 删掉.

### §1.7.3 风险点自动检测

至少检测:

- **本地校验 vs 公司库规范冲突**: 本地源码 frontmatter 是否含 `metadata:` 嵌套 (适配 Codex `quick_validate`), 公司库副本是否展开为顶层 `version / author / updated_at / origin`. 有差异 → 在 PR body 风险点段写: "本地源码保留 metadata 嵌套以通过 Codex quick_validate; 公司库副本展开为顶层字段以符合 own-skill frontmatter 规范." 不靠 reviewer 自行发现.
- **目标目录已存在同名 skill**: 更新分支 (frontmatter 含 `published_to`) → 是预期; 否则 → 报警, 让用户确认是不是要覆盖.
- **PR body 引用了不存在的文件 / 图**: 模板里写 `_assets/<recommender>.png` 但 cases/_assets/ 里没这文件 → 风险点列出.
- **frontmatter 字段冲突**: own 路径出现 `source_url`, 或 external 路径缺 `source_url` → 风险点列出.

无风险 → 风险点段写 `- N/A`. NEVER 整段删除.

### §1.7.4 预览输出格式

```text
=== 发布预览 (阻塞门禁 §1.7) ===
路径: {A own | B external in-context | C external cold-start | D add-case}
目标目录: {own-skills/<name>/ | external-skills/<name>/ | external-skills/<name>/cases/<recommender>.md}
分支: {branch-name}
版本变化: {first publish | 0.1.0 → 0.1.1 (patch) | N/A (external/add-case)}

PR title: {title}

PR body (从 templates/pr-body.md variant={...} 渲染):
---
{完整 body markdown — 每段标题原样保留}
---

文件变更 (git diff --name-status main):
  {A/M/D} {file1}
  {A/M/D} {file2}
  ...

frontmatter (公司库副本 SKILL.md):
  {yaml}

§1.5 同类对比 摘要 (own/external 路径): {1 句 / "暂无"}
§1.6 使用技巧 摘要 (own/external 路径): {1 句 / "暂无 (推荐者跳过)"}

自检清单完成度: {勾 X / 共 Y / N/A Z}
未勾项 (需用户回答): {逐条列出, 或写"无"}

风险点 (自动检测结果): {列出, 或写"N/A"}

[1] 确认发, 跑 gh pr create
[2] 我改 X (你给指示, AI 改后**重新跑 §1.7**)
[3] 取消, 不发 (git checkout main && git branch -D <branch>)
```

### §1.7.5 阻塞规则

- 拿到 `[1]` → 进 `gh pr create`
- 拿到 `[2]` → 改后**重新跑整个 §1.7** (不能跳过第二次预览)
- 拿到 `[3]` → 清分支, 退出本次发布, dogfood log 写 `event=publish_canceled_at_preview`
- 用户沉默 / 超时 / 给出非 `[1] [2] [3]` 回复 → MUST NOT `gh pr create`, 重问一次

NEVER 在拿到 `[1]` 之前 `gh pr create`. NEVER 拿到 `[2]` 后改完直接发 — 必须重新预览.

## §1.8. 发布后回查 (阻塞, 所有路径 PR 必跑)

`gh pr create` 成功后 MUST 立即跑回查, 全 pass 才向用户报"发布完成". 不允许直接说"PR 开好了, 任务完成".

### §1.8.1 抓 PR 状态

```bash
PR_URL=<上一步 gh pr create 返回的 URL>
PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
gh pr view "$PR_NUM" --json title,body,state,files
```

### §1.8.2 机检项

| 检查项 | 通过条件 | 失败动作 |
|---|---|---|
| **模板段标题完整** | body 含全部必备段 (见下表) | `gh pr edit "$PR_NUM" --body "$(从 templates/pr-body.md 重新渲染)"`, 再回 §1.8.1 |
| **不含通用习惯写法** | body **不含** `## Summary`, `## Validation`, `## Publish notes`, `## Test plan`, `## Rollback` 等 GitHub 通用段 | 同上 |
| **files 范围正确** | 文件路径只在预期目录 | 报错给用户, 让用户检查是不是 cp 出问题; NEVER 静默继续 |
| **state = open** | gh 返回 state=OPEN | 报错; 若已 MERGED 说明跳了 §1.7 直接 push, dogfood log 标 `gate_skipped` |

必备段表:

| 路径 | 必备段 (按出现顺序) |
|---|---|
| A (own) | `## 元信息`, `## 自检清单 (作者勾)`, `## 不在范围`, `## 风险点` |
| B/C (external) | `## 元信息`, `## 推荐理由摘要`, `## 案例文件`, `## 自检清单 (作者勾)`, `## 不在范围`, `## 风险点` |
| D (add-case) | `## 元信息`, `## 推荐理由摘要`, `## 自检清单 (作者勾)`, `## 不在范围`, `## 风险点` |

files 范围:

| 路径 | 允许的文件前缀 |
|---|---|
| A | `own-skills/<name>/` |
| B/C | `external-skills/<name>/` (含 `external-skills/<name>/cases/`, `external-skills/<name>/cases/_assets/`) |
| D | `external-skills/<name>/cases/` (含 `_assets/`); **不允许**改 `external-skills/<name>/SKILL.md` |

### §1.8.3 回查输出格式

```text
=== 发布后回查 (阻塞门禁 §1.8) ===
PR: {url}
state: {open | ...}
模板段完整: ✓ / ✗ (列缺段)
不含通用习惯写法: ✓ / ✗ (列出违禁段)
files 范围: ✓ / ✗ (列出意外文件)

自动修复 (若发生): {列出修了什么 — eg "gh pr edit 重写 body 补齐 ## 风险点"}

任一项失败 → 已修复并重跑回查 / 待用户介入 (列出具体阻塞).
全 pass → 发布完成. dogfood log 已写. 可关闭本次任务.
```

### §1.8.4 阻塞规则

任一机检项失败 → MUST 修复 (能自动修就自动 `gh pr edit`, 不能就报给用户) → 重跑 §1.8.1. 全 pass 才允许向用户报"发布完成".

NEVER 跳过 §1.8 直接说"PR 开好了". NEVER 在 §1.8 失败时 dogfood log 标"成功".

## §2. 路径 A — own 直路发布

适用: 自己写的本地 skill, 没有 "推荐理由 / case" 概念, 直发.

### 步骤

1. **定位本地 skill**: 优先 `$TARGET_SKILLS_USER/<name>/SKILL.md` (按 §0 runtime), fallback `$TARGET_SKILLS_PROJECT/<name>/SKILL.md`. 读 frontmatter.
2. **检测发布历史**: frontmatter 含 `published_to: tranfu-labs/claude-skills` → 走"更新"分支 (步骤 4 bump); 否则走"全新"分支 (步骤 3).
3. **全新字段补全** — 缺啥 AI 自己补 / 推, 用户只确认:

   | 字段 | 来源 |
   |---|---|
   | `name` | 目录名 (kebab-case 校验) |
   | `description` | 询问用户 (≤100 字, MUST 含至少 1 条触发短语示例, 用引号标注, 例如 `"把 X 发到公司库"`) |
   | `version` | 默认 `0.1.0` |
   | `author` | `gh api user -q .login`, 询问是否改 |
   | `updated_at` | `date -u +%Y-%m-%d` |
   | `origin` | 写死 `own` |
   | `published_*` | **不写**, 步骤 7 才回填 |

4. **README.md 补全** — 读 `<local>/README.md`. 不存在 → AI 起稿后让用户确认; 存在但缺章节 → 补缺, 已有不动. 模板 4 段:

   ```markdown
   # <name>
   <1-2 句话, 它解决什么问题>

   ## 什么时候用它
   <具体场景>

   ## 怎么用 (触发示例)
   跟 Claude 说:
   - "<触发语 1>"
   - "<触发语 2>"
   - "<触发语 3>"

   ## 你会看到什么
   <跑完后的可观察输出>
   ```

4.5. **跑 §1.5 (同类对比) → §1.6 (使用技巧)** — 两段都写入 `<local>/SKILL.md`, 位置见 §1.5/§1.6 共同约定表. 整段一并 cp 进 own-skills/<name>/ (步骤 6).

5. **bump 决策 (仅更新分支)**:
   - 默认 patch +1 (0.1.0 → 0.1.1)
   - 用户显式 "bump minor" → +0.1.0 重置 patch
   - 用户显式 "bump major" → +1.0.0 重置 minor/patch
   - 跨 1.0.0 边界 (0.x.y → 1.0.0) **强提示**:
     > "1.0.0 大版本 bump, 需人手 review approve, 不能 self-merge.
     >  commit message 加 `[MAJOR]` 前缀."

6. **复制 + commit → §1.7 预览门禁 (阻塞) → `gh pr create` → §1.8 回查 (阻塞)**:

   ```bash
   cd ~/.tranfu-labs/claude-skills/
   git checkout main && git pull --ff-only
   git checkout -b "contrib/own-<name>-$(date +%s)"

   # 更新分支: 先清空再 cp
   [ -d "own-skills/<name>" ] && rm -rf "own-skills/<name>/"
   mkdir -p own-skills/
   cp -r "<local>/" "own-skills/<name>/"

   prefix=""
   [ "<is-major-bump>" = "true" ] && prefix="[MAJOR] "

   git add "own-skills/<name>/"
   git commit -m "${prefix}own/<name>: <≤70 字一句话>"
   ```

   **→ 进 §1.7 发布预览门禁 (variant=own)**. 拿到 `[1]` 确认才继续:

   ```bash
   gh pr create \
     --title "${prefix}own/<name>: <≤70 字>" \
     --body "$(从 templates/pr-body.md variant=own 完整渲染, 含 ## 元信息 / ## 自检清单 / ## 不在范围 / ## 风险点)"
   ```

   **→ 进 §1.8 发布后回查 (variant=own)**. 全 pass 才向用户报"发布完成".

7. **回填本地 frontmatter**:

   ```yaml
   published_to: tranfu-labs/claude-skills
   published_version: <步骤 5 决定的 version>
   published_at: <步骤 6 的 date>
   ```

8. **dogfood log** — 见 §Dogfood, entry=A.

## §3. 路径 B — external in-context 推荐 (6-state 对话机)

适用: 上下文里用过的某个 external skill, 想推给公司.

### B.1 REASON — 推测推荐理由

从上下文猜 1–2 个 `reason_kind` 候选 (枚举封闭集), 输出:

```
我猜你推荐它是因为:
  [1] solves-real-pain — 看起来你刚用它解决了 <具体痛点> ✓ (推荐)
  [2] time-saver
  [_] 其他, 你写一句:
```

`reason_kind` 枚举:

- `solves-real-pain` — 解决具体痛点
- `time-saver` — 显著节省时间
- `quality-jump` — 输出质量明显提升
- `unexpected-good-fit` — 用在原作者没明说但很合适的场景
- `discovered-elsewhere` — 从外部 (Twitter / 博客 / 朋友) 看到觉得值
- `team-need` — 同事最近做的事正好对口
- `other` — 自由文字进 case body, frontmatter 落 `other`

### B.2 CASE_IMMEDIATE — 整理已发生的会话案例

抓当前会话: 用户问了什么 (输入) / skill 做了什么 (输出) / 可引用截图路径 (问用户, **不静默 cp**).

按 `templates/case-file.md` 生成 draft, 输出给用户:

```
我从当前会话整理了一个案例草稿: <展示 markdown>
要这样吗?
  [1] 用这个 (默认)
  [2] 我改一改 (你给指示)
  [3] 我自己另写一个 (你写完贴给我)
  [4] 不要 immediate case, 等下一轮看看输出再决定
```

### B.3 PENDING_DEFERRED — 延迟案例

**不引入任何 Claude Code hook**. AI 在每轮自然响应**末尾**自检 4 条:

```
a. 本轮用户输入是否明确转移话题? (eg "好换个话题") → 是, 不打扰, 等下一轮
b. 本轮 AI 输出是否产生显著产物 (代码 / 文档 / 决策 / 图)? → 是, 继续
c. 是否过了 ≥1 轮自然结束? → 是, 继续
d. 用户当前情绪是否在收尾 (eg "好的" / "ok" / "谢谢")? → 是, 此时插话最合适
```

满足 b + c + d → 末尾轻量插一句:

```
(题外: 刚才你说要给 <skill> 加案例. 这一轮的 <产物概述> 加进去挺合适.
 做成第二个案例吗?  [y] [n] [skip-this-one])
```

- `y` → B.4
- `n` → 关闭 pending, 进 B.5
- `skip-this-one` → 不关闭 pending, 但本轮不再问

**超时规则**: pending 累计 2 轮自检触发条件未满足 → 自动关闭, 进 B.5 (避免几小时后跳出来问). 自动关闭时 MUST 在该轮末尾插一句告知用户: `(延迟案例窗口已关闭 — 2 轮自检未触发. 如需补 case 请重新触发: "给 <skill> 加个案例" 走 D 路径.)`
**状态丢失**: 用户清屏 / 切会话 → pending 自然消亡 (不持久化).

### B.4 CASE_DEFERRED

同 B.2 流程生成第二份 case body, **append** 到同一个 `<recommender>.md` (见 §6, 不开新文件). 进 B.4.5.

### B.4.5 §1.5 → §1.6

跑 §1.5 (同类对比) → §1.6 (使用技巧, 基于**推荐者**使用经验, 非原作者代答). 草稿留待 B.5 写入 stub body. 进 B.5.

### B.5 PR (commit → §1.7 → create → §1.8)

```bash
cd ~/.tranfu-labs/claude-skills/
git checkout main && git pull --ff-only
git checkout -b "recommend/<name>-$(date +%s)"

# 1. 写薄指针 SKILL.md → external-skills/<name>/SKILL.md
#    frontmatter: name, description (≤100 字), version (upstream 或推断 0.1.0),
#                 author (upstream handle), updated_at, origin=external, source_url
#    body (薄指针, 不写完整 body):
#      "本 skill 由 tranfu-labs 推荐, 完整内容见 source_url.
#       首次 install 时由 install-skill 从 source_url 拉最新到目标 scope,
#       完成后回写本 stub 的 name/description/version. 推荐场景见 cases/."
#    然后 append B.4.5 起草的 §1.5 + §1.6 整段到 body 末尾.

# 2. case 文件 → external-skills/<name>/cases/<recommender>.md (按 templates/case-file.md)
# 3. 如有图: cp <local-image> external-skills/<name>/cases/_assets/<recommender>.png

git add external-skills/<name>/
git commit -m "recommend/<name>: <≤70 字>"
```

**→ 进 §1.7 发布预览门禁 (variant=external, entry=B)**. 拿到 `[1]` 才继续:

```bash
gh pr create --title "recommend/<name>: <≤70 字>" \
  --body "$(从 templates/pr-body.md variant=external entry=B 完整渲染)"
```

**→ 进 §1.8 发布后回查 (variant=external)**. 全 pass 才报完成.

### B.6 dogfood log

见 §Dogfood, entry=B, 额外字段 `case_count` / `deferred_case_offered` / `deferred_case_accepted`.

## §4. 路径 C — external cold-start (URL referral)

用户给一个 url, 不靠上下文. 5 state, 逐步问.

### C.1 FETCH

WebFetch url; 若不是直接 SKILL.md, 启发式找 `SKILL.md` / `README.md` / index 路径. 输出抓到的 name / author / description 给用户 y/n 确认.

### C.2 REASON — 一步步引导

```
你为什么觉得它值得推荐? 几个常见角度:
  [1] solves-real-pain (解决具体痛点)
  [2] discovered-elsewhere (从 X 平台看到觉得值)
  [3] team-need (同事 Y 最近在做的事正好对口)
  [4] quality-jump / time-saver / unexpected-good-fit
  [_] 自己说:
```

### C.3 SCENARIO

```
在什么场景下使用它最合适? (≤200 字)
  - 比如: 我们公司 <部门 / 角色> 做 <什么事> 的时候
  - 或: 个人 workflow 里替代了 <什么旧做法>
```

→ `scenario_tag` + case body 草稿.

### C.4 CASE_OPTIONAL

```
有没有具体例子想截图或贴日志? (可选)
  [1] 有, 我现在给路径 / 贴内容
  [2] 没有, 跳过, 这个 case 只写理由
```

cold-start 用户可能还没真用过 → case **可选**, 不强求.

### C.4.5 §1.5 → §1.6

跑 §1.5 (关键词从 fetched description 抓, 不从"我看到这个"硬挤) → §1.6.

**cold-start 设问注意**: 用户**没真用过**, "材料方案 / 已知限制" 子段更可能 skip. §1.6.2 设问基于 `source_url` README + C.2 REASON + C.3 SCENARIO, 不硬挤"你踩过哪些坑". 全 skip → 写"暂无 (推荐者跳过)"占位.

草稿留待 C.5 写入 stub body.

### C.5 PR (commit → §1.7 → create → §1.8)

同 B.5 文件操作, `variant=external, entry=C`. dogfood log `entry=C` (`case_count` 可能 = 0). stub body 末尾 append C.4.5 起草的 §1.5 + §1.6 整段.

commit 后 **MUST** 进 §1.7 预览门禁 (variant=external, entry=C) → 拿 `[1]` → `gh pr create` → §1.8 回查全 pass → 报完成. 不允许跳门.

## §5. 路径 D — 加案例 (case-only PR)

适用: 已存在的 external-skill, 用户也用过, 想加自己的 case.

### D.1 定位

```bash
ls ~/.tranfu-labs/claude-skills/external-skills/<name>/cases/
```

- skill 不存在 → 提示 "这个 skill 公司库还没有, 你想先推荐它吗? 转走 §3 (B 路径)"
- 存在 → D.2

### D.2 同名 case 检查

```bash
test -f ~/.tranfu-labs/claude-skills/external-skills/<name>/cases/<recommender>.md
```

- 存在 → 问 "你之前给这个 skill 写过 case, append 新场景还是覆盖?"
  - `append` (推荐, 见 §6) → D.3
  - `overwrite` → D.3 (新内容替换整个 body, frontmatter 保留)
- 不存在 → D.3 (`new`)

### D.3 跑 B.1 (REASON) + B.2 (CASE_IMMEDIATE)

**跳过 B.3 PENDING** (case-only 没"持续聊天 + 显著产物"上下文). **跳过 §1.5 / §1.6** (case-only 不改 SKILL.md).

### D.4 PR (case-only, commit → §1.7 → create → §1.8)

```bash
cd ~/.tranfu-labs/claude-skills/
git checkout main && git pull --ff-only
git checkout -b "add-case/<name>-<recommender>-$(date +%s)"

# 按 append / overwrite / new 操作 cases/<recommender>.md
# (不动 SKILL.md frontmatter)

git add external-skills/<name>/cases/
git commit -m "add-case: <name> / <recommender>"
```

**→ 进 §1.7 发布预览门禁 (variant=add-case)**. 拿到 `[1]` 才继续:

```bash
gh pr create --title "add-case: <name> / <recommender>" \
  --body "$(从 templates/pr-body.md variant=add-case 完整渲染)"
```

**→ 进 §1.8 发布后回查 (variant=add-case)**. 全 pass 才报完成.

### D.5 dogfood log

见 §Dogfood, entry=D, 额外字段 `case_op ∈ {append, overwrite, new}`.

## §6. case 文件的多场景 append 规则

同一个 recommender 对同一个 skill **只有一个 case 文件** (`<recommender>.md`). 想加新场景时:

- 不开新文件 (避免 `<recommender>-1.md` / `<recommender>-tranfu.md` 这种碎裂)
- 直接 append 到 body 末尾, 用二级标题 `## <new scenario tag>` 起新段
- frontmatter 的 `recommended_at` 改为最新日期; `scenario_tag` 改为以逗号分隔多值 (eg `审稿,画图`)
- 单文件包含多场景, 阅读者看一个文件即可

## Dogfood log

每次 publish / add-case 完成后追加 JSON 行到 `<cache>/.dogfood-r1.log`. 字段:

| event | 必填字段 |
|---|---|
| publish (own) | ts, actor, event, skill, pr, origin=own, version, entry=A |
| publish (external in-context) | ts, actor, event, skill, pr, origin=external, entry=B, case_count, deferred_case_offered, deferred_case_accepted |
| publish (external cold-start) | ts, actor, event, skill, pr, origin=external, entry=C, case_count (可能 = 0) |
| add_case | ts, actor, event=add_case, skill, pr, entry=D, case_op ∈ {append, overwrite, new} |

写法示例:

```bash
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"actor\":\"$(gh api user -q .login)\",\"event\":\"publish\",\"skill\":\"<name>\",\"pr\":\"<url>\",\"origin\":\"own\",\"version\":\"<ver>\",\"entry\":\"A\"}" \
  >> ~/.tranfu-labs/claude-skills/.dogfood-r1.log
```

## Failure modes

- `gh auth status` 失败 → 让用户 `gh auth login`, 不代办 token
- `git pull --ff-only` 失败 (缓存冲突) → 提示用户处理, AI 不强 reset
- `gh pr create` 网络失败 → 提示晚点重试, 本地 commit 不丢
- `WebFetch` (路径 C) 拿不到 url → 询问用户换 url 或贴内容
- 路径 B/C 用户中途说 "算了不发了" → 不 commit, 清垃圾分支 (`git checkout main && git branch -D <branch>`)
- 路径 B 多 skill 上下文 AI 选错 → 用户回 n, 回 §1.2 重选
- origin 判定错误 → 用户回正后转对应路径
- 延迟案例自检规则误触发 (问得不是时候) → 用户回 n, dogfood log 记 `case_offer_rejected`
- `cp -r` 失败 (磁盘满 / 权限拒绝) → 告知用户原始错误信息, 不继续后续步骤 (commit/PR), 让用户修复后重新触发本 skill
- `git commit` 被 hook 拒绝 (lint / commit-msg / 签名) → 告知用户 hook 报错, NEVER 自行 `--no-verify`, 让用户修复 hook 失败项后重新触发

## What NOT to do

- ❌ 不反向问用户填字段 — frontmatter 缺啥 AI 自己补全 / 推断, 用户只**确认 / 纠正**
- ❌ 不直 push main, 必走 PR
- ❌ PR body 不塞 risk / test plan / rollback 段 (产品仪式)
- ❌ 不在 PR 标题塞 emoji
- ❌ 不调子 LLM (Task tool) — 按字面跑 bash
- ❌ 用户没说 "bump major" 时不自动 bump major
- ❌ 场景 B 多 skill 上下文里 "挑一个最近的" 私下默认 — 必须出选项 (§1.2)
- ❌ origin 不确定时硬猜 — 必须问用户 (§1.3 矩阵末项)
- ❌ `reason_kind` 留空白; 自由文字也必须落 `other`, 自由文字进 case body
- ❌ cold-start (C) 一上来就要 url 之外的 5 个字段 — 必须逐步问 (FETCH → REASON → SCENARIO → CASE_OPTIONAL)
- ❌ pending case 挂超过 2 轮自检未触发还不关闭
- ❌ 用任何 Claude Code hook (PreToolUse / Stop / SessionStart) 实现延迟案例 — 必须 AI 自律
- ❌ own-skill (A) 给 SKILL.md frontmatter 加 source_url / recommend_reason
- ❌ external-skill (B/C/D) 给 SKILL.md frontmatter 塞 recommend_reason (内容在 case 文件)
- ❌ external 推荐的 SKILL.md stub 写完整 body (违反"薄指针", install-skill 才从 source_url 拉)
- ❌ 给 own-skill 写 case 文件 (own-skills/ 不引入 cases/)
- ❌ case 文件改既有 skill 的 SKILL.md frontmatter
- ❌ 同一 recommender 对同一 skill 开多个 case 文件 (强制 append 到 `<recommender>.md`, 见 §6)

**§1.5 / §1.6 共通禁条**:

- ❌ path-D (add-case) 触发任何一段 — case-only PR 不动 SKILL.md
- ❌ frontmatter 加 `related` / `peers` / `similar` / `has_tips` / `tips_summary` 字段 — body section 即可, search-skills 契约不动
- ❌ 空话 ("更快 / 更好 / 更优雅 / 更轻量") — 必须具体到能力 / 场景 / 输入输出
- ❌ 0 命中 / 用户全 skip 时编造内容 — 直接写"暂无" 或 "暂无 (推荐者跳过)"
- ❌ 跨 skill 自动 backlink ("X 提到 Y" → Y 自动回链) — 单向跳转, 留给读者

**§1.5 专项**:

- ❌ 外部 URL 写硬编死链 — 必经 WebFetch 验活, 不写自己编的 URL

**§1.6 专项**:

- ❌ 设问空泛 ("你有什么经验吗 / 有什么补充") — 必须具体到能力 / 场景 / 边界
- ❌ 设问 >5 条 (发布者烦躁阈值)
- ❌ 整合时加料 (用户没说"更快" AI 写) / 丢信息 (用户说边界 AI 没收)
- ❌ 引用 §1.5 内容 — 横向 / 纵向焦点严格区分, 两段互不引用
- ❌ 二次访问追问 (一次发布期内采访一次, 不延迟跟进)
- ❌ 整段超长 (>500 字 / >9 bullet, 每子段 >3 bullet)

**§1.7 / §1.8 发布门禁专项 (PR #37 教训)**:

- ❌ 跳过 §1.7 直接 `gh pr create` — 任何情况都不行, 包括用户说"继续"
- ❌ §1.7 没拿到 `[1]` 显式确认就 `gh pr create` (沉默 / `[2]` 改完后未重新预览都算)
- ❌ §1.7 预览里用 `## Summary / ## Validation / ## Publish notes / ## Test plan / ## Rollback` 这些 GitHub 通用 PR 习惯写法替代 `templates/pr-body.md` 模板段
- ❌ §1.7 自检清单偷偷少勾几项 / 整段从 PR body 删掉 / 把没勾的项谎报"已勾"
- ❌ 跳过 §1.8 直接说"PR 开好了, 任务完成" — 必须 `gh pr view` 机检模板段完整 + files 范围 + state
- ❌ §1.8 失败 (eg 模板段缺失) 不修就向用户报"发布完成"
- ❌ 把"`gh pr create` 成功 / PR open" 当完成标准 — 完成 = §1.7 pass + create + §1.8 pass
- ❌ 把用户"继续 / 你帮我完成 / 代填吧"理解为"AI 跳过模板和门禁直接 push" — 用户授权 ⊂ 决策权, 不 ⊂ 流程门禁
- ❌ 本地校验 (Codex `quick_validate` / 其他) 与公司库 frontmatter 规范冲突时, 临场判断后**不**在 PR body `## 风险点` 段明示

## 与其他 meta-skill 的关系

- 不调用 search-skills / install-skill / update-skills
- update-skills pull 到本 PR merge 后内容; install-skill 装该 external skill 时, cases/ 一并 cp 到目标 scope
- search-skills 只搜 SKILL.md frontmatter, **不**搜 case 内容
