---
description: "通过 Chrome CDP 抓取公开网页，将渲染后的正文保存为 Markdown 或结构化 JSON。支持通用页面、匿名可访问的 X 帖子与线程、YouTube 字幕、Hacker News 讨论和媒体下载。"
---

# URL to Markdown

通过 Chrome CDP 抓取公开网页，将渲染后的正文保存为 Markdown 或结构化 JSON。支持通用页面、匿名可访问的 X 帖子与线程、YouTube 字幕、Hacker News 讨论和媒体下载。

## 什么时候用它

- 归档无需登录的公开网页。
- 保存匿名可访问的 X 内容。
- 提取 YouTube 字幕或 HN 讨论。
- 连同图片、视频保存为本地文件。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。帮助阅读者横向决定要安装哪个 Skill。

### 公司库内

- 暂无。

### 外部世界

- [baoyu-url-to-markdown](https://github.com/JimLiu/baoyu-skills/tree/6b7a2e417500561a5ecdd0b168332f4142584617/skills/baoyu-url-to-markdown) — 上游合集中的网页抓取 Skill；**本 Skill 区别**：独立维护，只支持无登录、非交互抓取。

### 本 skill 独特价值

- 匿名适配 X、YouTube 与 HN。
- 登录墙和验证码立即失败。
- Markdown、JSON 和媒体路径稳定。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。横向定位见上方同类对比。

### 材料方案

- 优先提供页面的公开 URL。
- 准备 Bun 与 Chrome 或 Chromium。
- 复用浏览器时提供 CDP 地址。

### 推荐用法

- 文件输出搭配 `--quiet`。
- 下载媒体时同时指定输出文件。
- 首次运行先设置保存偏好。

### 已知限制

- 不支持登录、验证码和人工操作。
- CDP 或 Profile 可能带已有 Cookie。
- 动态站点受公开页面结构影响。

## 使用方式

```text
请使用 $url-to-markdown，把 https://example.com/article 保存为 Markdown。
```

默认输出结构：

```text
./url-to-markdown/{domain}/{slug}/{slug}.md
```

启用媒体下载后，图片和视频分别保存在同一页面目录下的 `imgs/` 与 `videos/`。

## 支持范围

| 项目 | 支持情况 |
|---|---|
| 通用公开网页 | 支持 |
| 匿名 X 帖子与线程 | 支持 |
| YouTube 字幕 | 支持 |
| Hacker News 讨论 | 支持 |
| Markdown / JSON | 支持 |
| 媒体下载 | 支持 |
| 登录或人工验证 | 不支持，立即失败 |

## 运行要求

- Bun
- Chrome 或 Chromium
- 首次运行可联网安装 `scripts/package.json` 中的依赖

CLI 位于 `scripts/url-to-markdown`。用户可提供 `--cdp-url`、`--chrome-profile-dir` 或 `URL_TO_MARKDOWN_CHROME_PROFILE_DIR` 复用浏览器，但 Skill 不管理登录状态。

## 来源与许可证

本 Skill 从 Jim Liu 的 `baoyu-url-to-markdown` 固定提交独立抽离并重命名，后续独立维护。MIT 许可证及原作者版权声明保留在 [LICENSE](LICENSE) 和 [NOTICE](NOTICE) 中。
