---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 起草 PR 内容 (frontmatter / README §同类对比 / README §使用技巧 / cases/<n>/input/PROMPT.md / PR title+body) 全部按 templates/ 渲染, 用户拍 [发布] 才走 gh pr create. 不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill).
version: 0.2.0
author: aquarius-wing
updated_at: 2026-05-28
origin: meta
type: meta
---

# tranfu-publish

把本地写的 / 推荐的 skill / 案例发到公司库 (tranfu-labs/tranfu-skills) 走 PR. 起草所有内容 → 用户审 → 用户拍 form `[发布]` 才提交.

参考 `README.md` 看框架图 / 路径概览. 本 SKILL.md 是完整步骤 + Hard rules.

## 触发判断

| 用户说 | path | 产物 |
|---|---|---|
| "发布本地 skill X 到公司库" | **own** | `own-skills/<name>/{SKILL.md, README.md, cases/1/input/PROMPT.md, ...}` |
| "推荐这个外部 skill (https://...) 到公司库" / "把这个 skill 推到公司库" | **external** | `external-skills/<name>/{SKILL.md(薄指针), README.md}`. skill 实际 body 不进公司库 |
| "给公司库 X 加使用案例 / 补一个用法" | **case** | 在 `<own|external>-skills/<name>/cases/<next-n>/input/PROMPT.md` 新建 |

**files 必备清单** (用于 §0 预检):

| variant | SKILL.md | README.md | cases/<n>/input/PROMPT.md |
|---|---|---|---|
| own | 必须 (frontmatter 6 项齐) | **必须** (缺 = 卡在 §0, 不自动起草) | **必须** (至少 cases/1/, 作者真实口吻 prompt) |
| external | 必须 (薄指针, frontmatter 6 项齐含 version) | 必须 (AI 起草) | 不需要 (后续可走 case path 补) |
| case | 不动 | 不动 | 必须 (新建 cases/<next-n>/, n = 已有最大 +1 或填空) |

**CI 强制项 — 不通过 = PR 不能合**:

- `validate-frontmatter`: 6 字段必填 `name / description / version / author / updated_at / origin`; description ≤ 1024 字符
- `validate-cases`: 不允许 legacy `cases/<recommender>.md` (cases.legacy-single-file = ERROR); 数字目录不能有 leading zero (`01/` → `1/`); 必须有 `cases/<n>/input/PROMPT.md`; `output/` 校验暂停 (TODO)
- `validate-security`: 不允许 `eval()` / `new Function()` / 引 `child_process` / `curl|sh` 模式. 引 `child_process` 需 `allow_exec: true`; `curl|sh` 需 `allow_curl_pipe_sh: true`

**多 skill 一次发**: 如果 URL 上游仓库 / 用户给的本地路径含 ≥2 个 skill (检测: 目录树里 ≥2 个 `SKILL.md` 或 `.md` frontmatter 含 `name:`), 自动**全收**, 一个 PR 多目录 / 多 commit. **不让用户选哪个**.

**不接** (留给 `tranfu-router`):

- search / install / list / installed / update / uninstall / doctor 意图

## 模板 (`templates/` — 渲染时必须用, 不自创结构)

| 文件 | 用途 | 路径 |
|---|---|---|
| `templates/pr-body.md` | PR body 骨架, 含 variant=own / external / case 三段 + 对齐 CI 校验的自检清单 | 三路径全用 |
| `templates/case-prompt.md` | `cases/<n>/input/PROMPT.md` 写法提示 (纯文本, 无 frontmatter, 真实用户口吻) | own · case · (external 选填) |
| `templates/section-同类对比.md` | **README.md** `## 同类 Skill 对比` section | own · external (落 README, 不落 SKILL.md) |
| `templates/section-使用技巧.md` | **README.md** `## 使用技巧` section | own · external (落 README, 不落 SKILL.md) |

