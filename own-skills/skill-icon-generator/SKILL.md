---
name: skill-icon-generator
description: >-
  为单个 Codex 或 Claude Skill 生成统一的 48×48 SVG 与 PNG 图标，并更新该
  Skill 的 agents/openai.yaml。用户说“给这个 Skill 生成图标”“补
  assets/icon.svg”“生成同款 Skill 图标”或要求调整自动选择的颜色与 Lucide
  图形时使用。接受一个 Skill 目录或 SKILL.md 路径，可从任意工作目录运行；
  支持在新环境、换机器或升级后运行独立自检。不扫描仓库、不批量改图标，也不修改
  CI、官网或部署配置。Do NOT trigger when
  用户要求批量更新图标、处理非 Skill 图标，或修改 CI、官网与部署配置。
version: 0.3.0
author: chuanye312-coder
updated_at: 2026-07-28
origin: own
allow_exec: true
---

# 单个 Skill 图标生成器

只处理用户指定的一个 Skill。使用本 Skill 自带的脚本、Lucide 母版和运行依赖，不依赖 `tranfu-skills` 仓库结构。

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW（每个步骤一个 TODO，并随执行更新状态）：

1. 规范化用户指定的单个目标路径。
2. 若目标不存在、不是包含 `SKILL.md` 的目录、也不是 `SKILL.md` 文件，则报告原因并结束。
3. 完整读取目标 `SKILL.md`。若 YAML frontmatter 不可解析，或 `name`、`description` 缺失或为空，则报告目标不是有效 Skill 并结束；不得进入自动选择或写文件步骤。
4. 将本文件所在目录记为 `<generator-skill-dir>`，目标 Skill 目录记为 `<target-skill-dir>`。
5. 检查目标现有图标：
   - 若 `assets/icon.svg` 或 `assets/icon.png` 已存在，且用户未明确要求替换，则报告已有资产并结束。
   - 若用户明确要求替换，则为后续生成命令设置 `--force`。
   - 若两个图标都不存在，则不设置 `--force`。
6. 首次使用或依赖缺失时，只在生成器 Skill 内安装依赖：

   ```bash
   npm install --prefix "<generator-skill-dir>" --no-package-lock
   ```

   若命令退出码非 0，则展示错误并结束，不宣告生成完成。

7. 在新环境、换机器、升级后，或用户要求自检时运行：

   ```bash
   node "<generator-skill-dir>/scripts/self_check.mjs"
   ```

   若未输出 `SELF_CHECK_PASS` 或退出码非 0，则展示失败检查项并结束。

8. 根据用户要求构造并运行单目标生成器；只有步骤 5 已确认用户明确要求替换时才追加 `--force`：

   ```bash
   node "<generator-skill-dir>/scripts/generate_icon.mjs" "<target-skill-dir>"
   ```

9. 若生成命令退出码非 0，则展示错误，报告是否存在部分产物并结束；不得自行追加 `--force` 重试，也不得宣告生成完成。
10. 检查并展示实际 PNG，验证 SVG、PNG 和 `agents/openai.yaml`。
11. 产出 `ICON_GENERATION_REPORT`，报告目标 Skill、颜色族、Lucide 名称、视觉隐喻、选择来源和输出路径，然后结束。

## 环境自检

自检只在系统临时目录创建隔离样本，不修改用户 Skill。它检查：

- Node.js 版本、Skill 本地 Sharp 依赖和运行文件。
- 60 个 Lucide 母版与公司人工映射的完整性。
- 旧 Skill 人工映射、新 Skill 关键词匹配、未知场景稳定回退和人工覆盖。
- 目录路径与 `SKILL.md` 文件路径两种输入。
- SVG/PNG 尺寸与样式、`openai.yaml` 字段保留、覆盖保护和 `--force`。
- 缺失目标、无效 frontmatter 等失败路径。

运行：

```bash
npm install --prefix "<generator-skill-dir>" --no-package-lock
node "<generator-skill-dir>/scripts/self_check.mjs"
```

只有输出 `SELF_CHECK_PASS` 且退出码为 0 才表示当前环境可用。

## 输出

脚本只写入目标 Skill：

```text
<target-skill-dir>/
├── assets/
│   ├── icon.svg
│   └── icon.png
└── agents/
    └── openai.yaml
```

- `icon.svg` 和 `icon.png`：固定 48×48。
- `agents/openai.yaml`：保留已有字段，只新增或更新 `icon_small` 与 `icon_large`。
- 不更新仓库级 manifest、gallery、README 或其他 Skill。

## 自动选择

按以下优先级选择颜色族和 Lucide 图形：

1. `assets/curated-specs.json` 中已有的公司人工映射，保持旧图标选择不变。
2. 根据目标 Skill 的 `name + description` 进行关键词匹配。
3. 无匹配时使用稳定哈希回退。

相同输入与同一版本生成器必须得到相同结果。

颜色族：

- `strategy`：`#FFF3E8` 背景、`#EA580C` 描边。
- `content`：`#F1EAFE` 背景、`#6D28D9` 描边。
- `engineering`：`#EAF2FF` 背景、`#2563EB` 描边。
- `operations`：`#EAF8F2` 背景、`#15805D` 描边。

需要人工指定时使用；这不会覆盖已有图标：

```bash
node "<generator-skill-dir>/scripts/generate_icon.mjs" "<target-skill-dir>" \
  --family strategy \
  --icon chart-no-axes-combined \
  --metaphor "用户增长曲线"
```

只有用户明确要求替换已有图标时，才使用：

```bash
node "<generator-skill-dir>/scripts/generate_icon.mjs" "<target-skill-dir>" \
  --family strategy \
  --icon chart-no-axes-combined \
  --metaphor "用户增长曲线" \
  --force
```

先预览选择、不写文件时使用：

```bash
node "<generator-skill-dir>/scripts/generate_icon.mjs" "<target-skill-dir>" --dry-run
```

可用 `--list-icons` 查看内置 Lucide 名称。

## 图标规范

- 画布固定为 48×48，不透明直角方形底板。
- 最终有效描边为 2px，圆角线帽和圆角转折。
- 主体使用一个清晰的 Lucide 主轮廓，不拼接多个符号。
- SVG 不得包含脚本、远程资源、文字、Logo、渐变、阴影或纹理。
- PNG 必须真实为 48×48。

## 边界

- 一次只处理一个目标 Skill。
- 目标不存在或没有 `SKILL.md` 时停止，不代替用户创建新 Skill。
- 目标已有 `assets/icon.svg` 或 `assets/icon.png` 时停止；用户明确要求覆盖后才用 `--force`。
- 不从当前工作目录猜测仓库根目录。
- 不运行仓库级 `npm run build:icons`。
- 不修改 GitHub Actions、CI、官网同步、部署配置，不自动提交或推送。

## 完成标准

- SVG 与 PNG 均存在且为 48×48。
- SVG 使用约定颜色、2px 有效描边和单一 Lucide 主体。
- PNG 能正常解码。
- `agents/openai.yaml` 的两个相对路径存在。
- 最终报告目标 Skill、颜色族、Lucide 名称、视觉隐喻、选择来源和文件路径。
