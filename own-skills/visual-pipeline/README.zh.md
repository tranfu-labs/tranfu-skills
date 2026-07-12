---
prompt_examples:
  - prompt: 帮我设计一下内部评审工具的设置页。
    scene: 从零设计新页面
  - prompt: 评审页的头部感觉不对, 帮我改一下。
    scene: 改已有设计
  - prompt: 新产品的仪表盘 / 列表 / 详情三个页面, 一个一个做过来。
    scene: 多页面项目
  - prompt: 字段和用户场景都定了, 直接推进到高保真。
    scene: 输入已锁, 进风格段
  - prompt: 整体调性不对, 想要杂志感, 别再是仪表盘那味了。
    scene: 换风格
  - prompt: 先把线框搞出来, 别急着上色, 我想先看骨架。
    scene: 骨架优先
---

[English](./README.md) | [中文](./README.zh.md)

# visual-pipeline

产品设计**后段**流水线: 已知"用户场景 + 要显示什么" → 高保真选定版.

单位是**页面**, 一个页面跑一遍. 三段顺序: 显示信息 → 显示框架 → 风格 + 实践. 每段先文档后 HTML, 不跳段, 改动走归属判定.

代码实现及之后的环节不在范围内.

## 什么时候用它

- 用户说"设计 / 做 / 改 X 页面" 且偏视觉 / 产品层
- 输入已经收敛到"用户场景 + 要显示什么", 等着把它变成像素
- 一个页面跑一次, 多个页面跑多次, 每页独立判定风格

不用于: 纯文案小改 / 单 bug 代码修复 / 纯后端 / 还没想清楚要做什么的需求探索阶段.

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [ui-ux-pro-max](../../external-skills/ui-ux-pro-max/SKILL.md) — UI/UX 材料库 (67 style / 96 配色 / 57 字体); **本 skill 区别**: 它是材料库, 在"风格段"内被调用; 本 skill 是流程纪律, 管段间顺序与归属
- [claude-design-system](../../external-skills/claude-design-system/SKILL.md) — Anthropic 内部 design 工具 system prompt 镜像 (HTML 制品参考材料); **本 skill 区别**: 它是 prompt 参考, 本 skill 是可执行流程, 强制分段不可跳

### 外部世界
- [claude-wireframe-skill](https://github.com/Magdoub/claude-wireframe-skill) — 一把出 5 个 B&W 线框 + 并行加色彩变体; **本 skill 区别**: 它是"多选并列", 本 skill 是"单页深耕 + 改动可回退"
- [claude-design-skill](https://github.com/jiji262/claude-design-skill) — Claude.ai 内部 prompt 复刻, 出 HTML 制品 (decks / landing / 动画); **本 skill 区别**: 它范围全 (含演示/海报), 本 skill 限定页面设计 + 强制三段顺序

### 本 skill 独特价值
- 强制分段先文档后 HTML, 视觉决策有文档可追
- 改动必先归属判定, 防止复现历史阻塞
- 每页独立风格段, 多页项目里防全局调性吃单页

## 使用技巧

> 由作者起草. 帮助阅读者纵向上手.

### 材料方案
- 试过"一把梭出 HTML 让用户挑", 决策无文档无法回退, 改第二轮就废
- 试过"全局一套风格通吃", 单页特殊场景被压平, 用户连续否定后无锚点

### 推荐用法
- 先按调用方约定确认页面输出目录 (例 `web-goal-docs/<page>/`)
- 第一页跑全三段建立基线, 后续页可引用"继承自项目共享设计语言"
- 用户说"不对"先归属再改, 别直接动 HTML — 这是核心使用纪律

### 已知限制
- 不做需求层决策 (用户场景 / 字段优先级), 输入端必须已经锁定
- 不出代码, `03-selected.html` 是 ground truth, 代码层做不出退回风格段
- 全程中文, 产物里禁止 S1/P0/R1 等英文缩写 (可能不符合英文项目惯例)