NEVER 把模板段换成 GitHub 通用习惯写法 (`## Summary` / `## Validation` / `## Rollback`) — 它们对 reviewer 看似熟悉, 但本仓库 lark 通知 + lint workflow 都按模板段名读, 换名 = 静默失效.

旧 `templates/case-file.md` (含 recommender / reason_kind / scenario_tag frontmatter 的 case file) 已 EOL — 验证器不再认这种格式, 见下方 §5.

## 标准流程

### 0. 版本预检 (HARD — 早于 TaskCreate, 早于一切)

进 skill **第一件事**, 不许跳:

1. exec `tfs update --check-only --json`, parse `{self, skills, ...}`
2. 判定**落后** (任一为真):
   - `self` 非 null 且 `self.status === "outdated"` → CLI 自身落后
   - `skills[]` 里有项目 `name === "tranfu-publish"` 且 `status === "outdated"` → 本 skill 落后
3. **任一落后**:
   - exec `tfs update --json` (无 flag, 同时升 CLI + skill), parse 结果
   - 给用户 1 行人话: `已升级: tfs CLI X→Y / skill tranfu-publish (sha A→B)` (按实际填)
   - **中止本次流程**, 提示:
     ```
     本 skill 文件刚被覆盖, 当前对话加载的仍是旧版.
     请重新发一遍刚才的发布意图, 让 agent 重新 trigger 加载新版.
     ```
   - **NEVER 边升级边跑后续 §1+** — 即便已识别意图也不准继续
4. 全 noop → 进 §0.5

### 0.5. 启动 — 建 TaskCreate 任务列 + 预检 (HARD)

进 skill (版本预检通过后) `TaskCreate` 把流程列出来, 让用户从头看到进度.

固定 7 项任务 (按 path 微调措辞):

1. **预检 + 定位** — 找 $REPO + $SRC, own 路径 check $SRC 有 README.md (缺则报错中止, 不起草)
2. **识别 path + 检测多 skill** — own / external / case + 上游是否含 ≥2 个 skill
3. **起草 SKILL.md frontmatter + (external 路径) 薄指针 body** — 按 path 补全 6 字段; description ≤ 1024
4. **起草 README.md §同类对比 + §使用技巧** — own · external 必跑; case 跳过. own 路径若 $SRC README 缺这两段, append 到 README 末尾
5. **起草 cases/<n>/input/PROMPT.md (+ 选填 output/)** — own (必须 cases/1/) · case (必须 cases/<next-n>/); external 跳过. 来源优先级: 对话历史 → $SRC examples/ → legacy `cases/<author>.md` → 兜底 AskUserQuestion 问用户 (一句话 / 贴 md 路径 / placeholder)
6. **起草 PR title + body + 预览门禁** — 完整渲染 + form 等用户拍 [发布]
7. **拍 [发布] 后: 切分支 / 写文件 / commit / push / 开 PR**

**预检 hard rule**:

- own 路径 $SRC 没 `README.md` → **立即报错中止**, 提示用户:
  ```
  own 路径要求 $SRC/README.md 存在 (含 §同类 Skill 对比 + §使用技巧 两段).
  当前 $SRC=<path> 没有 README.md. 请先在本地写一份再回来.
  AI 不会自动起草 README — 因为它是给人看的入口, 必须作者亲自定调.
  ```
- own 路径 $SRC 有 README.md 但缺 §同类对比 或 §使用技巧 → 不中止, AI 在 §4 起草 append 进去 (内容由 AI 起草, 用户在 §7 预览审)
- own 路径 $SRC 没有 cases/1/input/PROMPT.md → 不中止, AI 在 §5 起草 (真实用户口吻, 含触发关键词)
- own 路径 $SRC 有 legacy `cases/<recommender>.md` → **必须先迁移**, AI 在 §5 自动迁: 把内容里能提炼的 prompt 提到 `cases/1/input/PROMPT.md`, legacy file 删除 (或 commit message 注明). 不能两个格式并存 (validate-cases.mjs cases.mixed-legacy-and-new = ERROR)
- external / case 路径不卡 README 预检

