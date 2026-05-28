---
name: claude-design-system
description: Anthropic 内部 Claude 设计制品工具的 system prompt 镜像 (社区抓取), 422 行讲清 Claude 怎么做 HTML 原型 / React 组件 / 幻灯片 / 动画 / 设计系统适配. 当用户问 "Claude 怎么出高质量设计 / 我要给自己的 Claude 设计 agent 抄一份基线 prompt / 为什么 Claude 输出的 React 总因 const styles 冲突 / Claude 做幻灯片为什么会 1-indexed slide label" 时, 读这份 prompt 当参考材料. Do NOT trigger when: 用户要真做设计实现 (走 ui-ux-pro-max) / 审 UI 代码 (走 web-design-guidelines) / 只画架构图 (走 fireworks-tech-graph) / 单纯用 Claude.ai 不需要装它.
version: 1.0.0
author: elder-plinius
updated_at: 2026-05-22
origin: external
source_url: https://github.com/elder-plinius/CL4R1T4S/blob/main/ANTHROPIC/Claude-Design-Sys-Prompt.txt
---

# claude-design-system (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容, 不存 skill body.

**注意**: 这不是一个可执行的 skill, 而是**参考阅读材料** —— Anthropic 内部 "Claude 设计制品工具" (Claude.ai 的 design / make 功能) 的 system prompt, 由社区项目 `elder-plinius/CL4R1T4S` 抓取镜像. 装上后 `tfs install` 会把全文 422 行拉到本地, 给你 / 你的 agent 当模板和反查表用.

- 上游 (镜像): https://github.com/elder-plinius/CL4R1T4S/blob/main/ANTHROPIC/Claude-Design-Sys-Prompt.txt
- 原作者: Anthropic (内部 prompt, 非公开发布)
- 镜像维护者: elder-plinius (CL4R1T4S 项目专门归档主流 AI 公司的 system prompts)
- License: 镜像项目无明确 license, 内容性质是 Anthropic prompt 的复刻. 商业使用请自行评估

更新内容请直接看上游, 别在本仓库改 body —— 上游变了重新 `tfs install` 拉一次.
