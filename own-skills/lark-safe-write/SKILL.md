---
name: lark-safe-write
version: 1.1.0
description: "Lark/Feishu wiki 安全写入流程：强制先备份、再写入、后验证，防止覆盖丢失。支持创建新 wiki 节点和更新现有文档内容。当用户需要向飞书知识库写入、更新、覆盖文档时，必须遵循本 skill 的完整流程。"
author: BruceL017
updated_at: 2026-05-12
origin: own
metadata:
  requires:
    bins: ["lark-cli"]
  relatedSkills:
    - "../lark-wiki/SKILL.md"
    - "../lark-doc/SKILL.md"
    - "../lark-shared/SKILL.md"
---

# Lark Safe Write

> **触发时机**：任何需要向 Lark wiki 创建新文档节点、更新现有文档内容或覆盖文档的任务。
> **核心原则**：先解析 token → 再备份 → 再写入 → 最后验证。凡覆盖必备份，写入必验证，验证失败禁止自动重试。

## 同类 Skill 对比

### 公司库内
暂无直接同类。公司库现有 lark-wiki（知识库查询）、lark-doc（云文档管理）等操作 skill，但无「写入安全」专项 skill。

### 外部世界
暂无（未找到公开可验证的 Lark/Feishu wiki 安全写入专项 skill）。

### 本 skill 独特价值
- 唯一强制四步闭环：预检→备份→写入→验证，把覆盖风险消灭在发生前。
- 精准解决 lark-cli 三大坑：wiki_token/obj_token 混淆、`--markdown /path` 路径当内容、异步索引导致验证失败。
- 与现有 lark 生态互补：lark-wiki 查、lark-safe-write 写，形成完整读写链。

## 使用技巧

### 材料方案
- 首次使用该 skill 前，确保 lark-cli 已配置 bot 身份（`lark-cli auth test --as bot` 通过）。
- 写入内容包含链接时，禁用 `<https://...>` 自动链接语法，改用标准 `[文本](https://...)` 语法，避免飞书 docx 不兼容导致内容丢失。

### 推荐用法
- 覆盖现有文档时，skill 会自动备份到 `.backups/`，操作完成后可手动检查备份文件确认无误。
- 验证失败后禁止自动重试，需人工检查原因（常见：异步索引延迟不足、markdown 格式非法）。

### 已知限制
- 仅支持 docx/doc 类型文档，sheet/bitable/slides 等类型会停止并建议转用对应 skill。
- 无法处理需要复杂权限审批的 wiki 空间（如仅特定部门可见），需先在飞书控制台完成审批。

---

## 第一步：预检与 Token 解析（不可跳过）

### 1.1 身份与连通性

- 所有命令必须携带 `--bot` 标志（或 `--as bot`）
- 执行 `lark-cli auth test --as bot` 确认 bot token 有效
- 若失败：暂停执行，提示用户检查 `LARK_APP_ID` / `LARK_APP_SECRET`

### 1.2 解析目标 Token

用户输入可能是 wiki URL 或 wiki_token。

**若用户给的是 wiki URL**：
```
https://xxx.larksuite.com/wiki/WIKITOKEN
```
提取 URL 中 `/wiki/` 后的 token 作为 `wiki_token`。

**若用户直接给的是 token**：
- 以 `wik` 开头 → 这是 `wiki_token`，需要解析
- 以 `dox` / `doc` 开头 → 这是 `obj_token`（真实文档 token），可直接使用

### 1.3 wiki_token → obj_token 解析（关键！不可跳过）

wiki_token **不能直接用于文档读写**。必须先用以下命令解析：

```bash
lark-cli wiki spaces get_node --params '{"token":"<wiki_token>"}' --as bot
```

从返回的 JSON 中提取：
- `node.obj_token` → 这是**真实的文档 token**，后续所有读写操作都用它
- `node.obj_type` → 文档类型（`docx` / `doc` / `sheet` / `bitable` / `slides` 等）
- `node.title` → 文档当前标题

**类型检查**：
- 若 `obj_type` 为 `docx` 或 `doc`：继续执行本文档流程
- 若 `obj_type` 为 `sheet` / `bitable` / `slides` 等：停止执行，向用户说明本 skill 仅支持文档类型，建议转用对应的 skill（如 `lark-sheets`）

### 1.4 权限确认

首次操作该 wiki 空间时，确认 bot 有 `wiki:node:read`、`wiki:node:create`、`drive:drive` 权限。

---

## 第二步：备份（更新/覆盖场景必须执行）

> 仅当文档**已存在**（即用户提供了已有 wiki 的 URL/token）时执行。创建新文档可跳过。

### 2.1 读取现有内容

使用 obj_token（不是 wiki_token）读取文档内容：

```bash
lark-cli docs +fetch --doc <obj_token> --as bot --format json
```

### 2.2 保存备份

```bash
mkdir -p .backups
# 文件名加入时间戳（到秒）+ 随机后缀，防止同一秒内多次操作冲突
# 格式：.backups/YYYYMMDD-HHMMSS-{obj_token}-{RANDOM}.md
```

将 `docs +fetch` 返回的内容保存到上述文件。若 fetch 返回空内容，记录为 "空文档" 并继续。

### 2.3 报告备份

向用户报告：
```
已备份现有内容至：.backups/YYYYMMDD-HHMMSS-{obj_token}.md
```

---

## 第三步：写入

