# CI 校验细节

`.github/workflows/build-index.yml` 跑 3 个 validator. PR 是 changed-only, push main 是全量.

## validate-frontmatter

`scripts/validate-frontmatter.mjs`. SKILL.md 必填 6 字段:

| 字段 | 取值 |
|---|---|
| `name` | kebab-case, 与目录名一致 |
| `description` | ≤ 1024 字符. 写"做什么 + 何时触发 + 不触发"; 不写 body 段 |
| `version` | semver. own 首发 `0.1.0`. external 上游没有就 fallback `1.0.0` (claude-design-system 漏 version 被 #89 修过) |
| `author` | `gh api user -q .login` (own) 或上游作者 (external) |
| `updated_at` | `date -u +%Y-%m-%d` |
| `origin` | `own` / `external` / `meta` 之一 |

description 超长是最常踩的坑. 任一字段缺 = PR 挂.

## validate-cases

`scripts/validate-cases.mjs`. 新格式:

```
cases/
  1/input/PROMPT.md   # 必须存在, 必须非空
  1/input/<aux>       # 选填截图/数据
  1/output/           # 推荐有, 验证暂停 (TODO)
  2/, 3/, ...         # 顺序无要求, gap 允许 (1/3/7 也合法)
  README.md           # ignored
```

挂的规则:

- `cases.legacy-single-file` — `cases/<author>.md` 这种旧文件 = ERROR. 必须迁
- `cases.mixed-legacy-and-new` — 新旧并存 = ERROR
- `cases.leading-zero` — `cases/01/` `cases/02/` = ERROR. 用 `1/` `2/`
- `cases.missing-input` — `cases/<n>/input/` 缺或全是 dotfile = ERROR
- `cases.missing-prompt-md` — `input/` 在但没 `PROMPT.md` = ERROR
- `cases.unexpected-entry` — cases/ 下出现非数字非 README 的目录 = ERROR

`.gitkeep` / `.DS_Store` 等 dotfile 都被忽略.

## validate-security

`scripts/validate-security.mjs`. 扫描 skill 目录下所有 `.mjs / .js / .ts / .sh / .py`. 触发规则:

| 规则 | 模式 | 豁免 frontmatter |
|---|---|---|
| `security.eval` | `eval(...)` | (无, 一律拒) |
| `security.new-function` | `new Function(...)` / `Function(...)` | (无, 一律拒) |
| `security.child-process-import` | import 或 require `child_process` | `allow_exec: true` |
| `security.curl-pipe-sh` | `curl ... \| sh` 或 `wget ... \| sh` | `allow_curl_pipe_sh: true` |

要 exec 系统命令: SKILL.md frontmatter 加 `allow_exec: true`. 要 curl|sh: 加 `allow_curl_pipe_sh: true`. 加豁免前先想想能不能换成 explicit download + checksum verify.

## 本地复跑

```bash
npm run validate -- --target <skill-path> --json
```

PR 挂了的话, Lark + PR comment 会按 validator 分组列错误明细 + 复跑命令. 一行命令本地复现, 修完 push 同分支即可.

## 其他 CI 步骤

- `npm test` — validator 单元测试 (`tests/validate-*.test.mjs`). 改 validator 时跟着改测试
- `npm run validate:vt` — VirusTotal 扫描. 只在 PR 跑, 有 secret 才有效, fork PR / 限流 / 网络异常 soft-fail 不阻断合并. malicious≥3 才挂
- `npm run build:index` — 重建 catalog `index.json`. push main 后发到 `catalog` release. **不要手动 add / commit `index.json`**, CI 处理

## 试运行期发布规则

- `main` 受保护, 走 PR
- 当前 CODEOWNER `@aquarius-wing`
- `1.0.0+` 必须人工审 + commit message 加 `[MAJOR]` 前缀
