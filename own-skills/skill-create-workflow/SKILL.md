---
name: skill-create-workflow
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
version: 0.2.0
author: aquarius-wing
updated_at: 2026-06-30
origin: own
userInvocable: true
---

# Skill 创建工作流

## 核心职责

把用户的 skill 作者请求路由成一个可验证的创建或更新流程：先判断内容是否值得写成 skill，再框定任务域和边界，最后调用平台原生 skill 创建能力落盘，并用 `prompt-review` 复审到通过。

This skill is an orchestrator. It MUST NOT replace `skill-content-fit`, `skill-domain-framing`, `skill-creator`, or `prompt-review` with ad hoc local judgment when those skills are available.

Successful completion means all of the following are true:

- create mode: `{owned_skill_directory}` exists; update mode: changed-files list contains at least one path under the existing skill directory
- `SKILL.md` has frontmatter with non-empty `name` and `description`
- the skill contains triggers, non-triggers, workflow steps, and failure paths
- if the workflow has more than one step, uses tools, or delegates work, `SKILL.md` MUST contain at least one `<example>` and one `<bad-example>`
- all modified prompt-bearing files have passed `prompt-review`
- the final response includes changed file paths and residual risks

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

Each step MUST end with one of these statuses:

```text
status: pass | fail | needs_user_input
evidence: <file path, tool result, or user answer>
next_action: <continue | ask_user | stop>
```

## 1. 解析用户意图

Identify these fields before running downstream skills:

- `mode`: create / update / refine / repair / convert.
- `runtime`: Codex / Claude Code / both / unknown.
- `source`: pasted text / local file / directory / existing skill / external URL.
- `target_scope`: user skill / project skill / company skill / unknown.
- `desired_outcome`: what future user request should trigger the skill.

If a required local source path is missing or unreadable, MUST stop and ask for the path or content. If `runtime` is unknown, default to Codex-compatible wording and avoid Claude-only tool names.

Failure path: if the source is an external URL and network access is unavailable, ask the user to paste the relevant source text or provide a local file. NEVER infer source content from a URL title.

## 2. 检查必需能力

Required skills:

- `skill-content-fit`
- `skill-domain-framing`
- `skill-creator`
- `prompt-review`

Use the current runtime's skill list first. If a required company skill is missing in this repo, use `tranfu-router` / `tfs` only for company-skill installation requests. If `tfs` is unavailable, report the exact missing command and continue only when the missing step has a safe local fallback.

`skill-creator` fallback:

- Codex: use the installed system `skill-creator` if present.
- Claude Code: use its native skill authoring guidance if present.
- If no platform creator is available, MUST ask the user whether to create the skill manually in the current project. NEVER browse for unofficial templates. For OpenAI/Codex skill documentation, use `openai-docs` and restrict browsing fallback to official OpenAI domains.

Failure path: retry a failed capability check once after refreshing local skill metadata if the runtime supports it. If the second check fails, set `status: fail` and report the missing capability instead of guessing a replacement.

<bad-example>
WRONG: "如果 skill-creator 不存在，则开启网络搜索，找到官方 Skill 文本，安装到用户路径。"

Reason: this invents an install path, may use stale or unofficial web content, and skips the user's approval for writing into a user-level skill directory.
</bad-example>

## 3. 内容准入门禁

Run `skill-content-fit` on the raw source material before naming or writing the skill.

Gate result:

- If result is `打回`, MUST stop the creation flow and return the missing fields from `skill-content-fit`. Do not continue to `skill-domain-framing` or `skill-creator`.
- If result is `通过`, continue to domain framing.
- If the request is updating an already installed skill, still run the gate against the proposed new behavior, not against the existence of the old skill.

Passing means the `skill-content-fit` output contains all six fields with non-empty judgments: `可重复`, `触发条件`, `可执行流程`, `验证方式`, `边界和反例`, and `建议提炼为 skill 的内容`.

## 4. 任务域框定

Run `skill-domain-framing` after content fit passes.

