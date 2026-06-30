---
name: github-delivery-check
description: 'Use when the user asks to push a product project to GitHub, create a GitHub repository, prepare a deployable project, complete README deployment instructions, or hand off deployment details to engineers. Also trigger for Chinese requests like "推到 GitHub", "创建 GitHub 仓库", "首次提交", "整理成可部署项目", or "用 GitHub交付规范 Skill". Do NOT trigger when the user only wants ordinary code changes, code review, production deployment without GitHub delivery, or discussion-only planning; route those to the coding, review, deploy, or normal discussion workflow.'
version: 0.1.1
author: 06666666
updated_at: 2026-06-29
origin: own
---

# GitHub Delivery Check

Prepare a product project for GitHub delivery so another teammate can understand, configure, deploy, and verify it.

This is an execution workflow. Default to inspecting, fixing documentation, verifying locally, and pushing to the GitHub main branch. Stop only for GitHub authorization, real secret risk, missing product facts, or user-requested discussion-only mode.

## When to use

Use this skill when the user wants a product project delivered through GitHub, including:

- Push a product project to GitHub.
- Create a new GitHub repository.
- Make a project deployable from its README.
- Update an existing GitHub repository.
- Hand deployment configuration to engineers.

Also match Chinese requests:

- "推到 GitHub"
- "创建 GitHub 仓库"
- "这个产品首次提交"
- "整理成可部署项目"
- "用 GitHub交付规范 Skill"

Do NOT use this skill when:

- The user only wants ordinary code changes -> use the normal coding workflow.
- The user asks for code review -> use the review workflow.
- The user asks to deploy to production without GitHub delivery -> use the deploy workflow.
- The user explicitly says discussion-only or planning-only -> stay in normal conversation and do not push.

## Ownership

Default ownership is `edit file + run verification + push GitHub`.

MUST edit project files when README, env examples, gitignore, or delivery metadata are missing and the fix is local to the target project.

MUST NOT push if the user asked for discussion-only mode, GitHub authorization is missing, real secrets are present, or local verification fails in a way that cannot be fixed in the current environment.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Inspect project and Git state.
2. Complete first-push product metadata when needed.
3. Verify GitHub authorization.
4. Run pre-push checks.
5. Complete README deployment instructions.
6. Run local verification.
7. Push to GitHub main branch.
8. Produce the final delivery card.

Done means:

- Project type and GitHub state are classified.
- First-push product metadata is resolved when the project has no GitHub remote.
- GitHub authorization is confirmed or the final card blocks on authorization.
- Pre-push checks have no unresolved blockers.
- README.md contains deployment instructions.
- Real secrets are not being committed.
- Install, build, test, and local start checks have been run when available.
- Web projects have been opened locally when possible; API projects have a representative request; Docker projects have a container start/build attempt.
- GitHub has been pushed to the main branch, or the final card gives a precise non-push reason.

## Step 1: Inspect Project And Git State

Task: Identify project type, deployment shape, and repository state before asking the user.

Input: Current project directory, file tree, Git status, README, env examples, package files, deployment files.

Output: Project classification and delivery path.

MUST inspect files before asking the user about project type.

Classify project type:

- Frontend: `package.json`, Vite, Next.js, React, Vue, Astro, Svelte, static build scripts, or static assets.
- Backend: server entrypoint, route definitions, API framework, port config, database config, or service start command.
- Full-stack: both UI and API surfaces in one repository.
- Docker: `Dockerfile`, `docker-compose.yml`, or `compose.yml`.
- Static site: HTML/CSS/JS or build output that can be served statically.
- Server deployment: env vars, long-running service, database, reverse proxy, daemon, or container runtime.

Classify Git state:

- Existing Git remote -> update existing repository.
- Git repository without remote -> first GitHub push.
- Not a Git repository -> initialize Git, then first GitHub push.

Failure exit: if the directory has no recognizable project files, ask at most three key questions and stop this run.

## Step 2: Complete First-Push Product Metadata

Task: Collect only the product facts that cannot be inferred from code.

Input: Project inspection result, user-provided facts, existing README, existing package metadata.

Output: Product metadata for README, GitHub repository, and final delivery card.

Dispatch by Git state from Step 1:

