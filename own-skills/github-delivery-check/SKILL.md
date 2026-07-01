---
name: github-delivery-check
description: 'Use when the user asks to push a product project to GitHub, create a GitHub repository, prepare a deployable project, complete README deployment instructions, or hand off deployment details to engineers. Also trigger for Chinese requests like "推到 GitHub", "创建 GitHub 仓库", "首次提交", "整理成可部署项目", or "用 GitHub交付规范 Skill". Do NOT trigger when the user only wants ordinary code changes, code review, production deployment without GitHub delivery, or discussion-only planning; route those to the coding, review, deploy, or normal discussion workflow.'
version: 0.1.3
author: 06666666
updated_at: 2026-07-01
origin: own
---

# GitHub Delivery Check

Target type: product project repository with code, README, config examples, and deployment files. Do not use this skill for prompts, other skills, agent definitions, docs-only assets, or product copy alone.

Prepare a product project for GitHub delivery so another teammate can understand, configure, deploy, and verify it.

Default action: inspect the project, fix delivery docs, verify locally, and push directly to the GitHub main branch. MUST stop only when GitHub authorization is missing, real secret risk exists, required product facts are missing, required verification fails, Git state is unsafe, or the user requested discussion-only mode.

## When To Use

Use this skill when the user wants to:

- push a product project to GitHub
- create a new GitHub repository
- update an existing GitHub repository
- make a project deployable from README
- hand deployment configuration to engineers

Also match Chinese requests:

- "推到 GitHub"
- "创建 GitHub 仓库"
- "这个产品首次提交"
- "整理成可部署项目"
- "用 GitHub交付规范 Skill"

Do NOT use this skill when:

- the user only wants ordinary code changes -> use normal coding workflow
- the user asks for code review -> use review workflow
- the user asks to deploy production without GitHub delivery -> use deploy workflow
- the user explicitly says discussion-only or planning-only -> discuss only and do not push

If intent is ambiguous, ask one confirmation question before doing delivery work:

```text
Do you want me to push this project to GitHub main, update an existing repository, or only prepare/check the README without pushing?
```

## Non-Negotiables

- MUST inspect the actual project files before asking the user to classify the project.
- MUST verify locally with real commands when the project has runnable commands.
- MUST complete README deployment instructions before pushing.
- MUST push to main by default when delivery is safe and authorized.
- NEVER say GitHub push means production is deployed.
- NEVER say local build success means production is live.
- NEVER invent GitHub authorization codes, repository URLs, or production URLs.
- NEVER commit `.env`, private keys, database files, dependency directories, build caches, or local-only config with real values.

## Secret Boundary

Real keys, tokens, passwords, cookies, and private keys may exist in:

- local `.env` files that are ignored and not staged
- local ignored config files
- server-side environment variables

Real secrets must not appear in:

- GitHub commits, PRs, issues, or repository files
- README or `.env.example`
- screenshots
- final replies or the GitHub Delivery Card

If engineers need deployment secrets, list only variable names, target location, and placeholder examples in the final card. Say that real values must be provided through a private channel.

```text
WRONG:
  README.md contains ACCESS_TOKEN=ghp_real_token_value

Reason: README is committed to GitHub, so a real token there becomes a repository secret leak.

GOOD:
  .env.example contains ACCESS_TOKEN=Bearer <provided-privately>
  GitHub Delivery Card says: set ACCESS_TOKEN in server environment variables.
```

## Internal Notes

Keep only a short internal checklist while executing:

- project type and deployment shape
- Git state and target branch
- first-push product metadata, when needed
- secret check result
- README deployment-doc result
- local verification commands and results
- GitHub authorization and push result
- deployment config fields for the final card

Do not print a large schema or audit ledger to the user.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Inspect project and Git state.
2. Complete first-push product metadata when needed.
3. Verify GitHub authorization.
4. Run pre-push safety checks.
5. Complete README deployment instructions.
6. Run local verification.
7. Push to GitHub main branch.
8. Produce the GitHub Delivery Card.

Done means:

- project type and Git state are known, or the final card explains the blocker
- first-push product metadata is complete when there is no existing GitHub remote
- GitHub authorization is confirmed, or the final conclusion is `未推送：待 GitHub 授权`
- README.md exists and explains setup, configuration, deployment, and verification
- no real secret will be pushed to GitHub
- required local verification passed, was fixed and re-run, or is clearly not applicable
- GitHub has been pushed to main, or the final card gives a precise non-push reason

## Step 1: Inspect Project And Git State

1. Verify the target directory exists and is readable. If not, stop with `未推送：需先修复`.
2. Verify `git` is available. If not, stop with `未推送：需先修复`.
3. Inspect files before asking the user about project type.
4. Classify project type:
   - Frontend: Vite, Next.js, React, Vue, Astro, Svelte, static build scripts, or static assets.
   - Backend: server entrypoint, routes, API framework, port config, database config, or service start command.
   - Full-stack: UI and API in one repository.
   - Docker: `Dockerfile`, `docker-compose.yml`, or `compose.yml`.
   - Static site: HTML/CSS/JS or generated static assets.
   - Server deployment: env vars, long-running service, database, reverse proxy, daemon, or container runtime.
5. Classify Git state:
   - existing Git remote -> update existing repository
   - Git repository without remote -> first GitHub push
   - not a Git repository -> initialize Git, then first GitHub push
6. If project type or Git state cannot be determined, ask at most three focused questions and stop.

## Step 2: Complete First-Push Product Metadata

Skip this step when the project already has a GitHub remote.

For first GitHub push, resolve:

- Chinese product name
- English product name
- product summary
- repository name
- production URL
- GitHub owner

Repository naming rules:

- Use lowercase English letters, digits, and hyphens.
- Default suffix is `-app`, for example `tranfu-app`.
- NEVER use spaces, underscores, Chinese characters, or uppercase letters.

```text
WRONG:
  TranFu_App

Reason: Uses uppercase and underscore; repository names must use lowercase letters, digits, and hyphens.

GOOD:
  tranfu-app
```

Production URL rule:

- Default format is `https://{repo-name}.tranfu.com/`.
- Example: `tranfu-app` -> `https://tranfu-app.tranfu.com/`.

If required metadata is incomplete, final conclusion is `未推送：需先修复`.

## Step 3: Verify GitHub Authorization

1. Verify `gh` CLI exists. If another authenticated GitHub tool is available, use it.
2. If neither `gh` nor another GitHub tool exists, stop with `未推送：待 GitHub 授权`.
3. If `gh` exists, run:

```bash
gh auth status
```

4. If authorization is missing, start a web/device flow such as:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

5. Give the user the real link and one-time code printed by the command.

```text
WRONG:
  输入授权码：ABCD-1234

Reason: The agent invented a code.

GOOD:
  输入授权码：<code printed by gh auth login --web>
```

## Step 4: Run Pre-Push Safety Checks

Before pushing:

1. Scan tracked and staged files for real or suspected secrets.
2. Scan hidden files too, but exclude `.git`, dependency directories, and generated build output.
3. If a local `.env` exists, verify it is ignored and not staged. Do not quote its values.
4. If `.env.example` or equivalent config example is needed and missing, create it with placeholders only.
5. If `.env`, local config, database files, dependency folders, or build caches are staged, unstage/remove them and update ignore rules.
6. If README.md is missing or lacks deployment instructions, run Step 5 and return here.
7. If ports, commands, env vars, or deployment notes conflict, fix README/config consistency and return here.
8. If no runnable verification exists for a runtime project, stop with `未推送：需先修复`.

Secret handling:

- If a real secret is only in a local ignored `.env` or ignored local config file, that is allowed.
- If a real secret is in a tracked file, remove it, replace with a placeholder, update ignore rules, and re-scan.
- If a real secret is already in Git history, stop with `暂不建议推送`; clean history or rotate the secret first.
- NEVER quote real secret values in the final reply.

## Step 5: Complete README Deployment Instructions

README.md must tell the next engineer:

- what the product is
- how to install dependencies
- how to run locally
- how to build
- which environment variables are needed
- which port or endpoint to use
- how to deploy
- target production URL
- how to verify the app is healthy
- common failure points, when obvious

Environment variable rules:

