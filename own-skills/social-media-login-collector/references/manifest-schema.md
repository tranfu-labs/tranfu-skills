# 标准采集 Manifest

使用 UTF-8 JSON。字段名使用英文，平台原始指标放入 `raw`。禁止未定义的顶层字段和规范字段；新增平台字段先放入 `raw`，不要临时扩展 schema。

## 顶层结构

```json
{
  "schema_version": 1,
  "run": {
    "id": "20260720-182347",
    "platform": "weibo",
    "account_name": "示例账号",
    "account_id": "optional-public-id",
    "captured_at": "2026-07-20T18:40:00+08:00",
    "range": { "start": "2026-06-20", "end": "2026-07-19", "preset": "30d" },
    "status": "success"
  },
  "account_daily": [],
  "contents": [],
  "series_sources": {},
  "summary": {},
  "limitations": []
}
```

顶层字段必须恰好来自示例。`run.platform` 只能是 `wechat`、`xiaohongshu`、`zhihu`、`toutiao`、`weibo`；`status` 只能是 `success`、`partial`、`failed`。`captured_at` 和内容时间必须带 UTC 偏移。`preset: 30d` 必须覆盖 30 个完整自然日。

## 账号日指标

`account_daily` 每个日期只能有一行。规范计数必须是有限、非负的 JSON integer；未知值省略或写 `null`，不得猜测为 `0`。

```json
{
  "date": "2026-07-19",
  "followers_total": 10,
  "followers_new": 1,
  "followers_lost": 0,
  "impressions": 100,
  "views": 20,
  "plays": 0,
  "posts": 1,
  "engagement": 3,
  "reposts": 0,
  "comments": 1,
  "likes": 2,
  "shares": 0,
  "saves": 1,
  "raw": {}
}
```

`followers_lost` 使用流失人数的正数绝对值。平台出现带符号净增时保留在 `raw`，不要写入 `followers_new` 或 `followers_lost`。

### 默认必采指标

| 平台 | `success` 必须逐日存在 |
|---|---|
| 微信 | `followers_total`、`followers_new`、`followers_lost`、`views`、`posts`、`shares`、`saves` |
| 小红书 | `impressions`、`views` |
| 知乎 | `views`、`plays`、`likes`、`comments`、`shares`、`saves` |
| 头条 | `followers_total`、`followers_new`、`followers_lost`、`impressions`、`views`、`likes`、`comments` |
| 微博 | `followers_total`、`views`、`posts`、`engagement`、`reposts`、`comments`、`likes` |

用户明确缩小采集范围时，在 `limitations` 记录并使用 `partial`，不要重新定义默认必采表。

知乎统一口径固定为：`views = 阅读 + 播放`、`plays = 播放`、`likes = 点赞 + 喜欢`；四个原始分量必须保留在 `raw`。

## 内容指标

```json
{
  "content_id": "optional-public-id",
  "title": "标题或正文摘要",
  "publish_time": "2026-07-19T20:00:00+08:00",
  "url": "https://mp.weixin.qq.com/s/example",
  "format": "article",
  "impressions": 100,
  "views": 20,
  "likes": 2,
  "comments": 1,
  "shares": 0,
  "saves": 1,
  "followers_new": 0,
  "raw": {}
}
```

`title` 与带时区的 `publish_time` 必填。公开 URL 可省略；存在时必须使用 HTTPS、不得包含 userinfo 或认证类查询参数。优先按 `content_id` 去重；没有 ID 时按 `title + publish_time + url` 去重。

内容指标是 `captured_at` 时刻的累计快照，不是发布日期的日指标。小红书看板内容导入在当前 parser 修复前保持禁用；通用 JSON、CSV、Excel 仍保存完整内容数据。

## 来源与汇总

`series_sources` 的 key 只能是规范指标名或 `contents`：

```json
{
  "views": {
    "source_url": "https://mp.weixin.qq.com/analytics",
    "method": "canvas_tooltip",
    "confidence": "exact",
    "note": "30 个日期逐点读取；页面总量 1234"
  }
}
```

`source_url` 必须是当前平台官方 HTTPS 后台的 `origin + pathname`，不得包含 query、fragment 或 userinfo。`method` 只能是 `native_export`、`dom_table`、`svg_chart`、`canvas_tooltip`、`derived`。`confidence` 只能是 `exact`、`derived`，并与 `method` 一致。

每个有值的规范日指标必须有同名来源；存在内容数据或已确认空内容列表时必须有 `contents` 来源。`summary` 只能使用账号日指标字段名：流量和互动字段表示日数据合计，`followers_total` 表示范围结束日值。`success` 必须为所有有值指标提供汇总并通过对账。

## 状态规则

- `success`：日期集合与声明范围完全一致，默认必采指标无空洞，来源和汇总齐全，内容末页或空列表已被证明。
- `partial`：保存可验证的已有数据，并逐项说明缺日、缺指标、导出上限、付费限制、页面变化或内容列表不完整。
- `failed`：没有可用数据或无法确认账号/范围；`limitations` 必须说明原因。

微信起始日前一天期初行只在采集内存中用于对账，不写入 `account_daily`。仅靠 SVG 几何或像素位置得到的估算值不进入 manifest 的规范指标。

## 安全限制

禁止任何层级出现密码、Cookie、Token、Authorization、OTP、验证码、手机号、认证文件、密钥、会话标识及其英文、中文、camelCase 或连接符变体。禁止请求头、Bearer 值、完整后台 URL、iframe URL、DOM/HTML、localStorage、sessionStorage 和网络响应体。

导出到 CSV/XLSX 时，所有以 `= + - @` 开头或在前导空白后出现这些字符的文本必须按纯文本编码；JSON 保留原值。
