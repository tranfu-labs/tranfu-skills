---
name: write-social-preview-head
display_name: Social Preview Head Writer
display_name_zh: 社交分享 Head 编写
description: 编写网页 head 以便 Lark/飞书、Slack、微信等 IM/social 分享场景稳定显示标题、描述、icon 和卡片图。用于新建或修改官网/落地页/分享页的 OG/Twitter/meta/link/icon/manifest/JSON-LD 头部标签，尤其是需要兼容 Lark 图像优先级、避免 query 参数缓存失效、或要求社交预览资源可被爬虫稳定抓取时。
version: 0.1.0
author: aquarius-wing
updated_at: 2026-07-10
origin: own
---

# 编写社交分享 Head

## 核心规则

社交分享场景优先保证爬虫能在初始 HTML 的 `<head>` 里直接读到完整预览信息，不依赖客户端 JS 注入，不依赖浏览器容错，也不要把 favicon 当作唯一 icon 来源。

对 Lark/飞书这类 IM 预览，图像优先级按 `og:image` > `twitter:image` > body 首张大于 `100x100` 的图片 > 空处理。因此页面 head 必须把 OG/Twitter 主图写完整，并提供 icon/touch icon/manifest 的一致资源链路。

## Head 编写清单

每个需要被分享的 HTML 页面都要显式写这些标签：

```html
<title>Page Title</title>
<meta name="description" content="Short page description" />
<link rel="canonical" href="https://example.com/page/" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Site Name" />
<meta property="og:locale" content="zh_CN" />
<meta property="og:url" content="https://example.com/page/" />
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Short page description" />
<meta property="og:image" content="https://example.com/og-image-1200x630-YYYYMMDD.png" />
<meta property="og:image:secure_url" content="https://example.com/og-image-1200x630-YYYYMMDD.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Readable image alt text" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Short page description" />
<meta name="twitter:image" content="https://example.com/og-image-1200x630-YYYYMMDD.png" />

<link rel="image_src" href="https://example.com/og-image-1200x630-YYYYMMDD.png" />
<link rel="shortcut icon" href="https://example.com/favicon-YYYYMMDD.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="https://example.com/favicon-32x32-YYYYMMDD.png" />
<link rel="apple-touch-icon" sizes="180x180" href="https://example.com/apple-touch-icon-YYYYMMDD.png" />
<link rel="apple-touch-icon-precomposed" sizes="180x180" href="https://example.com/apple-touch-icon-YYYYMMDD.png" />
<link rel="manifest" href="https://example.com/manifest.json" />
```

如页面用于 Lark/飞书兼容验证或希望给旧链路兜底，在 body 中放一张首个可见的大图：

```html
<img src="https://example.com/og-image-1200x630-YYYYMMDD.png" width="1200" height="630" alt="Readable image alt text" />
```

## 资源命名

预览主图、touch icon、favicon 和 manifest icon 一律使用绝对 HTTPS URL。

刷新 IM/social 平台缓存时，优先换全新实体文件名：

- `og-image-1200x630-YYYYMMDD.png`
- `apple-touch-icon-YYYYMMDD.png`
- `favicon-YYYYMMDD.ico`
- `favicon-32x32-YYYYMMDD.png`

不要把 `?v=YYYYMMDD` 当作刷新手段。部分平台可能按页面 URL、canonical、原始资源 URL 或资源 URL 做缓存/负缓存，query 参数不稳定。

换名时必须成组同步：

- `og:image`、`og:image:secure_url`、`twitter:image`、`image_src`
- `shortcut icon`、`icon`、`apple-touch-icon`、`apple-touch-icon-precomposed`
- JSON-LD Organization `logo`
- `manifest.json` / `site.webmanifest` 里的 icons
- 服务器/CDN 对新 `.ico`、`.png`、`.webmanifest` 文件的 `Content-Type`

## 资源格式

- `og:image` 默认用 PNG，建议 `1200x630`，8-bit/channel，`image/png`。
- `apple-touch-icon` 用 `180x180` PNG，8-bit/channel，`image/png`。
- PNG favicon 用 `16x16`、`32x32` PNG，`image/png`。
- 根 `favicon.ico` 用单图 `32x32, 32 bits/pixel` ICO，线上返回 `image/x-icon`。
- manifest 优先返回 `application/manifest+json; charset=utf-8`；JSON fallback 可返回 `application/json`。
- HTML 页面返回 `text/html; charset=utf-8` 或 `text/html`。

不要发布 16-bit PNG，也不要依赖 `application/octet-stream`、`text/plain` 或浏览器 MIME sniffing。

## 最小探针页

当要验证一个平台是否能识别 icon/卡片图，创建一个隔离的最小社交预览探针页。探针页是验证手段，不是固定路由要求。

探针页应当：

- 不走全站 layout 或复杂 head。
- 只包含 title、description、canonical、OG/Twitter、icon links、manifest 和 body 首张大图。
- 使用全新实体文件名的主图和 icon。
- 不进 sitemap 也可以。

探针页成功但首页失败时，优先回到首页检查复杂 head、canonical、旧资源 URL 缓存和资源换名是否成组同步。探针页也失败时，再查服务器 access log 和资源响应头。

## 验收

检查线上响应头：

```bash
curl -L -I https://example.com/
curl -L -I https://example.com/og-image-1200x630-YYYYMMDD.png
curl -L -I https://example.com/apple-touch-icon-YYYYMMDD.png
curl -L -I https://example.com/favicon-YYYYMMDD.ico
curl -L -I https://example.com/manifest.json
```

检查图片编码：

```bash
file public/og-image-1200x630-YYYYMMDD.png public/apple-touch-icon-YYYYMMDD.png public/favicon-YYYYMMDD.ico
identify -format '%f %m %wx%h depth=%z colorspace=%r\n' public/og-image-1200x630-YYYYMMDD.png public/apple-touch-icon-YYYYMMDD.png
```

最终用真实 IM/social 客户端发送链接验证，至少覆盖目标平台的一次真实分享。

## 不适用范围

- 不做 logo 视觉重设计或整套品牌资产派生。
- 不替代完整 SEO/GEO 建站 checklist。
- 不处理依赖 JS-SDK 的私域分享能力；这里只规定静态 HTML head 和可抓取资源。
