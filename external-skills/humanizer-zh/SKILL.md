---
name: humanizer-zh
description: 中文文本 AI 写作痕迹清理与人性化改写 skill。Trigger when 用户要润色、审阅或改写中文 AI 生成文本，让文字更自然、更像真人写作，尤其是去除夸大意义、宣传腔、模糊归因、三段式、AI 词汇、破折号滥用、谄媚语气和通用积极结尾。Do NOT trigger when 用户只要事实核查、翻译、SEO 改写、学术查重规避、伪造真人身份或绕过检测器。
version: 1.0.0
author: op7418
updated_at: 2026-07-06
origin: external
source_url: https://github.com/op7418/Humanizer-zh
---

# humanizer-zh (external thin pointer)

这是一个 **external 薄指针** —— 公司库只存 frontmatter 和推荐者补充内容，不复制上游完整 skill body。

首次 `tfs install humanizer-zh` 时，install 流程会从 `source_url` 拉取上游 skill 到本地。上游包含中文版 `SKILL.md`、`README.md` 和 `LICENSE`。

- 上游 skill: https://github.com/op7418/Humanizer-zh
- 作者: op7418
- License: MIT
- 来源说明: 上游 README 声明核心文件翻译自 `blader/humanizer`，实用工具部分参考 `hardikpandya/stop-slop`，并基于 Wikipedia `Signs of AI writing` 指南。

完整内容见 `source_url`。更新内容请直接看上游 README / SKILL.md，别在本仓库改 body。

## 推荐场景

适用:
- 把中文 AI 初稿改得更自然，去掉模板感、宣传腔和空泛结论
- 审阅文章、营销文案、博客、摘要或社媒内容中的 AI 写作痕迹
- 学习识别常见 AI 写作模式，例如夸大意义、模糊归因、三段式列举、过度连接词和谄媚语气

不适用:
- 要求伪造真人身份、绕过检测器或规避平台规则
- 需要事实核查、引用补充、调研或证据审查
- 只做翻译、SEO 关键词改写或正式公文格式化