### 1. 定位 $REPO + $SRC

**$REPO** = 公司库 `tranfu-labs/tranfu-skills` 本地 clone path. 检测优先级:

1. 用户原话给的 path
2. 当前 cwd 含 `.git` 且 `git remote -v` origin 指向 `tranfu-skills`
3. 常见路径 `~/work/tranfu-skills`
4. 找不到 → 提示 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills` 再回来

**$SRC** = 本地 skill 源 path:

- **own**: 用户本地 skill 目录, e.g. `~/.claude/skills/<name>`. 用户原话 / `find ~/.claude/skills -name <name>` 定位
- **external**: 不需要本地拷贝. 用 `WebFetch` 验 source_url HTTP 200, `gh api repos/<owner>/<repo>/contents` 检测是否 multi-skill
- **case**: $SRC 即公司库内已有 skill 的 path, e.g. `$REPO/external-skills/<name>/`. 查 `cases/` 下已存在的最大数字目录, n = max+1 (或填空, e.g. 现有 1/, 3/, n=2 也合法 — validator 不强制连号)

### 2. 识别 path (尽量 AI 自判, 兜不住才问 form)

**AI 自判规则** (按顺序匹配, 第一条命中即定):

| 信号 | path |
|---|---|
| 用户原话给 HTTP URL (github.com / gitlab / npm / ...) | **external** |
| 用户原话给本地 fs path 且该 path 下有 `SKILL.md` | **own** |
| 用户原话给的 path 是 `$REPO/<own|external>-skills/<name>/` 已存在 | **case** |
| 用户说 "加案例 / 补用法 / 加用例 / 加 prompt 示例" 关键词 | **case** |
| 用户说 "推荐这个 / 推这个 / 推到公司库" 关键词 | **external** |
| 用户说 "发布我写的 / 提我的 skill / 上传我的" 关键词 | **own** |

全部 miss 才用 `AskUserQuestion` form 问 (3 选项: own / external / case + 各自一句描述).

**多 skill 检测**:

- **own**: $SRC 目录下是否有子目录各自含 `SKILL.md`
- **external**: source_url 上游 root 或 `skills/` 下是否 ≥2 个 `SKILL.md`
- **case**: 不检测

检测到 ≥2 → 后续 §3-§5 对**每个 skill 分别起草**, §6 PR title 改为 `skill: 加 <name1>, <name2>, ... (<path_type> ×N)`, §7 预览**所有 skill 一起展示**.

### 3. 起草 SKILL.md frontmatter / body

CI `validate-frontmatter` 校验 6 字段, 任缺一项 = ERROR.

**own** (`own-skills/<name>/SKILL.md`):

- `name`: 与目录名一致, kebab-case
- `description`: 含触发关键词 + "Do NOT trigger when" 段 (LLM 路由用), ≥ 2 句, ≤ 1024 字符
- `version`: 默认 `0.1.0`
- `author`: `gh api user -q .login`
- `updated_at`: `date -u +%Y-%m-%d`
- `origin: own` (写死, 不应有 `source_url`)

**external** (`external-skills/<name>/SKILL.md`):

- `name`, `description` 同上 (description ≤ 1024)
- `origin: external` (写死)
- `source_url`: **必填**, 指向上游 skill (HTTP 200, WebFetch 验过)
- `author`: 上游作者
- `version`: 上游若有则填, **没有就 fallback `1.0.0`** (CI 强制必填; 历史 claude-design-system 漏 version 被 #89 修过)
- `updated_at`: 上游若有则填, 否则用今天 `date -u +%Y-%m-%d`
- body: 薄指针, 含 "完整内容见 source_url" 引导

**case**: 不动 SKILL.md frontmatter.

缺则起草补全后给用户审, **不反向问用户**.

### 4. 起草 README.md §同类对比 + §使用技巧 (own · external 必跑, case 跳过)

按 `templates/section-同类对比.md` + `templates/section-使用技巧.md` 渲染, 落到 **README.md** (不是 SKILL.md). CI 不强制 README 内容, 但本 skill 政策强制 own 必有, external AI 起草补全.

**own**: 若 $SRC README.md 已含这两段, AI 评估内容是否符合模板要求 (≤3 候选 / ≤3 句独特价值 / 3 子段 etc), 不符就在 §7 预览给出 diff 建议. 若缺段 → AI 起草 append 到 README.md 末尾.

**external**: README.md 由 AI 起草 (含 §推荐场景 + §同类对比 + §使用技巧), 因为推荐者通常不写 README.

**§同类对比** 内容:

- 内部候选 (≤3): 跑 `tfs list --json` 看公司库现有 skill, 选最相近
- 外部候选 (≤3): web search "<关键词> claude skill / agent" 找外部对标; `WebFetch` 验活
- 独特价值: ≤3 句, 每句 ≤30 字, 具体到能力 / 场景 / 输出. NEVER "更快 / 更好 / 更优雅"

**§使用技巧** 3 子段:

- 材料方案: 用之前 user 该准备什么
- 推荐用法: 典型场景 + prompt 模板
- 已知限制: 不能做什么 / 边界 / 已知 bug

约束: 每子段 ≤3 bullet, 全段 ≤9 bullet ≤500 字.

### 5. 起草 cases/<n>/input/PROMPT.md

按 `templates/case-prompt.md` 渲染. 旧 `cases/<recommender>.md` 格式已 EOL (validate-cases.mjs `cases.legacy-single-file` = ERROR).

| variant | 必须? | 落点 | n 取值 |
|---|---|---|---|
| own | **必须** | `own-skills/<name>/cases/1/input/PROMPT.md` | 首发用 `1` |
| external | **不需要** | — | — (后续可走 case path 补) |
| case | **必须** | `<own|external>-skills/<name>/cases/<n>/input/PROMPT.md` | 已有最大 +1, 或填空缺号 |

**PROMPT.md 写法约束**:

- 纯文本, **不带 frontmatter** (新格式验证器不要求, 旧 recommender / reason_kind 概念已废)
- 1-3 句, 真实用户口吻 — 不写 AI 体 ("请基于 X 帮我生成 Y, 满足条件 1/2/3" = 错)
- 必须含**触发该 skill 的关键词** (router 用类似 prompt 做检索测试)
- 支撑材料 (截图 / 输入数据) 放 `cases/<n>/input/` 同级, PROMPT.md 里 `![](./xxx.png)` 引用

**来源优先级 (HARD — 不准 AI 现编)**:

按下面顺序找 case 材料, 第一条命中即用, 全部 miss 才问用户:

1. **当前对话历史里有触发该 skill 的真实 prompt** (用户原话) → 直接落 PROMPT.md, 1-3 句即可. 若该 skill 跑出来的输出也在对话里 → 落 `cases/<n>/output/` (见下方"output 落点")
2. **$SRC / 公司库 skill 自带 examples/ references/** → 提里面的真实场景到 PROMPT.md (改回真实用户口吻, 不照搬 doc 体)
3. **$SRC 有 legacy `cases/<author>.md`** (own 路径独有) → 提"怎么发现的 / 它做了什么"段落里的 prompt 信号, 落 `cases/1/input/PROMPT.md`, 旧 file 删
4. **以上都 miss** → **AskUserQuestion form 问用户**, 3 选项 + Other:
   - `[一句话]` — 用户在 form 里直接写 1-3 句真实 prompt (form Other 自由文字提交)
   - `[贴一个 md 路径]` — 用户给一个本地 .md 路径, AI 读完整内容当 PROMPT.md (允许带附件: AI 自动 `cp` 同目录所有 `.png/.jpg/.json/.txt/.csv` 到 `cases/<n>/input/`)
   - `[跳过 case, 用 placeholder]` — 仅 own 兜底, 写一行 `<TODO: 作者补一个真实使用 prompt>` 进 PROMPT.md 并在 PR body 风险点段标红; case 路径**不允许**走这条 (case 本身就是来加 case 的, 没 prompt 就不该开 PR)

**NEVER 在没有来源的情况下自己编 prompt 装作是用户口吻** — 这会污染 router 检索测试集.

**output 落点 (`cases/<n>/output/`)** — 推荐有, validator 暂不强制 (TODO):

- 来源优先级跟 input 一样, 先看对话历史是否有该 skill 跑出来的产物 (text / 文件路径) → `cp` 进 output/, 或 dump 文本到 `output/result.md`
- 多文件输出 (图片 + json + md 等) 全收, 文件名保留原名
- 没法收齐 → output/ 不建, AI 在 §7 预览风险点段标"output 缺, 未来补"; 不要建空 output/ (validator 会挂 `cases.missing-output` 一旦放开)
- 二进制大文件 (>1MB png / pdf) 可以放, 但走 git lfs 不在本 skill 范围, AI 提醒用户检查仓库大小阈值即可

**form 文案模板 (走 AskUserQuestion)**:

```
question: 给 <skill-name> 加 case 需要一个真实用户 prompt — 我在对话历史 / $SRC 里没找到, 请提供:
header: case PROMPT.md 来源
options:
  - [一句话]              我直接在 Other 里写 1-3 句真实 prompt
  - [贴一个 md 路径]      我给本地 md 文件路径, 你读内容 + 同目录附件全收
  - [跳过, 用 placeholder] 仅 own 首发兜底, 留 TODO 给我后补  (case 路径不出现这项)
