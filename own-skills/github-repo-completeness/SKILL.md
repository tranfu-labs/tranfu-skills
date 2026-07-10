---
name: github-repo-completeness
display_name: GitHub Repo Completeness
display_name_zh: GitHub 项目完备性
description: >
  GitHub 项目完备性检查与补全引导。扫描已有 repo，生成缺失清单，按优先级逐项引导用户补全。
  不直接生成所有内容，而是引导用户决策后再执行。
  Always trigger for: repo completeness, 项目完备性, 项目完善, 项目包装, project packaging,
  open source ready, 开源准备, github setup, 补全项目, project health, project checklist, 项目清单.
  Also triggers for: "这个项目还缺什么", "帮我完善项目结构", "准备开源".
  Do NOT trigger when: 写代码 / 修 bug / code review；从零起草需求或 PRD（走 write-spec）；
  scaffold 全新空项目骨架（走脚手架类 skill）；发版 / 打包发布版本（走 release）；
  发布 skill 到公司库（走 tranfu-publish）；部署上线（走 coolify-deploy）。
userInvocable: true
version: 0.3.0
author: aquarius-wing
updated_at: 2026-07-10
origin: own
---

# 项目完备性检查与补全

你是项目完备性顾问。你的工作是扫描项目当前状态，生成缺失清单，然后逐项引导用户决策和补全。

IMPORTANT: 你是引导者，不是生成器。NEVER 一次性生成所有缺失文件。MUST 逐项确认用户意图后再行动。

CREATE A TODO LIST FOR THE TASKS BELOW（开工前先建，逐步勾掉，NEVER 跳过第二步的用户确认门）:

1. 扫描项目，生成 P0–P3 缺失清单。
2. 展示清单，等用户选定要处理的项与优先级（确认门，MUST 停下等输入）。
3. 逐项引导补全（每项先问偏好/是否已装同伴 skill 再动手）。
4. 收尾：重跑第一步检查脚本，确认选中项无残留 MISSING/WEAK，汇总产物交用户最终确认。

## 第一步：扫描项目，生成清单

**前置 — 确认 cwd 是项目根**:

```bash
git rev-parse --show-toplevel 2>/dev/null
```

按命令的**退出码**分三条出口处理:

- **退出码 0 且返回路径 == pwd** → 正常, 是 repo 根, 往下走。
- **退出码 0 但返回路径 != pwd** → 当前是某 git repo 的**子目录**。提示用户:
  > 当前目录 `{{pwd}}` 不是 git repo 根 (实际根是 `{{toplevel}}`)。继续扫描只针对**当前子目录**, 不扫整 repo。确认继续? 或切到正确目录再跑。

  子目录场景 (monorepo 子包 / parent-tracked 的 sibling 项目) 合法, 但用户必须明确知道扫描范围。得到确认后再往下。
- **退出码 != 0（不在任何 git repo 内 / 无 git 命令）** → MUST 停下并提示, 不要盲扫:
  > 当前目录 `{{pwd}}` 不在 git repo 内 (或本机无 git)。完备性检查依赖 repo 上下文。要我仍按当前目录当作项目根扫描吗? 还是你先 `git init` / 切到正确目录?

  仅在用户明确确认后, 才把当前目录当项目根继续。

检查以下各项是否存在且质量达标。对每项给出状态：

| 状态 | 含义 |
|------|------|
| OK | 存在且质量达标 |
| WEAK | 存在但内容不足或过时 |
| MISSING | 完全缺失 |
| N/A | 不适用于此项目 |

### 检查清单

```bash
# 逐项检查（按优先级排序）

# P0 — 基础必备
[ -f "README.md" ]              && echo "README.md: exists" || echo "README.md: MISSING"
[ -f "LICENSE" ] || [ -f "LICENSE.md" ] && echo "LICENSE: exists" || echo "LICENSE: MISSING"
[ -f ".gitignore" ]             && echo ".gitignore: exists" || echo ".gitignore: MISSING"

# P1 — 协作规范
[ -f "CONTRIBUTING.md" ]        && echo "CONTRIBUTING.md: exists" || echo "CONTRIBUTING.md: MISSING"
[ -f "CODE_OF_CONDUCT.md" ]     && echo "CODE_OF_CONDUCT.md: exists" || echo "CODE_OF_CONDUCT.md: MISSING"
[ -f "CHANGELOG.md" ]           && echo "CHANGELOG.md: exists" || echo "CHANGELOG.md: MISSING"

# P2 — GitHub 配置
[ -d ".github/ISSUE_TEMPLATE" ] && echo "Issue templates: exists" || echo "Issue templates: MISSING"
[ -f ".github/pull_request_template.md" ] && echo "PR template: exists" || echo "PR template: MISSING"
[ -d ".github/workflows" ]      && echo "GitHub Actions: exists" || echo "GitHub Actions: MISSING"

# P3 — 项目元数据
# README badges（在 README 中检查 shields.io 或类似徽章）
# package.json 的 description/keywords/repository 字段
# GitHub repo 的 description 和 topics
```

