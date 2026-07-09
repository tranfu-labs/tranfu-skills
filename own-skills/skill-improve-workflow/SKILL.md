---
name: skill-improve-workflow
description: >-
  当用户要对一个已有的 skill (SKILL.md / skill 目录 / 已安装 skill) 做整体质量提升时触发——
  用 skill-create-workflow 创建时的同一套门禁反向检验并把它改到合格: 四门反检出问题后,
  确定类改法征同意即改、判断类采访用户拍板。

  触发判定按 "提升 / 审查意图 + 完整 skill 目标", 不按短语字典匹配:

  - 任何 "提升式或审查式动词 + 已有 skill" 都算: 提升 / 改进 / 完善 / 优化 / 打磨 / 精炼 /
    审查 / 审 / 评审 / 检查 / 体检 / 把关 / improve / review / audit + 一个已存在的 skill。
  - 口语说法同理: "帮我把这个 skill 提升一下"、"完善下 own-skills/xxx"、
    "这个 skill 写得怎么样"、"这 skill 要不要重构"、"它还够格当 skill 吗"。
  - 代词承接同理: 上文在讨论某个已有 skill 时, "提升一下它 / 审一下它" 即触发, 目标取上文。

  Do NOT trigger when: 创建全新 skill (走 skill-create-workflow); 目标只是一段 prompt /
  agent 定义文本而非完整 skill 目录 (直接走 prompt-review); 用户点名给 skill 加某功能 / 改某个
  具体行为、不要质量审查 (走 skill-create-workflow update / repair); install / list /
  upgrade / uninstall 已装 skill (走 tranfu-router)。

  安全边界: 审查阶段只审不改; 仅在审后修复阶段, 对有确定改法的问题逐条或批量征得用户
  同意后才落盘, 判断类问题一律采访用户拍板, NEVER 擅自替用户决定或未经同意改文件。
version: 0.5.0
author: aquarius-wing
updated_at: 2026-07-09
origin: own
userInvocable: true
---

# Skill 提升工作流

## 核心职责

把 "提升一个已有 skill 的质量" 的请求跑成两阶段闭环: **审查阶段** (四门反检 → 三态裁决报告) + **审后修复阶段** (确定类征同意即改, 判断类采访用户)。审查是手段, 把 skill 改到合格是结果——这也是本 skill 按结果 (提升) 而非按活动 (审查) 命名的原因。四门 = 内容准入反检 → 任务域与命名反检 → prompt 工程质量 → 结构完整性; 三态 = 通过 / 需修改 / 建议重构。

架构 (三条原则):

- **细读下沉**: 主 agent 只做编排、回收与裁决; 四门审查全部由 SubAgent 执行, 主 agent NEVER 通读被审文件全文——保持主上下文干净。
- **分级短路**: 门 1 → 门 2 → 门 3 (SKILL.md 先审) 逐级把关, 上一级判死就立即产出局部报告退出, NEVER 为已判死的目标继续烧后续 SubAgent——内容或容器已经不成立时, 细审措辞没有意义。
- **有据即改, 存疑即问**: 审出的每条问题在 T5 标 `fix_kind`。**确定类** (有唯一正确改法, 如缺 Do NOT 段 / 软词该换 MUST / 命名非 kebab / 缺 example) → 修复阶段征得用户同意后由本 skill 直接改。**判断类** (无唯一答案, 如该不该是 skill / 容器命名 / 意图歧义 / 边界取舍) → 采访用户拍板, NEVER 自作主张。任何门**卡住** (打回 / 势均力敌 / 降级) 也进采访, 且 MUST 附带具体建议选项, 不给死路。

This skill is an orchestrator. It MUST NOT replace `skill-content-fit`, `skill-domain-framing`, or `prompt-review` with ad hoc local judgment: 各门 SubAgent 按对应门 skill 的清单执行, 不自创标准。

CRITICAL: 审查阶段 (§1-§6) review-only, NEVER 主动改动被审 skill 目录下任何文件。落盘只发生在审后修复阶段 (§7), 且每一处落盘 MUST 有对应的用户同意记录 (`applied_with_consent`)。判断类问题永不自动落盘——只采访, 由用户答复决定改法。大规模重构 (verdict = 建议重构, 如换容器 / 从头重写) MUST 交回 `skill-create-workflow` 的 update / repair 模式, 本 skill 不自行大改。

