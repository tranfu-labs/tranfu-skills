# GitHub Actions CI playbook

> project-packaging skill 在 `.github/workflows/` 缺失时引用本文件.

---

## 0. 通用骨架

每个 workflow 都应该有:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ...
```

**要点**:
- `concurrency` 段必须有 — 否则 push 一连串 commit 会跑一堆冗余 CI, 浪费分钟数 + 拖慢反馈.
- `cancel-in-progress: true` 适合 PR; main 分支若用于部署, 改 `false` 防止半部署.
- pin action version 到 `@v4` 或 commit SHA (公开项目推荐 SHA, 防供应链).

---

## 1. 按栈 recipe

### 1.1 Node.js / TypeScript

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'      # 或 'pnpm' / 'yarn'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck    # 如果分开
      - run: npm test
      - run: npm run build
```

**变体**: 用 pnpm 时先 `pnpm/action-setup@v3`, 再 `setup-node` 带 `cache: 'pnpm'`.

### 1.2 Python

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ['3.11', '3.12']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
          cache: 'pip'
      - run: pip install -e .[dev]
      - run: ruff check .
      - run: mypy .
      - run: pytest
```

**变体**: 用 uv / poetry / pdm 时换装包步骤, 其他不变.

### 1.3 Rust

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo test
      - run: cargo build --release
```

### 1.4 Go

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true
      - run: go vet ./...
      - run: go test ./...
      - run: go build ./...
```

### 1.5 多 OS / 多版本 matrix

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: ['18', '20']
```

**慎用**: matrix 维度乘起来 = 跑的 job 数. `os * node` 已经 6 个 job, 别再加. 公开仓 GitHub 给的免费分钟数 macOS 是 Linux 的 10x.

---

## 2. 常见加固

### 2.1 Path filter (谨慎用)

```yaml
on:
  pull_request:
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package.json'
```

**⚠️ 陷阱**: 如果该 workflow 的 check 是 branch ruleset 的 required check, path filter 会让非命中路径的 PR 永远 `BLOCKED`. 修法二选一:
- **简单**: 删 path filter, 让 workflow 总跑. 前提 validate 脚本支持 changed-only mode 且无变更时 exit 0.
- **GitHub 官方**: phantom check pattern — 反向 path 的同名 job always success.

### 2.2 PR 来源安全 (公开仓必看)

外部 fork 提的 PR 拿不到 secrets, 所以涉及 secrets 的步骤 (发布 / 部署 / 评论 PR) 用 `pull_request_target` 而非 `pull_request`. 但 `pull_request_target` 跑在 base 仓库代码上, **不要 checkout PR 代码再跑** — 等于把 token 给了不可信代码.

### 2.3 缓存依赖

绝大多数 setup-* action 都带 `cache:` 参数. 不要自己写 `actions/cache@v4` 拼 key, 用官方 cache 选项更稳.

### 2.4 GITHUB_TOKEN 权限

公开仓默认 permissions 收紧:

```yaml
permissions:
  contents: read   # 默认就够 checkout
```

需要写 (e.g. 自动评论 PR / push tag) 再单独加.

---

## 3. 反例 — 不要做的

- 一个 workflow 塞 6 个 jobs, 一改全跑 — 拆 lint / test / build 多 workflow, 各自 path filter (注意上面陷阱)
- 不 pin action version (`uses: actions/checkout@main`) — 上游一改你 CI 就挂
- secrets 在 fork PR 里能拿到 — 见 2.2
- 跑 `npm install` 而不是 `npm ci` — lockfile 可能被改
- 用 `cron` 跑 CI 但没人看结果 — schedule 触发的 failure 没人收通知, 浪费
- matrix 维度 3+ 让 job 数爆炸 — 公开仓还行, 私有仓烧分钟数
- 没有 `concurrency` 段 — push 5 个 commit = 跑 5 套全 CI

---

## 4. skill 引导话术

skill 询问:

> 检测到 {{stack}} 项目. 建议 CI 流程:
> (a) 完整: lint + type check + test + build (推荐)
> (b) 最小: 只跑 test
> (c) 自定义: 告诉我要哪些步骤
>
> 触发条件默认: push 到 main + 所有 PR. 要改吗?

用户选 (a) 走对应栈的 recipe, 选 (b) 删掉 lint/typecheck/build, 选 (c) 按用户描述拼.

**裁剪原则 — 按项目实际存在的 scripts/工具裁**:

不要无条件套全四步. 先看清单:

- Node: `package.json` 的 `scripts` 里实际有什么 (`lint` / `typecheck` / `test` / `build`)?
- Python: 有没有 `ruff.toml` / `mypy.ini` / `pytest.ini` / `pyproject.toml [tool.*]`?
- Rust / Go: 这俩工具链自带, 一般不会缺.

**实际不存在的 script / 配置直接跳过**, 不要假装 `npm run lint` 然后 CI 红. 缺工具时也别擅自 `npm install -D eslint` — 让用户决定是否引入.

例: monte-carlo-site 的 `package.json` 只有 `dev` / `build` / `preview` / `typecheck`, 套 (a) 完整时 CI 实际只跑 `typecheck` + `build`, lint / test 段省略, 不创造不存在的 script.

---

## 5. 文件命名约定

- 主 CI: `.github/workflows/ci.yml`
- 发布: `.github/workflows/release.yml`
- 定时任务: `.github/workflows/cron-{name}.yml`

一个文件一个职责. 不要起 `main.yml` / `workflow.yml` 这种没信息量的名.