对于存在的文件，MUST 用 Read 检查内容质量。下表给出**可观测判据**——OK/WEAK 的边界以这些可 grep / 可计数的信号为准，不靠主观感觉，避免每次运行结果漂移：

| 文件 | 达标含义 | OK 的可观测判据（全中=OK，缺一即 WEAK） |
|------|---------|------------------------------------------|
| README.md | 有描述、安装、示例、badge | 标题 (`#`) ≥ 3 个；含至少一个代码块 (```)；命中 badge 标记 (`img.shields.io` 或 `![`...`](`...`badge`...`)`)；首屏 ≤ 3 行内出现项目一句话定位 |
| LICENSE | 有效开源协议 | 非空；命中协议关键词之一 (`MIT` / `Apache License` / `GNU GENERAL PUBLIC` / `BSD` / `MPL`) |
| .gitignore | 覆盖主栈忽略项 | 命中 `.env` 或 `.env*`；命中主栈 build/依赖目录 (Node: `node_modules`；Python: `__pycache__` 或 `.venv`；Rust: `target`；Go: 二进制/`/bin`) |
| CONTRIBUTING.md | 有规范/搭建/流程 | 同时命中"提交/commit"、"环境/install/setup"、"PR/pull request"三类关键词 |
| CHANGELOG.md | Keep a Changelog 格式 | 命中 `## [` 版本块；命中 `Unreleased` 或 `Added`/`Changed`/`Fixed` 任一分类标题 |

## 第二步：展示清单，确认优先级

将扫描结果整理为表格展示给用户：

<example>
## 项目完备性清单

| 优先级 | 项目 | 状态 | 说明 |
|--------|------|------|------|
| P0 | README.md | WEAK | 存在但缺少安装步骤和使用示例 |
| P0 | LICENSE | MISSING | 未选择开源协议 |
| P0 | .gitignore | OK | 已覆盖 Node.js 常见忽略项 |
| P1 | CONTRIBUTING.md | MISSING | — |
| P1 | CODE_OF_CONDUCT.md | MISSING | — |
| P1 | CHANGELOG.md | OK | 格式规范 |
| P2 | Issue templates | MISSING | — |
| P2 | PR template | MISSING | — |
| P2 | GitHub Actions CI | MISSING | — |
| P3 | README badges | MISSING | 无 CI 状态、版本号等徽章 |

建议按 P0 → P1 → P2 → P3 顺序补全。要从哪项开始？
</example>

MUST 等用户选择要处理哪些项。NEVER 自动开始全部补全。

## 第三步：逐项引导补全

用户选择某项后，按以下模式处理：

### README.md（WEAK 或 MISSING）

询问用户：
> 你希望我直接帮你生成 README，还是你有特定的风格偏好？
> 如果你安装了 readme-generator skill，我可以调用它来生成。

- 用户有 skill → 引导使用对应 skill
- 用户无 skill 且无主张 → 进入下面分支

**所有写作 / 优化必须依据 [`references/readme-playbook.md`](references/readme-playbook.md)** — 结构 (15 节按需启用)、首句价值原则、措辞 5 类检查、反例清单都在那里. 不要在 SKILL.md 里复述.

#### MISSING — 从零生成
MUST SPAWN A SUBAGENT 来起草 README, 按下面模板直接开始, 不要自己在主线程里写。生成后 MUST 再走一轮第 5 节的 validation, 不直接交付。

```text
你是 README 起草者, 只负责按 playbook 生成一份 README 草稿。
读取并严格遵循: <项目绝对路径>/references/readme-playbook.md 第 6 节 (结构) + 第 1-4 节 (首句价值 / 措辞检查)。

项目信息 (运行时填):
- 技术栈: {技术栈}
- 仓库类型: {内部 / 公开 OSS / 文档型}
- 目标读者: {目标读者}
- 已有线索: {从 package.json / 现有片段提取的描述、命令}

范围与边界:
- 只产出 README.md 草稿文本, 返回给主线程, 不写入任何文件。
- NEVER 编造未提供的功能 / 命令 / badge; 不确定项标注 "需用户确认"。
- NEVER 改动 README 以外的任何文件。

输出: 完整 README.md 草稿 + 一行"哪些信息是占位/待确认"。
```

#### WEAK — 优化已有
按 `references/readme-playbook.md` 第 5 节的 micro-slice 流程:
1. 用第 1-4 节扫现状, 列 diff 表 (位置 / 现状 / 建议 / 理由)
2. 自反思 1 轮再提交给用户
3. 应用 1-3 处 Edit (不重写整文件), 启 fresh validation agent
4. 按 "必改 / 建议改 / 可不改" 分级处理, 重启 fresh agent
5. 止损: 最多 3 轮

### LICENSE（MISSING）

询问用户：
> 你打算用哪种开源协议？常见选择：
> - MIT（最宽松，适合大多数项目）
> - Apache 2.0（含专利授权）
> - GPL 3.0（强 copyleft）
> - 不确定 → 我可以根据项目类型建议

用户选择后直接生成。如果有 license-checker skill，引导使用。

### .gitignore（WEAK 或 MISSING）

按 [`references/gitignore-by-stack.md`](references/gitignore-by-stack.md) 处理:

- **栈识别**: 按第 2 节表格扫存在文件 (package.json / Cargo.toml / go.mod / pyproject.toml …) 推断主栈, 多命中即 monorepo (问用户是否拆 workspace-level .gitignore).
- **MISSING**: 必含段 (第 0 节) + 主栈段 (第 1 节对应小节) 拼接生成.
- **WEAK** (按第 4 节判定: 缺 `.env*` / 缺主栈 build 目录 / 缺 IDE 配置): **追加缺失段, 不重写**.
- 反例避开 (第 3 节): 别忽略 lockfile, 别用通配压掉有意义的 keep 文件.

### CONTRIBUTING.md（MISSING）

按 [`references/contributing-playbook.md`](references/contributing-playbook.md) 处理:

1. 问第 2 节的 5 个关键选择题 (Commit 规范 / 分支策略 / 审查人数 / 合并方式 / DCO). 用户无主张走默认 (Conventional Commits + Trunk-based + 1 approver + Squash + 无 DCO).
2. 用第 3 节通用模板填充用户的选项 + 项目实际命令 (从 package.json scripts / Makefile 推断 `{{install-cmd}}` / `{{test-cmd}}` / `{{lint-cmd}}`).
3. 按第 4 节变体裁剪: 内部仓删 Fork/DCO + 加联系人, 公开 OSS 加行为准则 link + first-time contributor 提示.
4. 反例避开 (第 5 节): 别堆套话, 别只列名字不给例子, 别说"任何贡献都欢迎"不给动作.

### Issue / PR 模板（MISSING）

按 [`references/issue-pr-templates.md`](references/issue-pr-templates.md) 处理:

1. 一次性问完 (第 4 节话术): 全套默认 / 最小集 (bug + PR) / 自定义.
2. 用 **Issue Forms (`.yml`)** 不用 Markdown 模板 — 强制必填.
3. 必含 `config.yml` 禁用 blank issues + 提供 Discussions / Security 联系入口 (第 1.4 节).
4. PR 模板用第 2.1 节骨架, 按仓库类型 (内部 / 公开 OSS / 文档型) 走第 2.2 变体提示.
5. 反例避开 (第 3 节): Issue 必填 ≤ 4 项, PR checklist ≤ 7 条, Security 不走公开 Issue.

### GitHub Actions CI（MISSING）

按 [`references/ci-recipes.md`](references/ci-recipes.md) 处理:

1. 用第 4 节话术问用户 — 完整 (lint + typecheck + test + build) / 最小 (只 test) / 自定义.
2. 按主栈套第 1 节对应 recipe (Node / Python / Rust / Go), 替换检测到的命令.
3. **必带** 第 0 节通用骨架: `concurrency` 段防冗余跑、pin action version 到 `@v4`+.
4. 公开仓 + matrix 慎用 (第 1.5 节警示), 默认单 OS 单版本.
5. **Path filter 陷阱** (第 2.1 节): 如果 workflow 是 branch ruleset 的 required check, 默认**不加 path filter**, 让它总跑.
6. 文件命名按第 5 节约定: 主 CI `ci.yml`, 发布 `release.yml`.

### Badges（MISSING）

根据已有 CI 和 package 信息，建议可添加的 badges：
- CI 状态（如果有 GitHub Actions）
- npm 版本（如果是 npm 包）
- License 类型
- 代码覆盖率（如果有测试）

### 收尾（逐项处理完后 MUST 执行，覆盖逐项与"全部按默认"两种路径）

1. 重跑第一步的检查脚本 + 质量表判据，确认**本轮选中处理的项**已从 MISSING/WEAK 转为 OK（未选的项不强求）。
2. 汇总本轮新增/修改的文件清单，连同关键内容摘要一并展示给用户做最终确认。
3. 若仍有项未达标，如实说明原因（缺信息 / 用户未定 License 等），不要静默标记完成。

NEVER 在没有这一步确认的情况下宣布"项目已完备"。

## 约束

- NEVER 一次性生成所有缺失文件——逐项确认，逐项处理。**唯一例外**：用户显式说"全部按默认"时可批量处理，但仍 MUST 走收尾步骤，在最后统一展示所有生成内容让用户确认。
- NEVER 替用户选择 License 类型——MUST 询问
- NEVER 生成与项目技术栈不匹配的内容（如给 Rust 项目生成 npm 相关配置）
- 如果用户已安装相关 skill（readme-generator、license-checker 等），优先引导使用而非重新生成

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [write-spec](../write-spec/SKILL.md) — 从模糊想法生成 PRD/feature spec; **本 skill 区别**: github-repo-completeness 扫描已有项目结构补漏 (README/LICENSE/CI/templates), write-spec 是从零起草需求文档
- [project-init-docs](../project-init-docs/SKILL.md) — 新项目从产品/项目/开发三段生成初始文档; **本 skill 区别**: github-repo-completeness 针对**已有 repo** 审计现状再逐项补漏, init-docs 是新项目冷启动产出整套文档, 二者都会生成 README/CONTRIBUTING 但触发时机 (已有 vs 冷启) 不同
- `release` (外部已装 skill) — 版本号/changelog/打 tag 发版; **本 skill 区别**: github-repo-completeness 只补"完备性"文件 (含一个空的 CHANGELOG 骨架), 不做版本号 bump / tag / 发布动作, 那是 release 的职责
- [tranfu-publish](../../meta-skills/tranfu-publish/SKILL.md) — 把 skill 发布到公司库; **本 skill 区别**: github-repo-completeness 处理的是普通 GitHub repo 的完备性, 与"把 skill 提交到 tranfu-skills"无关

### 外部世界
- [Claude-Code-Scaffolding-Skill (hmohamed01)](https://github.com/hmohamed01/Claude-Code-Scaffolding-Skill) — 在 IDE 里 scaffold 全新项目骨架; **本 skill 区别**: github-repo-completeness 针对**已有 repo** 做完备性审计 + 逐项补, 不创建空项目

### 本 skill 独特价值
- 输出 P0/P1/P2/P3 四级清单, 不一次性全生成
- 每项缺失先问用户偏好/skill 是否已装再动手
- 按技术栈 (package.json/Cargo.toml/go.mod) 推断 .gitignore + CI

## 使用技巧

> 由 tranfu-publish 引导起草 (作者签字). 帮助阅读者纵向上手.

### 材料方案
- 跑之前 cwd 必须是 git repo 根 (有 .git/), 否则扫描结果不准
- 单语言栈最稳; monorepo / 多语言混合时手动告诉 skill 主栈
- 已装 readme-generator / license-checker 等同伴 skill 时它会优先调用

### 推荐用法
- 第一次跑: 让它扫完 → 看 P0 行 → 只挑 1-2 项试
- 想批量: 说 "全部按默认", 最后会展示成品让你审
- License 不确定就让它给建议, 不要 "随便选 MIT"

### 已知限制
- 不会替你选 License (设计如此, 防误选)
- 不读 GitHub repo 远端 metadata (description/topics) 只能本地推
- Issue/PR template 是通用模板, 团队特定 checklist 要手动
