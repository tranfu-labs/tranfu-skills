---
name: skill-icon-generator
display_name: Skill Icon Generator
display_name_zh: Skill 图标生成器
description: >
  为 tranfu-skills 仓库中的新增或现有 Skill 生成统一的 48×48 SVG 与 PNG 图标。
  当用户说“给这个 Skill 生成图标”“根据 name 和 description 选图”“补 assets/icon.svg”
  “预览 Skill 图标”或要求调整自动选中的 Lucide 图标时使用。仅执行本地分析、选图、生成和预览；
  不修改 GitHub Actions、CI、官网同步或部署配置，也不自动提交或推送。
version: 0.1.0
author: chuanye312-coder
updated_at: 2026-07-27
origin: own
---

# Skill Icon Generator

读取目标 Skill 的 `name` 与 `description`，选择 TranFu 颜色族和 Lucide 图形，生成可审核的 SVG/PNG。

## 工作流

1. 定位同时包含 `own-skills/` 与 `scripts/generate-own-skill-icons.mjs` 的 `tranfu-skills` 仓库根目录。
2. 确认目标 `own-skills/<skill-id>/SKILL.md` 存在。
3. 读取 frontmatter 中的 `name` 和 `description`，不得根据目录名以外的未验证信息猜测用途。
4. 运行生成器：

   ```bash
   npm install
   npm run build:icons
   ```

5. 检查目标输出：

   ```text
   own-skills/<skill-id>/assets/icon.svg
   own-skills/<skill-id>/assets/icon.png
   ```

6. 打开或渲染 PNG，向用户展示实际结果，并报告颜色族、Lucide 名称、图标语义和选择来源。
7. 用户不满意时，在 `scripts/generate-own-skill-icons.mjs` 的 `specs` 中为该 Skill 增加人工映射，再重新生成。

## 选择规则

按以下优先级选择：

1. `specs` 中已有的人工映射：保持不变。
2. 根据 `name + description` 的关键词进行语义匹配。
3. 无匹配时使用稳定哈希回退；同一 Skill 每次必须得到相同结果。

四个颜色族：

- `strategy`：`#FFF3E8` 背景、`#EA580C` 描边。
- `content`：`#F1EAFE` 背景、`#6D28D9` 描边。
- `engineering`：`#EAF2FF` 背景、`#2563EB` 描边。
- `operations`：`#EAF8F2` 背景、`#15805D` 描边。

## 输出规范

- 画布固定为 `48×48px`。
- 底板为直角正方形，不透明、无圆角。
- 最终有效描边固定为 `2px`。
- 使用圆角线帽和圆角转折。
- 主体居中，保持约 `24–30px` 的视觉尺寸。
- SVG 不得包含脚本、远程资源、文字、Logo、渐变、阴影或纹理。
- PNG 必须为真实 `48×48px`。

## 边界

- 不修改 `.github/workflows/**`、CI、repository secrets 或部署设置。
- 不修改 `tranfucom` 官网仓库。
- 不自动提交、推送或合并；只有用户明确要求时才执行 Git 操作。
- 不覆盖已有人工精选图标，除非用户明确要求调整该 Skill。
- 生成器影响所有已登记 Skill；交付前只重点审核用户指定目标，并确认无生成错误。

## 验证

至少执行：

```bash
npm test
npm run validate:all
```

并验证目标 SVG 包含：

```text
width="48" height="48" viewBox="0 0 48 48"
scale(1.25)
stroke-width="1.6"
```

其中 `1.25 × 1.6 = 2px`，表示最终有效描边为 2px。
