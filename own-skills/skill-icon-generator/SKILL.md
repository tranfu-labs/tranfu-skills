---
name: skill-icon-generator
description: >-
  为单个 Codex 或 Claude Skill 生成语义准确、彼此可区分的 48×48 SVG 与 PNG
  图标，并更新该 Skill 的 agents/openai.yaml。用户说“给这个 Skill
  生成图标”“补 assets/icon.svg”“生成同款 Skill 图标”“这个图标重复了”
  “图标不符合 Skill 语义”或要求调整颜色与 Lucide 图形时使用。接受 Skill
  目录或 SKILL.md 路径；品牌绑定型 Skill 优先使用可信来源的品牌 Logo，并内置
  GitHub、微信、Lark/飞书、Coolify、Privy、微博和小红书品牌注册表，其他 Skill
  使用 Lucide；品牌 Logo 使用品牌官方主色和统一 `#F0F0F0` 背景，同品牌多个
  Skill 复用同一纯 Logo；
  其他公司人工映射执行感知图像相似度硬门禁，不得超过 50%。不批量改图标，也不
  修改 CI、官网或部署配置。Do NOT trigger
  when 用户要求处理非 Skill 图标、修改 CI/官网/部署配置，或一次重做多个 Skill
  图标。
version: 0.6.0
author: chuanye312-coder
updated_at: 2026-07-29
origin: own
allow_exec: true
---

# 单个 Skill 图标生成器

一次只处理用户指定的一个 Skill。使用本 Skill 自带的脚本、Lucide/品牌母版、
人工映射和 Sharp 运行时；生成前完成品牌判定、语义判断、现有占用排除与感知
相似度检查。

## 工作流

CREATE A TODO LIST FOR THE TASKS BELOW（每个步骤一个 TODO，并随执行更新状态）：

1. 将用户指定路径规范化为 `<target-skill-dir>`，将本文件目录记为
   `<generator-skill-dir>`。
2. 完整读取目标 `SKILL.md`。目标不存在、不是 Skill，或 YAML frontmatter 中
   `name` / `description` 缺失时，报告原因并停止；不得选图或写文件。
3. 从 `name + description` 提炼：
   - **主语义**：这个 Skill 的任务形态或核心能力，例如 MCP、审查、部署、写作。
   - **次语义**：业务对象或领域，例如 Privy、飞书、社媒、市场。
   - **品牌绑定**：若 Skill 的名称或核心能力直接绑定一个明确的第三方品牌、
     产品或平台，且移除该品牌后任务对象会改变，则标记为品牌绑定型。
   - 品牌绑定型优先表达品牌身份；其他 Skill 必须优先表达主语义，不得只命中
     次语义关键词。
4. 检查目标现有 `assets/icon.svg` / `icon.png`：
   - 已存在且用户未明确要求替换：报告现有资产并停止。
   - 用户明确要求替换：后续生成命令使用 `--force`。
5. 读取 `assets/brand-registry.json`、`assets/curated-specs.json` 和
   `--list-icons` 输出。若目标名称命中品牌注册表，采用注册表中唯一的品牌 Logo
   与官方主色；同品牌已有映射时直接复用。非品牌候选再排除：
   - 已被其他 Skill 人工映射占用的相同 Lucide 或品牌母版；
   - 与任一已映射图标感知相似度 `> 50%` 的 Lucide；
   - 只符合次语义、不符合主语义的 Lucide。
6. 目标没有人工映射时：
   - 已注册品牌直接使用注册表中唯一的纯品牌母版，不叠加任务修饰符。
   - 未注册的品牌绑定型先按“品牌 Logo 规则”选择和规范化品牌母版，并同步登记到
     `assets/brand-registry.json`；不得退回无关 Lucide。
   - 非品牌型内部比较至少 3 个语义候选，按以下顺序裁决：
     1. 主语义准确；
     2. 与次语义不冲突；
     3. 感知相似度最低；
     4. 48×48 下轮廓清晰。
   不向用户展示未通过门禁的草稿。若内置母版没有合格候选，为公司库目标补充一个
   官方 Lucide 母版并新增人工映射；不得用无关图形或稳定哈希结果凑数。
