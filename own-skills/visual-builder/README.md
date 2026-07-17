# Visual Builder

中文 | [English](README_EN.md)

Visual Builder 是一个面向 Codex 的视觉模板构建技能。它将用户提供的设计图，或已有的 `visual_dna_system` 文档，转换为去品牌化、适配指定内容平台的插画风格候选包。候选包可以独立完成审核与批准，也可以选择交给 `post-illustration-images` 注册和用于生产配图。

它提取的是可复用的视觉语法，而不是对原图进行像素级复刻。源图中的品牌、主题、文案、专有名词和身份元素不会进入最终模板。

## 安装与推荐搭配

使用 Codex 内置的 `skill-installer` 安装 Visual Builder：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo BruceL017/visual-builder \
  --path . \
  --name visual-builder
```

Visual Builder 可以单独运行，同时推荐搭配两个可选 skill：

| 位置 | Skill | 作用 | 缺失时的行为 |
| --- | --- | --- | --- |
| 上游 | `visual-dna-system` | 从设计图提取更完整的 Visual DNA | 使用 Visual Builder 内置的精简提取流程 |
| 当前 | `visual-builder` | 编译、校准、验证并批准候选模板 | 独立完成到可移植的 `approved` 候选包 |
| 下游 | [`post-illustration-images`](https://github.com/BruceL017/post-illustration-images) | 注册批准的样式并用于生产配图 | 保留批准候选包，但不注册或生产配图 |

`visual-dna-system` 目前没有公开安装地址；如果你的环境已有可信的仓库 URL 或路径，可以从该来源安装，并将目标名称设为 `visual-dna-system`。不要使用未经确认的同名仓库。

安装公开的下游 skill：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo BruceL017/post-illustration-images \
  --path . \
  --name post-illustration-images
```

每个任务首次调用 Visual Builder 时，它会检测这两个可选 skill。只有缺失项会被推荐；提示不会自动安装、不会暂停任务，也不会在同一任务内重复。

## 核心能力

- 支持设计图和 Visual DNA 两种输入模式。
- 检查颜色、字体、构图、形状、材质和插画语言等设计信号。
- 编译去品牌化的样式文档、结构化规范和文本提示词。
- 针对概念、流程和清单三种内容结构分别生成校准图。
- 执行尺寸、文件完整性、PNG 结构、评分和安全约束验证。
- 要求人工查看校准结果后，才允许批准和安装候选模板。

## 支持平台

| 平台 | 设计坐标系 | 比例 | 方向 |
| --- | ---: | ---: | --- |
| 微信公众号 | 1600 x 1200 | 4:3 | 横版 |
| 小红书 | 1080 x 1440 | 3:4 | 竖版 |
| 知乎 | 1600 x 900 | 16:9 | 横版 |
| 微博 | 1080 x 1440 | 3:4 | 竖版 |
| 今日头条 | 1600 x 900 | 16:9 | 横版 |

这些尺寸用于定义布局坐标。通过比例检查的校准图片会保留原生像素，不会被裁剪、填充、拉伸或强制缩放。今日头条图片的短边还必须不少于 900 像素。

## 工作流程

1. 明确输入模式、来源、目标平台和输出目录。
2. 提取或验证 Visual DNA，并通过设计信号与来源完整性检查。
3. 建议去品牌化的候选名称、用途和别名。
4. 编译样式文档、平台几何、提示词和候选元数据。
5. 独立生成概念、流程和清单三张校准图。
6. 执行机器 QA，选择最佳参考图并构建联系表。
7. 验证完整候选包，等待人工审核。
8. 人工明确批准后交付可移植候选包；只有用户要求并且下游可用时才执行安装。

## 候选包结构

```text
visual-builder-output/<style_id>/
├── candidate.json
├── visual-dna.md
├── visual-dna.json
├── style.md
├── style.spec.json
├── provenance.json
├── prompts/
│   ├── concept.md
│   ├── process.md
│   └── checklist.md
├── calibration/
│   ├── concept.png
│   ├── process.png
│   ├── checklist.png
│   ├── style-reference.png
│   └── contact-sheet.png
└── qa.json
```

候选状态依次为 `draft`、`ready_for_review`、`approved` 和 `installed`；未通过硬性检查时使用 `blocked`。生成完成不等于审核完成，机器验证通过也不能替代人工批准。

## 使用方式

将本仓库作为 Codex 技能加载，然后通过明确的输入参数调用。例如：

```text
使用 $visual-builder，把这张 1080 x 1440 的知识卡片构建为小红书插画模板候选。
移除原品牌和文案，保留纸张质感、编辑式层级和留白节奏，并在生成校准图后停下来等待审核。
```

必填输入：

- `input_mode`：`image` 或 `visual-dna`
- `source`：图片路径，或包含 `visual_dna_system` 的 JSON/Markdown
- `target_platform`：`wechat`、`xhs`、`zhihu`、`weibo` 或 `toutiao`
- `output_root`：候选包输出目录

## 本地验证

运行测试：

```bash
node --test tests/validate-candidate.test.mjs
```

验证候选包：

```bash
node scripts/validate-candidate.mjs /absolute/path/to/candidate
```

人工审核后标记批准：

```bash
node scripts/mark-approved.mjs /absolute/path/to/candidate \
  --confirm-human-review \
  --confirmed-by "<reviewer>"
```

## 关键约束

- 不把源图交给图片生成后端。
- 不复制品牌、Logo、水印、角色、原文案或独特身份元素。
- 不把自然照片、纯 Logo 或缺乏设计系统的内容误判为可复用模板。
- 不从源图比例推断目标平台，目标平台必须由用户明确指定。
- 不在缺少三张校准图、机器 QA 或人工审核时安装模板。
- 不把校准参考图作为后续生成输入。

更完整的行为契约、编译规则和 QA 标准分别见 [candidate-contract.md](references/candidate-contract.md)、[compiler.md](references/compiler.md) 和 [qa.md](references/qa.md)。