Successful completion means all of the following are true:

- 审查阶段产出命名产物 `SKILL_REVIEW_REPORT`, 含四门结论 (短路退出时未跑的门标 `not-run`)、结构化 issue 列表 (每条带 `fix_kind`)、三态总裁决
- 每条 issue 带 severity / 命中检查项 / 行锚点或段落锚点 / 证据 / 建议改法 / `fix_kind`
- 门 3 的合并 `REVIEW_PACKET` 覆盖全部已审文件, 且包内 issue id 唯一 (id 已提升为文件限定形式)
- 审查阶段结束时被审 skill 目录零改动; 修复阶段的每处落盘都能追溯到一条用户同意
- 修复阶段 (若进入) 产出 `REMEDIATION_SUMMARY`, 列出已改 / 已采访 / 已延后三类
- 报告末尾含 `top_fixes` (severity 最高的前 3 条) 与 `residual_risks`

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW:

1. 定位目标 skill 与文件清单 (主 agent, 轻量)。
2. 检查 SubAgent 机制与四门清单路径。
3. T0: 派发去包装 SubAgent。
4. T1: 门 1 内容准入。若打回 → 短路退出 (verdict: 建议重构)。
5. T2: 门 2 任务域。若容器框错 → 短路退出 (verdict: 建议重构)。
6. T3: 门 3 第一波 (SKILL.md × 3 reviewer) 与门 4 并发。若 SKILL.md 含 BLOCKER/HIGH → 短路退出 (verdict: 需修改)。
7. T4: 门 3 第二波 (其余 prompt-bearing 文件, 每文件 × 3 reviewer 并发)。
8. T5: 合并 (id 提升)、给每条 issue 标 `fix_kind`、机械裁决, 产出 `SKILL_REVIEW_REPORT`。
9. 审后修复阶段 (交互, 可选): 确定类批量征同意后改 → 判断类采访 (带进度) → 产出 `REMEDIATION_SUMMARY`。

MUST update the TODO list after each step. Each step MUST end with:

```text
status: pass | fail | needs_user_input
evidence: <file path, tool result, or user answer>
next_action: <continue | ask_user | stop>
```

短路退出的统一动作 (T1 / T2 / T3 的卫语句都指到这里): 跳到步骤 8, 用已回收的产出组装局部 `SKILL_REVIEW_REPORT`——已跑的门带完整结果, 未跑的门标 `result: not-run, mode: skipped-short-circuit`, verdict 按 §6 短路规则取值, 然后进入步骤 9。短路退出仍是正常完成, 不是失败路径。

## 1. 定位目标 (主 agent, 轻量)

按输入类型路由:

- skill 名 / skill 目录路径 / SKILL.md 路径 / 已安装 skill 名 → 解析出 `target_dir` 与 `skill_name`, 继续步骤 2。
- 含多个 skill 的父目录 (如 `own-skills/`) → batch 模式: 对每个子 skill 独立执行步骤 3-8, 汇总一张 per-skill 裁决表; 修复阶段 (步骤 9) 在 batch 模式默认只出报告不逐个采访, 除非用户点名某个 skill 要修。单个 skill 审查失败或短路退出 NEVER 中断其余 skill。
- 内联 prompt / agent 定义片段, 无完整 skill 目录 → 重定向 `prompt-review` 并退出。
- "把 X 做成 skill" 类创建意图 → 重定向 `skill-create-workflow` 并退出。
- 否则 (无法解析出任何目标) → 向用户要 skill 名或路径并退出。

卫语句与清单收集:

- 若 `target_dir` 不存在或其中无 `SKILL.md` → `status: needs_user_input`, 报告确切缺失路径, 退出。
- 主 agent 只做轻量收集: 列出 `target_dir` 下全部 prompt-bearing 文件路径 (`SKILL.md`、`agents/*.yaml`、`agents/*.md`、templates / references 下的 `.md`), 记为 `PROMPT_FILES`, MUST 以 `SKILL.md` 排首位; 读 frontmatter 拿 `name` 字段即止。NEVER 在主会话通读文件正文——正文细读属于各门 SubAgent。

## 2. 能力检查

