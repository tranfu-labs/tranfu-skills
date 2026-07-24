# social-media-analytics-app 适配

## 识别条件

只在以下三个条件同时成立时启用：

- `package.json.name` 为 `social-media-analytics-app`
- 存在 `lib/import/parsers.ts`
- 存在 `scripts/import-social-data.ts`

找不到目标项目的 `xlsx` 或 `tsx` 时停止看板文件生成；通用导出仍可完成。

## 批次隔离

只接受 `export_collection.py` 生成且由同目录 `collection-report.json` 哈希证明的 `collection.json`。输出目录必须是：

```text
<dashboard-root>/data/imports/<run-id>/
```

不得写入或导入共享的 `data/imports` 根目录，不得清空历史目录。同一批多平台使用同一个 `run-id`；微博继续位于本批次 `weibo/` 子目录。

## 文件契约

| 平台 | 文件 | 必要结构 |
|---|---|---|
| 微信 | `user_analysis.xls` | HTML 表格；时间、新关注、取消关注、净增、累积关注 |
| 微信 | `tendency_<start>_<end>.xls` | BIFF8；日期、阅读、分享、跳转原文、收藏、发表篇数 |
| 小红书 | `近30日观看数据.xlsx` | 账号总体观看数据、曝光趋势、观看趋势三张表 |
| 知乎 | `日报表.xls` | UTF-8 CSV 文本；日期、阅读、播放、点赞、喜欢、评论、收藏、分享 |
| 头条 | `数据趋势_<start>-<end>.xlsx` | 展现、阅读/播放、点赞、评论日趋势 |
| 头条 | `粉丝趋势_<start>-<end>.xlsx` | 总粉丝、新增、流失日趋势 |
| 微博 | `weibo/微博数据_<start>-<end>.xlsx` | 汇总、每日趋势、单条博文、说明；不进入导入器 |

当前看板 parser 会把小红书累计内容快照错误地记到最新内容发布日期，并丢失发布时间分钟。因此不要生成根目录 `笔记列表明细表.xlsx`；完整内容保留在通用导出。目标 parser 修复并通过往返测试后再恢复该兼容文件。

## 导入门槛

生成器必须在临时目录完成写入并对本批次根目录文件调用目标项目的 `parseSocialFile()`，逐文件验证：

1. 文件签名、后缀和 parser key 相符。
2. 平台、日期集合、日期唯一性和行数与 manifest 一致。
3. 所有可映射指标逐日与 manifest 一致。
4. 微博只存在于本批次 `weibo/` 子目录。

全部通过后才提交到批次目录并报告结果。失败时不得留下半批文件或覆盖旧批次。

等待用户明确确认后，只导入本批次：

```bash
pnpm import:social-data -- --dir data/imports/<run-id> --trigger browser_collect
```

导入后查询 `import_run`、`import_file` 和指标表，确认状态、行数、日期范围与汇总。不要提交 `data/app.db`、导入文件或备份。
