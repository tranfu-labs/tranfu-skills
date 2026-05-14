<!--
case 文件模板. 落点: external-skills/{name}/cases/{recommender}.md
external / case 两条路径用. own 路径不用 (own 无"推荐者"概念). {...} 占位符替换.

frontmatter 三必填: recommender / recommended_at / reason_kind
两选填: scenario_tag / source_session_summary

多场景 append 规则:
  - 同一 recommender 对同一 skill 只有一个文件, 加新场景 → append 到 body 末尾
  - 不开 <recommender>-1.md / <recommender>-tranfu.md 这种碎裂文件
  - 用二级标题 `## <new scenario tag>` 起新段
  - frontmatter recommended_at 改为最新日期; scenario_tag 改为逗号分隔多值

reason_kind 枚举 (封闭集, 从中选 1):
  tried-and-good     — 我用过, 觉得好
  tried-and-bad      — 我用过, 觉得不行 (但有学习价值)
  read-and-curious   — 没用过, 看着不错, 推给团队评估
  solves-real-pain   — 解决了具体痛点
  time-saver         — 显著节省时间
  quality-jump       — 输出质量明显提升
  team-need          — 同事最近做的事正好对口
  other              — 自由文字进 body, frontmatter 落 "other"
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