- 检查当前运行时是否暴露可验证的 SubAgent / Task 派发机制 (Claude Code: Agent tool; Codex: spawn_agent 等)。不可用 → 全部门降级为主会话顺序本地执行 (仍按各门清单逐条跑、仍按同样的分级短路顺序), 报告中所有门标 `mode: local-fallback`。
- 解析四门清单文件路径, 供 SubAgent 模板填充; 每门按顺序取第一个存在的:
  1. 已安装副本: `~/.claude/skills/<门 skill 名>/SKILL.md` (或当前运行时的等价安装路径)
  2. tranfu-skills 仓库副本: `own-skills/<门 skill 名>/SKILL.md` (仅当当前工作区就是该仓库)
- 门 skill 名对应关系: 门 1 → `skill-content-fit`; 门 2 → `skill-domain-framing`; 门 3 → `prompt-review`; 门 4 → 清单内置于门 4 派发模板, 无外部依赖。
- 某门两处清单文件都不存在 → 该门标 `mode: skipped-missing-capability`, 记入 `residual_risks`; 若缺的是门 1 或门 2, 该门无法短路把关, 顺延进入下一级。NEVER 因清单缺失而自创标准替代该门。

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

回收产出记为 `SOURCE_MATERIAL`, 供 T1 门 1 / T2 门 2 填充。

## 执行时刻表 (T0-T5 总览)

| 阶段 | SubAgent | 数量 | 输入 | 并发? | 门槛 (进入条件 / 短路条件) | 产出 |
|---|---|---|---|---|---|---|
| T0 | 去包装 | 1 | `{TARGET_DIR}/SKILL.md` | 串行 | — | `SOURCE_MATERIAL` |
| T1 | 门 1 内容准入 | 1 | `SOURCE_MATERIAL` | 串行 | 依赖 T0; **打回 → 短路退出** | content-fit 结论 |
| T2 | 门 2 任务域 | 1 | `SOURCE_MATERIAL` + `skill_name` | 串行 | T1 pass; **容器框错 → 短路退出** | framing 输出 |
| T3 | 门 3 reviewer-A/B/C (只审 SKILL.md) + 门 4 结构 | 3 + 1 | `SKILL.md` / `TARGET_DIR` | 组内并发 | T2 pass; **SKILL.md 片段含 BLOCKER/HIGH → 短路退出** | REVIEW_PACKET 片段 + structure 结论 |
| T4 | 门 3 reviewer-A/B/C × 其余文件 | 3×(N−1) | `PROMPT_FILES` 除 SKILL.md 外逐个 | 并发 | T3 pass; `PROMPT_FILES` 只有 SKILL.md 时跳过 | REVIEW_PACKET 片段 |
| T5 | (主 agent, 非 SubAgent) 合并 + 标 fix_kind + 裁决 | — | 全部已回收产出 | 串行 | T4 完成, 或任一短路点跳入 | `SKILL_REVIEW_REPORT` |

reviewer 维度分工固定: reviewer-A 审 `A,B`; reviewer-B 审 `C,D`; reviewer-C 审 `E,F,G`。

## 4. T1-T4: 逐级派发四门

### T1: 门 1 SubAgent 派发点

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

回收判定: 返回 `通过` → gate1: pass, 进入 T2。返回 `打回` → gate1: fail, 记录缺失字段 (这不是措辞问题, 是 "该内容不够格成为 skill" 的信号), **短路退出**; 该门的缺失字段 MUST 转成一条判断类采访项 (§7 B2), 附建议选项 [补齐字段后保留 / 降级为普通文档 / 保留现状记风险]。

### T2: 门 2 SubAgent 派发点

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

回收判定: 当前名 == Top1 → gate2: pass, 进入 T3。当前名 ≠ Top1 且 (Top1 总分 − 当前名总分) ≥ 2 → gate2: fail (容器框错), **短路退出**; 转一条判断类采访项, 附建议选项 [改名为 {top1} / 拆分 / 保留现名记风险], 说明改名属重构、由 `skill-create-workflow` 执行。当前名 ≠ Top1 且分差 < 2 → gate2: pass 附 note "存在同分级替代容器 {Top1}, 不构成重构理由"; 该 note 转一条判断类采访项 (是否复议容器), 用户不复议即维持现名, 进入 T3。

### T3: 门 3 第一波 (SKILL.md × 3) + 门 4 并发派发点

