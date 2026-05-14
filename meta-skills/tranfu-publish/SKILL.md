---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 起草 PR 内容 (frontmatter / §同类对比 / §使用技巧 / PR title+body), 用户审完拍 y 才走 gh pr create. 不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill).
type: meta
---

# tranfu-publish

把本地写的 skill 发到公司库 (tranfu-labs/tranfu-skills) 走 PR. 起草所有内容 → 用户审 → 用户拍 `y` 才提交.

## 触发判断

接:

| 用户说 | path |
|---|---|
| "发布本地 skill X 到公司库" | **own** 路径: 复制 skill 内容到公司库 `own-skills/<name>/` |
| "推荐这个外部 skill (https://...) 给公司库" | **external** 路径: 公司库 `external-skills/<name>/SKILL.md` 是 stub (frontmatter + source_url + recommend_reason, body 留空) |
| "给公司库 X 加使用案例" | **case** 路径: 改公司库已有 skill 的 SKILL.md / CASES.md (仅追加, 不动 frontmatter) |

**不接** (留给 `tranfu-router`):
- search / install / list / installed / update / uninstall / doctor 意图

## 标准流程

### 1. 识别 path

问用户 (或从原话推断): own / external / case 三选一. 不确定时显式问.

### 2. 检查 / 补全 frontmatter (own / external)

必填:
- `name`: 与目录名一致, kebab-case
- `description`: 含触发关键词 + "Do NOT trigger when" 段 (LLM 路由用), ≥ 2 句
- `origin`: own 或 external

可选:
- `version` / `author` / `updated_at` / `recommend_reason` (external 强烈建议)
- `source_url` (external **必填**)

如缺则起草补全后给用户审.

### 3. 起草 §同类 Skill 对比 (own 必做)

- 内部候选 (≤3): 跑 `tfs list --json` 看公司库现有 skill, 选最相近的列出
- 外部候选 (≤3): web search "<关键词> claude skill / agent" 找外部对标
- 独特价值: 一句话 — 为什么这个值得收, 跟上述 6 个相比有何不同

### 4. 起草 §使用技巧 (3 子段)

- **材料方案**: 用之前 user 该准备什么 (文件 / spec / context / 工具). 列具体 input.
- **推荐用法**: 典型场景 + prompt 模板.
- **已知限制**: 不能做什么 / 边界 / 已知 bug.

### 5. 起草 PR title + body

- title: `skill: 加 <name> (own / external / case)` — ≤ 70 字符
- body 含:
  - ## Motivation: 为什么加 / 业务背景
  - ## §同类对比 摘要
  - ## §使用技巧 摘要
  - ## Test plan: 怎么验装上能跑

### 6. 强制门控 (HARD)

**完整渲染** 给用户看: frontmatter + §同类对比 + §使用技巧 + PR title + body 全部, markdown 形式.

问: "审完了, `y` 走 gh pr create, `n` 中止, 或告诉我哪里改."

只有 `y` 才 exec:
```bash
gh pr create --title "<title>" --body "<body>" \
  --base main --head <new-branch>
```

`n` → 中止, 不动公司库. 修改 → 重审一轮.

## Hard rules

- ❌ 不静默走 gh pr create — 必须用户最后拍 `y`
- ❌ 不直推 main — 走 PR 分支
- ❌ 起草后必须完整 markdown 渲染给用户审 (不能只说"已起草, 我走了")
- ❌ gh 失败 → 报错给用户, 不重试; 不假装成功
- ❌ 不接 router 范围的意图 (search / install 等)

## 常用工具

- `gh pr create` — 提 PR
- `tfs list --json` — 查公司库现有 skill 做同类对比
- `tfs install <name>` — 让用户在自己机器上验自己的 skill (publish 后)
- web search — 找外部 skill 对标
