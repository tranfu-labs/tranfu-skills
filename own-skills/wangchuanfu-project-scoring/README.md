# Wangchuanfu Project Scoring

Wangchuanfu Project Scoring is a Codex skill for reviewing AI workflow projects before validation, demo development, internal立项, or co-creation investment. It behaves like a restrained project approval interviewer: it asks for core facts first, then produces a decision memo with weighted scoring, hard-gate checks, risks, and one next action.

## 什么时候用

Use this skill when a teammate or agent needs to decide whether an AI workflow idea should be approved, validated, deferred, rejected, or reshaped. It is especially useful for company-internal AI initiatives, Transfu skill assets, public demos, research probes, and external product/MVP ideas.

Do not use it as a generic product backlog sorter. RICE, ICE, and WSJF are better for ranking many already-approved features. This skill is for deciding whether an AI workflow project deserves investment at all.

## 触发示例

- `用望船夫项目评分器评估这个 AI 工作流项目: ...`
- `Use $wangchuanfu-project-scoring to review this internal AI initiative: ...`
- `帮我判断这个 Transfu skill idea 是否值得小步立项: ...`
- `对这个 demo 概念做立项审核, 如果信息不足先问我问题。`

## 期望输出

When the input is thin, the skill should return clarification questions instead of a fake score. When enough facts are available, it should produce a Markdown decision memo with:

- project type and weight profile
- total score, confidence, and information completeness
- hard-gate checks
- 10-dimension scoring table
- missing information and evidence levels
- riskiest assumption
- 7-day validation experiment
- failure preview
- exactly one primary next action

## 本地预评分脚本

For lightweight regression checks, run:

```bash
python3 scripts/score_project.py path/to/project.json
```

Use `--force-score` only when you intentionally want a provisional low-confidence score for thin input. By default, thin input should return `type: clarification`.