- README and `.env.example` use placeholders only.
- Real values may be used only in local ignored `.env` files or server environment variables.
- If engineers must configure server env vars, list variable names and target location in the final card.

```bash
API_BASE_URL=https://api.example.com
ACCESS_TOKEN=Bearer <provided-privately>
```

## Step 6: Run Local Verification

Run real commands. Do not rely on static inspection only.

Use the project shape to choose checks:

- Node project -> infer package manager from lockfile; run install if needed; run build, tests, or lint when scripts exist.
- Web project -> start the local server when a start command exists; check HTTP 200 or rendered page when tools are available.
- API project -> start the service and request a health endpoint or representative route when one can be inferred.
- Docker project -> run docker build or compose startup when Docker files exist and Docker is available.
- Static site -> serve locally or check static assets exist.

If verification fails, fix the issue and re-run the failing check.

Only mark verification blocked when it depends on external accounts, paid services, production secrets, unavailable local runtime, missing commands that cannot be safely created, or third-party permissions.

If no local verification can run:

- runtime project with no runnable verification -> `未推送：需先修复`
- static/docs-only delivery with no runtime -> mark verification not applicable and continue

## Step 7: Push To GitHub

Before pushing:

1. Verify first-push metadata is complete when there is no existing remote.
2. Verify required local checks passed or are not applicable.
3. Verify target owner/repo is known.
4. For first push, check whether `owner/repo` already exists.
   - If it belongs to this project -> treat as existing repository.
   - If it may be a different project -> stop with `未推送：需先修复` and ask for confirmation.
   - If it does not exist -> create it.

Default branch behavior:

- Existing repository -> use existing default/main branch.
- New repository -> use `main`.
- Default action -> push directly to main branch.

Do not create a PR by default. Use a PR only when:

- branch protection blocks direct push
- GitHub permission blocks direct push
- the repository is not directly maintained by the user/team
- the user explicitly requests a PR

Existing repository procedure:

1. Confirm remote and current branch.
2. Check remote state to avoid overwriting teammate changes.
3. If remote diverges, pull/rebase only when safe; otherwise stop with `未推送：需先修复`.
4. Commit delivery changes.
5. Push to main branch.

First push procedure:

1. Initialize Git when needed.
2. Create the GitHub repository after repo-existence check passes.
3. Add remote.
4. Commit intended delivery files.
5. Push to main branch.

Create a tag or release only when the project needs a downloadable/deployable version artifact. Do not create releases by default.

## Step 8: Produce GitHub Delivery Card

Output a short Chinese card. The conclusion must be exactly one of:

- `已推送完成`
- `未推送：待 GitHub 授权`
- `未推送：需先修复`
- `暂不建议推送`

Success shape:

```text
交付结论：已推送完成

项目：产品中文名 / ProductName
仓库：owner/repo
主分支：main
生产链接：https://repo.tranfu.com/

本地验证：通过
README 部署说明：已补齐
安全检查：未发现会提交到 GitHub 的密钥
GitHub 状态：已推送到主分支

部署配置：
- SERVER_API_BASE_URL：配置到服务器环境变量，例如 https://api.example.com
- SERVER_ACCESS_TOKEN：配置到服务器环境变量，真实值由负责人私下提供

注意：
- 真实密钥可以放在本地未提交的 .env 或服务器环境变量里。
- 真实密钥不能写进前端代码、GitHub、README、PR、截图或最终回复。

下一步：
技术按部署配置补环境变量，拿到私下提供的真实值后部署。
```

If no additional engineer config is needed, write `部署配置：无额外配置`.

Blocked shapes:

```text
交付结论：未推送：待 GitHub 授权

阻塞原因：当前环境还没有 GitHub 授权。
下一步：打开授权链接并输入本次命令生成的一次性授权码。
```

```text
交付结论：未推送：需先修复

阻塞原因：本地验证没有可执行命令或验证失败。
下一步：补齐启动/构建/测试命令后重新运行本 Skill。
```

```text
交付结论：暂不建议推送

阻塞原因：真实密钥已经进入 Git 历史。
下一步：先清理历史或更换密钥，再重新检查。
```
