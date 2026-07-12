# webapp-polish-audit 管线总览

只读审查浏览器渲染的 Web UI。核心设计：**主 Agent 只调度，永不亲自看图判断**——判断者每次只面对一张截图和一小份筛选后的维度文档，看图的注意力不被整套协议稀释。执行细则全部在 `SKILL.md` 与 `references/`，本文件只给地图。

## 路线图（线框）

```text
主 Agent（只调度）                SubAgent（执行）                      runDir = /tmp/webapp-polish-audit/{时间戳}-{run}/
─────────────────                ────────────────                     ─────────────────────────────────────
意图闸门 single / multi
    │
阶段 1 验收 ◄──────────────────  发现者（仅多页）
    │                            渲染链接 → 页面树
    │
阶段 2 验收 ◄──────────────────  维度选择者（单页同样要走）
    │                            页面盘点 → 每页一份 md 数组
    │
阶段 3 验收（ls 抽查）◄────────  探索者 · 每页一个  ────────────────►  截图 *.png / 盘点 *.json
    │                            00 探寻 + 截图落盘 → manifest                │
    │                                                                        │
阶段 4 派发（TODO：一图一条）──►  判断者 · 每图一个  ◄─────────────────────────┘
    │                            新鲜眼遍 → 规则遍 → YAML
    │
聚合：去重 · class 合并 · 目录外发现保留 · Browser 最终锚定
    │
审查报告（含 gaps）
```

## 各阶段速查

| 阶段 | 执行者 | 输入 | 输出 | 任务文档 |
| --- | --- | --- | --- | --- |
| 1 发现 | 发现者 SubAgent（仅多页） | seed URL | 纯文本页面树 | `references/pipeline/14-child-page-tree-discovery.md` |
| 2 选维度 | 选择者 SubAgent（单页/多页都走） | 页面树分支（单页 = 单页分支） | 页面 → `md` 数组 YAML | `references/pipeline/15-page-audit-dispatch-and-reference-selection.md` |
| 3 探索 | 探索者 SubAgent · 每页一个 | 页面 + `md` 数组 + `runDir` | 落盘截图/盘点 + manifest YAML | `references/pipeline/16-page-exploration-and-capture.md`（探寻机制在 `references/page-flow/00-inspection-procedure.md`） |
| 4 判断 | 判断者 SubAgent · 每张截图一个 | 截图文件路径 + 筛选后 `md` | 截图级判断 YAML | `references/pipeline/17-screenshot-judgement-dispatch.md` |
| 聚合 | 主 Agent | 全部判断 YAML | 页面级 `class_coverage` + 报告 | 聚合规则在 `17` |

## 不变量（违反任何一条都视为偏航）

- **判断永不留在主会话**。单页任务也走完整管线，只是跳过阶段 1；无 SubAgent 机制时的 `local sequential fallback` 也必须先探索落盘、后逐张判断、一次只判一张。
- **一图一 TODO 一判断者**。阶段 4 派发前建 TODO 清单，manifest 每张截图一条（对比组每组一条），绝不合批；TODO 即派发对账。
- **新鲜眼兜底无条件**。判断者先看图后读规则；筛选后 `md` 为空的截图也必须派发，判断者只做新鲜眼遍。目录罩不住的发现进 `uncatalogued`，绝不丢弃。
- **多图比对走对比组**。`02` 主题对、`11` 视口对、`04` 状态前后对，单图判不了的不硬判。
- **只读**。任何阶段都不读项目源码、不改项目文件、不提交表单；唯一产物例外是 `/tmp/webapp-polish-audit/` 下带时间戳的运行目录（`{YYYYMMDD-HHMMSS}-{run-name}/`，每次运行唯一）。
- **缺口诚实**。没截到、没翻到、被副作用挡住的，进 `gaps`，绝不静默当全清。
