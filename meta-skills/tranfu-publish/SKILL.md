---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐外部 skill URL 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 按当前 CI gate 准备并提交 tranfu-skills PR: validator hard gate 包括 SKILL.md frontmatter、现有/新增 cases 格式、安全扫描; build:index 会把 README/cases/output 等已有文件和 external source_url 暴露到 catalog, 但缺失不阻塞. 用户确认后才 git push / gh pr create. Do NOT trigger when search / install / list / update / uninstall / doctor.
version: 0.2.1
author: aquarius-wing
updated_at: 2026-05-30
origin: meta
type: meta
---

# tranfu-publish

把本地写的 / 推荐的 / 需要补案例的 skill 发到 `tranfu-labs/tranfu-skills` 走 PR.

本 skill 的内容门禁只对齐当前 CI. 要区分两层:

- **validator hard gate**: 不满足会挂 CI.
- **catalog surface**: `build:index` 会展示/分发已有文件或字段, 但缺失不会挂 CI.

## CI Gate 边界

### 会阻塞发布的项

1. **发布安全门禁**: 不直推 `main`, 不 force push, 不手动提交 `index.json`, 用户确认后才写公司库文件 / push / 开 PR.
2. **CI hard gate**: 以 `.github/workflows/build-index.yml` 和 validator 代码为准:
   - `validate-frontmatter`: `SKILL.md` frontmatter 有 6 个非空字段: `name`, `description`, `version`, `author`, `updated_at`, `origin`; `description` 长度 ≤ 1024.
   - `validate-cases`: 只有当 skill 目录下存在 `cases/` 时才检查. `cases/` 下只能有数字目录、`README.md` 或 legacy `*.md`; legacy `*.md` 是 ERROR; 数字目录不能 leading zero, 且必须有非空 `input/` 和 `input/PROMPT.md`.
   - `validate-security`: 扫 `.mjs/.js/.ts/.sh/.py`, 禁 `eval`, `Function`; `child_process` 需 `allow_exec: true`; `curl|sh` / `wget|sh` 需 `allow_curl_pipe_sh: true`.
   - `validate:vt`: PR 上跑. 无 secret / 限流 / 网络错误是 warning; `malicious >= 3` 才阻塞.
3. **catalog sanity**: `npm run build:index` 在 PR 上跑. 它会递归收 `files: listFiles(skillDir)`, 所以 `README.md`, `cases/...`, `output/...`, `templates/...` 等已有文件会出现在 `index.json` / catalog. external 的 `source_url` 只有写了才会进 catalog 字段.

### 不再阻塞发布的项

- `README.md` 是否存在.
- README 是否有 `## 同类 Skill 对比` / `## 使用技巧`.
- `source_url` 是否存在或 HTTP 200.
- `PROMPT.md` 是否是真实用户口吻、是否含触发关键词.
- `cases/<n>/output/` 是否存在.
- PR body 是否使用固定 section 名.

这些项可以补, 但不能因为缺失而中止. 缺失时在预览和 PR body 的"catalog surface / 风险点"里讲清楚: 例如没有 cases 就不会在 catalog files 里出现 case 示例, 没有 README 就不会展示 README 文件.

## 路径

| path | 触发 | CI 需要保证 | 非阻塞建议 |
|---|---|---|---|
| **own** | "发布本地 X" / "publish X" | `own-skills/<name>/SKILL.md` frontmatter 过 validator; 如果带 `cases/`, 全部 case 格式过 validator; 安全扫描过 | README、cases、output 存在就会进 catalog `files`; README 辅助 section 是质量建议 |
| **external** | "推荐 URL" / "把这个推到公司库" | `external-skills/<name>/SKILL.md` frontmatter 过 validator; 如有代码/脚本则安全扫描过 | `source_url` 写了会进 catalog 字段; README/cases/output 存在就会进 catalog `files`; HTTP 验活和上游状态是质量建议 |
| **case** | "加案例 / 补用法" | 新增 `<own|external>-skills/<name>/cases/<n>/input/PROMPT.md`; `n` 纯数字无 leading zero; 目标 skill 现有 `cases/` 也不能有 legacy/异常项 | 新 case 会进 catalog `files`; prompt 质量、附件、output 是质量建议 |