MUST preserve these outputs for the final authoring prompt:

- recommended skill container/name
- why not narrower
- why not implementation-oriented
- why not broader
- at least four candidate containers
- placement of the source experience
- normal path / verification path / troubleshooting path
- trigger conditions
- acceptance criteria

If `skill-domain-framing` reports multiple viable containers or uncertain scope, ask the user to choose before writing files. In Codex Plan mode, use `request_user_input` when available. Outside Plan mode or when the tool is unavailable, ask one concise plain-text question with 2-3 concrete options. In Claude Code, use `AskUserQuestion` only if that tool exists in the current runtime.

Failure path: if the user does not choose after one clarification attempt, set `status: needs_user_input` and stop before writing files.

## 5. 补齐细节与边界

Ask only for information that is required to make the skill executable or bounded. Do not ask for generic "time, place, people" unless the future trigger or workflow actually depends on them.

Required authoring inputs:

- trigger phrases, including casual phrasing
- explicit non-trigger cases
- positive path
- negative examples or common failure modes
- tool mapping and runtime constraints
- verification steps or acceptance criteria
- fallback behavior when source files, tools, or approvals are missing
- output format

If any required input remains unknown after one clarification round, write it as an explicit `unknown / needs user confirmation` item in the authoring prompt instead of inventing it.

<example>
User: "把这份发布事故复盘写成 skill: docs/postmortem.md"

Clarification question:
"这个 skill 未来主要保护哪个结果？A. 发布前检查，B. 发布失败排障，C. 事故复盘写作。"
</example>

<example>
User: "把 docs/postmortem.md 沉淀成 skill，项目内使用。"

Workflow:
1. Intent parse returns `mode: convert`, `runtime: Codex`, `source: docs/postmortem.md`, `target_scope: project skill`.
2. Capability check returns `status: pass` for `skill-content-fit`, `skill-domain-framing`, `skill-creator`, and `prompt-review`.
3. `skill-content-fit` returns `结论: 通过` with non-empty `可重复`, `触发条件`, `可执行流程`, `验证方式`, `边界和反例`.
4. `skill-domain-framing` recommends `release-readiness-check` and excludes incident narrative writing.
5. Clarification asks the user to choose release readiness vs failure troubleshooting if both containers remain viable.
6. `skill-creator` writes only under `.codex/skills/release-readiness-check/`.
7. `prompt-review` reviews `.codex/skills/release-readiness-check/SKILL.md` and returns `评审通过, 无进一步建议`.
8. Final output includes `result: created`, `skill name`, absolute changed file paths, `review_status: passed`, and `remaining_risks: []`.
</example>

<bad-example>
WRONG: "请补充时间、地点、人物。"

Reason: most skill workflows do not depend on event metadata; asking this by default wastes a clarification round and does not improve executability.
</bad-example>

## 6. 创建或更新 skill

Run `skill-creator` after the framing decision and required details are available.

Authoring prompt MUST include:

```text
Skill task:
- Mode: {mode}
- Runtime: {runtime}
- Target scope: {target_scope}
- Source material: {source}

Domain framing:
- Recommended container/name: {recommended_container}
- Include: {include_scope}
- Exclude: {exclude_scope}
- Placement: {placement}

Required content:
- Triggers: {triggers}
- Do NOT trigger when: {non_triggers}
- Workflow: {workflow}
- Tool mapping: {tool_mapping}
- Examples: {examples}
- Bad examples: {bad_examples}
- Failure paths: {failure_paths}
- Acceptance criteria: {acceptance_criteria}

Write scope:
- MUST create or update files only under {owned_skill_directory}.
- NEVER modify unrelated skills or project code.
```

For Codex, prefer the installed `skill-creator` skill. For Claude Code, prefer its native skill authoring mechanism. NEVER ask a worker or subagent to write outside `owned_skill_directory`.

If a delegated worker is explicitly required by the active runtime or another skill, use this template instead of inventing a fresh prompt:

