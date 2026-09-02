---
description: 用统一的页面边界、产品标注卡和跳转箭头绘制规范化的 Excalidraw PRD 原型。
prompt_examples:
  - scene: 绘制 PRD 原型
    prompt: 使用 $excalidraw-prd 把这份 PRD 绘制成带产品标注的 Excalidraw 原型。
  - scene: 整理现有画板
    prompt: 使用 $excalidraw-prd 修正这个 Excalidraw PRD 的页面 frame、产品标注和跳转箭头。
  - scene: 补充产品标注
    prompt: 使用 $excalidraw-prd 为这些页面设计补齐结构化产品标注卡。
---

# Excalidraw PRD 原型规范

用统一的视觉语法创建或调整 Excalidraw PRD 原型，明确表达页面边界、产品标注和页面跳转。

## 什么时候使用

- 把文字 PRD 转换成 Excalidraw 页面原型。
- 补充模块职责、状态边界、业务规则和恢复路径等产品标注。
- 修复现有 PRD 画板中拥挤或包裹不完整的页面 frame。
- 从真实操作点清楚表达页面之间的跳转关系。

## 它约束什么

- 每个页面使用矩形作为可见边界。
- 使用带页面名称的外围 frame，同时包裹页面矩形和产品标注。
- 产品标注位于页面矩形之外、外围 frame 之内。
- 标注卡使用语义色编号角标、同色边框、黑色标题和灰色描述。
- 页面跳转使用从真实操作点直达目标页面的实线箭头；跨画布或闭环路径使用长回程箭头。

## 能力边界

本 Skill 负责 Excalidraw PRD 画板的结构和表达规范，不负责撰写产品需求、实现前端页面，也不替代技术架构图能力。