多 skill (URL/本地路径含 ≥2 `SKILL.md`): 自动全收, 一个 PR 可多 commit. 除非用户明确缩小范围, 不让用户重复选择.

## 模板

- `templates/pr-body.md` — PR body 骨架, 自检清单只放 validator hard gate, 单独说明 catalog surface.
- `templates/case-prompt.md` — 仅在创建 case 时使用; 写法建议和 CI 真实检查分开.
- `templates/section-同类对比.md` — README 可选辅助 section.
- `templates/section-使用技巧.md` — README 可选辅助 section.

旧 `case-file.md` 已 EOL; 不写 legacy `cases/<author>.md`.

## 详细参考

- `references/ci-checks.md` — 当前 CI / validator 的精确规则.
- `references/case-sources.md` — case prompt 来源建议; 全 miss 不再是 CI blocker.
- `references/hard-rules.md` — git 安全门禁 + validator hard gate + catalog surface / 质量建议边界.

## 标准流程

### 0. 工作区预检

1. 找 `$REPO` 和 `$SRC`.
2. 可选检查 `tfs update --check-only --json`; 失败或落后不阻塞当前发布, 只在风险点说明. 用户明确要求先升级时才升级并中止本轮.
3. 建任务列或普通计划均可; 任务列不是发布 gate.

### 1. 定位 `$REPO` + `$SRC`

**`$REPO`** = 公司库本地 clone. 检测优先级:
1. 用户原话给的 path.
2. cwd 含 `.git` 且 `git remote -v` origin 指向 `tranfu-skills`.
3. `~/work/tranfu-skills`.
4. 都没找到: 提示 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills`, 中止.

**`$SRC`**:
- own: 用户原话 / 本地路径 / `~/.claude/skills` 等常见目录中含 `SKILL.md` 的 skill.
- external: URL 是推荐来源; 公司库只需要薄 `SKILL.md`. `source_url` 推荐写; validator 不要求, 但写了会进入 catalog 字段.
- case: `$REPO/<own|external>-skills/<name>/`; 计算 `cases/` 已有最大数字, `n = max + 1` (也可用空缺号).

### 2. 识别 path

按顺序匹配:

| 信号 | path |
|---|---|
| HTTP URL (github / gitlab / npm) | external |
| 关键词 "加案例 / 补用法 / 加 prompt 示例" | case |
| 本地 fs path 且含 `SKILL.md` | own |
| `$REPO/<own|external>-skills/<name>/` 已存在 | case |
| 关键词 "推荐这个 / 推到公司库" | external |
| 关键词 "发布我写的 / 提我的 skill" | own |

全 miss 才问用户.

### 3. 准备 `SKILL.md` frontmatter

CI 只检查 6 字段非空 + `description <= 1024`. 这些约定推荐遵守, 但不要把 CI 没检查的项说成 CI blocker:

- own: `origin: own`, 首发通常 `version: 0.1.0`.
- external: `origin: external`, `version` 没上游值时填 `1.0.0`; `source_url` 推荐写但不属于 CI hard gate.
- meta: `origin: meta`.
- description 写"做什么 + 何时触发 + Do NOT trigger when", 并控制长度.

### 4. README / catalog files 处理

README 不是 validator hard gate, 但 `build:index` 会把已有 README 写进 catalog `files`:

- own: `$SRC/README.md` 缺失时不报错中止; 直接发布 `SKILL.md` 也可以. 如果已有 README, 建议带上, 因为 catalog files 会显示它. 可建议补 `## 同类 Skill 对比` / `## 使用技巧`, 但用户不补也能继续.
- external: README 可由 AI 起草, 也可以不写. 缺 README 不阻塞, 但 catalog files 也不会展示 README.
- case: 默认不动 README.