对 `SKILL.md`, MUST SPAWN 3 个 reviewer SubAgent 并发分维度审核, 同时并发 SPAWN 1 个门 4 结构检查 SubAgent; 按下面两个模板直接开始任务, reviewer 的 `{DIMENSIONS}` 按时刻表取值 (`A,B` / `C,D` / `E,F,G`), `{FILE_PATH}` 填 `{TARGET_DIR}/SKILL.md`; 无 SubAgent 机制时按 §2 降级。

门 3 reviewer 模板 (T3 / T4 通用):

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

门 4 结构检查模板:

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

回收判定 (等 T3 四个 SubAgent 全部返回): 合并 SKILL.md 的 3 个片段 (维度字母互不相交, 文件内无 id 冲突), 若含 BLOCKER 或 HIGH → gate3: fail, **短路退出** (门 4 结论已回收, 一并写入报告; 未审的其余文件记入 `files_skipped`)。否则进入 T4。

### T4: 门 3 第二波 (其余文件) 派发点

若 `PROMPT_FILES` 除 SKILL.md 外为空 → 跳过 T4, 直接进入 T5。

否则对其余每个文件, MUST SPAWN 3 个 reviewer SubAgent 并发分维度审核, 复用上方 "门 3 reviewer 模板", `{FILE_PATH}` 逐文件填入; 无 SubAgent 机制时按 §2 降级。全部返回后进入 T5。

## 5. T5: 回收、校验、合并与分类 (主 agent)

逐门校验回收物 (T1-T4 每次回收时即用, 此处为统一规则):

1. 任一 SubAgent 无产出 / 产出不合法 (门 1 缺六字段、门 2 缺 `Top1`/分差行或评分表少于 4 行、门 3 片段非合法 YAML、门 4 非列表) → 用同一模板重派一次并附上一轮产出与格式提醒; 再失败 → 该门 (或该文件×维度组) 标 `mode: degraded`, 由主 agent 按对应清单本地补审该缺口, 并记入 `residual_risks`。位于短路判定点的门 (T1/T2/T3) MUST 先补齐结论再决定是否短路, NEVER 拿不合法产出直接放行或直接判死。
2. 合并门 3: 跨文件合并为一个 `REVIEW_PACKET`, 文件顺序 = `PROMPT_FILES` 顺序 (SKILL.md 首位)。**id 提升**指的是把各片段内的局部 issue id 提升为文件限定的全局 id: 各 reviewer 片段内 id 仍从 1 起编 (维度字母+序号), 合并时给每条 issue 的 id 冠上来源文件前缀 (如 SKILL.md 的 `C1` → `SKILL.md#C1`, `agents/openai.yaml` 的 `C1` → `agents/openai.yaml#C1`)。文件内不重编号——重审同一文件时局部 id 稳定; 每条 issue 的 `location` 仍含 `file:line`, 最后重算 ledger。合并后包内 issue id 因带文件前缀而天然唯一。
3. 门 3 与门 4 去重: 命中同一问题时 (如 description 超长) 只保留门 3 的 issue id, 门 4 侧删除该条。
4. **给每条 issue 标 `fix_kind`** (供 §7 分流), 判据见下表; 拿不准归 `judgment` (存疑即问, 不擅自改):

| 来源 / 命中检查项 | 典型 issue | fix_kind |
|---|---|---|
| 门 4 结构 | 缺 Do NOT / CREATE A TODO LIST / example, name 非 kebab, description 超长 | deterministic |
| 门 3 A trigger-coverage | 缺口语 / 非英文触发词 | deterministic |
| 门 3 C no-soft-hedges / hard-constraints-marked | 软词该换 MUST, 硬约束用陈述句 | deterministic |
| 门 3 E todo-list / subagent-explicit / template | 缺 TODO 声明、缺派发模板 | deterministic |
| 门 3 F failure-paths / terminology-consistent | 缺失败路径段、术语不一致 | deterministic |
| 门 3 A intent-ambiguity | 意图歧义怎么处理没写清 | judgment |
| 门 3 B ownership / 边界取舍 | 某相邻任务算不算排除 | judgment |
| 门 3 C priority-resolved | 两条硬规则打架该保哪条 | judgment |
| 门 1 / 门 2 短路项 | 该不该是 skill / 容器命名 | judgment |

判据一句话: **改法唯一且不依赖"作者到底想要什么" = deterministic; 必须先知道作者意图才能定 = judgment**。