### 3.1 场景 A：创建新 wiki 文档

**前提**：用户要求创建新文档（未提供现有 wiki URL/token，或明确要求新建）。

1. **确定父节点**：获取 `parent_node_token`（用户指定，或询问用户）
2. **准备内容**：确认内容已保存为 markdown 文件 `<content-file>.md`
3. **创建节点**：
   ```bash
   lark-cli wiki +node-create \
     --parent-node-token <parent_node_token> \
     --title "<文档标题>" \
     --obj-type docx \
     --as bot
   ```
4. **记录返回**：保存返回的 `node_token` 和 `obj_token`
5. **写入内容**：
   ```bash
   cat <content-file>.md | lark-cli docs +update \
     --doc <obj_token> \
     --markdown - \
     --mode overwrite \
     --as bot
   ```

### 3.2 场景 B：更新/覆盖现有 wiki 文档

**前提**：用户提供了现有 wiki 的 URL/token。

1. **准备内容**：确认内容已保存为 markdown 文件 `<content-file>.md`
2. **使用 stdin 管道更新**（禁止 `--markdown /path/to/file` 方式，该方式会把文件路径当作文本内容写入）：
   ```bash
   cat <content-file>.md | lark-cli docs +update \
     --doc <obj_token> \
     --markdown - \
     --mode overwrite \
     --as bot
   ```
3. **写入后等待**：飞书文档有异步索引，等待 **3 秒** 后再执行验证

### 3.3 常见写入错误与处理

| 错误 | 原因 | 处理 |
|------|------|------|
| `404 Not Found` | obj_token 错误或文档已删除 | 停止，检查 token 解析步骤 |
| `403 Forbidden` | bot 权限不足 | 停止，提示在 Feishu 控制台补权限 |
| `400 Bad Request` | markdown 格式非法或包含不支持的标签 | 停止，清理内容后重试 |
| 内容为空但 API 返回 200 | stdin 管道未正确传递内容 | 检查 `cat` 命令和管道，重试 |
| 链接丢失 | 使用了 `<https://...>` 自动链接语法，飞书 docx 不兼容 | 改用标准 `[文本](https://...)` 语法 |

---

## 第四步：验证（不可跳过）

### 4.1 重新读取文档

```bash
lark-cli docs +fetch --doc <obj_token> --as bot --format json
```

### 4.2 内容比对

从返回结果中提取文档内容，与预期内容比对以下至少 2 项：

- **标题**是否一致（或符合 `--new-title` 的变更）
- **首段文字**是否包含预期内容
- **关键标记文本**（用户明确提到的特定段落、表格、代码块）是否存在

### 4.3 验证结果

**验证通过**：
```
✅ Lark Safe Write 完成
- 操作类型：创建 / 更新 / 覆盖
- Wiki Token: <wiki_token>
- Obj Token: <obj_token>
- 文档 URL: https://xxx.larksuite.com/wiki/<wiki_token>
- 当前标题: <title>
- 备份路径：.backups/YYYYMMDD-HHMMSS-<obj_token>.md（如适用）
- 验证状态：通过
```

**验证失败**：
```
❌ 验证失败
- 预期内容：<摘要>
- 实际内容：<摘要>
- 备份路径：.backups/YYYYMMDD-HHMMSS-<obj_token>.md
- 可能原因：异步延迟（等待不足）、token 错误、内容被截断
- 下一步：人工检查文档，确认后再决定是否手动恢复备份
```

**禁止行为**：验证失败后，**不得**在未查明原因前自动再次覆盖。

---

## 错误恢复与自我优化

### 写入失败后的恢复

1. **保留备份文件**，不向用户删除
2. **分析失败原因**：检查报错信息、token 正确性、权限状态
3. **若是已知模式**：
   - token 解析错误 → 重新执行 wiki_token → obj_token 解析
   - 权限不足 → 引导用户补权限后重试
   - markdown 格式错误 → 清理内容（移除不支持的 HTML 标签、修复表格语法）后重试
4. **若是未知模式**：记录到 `.backups/.failure-log.md`，包含时间、token、错误信息、尝试的修复步骤

### 验证超时的处理

若验证时飞书返回旧内容（缓存）：
1. 等待额外 5 秒
2. 再次 fetch
3. 若仍不匹配，记录为 "异步延迟"，向用户说明情况，提供备份路径

### 日志记录（建议）

每次操作后追加到 `.backups/.write-log.md`：
```markdown
## 2026-05-09 10:30:00
- 操作: 更新
- wiki_token: xxx
- obj_token: xxx
- 结果: 成功 / 失败
- 失败原因: （如适用）
- 备份: .backups/xxx.md
```

---

## 禁止行为

- ❌ 跳过 wiki_token → obj_token 解析，直接用 wiki_token 读写文档
- ❌ 跳过备份直接覆盖现有文档
- ❌ 跳过验证直接结束任务
- ❌ 验证失败后自动重试覆盖
- ❌ 使用 `--markdown /path/to/file` 方式传递文件路径（必须用 `cat file | ... --markdown -` 或 `--markdown @file`）
- ❌ 使用 `doc` 子命令操作 wiki 页面（wiki 节点操作用 `wiki` 子命令，文档内容操作用 `docs` 子命令）
- ❌ 不检查 `obj_type` 就直接假设是 `docx`
- ❌ 向用户删除或覆盖备份文件
