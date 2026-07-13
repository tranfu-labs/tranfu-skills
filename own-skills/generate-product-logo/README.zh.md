---
prompt_examples:
  - prompt: 给 AI 会议助手探索三种不同的 Logo 方向。
    scene: 探索 Logo 方向
  - prompt: 把这个产品 Logo 做成缩到 64px 仍然清楚的 App 图标。
    scene: 制作 App 图标
  - prompt: 给这个开发者工具做一个简洁的网页图标。
    scene: 制作网页图标
  - prompt: 沿用我们的品牌色，不要渐变，探索几种 Logo 方案。
    scene: 遵循品牌规范
  - prompt: 生成几种差异明显的 Logo 方案，方便我并排比较。
    scene: 对比多个方案
  - prompt: 检查最终标志缩到 32px 后是否仍然清楚。
    scene: 检查小尺寸效果
---

[English](./README.md) | [中文](./README.zh.md)

# generate-product-logo

为产品先整理 Logo 设计规范和视觉风格方向，再生成一组可比较的 Logo / app icon / favicon 候选。它不绑定固定风格，重点是把产品定位、用户、使用场景和小尺寸识别要求变成可执行的视觉规则。

## 什么时候用它

- 要给一个已经有基本定位的产品探索 Logo 方向。
- 要做浏览器图标、app icon、社交预览标志或品牌标记。
- 需要先定 Logo 的设计规范、风格约束和候选方向。
- 需要先补齐产品信息，再生成可横向比较的候选图。

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [visual-pipeline](../visual-pipeline/SKILL.md) — 把已收敛页面方案推进到高保真页面; **本 skill 区别**: 本 skill 只做产品 Logo / icon 候选，不做整页 UI。
- [daily-report](../daily-report/SKILL.md) — 把 AI 日报素材渲染成 TranFu 发布图片; **本 skill 区别**: 本 skill 不渲染长图，专注品牌标志和小尺寸识别。
- [tranfu-website-design](../tranfu-website-design/SKILL.md) — 维护 TranFu 官网视觉规范和页面一致性; **本 skill 区别**: 本 skill 用于新产品 Logo 探索，不改官网组件。

### 外部世界
- [logo-designer-skill](https://github.com/neonwatty/logo-designer-skill) — Claude Code SVG Logo 设计流程; **本 skill 区别**: 本 skill 先整理产品 Logo 设计规范，再生成候选并做 32px 预览检查。
- [logo-generator-skill](https://github.com/op7418/logo-generator-skill) — 生成多版 SVG Logo 和展示图; **本 skill 区别**: 本 skill 先明确产品语义、风格约束和小尺寸识别标准，再进入图像探索。
- [claude-design-skill](https://github.com/jiji262/claude-design-skill) — 生成落地页、幻灯片、原型等 HTML 设计制品; **本 skill 区别**: 本 skill 范围更窄，只处理 Logo / icon。

### 本 skill 独特价值
- 先生成 Logo 设计规范。
- 风格随产品定位推导。
- 每轮都检查 32px 识别。

## 使用技巧

> 由 tranfu-publish 引导起草. 帮助阅读者纵向上手.

### 材料方案
- 准备产品名、功能、用户、核心动作。
- 说明用途: favicon / app icon / 官网。
- 给品牌色、参考图或禁用符号。

### 推荐用法
- 第一次跑先要 3-4 个方向。
- 选中一版后只改一个轴。
- 最后再导出 favicon / 社交图。

### 已知限制
- 不是商标法律审查。
- 默认产物不是矢量终稿。
- 不适合纯文案或整页 UI。

## 怎么用

可以这样说：

```text
用 generate-product-logo 给 VpnHub 做 4 个 Logo 方向。它是 VPN 智能路由平台，给运维和管理者使用，核心动作是路由 / 分发 / 稳定连接，主要用于浏览器图标和官网页头。
```

如果产品信息不完整，它会先问一个补充问题，不会直接生成。

## 你会看到什么

- 一份 Logo 设计规范和风格方向。
- 3-4 个基于规范生成的 Logo 方向。
- 正方形候选图，适合 icon-first 场景。
- 一张对比图和 32px 小尺寸预览。
- 一个推荐选项，以及下一步可做的 favicon、app icon 或社交预览导出。
