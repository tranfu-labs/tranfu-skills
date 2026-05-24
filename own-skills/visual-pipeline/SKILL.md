---
name: visual-pipeline
description: 当用户要设计一个页面 (UI/视觉/产品层, 不是只写代码) 或修改已有视觉设计时, 驱动三段流水线 (显示信息 → 显示框架 → 风格+实践), 每页独立, 先文档后 HTML. 输入 = "已知用户场景 + 已知要显示什么", 输出 = 高保真选定版. 不用于: 文案小改 / 单 bug 代码修复 / 纯后端.
version: 0.1.0
author: aquarius-wing
updated_at: 2026-05-24
origin: own
---

# visual-pipeline

产品设计后段流水线: **已知要显示什么 + 用户场景 → 高保真选定版**.

代码实现及之后的环节**不在范围内**.

## 何时拉起

- 用户要"设计 / 做 / 改 X 页面" 且偏视觉 / 产品层
- 单位 = **页面**. 一个页面跑一遍, 多个页面跑多遍.
- 每页都有自己独立的风格判定 (不共享风格段)

## 核心铁律 (违反一条这套就废)

1. **每段先文档, 后 HTML**. 显示框架段 / 风格段必须文档 → HTML 顺序. 不允许只 HTML 没文档.
2. **不跳段**. 显示信息段不锁不进显示框架段; 显示框架段不锁不进风格段.
3. **每页独立风格段**. 可以在文档里写"继承自项目共享设计语言", 但本页特殊判定必须本页给出.
4. **修改走 `change-flow.md`**, 先归属再动手.
5. **全程中文, 不用英文缩写**. 不出现 S1/S2/P0/P1/R1/R2/状态 A 等. 直接用中文名 (主场景、必看字段、头部区、入口态 等).

## 三段产物

| 段 | 文档 | HTML |
|---|---|---|
| 一、显示信息 | `01-display-info.md` | — |
| 二、显示框架 | `02-skeleton.md` | `02-skeleton.html` (灰盒 wireframe, 中间真模拟数据, 旁边图例字段) |
| 三、风格 + 实践 | `03-style.md` | `03-selected.html` + 备选 `03-alt-*.html` (每个 HTML 内含「组件样例库」+「整体组合」两个 section) |

详见 `stages/0X-*.template.{md,html}`.

## 修改

任何改动 (用户说"不对 / 加 X / 去掉 Y / 颜色换" 等), 走 `change-flow.md`. 第一步永远是**归属判定** (这是哪一段的决策), 不归属直接改 = 复现历史阻塞.

## Demo 参照

`examples/_visual-index/` — 评审界面 (`web-goal-docs/_visual/index.html`) 的反向跑, 看每段产物长啥样.

## 输出目录约定

跑一个新页面时, 在调用方约定的目录下产出:

```
<page-dir>/
├── 01-display-info.md
├── 02-skeleton.md
├── 02-skeleton.html
├── 03-style.md
├── 03-selected.html
├── 03-alt-*.html      (可选, 备选/留档)
└── change-log.md       (累积修改 changelog, 可选)
```

页面目录由调用方指定 (例: `web-goal-docs/<page>/`). Skill 不规定项目结构.
