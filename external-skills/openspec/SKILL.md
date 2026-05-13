---
name: openspec
description: 当用户做多轮迭代或长期维护项目时, 用 /opsx:propose → /opsx:apply → /opsx:archive 把每个 change 拆成 proposal/specs/design/tasks 文件夹, archive 后规范沉淀到 specs/, 下次改同一模块 AI 可读历史规范
version: 1.3.1
author: Fission-AI
updated_at: 2026-05-12
origin: external
source_url: https://github.com/Fission-AI/OpenSpec
---

# openspec

> 本 skill 由 tranfu-labs 推荐, 完整内容 / 装法见 source_url.

## 完整内容见 source_url

- 项目: https://github.com/Fission-AI/OpenSpec
- npm: `@fission-ai/openspec`

## 装法 (本条异类, 与一般 external-skill 不同)

OpenSpec **不是** SKILL.md 形态的 skill, 而是 npm CLI + slash commands 集合.
install-skill **不能**自动拉, 装法走 npm:

```bash
npm install -g @fission-ai/openspec@latest
cd your-project
openspec init
# 然后跟 AI 说: /opsx:propose <要做的事>
```

支持 25+ AI 编码工具 (Claude Code / Cursor / Cline / ...), 详见 source_url 的 `docs/supported-tools.md`.

## 推荐场景

(本次为 cold-start 推荐, 暂无 case 文件; 用过的人可走 publish-skill 路径 D 加 case)

适用:
- 单轮: 让 AI 先产出 proposal+specs+design+tasks, 再按 tasks 顺序 apply, 避免"prompt 描述需求 → AI 直接写代码"中间缺一层共识
- 多轮 / 跨会话: archive 后规范沉淀进 `openspec/specs/`, 下次给同一模块加功能时 AI 能读到该模块历史规范, 形成长期积累

不适用: 一次性脚本 / throwaway prototype, 没有"未来再改"的预期.

## 同类 Skill 对比

> 由 publish-skill 起草, 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- 暂无

### 外部世界
- [github/spec-kit](https://github.com/github/spec-kit) — Spec-Driven Development 工具包, 通过 `/speckit.constitution → /specify → /plan → /tasks → /implement` 串起 AI 编码流程; **本 skill 区别**: spec-kit 适合 0→1 greenfield 单次拉起; OpenSpec 适合多轮迭代 + 长期维护, archive 机制把每个 change 的规范沉淀到 specs/, 下次再改同一模块 AI 能读到历史规范
- [Kiro](https://kiro.dev) — AWS 出的 agentic IDE, 内置 spec-driven 流程把自然语言转 requirements/design/code; **本 skill 区别**: OpenSpec 不锁 IDE 也不锁模型, 在你现有 Claude Code / Cursor / 任何 25+ 工具里都能跑

### 本 skill 独特价值
- 每 change = 一文件夹 (proposal / specs / design / tasks), archive 后规范沉淀到 specs/
- npm 一行装, slash commands 接入 25+ AI 编码工具, 不锁 IDE 不锁模型
- 单轮 spec 先行执行可控; 多轮模块历史规范跨会话可读
