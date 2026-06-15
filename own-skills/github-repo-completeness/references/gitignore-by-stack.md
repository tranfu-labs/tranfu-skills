# .gitignore playbook

> github-repo-completeness skill 在 `.gitignore` 状态为 **MISSING / WEAK** 时引用本文件.
> 来源参考: [github/gitignore](https://github.com/github/gitignore) 官方模板, 这里做精简 + 跨栈整理.

---

## 0. 必含 (任何项目)

不管栈是什么, 这些都必须有:

```gitignore
# Environment
.env
.env.*
!.env.example

# OS
.DS_Store
Thumbs.db
desktop.ini

# IDE / Editor
.idea/
.vscode/
*.swp
*.swo
*~

# Logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# Local config
*.local
```

**规则**:
- `.env*` 必须忽略, 但 `.env.example` 必须保留 (用 `!` 反规则).
- `.vscode/` 是否忽略有争议 — 团队用统一 VSCode 配置时反而**保留** (放 `.vscode/settings.json` 进 repo, 忽略 `.vscode/launch.json` 之类私人项).
- 不要忽略 `package-lock.json` / `pnpm-lock.yaml` / `Cargo.lock` (库项目 Cargo.lock 例外, 见 Rust 段).

---

## 1. 按栈追加

### Node.js / JavaScript / TypeScript
```gitignore
node_modules/
dist/
build/
.next/
.nuxt/
.svelte-kit/
out/
.cache/
.parcel-cache/
coverage/
*.tsbuildinfo
```

### Python
```gitignore
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
env/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.egg-info/
dist/
build/
.coverage
htmlcov/
```

### Rust
```gitignore
target/
**/*.rs.bk
Cargo.lock     # 仅 library crate 忽略; binary crate 必须提交
```

### Go
```gitignore
bin/
*.exe
*.test
*.out
vendor/        # 用 modules 时忽略, 用 vendoring 时提交
```

### Java / Kotlin (Gradle / Maven)
```gitignore
target/
build/
out/
*.class
*.jar
*.war
.gradle/
gradle-app.setting
!gradle-wrapper.jar
```

### .NET / C#
```gitignore
bin/
obj/
*.user
*.suo
.vs/
```

### Ruby
```gitignore
.bundle/
vendor/bundle/
*.gem
.rspec_status
coverage/
```

### Swift / iOS
```gitignore
.build/
DerivedData/
*.xcodeproj/xcuserdata/
*.xcworkspace/xcuserdata/
Pods/          # 用 SPM 时不需要; 用 CocoaPods 时是否提交看团队
```

---

## 2. 跨栈推断 (skill 用)

按存在文件判断栈, 取并集 (允许重复, 但**必含** + 一个栈 + 必要时多栈):

| 检测文件 | 加段 |
|---|---|
| `package.json` | Node.js |
| `pyproject.toml` / `requirements.txt` / `setup.py` | Python |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pom.xml` / `build.gradle*` | Java/Kotlin |
| `*.csproj` / `*.sln` | .NET |
| `Gemfile` | Ruby |
| `Package.swift` / `*.xcodeproj` | Swift |

**Monorepo / 多栈**: 多 detect 命中就多栈合并. 询问用户是否要拆 workspace-level 的 .gitignore.

---

## 3. 反例 — 不要做的

- 忽略 `package-lock.json` / `pnpm-lock.yaml` / `Cargo.lock` (binary) — 这些必须提交保证可复现构建
- 用 `*` 通配忽略整个 build 目录而忽略掉里面有意义的 keep 文件
- 写 `secrets.json` 一类**项目特定**条目时不解释 — 加注释说明为何忽略
- 假设所有 IDE 都用 — 团队统一 VSCode 时把 `.vscode/settings.json` 提交反而是好事

---

## 4. WEAK 判定 (skill 用)

现有 `.gitignore` 视为 WEAK 的特征:
- 不含 `.env*`
- 不含识别到的主栈的 build/artifact 目录 (e.g. Node 项目无 `node_modules/`)
- 不含 IDE 配置 (`.idea/` / `.vscode/` 至少其一)

命中任一即 WEAK, 应在原文件基础上**追加**缺失段, 不重写.

**追加策略**: 目标是让最终文件同时包含 (第 0 节必含段) + (主栈段). 现有条目全部保留, 新条目按主题分组追加 (Environment / OS / IDE / Logs / 主栈), 重复条目去重. 不要因为现有文件只缺 `.env*` 就只补一条 — 一并补齐 OS / IDE / Logs 等第 0 节遗漏项.
