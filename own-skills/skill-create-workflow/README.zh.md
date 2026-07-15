---
description: "把一段值得复用的经验 / 复盘 / 提示词做成一个新 skill——先过内容准入 / 命名 / 提示词复审三道门, 合格才落盘发布。"
prompt_examples:
  - prompt: 把 docs/postmortem.md 沉淀成一个项目内 skill
    scene: 从文件创建 Skill
  - prompt: 好, 那就做成 skill 吧
    scene: 接着上文创建
  - prompt: 把刚才聊的发布检查清单封装成 skill
    scene: 把想法做成 Skill
---

# skill-create-workflow

把一段值得复用的经验 / 复盘 / 提示词做成一个新 skill——先过内容准入 / 命名 / 提示词复审三道门, 合格才落盘发布。

## 什么时候用它

**新想法首次沉淀**:

我脑子里或项目文档里有一段值得复用的东西 (事故复盘 / 检查清单 / 团队规约 / agent 的系统提示词), 想第一次把它做成 skill, 让未来的自己一句话就能触发。

**接着讨论继续创建**:

上一轮聊天已经在讨论「这段东西是不是值得做成 skill」, 我给一个"好 / 行 / 那就 / 做吧"式的回复, 让流程顺势往下走完创建, 不用再重复贴一遍源材料在哪。

**存量素材转型**:

我有一份现成的 docs 页 / 复盘 / 内部 wiki, 直接指路径丢过去, 想让它包成一个新的 skill 目录 (英文名 / 开头元数据 / 触发场景 / 主流程 / 反例 / 失败路径齐备)。

**建完顺手发布**:

新 skill 落盘后, 我不想手动切分支 / commit / 开 PR, 想让流程自动把它推到公司 skill 库。

**不接**:

给已存在的 skill 做质量审查 / 顺手改 → **skill-improve-workflow**; 只起中英文显示名 → **skill-name-generation**; 只起英文目录名 → **skill-domain-framing**; 只想判「这段够不够格做 skill」不建 → **skill-content-fit**; 装 / 列 / 升级 / 卸载已装 skill → **tranfu-router**。

## 它会产出什么 / 你会看到什么

**默认要过四道门再落盘, 不合格就停在门口, 绝不硬造一个不合格的 skill**——最反常识的一点。

- **内容准入**: 调 `skill-content-fit` 判「这段够不够格做 skill」, 打回则直接停, 不进后续
- **命名与边界**: 调 `skill-domain-framing` 选英文目录名、包含 / 排除范围、放置位置; 前两名分差 < 2 会停下让你二选一
- **落盘 skill 文件**: 调 `skill-creator` (Codex 用系统的, Claude Code 用原生的) 只在 `{owned_skill_directory}` 下写 `SKILL.md` 与 `agents/` 目录
- **提示词复审循环**: 调 `prompt-review` 对每份带提示词的文件做工程质量审, 最多循环 5 轮, 未过就停下问你
- **发布 (非阻塞)**: 调 `tranfu-publish` 上传到公司 skill 库 (git commit / push / 开 PR); 发布失败不回滚已落盘的 skill
- **绝不会做**: 越界改无关 skill / 项目代码 / 你手写的其他文件; 跳过任一道门; 合并你自己的 PR

## 前置条件 / 边界

**前置**:

需要 `skill-content-fit` / `skill-domain-framing` / `skill-creator` / `prompt-review` 四个能力在当前 runtime 可用, 缺任一就报出精确的缺失命令并停止, 绝不擅自装或从网上抓非官方模板。Codex 上「停下问」的路径优先用 `request_user_input` (需要 Plan 模式暴露该工具), 用不了就退化为编号选项的纯文本问题。发布环节还需要 `tranfu-publish` 与可用的 `git` 环境。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 给已有 skill 做质量审查 / 提升 | **skill-improve-workflow** |
| 起中英文显示名 | **skill-name-generation** |
| 起英文目录名与范围边界 | **skill-domain-framing** |
| 只判内容够不够格做 skill | **skill-content-fit** |
| 只发布已建好的 skill | **tranfu-publish** |
| 装 / 列 / 升级 / 卸载已装 skill | **tranfu-router** |

**不接的场景**:

- 装 / 列 / 升级 / 卸载 skill
- 建 plugin
- 改普通项目代码或写非 skill 文档
- 管理定时任务

**微妙边界**:

- 上一轮讨论「这段值不值得做 skill」, 你接一句"好 / 那就做吧" → 触发本 skill, 上文即源材料, 不要求再贴路径
- 代词指代 (「它 / 这段 / 上面那个」) + 产生式动词 → 触发本 skill, 回头解析上下文, 不以"没指定路径"为由拒绝
- 给已有 skill 加某个具体功能 / 改具体行为 → 走本 skill 的 `update` 模式; 想给已有 skill 整体质量审查 → 走 **skill-improve-workflow**
