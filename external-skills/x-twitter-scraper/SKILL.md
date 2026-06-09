---
name: x-twitter-scraper
description: 给 AI coding agent 接入 Xquik 的 X/Twitter 数据与确认式操作能力: tweet 搜索, 用户查询, follower/media extraction, monitoring, webhooks, MCP, SDKs, posting, reply, like, DM. 需要 Xquik API key; 不收集 X 登录材料.
version: 2.4.16
author: Xquik
updated_at: 2026-06-09
origin: external
source_url: https://github.com/Xquik-dev/x-twitter-scraper/tree/master/skills/x-twitter-scraper
---

# x-twitter-scraper (external thin pointer)

这是一个 external 薄指针. 仓库里只存 frontmatter 和推荐者补充内容, 完整 skill 内容以上游 `source_url` 为准.

- 上游: https://github.com/Xquik-dev/x-twitter-scraper
- Primary skill path: `skills/x-twitter-scraper/`
- 文档: https://docs.xquik.com
- npm metadata: `x-developer@2.4.16`
- License: MIT

## 装法

推荐用 skills CLI 安装上游 installable skill:

```bash
npx skills@1.5.3 add Xquik-dev/x-twitter-scraper
```

手动安装时, 只复制上游仓库里的 `skills/x-twitter-scraper/` 目录, 不复制仓库根目录.

## 推荐场景

适用:
- 让 coding agent 查 X/Twitter tweets, users, followers, media, trends, bookmarks, notifications, DMs, and articles.
- 需要批量 extraction, monitoring, signed webhooks, 或 MCP server 接入.
- 需要确认式 posting, reply, like, repost, follow, DM, media upload, profile update, 或 delete workflows.
- 团队希望 agent 用 API key 调 Xquik, 而不是在对话里收集 X passwords, 2FA codes, cookies, 或 session tokens.

不适用:
- 用户只想做静态内容分析, 不需要实时 X/Twitter 数据或账号动作.
- 用户没有 Xquik API key.
- 需要无确认的账号写入或自动 plan/credit change.

## 同类 Skill 对比

### 公司库内

- 暂无 X/Twitter 数据平台或 MCP 接入类 skill.

### 外部世界

- 通用 web scraping skill: 适合抓公开网页, 但通常没有 X/Twitter 专用 endpoint, extraction job, webhook, MCP, and write-confirmation boundary.
- 通用 social listening prompt: 适合分析策略, 但不提供可验证 API contract, pagination, HMAC webhook verification, or agent safety rules.

### 本 skill 独特价值

- 100+ REST API endpoints, 2 MCP tools, and 23 extraction workflows.
- Skill 内置 credential boundary: 只用 Xquik API key, 不请求 X login material.
- 写入和持久化动作要求确认, 适合把 X/Twitter 数据能力接入 agent workflow.
