---
prompt_examples:
  - prompt: 帮我在 TranFu 官网首页加一个「客户案例」区块, 按官网品牌风格来。
    scene: 新建页面区块
  - prompt: 这个 CTA 按钮改成 TranFu 品牌红, 但底色保持中性, 别弄成大红块。
    scene: 修改现有组件
  - prompt: 审一下 src/app/components/Hero.tsx 是不是符合 TranFu 官网设计规范, 只挑问题别改文件。
    scene: 检查页面设计
  - prompt: 跑一下定价页的视觉 QA, 桌面端和移动端都看, 溢出 / 重叠 / 品牌红滥用都圈出来。
    scene: 检查视觉细节
  - prompt: 官网的 favicon 和顶栏 logo 需要放上去, 用打包好的资产, 别去老站上抓。
    scene: 更新 Logo 资源
  - prompt: 重构一下这个卡片组件, 圆角 / 阴影 / 字体保持 TranFu 官网原样。
    scene: 保持外观重构
  - prompt: 为卡片组件补充响应式适配，在保持 TranFu 官网视觉风格不变的前提下，针对桌面端、平板端和移动端自动调整卡片宽度、排列方式、间距与字号。
    scene: 响应式适配
---

[English](./README.md) | [中文](./README.zh.md)

# TranFu 官网设计规范

一份让 TranFu 官网视觉语言保持一致的规则集——加 / 改 / 重构组件时先对齐规范再动手, 审查和视觉 QA 只挑问题不改文件。

## 什么时候用它

**新建页面区块**:

我在 TranFu 官网上加一个新区块 / 新页面, 想让 skill 先把品牌红、中性底色、字体层级、圆角拉齐, 再动手写组件。

**修改现有组件**:

我在改按钮 / 卡片 / 首屏组件, 想让 skill 提醒我别滑出品牌红的用法边界, 别把字体换成规范外的家族。

**检查页面设计**:

我把改动过的组件文件 / 截图交过去, 想让 skill 只出评审——每条问题都带规则出处和定位, 一个文件都不改。

**检查视觉细节**:

我要 skill 跑一次桌面端 + 一次移动端视口, 圈出文字溢出 / 元素重叠 / 响应式框架缺失 / 品牌红当大背景滥用。

**Logo 与资产**:

我在放官网 favicon / 顶栏组合标志 / app 图标, 想让 skill 用 `assets/` 下打包好的 SVG 资产, 别从老部署站或本地下载目录里抓。

**不接**:

非 TranFu 站点 → **ui-ux-pro-max**; 纯文案改 (与 UI 无关); 从头重画 TranFu logo; 独立品牌手册; 与视觉一致性无关的普通代码改动。

## 它会产出什么

**先读 `references/design-spec.md`, 读不到就报 `BLOCKER: missing design spec` 停下**——最反常识的一点。

- **`create` / `modify` / `refactor`**: 在相关组件 / 样式 / 资产的边界内改文件, 打印 `TRANFU_UI_CHANGE_REPORT` (改了哪些文件 / 用了哪几条规则 / 有没有故意偏离 / 桌面端与移动端视口结果 / 命令执行结果)。
- **`review`**: 只挑问题不改文件, 打印 `TRANFU_DESIGN_REVIEW`, 每条 finding 带 `severity` / 规则出处 / `location` (file:line / 截图 / UI 区域) / `fix` / `verification`。
- **`visual QA`**: 跑一次桌面端 + 一次移动端视口, 打印 `TRANFU_VISUAL_QA_REPORT`, 每个视口标 `passed | failed | not_run:<原因>`。
- **意图模糊时**: 实现还是审查判不清 → skill 会先问一句, 得到答复再动。
- **绝不会做**: 越界改无关组件; 重画 / 改色 / 拉伸 logo; 引用 `/Users/.../Downloads` 里的 logo 资产; 用品牌红 `#E63A46` 当大面积装饰底色; 没实际检查过就宣称某个视口通过。

## 前置条件与边界

**前置**:

目标要是 TranFu React/Vite 项目——至少能定位到一个组件文件 / 截图 / UI 区域。`references/design-spec.md` 必须能读。打包好的 logo 资产在 `assets/` 下, 用之前先复制到项目的 `public/brand/` 再引用。

**相邻 skill 分工**:

| 场景 | 交给 |
|---|---|
| `1920` / `1440` / `1280` / `756` / `375` 断点的响应式系统 | **tranfu-website-design-system** |
| 非 TranFu 品牌或通用设计系统的活 | **ui-ux-pro-max** |
| 技术架构图 (不属于品牌 UI) | **fireworks-tech-graph** |

**不接的场景**:

- 非 TranFu 站点或通用落地页
- 与 TranFu UI 或品牌无关的纯文案审查
- 从头重画 TranFu logo
- 脱离当前 React/Vite 官网的独立品牌手册
- 用户没明说要重设时, 替换官网现有视觉方向

**微妙边界**:

- 没拿到编辑授权 → 切成 `suggest patch` 模式, 报告结构照旧但一个文件不改
- 修改类任务定位不到目标实现文件 → 报 `BLOCKER: target implementation not found` 停下
- 截图和代码证据打架 → 两个证据都写进 finding, 验证一项标 `deferred_with_user_visible_risk`
- 命令 / 开发服务 / 浏览器 / 视口跑不起来 → 记 `not_run:<原因>`, 绝不宣称"通过"
