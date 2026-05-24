---
recommender: aquarius-wing
recommended_at: 2026-05-24
reason_kind: tried-and-good
scenario_tag: 公司级 skill 评测协议可视化, 评审界面设计
source_session_summary: skill-eval 项目跑 layer-2 viz 评审界面 (`web-goal-docs/_visual/index.html`), 用 visual-pipeline 三段流水线产出, 反复迭代 r1→r6 都用归属判定回溯, 没出现"先编后改"漂移.
---

## 怎么发现的

skill-eval 项目要做一个**公司级标准 skill 评测协议**的评审界面 (评测员看 runs / 看分数 / 看证据). 第一稿想直接画 HTML, 画完发现"我自己都不知道为什么这块要放这", 改第二轮就开始打架. 把流程拆成"显示信息 / 显示框架 / 风格"三段后, 每次改都有锚点.

## 它做了什么

- 输入: "评测员场景 + 要显示的字段 (run id / metric / 证据片段)"
- 三段产出依次:
  - `01-display-info.md` — 锁住"主场景 = 评测员看一次 run", 必看字段优先级
  - `02-skeleton.md` + `02-skeleton.html` — 灰盒 wireframe + 真模拟数据, 旁边图例
  - `03-style.md` + `03-selected.html` — ChatGPT 式 Chat + bar-chart 主列表, 选定调性
- 反复 r1 → r6 迭代, 每轮用户说"不对", 都先归属再改, 没有跨段乱串

## 我特别想强调的点

**归属判定是核心.** 用户说"这块感觉不对", 第一反应不是改 HTML, 是问"这是信息段没锁还是框架段没锁?". 这一步把 80% 的"改了又改"消灭在动手前. 别的同类 skill 都没这条.

## 我没用上但可能也很好用的延伸

- 多页项目: 我只跑了 1 个页面, 但 skill 设计成"每页独立 + 可继承共享设计语言", 多页应该能复用基线
- 跟 `ui-ux-pro-max` 配合: 风格段调色 / 字体可以直接调它的材料库, 我这次手搓了
