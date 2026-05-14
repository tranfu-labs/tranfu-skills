---
name: tranfu-router
description: 当用户说"搜公司 skill 关于 X / 装 X 到 user / project / 列公司库 skill / 列已装的公司 skill / 升级公司 skill / 卸载公司 skill X / 诊断 tfs 环境"时, 调本地 tranfu-skills CLI (二进制 tfs) 完成. 自动识别当前 runtime (Claude Code / Codex CLI) 通过 --runtime 传给 tfs, 用 --json 解析结果. Do NOT 接发布 / publish / 推 skill 到公司库意图 (那走 tranfu-publish skill).
type: meta
---

# tranfu-router

把用户对 tranfu-skills 公司库的 "搜 / 装 / 列 / 更新 / 卸载 / 诊断" 意图, 路由到本地 `tfs` CLI 命令. 你 (Claude Code / Codex CLI agent) 调 tfs 拿 JSON, 渲染给用户.

## 触发判断

接:

| 用户说 | 调 |
|---|---|
| "搜公司 skill 关于 X / tranfu-skills 有没有 X" | `tfs search "X" --runtime=<self> --json` |
| "公司库都有什么 skill / 列公司库 / list all" | `tfs list --json` |
| "装公司 skill X / 把 X 装到 user / project" | `tfs install X --scope=user|project --runtime=<self>` |
| "我装了哪些公司 skill / 看本机 installed" | `tfs installed --json` |
| "更新公司 skill / 拉最新 / update" | `tfs update --json` |
| "卸载 X / uninstall X" | `tfs uninstall X --runtime=<self>` |
| "诊断 tfs / 检查环境" | `tfs doctor` |

**不接** (留给 `tranfu-publish` skill):

- "发布本地 skill X / 推 X 到公司库"
- "推荐外部 skill <url> 给公司库"
- "给公司库 skill X 加使用案例"

## 调 CLI 准则

1. **显式 --runtime**: 你知道自己是 Claude Code 还是 Codex CLI, 显式 `--runtime=claude-code` 或 `--runtime=codex` 传, 避免 tfs 检测到双 runtime 时报 `runtime_required`.

2. **用 --json**: 支持 --json 的命令 (`search` / `list` / `installed` / `update`) 加上, parse stdout 拿结构化结果. install / uninstall / doctor 没 --json, 看成功的 stdout marker (✓) + 失败的 stderr JSON.

3. **错误解析**: exit code 非 0 → stderr 永远是 JSON `{error, message, hint, exit_code}`. parse 后把 `message` + `hint` 渲染给用户, 别原样吐 JSON 给用户看.

4. **scope 默认 user**: 用户不指定时默认 `--scope=user`. 仅当用户明说 "装到 project / 这个仓库" 才用 `--scope=project`.

## 示例对话

> User: "搜公司 skill 关于 auth"
> exec `tfs search auth --runtime=claude-code --json`
> → parse {results: [...], total: N}
> → 渲染 "找到 N 个: 1. auth-helper — OAuth2 ..."

> User: "装第 2 个"
> 记住上轮 search 第 2 个的 name, exec `tfs install <name> --runtime=claude-code`
> → exit 0 + stdout "✓ installed ..." 则渲染成功 + 提示重启 CLI

> User: "我装了哪些?"
> exec `tfs installed --json` → parse → 渲染表

## Hard rules

- ❌ 不要自己解析 search / list 输出的文本 — 用 --json
- ❌ 不要原样把 stderr JSON 给用户看 — parse + 渲染人话
- ❌ 不要静默吞错误 — 失败时把 hint 字段告诉用户
- ❌ 不接发布意图 — 那是 tranfu-publish 的事