- Existing Git remote -> skip first-push metadata collection and continue to Step 3.
- Git repository without remote -> continue this step.
- Not a Git repository -> continue this step.
- Otherwise -> report BLOCKER `unknown Git state` and stop this run.

For first GitHub push, MUST resolve:

- Chinese product name.
- English product name.
- Product summary.
- Repository name.
- Production URL.

Repository naming rules:

- Use lowercase English letters, digits, and hyphens.
- Default suffix is `-app`, for example `tranfu-app`.
- NEVER use spaces, underscores, Chinese characters, or uppercase letters.

```text
WRONG:
  TranFu_App
Reason: Uses uppercase and underscore, so it is not a deployable repo-name default.
GOOD:
  tranfu-app
```

Production URL rule:

- Default format is `https://{repo-name}.tranfu.com/`.
- Example: `tranfu-app` -> `https://tranfu-app.tranfu.com/`.

GitHub owner resolution:

1. Use existing Git remote owner when present.
2. Use explicit team or user context when present.
3. Ask once if owner cannot be inferred.

## Step 3: Verify GitHub Authorization

Task: Confirm that the current environment can create or push GitHub repositories.

Input: GitHub CLI state or available GitHub tool state.

Output: Authorized state, or exact user authorization instructions.

If GitHub CLI is available, run:

```bash
gh auth status
```

If authorization is missing, start a web/device authorization flow such as:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

MUST give the user the real link and one-time code printed by the command:

```text
请打开这个链接：
https://github.com/login/device

输入授权码：
XXXX-XXXX
```

NEVER invent an authorization code. The code must come from the live command output.

Failure exit: if authorization cannot be completed, final conclusion is `未推送：待 GitHub 授权`.

## Step 4: Run Pre-Push Checks

Task: Decide whether the project is safe and complete enough to push.

Input: Project files, Git staged/unstaged files, README, env files, local config, deployment config.

Output: Passed checks, fixed-and-passed checks, or a precise blocking reason.

Pre-push guards:

- If real or suspected secrets are present -> follow Secret handling below before continuing.
- If `.env`, local config, deployment config, database files, dependency folders, or build caches are staged -> unstage/remove them, update ignore rules when needed, and re-run this step.
- If env vars are needed and `.env.example` or equivalent example config is missing -> create placeholder-only example config and re-run this step.
- If README.md is missing -> run Step 5 to create it, then return to Step 4.
- If README.md exists but lacks deployment instructions -> run Step 5 to complete it, then return to Step 4.
- If dependencies cannot be installed or are missing -> mark a Step 6 verification target and continue to Step 6 for the actual command run.
- If a build command exists -> mark it as a Step 6 verification target.
- If tests or lint exist -> mark them as Step 6 verification targets.
- If a local service start command exists -> mark it as a Step 6 verification target.
- If ports, commands, env vars, or deployment notes conflict -> fix README/config consistency and re-run this step.
- If all guards pass -> continue to Step 5.

Secret handling:

- MUST scan hidden files, but exclude `.git`, dependency directories, and generated build output.
- NEVER quote real secret values in the final reply.
- If a real secret is in a tracked file, remove it, replace with placeholders, update ignore rules, and re-scan.
- If a real secret is already in Git history, stop. Final conclusion is `暂不建议推送`, and the next step is to clean history or rotate the secret.

## Step 5: Complete README Deployment Instructions

Task: Make README.md usable for engineer handoff.

Input: Project type, product metadata, install command, start command, build command, port, env vars, deploy method, production URL.

Output: README.md with deployment instructions.

README.md MUST include:

- Product name and summary.
- Local setup.
- Dependency installation.
- Build command.
- Environment variables.
- Port information.
- Deployment method.
- Production URL.
- Verification method.
- Notes or common failure points.

Env var documentation rules:

- Document field names, purpose, and placeholder examples.
- NEVER include real tokens, passwords, cookies, or private keys.
- If engineers must configure server env vars, keep placeholders in README and list the exact required config block in the final delivery card.

Example:

```bash
API_BASE_URL=https://api.example.com
ACCESS_TOKEN=Bearer <provided-by-owner>
```

```text
WRONG:
  ACCESS_TOKEN=ghp_real_token_value_in_readme
Reason: A real token in README becomes a GitHub secret leak.
GOOD:
  ACCESS_TOKEN=Bearer <provided-by-owner>
```

