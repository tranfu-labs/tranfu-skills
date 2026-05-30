# CI 校验细节

这份文件只描述当前 CI / validator 真实会拦的规则. README、`source_url`、prompt 文案质量、`output/` 都不是当前 CI hard gate.

`.github/workflows/build-index.yml`:

- PR: `npm test` → `npm run validate` (changed-only) → `npm run validate:vt` (changed-only) → `npm run build:index`
- main push: `npm test` → `npm run validate:all` → `npm run build:index` → 发布 `catalog` release

## validate-frontmatter

脚本: `scripts/validate-frontmatter.mjs`.

CI 检查:

- `SKILL.md` 必须有 frontmatter block.
- 下列 6 个字段必须存在且非空:
  - `name`
  - `description`
  - `version`
  - `author`
  - `updated_at`
  - `origin`
- `description` 字符数必须 ≤ 1024.

CI **不**检查:

- `name` 是否 kebab-case 或是否等于目录名.
- `version` 是否 semver.
- `origin` 是否只能是 `own` / `external` / `meta`.
- external 是否有 `source_url`.
- README 是否存在.

发布约定仍建议按目录名、semver、`origin` 枚举写, 但不能把这些约定说成 CI blocker.

## validate-cases

脚本: `scripts/validate-cases.mjs`.

CI 只在 skill 目录存在 `cases/` 时检查. 没有 `cases/` = 通过.

允许结构:

```text
cases/
  1/input/PROMPT.md
  1/input/<aux>
  1/output/           # 当前不检查
  2/
  README.md           # ignored
```

会挂的规则:

- `cases.legacy-single-file` — `cases/<author>.md` 旧格式 = ERROR.
- `cases.mixed-legacy-and-new` — legacy `*.md` 和数字目录并存 = ERROR.
- `cases.leading-zero` — `cases/01/` / `cases/02/` = ERROR.
- `cases.missing-input` — 数字 case 缺非空 `input/` = ERROR.
- `cases.missing-prompt-md` — `input/` 存在但缺 `PROMPT.md` = ERROR.
- `cases.unexpected-entry` — `cases/` 下出现非数字目录、非 `README.md`、非 legacy `*.md` 的条目 = ERROR.

CI 不读取 `PROMPT.md` 内容, 不检查真实用户口吻、触发关键词、frontmatter 或字数. 这些只是检索质量建议.

`output/` 校验当前暂停. 不建空 `output/` 更稳; 但缺 `output/` 不是当前 blocker.

## validate-security

脚本: `scripts/validate-security.mjs`.

扫描 skill 目录下所有 `.mjs / .js / .ts / .sh / .py`, 跳过 symlink、`node_modules`、`.git`、大于 1MB 的文件.

| 规则 | 模式 | 允许豁免 |
|---|---|---|
| `security.eval` | `eval(...)` | 无 |
| `security.new-function` | `new Function(...)` / `Function(...)` | 无 |
| `security.child-process-import` | import 或 require `child_process` | `allow_exec: true` |
| `security.curl-pipe-sh` | `curl ... | sh` 或 `wget ... | sh` | `allow_curl_pipe_sh: true` |

加豁免前先判断是否能换成更明确的下载、校验或非 shell 实现.

## validate-virustotal

脚本: `scripts/validate-virustotal.mjs`.

- PR 上 changed-only 跑.
- 没有 `VIRUSTOTAL_API_KEY`、限流、网络异常、超时: warning, 不阻塞.
- zip 超过 32MB: warning, 不阻塞.
- `malicious >= 3`: ERROR, 阻塞.

## build:index

`npm run build:index` 在 PR 上做 sanity check, main push 后发布到 `catalog` release.

不要手动 add / commit `index.json`; CI 负责生成发布产物.

## 本地复跑

单个 skill:

```bash
npm run validate -- --target <skill-path> --json
```

改了 validator 或 workflow 相关逻辑:

```bash
npm test
npm run validate -- --target meta-skills/tranfu-publish --json
```

全量:

```bash
npm run validate:all
```
