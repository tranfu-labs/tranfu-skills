<!--
Copyright © 2026 姚金刚. All rights reserved.
Project: yao-geo-panorama-audit
Created by: 姚金刚
Date: 2026-05-16
X: https://x.com/yaojingang
-->

# 参考扫描与升级记录

## 扫描焦点

本次升级目标是让 `yao-geo-panorama-audit` 的分析和报告输出更系统、详细、完整，同时保持不采集第三方问答平台表现数据的新版边界。

## 外部参考

| 参考 | 可借鉴模式 | 已落地设计 |
|---|---|---|
| GEO: Generative Engine Optimization | 面向生成式答案的可见性和内容证据优化需要系统口径，不应只用传统 SEO 指标替代。 | 保留 GEO 特征评分，但把前置动作改成官网事实源和外部证据建设。 |
| Evaluating Verifiability in Generative Search Engines | 生成式答案可能有未支持断言和错配引用，因此诊断必须做断言级核验。 | 增加“官网抓取与事实交叉验证”“来源冲突与待确认项”。 |
| Google Helpful, Reliable, People-First Content | 内容要完整、有原创分析、清楚来源、专业可信、满足用户目标。 | 增加“系统、详细、完整”要求和内容深度检查。 |
| Google Structured Data Guidelines | 结构化数据必须与页面可见内容一致，准确、相关、最新，不得误导。 | Schema 建议必须和页面可见内容绑定，不能凭空加标记。 |
| Schema.org Organization/Product/FAQPage | 标准实体、产品和问答类型有助于实体消歧和结构表达。 | 增加实体、产品服务、FAQ、Breadcrumb、案例和组织字段建议。 |
| W3C Consistent Navigation / MDN position sticky | 长页面需要稳定导航；sticky 菜单可以在滚动时保持可见，但不能遮挡正文。 | HTML 报告增加固定跟随菜单，并纳入自检。 |

## 不借鉴内容

- 不把 SEO 或结构化数据直接承诺为 AI 引用概率。
- 不恢复第三方问答平台采样作为前置或辅证逻辑。
- 不把外部参考长段复制进报告；只转化为评分维度、检查项和证据表。
- 不把 HTML 菜单做成复杂前端应用；保持独立 HTML、白底、可打印、可复制。

## 升级结论

报告结构升级为“方法依据 -> 官网抓取 -> 实体/产品/内容/技术/外部证据 -> 评分 -> 站内/站外方案 -> 风险与验收”的闭环。示例生成器同步增加固定菜单、完整性表和自检项。

## 参考链接

- https://arxiv.org/abs/2311.09735
- https://arxiv.org/abs/2304.09848
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- https://schema.org/Organization
- https://schema.org/Product
- https://schema.org/FAQPage
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position
- https://www.w3.org/WAI/WCAG20/versions/understanding/wcag20-understanding-20081211-a4.pdf
