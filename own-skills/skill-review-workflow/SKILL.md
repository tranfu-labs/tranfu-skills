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
version: 0.2.0
author: aquarius-wing
updated_at: 2026-07-03
origin: own
userInvocable: true
---

# Skill 审查工作流

## 核心职责

把 "审查一个已有 skill" 的请求路由成可验证的四门审查流程: 内容准入反检 → 任务域与命名反检 → prompt 工程质量 → 结构完整性, 汇总为一份三态裁决报告 (通过 / 需修改 / 建议重构)。

架构: 主 agent 只做编排、合并与裁决; 四门审查全部由 SubAgent 执行, 主 agent NEVER 通读被审文件全文——保持主上下文干净, 细读下沉到各门 SubAgent。

This skill is an orchestrator. It MUST NOT replace `skill-content-fit`, `skill-domain-framing`, or `prompt-review` with ad hoc local judgment: 各门 SubAgent 按对应门 skill 的清单执行, 不自创标准。

CRITICAL: 本 skill review-only。NEVER 编辑、移动、删除被审 skill 目录下的任何文件; 用户要求修改时, 输出报告后重定向到 `skill-create-workflow` 的 update / repair 模式——那不再属于本 skill。

Successful completion means all of the following are true:

- 产出命名产物 `SKILL_REVIEW_REPORT`, 含四门各自结论、结构化 issue 列表、三态总裁决
- 每条 issue 带 severity / 命中检查项 / 行锚点或段落锚点 / 证据 / 建议改法
- 门 3 的合并 `REVIEW_PACKET` 覆盖全部 prompt-bearing 文件, 且包内 issue id 唯一 (id 已顺移)
- 被审 skill 目录零改动 (`git status` 不含该目录下任何条目; 非 git 环境下以未调用过写文件工具为准)
- 报告末尾含 `top_fixes` (severity 最高的前 3 条) 与 `residual_risks`

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW:

1. 定位目标 skill 与文件清单 (主 agent, 轻量)。
2. 检查 SubAgent 机制与四门清单路径。
3. T0: 派发去包装 SubAgent。
4. T1: 并发派发四门 SubAgent (门 3 = 每个 prompt-bearing 文件 × 3 个 reviewer)。
5. T2: 回收并校验各门输出, 合并门 3 的 REVIEW_PACKET (id 顺移)。
6. 机械裁决, 产出 `SKILL_REVIEW_REPORT`, 结束。

MUST update the TODO list after each step. Each step MUST end with:

```text
status: pass | fail | needs_user_input
evidence: <file path, tool result, or user answer>
next_action: <continue | ask_user | stop>
```

## 1. 定位目标 (主 agent, 轻量)

按输入类型路由:

- skill 名 / skill 目录路径 / SKILL.md 路径 / 已安装 skill 名 → 解析出 `target_dir` 与 `skill_name`, 继续步骤 2。
- 含多个 skill 的父目录 (如 `own-skills/`) → batch 模式: 对每个子 skill 独立执行步骤 3-5, 最后汇总一张 per-skill 裁决表; 单个 skill 审查失败 NEVER 中断其余 skill。
- 内联 prompt / agent 定义片段, 无完整 skill 目录 → 重定向 `prompt-review` 并退出。
- "把 X 做成 skill" 类创建意图 → 重定向 `skill-create-workflow` 并退出。
- 否则 (无法解析出任何目标) → 向用户要 skill 名或路径并退出。

卫语句与清单收集:

- 若 `target_dir` 不存在或其中无 `SKILL.md` → `status: needs_user_input`, 报告确切缺失路径, 退出。
- 主 agent 只做轻量收集: 列出 `target_dir` 下全部 prompt-bearing 文件路径 (`SKILL.md`、`agents/*.yaml`、`agents/*.md`、templates / references 下的 `.md`), 记为 `PROMPT_FILES`; 读 frontmatter 拿 `name` 字段即止。NEVER 在主会话通读文件正文——正文细读属于各门 SubAgent。

## 2. 能力检查

