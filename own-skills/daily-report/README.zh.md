---
description: "把整理好的 AI 新闻做成 TranFu 品牌日报图片，可直接用于朋友圈、公众号和社群分享。"
prompt_examples:
  - scene: 生成单份日报
    prompt: 把 report.json 渲染成 TranFu 日报图，默认走 research + iceblue 样式
  - scene: 对比全部样式
    prompt: 用 --all-variants 把所有风格和配色跑一遍，方便挑选
  - scene: 制作暗色看板
    prompt: 换成 dark + steelblue 样式，做出情报仪表盘的感觉
---

# AI 日报图生成

把结构化的 AI 新闻素材渲染成 TranFu 品牌日报图片，默认输出 `1080x1440` 的 HTML 截图，适合朋友圈、公众号正文和公开社群传播。

## 用途

- 把整理好的 AI 新闻 JSON 转成可直接发布的日报图
- 为 TranFu 情报社群做每日固定栏目的信息卡
- 一次生成多种样式和配色，便于挑选适合当天氛围的版本
- 复用统一版式，避免手工设计带来的字体、间距和色板漂移

不适用的场景：纯文本日报、文章改写、通用图片生成、非 AI 主题海报，以及需要个性化插画的封面设计。

## 安装

本 skill 位于公司仓库的 `own-skills/daily-report/`。日常安装、搜索和升级都通过公司 `tfs` 工作流完成，不需要手工复制目录。用自然语言描述目的即可，例如“搜公司 skill 关于日报图片”或“装 daily-report 到 user 级”。

运行前的环境要求：Python 3.10 及以上，且本地需要 Google Chrome 或 Chromium 才能自动完成 PNG 截图；如果只装了 Python，脚本仍会输出 HTML 和 manifest，只是跳过 PNG 一步。

## 使用

日常流程分三步：先把新闻素材整理成一份符合 `references/report-schema.md` 的 JSON，`importance` 字段控制在手机屏一眼可读的长度；再调用 `scripts/render_daily_report.py`，用 `--input` 指定 JSON、`--out-dir` 指定当天的输出目录；最后按“发布规则”一节检查产物。

默认组合是 `research + iceblue`，白底浅蓝调，适合公开阅读。想要更强的情报感就切 `dark`；想要科技媒体信息卡风格就用 `verge + iceblue`。犹豫时加 `--all-variants` 一次跑齐全部样式和配色，再挑一版发布。

## 产物

每次运行会写入渲染 HTML、`tranfu-daily-<style>-<palette>-1080x1440.png` 截图，以及记录参数和文件路径的 `manifest.json`。`verge` 样式的最新示例位于 `examples/verge-iceblue/`，尺寸是 `1080x1350`；`research` 和 `dark` 的示例分别在 `examples/research-*.png` 和 `examples/dark-*.png` 可直接预览效果。

## 发布规则

图片被视作静态公开物，不是网页。默认不显示 QR、原文 URL、内部流程、追溯信息、提示词、文件路径和渲染说明；也不放低语境的项目或公司小标签，改用“低代码工具”“企业身份与权限管理”等公共可读的描述。除非用户明确要求并给出可核实素材，否则不展示 Crypto 内容。QR 只有在目标平台允许时才手动开启。