如果补 README, 可用 `templates/section-同类对比.md` 和 `templates/section-使用技巧.md`; 这些是协作质量建议, 不是 CI 要求.

### 5. cases 处理

CI 不是"所有 skill 必须有 case"; validator 只检查存在的 `cases/` 是否合规. `build:index` 会把存在的 `cases/...` 路径写进 catalog `files`.

- own: 如果 `$SRC` 没有 `cases/`, 不强制新增 `cases/1/`. 如果 `$SRC` 有 legacy `cases/*.md`, 必须迁到数字目录或删除, 否则 CI 会挂.
- external: 不强制 case.
- case: 因为用户目标就是新增 case, 需要写 `cases/<n>/input/PROMPT.md`; `n` 不能 leading zero.

`PROMPT.md` 内容质量建议见 `references/case-sources.md`. CI 只看路径和文件存在; 不检查真实口吻、触发关键词或 frontmatter.

### 6. PR title + body

**title**:
- 单 skill: `skill: 加 <name> (own | external | case)` ≤ 70 字符.
- 多 skill: `skill: 加 <name1>, <name2>, ... (<path_type> ×N)` ≤ 70 字符.

**body**: 按 `templates/pr-body.md` 渲染. 自检清单只列 validator hard gate; README/cases/output/source_url 放到"catalog surface"; prompt 质量/HTTP 验活放到"风险点"或"质量建议".

### 7. 预览门禁 (安全门禁)

写 `/tmp/tranfu-publish-preview-<timestamp>.md`, chat 发摘要 + 文件路径. 摘要必须区分:

- CI hard gate: frontmatter / cases / security / VT 是否预计通过.
- catalog surface: README、cases、output 是否会进入 `index.json` files, external `source_url` 是否会进入 catalog 字段.
- 质量说明: prompt 质量、HTTP 验活、上游维护状态等.
- 风险点: 上游稳定性、脚本权限、缺少示例等.

用户明确确认 `[发布]` 后才进入提交. `[改]` 先修改再重新预览. `[取消]` 中止.

### 8. 提交

按 path 改动:

| path | 改动 | git add |
|---|---|---|
| own | 写/复制 `own-skills/<name>/SKILL.md` 及用户确认要带的可选文件 | `own-skills/<name>/` |
| external | 写 `external-skills/<name>/SKILL.md` 及用户确认要带的可选文件 | `external-skills/<name>/` |
| case | 新建 `.../cases/<n>/input/PROMPT.md` (+ 选填附件/output) | 该 case 目录 |

`index.json` 不手动 add / commit.

步骤:

1. 从最新 `main` / `origin/main` 切新分支 (`skill/<name>` 或批量分支).
2. 写文件.
3. 本地跑 `npm run validate -- --target <skill-dir> --json`; 改 validator 才需要额外跑 `npm test`.
4. `git add <path>` + `git commit`.
5. `git push -u origin <branch>`.
6. `gh pr create --base main --head <branch> --title ... --body-file ...`.

失败就报错, 不重试循环.

## 顶层 hard rules

- 不直推 `main`; 不 force push.
- 不手动提交 `index.json`.
- 用户确认前不写公司库文件、不 push、不开 PR.
- CI gate 只按 validator 真实规则判断; README/source_url/prompt 质量/output 不得作为阻塞项. 但 README/cases/output/source_url 的 catalog 暴露情况必须说明.
- 不写 legacy `cases/<author>.md`.
- 不接 router 意图: search / install / list / update / uninstall / doctor 留给 `tranfu-router`.

## 常用工具

`gh repo clone` / `gh api repos/<o>/<r>/contents` / `git switch -c` / `gh pr create` / `tfs list --json` / `npm run validate -- --target` / `WebSearch` / `WebFetch`.