- 检查当前运行时是否暴露可验证的 SubAgent / Task 派发机制 (Claude Code: Agent tool; Codex: spawn_agent 等)。不可用 → 全部门降级为主会话顺序本地执行 (仍按各门清单逐条跑), 报告中所有门标 `mode: local-fallback`, 跳到本地执行时同样遵守 §3-§6 的清单与合并规则。
- 解析四门清单文件路径, 供 SubAgent 模板填充; 每门按顺序取第一个存在的:
  1. 已安装副本: `~/.claude/skills/<门 skill 名>/SKILL.md` (或当前运行时的等价安装路径)
  2. tranfu-skills 仓库副本: `own-skills/<门 skill 名>/SKILL.md` (仅当当前工作区就是该仓库)
- 门 skill 名对应关系: 门 1 → `skill-content-fit`; 门 2 → `skill-domain-framing`; 门 3 → `prompt-review`; 门 4 → 清单内置于本文件 §"门 4 结构完整性清单", 无外部依赖。
- 某门两处清单文件都不存在 → 该门标 `mode: skipped-missing-capability`, 记入 `residual_risks`, 其余门照常。NEVER 因清单缺失而自创标准替代该门。

## 3. T0: 去包装

MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK, 按下面的模板直接开始任务; 除非 §2 已判定运行时无 SubAgent 机制——那时在主会话按同一模板要求本地执行并标注 `mode: local-fallback`。

### 去包装 SubAgent 派发模板

```text
角色: 你是 skill 去包装员, 只读不写。
目标文件: {TARGET_DIR}/SKILL.md (读全文)
任务: 提取这个 skill 承载的能力主张, 整理成一段自足的源材料文本, 使读者在
     "假设该 skill 尚不存在" 的口径下能评估它。必须覆盖四块:
     1) 触发场景 (含口语说法)  2) 工作流步骤  3) 验证 / 验收方式  4) 边界与反例。
边界: 只看目标文件; 不编辑任何文件; 不访问网络; 不做质量评价——评价是后续门的事。
输出格式: 纯文本源材料, 四块各一段, 不含 YAML frontmatter、不含对原文的引用行号。
```

回收产出记为 `SOURCE_MATERIAL`, 供 T1 门 1 / 门 2 填充。

## 4. T1: 并发派发四门

执行时刻表 (T0 完成后一次性并发派出全部 T1 SubAgent; 门 3 / 门 4 不消费 `SOURCE_MATERIAL`, 但统一在 T1 派发以简化汇合点):

| 阶段 | SubAgent | 数量 | 输入 | 并发? | 依赖 | 产出 |
|---|---|---|---|---|---|---|
| T0 | 去包装 | 1 | `{TARGET_DIR}/SKILL.md` | 串行 | — | `SOURCE_MATERIAL` |
| T1 | 门 1 内容准入 | 1 | `SOURCE_MATERIAL` | 并发 | T0 | content-fit 结论 (通过/打回 + 六字段) |
| T1 | 门 2 任务域 | 1 | `SOURCE_MATERIAL` + `skill_name` | 并发 | T0 | framing 输出 (评分表 + Top1 + 分差) |
| T1 | 门 3 reviewer-A (维度 A,B) | 每文件 1 | `PROMPT_FILES` 中一个文件 | 并发 | — | REVIEW_PACKET 片段 |
| T1 | 门 3 reviewer-B (维度 C,D) | 每文件 1 | 同上 | 并发 | — | REVIEW_PACKET 片段 |
| T1 | 门 3 reviewer-C (维度 E,F,G) | 每文件 1 | 同上 | 并发 | — | REVIEW_PACKET 片段 |
| T1 | 门 4 结构完整性 | 1 | `TARGET_DIR` + `PROMPT_FILES` | 并发 | — | structure 结论 |
| T2 | (主 agent, 非 SubAgent) 合并裁决 | — | 全部 T1 产出 | 串行 | T1 全部完成 | `SKILL_REVIEW_REPORT` |

门 3 SubAgent 总数 = `PROMPT_FILES` 文件数 × 3。

### 门 1 SubAgent 派发点

MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK, 按下面的模板直接开始任务; 无 SubAgent 机制时按 §2 降级。

