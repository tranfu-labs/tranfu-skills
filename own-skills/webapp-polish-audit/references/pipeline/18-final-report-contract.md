# 18. Final Report Contract

本文件是 `polish-audit-report.json`、`audit-state.json`、Aggregator 和 Final verifier 的唯一契约。其他文件不得重新定义这些字段、枚举或 ownership。

## Canonical report schema

最终报告必须是 UTF-8 JSON，不是 YAML。顶层结构：

```json
{
  "polish_audit_report": {
    "run_id": "20260717-103706-homepage-audit",
    "pages": [
      {
        "url": "http://localhost:3000/",
        "page_family": "",
        "viewports_anchored": ["1280x720", "390x844"],
        "findings": [
          {
            "id": "home-09-E-1",
            "severity": "MEDIUM",
            "disposition": "actionable",
            "dimension": "09",
            "class": "E",
            "location": {
              "page": "http://localhost:3000/",
              "viewport": "1280x720",
              "target": "Skill 卡片复制按钮"
            },
            "evidence": {
              "type": "screenshot",
              "refs": ["home__copy-success__desktop__1280x720__closeup--copy-command-btn.png"]
            },
            "observation": "复制动作使用下载图标。",
            "expected": "图标与复制动作语义一致。",
            "user_impact": "用户可能误以为会下载文件。",
            "reference_doc": "references/dimensions/09-visual-trust-and-consistency.md",
            "fix_recommendation": "改用复制图标，成功后切换为勾选。"
          }
        ],
        "class_coverage": [
          {
            "dimension": "09",
            "class": "E",
            "verdict": "actionable",
            "evidence_refs": ["home-09-E-1"]
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

- `severity`: `BLOCKER | HIGH | MEDIUM | LOW`
- `disposition` / `verdict`: `actionable | already_satisfied | blocker | not_applicable`
- `evidence.type`: `screenshot | dom | a11y | computed_style | layout_box | interaction_state`

禁止使用 `P0/P1/P2/P3`。`class_coverage` 永远是对象数组，绝不是按维度嵌套的 map。

## Gap and blocker schema

```json
{
  "gaps": [
    {
      "id": "home-10-E-gap-1",
      "page": "http://localhost:3000/",
      "dimension": "10",
      "class": "E",
      "reason": "未取得 200% zoom 证据"
    }
  ],
  "blockers": [
    {
      "id": "home-coverage-blocker-1",
      "stage": "S6",
      "page": "http://localhost:3000/",
      "reason": "部分可访问性状态尚未验证",
      "gap_ids": ["home-10-E-gap-1"],
      "unit_ids": []
    }
  ]
}
```

`class_coverage.verdict=blocker` 时：

- `evidence_refs` 必须引用一个或多个 gap id；
- `blocker_reason` 必须非空；
- 对应 gap 必须被至少一个顶层 blocker 的 `gap_ids` 引用。

S4 judgement unit 本身 blocked 时，顶层 blocker 的 `id` 必须等于该 unit id，或其 `unit_ids` 必须包含该 unit id。

`actionable` 和 `already_satisfied` 的 `evidence_refs` 必须引用同页、同 dimension、同 class 的 finding id。`not_applicable` 的 `evidence_refs` 必须为空。

## audit-state schema

```json
{
  "run_id": "20260717-103706-homepage-audit",
  "scope": "explicit-single-page",
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
      "id": "home-default-desktop-full-01",
      "kind": "single",
      "files": ["home__default__desktop__1280x720__full--01.png"],
      "status": "verified",
      "judge_task": "judge-home-default-desktop-full-01",
      "verifier_task": "verify-home-default-desktop-full-01"
    }
  ]
}
```

合法 stage 终态：`completed | completed_with_blockers | skipped_explicit_single_page`。S7 在 validator 执行前可为 `running`，validator 通过后改为 `completed`。合法 judgement unit 终态：`verified | blocked`。

## Aggregator dispatch template

```text
角色：你是本次审计唯一 Aggregator。你不是 judge 或 verifier，不打开 Browser，不读取项目源码。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/18-final-report-contract.md。

输入：
- verifiedJudgements: {VERIFIED_JUDGEMENTS}
- manifests: {MANIFESTS}
- pagePlans: {PAGE_PLANS}
- auditStatePath: {AUDIT_STATE_PATH}
- runDir: {RUN_DIR}

要求：
- 只聚合已通过 verifier 的 judgement；blocked unit 只能进入 gaps/blockers。
- 使用本文件唯一 JSON schema 和枚举。
- 同一可见问题跨截图去重，但保留全部 evidence refs。
- 不静默删除 fresh_findings / uncatalogued；上报或在 disposition_history 中写明去重原因。
- 把完整 JSON 写到 {RUN_DIR}/polish-audit-report.draft.json。
- 最终只输出一行该绝对路径；不要输出报告正文或解释。
```

## Final verifier dispatch template

```text
角色：你是独立 Final verifier。你未参与 discovery、selection、exploration、judgement、阶段 verifier、aggregation 或 Browser 锚定。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/18-final-report-contract.md。

输入：
- reportPath: {REPORT_PATH}
- auditStatePath: {AUDIT_STATE_PATH}
- runDir: {RUN_DIR}
- validatorOutput: {VALIDATOR_OUTPUT}

验证：
1. validatorOutput.verdict 必须为 pass。
2. 每个 judgement unit 必须为 verified|blocked，且 judge_task 与 verifier_task 非空且不同。
3. blocked unit 必须能在顶层 blockers 中定位。
4. class_coverage、gaps、blockers 和 findings 不得相互矛盾。
5. Browser 锚定推翻的 finding 必须保留在 disposition_history，不得静默消失。
6. 最终报告不得提及未执行检查，不得引用项目源码。

只输出 JSON：
{"verdict":"pass|fail","errors":["..."]}
```

## User-facing completion

Final verifier 通过后，最终回复只包含：

- 按严重度排序的可行动发现摘要；
- 明确 gaps 和 blockers；
- 确切审计视口；
- `polish-audit-report.json` 的路径。

不要把完整 JSON 再贴进回复。报告是机读事实源，回复是用户可读摘要。
