# Content Production

这是一个开源 Codex Skill 套件。安装一次总控 `content-production`，即可从一句话、明确题目或 Markdown 大纲执行完整中文内容生产工作流。

一次成功运行交付：

- 2 份 A/B 平台中立母稿。
- 微信公众号、小红书、知乎、微博、头条号各 A/B 两版，共 10 份终稿。
- 34 个标题候选和 5 个平台入选标题。
- 5 套平台正文配图、1 张微信公众号封面。
- 图片优化记录、5 个发布包、微信公众号 clean HTML 与预览。
- 最终 QA 和人工发布交接单。

工作流只生成本地交付物，不登录平台、不创建草稿、不发布内容。

## 什么时候用它

- 只有一句创作简述，需要自动跑完整内容生产流程。
- 已有明确题目或 Markdown 大纲，需要生成多平台内容矩阵。
- 需要 A/B 母稿、十份终稿、五套配图和公众号交付包。

不适用于单篇轻量润色、只起标题、只配图、只排版、内容发布或发布后运营。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。帮助阅读者横向决定要安装哪个 Skill。

### 公司库内

- [draft-content](../draft-content/SKILL.md) — 负责大纲、A/B 母稿和十份初稿；**本 Skill 区别**：继续编排审校、标题、视觉和交付包。
- [post-illustration-images](../post-illustration-images/SKILL.md) — 负责多平台正文配图；**本 Skill 区别**：统一绑定正文、标题、封面和排版血缘。
- [format-content](../format-content/SKILL.md) — 负责公众号 HTML 排版；**本 Skill 区别**：从一句话启动并交付完整五平台内容矩阵。

### 外部世界

暂无。

### 本 skill 独特价值

- 单路径内嵌九个专业 provider。
- 固定交付十稿、五套配图与公众号 HTML。
- 全流程哈希血缘与可恢复门禁。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。
> 帮助阅读者纵向上手；横向同类对比见上方 §同类 Skill 对比。

### 材料方案

- 只有想法时直接给一句创作简述。
- 已有结构时提供 Markdown 大纲。

### 推荐用法

- 首次先确认图片后端与网络可用。
- 默认自主模式，无需逐阶段确认。
- 用 `$content-production` 显式触发。

### 已知限制

- 仅支持 AI 与相邻科技主题调研。
- 不登录、不建草稿、不自动发布。
- 图片生成依赖外部后端。

## 运行要求

- Node.js 22 或更高版本、npm、Python 3.11 或更高版本。
- 可用网络，用于调研和首次准备固定版本的 Sharp 运行时。
- 已配置可用的图片生成后端或模型。仓库不包含 API 密钥。

## 安装

通过公司 Skill CLI 安装单路径套件：

```bash
tfs install content-production --scope user
```

安装后重启 Codex 或 Claude Code。

## 使用

可以显式调用：

```text
用 $content-production 围绕“普通人如何判断一个 AI Agent 是否值得使用”跑完整内容生产流程。
```

也可以直接说：

```text
围绕企业为什么需要可审计的 AI 工作流，生成完整的十稿、五套配图、公众号封面和排版 HTML。
```

总控内嵌并调用以下 9 个 provider：`content-topics`、`collect-sources`、`draft-content`、`proofread-content`、`title-options`、`post-illustration-images`、`wechat-sketch-cover`、`compress-image`、`format-content`。

内嵌 provider 随总控安装后可被总控直接使用。若需要把某个子 Skill 作为顶层 `$skill` 单独调用，再从公司库单独安装，例如：

```bash
tfs install title-options --scope user
```

## 许可证与资产

本仓库是混合许可证集合，不存在覆盖全部文件的单一许可证。原创代码、文档以及随仓库分发的 Tranfu 品牌素材和画像文件采用 MIT；`format-content` 保持 AGPL-3.0-or-later，vendored `resvg-wasm` 保持 MPL-2.0。MIT 授予版权许可，不授予 Tranfu 名称、标识的商标权，也不代表 Tranfu 对衍生项目的认可。完整范围和归属详见 `LICENSE.md`、各 Skill 自带的 `LICENSE`/`NOTICE`、`THIRD_PARTY_NOTICES.md` 和 `ASSET_NOTICE.md`。