```text
角色: 你是内容准入评审员, 只读不写。
清单: 读取 {GATE1_CHECKLIST_PATH} (skill-content-fit 的 SKILL.md), 按其六项准入标准
     与输出模板执行; 若当前运行时允许你直接调用 skill-content-fit, 可调用替代手工执行。
源材料 (以 "假设该 skill 尚不存在" 的口径评估, NEVER 因内容来自已有 skill 而拒评):
{SOURCE_MATERIAL}
边界: 不读源材料之外的文件; 不编辑; 不访问网络。
输出格式: skill-content-fit 的输出模板原样 (结论: 通过/打回 + 六字段判断)。
```

### 门 2 SubAgent 派发点

MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK, 按下面的模板直接开始任务; 无 SubAgent 机制时按 §2 降级。

```text
角色: 你是任务域框定评审员, 只读不写。
清单: 读取 {GATE2_CHECKLIST_PATH} (skill-domain-framing 的 SKILL.md), 按其工作流、
     候选评分与输出格式执行; 若当前运行时允许你直接调用 skill-domain-framing, 可调用替代。
源材料 (以 "假设该 skill 尚不存在" 的口径评估):
{SOURCE_MATERIAL}
用户指定候选: {SKILL_NAME}   # 被审 skill 的现名, MUST 纳入评分表打分
边界: 不读源材料之外的文件; 不编辑; 不访问网络。
输出格式: skill-domain-framing 的输出格式原样 (候选评分表 + Top1 + Top1-Top2 分差 +
         用户指定候选 + 范围边界 + 路径分层等)。
```

### 门 3 SubAgent 派发点 (每个 prompt-bearing 文件 × 3)

对 `PROMPT_FILES` 中的每一个文件, MUST SPAWN 3 个 SubAgent 并发分维度审核, 按下面的模板直接开始任务, `{DIMENSIONS}` 按时刻表取值 (reviewer-A: `A,B`; reviewer-B: `C,D`; reviewer-C: `E,F,G`); 无 SubAgent 机制时按 §2 降级。

```text
角色: 你是独立 prompt reviewer, 只审给定目标, 不改文件。
清单: 读取 {GATE3_CHECKLIST_PATH} (prompt-review 的 SKILL.md), 只跑分给你的维度。
目标文件: {FILE_PATH} (读全文并记行号)
范围: 检查项维度 {DIMENSIONS}; 其余维度 NEVER 审——会与其他 reviewer 重复。
边界: 只看目标文件; 不编辑; 不访问网络; 映射不到所辖维度检查项的观察直接丢弃。
输出格式: REVIEW_PACKET YAML 片段 (schema 见清单文件), 每条 issue 带
         id (维度字母+序号, 片段内从 1 起编) / severity / check / location (file:line) /
         evidence / fix / acceptance_test / disposition: open。无发现时输出空 issues 列表。
```

### 门 4 SubAgent 派发点

MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK, 按下面的模板直接开始任务; 无 SubAgent 机制时按 §2 降级。

```text
角色: 你是结构完整性检查员, 只读不写。
目标: {TARGET_DIR} 下的 SKILL.md 与文件清单 {PROMPT_FILES}
任务: 逐项执行本模板下方的检查表; 命中缺失即记一条; 另检查 SKILL.md 引用的文件是否
     都真实存在, 缺失记 HIGH (悬空引用)。
边界: 只读 {TARGET_DIR} 下文件; 不编辑; 不访问网络。
输出格式: YAML 列表, 每条含 check / severity / location / evidence / fix。全部通过时输出空列表。
检查表:
| 检查项 | 判定方式 | 缺失 severity |
|---|---|---|
| frontmatter name / description 存在且非空 | 字段解析 | BLOCKER |
| description ≤ 1024 字符 | 字符计数 | BLOCKER |
| name 为 kebab-case 且与目录名一致 | 字符串比对 | HIGH |
| description 含 Do NOT trigger 段 | 关键词命中 | HIGH |
| body 含有序工作流步骤 | 编号列表存在 | HIGH |
| body 含失败路径 | 失败路径 / failure path 段存在 | HIGH |
| body 含可观测完成 / 验收标准 | 完成标准段存在 | HIGH |
| 多步流程、用工具或委派 ⇒ ≥1 <example> 且 ≥1 <bad-example> | 标签计数 | HIGH |
| 声明委派 subagent ⇒ 附派发模板 | 模板块存在 | HIGH |
| 多步流程 ⇒ 含 "CREATE A TODO LIST" | 关键词命中 | MEDIUM |
```

