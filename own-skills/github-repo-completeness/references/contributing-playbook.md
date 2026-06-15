# CONTRIBUTING playbook

> project-packaging skill 在 `CONTRIBUTING.md` 状态为 **MISSING / WEAK** 时引用本文件.

---

## 1. 结构 (按需启用)

| 节 | 作用 | 可省条件 |
|---|---|---|
| 欢迎 / 范围声明 | 说明欢迎哪些贡献 (bug / feature / 文档) | 内部仓可省 |
| 行为准则 link | 指向 `CODE_OF_CONDUCT.md` | 内部仓可省 |
| 开发环境搭建 | 一行 clone + install + run | ⛔ 永留 |
| 项目结构速览 | 目录/模块职责简表 | 单文件项目可省 |
| 分支策略 | trunk-based / git flow / 其他 | ⛔ 永留 |
| Commit 规范 | Conventional Commits / 自定义 / 自由 | ⛔ 永留 |
| PR 流程 | 谁审 / 几人通过 / CI 必过 / squash vs merge | ⛔ 永留 |
| 代码风格 / lint | 引用 `.editorconfig` / lint config | 已用工具自动化可省 |
| 测试要求 | 新功能必带测试? coverage 门槛? | 没测试体系时省 |
| 文档要求 | 改 API 是否要改 docs? CHANGELOG 由谁加? | 无外部文档时省 |
| 发布流程 | 谁发版 / 怎么打 tag | 仅 maintainer 关心, 一般独立 `RELEASING.md` |

---

## 2. 关键选择题 (skill 必问)

补 CONTRIBUTING 前 skill **必须问**:

1. **Commit 规范**: Conventional Commits (`feat:` / `fix:` / `chore:` …) / 自定义前缀 / 自由?
2. **分支策略**: Trunk-based (PR → main) / Git Flow (`develop` + `release/*` + `hotfix/*`) / 其他?
3. **审查要求**: 至少几人 approve? CODEOWNERS 强制?
4. **Squash vs Merge**: PR 合并方式?
5. **DCO / CLA**: 是否需要 sign-off 或 CLA 签署? (公开项目常见, 内部仓通常不需要)

用户无主张 → 用默认: Conventional Commits + Trunk-based + 1 approver + Squash + 无 DCO.

---

## 3. 通用模板 (可裁剪)

```markdown
# Contributing to {{project}}

感谢愿意贡献! 在动手前请花 2 分钟读完本文.

## 开发环境

```bash
git clone {{repo-url}}
cd {{project}}
{{install-cmd}}    # e.g. npm install / cargo build / pip install -e .
{{run-cmd}}        # e.g. npm run dev
```

## 分支策略

我们采用 **trunk-based development**:
- 所有功能从 `main` 拉分支, e.g. `feat/xxx` / `fix/xxx` / `docs/xxx`
- PR 合并回 `main`, 不维护长期 `develop` 分支
- 紧急修复同样走 PR, 不直接 push `main`

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: 新增 X 功能`
- `fix: 修复 Y bug`
- `docs: 更新 README`
- `refactor: 重构 Z 模块`
- `chore: 升级依赖`
- `test: 补 X 测试`

## PR 流程

1. Fork (外部贡献者) 或拉分支 (维护者)
2. 改完跑本地 lint + test: `{{lint-cmd}}` / `{{test-cmd}}`
3. 提 PR, 描述清楚: 解决什么问题 / 怎么验证
4. 等 CI 全绿 + 至少 **1 个 reviewer** approve
5. **Squash merge** (合并时 PR title 即 commit message)

## 代码风格

跟随 `.editorconfig` + 项目 lint 配置. 提交前跑 `{{format-cmd}}` 自动 fix.

## 测试

- 新功能必须带测试
- 修 bug 优先写**复现测试**, 再修代码
- 跑全部测试: `{{test-cmd}}`

## 报 bug / 提需求

走 Issue 模板, 不要邮件或私聊 — 公开讨论便于检索.
```

---

## 4. 变体

### 4.1 内部仓变体 (删什么)
- 删 "Fork" 段, 内部都是直接拉分支
- 删 DCO / CLA
- 加 "联系人" 段 (Slack channel / 内部维护者)
- 行为准则一般用公司全局, 不必单独 link

### 4.2 公开 OSS 变体 (加什么)
- 加 行为准则 link (强制)
- 加 issue triage 时间承诺 (e.g. "1 周内回复") 或明确说"best effort"
- 加 first-time contributor 友好提示 ("good first issue" label 等)
- 考虑加 DCO sign-off (`git commit -s`)

### 4.3 文档型 repo 变体
- "开发环境" 替换为 "本地预览" (mkdocs serve / docusaurus start)
- "测试" 替换为 "链接 / 拼写检查"
- 加 翻译贡献流程 (如果多语言)

---

## 5. 反例 — 不要做的

- 写 "感谢你的兴趣, 请遵守开源精神" 一堆套话, 不给具体动作
- 列 10+ 条规则不分主次 — 用必/建议/可选三级
- 写"任何贡献都欢迎"但没说怎么贡献 — 等于没写
- Commit 规范只列名字不给例子 — 必须给 4-6 个真实例子
- 提"PR 流程"但不说审批人 / 通过条件 — 让贡献者猜
