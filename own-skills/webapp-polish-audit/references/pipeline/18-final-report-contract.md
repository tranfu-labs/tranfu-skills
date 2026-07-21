# 18. 最终报告契约

本文件是 `polish-audit-report.json`、`audit-state.json`、聚合者和最终验收者的唯一契约。其他文件不得重新定义这些字段、枚举或 ownership。

机械校验由 `scripts/validate-polish-audit-report.mjs` 执行，它是这些规则的可执行实现；下面的约束以它的判定为准，本文档负责让聚合者在写之前就知道规则。

## 报告 schema

UTF-8 JSON，不是 YAML。

```json
{
  "polish_audit_report": {
    "run_id": "20260717-103706-settings-audit",
    "pages": [
      {
        "url": "http://localhost:3000/settings/",
        "page_family": "",
        "viewports_anchored": ["1280x720", "390x844"],
        "findings": [
          {
            "id": "settings-07-D-1",
            "severity": "MEDIUM",
            "disposition": "actionable",
            "dimension": "07",
            "class": "D",
            "location": {
              "page": "http://localhost:3000/settings/",
              "viewport": "1280x720",
              "target": "保存按钮"
            },
            "evidence": {
              "type": "dom",
              "refs": ["settings__07-D__probe.json"]
            },
            "observation": "提交后按钮无提交中 / 成功 / 失败的可区分状态。",
            "expected": "提交过程与结果对用户可见。",
            "user_impact": "用户无法判断提交是否已受理，可能重复点击。",
            "reference_doc": "references/dimensions/07-form-completion-confidence.md",
            "fix_recommendation": "补提交中态与结果态，成功后给出明确反馈。"
          }
        ],
        "class_coverage": [
          {
            "dimension": "07",
            "class": "D",
            "verdict": "actionable",
            "evidence_refs": ["settings-07-D-1"]
          }
        ],
        "disposition_history": []
      }
    ],
    "gaps": [],
    "blockers": []
  }
}
```

唯一枚举：

- `severity`：`BLOCKER | HIGH | MEDIUM | LOW`（禁止 P0/P1/P2/P3）
- `disposition` / `verdict`：`actionable | already_satisfied | blocker | not_applicable | pending_authorization`
  - `pending_authorization`：技术上验得了、但需用户授权才能执行的路径（破坏性动作、真实提交、写数据）。**不是缺陷，是待决策项**——`evidence_refs` 必须引用顶层 `pending_authorizations` 里的条目 id。
- `evidence.type`：`dom | a11y | computed_style | layout_box | interaction_state | screenshot`
  - `screenshot` 只经 SKILL.md §0「受限截图」例外产生，且**不能独立成立**：同一 finding 的 `refs` 必须并列同 class 的 `script:` 或 `.json` 证据，否则校验失败。用了截图证据就必须有 `audit-state.json.screenshot_log` 留痕，全审计上限 3 张。
- `dimension`：两位数字，且只能是主流程五条之一（`03` / `07` / `10` / `11` / `13`）

`class_coverage` 永远是对象数组，绝不是按维度嵌套的 map。

## gap / blocker

```json
{
  "gaps": [
    {
      "id": "settings-10-E-gap-1",
      "page": "http://localhost:3000/settings/",
      "dimension": "10",
      "class": "E",
      "reason": "未取得 200% zoom 证据"
    }
  ],
  "blockers": [
    {
      "id": "settings-coverage-blocker-1",
      "stage": "S6",
      "page": "http://localhost:3000/settings/",
      "reason": "部分可访问性状态尚未验证",
      "gap_ids": ["settings-10-E-gap-1"],
      "unit_ids": []
    }
  ]
}
```

## pending_authorizations（待授权路径）

与 `gaps` / `blockers` 并列的顶层数组。**它不是缺陷清单，是待用户拍板的决策清单**——发现了路径、知道怎么验、按边界停下了。

```json
{
  "pending_authorizations": [
    {
      "id": "home-03-B-auth-1",
      "page": "https://example.com/settings",
      "dimension": "03",
      "class": "B",
      "discovered": "「清空全部数据」按钮，静态 DOM 里无 confirm 弹层、无 aria-haspopup=dialog 信号",
      "would_verify": "在拦截 fetch/XHR/sendBeacon/location 的前提下模拟点击，500ms 后比对 DOM，确认是否弹出二次确认",
      "cost_if_skipped": "无法区分「真的没有保护」与「保护存在但静态不可见」；03.B 只能悬置",
      "how_to_authorize": "在 staging / localhost 环境重跑，并在指令中写明「允许模拟破坏性动作」"
    }
  ]
}
```

五个字段全部必填。`cost_if_skipped` 要说清哪个 class 因此悬置，`how_to_authorize` 要给出可直接照做的指令，不能只写"需要授权"。

`class_coverage.verdict = pending_authorization` 时，`evidence_refs` 必须引用这里的 id。

引用完整性规则：