7. 首次使用、依赖缺失、升级后或用户要求自检时运行：

   ```bash
   npm install --prefix "<generator-skill-dir>" --no-package-lock
   node "<generator-skill-dir>/scripts/self_check.mjs"
   ```

   必须看到 `SELF_CHECK_PASS`；否则展示失败项并停止。
8. 先预览最终选择：

   ```bash
   node "<generator-skill-dir>/scripts/generate_icon.mjs" \
     "<target-skill-dir>" --dry-run
   ```

   检查 `mark_type`、`lucide_icon`、`metaphor`、
   `closest_match.similarity` 与品牌/主语义一致。
9. 运行单目标生成器。只有步骤 4 明确允许替换时才追加 `--force`：

   ```bash
   node "<generator-skill-dir>/scripts/generate_icon.mjs" \
     "<target-skill-dir>"
   ```

10. 若生成命令失败，报告错误与部分产物并停止；不得绕过相似度门禁，不得自行追加
    `--force` 重试。
11. 打开实际 PNG，验证 SVG、PNG、`agents/openai.yaml` 和感知相似度报告。
12. 输出 `ICON_GENERATION_REPORT`，包含目标、品牌判定、主/次语义、颜色族、
    `mark_type`、图形母版、隐喻、品牌来源（如适用）、选择来源、最相似图标及
    百分比、输出路径。

## 品牌 Logo 规则

品牌绑定型 Skill 必须优先使用品牌 Logo，不得以通用 Lucide 代替品牌身份。

1. 仅使用可核验的当前品牌标志，来源优先级为：
   - 目标 Skill 自带且注明来源的官方品牌资产；
   - 品牌官网、开发者文档或官方媒体包；
   - Simple Icons 等可追溯品牌图标库，且需确认与品牌当前标志一致。
2. 优先使用独立图形标志。品牌没有独立符号时，可使用官方紧凑品牌标志或
   monogram；不得自行排字、使用长 wordmark、favicon、截图或凭记忆重绘。
3. 将品牌母版保存为 24×24 单色 SVG，并以 `brand-<canonical-name>.svg` 命名。
   保留品牌轮廓与比例，不拉伸、不旋转、不改造关键几何。
   将 canonical name、名称别名、默认颜色族、唯一母版、官方前景色和隐喻
   登记到 `assets/brand-registry.json`；同一别名只能属于一个品牌。
   所有品牌的 `background` 固定为 `#F0F0F0`。
4. 品牌图标不使用通用颜色族。使用注册表中的官方品牌主色作为 Logo 前景色，背景
   固定为 `#F0F0F0`：
   - 线性品牌标志使用最终 2px 描边；
   - 实心品牌标志使用单色填充，不强行描边化；
   - 主体统一居中于 30×30 区域，保持品牌原始轮廓。
5. 每个品牌只保留一个 `brand-<canonical-name>.svg`。同一品牌的多个 Skill
   必须复用该纯 Logo，允许 100% 相同；不得叠加任务图标、角标、文字或其他修饰符。
6. 品牌 Logo 同样禁止脚本、远程资源、文字、渐变、阴影和纹理；来源与版本必须
   写入母版注释或最终报告。

## 感知图像相似度

`scripts/icon_similarity.mjs` 使用归一化感知哈希，不使用描边像素重叠率：

1. 将 Lucide 或品牌母版统一渲染为 32×32 灰度标准图，忽略颜色族与底板。
2. 对低频 8×8 DCT 系数生成 63 位 pHash，捕捉整体轮廓与空间布局。
3. 计算汉明距离 `d`，以 `max(0, 1 - 2d/63)` 得到 0–100% 相似度。
4. `> 50%` 必须失败；`= 50%` 允许。唯一例外是同一注册品牌复用同一 Logo，
   允许 100% 相同；不同品牌和所有非品牌图标仍按门禁处理。

