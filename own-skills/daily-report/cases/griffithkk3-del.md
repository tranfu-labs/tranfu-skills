---
author: griffithkk3-del
case_date: 2026-05-18
scenario_tag: ai-daily-report-image
---

# AI 日报公开图片

## 场景

TranFu 需要把每日 AI 新闻材料生成适合朋友圈、公众号正文和公开社群传播的日报图片。
输入材料包含主编判断、5 条 AI 线索、日期和品牌信息。

## 做法

使用 `scripts/render_daily_report.py` 读取结构化 JSON，默认渲染 `research + iceblue`
版式，输出 `1080x1440` HTML 截图。图片中保留日期、TranFu logo、主线判断、类别标签和 5 条要闻，
去掉点击提示、原始 URL、QR、内部流程说明、Crypto 空板块和低语境项目/公司小标签。

## 结果

生成的默认案例图保存在 `examples/research-iceblue.png`。同一份数据也可通过
`--all-variants` 生成备用深色情报版和其他浅蓝配色，用于发布前视觉选择。