```

**目录约束 (validate-cases.mjs)**:

- 数字目录不能有 leading zero (`01/` → ERROR `cases.leading-zero`)
- `cases/<n>/input/` 必须存在且非空, 必须有 `PROMPT.md`
- `cases/<n>/output/` 推荐有 (放预期产物), 验证器暂不强制 (TODO)
- 不能跟 legacy `cases/<author>.md` 并存 — own 路径若 $SRC 有 legacy file, §0.5 已要求迁移

**legacy 迁移 commit 约定 (own 路径独有)**:

- $SRC 有 `cases/<author>.md` 旧文件 → 来源优先级 §3 命中, 提 prompt 到 `cases/1/input/PROMPT.md`, 旧 file 删除. commit message 注明 `migrate legacy case <author>.md → cases/1/input/PROMPT.md`

### 6. 起草 PR title + body

**title**:

- 单 skill: `skill: 加 <name> (own | external | case)` — ≤ 70 字符
- 多 skill: `skill: 加 <name1>, <name2>, ... (<path_type> ×N)` — ≤ 70 字符

**body**: 按 `templates/pr-body.md` 选对应 variant 渲染, 填齐 `{占位符}`.

**自检清单**全部由 AI 据实判 + 据实勾, 对齐 CI 3 个 validator:

- own: README.md 存在 / README 有 §同类对比 / README 有 §使用技巧 / SKILL.md 6 字段齐 / cases/1/input/PROMPT.md 齐 / 无 legacy cases / 无 security 触发
- external: SKILL.md 薄指针 + source_url 有效 / 6 字段齐含 version / README 起草齐 / 有 §同类对比 + §使用技巧
- case: 不动 SKILL/README / 新 case 编号无 leading zero / cases/<n>/input/PROMPT.md 齐

勾法:

- 实际达成 → `- [x]`
- 实际没达成 → 老实留 `- [ ]`, 让 reviewer 看到卡点. **NEVER 偷偷勾上**
- 真不适用 → `- [~] N/A — 一句原因`

不留任何"需用户跑测试"项. 也不允许整段删自检清单.

### 7. 预览门禁 (HARD — 走 AskUserQuestion form, 不用 [1][2][3] 文字)

**完整渲染**写到临时文件 `/tmp/tranfu-publish-preview-<timestamp>.md`, 含: 所有 skill 的 frontmatter + README 新增段 + PROMPT.md 内容 + PR title + body. 告诉用户文件路径.

chat 里只发**简要摘要**:

```
=== 发布预览 ===
路径: own | external | case (×N if 多 skill)
分支: skill/<name>  (多 skill: skill/batch-<timestamp>)
目标目录 / 文件:
  - <列出每个 skill 的落点 (SKILL.md, README.md, cases/<n>/input/PROMPT.md)>