## 5. T2: 回收、校验与合并 (主 agent)

逐门校验回收物:

1. 任一 SubAgent 无产出 / 产出不合法 (门 1 缺六字段、门 2 缺 `Top1`/分差行或评分表少于 4 行、门 3 片段非合法 YAML、门 4 非列表) → 用同一模板重派一次并附上一轮产出与格式提醒; 再失败 → 该门 (或该文件×维度组) 标 `mode: degraded`, 由主 agent 按对应清单本地补审该缺口, 并记入 `residual_risks`。
2. 合并门 3: 先按文件聚 3 个片段——维度字母互不相交 (A,B / C,D / E,F,G), 文件内无 id 冲突; 再跨文件合并为一个 `REVIEW_PACKET`: 同维度字母按 `PROMPT_FILES` 顺序重新连续编号 (id 顺移, 如 file1 有 C1、C2, file2 的 C1 顺移为 C3), 每条 issue 的 `location` MUST 含文件路径, 最后重算 ledger。合并后包内 id MUST 唯一。
3. 门 3 与门 4 去重: 命中同一问题时 (如 description 超长) 只保留门 3 的 issue id, 门 4 侧删除该条。

各门结论判定:

- gate1: content-fit 返回 `通过` → pass; `打回` → fail (记录缺失字段——这不是措辞问题, 是 "该内容不够格成为 skill" 的信号, 报告中附 "降级为普通文档" 选项)。
- gate2: 当前名 == Top1 → pass; 当前名 ≠ Top1 且 (Top1 总分 − 当前名总分) ≥ 2 → fail (容器框错, 附 Top1 作为改名或拆分建议); 分差 < 2 → pass 附 note "存在同分级替代容器 {Top1}, 不构成重构理由"。
- gate3: 合并后 `REVIEW_PACKET` 含 BLOCKER 或 HIGH → fail; 仅 MEDIUM / LOW → pass (issue 保留为建议)。本 workflow NEVER 在此做修复循环——修复属于 `skill-create-workflow` 的 update 模式。
- gate4: 列表含 BLOCKER 或 HIGH → fail; 否则 pass。

## 6. 机械裁决与报告

短路规则:

```text
if gate1 == fail 或 gate2 == fail:
    verdict = 建议重构        # 内容或容器层面的问题, 改措辞救不了
elif gate3 == fail 或 gate4 == fail:
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
      mode: subagent | local-fallback | degraded | skipped-missing-capability
      evidence: <skill-content-fit 六字段结论摘录>
    domain_framing:
      result: pass | fail
      mode: subagent | local-fallback | degraded | skipped-missing-capability
      current_name_score: <0-6>
      top1: <候选名>
      delta: <整数>
      note: <一句话>
    prompt_quality:
      result: pass | fail
      mode: subagent | local-fallback | degraded | skipped-missing-capability
      files_covered: [<PROMPT_FILES 逐一列出>, ...]
      review_packet: <合并后的 REVIEW_PACKET, id 已顺移, location 含文件路径>
    structure:
      result: pass | fail
      mode: subagent | local-fallback | degraded | skipped-missing-capability
      missing:
        - check: <缺失检查项名, 取自门 4 检查表>
          severity: <检查表对应值>
          location: <SKILL.md 行锚点或 "frontmatter">
          evidence: <未命中的判定依据, 如 "全文无 <bad-example> 标签">
          fix: <一句话改法>
  verdict: 通过 | 需修改 | 建议重构
  top_fixes:
    - <severity 最高的前 3 条 issue 的一句话改法>
  residual_risks: [<降级的门 / 重派后仍失败的 reviewer / 读不到的引用文件>, ...]
```

