# compress-image

`compress-image` 用固定版本 Sharp 把本地静态 PNG、JPEG、WebP 压缩为 WebP 或无损 PNG。默认保留原图，只有用户明确授权时才替换源文件。

## 什么时候用它

- 用户要求压缩或优化本地静态图片、减小体积，或转为 WebP / PNG。
- 需要处理单文件或目录，并获得稳定的 JSON 压缩报告。
- 不用于裁剪、缩放、修图、动画处理、远程下载或其他输入格式。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。

### 公司库内

- 暂无。

### 外部世界

- [baoyu-compress-image](https://github.com/JimLiu/baoyu-skills/tree/6b7a2e417500561a5ecdd0b168332f4142584617/skills/baoyu-compress-image) — 支持多种系统图片后端；**本 Skill 区别**：只使用固定版本 Sharp，CLI 和输出契约更集中。

### 本 skill 独特价值

- 固定 Sharp 版本，跨平台行为一致。
- 原子落盘，默认保留源文件。
- 稳定 JSON 适合自动化核验。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。

### 材料方案

- 统一使用 Sharp，不依赖系统图片工具。
- WebP 用于有损体积优化。
- PNG 用于无损输出。

### 推荐用法

- 首次运行需 Node.js 18.17+ 和 npm。
- 递归批处理时显式添加 `--recursive`。
- 替换源文件前明确添加 `--replace`。

### 已知限制

- 不支持动画和其他输入格式。
- 不负责裁剪、缩放或远程下载。
- 首次运行需要联网安装 Sharp。

## 使用方式

```text
请使用 $compress-image，把 /work/hero.png 压成 WebP，保留原图。
```

也可以直接运行脚本：

```bash
node scripts/main.mjs ./hero.png --format webp --quality 80
node scripts/main.mjs ./images --format png --recursive --json
node scripts/main.mjs ./hero.webp --format webp --replace
```

默认输出位于原图旁边，命名为 `{stem}-compressed.{format}`。脚本拒绝覆盖已有目标文件。

## 支持范围

| 项目 | 支持 |
|---|---|
| 输入 | 静态 PNG、JPEG、WebP；单文件或目录 |
| 输出 | WebP；无损 PNG |
| 默认 WebP 质量 | 80，可设置 1–100 |
| 批处理 | 当前目录；显式 `--recursive` 后递归 |
| 原图策略 | 默认保留；显式 `--replace` 后替换 |

## 运行时

首次运行会通过 npm 把 `sharp@0.34.5` 安装到用户缓存目录，后续直接复用，不会修改 Skill 目录。压缩会应用 EXIF 朝向，但不复制 EXIF 等元数据；输出变大时也会保留结果并如实报告负压缩率。

## 来源与许可

本 Skill 基于 [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) 的 `baoyu-compress-image`，来源快照为 [`6b7a2e4`](https://github.com/JimLiu/baoyu-skills/commit/6b7a2e417500561a5ecdd0b168332f4142584617)。项目按 MIT License 分发；Sharp 运行时依赖使用 Apache License 2.0。详见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
