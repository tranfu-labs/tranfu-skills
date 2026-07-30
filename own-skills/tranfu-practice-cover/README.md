---
description: "为 TranFu 实践页生成左标题、右主体的文章封面，并完成技术名词保护、版本导出和页面验收。"
prompt_examples:
  - prompt: 按 TranFu 风格为这篇文章生成实践页封面，标题是“为什么默认工作流应该写在 AGENTS.md”。
    scene: 从标题和主题生成新封面
  - prompt: 这张多 Agent 封面机器人太多，改成更克制的 Worktree 抽象结构。
    scene: 修改现有封面主体
  - prompt: 检查这组实践页封面是否符合左标题、右主体规范。
    scene: 审核现有封面
---

# TranFu 实践页封面

为 TranFu `/practice` 页面生成、修改和验收文章封面。固定采用左侧精确标题、右侧紧凑主体，并保留可回退的版本化资源。

## 什么时候用它

- 新增实践文章，需要一张符合现有页面风格的封面。
- 已有封面主体过大、过密或出现机器人阵列，需要调整。
- 技术名词必须准确，例如 `AGENTS.md`、`Git Worktree`。
- 需要从无字底图一路完成标题排版、压缩和页面检查。

不用于实践页 Hero、通用文章封面、图标、Logo、海报、PPT 封面或整页 UI。

## 同类 Skill 对比

> 帮助阅读者判断应该安装哪一个相邻能力。

### 公司库内

- [article-cover-image](../article-cover-image/SKILL.md) — 生成通用文章、视频和 PPT 横版封面；**本 Skill 区别**：固定服务 TranFu 实践页，并包含页面接入验收。
- [tranfu-website-design](../tranfu-website-design/SKILL.md) — 创建和检查 TranFu 网站 UI；**本 Skill 区别**：直接产出封面图片、精确标题和版本化资源。
- [visual-dna-system](../visual-dna-system/SKILL.md) — 从样本提取可复用视觉 DNA；**本 Skill 区别**：使用既定视觉合同直接生成实践页封面。

### 外部世界

- 暂无。

### 本 Skill 独特价值

- 固定左标题、右主体构图。
- 技术名词采用 MiSans 确定性排版。
- 覆盖生成、导出、接入和浏览器验收。

## 使用技巧

### 材料方案

- 准备完整标题和一段主题摘要。
- 参考图只约束尺度，不复制其主题图标。
- 旧封面可作为语义参考，不直接覆盖。

### 推荐用法

- 首次先生成一张，确认主体语言再扩展。
- 明确列出需保护的技术名词。
- 页面接入时同时要求桌面和窄屏检查。

### 已知限制

- 需要图片生成能力。
- 标题合成依赖 `render-cover-title`。
- 仅覆盖 `/practice` 文章封面，不含 Hero。

## 同事可以这样说

```text
使用 $tranfu-practice-cover，为下面这篇文章生成实践页封面：
标题：……
主题摘要：……
需要保护的技术名词：……
```

