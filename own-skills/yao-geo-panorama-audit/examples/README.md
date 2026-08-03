<!--
Copyright © 2026 姚金刚. All rights reserved.
Project: yao-geo-panorama-audit
Created by: 姚金刚
Date: 2026-05-16
X: https://x.com/yaojingang
-->

# 示例说明

本目录存放 `yao-geo-panorama-audit` 的可复核执行示例；示例可以是真实公开品牌测试，也可以是明确标注的合成样例。

当前版本包含两个四格式报告示例：

- `lingxu-synthetic-panorama/`
- `hubspot-cn-panorama/`

后续添加示例时，必须满足：

- 使用真实或明确合成的输入简报。
- 记录官网抓取范围、URL、页面类型、核验日期、可抓取性和核心断言。
- 区分已核验官网事实、交叉验证来源和待确认假设。
- 覆盖 `evals/expected_artifacts.json` 中的核心输出。
- 必须分别输出站内系统方案和站外证据建设方案。
- HTML 示例必须包含固定跟随的章节菜单栏，长报告滚动时能快速定位核心章节。
- 默认输出中文简体，报告字段、表头、状态值和模块名称都使用中文简体。
- 每个示例文件夹必须同时包含 Word（`.docx`）、PDF（`.pdf`）、HTML（`.html` 或完整 HTML 包）和 Markdown（`.md`）。
- 四种格式必须使用同一内容结构和同一组事实来源，不允许同一指标或优先级在不同格式中不一致。
- 版式按 `references/artifact-layout.md` 执行：白底背景、表格边框对齐、列宽稳定、行距正常、无文字重叠、无内容溢出；Word 密集表格必须拆表或显式限制表宽，不能向右溢出。
- 输出后必须先自 review；发现排版、字段英文化、格式缺失或内容不一致时，修复后再交付。
