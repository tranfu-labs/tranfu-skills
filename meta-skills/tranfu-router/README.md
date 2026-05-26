# tranfu-router

公司 skill 库的"调度入口" meta-skill — 把用户"搜 / 装 / 列 / 更新 / 卸载 / 诊断"意图路由到本地 `tfs` CLI 命令, parse `--json` 渲染给用户。

## 同类对比

| 同类 / 类似 | 区别 |
|---|---|
| `tranfu-publish` (公司库另一个 meta-skill) | publish 只接"发布 / 推 skill 上库"意图; router 只接"搜 / 装 / 列 / 更新 / 卸载 / 诊断"意图。两者意图边界互斥。 |
| 手动 `tfs` CLI | 用户直接敲 `tfs search/install/...` 也行; router 的价值是让自然语言意图无脑落到正确 CLI 命令 + 自动带 `--runtime` + parse JSON 渲染人话, 不让 AI agent 自己造命令。 |
| 通用 shell 调度 skill | 那种 skill 不绑特定 CLI; router 专门对接 `tfs` 协议 (`--runtime` / `--json` / 错误 JSON schema), 准确度高。 |

## 价值 (when to use)

**触发**: 用户说 "公司库有没有 X / 装 X / 我装了哪些 / 升级公司 skill / 卸载 X / 诊断 tfs"。
**不触发**: 用户说"发布 / 推 skill 上库 / 给公司 skill 加 case" → 走 `tranfu-publish`, router 不接。

进入 skill 第一步强制跑 `tfs update --check-only --json` 自我版本预检 (§0), CLI 或 skill 任一落后就强制升级 + 中止本轮, 防止过期 router 跑错命令。

## 使用技巧

- **显式 `--runtime`**: AI agent 应该清楚自己是 Claude Code 还是 Codex, 调命令时显式传 `--runtime=claude-code` 或 `--runtime=codex`, 不要让 `tfs` 自己探测。
- **永远 `--json`**: search / list / installed / update 都支持 `--json`, 拿结构化结果 parse, 不要 grep stdout。
- **scope 默认 user**: 用户没说装到哪就 `--scope=user`; 仅 "装到这个仓库 / project" 才 `--scope=project`。
- **错误渲染**: `tfs` 非 0 退出时 stderr 是 JSON `{error, message, hint, exit_code}`, parse 后把 message + hint 给用户看人话, 不原样吐 JSON。

## 输入与输出

**输入**: 用户自然语言意图 (中英都行)。例: "搜 auth 相关的 skill" / "装第 2 个到 user" / "我装了哪些公司 skill?"

**预期输出**:
- exec `tfs <cmd> --runtime=<self> --json`, parse stdout
- 渲染给用户的: "找到 N 个: 1. xxx — 描述..." / "✓ 已装 X 到 ~/.claude/skills/" 等人话
- 失败时: "装失败: <message>。建议: <hint>"

详例见 SKILL.md §"示例对话"。

## 已知限制 / 不适用

- 不接 publish 意图 (`发布 / 推 X 上库 / 加 case` 都不接, 那是 `tranfu-publish`)
- 依赖本地装了 `tfs` CLI (`npm i -g tranfu-skills`); 未装直接挂, 让用户先装
- 不缓存 search 结果跨对话; 每轮用户问"装第 N 个"需要 router 记住上轮 search 的 name, 否则要求用户复述
- `tfs doctor` 没 `--json`, 文本输出原样转给用户
