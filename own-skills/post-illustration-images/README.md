---
prompt_examples:
  - prompt: 这是我公众号文章的正文，帮我做几张配图。
    scene: 为公众号文章配图
  - prompt: 小红书新笔记帮我做一组封面和正文图，主打前后对比。
    scene: 制作小红书组图
  - prompt: 用 weibo-signal-core 给这条微博做一张竖版科技图解。
    scene: 使用指定模板
  - prompt: 上一张 01-cover 帮我贴品牌 Logo，不要重新生成。
    scene: 为已有图片贴 Logo
  - prompt: 不要品牌 Logo，保留模型返回的原图。
    scene: 关闭品牌叠加
---

中文 | [English](./README.en.md)

# Post Illustration Images

面向公众号、小红书、知乎、微博和头条号的稳定内容配图工作流。它会先理解正文和表达目标，再选择已注册模板、规划分镜、逐张生成、确定性叠加品牌 Logo，并完成几何与质量检查。

## 核心能力

- **内容驱动**：先分析正文，再选择内容锚点和表达结构；每张图只承载一个核心含义。
- **模板化生产**：整组图片使用同一份 `style_spec`，由注册表统一管理渠道、比例、颜色、布局、安全区和品牌槽位。
- **逐张生成**：每张图独立编译 prompt、生成和验收，不让模型一次生成整套轮播。
- **稳定贴 Logo**：禁止模型绘制 Logo、水印和页码；品牌开启时，通过内置 `resvg-wasm@2.6.2` 确定性叠加真实 SVG。
- **保留原生像素**：符合比例和最小边要求的图片不裁剪、不填充、不拉伸、不放大，也不强制改成模板设计尺寸。
- **支持续做**：可以只补 Logo、恢复原图、重做单张或追加一张，无需重跑整组。
- **支持编排器协议**：可作为 `content-production-provider/v1` 的 `illustration-v1` provider，在严格的路径、哈希和产物白名单约束下执行 plan 或 generate。

## 已注册模板

当前共有 5 个渠道、7 套模板：

| 渠道 | `style_id` | 默认比例 | 用途 |
|---|---|---:|---|
| 公众号 | `wechat-doodle` | 4:3 | 米色手绘正文配图 |
| 小红书 | `xhs-explainer-notebook` | 3:4 | 手账科普封面与轮播，渠道默认模板 |
| 小红书 | `xhs-cream-paper` | 3:4 | 奶油纸手绘信息图 |
| 小红书 | `xhs-orange-card` | 3:4 | 暖橙撕纸知识卡 |
| 知乎 | `zhihu-tech` | 16:9 | 现代科技信息图 |
| 微博 | `weibo-signal-core` | 3:4 | 黑底红光科技概念与流程图解 |
| 头条号 | `toutiao-luminous-tech` | 16:9 | 明亮科技流程与机制图解 |

注册表以 [`references/style-registry.json`](./references/style-registry.json) 为准；[`references/style-index.md`](./references/style-index.md) 是自动生成的可读索引。

## 运行方式

- **独立模式**：普通配图请求走完整工作流，产物写入 `post-illustration-output/<content-slug>/`。
- **编排器模式**：带 provider 标记的结构化请求必须遵循 [`references/orchestrated-provider.md`](./references/orchestrated-provider.md)。plan 阶段只输出计划和分镜，获批后的 generate 阶段才生成图片；结果写入编排器的 `07-visual/<platform>/`，并将控制权交还编排器。

两种模式不会互相回退。无效或冲突的 provider 请求会返回结构化 `BLOCKED` 结果，不会悄悄改走独立模式。

## 工作流程

1. 确认发布渠道、正文、输出类型、数量上限和品牌偏好。
2. 预检可用的运行时原生图像工具或已配置 API 后端。
3. 分析正文，选择已注册的渠道模板，并解析 `gpt-image-2` 请求尺寸。
4. 选择内容锚点，保存 `shot-list.md`，为每张图编译独立 prompt。
5. 一次生成并验收一张图；先用第一张作为 canary，再继续整组。
6. 品牌开启时，在同尺寸 PNG 原图上叠加 Logo；关闭时直接保留模型返回文件。
7. 完成内容、风格、品牌、几何和整组一致性 QA，写入 `manifest.md`。

## 产物结构

独立模式的完整运行默认写入项目目录，而不是 skill 目录：

```text
post-illustration-output/<content-slug>/
├── shot-list.md
├── prompts/
│   └── 01-cover.md
├── images/
│   ├── unbranded/   # 品牌开启时的 PNG 原图
│   └── branded/     # 同尺寸品牌成图
└── manifest.md
```

品牌关闭时，图片直接写入 `images/` 并保留原生扩展名，不额外制造一份重编码副本。

编排器模式只写请求明确授权的 `expected_artifacts`。它使用 `plan.json`、`shot-list.md`、`bundle.json`、原生 `manifest.md`、prompts 和图片，并通过 SHA-256 保持正文、标题选择、计划和最终产物的可追溯关系。

## 前置条件与边界

- 需要可验证的运行时原生图像工具，或当前环境已经配置好的 API 图像后端。
- 内置几何配置只适用于已验证可用的 `gpt-image-2`；不会把它套用到其他模型。
- 只有启用品牌叠加时才要求 Node.js 22+；渲染器已经随仓库提供，无需运行时 `npm install`、原生 SVG 工具或额外 API Key。
- 不适用于纯摄影、人像修图、产品渲染、写实品牌大片，以及必须在图片内精确呈现长段文字的任务。
- 用户给出的图片数量是目标或上限，不是强制配额；内容锚点不足时不会生成凑数图。
- `style_reference` 仅用于 QA，不会作为生成输入，也不会复制其中的主题、文案、Logo 或精确布局。

## 本地维护

仓库没有运行时 npm 依赖安装步骤。维护模板或品牌叠加逻辑后，可运行与 CI 一致的检查：

```bash
node --test scripts/test-brand-overlay.mjs
node --test tests/brand-policy.test.mjs tests/generation-geometry.test.mjs tests/style-bundle.test.mjs
node --test tests/provider-contract.test.mjs
node scripts/validate-style-bundle.mjs --installed
```

主要目录：

- `SKILL.md`：完整工作流与不可违反的约束
- `references/styles/`：模板说明和机器可读 Style Spec
- `references/style-registry.json`：渠道与模板注册表
- `references/orchestrated-provider.md`：编排器 provider 协议
- `scripts/`：模板校验、几何解析和品牌叠加脚本
- `vendor/resvg-wasm/`：固定版本的 WASM 渲染器
- `assets/style-references/`：长期 QA 参考图

第三方组件与许可证信息见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。
