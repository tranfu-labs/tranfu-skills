# Lark Safe Write

Lark/Feishu wiki 安全写入流程 Skill。强制遵循「先备份、再写入、后验证」四步闭环，防止 wiki 文档被意外覆盖或写入失败导致数据丢失。

## 什么时候用它

- 需要向飞书知识库创建新 wiki 文档节点
- 需要更新或覆盖现有 wiki 文档内容
- 担心直接写入会导致原有内容丢失
- 需要确保写入后的内容与预期一致

## 怎么用 (触发示例)

跟 Claude 说:
- "用 lark-safe-write 安全写入流程更新这个 wiki"
- "向飞书知识库写入内容，先备份再验证"
- "帮我创建一个新的飞书 wiki 文档"
- "覆盖这个 wiki 页面，记得先备份"

## 你会看到什么

- 预检结果：bot 权限、token 解析、文档类型检查
- 备份路径：`.backups/YYYYMMDD-HHMMSS-{token}.md`
- 写入结果：成功/失败状态、文档 URL
- 验证报告：标题/首段/关键标记比对结果

> [English Version](README.en.md)

---

## 解决的问题

在使用 lark-cli 向飞书知识库写入内容时，你可能遇到过这些问题：

- **文档被覆盖**：直接用 `update` 命令写入，误删了原有内容且无法恢复
- **写入失败却以为成功**：API 返回 200，但实际内容并未更新
- **路径被当内容写入**：用 `--markdown /path/to/file.md` 方式传递文件路径，结果文档里出现的是路径字符串而非文件内容
- **权限不足反复试错**：没有预检 bot 权限，导致多次调用失败后才发现是权限问题

这个 Skill 通过强制流程约束，把以上问题消灭在发生之前。

---

## 安装

### Claude Code

```bash
# 1. 克隆到本地 skills 目录
git clone https://github.com/duo-lark/lark-safe-write.git ~/.claude/skills/lark-safe-write

# 2. 触发 Skill
/lark-safe-write
```

### OpenAI Codex

```bash
# 1. 克隆到 Codex skills 目录
git clone https://github.com/duo-lark/lark-safe-write.git ~/.agents/skills/lark-safe-write

# 2. 重启 Codex 以加载新 Skill
# 3. 触发方式：在对话中提及 skill 名称，或引用 $lark-safe-write
使用 lark-safe-write 更新飞书文档
```

### OpenClaw

```bash
# 1. 克隆到 OpenClaw skills 目录
git clone https://github.com/duo-lark/lark-safe-write.git ~/.openclaw/skills/lark-safe-write

# 2. 触发方式：在任务或对话中引用 skill 名称
请使用 lark-safe-write 流程写入 wiki
```

### Hermess

```bash
# 1. 克隆到 Hermess skills 目录
git clone https://github.com/duo-lark/lark-safe-write.git ~/.hermes/skills/lark-safe-write

# 2. 触发方式：在对话中直接请求
用 lark-safe-write 安全写入流程处理这个 wiki 更新
```

### Claude Chat / Claude CoWork

将 `SKILL.md` 文件直接上传到对话中即可使用。

---

## 核心流程

```
预检 → 备份 → 写入 → 验证
```

### 1. 预检（不可跳过）

- 确认 `--bot` 身份标志
- 执行 `lark-cli auth test` 验证 token 有效性
- 解析 wiki_token / node_token
- 首次操作该空间时，确认 bot 有访问权限

### 2. 备份（更新/覆盖时必须）

- 读取现有文档完整内容
- 保存到 `.backups/YYYYMMDD-HHMMSS-{token}.md`
- 向用户报告备份路径

### 3. 写入

- **创建新文档**：确定 `parent_node_token`，使用 `lark-cli wiki +node-create`
- **更新现有文档**：使用 **stdin 管道**方式写入（禁止 `--markdown /path`）
- 写入后等待 2 秒（飞书异步索引延迟）

### 4. 验证（不可跳过）

- 重新读取文档
- 比对标题、首段、关键标记
- 明确返回验证结果和文档 URL

---

## 错误处理策略

| 错误场景 | 处理方式 |
|---------|---------|
| `auth test` 失败 | 暂停执行，提示检查环境变量和 bot 权限 |
| 备份读取失败（文档不存在） | 按「创建新文档」流程继续 |
| 备份读取失败（权限不足） | 停止执行，提示在 Feishu 控制台补权限 |
| 写入失败（4xx/5xx） | 停止执行，保留备份，不执行验证 |
| 验证失败（内容不匹配） | 停止执行，保留备份，不自动重试覆盖 |

---

## 依赖

- [lark-cli](https://open.larksuite.com/document/mcp_open_tools/feishu-cli-let-ai-actually-do-your-work-in-feishu) — 已配置 bot 身份和权限

---

## 许可

MIT License
