# Issue / PR 模板 playbook

> github-repo-completeness skill 在 `.github/ISSUE_TEMPLATE/` 或 `pull_request_template.md` 状态为 **MISSING** 时引用本文件.

---

## 1. Issue 模板 — 三类基础

放在 `.github/ISSUE_TEMPLATE/`. 用 GitHub 的 Issue Forms (`.yml`) 比 Markdown 模板体验好, 强制必填.

### 1.1 `bug_report.yml`

```yaml
name: 🐛 Bug Report
description: 报一个 bug
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        提 bug 前请确认: 已搜过 Issues, 没有重复; 已升到最新版.
  - type: textarea
    id: what-happened
    attributes:
      label: 发生了什么
      description: 简述你看到的问题
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: 复现步骤
      placeholder: |
        1. 执行 ...
        2. 点击 ...
        3. 看到 ...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: 期望行为
    validations:
      required: true
  - type: textarea
    id: env
    attributes:
      label: 环境
      placeholder: |
        - OS:
        - Runtime 版本:
        - 项目版本:
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: 相关日志 / 截图
      render: shell
```

### 1.2 `feature_request.yml`

```yaml
name: ✨ Feature Request
description: 提一个新功能
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: 你想解决什么问题
      description: 描述你遇到的实际场景, 不要直接描述方案
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: 你想到的方案 (可选)
      description: 你觉得理想中应该怎么解决
  - type: textarea
    id: alternatives
    attributes:
      label: 你考虑过哪些替代方案
      description: 让我们知道你已经想过 / 试过什么
```

### 1.3 `question.yml`

```yaml
name: ❓ Question
description: 问一个使用问题
labels: ["question"]
body:
  - type: markdown
    attributes:
      value: |
        如果是 "how do I...", 优先翻 README 和 docs.
        Discussions 更适合开放性问题, 这里更适合明确答案的问题.
  - type: textarea
    id: question
    attributes:
      label: 你的问题
    validations:
      required: true
  - type: textarea
    id: context
    attributes:
      label: 你试过什么
```

### 1.4 `config.yml` (推荐)

禁用空白 issue, 引导到 Discussions / 安全邮箱:

```yaml
blank_issues_enabled: false
contact_links:
  - name: 💬 Discussions
    url: https://github.com/{{org}}/{{repo}}/discussions
    about: 开放性问题 / 想法讨论, 用 Discussions 而非 Issue
  - name: 🔒 Security
    url: mailto:{{security-email}}
    about: 安全漏洞**不要**走公开 Issue
```

---

## 2. PR 模板

放在 `.github/pull_request_template.md` (单一) 或 `.github/PULL_REQUEST_TEMPLATE/` 下多个 (用 query param 选).

### 2.1 通用骨架

```markdown
## What

<!-- 这个 PR 改了什么 (动作), 1-2 句 -->

## Why

<!-- 为什么改, 解决什么问题. Link issue: Fixes #123 -->

## How

<!-- 关键实现思路. 复杂改动可放架构图 / 流程说明 -->

## Test plan

- [ ] 本地跑过单元测试
- [ ] 本地跑过 lint / type check
- [ ] 手动验证主路径
- [ ] (若改 UI) 在浏览器跑过, 验证 golden path + 至少一个 edge case

## Breaking change?

- [ ] 否
- [ ] 是 — 说明影响范围 + 迁移方式:

## Checklist

- [ ] 自查通过
- [ ] 文档已更新 (README / CHANGELOG / API docs)
- [ ] 新功能已写测试 / 修 bug 已写复现测试
```

### 2.2 变体提示

- **小团队/内部仓**: 可砍 Breaking change 段 (没外部用户), 但保留 Test plan — 因为它最容易让 reviewer 抓重点
- **公开 OSS**: 必须加 "I have read CONTRIBUTING.md" checkbox; 考虑加 DCO sign-off 提示
- **文档型 repo**: Test plan 改成 "本地预览过 / 链接检查通过 / 拼写检查通过"

---

## 3. 反例 — 不要做的

- Issue 模板写 30 个字段 — 用户填一半就放弃. 必填 ≤ 4 项.
- PR 模板列 15 条 checklist — 流于形式. 7 条以内.
- 用 Markdown issue template 而不是 Issue Forms — 用户可以删掉所有提示, 拿不到结构化信息.
- 没有 `config.yml` 禁用 blank issues — 一半 issue 是空白噪音.
- Security report 引导到公开 Issue — 安全漏洞必须私下报 (邮箱 / GitHub Security Advisories).
- PR 模板里堆 emoji / 装饰横线 — 越简洁 reviewer 越愿意读.

---

## 4. skill 引导话术建议

询问用户 (一次性问完, 不要逐条):

> 我准备建 4 个文件: `bug_report.yml` / `feature_request.yml` / `question.yml` / `pull_request_template.md` + `config.yml`. 你想:
> (a) 全部用默认模板
> (b) 只要 bug + PR 两个 (最小集)
> (c) 自己列要哪些

默认走 (a). 选 (b) 时跳过 feature_request 和 question.

**若用户选了含 `config.yml` 的方案 (a / b / 自定义里包含)**, 必须追问 security 联系入口:

> `config.yml` 里需要填 Security 报告入口 (避免漏洞走公开 Issue). 你想用:
> (i) Security 邮箱 (内部仓常见, e.g. security@yourdomain)
> (ii) GitHub Security Advisories 链接 (公开 OSS 推荐, 自动生成路径 `https://github.com/{{org}}/{{repo}}/security/advisories/new`)
> (iii) 暂不配置 (那 config.yml 里删 Security contact link)

不要无脑用 `mailto:{{security-email}}` 占位填进去 — 占位符进了 repo 就是 bug.