## Step 6: Run Local Verification

Task: Run real commands to verify the project before pushing.

Input: Project type, README commands, package manager, test scripts, Docker files, deployment files.

Output: Verification result and any fixes made.

MUST run actual commands. Do not rely on static inspection only.

Verification by project type:

- Node project: infer package manager from lockfile; run install if needed, build, tests, or lint when available.
- Web project: start the local server, open the page when a browser tool is available, and check that the main page renders.
- API project: start the service and request a health endpoint or representative route.
- Docker project: build the image or run compose enough to confirm startup.
- Static site: serve locally and check that assets load.

If verification fails, fix the issue and re-run the failing check. Only mark blocked when the failure depends on external accounts, paid services, production secrets, or third-party permissions that are unavailable.

## Step 7: Push To GitHub

Task: Push the verified project to GitHub.

Input: Git state, GitHub authorization, target owner/repo, commit message, default branch.

Output: GitHub repository URL, main branch, push status.

Dispatch by Git state from Step 1:

- Existing Git remote -> run Existing repository procedure.
- Git repository without remote -> run First push procedure.
- Not a Git repository -> run First push procedure.
- Otherwise -> report BLOCKER `unknown Git state` and stop this run.

Default branch behavior:

- Existing repository: use the existing default/main branch.
- New repository: use `main`.
- Default action: push directly to main branch.

Do not create a PR by default. Use a PR only when:

- The repository is not directly maintained by the user/team.
- Branch protection blocks direct push.
- The change is high risk and user confirmation is missing.
- GitHub permission is insufficient.
- The user explicitly requests a PR.

First push procedure:

1. Initialize Git when needed.
2. Create the GitHub repository.
3. Add remote.
4. Commit all intended delivery files.
5. Push to main branch.

Existing repository procedure:

1. Confirm remote and current branch.
2. Check or pull remote state to avoid overwriting teammate changes.
3. Commit delivery changes.
4. Push to main branch.

Commit message MUST be clear, for example:

```text
Prepare product for GitHub delivery
```

Create a tag or release only when the project needs a downloadable or deployable version artifact. Do not create releases by default.

## Step 8: Produce Final Delivery Card

Task: Report the delivery result in a short card.

Input: Product name, repository, branch, production URL, verification results, safety check, deployment config.

Output: Chinese final delivery card.

Final conclusion MUST be exactly one of:

- `已推送完成`
- `未推送：待 GitHub 授权`
- `未推送：需先修复`
- `暂不建议推送`

Use this shape:

```text
交付结论：已推送完成

项目：产品中文名 / ProductName
仓库：owner/repo
主分支：main
生产链接：https://repo.tranfu.com/

本地验证：通过
README 部署说明：已补齐
安全检查：未发现密钥泄露
GitHub 状态：已推送到主分支

部署配置：
- SERVER_API_BASE_URL=https://api.example.com
- SERVER_ACCESS_TOKEN=Bearer <由负责人提供>

注意：
- SERVER_ACCESS_TOKEN 只能放服务器环境变量，不能写进前端代码、GitHub、README 或截图。

下一步：
技术按部署配置补环境变量后部署。
```

```text
WRONG:
  交付结论：基本完成了
Reason: Free-form conclusion breaks the required four-state delivery card.
GOOD:
  交付结论：已推送完成
```

If no additional engineer config is needed, write `部署配置：无额外配置`.

If not pushed, the card MUST include the blocker and the shortest next step.

Failure exits:

- GitHub authorization missing -> `未推送：待 GitHub 授权`.
- Real secret in Git history -> `暂不建议推送`.
- Local verification fails and cannot be fixed now -> `未推送：需先修复`.
- User requested discussion-only mode -> do not push; summarize the plan only.

## What NOT to do

- NEVER say GitHub push means production is deployed.
- NEVER say local build success means production is live.
- NEVER expose real secrets in GitHub, README, screenshots, or final replies.
- NEVER push before completing README deployment instructions.
- NEVER skip local verification unless the user explicitly accepts that risk.
- NEVER create a PR by default; this skill defaults to direct main branch delivery.
- NEVER invent GitHub authorization codes, repository URLs, or production URLs.
- NEVER commit `.env`, private keys, database files, dependency directories, build caches, or local-only config.
