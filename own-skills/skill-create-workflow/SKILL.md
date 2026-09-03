---
name: skill-create-workflow
display_name: Skill Creation Workflow
display_name_zh: Skill 创建工作流
description: >-
  当用户的最终意图是产出一个全新的 Codex / Claude Code skill (一个新的 SKILL.md / skill 目录) 时触发。
  "新" 包括从零创建, 以及把尚未成型的文档、规则、事故复盘、经验教训、agent 工作流首次封装成 skill。

  触发判定按 "意图 + 上下文", 不按短语字典匹配:

  - 任何 "产生式动词 + skill" 的表达都算: 创建 / 新建 / 写 / 写成 / 做 / 做成 / 整成 / 封装成 / 包 / 起 /
    转成 / 沉淀成 + skill。同义动词由你自己泛化, 不必出现在本说明里。
  - 承接确认 算同一个意图: 上一轮对话已经在讨论某段内容是否值得做成 skill, 用户用
    "好 / 行 / 可以 / OK / 那就 / 嗯" 等承接词 + 产生式表达 (例如「好, 把它写成 skill」「行, 做成 skill 吧」
    「那就封装成 skill」) 给出同意时, 视同显式触发, 上文讨论的对象即为源材料。
  - 代词指代 ("它 / 这个 / 那个 / 这段 / 上面那个") + 产生式表达 已经把意图锚定到上文, 不要因为
    "没指定文件路径" 而拒绝触发, 应回头解析上下文。
  - 英文同理: turn X into a skill / make X a skill / let's skill-ify this / yeah make that a skill 等。

  代表性例子 (覆盖正式 / 口语 / 承接三种形态, 其余交给语义泛化):

  - "帮我把 docs/postmortem.md 创建成一个 skill"
  - "把它写成 skill"  (代词承接, 源在上文)
  - "好, 那就做成 skill 吧"  (承接确认 + 产生式动词)

  Do NOT trigger when: 用户只要 install / list / upgrade / uninstall skills, 创建 plugin,
  改普通项目代码, 写非 skill 文档, 或管理自动化任务。
version: 0.4.0
author: aquarius-wing
updated_at: 2026-09-03
origin: own
userInvocable: true
---

# Skill 创建工作流

## 核心职责

把用户的 skill 作者请求路由成一个可验证的创建或更新流程：先判断内容是否值得写成 skill，再框定任务域和边界，最后调用平台原生 skill 创建能力落盘，并用 `prompt-review` 复审到通过。


## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW:

1. 解析用户意图、目标平台和输入材料。
2. 检查必需能力是否可用。
3. 运行 `skill-content-fit` 做准入门禁。
4. 运行 `skill-domain-framing` 选择 skill 容器、命名轴和边界。
5. 补齐细节、边界、反例和验收标准。
6. 运行 `skill-creator` 创建或更新 skill 文件。
7. 运行 `prompt-review` 审核生成的 skill。
8. 运行 `tranfu-publish` 发布 Skill 到 Tranfu Skills。
9. 输出最终状态、路径、变更摘要和未验证项。

MUST update the TODO list after each step. NEVER report completion until step 7 returns `评审通过, 无进一步建议` or the user explicitly asks to stop early.
