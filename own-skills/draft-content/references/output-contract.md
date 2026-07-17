# 输出契约

把每次运行写入独立目录：

```text
WORKDIR/03-内容创作/<YYYYMMDD-HHmmss-slug>/
├── manifest.json
├── 00-input/
│   ├── topic-plan.md                 # 标准模式
│   ├── research/                     # 标准模式，所选研究包快照
│   ├── materials/                    # 等价模式或补充材料快照
│   ├── supplied-outline.md           # 可选
│   └── style-b.md
├── 01-outline/
│   └── shared-outline.v001.md
├── 02-masters/
│   ├── A-master.md
│   └── B-master.md
├── 03-platforms/
│   ├── wechat/A-wechat.md + B-wechat.md
│   ├── xiaohongshu/A-xiaohongshu.md + B-xiaohongshu.md
│   ├── zhihu/A-zhihu.md + B-zhihu.md
│   ├── weibo/A-weibo.md + B-weibo.md
│   └── toutiao/A-toutiao.md + B-toutiao.md
└── 04-qa/
    └── report.json
```

大纲升级时保留旧版本并创建 `shared-outline.v002.md` 等新文件。固定母稿和平台稿路径始终代表当前待验证版本；大纲变化后先由状态工具标记旧产物失效，再重新生成，不得把旧文件误报为有效。

## Manifest

使用 `schema_version: 1`、`skill: draft-content`，并记录 `run_id`、`status`、`input_mode`、`topic`、`audience`、`execution`、`inputs`、`outline_gate`、`artifacts` 和 `events`。

持久状态只允许：

- `AWAITING_OUTLINE_APPROVAL`：大纲已生成但尚未批准，或修订版等待批准。
- `DRAFTING`：当前大纲已批准，母稿或平台稿尚未全部通过验证。
- `READY_FOR_PROOFREAD`：全部完成条件通过。
- `BLOCKED`：必需快照损坏、B 风格缺失、批准哈希漂移或其他无法继续的 run 内问题。

`NEEDS_INPUT_SELECTION` 和 `NEEDS_UPSTREAM` 是初始化返回码，不写入 manifest，也不创建 run。

让 `verify-run.mjs` 根据固定文件路径计算并更新 `artifacts` 的确定性绑定。不要让创作 Agent 手改 manifest 的 artifact 哈希。母稿记录必须绑定批准大纲哈希；A 的风格哈希为 `null`，B 的风格哈希等于输入快照。每份平台稿必须绑定相同大纲哈希、预期分支母稿路径与哈希，以及对应风格哈希。

这些字段证明验证时文件与预期路径、当前字节和分支规则一致，不证明隐藏模型实际读取或未读取某文件，也不证明内容的因果来源。没有执行器级访问日志时，A/B 隔离和 direct-from-master 依靠白名单 worker 输入与独立上下文执行，并在最终结果中披露残余风险。

## 文稿要求

- 恰好生成两份非空平台中立母稿和十份非空平台 Markdown；不得增加第三分支、重复文件或替代平台。
- 每份母稿和平台稿包含且仅包含一个非空 H1 工作标题。标题须兑现正文承诺；不得附标题池。
- 所有平台稿使用唯一固定文件名，确保 A/B 公众号稿可分别交给下游而不发生输出覆盖。
- 不得保留 `TODO`、`TBD`、`待补`、`待确认` 或空模板段。
- 不得包含图片占位符、配图方案、HTML、发布步骤、审校报告或“已发布/已审校”声明。

## READY_FOR_PROOFREAD

仅在以下条件全部满足后设为 `READY_FOR_PROOFREAD`：

1. 大纲 gate 为 `approved`，文件当前 SHA-256 与批准值一致。
2. 两份母稿和十份平台稿数量、路径、非空、H1 和占位符检查全部通过。
3. A/B 的批准大纲哈希相同；A 风格为 `null`；B 风格绑定本次 `00-input/style-b.md`。
4. 十份平台稿各自绑定正确分支母稿及其当前 SHA-256。
5. `04-qa/report.json` 由验证脚本写入 `PASS`，不存在未解决错误。

终点只表示可逐文件交给 `proofread-content`。不得在本 Skill 内执行三轮审校、去 AI、标题优化、配图、排版、选稿、发布或发布后运营。
