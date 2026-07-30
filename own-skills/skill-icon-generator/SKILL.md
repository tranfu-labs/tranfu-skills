---
name: skill-icon-generator
description: >-
  为单个 Codex 或 Claude Skill 生成 48×48 SVG 与 PNG 图标，并更新
  agents/openai.yaml。用户说“给这个 Skill 生成图标”“补 assets/icon.svg”
  “这个图标重复了”“图标没有背景”或要求修正 Skill 图标时使用。非品牌 Skill
  先生成无背景图形，再与用户指定或自动定位的现有 Skill 仓库全部 icon.svg
  比较；最高重复率大于 70% 时自动换候选重试，通过后才添加分类背景。品牌绑定型
  Skill 直接使用已核验品牌 Logo 和 #F0F0F0 浅灰背景。不要用于非 Skill 图标、
  批量重写历史图标、CI、官网或部署配置。
version: 0.7.0
author: chuanye312-coder
updated_at: 2026-07-30
origin: own
allow_exec: true
---

# Skill 图标生成器

一次只处理一个 Skill。真实 Skill 仓库中的现有 `icon.svg` 是重复检测的唯一事实
来源；`curated-specs.json` 只能提供初始候选，不能代替仓库扫描。

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO，并随执行更新状态）：

1. 规范化目标 Skill 和现有 Skill 仓库路径。仓库必须包含 `own-skills/`、
   `external-skills/` 或 `meta-skills/` 至少一个目录；无法定位时报告阻塞并停止。
2. 完整读取目标 `SKILL.md`。若目标无效，或 frontmatter 缺少 `name` /
   `description` → 报告错误并停止。
3. 判断目标是否品牌绑定：
   - 是 → 使用 `assets/brand-registry.json` 中已核验的唯一品牌 Logo、官方前景色
     和固定浅灰背景 `#F0F0F0`，跳到步骤 7。
   - 否 → 继续步骤 4。
4. 根据 `name + description` 生成第一个无背景单图形候选。候选必须表达主语义，
   不能只表达宽泛的“AI”“工具”或次要业务名词。
5. 使用生成器扫描真实仓库内全部 `**/assets/icon.svg`，去掉背景后计算归一化
   pHash：
   - 最高重复率 `> 70%` → 拒绝该候选，生成下一个语义相关候选并重复步骤 5。
   - 最高重复率 `<= 70%` → 接受该候选并继续。
   - 所有语义相关内置候选都被拒绝 → 增加一个新的官方 Lucide 母版，再重试；
     NEVER 使用无关图形或稳定哈希结果凑数。
6. 候选通过重复检测后，才添加对应颜色族背景：
   - `strategy`：`#FFF3E8` 背景、`#EA580C` 图形。
   - `content`：`#F1EAFE` 背景、`#6D28D9` 图形。
   - `engineering`：`#EAF2FF` 背景、`#2563EB` 图形。
   - `operations`：`#EAF8F2` 背景、`#15805D` 图形。
7. 生成 48×48 `assets/icon.svg` 与 `assets/icon.png`，并保留
   `agents/openai.yaml` 现有字段，只新增或更新 `icon_small` / `icon_large`。
8. 打开实际 PNG，确认背景存在、32px 下可辨认、语义正确。
9. 输出 `ICON_GENERATION_REPORT` 并结束。

## 运行

首次使用或依赖缺失时：

```bash
npm install --prefix "<generator-skill-dir>" --no-package-lock
node "<generator-skill-dir>/scripts/self_check.mjs"
```

先执行真实仓库比对但不写文件：

```bash
node "<generator-skill-dir>/scripts/generate_icon.mjs" \
  "<target-skill-dir>" \
  --repository "<existing-skills-repository>" \
  --dry-run
```

确认 `attempts` 中被拒绝候选、最终候选、最近匹配和重复率均合理后，去掉
`--dry-run` 生成文件。只有用户明确要求替换已有图标时才添加 `--force`。

也可通过环境变量提供仓库：

```bash
export TRANFU_SKILLS_REPOSITORY="<existing-skills-repository>"
```

## 重复检测

- MUST 比较真实仓库文件，不得只比较人工映射表。
- 比较对象是去掉底板后的前景图形；颜色和背景不影响重复率。
- `> 70%` 拒绝，`= 70%` 允许。
- 目标 Skill 自己的现有图标不参与比较。
- 非品牌候选按语义相关顺序自动重试；报告必须保留每次尝试。

## 品牌

- 品牌由 Skill 名称中的已登记别名判断。
- 品牌 Skill MUST 使用注册表中的品牌 Logo，不得回退为通用 Lucide。
- 品牌 Logo 保持官方轮廓和前景色，背景固定为 `#F0F0F0`。
- 同一品牌的多个 Skill 可以复用同一个纯 Logo。

## 输出规范

- SVG、PNG 固定为 48×48。
- 背景为不透明直角方形。
- 非品牌主体只使用一个清晰图形，不拼接多个符号。
- SVG 不得包含脚本、远程资源、文字、渐变、阴影或纹理。
- PNG 必须可解码且全部像素不透明。

最终 `ICON_GENERATION_REPORT` MUST 包含：目标 Skill、仓库路径、扫描图标数、
品牌判定、颜色、每次候选及重复率、最终图形、背景色和输出路径。

## 边界

- 不批量修改历史图标。
- 不修改仓库级 manifest、gallery、CI、官网或部署配置。
- 不自动提交、推送或合并。
