# 一、显示信息 — UI 审查协议 r2 Layer 查看器

> **目的**: 给「显示框架段」提供**字段优先级表**, 让信息层级决策有据可依.
> **来源**: 本文件反推自 `web-goal-docs/_visual/index.html` 的实际内容 (Layer 2 段 `renderPersonaSection` / `renderQuestionSection` / `renderOperationSection` / 桌面 wireframe / mobile wireframe).
> **北极星**: 看完这份文档, 设计师可以独立做出「显示框架段」(区域划分 + 状态机).

**全程中文**, 不用英文缩写.

## 1. 用户画像

- **skill-eval 维护者 / 调试者** (核心): 熟悉 CLI、`runs/` 目录结构和 `score.json` / `report.md` / `*.stderr.log` 等文件. 跑完一批 case 后, 需要快速扫出可疑 run 并打开内部细节. (来源: HTML §一"谁在用这个工具" > "核心用户")
- **认知边界**: 看到花哨视觉会反弹, 优先要可扫读; 看到照搬物件会判定"没动脑"; 需要桌面 + 移动两张截图才认可. (来源: HTML §一 > "关键习惯 / 认知边界")

## 2. 用户场景

### 主场景 (一到两个, 必须为它们设计)

- **批后扫读**: 刚跑完一批 case, 想看整体 pass / fail 状况、启用 skill 与不启用 skill 的差异、以及最新报告. (来源: scenarios[0])
- **调试单 run**: 某个 run 失败, 要快速打开 `*.stderr.log` / 三段 `*-instruction.md` / `output.md` / `score.json`, 定位失败到具体段或指标. (来源: scenarios[1])

### 次场景 (可选支持)

- **跨时间戳比较 (退化版)**: 想看「上一次 vs 这一次」发生了什么. 当前实现退化为在 Trace 行用上一次 / 下一次翻页, **不展开**趋势大表. (来源: scenarios[2])

### 反场景 (明确不为这些设计 — 用于砍东西)

(来源: HTML §四 > "明确不做 (non-features)" 区)

- 不做单一焦点指标卡片 / 不做主视觉聚焦物
- 不做营销 slogan + CTA 区块 / 不做营销区块
- 不画 11 类产物平铺列表 (改为 Task / Chat / Result 三个 tab 内并入)
- 不做「指标 × 时间戳」趋势大表 / 不做独立趋势视图
- 不做 overlay / drawer / modal
- 不做悬浮工作台 / 玻璃面板 / 固定 grounding rail
- 首屏不放产物 / 首屏不放大型指标卡片
- `skill-snapshot/` 暂不展示 (产物阅读路线边缘)

## 3. 浏览路线

(来源: HTML `cognitiveFlows` 数组, 4 条认知流; 配合 `flows` 数组的交互骨架.)

- **扫读路线 (服务「批后扫读」)** = 进入工具 → 默认看到 batch 摘要和 skill bar 卡片 → 按双模式差值 / 最新时间戳 / 崩溃数排序 → 扫"启用 skill"大数字和两根 bar 的长度差 → 点某 skill 进入明细
- **调试路线 (服务「调试单 run」)** = 从主列表卡片定位 skill → Case 默认落到差异最大的 case → Trace 选「不启用 skill」或「启用 skill」 → 切 Chat 看当时模型对话 / 失败时展开底部「执行日志」 → 切 Result 看最终文档 / 结构化产物 / 判定
- **崩溃排查路线 (服务「批后扫读」+「调试单 run」)** = 点主列表上方崩溃过滤标签 → 主列表只保留崩溃或低通过率 skill → 卡片仍显示双 bar 和差值 → 点击卡片进入同一套明细
- **产物阅读路线 (服务「调试单 run」+「跨时间戳比较」)** = Task tab 看 case-input + 三段 instruction → Chat tab 看 AI 当时执行的原始对话 (system / user / assistant) → Result tab「最终文档」看 output.md / report.md → Result tab「结构化产物」看 extracted.json / score.json → Result tab「判定」看 指标 / refs / gold / facts diff

## 4. 字段清单 + 优先级 ⭐

(本节是「显示框架段」最直接的输入. 字段来自上游已确定的内容; 优先级**从场景+动线推导**, 不是拍.)