batch 模式在此之外追加一张 per-skill 汇总表: 每行 `skill_name / verdict / BLOCKER 数 / HIGH 数 / top_fix`。

## 失败路径

- 目标不存在或无 SKILL.md → `status: needs_user_input`, 报确切缺失路径并退出。
- 运行时无 SubAgent 机制 → 全部门 `mode: local-fallback`, 主会话顺序执行, NEVER 跳门。
- 门清单文件两处都读不到 → 该门 `mode: skipped-missing-capability`, 记入 `residual_risks`。
- SubAgent 无产出或产出不合法 → 同模板重派一次; 再失败 → 该缺口 `mode: degraded`, 主 agent 本地补审并记入 `residual_risks`。
- SKILL.md 引用的附属文件缺失 → 门 4 记 HIGH (悬空引用), 继续审查。
- batch 模式中单个 skill 审查中断 → 该 skill 在汇总表标 fail 附原因, 其余继续。
- 用户要求 "审完顺手修一下" → 照常产出报告, 然后重定向 `skill-create-workflow` update 模式, 本轮 NEVER 改文件。
- 目标是 `skill-review-workflow` 自身 → 照常审, 无特权豁免。

<example>
User: "帮我审一下 own-skills/daily-report 这个 skill"

Workflow:
1. 定位: `target_dir: own-skills/daily-report`, `PROMPT_FILES: [SKILL.md, agents/openai.yaml]`, 主 agent 只读 frontmatter。status: pass。
2. 能力检查: Agent tool 可用; 三门清单在 `~/.claude/skills/` 均有安装副本。status: pass。
3. T0: 派发去包装 SubAgent, 回收 `SOURCE_MATERIAL` (触发/流程/验证/边界四段)。status: pass。
4. T1: 并发派发 1 (门 1) + 1 (门 2) + 2×3 (门 3, 两个文件各 3 个 reviewer) + 1 (门 4) = 9 个 SubAgent。
5. T2: 回收——门 1 `通过`; 门 2 `Top1: daily-report, 分差 3`, 当前名即 Top1; 门 3 合并: SKILL.md 片段有 C1 (HIGH, no-soft-hedges), openai.yaml 片段有 C1 (MEDIUM) → 顺移为 C2, ledger 重算; 门 4 缺 `<bad-example>` (HIGH)。gate1/gate2 pass, gate3/gate4 fail。
6. 裁决: `verdict: 需修改`。产出 SKILL_REVIEW_REPORT, top_fixes 列 C1、结构缺项、C2, residual_risks: []。全程零文件改动。
</example>

<bad-example>
WRONG: "这个 skill 已经在库里用了半年, 内容准入肯定没问题, 门 1 跳过。"

Reason: 存量不等于够格。skill 库里恰恰会沉积当年没过准入门禁就进来的条目; 门 1 的意义就是补做当年缺的判断。
</bad-example>

<bad-example>
WRONG: 合并门 3 时把两个文件的 REVIEW_PACKET 片段直接拼接, 包里同时出现两条 C1。

Reason: id 冲突让重审无法引用 ("C1 修了没?" 指哪条?); MUST 按文件顺序对同维度字母重新连续编号 (id 顺移), 并在 location 里保留文件路径。
</bad-example>

<bad-example>
WRONG: 审出 3 条 HIGH 后, 直接编辑目标 SKILL.md 把问题修掉, 再报告 "已审查并修复"。

Reason: review-only 是本 skill 的硬边界; 未经用户走 update 流程就改被审文件, 既越权, 也让报告失去 "审查时点快照" 的意义。
</bad-example>

## Runtime Tool Notes

Use only tools that exist in the current runtime.

- SubAgent 派发: Claude Code 用 Agent tool (只读型任务可用 Explore 类); Codex 用 spawn_agent / wait_agent。派发前确认机制存在, 不存在即走 §2 的 local-fallback。
- 门 1 / 门 2 / 门 3 SubAgent 优先读清单文件执行; 运行时允许 SubAgent 内调用 skill 时可直接调用对应门 skill, 两种方式产出格式一致。
- 读取文件只用运行时只读工具; NEVER 对 `target_dir` 调用任何写文件工具。