## 6. 机械裁决与报告

短路规则 (与 T1-T3 的短路退出共用同一张表):

```text
if gate1 == fail 或 gate2 == fail:
    verdict = 建议重构        # 内容或容器层面的问题, 改措辞救不了
elif gate3 == fail 或 gate4 == fail:
    verdict = 需修改          # gate3: 合并包含 BLOCKER/HIGH; gate4: 列表含 BLOCKER/HIGH
else:
    verdict = 通过            # MEDIUM/LOW 保留为建议, 不影响裁决
```

产出 `SKILL_REVIEW_REPORT` (schema 见下), 进入步骤 9 (审后修复阶段)。若无任何可修 issue (三门全 pass 且无 MEDIUM/LOW) 或用户明确只要报告 → 停在此步。

## SKILL_REVIEW_REPORT (输出 schema)

```yaml
SKILL_REVIEW_REPORT:
  target: <skill 目录绝对路径>
  skill_name: <被审 skill 名>
  short_circuited_at: <null | T1 | T2 | T3>   # 短路退出时记退出点
  gates:
    content_fit:
      result: pass | fail | not-run
      mode: subagent | local-fallback | degraded | skipped-missing-capability | skipped-short-circuit
      evidence: <skill-content-fit 六字段结论摘录>
    domain_framing:
      result: pass | fail | not-run
      mode: subagent | local-fallback | degraded | skipped-missing-capability | skipped-short-circuit
      current_name_score: <0-6>
      top1: <候选名>
      delta: <整数>
      note: <一句话>
    prompt_quality:
      result: pass | fail | not-run
      mode: subagent | local-fallback | degraded | skipped-missing-capability | skipped-short-circuit
      files_covered: [<实际审过的文件, SKILL.md 首位>, ...]
      files_skipped: [<T3 短路时未审的文件>, ...]
      review_packet: <合并后的 REVIEW_PACKET, id 已提升为 file#localid, location 含 file:line>
    structure:
      result: pass | fail | not-run
      mode: subagent | local-fallback | degraded | skipped-missing-capability | skipped-short-circuit
      missing:
        - check: <缺失检查项名, 取自门 4 检查表>
          severity: <检查表对应值>
          location: <SKILL.md 行锚点或 "frontmatter">
          evidence: <未命中的判定依据, 如 "全文无 <bad-example> 标签">
          fix: <一句话改法>
  issues_by_fix_kind:              # 从各门 issue 汇总, 供 §7 分流
    deterministic: [<issue id>, ...]
    judgment: [<issue id 或采访项标识>, ...]
  verdict: 通过 | 需修改 | 建议重构
  top_fixes:
    - <severity 最高的前 3 条 issue 的一句话改法>
  residual_risks: [<降级的门 / 重派后仍失败的 reviewer / 读不到的引用文件>, ...]
```

batch 模式在此之外追加一张 per-skill 汇总表: 每行 `skill_name / verdict / 短路点 / BLOCKER 数 / HIGH 数 / top_fix`。

## 7. 审后修复阶段 (交互, 可选)

进入条件: `SKILL_REVIEW_REPORT` 含至少一条 issue 或一个卡住的门, 且用户在场并愿意继续修复。用户不在场、或明确只要报告 → 跳过本阶段。落盘工具用运行时的编辑工具; 每次落盘只动被同意的那一处, NEVER 借机改同意范围外的地方。

先做确定类 (B1), 再做判断类 (B2)——确定类是快速清账, 判断类要用户拍板耗时更长。

### 7.1 B1: 确定类批量修复

1. 从 `issues_by_fix_kind.deterministic` 取全部 issue → `DET_QUEUE`。空 → 跳到 B2。
2. 逐条列给用户看: `[序号] <issue id> <location> — <fix 一句话>`。
3. 一次征询同意 (Claude Code: AskUserQuestion; Codex Plan: request_user_input; 都不可用则输出编号选项纯文本问题并阻塞等待)。选项 = [全部应用 (推荐) / 我逐条挑 / 全部跳过]。选 "逐条挑" → 再对每条给 应用 / 跳过。
4. 对每条获得同意的 issue, 用编辑工具把该 fix 落到目标文件, 记 `applied_with_consent: <issue id>`。
5. NEVER 应用未获同意的条目; NEVER 触碰 `DET_QUEUE` 之外的任何位置。

