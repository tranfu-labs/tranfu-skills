<!--
case 文件模板. 落点: external-skills/{name}/cases/{recommender}.md
B/C/D 三条路径共用. {...} 是占位符.

frontmatter 三必填: recommender / recommended_at / reason_kind
两选填: scenario_tag / source_session_summary

多场景 append 规则 (见 SKILL.md §6):
  - 同一 recommender 对同一 skill 只有一个文件, 加新场景 → append 到 body 末尾
  - 不开 <recommender>-1.md / <recommender>-tranfu.md 这种碎裂文件
  - 用二级标题 `## <new scenario tag>` 起新段
  - frontmatter recommended_at 改为最新日期; scenario_tag 改为逗号分隔多值
-->

---
recommender: {gh user handle}
recommended_at: {today, e.g. 2026-05-11}
reason_kind: {solves-real-pain | time-saver | quality-jump | unexpected-good-fit | discovered-elsewhere | team-need | other}
scenario_tag: {选填, 短词; 多场景用逗号分隔, e.g. "审稿,画图"}
source_session_summary: {选填, ≤200 字, AI 概括 "我从哪段对话推断这个推荐"}
---

## 怎么发现的

{场景: 我在用 Claude Code 做 X, 上下文是 Y...}

## 它做了什么

{具体例子: 用户输入了什么, skill 输出了什么}

![示例截图](_assets/{recommender}.png)

## 我特别想强调的点

{一两句作为 "标题感" 内容}

## 我没用上但可能也很好用的延伸

{可选}
