# Wangchuanfu Project Scoring

Wangchuanfu Project Scoring is a Codex skill for deciding whether an AI workflow project deserves validation, demo development, company-internal立项, or co-creation investment. It behaves like a restrained approval interviewer: it asks for the missing facts first, then produces a weighted decision memo with hard gates, risks, a 7-day validation experiment, and exactly one next action.

## 什么时候用它

Use this skill when a teammate or agent brings an AI workflow idea and needs a decision, not just encouragement. Good fits include internal AI initiatives, Transfu skill assets, public demos, research probes, and external product/MVP ideas.

Do not use it as a generic backlog sorter. RICE, ICE, and WSJF are better for ranking already-approved features. This skill is for answering whether the project should be approved, validated, reshaped, observed, or rejected.

## 怎么用 (触发示例)

Tell Codex:

- `用望船夫项目评分器评估这个 AI 工作流项目: ...`
- `Use $wangchuanfu-project-scoring to review this internal AI initiative: ...`
- `帮我判断这个 Transfu skill idea 是否值得小步立项: ...`
- `对这个 demo 概念做立项审核, 如果信息不足先问我问题。`

Best first input:

- project name and one-sentence description
- target user and repeated usage scene
- current workaround or substitute solution
- concrete AI role in the workflow
- first validation path or first user/source
- known responsibility boundary for high-risk domains

## 你会看到什么

If the input is too thin, the skill should return 3-5 clarification questions instead of a fake score. If enough facts are available, it produces a Markdown decision memo with:

- project type, weight profile, and information completeness
- total score, confidence, and evidence levels
- hard-gate checks and 10-dimension scoring table
- missing information and key risks
- riskiest assumption and 7-day validation experiment
- failure preview
- exactly one primary next action

## 本地预评分脚本

For lightweight regression checks, run:

```bash
python3 scripts/score_project.py path/to/project.json
```

Use `--force-score` only when you intentionally want a provisional low-confidence score for thin input. By default, thin input should return `type: clarification`.