### 7.2 B2: 判断类采访 (带进度)

1. 收集 `issues_by_fix_kind.judgment` 的全部 issue + 各门的卡住项 (门 1 打回 / 门 2 复议 / 任一门 degraded 需定夺) → `JUDGE_QUEUE`, 令 `N = len(JUDGE_QUEUE)`。空 → 跳到 B3。
2. **开场 MUST 先报总量**: "需要你拍板 N 个判断点, 采访最多 N 轮, 逐个来。" —— 让用户一开始就知道边界, 不会觉得没完没了。
3. 逐条采访, 每条 MUST 带进度头 `[k/N]`:
   - 陈述发现 + 卡点; 给**具体选项** (≥2 个, 第一个是带一句理由的推荐默认); 需要时附一句建议。NEVER 开放式空问 (如 "你觉得呢?")。
   - 尽量用一次多问的能力 (如 AskUserQuestion 单次最多 4 问) 合并采访, 但每个问题的 header MUST 仍显示它在 N 里的位置。
4. 若某个答复**必然**派生一个追问 → MUST 立刻披露 "此答复新增 1 轮, 现共 {N+1} 轮" 并更新进度分母, 让总量始终对用户可见; 没有必然追问时 NEVER 自行加问。
5. 处置每个答复:
   - 答复指向可落盘的确定改法且用户同意 → 同 B1 落盘, 记 `applied_with_consent`。
   - 答复指向重构 (换容器 / 降级为文档 / 从头重写) → 汇总为交给 `skill-create-workflow` (update / repair) 的输入, 本 skill NEVER 自行大改。
   - 答复为 "保留现状记风险" → 记入 `REMEDIATION_SUMMARY.deferred`。

### 7.3 B3: 修复小结

产出命名产物 `REMEDIATION_SUMMARY`:

```yaml
REMEDIATION_SUMMARY:
  applied: [{issue: <id>, file: <path>, consent: <批量 | 逐条 | 采访答复>}, ...]
  interviewed: [{item: <采访项>, answer: <用户答复>, disposition: <applied | handoff | deferred>}, ...]
  handoff_to_skill_create_workflow: [<需重构的项, 及交接要点>, ...]
  deferred: [<跳过或记风险的项>, ...]
  rereview_advice: <若落盘 ≥1 处触发面 / 结构改动, 建议对改动文件重跑门 3 / 门 4 一轮; 但本 skill 不自动 loop, 由用户触发>
```

## 失败路径

- 目标不存在或无 SKILL.md → `status: needs_user_input`, 报确切缺失路径并退出。
- 运行时无 SubAgent 机制 → 全部门 `mode: local-fallback`, 主会话按同一分级短路顺序执行, NEVER 跳门。
- 门清单文件两处都读不到 → 该门 `mode: skipped-missing-capability`, 记入 `residual_risks`; 短路判定点缺门时顺延进入下一级, 不视为 pass 也不视为 fail。
- SubAgent 无产出或产出不合法 → 同模板重派一次; 再失败 → 该缺口 `mode: degraded`, 主 agent 本地补审并记入 `residual_risks`; 短路判定点 MUST 补齐结论后再决定去留; 该 degraded 门转一条判断类采访项 (附建议: 重派 / 接受本地补审 / 跳过并记风险)。
- SKILL.md 引用的附属文件缺失 → 门 4 记 HIGH (悬空引用), 继续审查。
- 修复阶段征询工具都不可用 (无 AskUserQuestion / request_user_input, 且非交互会话) → NEVER 擅自落盘; 跳过修复阶段, 在报告里标 `remediation: skipped-no-consent-channel` 并把待修项留给用户手动处理。
- batch 模式中单个 skill 审查中断或短路退出 → 该 skill 在汇总表记录其 verdict 与短路点, 其余继续。
- 目标是 `skill-improve-workflow` 自身 → 照常审, 无特权豁免。

<example>
User: "帮我审一下 own-skills/daily-report 这个 skill"

