---
name: skill-review-workflow
description: >-
  当用户要对一个已有的 skill (SKILL.md / skill 目录 / 已安装 skill) 做整体质量审查时触发——
  这是 skill-create-workflow 的审查视角: 用创建时的同一套门禁反向检验已有 skill。

  触发判定按 "审查意图 + 完整 skill 目标", 不按短语字典匹配:

  - 任何 "审查式动词 + 已有 skill" 的表达都算: 审查 / 审 / 评审 / 检查 / 体检 / 把关 /
    review / audit + 一个已存在的 skill。
  - 口语说法同理: "这个 skill 写得怎么样"、"帮我看看 own-skills/xxx 质量"、
    "这个 skill 要不要重构"、"它还够格当 skill 吗"。
  - 代词承接同理: 上文在讨论某个已有 skill 时, "审一下它" 即触发, 目标取上文。

  Do NOT trigger when: 创建全新 skill (走 skill-create-workflow); 目标只是一段 prompt /
  agent 定义文本而非完整 skill 目录 (直接走 prompt-review); install / list / upgrade /
  uninstall skills (走 tranfu-router); 用户拿着审查报告要求动手修改 (走 skill-create-workflow
  的 update / repair 模式)。

  安全边界: 本 skill 只审不改, NEVER 修改被审 skill 的任何文件。
version: 0.1.0
author: aquarius-wing
updated_at: 2026-07-03
origin: own
userInvocable: true
---

# Skill 审查工作流

## 核心职责

把 "审查一个已有 skill" 的请求路由成可验证的四门审查流程: 内容准入反检 → 任务域与命名反检 → prompt 工程质量 → 结构完整性, 汇总为一份三态裁决报告 (通过 / 需修改 / 建议重构)。

This skill is an orchestrator. It MUST NOT replace `skill-content-fit`, `skill-domain-framing`, or `prompt-review` with ad hoc local judgment when those skills are available.

CRITICAL: 本 skill review-only。NEVER 编辑、移动、删除被审 skill 目录下的任何文件; 用户要求修改时, 输出报告后重定向到 `skill-create-workflow` 的 update / repair 模式——那不再属于本 skill。

Successful completion means all of the following are true:

- 产出命名产物 `SKILL_REVIEW_REPORT`, 含四门各自结论、结构化 issue 列表、三态总裁决
- 每条 issue 带 severity / 命中检查项 / 行锚点或段落锚点 / 证据 / 建议改法
- 被审 skill 目录零改动 (`git status` 不含该目录下任何条目; 非 git 环境下以未调用过写文件工具为准)
- 报告末尾含 `top_fixes` (severity 最高的前 3 条) 与 `residual_risks`

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW:

1. 定位并读取目标 skill。
2. 检查四门所需能力。
3. 门 1: 内容准入反检 (`skill-content-fit`)。
4. 门 2: 任务域与命名反检 (`skill-domain-framing`)。
5. 门 3: prompt 工程质量 (`prompt-review`)。
6. 门 4: 结构完整性 (本地机械清单)。
7. 机械裁决, 产出 `SKILL_REVIEW_REPORT`, 结束。

MUST update the TODO list after each step. Each step MUST end with:

```text
status: pass | fail | needs_user_input
evidence: <file path, tool result, or user answer>
next_action: <continue | ask_user | stop>
```

## 1. 定位目标

按输入类型路由:

- skill 名 / skill 目录路径 / SKILL.md 路径 / 已安装 skill 名 → 解析出 `target_dir` 与 `skill_name`, 继续步骤 2。
- 含多个 skill 的父目录 (如 `own-skills/`) → batch 模式: 对每个子 skill 独立执行步骤 3-6, 最后汇总一张 per-skill 裁决表; 单个 skill 审查失败 NEVER 中断其余 skill。
- 内联 prompt / agent 定义片段, 无完整 skill 目录 → 重定向 `prompt-review` 并退出。
- "把 X 做成 skill" 类创建意图 → 重定向 `skill-create-workflow` 并退出。
- 否则 (无法解析出任何目标) → 向用户要 skill 名或路径并退出。

卫语句:

- 若 `target_dir` 不存在或其中无 `SKILL.md` → `status: needs_user_input`, 报告确切缺失路径, 退出。
- MUST 读取全文并记行号: `SKILL.md` 与全部 prompt-bearing 附属文件 (`agents/*.yaml`、`agents/*.md`、被 SKILL.md 引用的 templates / references)。被引用文件读不到 → 记一条 HIGH issue (悬空引用) 并继续, 不阻塞。

## 2. 能力检查

Required skills: `skill-content-fit`、`skill-domain-framing`、`prompt-review`。