PR title: <title>

完整 markdown 渲染见: /tmp/tranfu-publish-preview-<timestamp>.md

§同类对比 摘要 (每个 skill 1 句, 仅汇报落到 README 的内容): <...>
§使用技巧 摘要 (每个 skill 1 句): <...>
PROMPT.md 摘要 (own/case 必有, 一句概括用户口吻): <...>

CI 校验自检 (3 个 validator):
  - frontmatter: <pass/fail/N 项缺>
  - cases: <pass/fail/有无 legacy 残留>
  - security: <pass/fail/triggered rules>

风险点 (自动检测): <列出, 或 N/A>
```

然后调 `AskUserQuestion`:

- question: "发布这 N 个 skill 到 tranfu-skills 公司库?"
- header: "发布预览"
- 3 选项:
  - `[发布]` — 确认, 跑完整提交流程 (Recommended)
  - `[改]` — 给我具体改动指示, 重跑本预览
  - `[取消]` — 中止, 不动公司库

**阻塞规则**:

- 拿 `[发布]` → 执行 §8
- 拿 `[改]` → 改后**重新跑整个 §7**
- 拿 `[取消]` → 中止
- form "Other" 自由文字 → 当 `[改]` 处理 (除非明确确认)

NEVER 在拿 `[发布]` 之前动公司库文件.

### 8. 提交 (仅 §7 拿到 [发布] 后执行)

按 path 决定改动 (多 skill: 对每个 skill 重复, 一个 commit per skill):

| path | 改动 | git add 目标 |
|---|---|---|
| own | `cp -r $SRC $REPO/own-skills/<name>/` (含 SKILL.md / README.md / cases/1/input/PROMPT.md / 其他作者带来的文件) | `own-skills/<name>/` |
| external | 写 `$REPO/external-skills/<name>/{SKILL.md, README.md}` | `external-skills/<name>/` |
| case | 新建 `$REPO/<own|external>-skills/<name>/cases/<n>/input/PROMPT.md`; 不动 SKILL.md / README.md | 该 case 目录 |

`index.json` **不要手动 add / commit** — CI (build-index.yml) 自动处理, push main 后发到 `catalog` release.

执行步骤 (TaskCreate 第 7 项):

1. 切分支: `cd $REPO && git checkout main && git pull --ff-only && git checkout -b skill/<name>` (多 skill: `skill/batch-<timestamp>`)
2. 写文件: 按上表
3. **本地预跑校验** (可选但推荐, 提前发现 CI 会挂的项): `npm run validate -- --target <skill-dir> --json` 看 results; 有 error 就回 §7 修
4. git add + commit: path-specific add + `git commit -m "skill: 加 <name> (<path_type>)"`. 多 skill 多 commit
5. push: `git push -u origin <branch>`
6. 开 PR (见 §9)
7. 输出 PR URL

### 9. 提 PR

```bash
gh pr create --base main --head $BRANCH \
  --title "<§6 起草的 title>" \
  --body "$(cat <<'EOF'
