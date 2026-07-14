# wechat-sketch-cover

根据准确标题和可选文章内容，生成一张固定暖色手绘笔记风的微信公众号封面，最终输出严格为 1923 × 818 的 PNG。

## 什么时候用它

- 需要一张左标题、右插画的公众号文章封面。
- 标题必须按原文呈现，正文或摘要只用于设计视觉隐喻。
- 不用于其他平台、尺寸、风格、正文配图、修图或代发公众号。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。

### 公司库内

- [article-cover-image](../article-cover-image/SKILL.md) — 通用 16:9 多风格封面；**本 Skill 区别**：固定公众号尺寸、暖色手绘风和准确标题。
- [post-illustration-images](../post-illustration-images/SKILL.md) — 生成多平台成套配图；**本 Skill 区别**：只交付单张固定规格公众号封面。

### 外部世界

- [baoyu-cover-image](https://github.com/JimLiu/baoyu-skills/tree/6b7a2e417500561a5ecdd0b168332f4142584617/skills/baoyu-cover-image) — 提供多种风格和比例；**本 Skill 区别**：只保留暖色手绘风与 1923 × 818 输出。

### 本 skill 独特价值

- 单一风格和尺寸，输出稳定。
- 标题按原文保留，最长 35 字。
- 保留 Prompt、候选图和最终图。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。
> 帮助阅读者纵向上手；横向同类对比见上方 §同类 Skill 对比。

### 材料方案

- 优先提供准确标题和完整正文。
- 只有标题时也可直接生成。
- Markdown 可从 frontmatter 或 H1 取标题。

### 推荐用法

- 先确认标题不超过 35 个非空白字符。
- 用正文帮助右侧插画贴合内容。
- 生成后查看标题准确性和留白。

### 已知限制

- 只支持微信公众号文章封面。
- 最终尺寸固定为 1923 × 818。
- 图片归一化需要 Pillow 11.3.0。

## 使用方式

```text
请使用 $wechat-sketch-cover，给文章《为什么 AI 工作流总是难以复用？》制作公众号封面。
文章主要讨论输入、过程记录和复盘之间的断层。
```

也可以提供一个包含 frontmatter `title` 或一级标题的 Markdown 文件。

## 固定合同

- 构图：左侧准确标题，右侧内容隐喻插画。
- 风格：米色纸张、深棕手绘线条、橙色与金色强调。
- 标题字体：中文手写标题字体，粗笔刷、手写毛笔风，marker / brush handwritten Chinese。
- 文字：只允许文章标题，不生成副标题、标签、Logo 或水印。
- 标题长度：2–35 个非空白 Unicode 字符，含标点。
- 尝试次数：最多三次；只有局部标题字形偏差可标记为 BEST_EFFORT。

## 运行时与输出

归一化脚本需要 Python 3 和 Pillow 11.3.0：

```bash
python3 -m pip install Pillow==11.3.0
```

输出位于当前工作目录的 `wechat-sketch-cover-output/<title-slug>/`，包含 `source.md`、每次 Prompt、候选图片和最终 `cover.png`。

## 来源与许可

本 Skill 从 JimLiu/baoyu-skills 的 `baoyu-cover-image` 中抽取并重写暖色手绘封面流程，来源提交为 `6b7a2e417500561a5ecdd0b168332f4142584617`。项目按 MIT License 发布；上游归属和修改说明见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