- 三者在当前运行时都可调用 → 继续步骤 3。
- 任一缺失 → 该门降级为 `mode: local-checklist`: 按顺序查找该门 skill 的清单文件并本地逐条执行——先找已安装副本 (如 `~/.claude/skills/<门 skill 名>/SKILL.md` 或当前运行时的等价安装路径), 再找 tranfu-skills 仓库的 `own-skills/<门 skill 名>/SKILL.md` (仅当当前工作区就是该仓库)。NEVER 因门 skill 缺失而跳过该门。
- 两处清单文件都读不到 → 该门标 `mode: skipped-missing-capability`, 记入 `residual_risks`, 继续其余门。

## 3. 门 1: 内容准入反检

回答的问题: 这个 skill 承载的内容, 今天拿去过创建门禁还过得了吗?

MUST 先 "去包装": 从目标 SKILL.md 提取其承载的能力主张——触发场景、工作流步骤、验证方式、边界反例——整理成一段源材料文本, 以 "假设该 skill 尚不存在" 的口径运行 `skill-content-fit`。

NEVER 把 SKILL.md 路径直接丢给 `skill-content-fit`——它的路由排除 "输入已经是 skill" 是防误触发, 编排调用时 MUST 用去包装后的源材料满足其输入契约, 而不是伪造结论或跳门。

结果分支:

- 返回 `通过` → gate1: pass, 继续。
- 返回 `打回` → gate1: fail, 记录其列出的缺失字段。这不是措辞问题, 而是 "该内容不够格成为 skill" 的信号, 裁决时直接落入 `建议重构` (报告中附 "降级为普通文档" 选项)。

<bad-example>
WRONG: "这个 skill 已经在库里用了半年, 内容准入肯定没问题, 门 1 跳过。"

Reason: 存量不等于够格。skill 库里恰恰会沉积当年没过准入门禁就进来的条目; 门 1 的意义就是补做当年缺的判断。
</bad-example>

## 4. 门 2: 任务域与命名反检

用门 1 去包装后的同一份源材料运行 `skill-domain-framing`, 并把当前 `skill_name` 作为 `用户指定候选` 传入; 机械读取输出的 `Top1`、`Top1-Top2 分差`、当前名在评分表中的总分。

裁决分支:

- 当前名 == Top1 → gate2: pass。
- 当前名 ≠ Top1 且 (Top1 总分 − 当前名总分) ≥ 2 → gate2: fail (容器框错), 报告中附 Top1 作为改名或拆分建议。
- 当前名 ≠ Top1 且 (Top1 总分 − 当前名总分) < 2 → gate2: pass, 附 note "存在同分级替代容器 {Top1}, 不构成重构理由"。
- framing 输出缺 `Top1` / 分差行, 或评分表少于 4 行 → 退回 framing 重跑一次; 再失败 → gate2 标 `mode: degraded`, 本地按其 3 维标准只给当前名打分并注明未做候选比较。

## 5. 门 3: prompt 工程质量

对 `SKILL.md` 与步骤 1 收集的全部 prompt-bearing 附属文件运行 `prompt-review`, 收取 `REVIEW_PACKET`。

- 本 workflow NEVER 在此做修复循环——修复属于 `skill-create-workflow` 的 update 模式; 本门只把 `REVIEW_PACKET` 原样并入报告。
- gate3 结论: `REVIEW_PACKET` 含 BLOCKER 或 HIGH → fail; 仅 MEDIUM / LOW → pass (issue 保留为建议)。

## 6. 门 4: 结构完整性

本地逐项机械检查, 命中缺失即记一条 issue:

| 检查项 | 判定方式 | 缺失 severity |
|---|---|---|
| frontmatter `name` / `description` 存在且非空 | 字段解析 | BLOCKER |
| description ≤ 1024 字符 | 字符计数 | BLOCKER |
| `name` 为 kebab-case 且与目录名一致 | 字符串比对 | HIGH |
| description 含 Do NOT trigger 段 | 关键词命中 | HIGH |
| body 含有序工作流步骤 | 编号列表存在 | HIGH |
| body 含失败路径 | 失败路径 / failure path 段存在 | HIGH |
| body 含可观测完成 / 验收标准 | 完成标准段存在 | HIGH |
| 多步流程、用工具或委派 ⇒ ≥1 `<example>` 且 ≥1 `<bad-example>` | 标签计数 | HIGH |
| 声明委派 subagent ⇒ 附派发模板 | 模板块存在 | HIGH |
| 多步流程 ⇒ 含 "CREATE A TODO LIST" | 关键词命中 | MEDIUM |

去重规则: 与门 3 的 A–G 检查项命中同一问题时 (如 description 超长), 只保留门 3 的 issue id, 门 4 侧不重复记条。

## 7. 机械裁决与报告

短路规则:

```text
if gate1 == fail 或 gate2 == fail:
    verdict = 建议重构        # 内容或容器层面的问题, 改措辞救不了
elif gate3 == fail 或 gate4 存在 BLOCKER/HIGH 缺项:
    verdict = 需修改
else:
    verdict = 通过            # MEDIUM/LOW 保留为建议, 不影响裁决
```

产出 `SKILL_REVIEW_REPORT` (schema 见下), 结束。

用户接着要求修改时 → 把本报告作为输入重定向 `skill-create-workflow` (mode: update / repair); NEVER 在本 skill 内直接动手改。

## SKILL_REVIEW_REPORT (输出 schema)

```yaml
SKILL_REVIEW_REPORT:
  target: <skill 目录绝对路径>
  skill_name: <被审 skill 名>
  gates:
    content_fit:
      result: pass | fail
      mode: skill | local-checklist | skipped-missing-capability
      evidence: <skill-content-fit 六字段结论摘录>
    domain_framing:
      result: pass | fail | degraded
      current_name_score: <0-6>
      top1: <候选名>
      delta: <整数>
      note: <一句话>
    prompt_quality:
      result: pass | fail
      mode: skill | local-checklist
      review_packet: <REVIEW_PACKET 原样嵌入>
    structure:
      result: pass | fail
      missing:
        - check: <缺失检查项名, 取自 §6 表格>
          severity: <§6 表格对应值>
          location: <SKILL.md 行锚点或 "frontmatter">
          evidence: <未命中的判定依据, 如 "全文无 <bad-example> 标签">
          fix: <一句话改法>
  verdict: 通过 | 需修改 | 建议重构
  top_fixes:
    - <severity 最高的前 3 条 issue 的一句话改法>
  residual_risks: [<降级的门 / 读不到的引用文件 / 未验证项>, ...]
```

batch 模式在此之外追加一张 per-skill 汇总表: 每行 `skill_name / verdict / BLOCKER 数 / HIGH 数 / top_fix`。

## 失败路径

- 目标不存在或无 SKILL.md → `status: needs_user_input`, 报确切缺失路径并退出。
- 门 skill 缺失 → 按 §2 降级为 local-checklist, NEVER 跳门。
- SKILL.md 引用的附属文件缺失 → HIGH issue (悬空引用), 继续审查。
- batch 模式中单个 skill 审查中断 → 该 skill 在汇总表标 fail 附原因, 其余继续。
- 用户要求 "审完顺手修一下" → 照常产出报告, 然后重定向 `skill-create-workflow` update 模式, 本轮 NEVER 改文件。
- 目标是 `skill-review-workflow` 自身 → 照常审, 无特权豁免。

<example>
User: "帮我审一下 own-skills/daily-report 这个 skill"

Workflow:
1. 定位: `target_dir: own-skills/daily-report`, 读取 SKILL.md (记行号) 与 agents/openai.yaml。status: pass。
2. 能力检查: `skill-content-fit` / `skill-domain-framing` / `prompt-review` 均可用。status: pass。
3. 门 1: 去包装出 "每日进度汇报生成" 的触发 / 流程 / 验证 / 边界作为源材料, content-fit 返回 `通过`。gate1: pass。
4. 门 2: framing 返回 `Top1: daily-report`、`Top1-Top2 分差: 3`, 当前名即 Top1。gate2: pass。
5. 门 3: prompt-review 返回 REVIEW_PACKET: 1 条 HIGH (C 维 no-soft-hedges: 硬约束段用了 "尽量"), 2 条 MEDIUM。gate3: fail。
6. 门 4: 缺 `<bad-example>` (HIGH), 其余齐备。gate4: fail。
7. 裁决: gate1/gate2 pass, gate3/gate4 含 HIGH → `verdict: 需修改`。产出 SKILL_REVIEW_REPORT, top_fixes 列 2 条 HIGH + 1 条 MEDIUM, residual_risks: []。全程零文件改动。
</example>

<bad-example>
WRONG: 审出 3 条 HIGH 后, 直接编辑目标 SKILL.md 把问题修掉, 再报告 "已审查并修复"。

Reason: review-only 是本 skill 的硬边界; 未经用户走 update 流程就改被审文件, 既越权, 也让报告失去 "审查时点快照" 的意义。
</bad-example>

## Runtime Tool Notes

Use only tools that exist in the current runtime.

- 调用三个门 skill 用当前运行时的原生 skill 调用机制 (Claude Code: Skill tool; Codex: 常规 skill 调用)。
- 本 skill 在主流程内顺序执行四门, 不自行派 subagent; 若调用方或运行时要求并行, 门 3 可按 `prompt-review` 自身定义的 subagent 时刻表分派, 其余门保持本地。
- 读取文件只用运行时只读工具; NEVER 对 `target_dir` 调用任何写文件工具。