<§6 起草的 body>
EOF
)"
```

成功 → 输出 PR URL. 失败 (gh auth / network) → 报错 + **不重试**.

**PR 开完之后 CI 会自动跑** (`.github/workflows/build-index.yml`):

- `npm test` — validator 单元测试
- `npm run validate` (PR 是 changed-only, push main 是全量) — 3 个 validator: frontmatter / cases / security
- `npm run validate:vt` (PR) — VirusTotal 扫描 (有 secret 才有效, fork PR / 限流时 soft-fail 不阻断)
- `npm run build:index` — 重建 catalog

校验挂了:
- Lark + PR comment 都会按 validator 分组给错误明细 + 复跑命令
- 通常 1 行命令本地复现: `npm run validate -- --target <skill-path> --json`
- 修完 push 同分支即可, CI 自动重跑

## Hard rules

- ❌ **跳 §0 版本预检 = 违规** — 必须 npx 式强制检测 + 强制升级 + 升级后中止本轮让用户重 trigger
- ❌ **不静默走 `gh pr create`** — 必须用户从 §7 form 拍 `[发布]`
- ❌ **不直推 main** — 一定走 `skill/<name>` 或 `skill/batch-<timestamp>` 分支
- ❌ **不动公司库任何文件 until §8** — §1-7 全部是起草, 不写盘
- ❌ **§0 没建 TaskCreate 任务列就开始干活 = 违规**
- ❌ **own 路径 $SRC 没 README.md 不自动起草** — 报错让用户先写
- ❌ **§7 用 [1][2][3] 文字而非 AskUserQuestion form = 违规**
- ❌ **PR body 留"用户要勾"的项 = 违规** — 自检清单全 AI 判, 不要求用户跑测试
- ❌ **多 skill URL 让用户选哪个发 = 违规** — 自动全收
- ❌ **§同类对比 / §使用技巧 落 SKILL.md = 违规** — 必须落 README.md
- ❌ **external 路径强制 case = 违规** — external 不需要 case
- ❌ **own 路径不带 cases/1/input/PROMPT.md = 违规** — own 必须至少一个 case
- ❌ **写 legacy `cases/<recommender>.md` 单文件 = 违规** — CI `validate-cases.mjs` 会挂 (cases.legacy-single-file ERROR)
- ❌ **数字目录用 leading zero (cases/01/, cases/02/) = 违规** — CI cases.leading-zero ERROR
- ❌ **case PROMPT.md 写 AI 体 / 加 frontmatter = 违规** — 必须纯文本真实用户口吻
- ❌ **没来源时 AI 自己编 prompt 装作用户口吻 = 违规** — §5 来源优先级 4 条全 miss 必须 AskUserQuestion form 找用户要 (一句话 / md 路径 / placeholder 三选)
- ❌ **case 路径用 placeholder 兜底 = 违规** — placeholder 仅 own 首发可用, case 本身就是来加 case 的
- ❌ **SKILL.md frontmatter 缺 6 字段中任一 = 违规** — CI validate-frontmatter ERROR
- ❌ **description > 1024 字符 = 违规** — CI frontmatter.description-too-long ERROR
- ❌ **external 没 version = 违规** — CI 强制必填, 没上游版本就 fallback `1.0.0`
- ❌ **必须按 `templates/` 渲染** — 不允许换成 `## Summary / ## Validation / ## Rollback`
- ❌ **不要手动 add / commit `index.json`** — CI 处理
- ❌ **`gh` 失败 → 报错, 不重试**
- ❌ **不接 router 范围意图** (search / install / list / update / uninstall / doctor)
- ❌ **不跨仓 PR** — 只发到 `tranfu-labs/tranfu-skills`
- ❌ **永远不 force push**
- ❌ **不删现有 skill**

## 常用工具

- `TaskCreate` / `TaskUpdate` — §0 建任务列, 全流程跟踪
- `AskUserQuestion` — §2 path 兜底 + §7 预览门禁
- `gh repo clone / view` — 验公司库
- `gh api repos/<owner>/<repo>/contents` — external 检测 multi-skill
- `git checkout -b skill/<name>` — 切分支
- `gh pr create --base main --head <branch>` — 提 PR
- `tfs list --json` — 查公司库现有 skill 做同类对比
- `npm run validate -- --target <skill-path> --json` — 本地预跑校验 (§8 step 3 推荐)
- `WebSearch` / `WebFetch` — external 找外部对标 + 验活