相似度只是排除门禁，不是语义选择器。低相似但语义不正确的图形仍不得采用。

## 自动选择

生成器按以下优先级提出选择：

1. `assets/brand-registry.json` 中由 Skill 名称命中的已核验品牌母版。
2. `assets/curated-specs.json` 的公司人工映射。
3. `name + description` 关键词匹配；任务形态关键词必须排在业务关键词之前，例如
   `MCP` 优先于 `security`、`wallet`。
4. 稳定哈希回退。

除同一注册品牌复用唯一 Logo 外，写文件前都必须通过感知相似度门禁。对公司库新增
Skill，关键词或稳定回退只能作为候选，不得跳过步骤 3–6 的语义裁决与人工映射落盘。

颜色族：

- `strategy`：`#FFF3E8` 背景、`#EA580C` 描边。
- `content`：`#F1EAFE` 背景、`#6D28D9` 描边。
- `engineering`：`#EAF2FF` 背景、`#2563EB` 描边。
- `operations`：`#EAF8F2` 背景、`#15805D` 描边。

人工指定：

```bash
node "<generator-skill-dir>/scripts/generate_icon.mjs" \
  "<target-skill-dir>" \
  --family engineering \
  --icon server-cog \
  --metaphor "MCP 服务连接"
```

人工指定也必须通过 50% 门禁，且不会绕过目标已有资产保护。
品牌母版使用 `--icon brand-<canonical-name>`；颜色由品牌注册表决定，命令行不得
用通用颜色族覆盖品牌色。

## 输出与图标规范

```text
<target-skill-dir>/
├── assets/
│   ├── icon.svg
│   └── icon.png
└── agents/
    └── openai.yaml
```

- 画布固定为 48×48，不透明直角方形底板。
- 最终有效描边为 2px，使用圆角线帽和圆角转折。
- 非品牌型主体只使用一个清晰的 Lucide 主轮廓，不拼接多个符号。
- 品牌绑定型只使用一个纯品牌主标志，不拼接任务修饰符。
- SVG 不得包含脚本、远程资源、文字、渐变、阴影或纹理。
- PNG 必须可解码且真实为 48×48。
- `openai.yaml` 保留已有字段，只新增或更新 `icon_small` 与 `icon_large`。

## 自检与完成标准

自检必须覆盖：

- Node.js、Sharp、运行文件、73 个 Lucide/品牌母版和人工映射完整性。
- 7 个品牌注册项对应 7 个唯一品牌母版，校验别名、官方品牌色、单色渲染及来源。
- 全量人工映射两两感知相似度，除同品牌复用外最大值不得超过 50%。
- 完全重复图形为 100% 并在写文件前失败。
- 非完全相同但超过 50% 的图形在写文件前失败。
- 50% 边界允许；关键词、稳定回退和人工选择保持确定性。
- SVG/PNG 尺寸与样式、YAML 字段保留、覆盖保护和无效输入失败路径。

完成时必须满足：

- 主语义优先、次语义不冲突；
- 品牌绑定判定正确；品牌型使用可核验 Logo，非品牌型不滥用 Logo；
- 图形未被其他人工映射占用；
- 最相似图标得分 `<= 50%`，或属于同一注册品牌的唯一 Logo 复用；
- SVG 与 PNG 均存在且为 48×48；
- PNG 已实际查看；
- `openai.yaml` 两条相对路径存在；
- 最终报告含相似度方法、阈值、最近匹配及分数。

## 边界

- 一次只处理一个目标 Skill。
- 不批量重写历史图标；发现历史冲突时先报告明确 pair，再按用户授权处理。
- 不运行仓库级批量图标构建。
- 不修改 GitHub Actions、CI、官网同步或部署配置。
- 不自动提交、推送或合并。
