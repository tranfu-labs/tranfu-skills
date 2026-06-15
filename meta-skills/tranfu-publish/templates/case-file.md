<!--
case 文件模板, 仅 case 路径用 (own/external 不起草 case)。落点: <own|external>-skills/{name}/cases/{recommender}.md。{...} 占位符替换。

frontmatter 三必填: recommender / recommended_at / reason_kind; 两选填: scenario_tag / source_session_summary。

reason_kind 封闭集 (选 1): tried-and-good (用过觉得好) / tried-and-bad (用过觉得不行但有学习价值) / read-and-curious (没用过看着不错) / solves-real-pain / time-saver / quality-jump / team-need / other (自由文字进 body, frontmatter 落 "other")。

多场景 append: 同一 recommender 对同一 skill 只一个文件, 加场景 → append 二级标题 `## <new scenario>` 到末尾; recommended_at 改最新; scenario_tag 改逗号分隔。不开 <recommender>-1.md 这种碎裂文件。
-->

---
recommender: {gh user handle}
recommended_at: {today, e.g. 2026-05-11}
reason_kind: {tried-and-good | tried-and-bad | read-and-curious | solves-real-pain | time-saver | quality-jump | team-need | other}
scenario_tag: {选填, 短词; 多场景逗号分隔, e.g. "审稿,画图"}
source_session_summary: {选填, ≤200 字, AI 概括 "从哪段对话推断这个推荐"}
---

## 怎么发现的

{场景: 我在用 Claude Code 做 X, 上下文是 Y...}

## 它做了什么

{具体例子: 用户输入了什么, skill 输出了什么}

![示例截图](_assets/{recommender}.png)

## 我特别想强调的点

{一两句 "标题感" 内容}

## 我没用上但可能也很好用的延伸

{可选}
