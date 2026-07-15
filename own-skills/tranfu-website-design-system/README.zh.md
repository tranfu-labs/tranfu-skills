---
description: "把 TranFu 官网从 Figma / 截图 / 代码任一起点, 拉回统一的响应式设计系统。"
prompt_examples:
  - prompt: 按 TranFu 官网风格做一个新的 skill 卡片列表页。
    scene: 新建官网页面
  - prompt: 这是 Figma 节点截图, 帮我按官网设计规范落成 React 组件。
    scene: 根据 Figma 开发
  - prompt: 检查 tranfu-site 首页是否符合官网设计规范, 给我一份结构化的问题清单。
    scene: 检查设计规范
  - prompt: 为卡片组件补充响应式适配，在保持 TranFu 官网视觉风格不变的前提下，针对桌面端、平板端和移动端自动调整卡片宽度、排列方式、间距与字号。
  scene: 响应式适配
---

# TranFu 官网设计系统

把 TranFu 官网从 Figma / 截图 / 代码任一起点, 拉回统一的响应式设计系统。

## 什么时候用它

**新建官网页面**:

我在做一个新的 TranFu 官网页面——skill 卡片列表 / 详情页 / 产品中心——想一开始就落在设计规范上。

**根据 Figma 开发**:

我有 Figma 节点或截图, 想按颜色 / 字体 / 间距 / 圆角 / 响应式规则精确实现出 React 代码。

**重构现有页**:

某个 TranFu 页面样式偏了——红色用太多、圆角尺度错、hero 又开始堆装饰——想拉回「中性面为主, 品牌红只做焦点」这条线。

**视觉走查**:

想拿规范逐条对着现有页面, 在文档规定的断点 (1920 / 1440 / 1280 / 756 / 375) 都走一遍, 输出结构化的问题清单。

**生成开发提示词**:

想拿一份可以直接粘给别的 agent 的官网风格提示词, 让它按 TranFu 规范去搭页面。

**不接**:

非 TranFu 官网 → 走通用设计流程; 纯文案; logo 重设计; 纯后端改动; 与 TranFu UI 无关的代码审查。

## 它会产出什么

**先读 `references/design-spec.md`, 拿到证据再动 UI——规范没进上下文就不做决定。**

- **落盘范围**: 只改相关 UI 文件, 与本次无关的代码不动
- **改动报告** (create / implement / refactor 模式): `TRANFU_UI_CHANGE_REPORT` YAML, 含 `changed_files` / `design_rules_used` / `validation` (桌面 + 移动视口 + 验证命令) / `deviations`
- **评审报告** (review 模式): `TRANFU_DESIGN_REVIEW` YAML, 每条问题带 id / severity / rule / location / evidence / fix / verification——review 模式只出报告, 不改文件
- **提示词产出** (prompt_guidance 模式): `TRANFU_AGENT_PROMPT` YAML, 里面是可直接复制的提示词加上引用的规范段落
- **视觉走查**: 桌面和移动视口分开验证; 缺证据的视口标 `not_run:<原因>`, 绝不假装通过
- **绝不会做**: 重画 / 重上色 / 拉伸 / 裁剪 / 装饰 TranFu logo

## 前置条件与边界

**前置**:

`references/design-spec.md` 必须存在且可读; 目标必须是 TranFu 官网页面; 有可以看的证据 (Figma 节点 / 截图 / 运行中的页面 / 代码)。

**相邻 skill 分工**:

| 需要 | 交给 |
|---|---|
| 通用配色 / 字体搭配 / 图表选型 | **ui-ux-pro-max** |
| 与本规范无关的通用 UI 代码审查 | **code-review** |

**不接的场景**:

- 非 TranFu 官网
- 纯文案
- logo 重设计
- 纯后端改动
- 与 TranFu UI 无关的代码审查

**微妙边界**:

- 现有实现与规范冲突 → 同时引用代码证据和规范条目, 做最小范围修正, 绝不大重写
- Figma 拿不到 → 退回本地截图, 置信度标为 partial
- 意图在「改一下」和「只评审」之间模糊 → 先问一句, 得到答复再动手
