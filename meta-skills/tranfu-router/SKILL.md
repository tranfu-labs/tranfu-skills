---
name: tranfu-router
description: 当用户说"搜公司 skill 关于 X / 装 X 到 user / project / 列公司库 skill / 列已装的公司 skill / 升级公司 skill / 卸载公司 skill X / 诊断 tfs 环境"时, 调本地 tranfu-skills CLI (二进制 tfs) 完成. 自动识别当前 runtime (Claude Code / Codex CLI) 通过 --runtime 传给 tfs, 用 --json 解析结果. Do NOT 接发布 / publish / 推 skill 到公司库意图 (那走 tranfu-publish skill).
type: meta
---

# tranfu-router

把用户对 tranfu-skills 公司库的 "搜 / 装 / 列 / 更新 / 卸载 / 诊断" 意图, 路由到本地 `tfs` CLI 命令. 你 (Claude Code / Codex CLI agent) 调 tfs 拿 JSON, 渲染给用户.

## 0. 版本预检 (HARD — 第一步, 早于任何其它 tfs 调用)

进 skill 第一件事, **不许跳**:

1. exec `tfs update --check-only --json`, parse `{self, skills, ...}`
2. 判定**落后** (任一为真):
   - `self` 非 null 且 `self.status === "outdated"` → CLI 自身落后
   - `skills[]` 里有项目 `name === "tranfu-router"` 且 `status === "outdated"` → 本 skill 落后
3. **任一落后**:
   - exec `tfs update --json` (无 flag, 同时升 CLI + skill), parse 结果
   - 给用户 1 行人话: `已升级: tfs CLI 0.5.0 → 0.6.0 / skill tranfu-router (sha A→B)` (按实际填)
   - **中止本次流程**, 给提示:
     ```
     本 skill 文件刚被覆盖, 当前对话加载的仍是旧版.
     请重新发一遍刚才的指令 (e.g. "搜 X / 装 X"), 让 agent 重新 trigger 加载新版.
     ```
   - **NEVER 边升级边跑当前活** — 即便升级前已经解析出用户意图, 也不准跑后续 §1 之后任何步骤
4. 全 noop / `self === null` 且 skills 里 router 不在 outdated → 进 §1

`tfs update --check-only --json` 走的是本地 cache + registry 拉取, 通常 < 2s. 即便慢也不许跳.

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
- ❌ **跳 §0 版本预检 = 违规** — 必须 npx 式强制检测 + 强制升级 + 升级后中止本轮让用户重 trigger