- `verdict=blocker` 时 `evidence_refs` 必须引用 gap id，`blocker_reason` 非空，且该 gap 被至少一个顶层 blocker 的 `gap_ids` 引用。
- `actionable` / `already_satisfied` 的 `evidence_refs` 必须引用同页、同 dimension、同 class 的 finding id。
- `not_applicable` 的 `evidence_refs` 必须为空。
- 判定单元本身 blocked 时，顶层 blocker 的 `id` 等于该 unit id，或其 `unit_ids` 包含该 unit id。

## audit-state schema

```json
{
  "run_id": "20260717-103706-settings-audit",
  "scope": "explicit-single-page",
  "path": "standard",
  "stages": {
    "S0": "completed",
    "S1": "skipped_explicit_single_page",
    "S2": "completed",
    "S3": "completed",
    "S4": "completed_with_blockers",
    "S5": "completed",
    "S6": "completed",
    "S7": "running"
  },
  "judgement_units": [
    {
      "id": "settings-07-D",
      "dimension": "07",
      "class": "D",
      "evidence": ["settings__07-D__probe.json"],
      "status": "verified",
      "judge_tasks": ["judge-a-settings-07-D", "judge-b-settings-07-D"]
    }
  ]
}
```

- 一个判定单元 = 一个 `脚本+文本判` class（不是一张截图）。`脚本直判` class 不产 unit。
- `judge_tasks` 必须至少两项且互不相同——双判断者并行决胜的隔离由校验脚本机械校验；分歧时追加的决胜作为第三项写入。
- 合法 stage 终态：`completed | completed_with_blockers | skipped_explicit_single_page | skipped_micro_audit`。S7 在校验脚本执行前可为 `running`，通过后改 `completed`。
- 合法判定单元终态：`verified | blocked`。
- `path`：`standard | micro-audit`。走快速通道时另需 `script_run_log`，且 S3–S6 记 `skipped_micro_audit`（详见 SKILL.md §4.5）。
- `screenshot_log`：可选，仅在动用「受限截图」例外时出现。每条 `{dimension, class, script_gave, why_insufficient, confirms}` 五字段齐全，全审计最多 3 条：

  ```json
  "screenshot_log": [
    {
      "dimension": "07",
      "class": "D",
      "script_gave": "disabled=false, aria_busy 缺失, DOM 比对为空",
      "why_insufficient": "脚本无法表征提交后是否有可见变化",
      "confirms": "提交态对用户是否可感知"
    }
  ]
  ```

## 派发模板

聚合者：

```text
角色：你是本次审计唯一聚合者。你不是判断者或验收者，不打开浏览器。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/18-final-report-contract.md。

输入：
- verifiedJudgements: {VERIFIED_JUDGEMENTS}
- evidenceBundles: {EVIDENCE_BUNDLES}
- pagePlans: {PAGE_PLANS}
- auditStatePath: {AUDIT_STATE_PATH}
- runDir: {RUN_DIR}

要求：
- 只聚合已达成判断者一致（verified）的判定结果；blocked unit 只能进 gaps/blockers。
- 使用本文件的 schema 与枚举。
- 同一问题跨证据源去重，但保留全部 evidence refs。
- 不静默删除 fresh_findings / uncatalogued；上报或在 disposition_history 写明去重原因。
- 把完整 JSON 写到 {RUN_DIR}/polish-audit-report.draft.json，最终只输出一行该绝对路径。
```

最终验收者：

```text
角色：你是独立最终验收者。你未参与页面发现、证据采集、判定结果、聚合或浏览器锚定。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/18-final-report-contract.md。

输入：
- reportPath: {REPORT_PATH}
- auditStatePath: {AUDIT_STATE_PATH}
- runDir: {RUN_DIR}
- validatorOutput: {VALIDATOR_OUTPUT}

验证：
1. validatorOutput.verdict 必须为 pass。
2. 每个判定单元为 verified|blocked，且 judge_tasks 至少两项、互不相同。
3. blocked unit 能在顶层 blockers 中定位。
4. class_coverage、gaps、blockers、findings 不相互矛盾。
5. 浏览器锚定推翻的 finding 保留在 disposition_history，未静默消失。
6. 报告不提及未执行的检查，不引用项目源码。

只输出 JSON：{"verdict":"pass|fail","errors":["..."]}
```

## 面向用户的完成输出

最终回复包含四部分，缺一不可：

1. **可行动发现**——按严重度排序。
2. **待你确认的路径**（`pending_authorizations`）——**必须单独成节**，不能并进 gaps 也不能省略。每条写清：发现了什么、授权后能验什么、不验的代价、怎么授权。**没有待授权项时明确写"无"**，不要静默跳过——用户需要知道这是"查全了"而不是"忘了报"。
3. **gaps 与 blockers**——技术上没查成的，与上一节区分开。
4. **确切审计视口 + 报告路径**。

第 2 节是用户唯一的决策入口。把它埋进 gaps 里，或者因为"没查所以不提"，等于让用户以为已经查全——那正是这套机制要防的事。

不要把完整 JSON 贴进回复。报告是机读事实源，回复是用户可读摘要。