Workflow (走完全程 + 修复的情形):
1. 定位: `target_dir: own-skills/daily-report`, `PROMPT_FILES: [SKILL.md, agents/openai.yaml]`, 主 agent 只读 frontmatter。status: pass。
2. 能力检查: Agent tool 可用; 三门清单在 `~/.claude/skills/` 均有安装副本。status: pass。
3. T0: 去包装 SubAgent 回收 `SOURCE_MATERIAL`。status: pass。
4. T1: 门 1 返回 `通过`。gate1: pass, 进入 T2。
5. T2: 门 2 返回 `Top1: daily-report, 分差 3`, 当前名即 Top1。gate2: pass, 进入 T3。
6. T3: SKILL.md × 3 reviewer + 门 4 并发。SKILL.md 片段 1 条 MEDIUM (`SKILL.md#F1` 术语不一致), 无 BLOCKER/HIGH → 不短路; 门 4 缺 `<bad-example>` (HIGH)。进入 T4。
7. T4: agents/openai.yaml × 3 reviewer, 回收 1 条 HIGH (`agents/openai.yaml#C1` 软词该换 MUST) 与 1 条 judgment (`agents/openai.yaml#B1` 边界该不该排除某任务)。
8. T5: id 提升 (各片段带文件前缀, 无冲突); 标 fix_kind: `SKILL.md#F1`/门4缺example/`agents/openai.yaml#C1` → deterministic, `agents/openai.yaml#B1` → judgment。gate3 fail (HIGH), gate4 fail (HIGH) → `verdict: 需修改`。产出 SKILL_REVIEW_REPORT, 此刻零文件改动。
9. 修复阶段——B1: 列 3 条确定类 fix, 一次征同意, 用户选 "全部应用" → 落 3 处改动, 各记 consent。B2: N=1, 开场报 "需拍板 1 个判断点"; `[1/1]` 问 "openai.yaml 里 X 任务算不算该排除? A. 排除(推荐, 因成功标准不同) B. 保留 C. 保留现状记风险", 用户选 A → 落盘。B3: 产出 REMEDIATION_SUMMARY (applied 4 项, interviewed 1 项, deferred []), rereview_advice: 触发面有改动, 建议重跑门 3。
</example>

<bad-example>
WRONG: "这个 skill 已经在库里用了半年, 内容准入肯定没问题, 门 1 跳过。"

Reason: 存量不等于够格。skill 库里恰恰会沉积当年没过准入门禁就进来的条目; 门 1 的意义就是补做当年缺的判断。
</bad-example>

<bad-example>
WRONG: 采访判断点时一条一条问, 不报总数、不带 `[k/N]`, 用户答了 5 个还不知道还剩几个。

Reason: 违反 "每轮表明进度"。开场 MUST 报 N, 每问 MUST 带进度头, 必然追问 MUST 披露增量 (N+1); 否则用户感觉问题无穷无尽, 中途弃答。
</bad-example>

<bad-example>
WRONG: 审出 "软词该换 MUST" 这种确定类改法, 觉得改法显然, 直接改了目标文件没问用户。

Reason: 确定类也 MUST 先经 B1 逐条或批量征得同意才落盘。审→改的闸门是 "用户同意", 不是 "问题够不够显然"; 越过同意闸即越权。
</bad-example>

<bad-example>
WRONG: 把 "容器命名该不该换" 这种判断类问题, 由本 skill 自己拍板改名并重构目录。

Reason: 判断类无唯一答案, MUST 采访用户; 且换容器 / 重构是 `skill-create-workflow` 的活, 本 skill 只交接不自行大改。
</bad-example>

## Runtime Tool Notes

Use only tools that exist in the current runtime.

- SubAgent 派发: Claude Code 用 Agent tool (只读型审查可用 Explore 类); Codex 用 spawn_agent / wait_agent。派发前确认机制存在, 不存在即走 §2 的 local-fallback。
- 采访 / 征同意: Claude Code 用 AskUserQuestion; Codex Plan 模式用 request_user_input; 都不可用则输出编号选项的纯文本问题并阻塞等待。NEVER 写指令要求 "开启 Plan 模式"——模式切换由运行时或用户控制。
- 门 1 / 门 2 / 门 3 SubAgent 优先读清单文件执行; 运行时允许 SubAgent 内调用 skill 时可直接调用对应门 skill, 两种方式产出格式一致。
- 只读工具用于审查阶段; 编辑工具**只在 §7 修复阶段、且获得对应同意后**用于 `target_dir`; 审查阶段 NEVER 对 `target_dir` 调用任何写文件工具。
