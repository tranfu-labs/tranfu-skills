---
description: "把一次会话中用户的修正提炼成「场景 → 期望输出」表格行，追加进对应 SKILL 文件；通用偏好分流到 memory，不落 SKILL。"
prompt_examples:
  - prompt: 把这次会话里我的修正沉淀到对应的 skill。
    scene: 沉淀会话修正
  - prompt: 把刚才那几条纠偏记进这个 skill 的沉淀表。
    scene: 追加到单个 skill
  - prompt: 我这次的修正哪些该进 skill、哪些该进 memory？
    scene: 修正分流
---

# session-corrections-to-skill 会话修正沉淀

把会话中用户的修正变成可持久的 skill 知识。四步：列举历次修正（含回退和"不对/不要"类转折）→ 逐条路由到它所纠正的 skill → 提取成「场景 → 期望输出」对（agent 当时的场景 → 用户实际想要的）→ 以一行表格追加进该 SKILL 的用户修正沉淀表。针对 agent 通用工作方式的修正永不落 SKILL——单独列出标注待归档，本 skill 不代写 memory。

产出形态与经验纠偏型 skill 的场景表同构：一条修正、一行、两列。不新开章节、不复述既有内容、不借机重写。

## 什么时候用

- 一次会话里多次纠正了某个 skill 的行为，想让它记住
- 想把"该进 skill 的"和"只是我的通用偏好"干净分开

## 你会得到什么

- 每条修正在正确的 SKILL 文件里追加一行「场景 → 期望输出」
- 一份对账单：修正 → 落点 SKILL 路径 → 追加的行
- 单独的"归 memory"清单——通用类修正不碰任何 SKILL 文件
