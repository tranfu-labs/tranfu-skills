---
prompt_examples:
  - prompt: 给这个新落地页加上飞书 / Slack 分享用的完整 head, 别漏标签。
    scene: 为新页面补分享信息
  - prompt: 链接发到飞书没有卡片图, 帮我看下 head 哪里漏了。
    scene: 修复分享卡片没图
  - prompt: 换了新 logo, 平台一直返回旧缓存, 怎么按「换实体文件名」刷一遍?
    scene: 更新分享图缓存
  - prompt: 主页 head 太乱查不出来, 帮我做个最小社交预览探针页孤立验证。
    scene: 用测试页排查
  - prompt: head 写完了, 帮我跑一遍 curl 头 + 图片编码检查, 上线前确认。
    scene: 上线前检查
  - prompt: favicon / apple-touch-icon / manifest icon / JSON-LD logo 想一次成组换新, 列全清单。
    scene: 批量更换图标文件
---

[English](./README.md) | [中文](./README.zh.md)

# 社交分享 Head 编写

给页面加一套完整的社交分享 head, 让飞书、Slack、微信等即时通讯场景稳定显示标题、卡片图和 icon。

## 什么时候用它

**新落地页**:

我在做一个新落地页 / 分享页, 想让飞书、Slack 里发出去的链接从第一天起就能稳定显示标题、描述、卡片图和 icon。

**修复分享卡片没图**:

链接发到飞书 / Slack 之后卡片没图, 或者显示的是旧图 / 旧 icon, 想修 head 让它显示对。

**更新分享图缓存**:

换了新品牌 logo 或 OG 图, 平台一直返回旧缓存, 想按「换实体文件名」的路子刷一遍, 而不是靠 `?v=YYYYMMDD` 蒙混。

**用测试页排查**:

主页 head 太复杂查不出问题, 想做一个最小社交预览探针页孤立验证, 看看平台到底能不能识别到这些标签。

**上线前检查**:

head 写完了, 想跑 curl 头检查 + 图片元数据检查, 上线前确认线上返回的 MIME 类型、分辨率、位深都对得上。

**批量更换图标文件**:

favicon 还挂着旧 logo, 想把 favicon、apple-touch-icon、manifest icon、JSON-LD logo 一次成组换新, 不留旧资源。

**不接**:

- 重新设计 logo / 出整套品牌视觉资产 → 那是设计的活
- 完整 SEO / GEO 建站清单 → 走 SEO / GEO 工作流
- 依赖 JS-SDK 的私域分享 (微信 `wx.share` 之类) → 本 skill 只管静态 HTML head 和可抓取的资源

## 它会产出什么

**head 里所有资源 URL 都用绝对 HTTPS + 带日期后缀的实体文件名, 绝不用 `?v=` 这类 URL 查询参数刷缓存**, 最反常识的一条。

- **head 标签全套**: title / description / canonical + `og:*` 全套 (含 `secure_url` / `width` / `height` / `type` / `alt`) + `twitter:*` + link (`image_src` / `icon` / `apple-touch-icon` / `manifest`)
- **命名与格式规则**: OG 图 `1200x630` PNG 8-bit; apple-touch-icon `180x180` PNG; favicon 16 / 32; 根 `.ico` 单图 32×32 且 32 位/像素; manifest 服务端返回 `application/manifest+json`
- **成组换名清单**: `og:image` / `og:image:secure_url` / `twitter:image` / `image_src` / 全套 icon link / manifest icons / JSON-LD `logo` / CDN 上新文件的 `Content-Type` 一起换, 少一个就有残留
- **探针页方案**: 一个隔离的最小页, 不走全站的整体布局, 只包含 head 六件套 + body 首张大图, 用来孤立平台识别问题
- **验证脚本**: `curl -L -I` 查响应头, `file` / `identify` 查图片编码与位深, 最后要求用真实即时通讯客户端发一次链接端到端跑通
- **绝不会做**: 重新设计 logo / 出品牌视觉资产; 覆盖完整 SEO / GEO 清单; 处理 `wx.share` 这类 JS-SDK 私域分享

## 前置条件与边界

**前置**:

页面必须能直出 HTML head (服务端渲染或静态站), 只靠客户端 JS 注入的爬虫读不到。图片资源要能挂在稳定的绝对 HTTPS URL 下, 且服务端或 CDN 可配 `Content-Type`。目标即时通讯平台能真实收发一次链接做端到端验证。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 重设计 logo / 品牌视觉资产 | 设计 / 品牌工作流 |
| 完整 SEO / GEO 站点审计 | **geo** / **geo-audit** |

**不接的场景**:

- 微信 `wx.share` / 私域 JS-SDK 分享定制
- 实际去改 CDN / 服务器配置 (本 skill 只说该配成什么, 不代替你改)
- 图像本体设计 / 抠图 / 品牌视觉重做

**微妙边界**:

- 「飞书发链接没图」→ 触发 head 检查 + 成组换名排查; 「飞书发不出去 / 权限问题」→ 不触发
- 「favicon 换成新 logo」→ 触发 icon 成组换名; 「品牌 logo 视觉重做」→ 不触发 (那是设计的活)
- 用 `?v=YYYYMMDD` 刷缓存 → 本 skill 明确劝退, 换实体文件名; URL 查询参数在部分平台不稳定
