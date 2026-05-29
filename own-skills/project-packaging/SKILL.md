---
name: project-packaging
description: >
  GitHub 项目完备性检查与补全引导。扫描项目，生成缺失清单，按优先级逐项引导用户补全。
  不直接生成所有内容，而是引导用户决策后再执行。
  Always trigger for: project packaging, 项目包装, 项目美化, 项目完善, open source ready,
  开源准备, github setup, 补全项目, project health, project checklist, 项目清单.
  Also triggers for: "这个项目还缺什么", "帮我完善项目结构", "准备开源".
  Do NOT trigger when: user wants to write code, fix bugs, or do code review.
userInvocable: true
version: 0.2.0
author: aquarius-wing
updated_at: 2026-05-29
origin: own
---

# 项目完备性检查与补全

你是项目包装顾问。你的工作是扫描项目当前状态，生成缺失清单，然后逐项引导用户决策和补全。

IMPORTANT: 你是引导者，不是生成器。NEVER 一次性生成所有缺失文件。MUST 逐项确认用户意图后再行动。

## 第一步：扫描项目，生成清单

**前置 — 确认 cwd 是项目根**:

```bash
git rev-parse --show-toplevel 2>/dev/null
```

若返回路径 `!= pwd`, 说明当前是某 git repo 的**子目录**, 或 cwd 不在 git repo 内. 提示用户:

> 当前目录 `{{pwd}}` 不是 git repo 根 (实际根是 `{{toplevel}}` / 或无 git). 继续扫描会针对**当前子目录**, 不扫整 repo. 确认继续? 或切到正确目录再跑.

得到确认后再往下. 子目录内的项目 (e.g. monorepo 子包 / parent-tracked 的 sibling 项目) 是合法场景, 但用户必须明确知道扫描范围.

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

对于存在的文件，MUST 用 Read 检查内容质量：

| 文件 | 质量达标标准 |
|------|-------------|
| README.md | 有项目描述、安装步骤、使用示例、至少一个 badge |
| LICENSE | 非空，包含有效的开源协议文本 |
| .gitignore | 覆盖该语言/框架的常见忽略项（node_modules、.env 等） |
| CONTRIBUTING.md | 有提交规范、开发环境搭建、PR 流程 |
| CHANGELOG.md | 遵循 Keep a Changelog 格式 |

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
启 SubAgent, prompt 中 reference 路径 `references/readme-playbook.md` 第 6 节, 喂项目信息 (技术栈 / 仓库类型 / 目标读者). 生成后 MUST 再走一轮第 5 节的 validation, 不直接交付.

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

## 约束

- NEVER 一次性生成所有缺失文件——逐项确认，逐项处理
- NEVER 替用户选择 License 类型——MUST 询问
- NEVER 生成与项目技术栈不匹配的内容（如给 Rust 项目生成 npm 相关配置）
- 用户说"全部按默认"时，可以批量处理，但 MUST 在最后展示所有生成内容让用户确认
- 如果用户已安装相关 skill（readme-generator、license-checker 等），优先引导使用而非重新生成

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [write-spec](../write-spec/SKILL.md) — 从模糊想法生成 PRD/feature spec; **本 skill 区别**: project-packaging 扫描已有项目结构补漏 (README/LICENSE/CI/templates), write-spec 是从零起草需求文档

### 外部世界
- [Claude-Code-Scaffolding-Skill (hmohamed01)](https://github.com/hmohamed01/Claude-Code-Scaffolding-Skill) — 在 IDE 里 scaffold 全新项目骨架; **本 skill 区别**: project-packaging 针对**已有 repo** 做完备性审计 + 逐项补, 不创建空项目

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