```text
You are {SUBAGENT_ROLE}, responsible for {SUBTASK_TYPE}.

Runtime: {RUNTIME}
Allowed tools: {ALLOWED_TOOLS}
Objective: {OBJECTIVE}

Inputs:
{INPUTS}

Scope:
{SCOPE}

Read/write mode:
{READ_WRITE_MODE}

Owned files:
{OWNED_FILES_OR_MODULES}

Constraints:
- NEVER handle work outside Scope.
- NEVER ask the user questions; report blockers in the result.
- NEVER invent tool names. Use only tools exposed by Runtime.
- MUST modify only Owned files when editing files.

Output format:
{OUTPUT_FORMAT}

Acceptance criteria:
{ACCEPTANCE_CRITERIA}
```

Failure path: if `skill-creator` writes outside the owned skill directory, stop and ask the user before keeping, moving, or deleting those files. NEVER silently revert user-authored files.

## 7. Prompt review loop

Run `prompt-review` against every generated or modified prompt-bearing file, at minimum:

- `SKILL.md`
- agent definitions such as `agents/*.yaml` or `.md`
- templates referenced by the skill

Loop rules:

- MUST apply every reviewer suggestion that maps to prompt-review dimensions A-J.
- If a suggestion is rejected, MUST record the reason and send it back to the reviewer in the same review loop.
- MUST re-run review after edits.
- Maximum review rounds: 5. If still not passed after 5 rounds, stop and ask the user whether to continue.

Completion criterion: reviewer returns exactly `评审通过, 无进一步建议`.

Failure path: if `prompt-review` cannot start its reviewer because the current runtime lacks or disallows subagent tools, run the review checklist locally, apply the mapped A-J findings, then re-run through `prompt-review` when the reviewer mechanism becomes available or report `review_status: local checklist only`.

## 8. Tranfu Publish

这是非阻塞步骤：发布失败不影响整体完成，发布不是 step 7 完成门之外的额外完成条件，仅在 §9 的 `publish_status` 与 `remaining_risks` 中体现。本步骤不需要用户确认。

1. 打印 `正在上传至 Tranfu Skills`。MUST 在真正 push / 开 PR 之前打印，给用户可见的中止窗口。
2. 运行 `tranfu-publish` 发布本次生成或更新的 skill。
3. 成功 → 记 `publish_status: published`，保留 PR 链接或发布地址 → 继续 step 9。
4. 失败 → 记 `publish_status: failed` 与失败原因，NEVER 阻塞流程 → 继续 step 9。

## 9. Final output

Final response MUST include:

- result: created / updated / blocked
- skill name
- absolute path to the skill directory and changed files
- review status
- `publish_status`: published / failed / skipped（failed 时附失败原因，published 时附 PR 链接或发布地址）
- any missing confirmation or skipped verification
- `remaining_risks`: empty list if none, otherwise concrete unresolved items

If blocked, include the first blocking step and the exact missing input, missing tool, or reviewer item that prevented completion.

## Runtime Tool Notes

Use only tools that exist in the current runtime.

- Codex current session: use normal skill invocation and available tools. Use `request_user_input` only when Plan mode exposes it. Use `spawn_agent` / `wait_agent` / `send_input` / `close_agent` only when runtime policy permits delegation and another active skill explicitly requires a reviewer or delegated agent.
- Codex independent thread / worktree: use `create_thread`, `fork_thread`, or `send_message_to_thread` only when the user explicitly asks for a separate thread, fork, worktree, or background handoff.
- Claude Code: use named subagents, `.claude/agents/`, `~/.claude/agents/`, `--agents`, `--agent`, or runtime-exposed `Task` / `CreateTask` / `SendMessage` only after confirming the tool exists and its schema is known.

This local skill set has no established `allowedTools` frontmatter convention. Keep tool permissions in this section unless the active platform schema explicitly supports a frontmatter allowlist.

NEVER write instructions that require "开启 Plan 模式" from inside a skill. Mode switching is controlled by the runtime or user, not by this skill.