| 字段 | 数据源 | 量级 | 优先级 | 服务于哪些场景 |
|---|---|---|---|---|
| 数据源路径 (`/Users/.../runs`) | `runs/` 目录元信息 | 1 行 | 重要 | 「批后扫读」入口验证 |
| runs 总数 | 索引器 (`runs 总数 247`) | 1 数 | 重要 | 「批后扫读」入口扫读 |
| 崩溃总数 | 索引器聚合 (`crash 3`) | 1 数 | 必看 | 「批后扫读」主, 「调试单 run」主 (筛崩溃入口) |
| 最近扫描时间 | 索引时间戳 (`最近扫描 2026-05-21 10:42`) | 1 行 | 辅助 | 「批后扫读」辅助 |
| 崩溃过滤标签 (全部 / 只看崩溃) | 派生自崩溃总数 | 1 控件 | 必看 | 「批后扫读」主, 崩溃排查路线入口 |
| skill 名 + 启用 skill 通过率 (大数字) | `score.json` 聚合 | N 行 | 必看 | 「批后扫读」主, 「调试单 run」主 (定位入口) |
| 不启用 skill / 启用 skill 双 bar | `score.json` 双模式 | N 行 | 必看 | 「批后扫读」主 (差异扫读核心) |
| 双模式差值 `Δ` (含正负号) | 两模式差值 | 1 数 / 行 | 必看 | 「批后扫读」主 (扫读路线排序键) |
| cases 数 + 最新时间戳 (按 skill) | `runs/` 元信息 | 1 行 / 行 | 重要 | 「批后扫读」辅, 「调试单 run」入口验证 |
| 按 skill 崩溃数 (角标) | 聚合 | 1 数 / 行 | 重要 | 崩溃排查路线 |
| 排序选择 (差值绝对值降序 / 最新时间戳 / 崩溃数) | 控件 | 1 控件 | 重要 | 扫读路线排序 |
| skill 头 + `62% → 78%` 双模式总览 | 聚合 | 1 行 | 必看 | 「调试单 run」进入明细第一屏 |
| Case 切换器 (Case 14 / 7 / 21 / 3) | case 列表 + 默认差值最大 | M 个标签 | 必看 | 「调试单 run」主 (调试路线第二步) |
| Trace 模式切换 (不启用 skill / 启用 skill) | 模式二元 | 1 控件 | 必看 | 「调试单 run」主 (调试路线第三步) |
| run.meta 元信息 (`286s · Token 100k · Pass`) | `run.meta.json` | 1 行 | 重要 | 「调试单 run」辅 |
| 时间戳翻页 (`‹` / 当前时间戳 / `›` + 下拉列表) | 同 case+模式历史 runs | 1 控件 + N | 必看 | 「跨时间戳比较」主 (唯一手段) |
| Task / Chat / Result 三 tab | 11 类产物并入 | 3 tab | 必看 | 「调试单 run」主 (调试路线/产物阅读路线入口) |
| `case-input.md` | 产物 | 1 文档 | 必看 | 「调试单 run」主, 产物阅读路线 |
| `run-instruction.md` / `extract-instruction.md` / `judge-instruction.md` | 产物 (Task 二级 sub-tab) | 3 文档 | 重要 | 「调试单 run」主, 产物阅读路线 |
| Chat 三段对话 (system / user / assistant) | `*.stderr.log` 衍生 + run 记录 | M 条消息 | 必看 | 「调试单 run」主, 产物阅读路线 |
| Chat 底部「执行日志」(默认折叠, ✗ 段自动展开) | `run.stderr.log` / `extract.stderr.log` / `judge.stderr.log` | 3 段 | 必看 | 「调试单 run」主 (调试终极入口) |
| `output.md` | 产物 (Result > 最终文档 默认) | 1 文档 | 必看 | 产物阅读路线 |
| `report.md` | 产物 (Result > 最终文档 sub-tab) | 1 文档 | 重要 | 产物阅读路线 |
| `extracted.json` | 产物 (Result > 结构化产物 默认) | 1 文档 | 重要 | 产物阅读路线 |
| `score.json` | 产物 (Result > 结构化产物 sub-tab) | 1 文档 | 重要 | 产物阅读路线 |
| 判定 (指标 × 期望 × ✓/✗ + 失败原因) | 派生自 `score.json` | M 行 | 必看 | 「调试单 run」主 (定位失败指标) |
| `refs_loaded` (expected / actual / missing) | run 元信息 | 1 行 | 重要 | 产物阅读路线判定子区 |
| `gold.json` 入口 + facts diff | gold 文件 | 1 入口 + diff 行 | 重要 | 产物阅读路线判定子区 |
| 分页 / 上一 run / 下一 run | 控件 | 1 控件 | 留档 | 当前虚位 (底部辅助区里只画了占位) |
| 「指标 × 时间戳」趋势大表 / `skill-snapshot/` | — | — | **留档不展示** | (反场景, 信息架构落点表标 "不做") |

**优先级语义**:
- **必看**: 主场景必看, 必须放显著区域 (头部 / 一目了然处)
- **重要**: 主场景需要但可二级位置
- **辅助**: 次场景或辅助, 可折叠 / 隐藏
- **留档**: 不展示 (或仅 hover / click 露出)

## 5. 对比/聚合单元 (列表类页面填)

主列表一条记录 = 一个 **skill** (不是一个 run, 也不是一个 case).

- 是: skill 维度的双模式聚合 (通过率 / 差值 / cases 数 / 最新时间戳 / 崩溃数)
- 不是: 单条 run; 不是单条 case; 不是 (skill, case, 模式, 时间戳) 四元组 (那是明细面板内的层级)

## 锁定 checklist

- [x] 第 1-4 节完整无 TODO
- [x] 每个字段的优先级能追溯到具体场景 (见"服务于"列)
- [x] 反场景列出 (来自 HTML §四 non-features 区)
- [x] 浏览路线覆盖所有主+次场景 (扫读 / 调试 / 崩溃排查覆盖「批后扫读」+「调试单 run」, 产物阅读 + 时间戳翻页覆盖「调试单 run」+「跨时间戳比较」)
- [x] 全文无英文缩写
