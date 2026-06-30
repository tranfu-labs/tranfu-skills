---
name: github-delivery-check
description: 'Use when the user asks to push a product project to GitHub, create a GitHub repository, prepare a deployable project, complete README deployment instructions, or hand off deployment details to engineers. Also trigger for Chinese requests like "推到 GitHub", "创建 GitHub 仓库", "首次提交", "整理成可部署项目", or "用 GitHub交付规范 Skill". Do NOT trigger when the user only wants ordinary code changes, code review, production deployment without GitHub delivery, or discussion-only planning; route those to the coding, review, deploy, or normal discussion workflow.'
version: 0.1.1
author: 06666666
updated_at: 2026-06-29
origin: own
---

# GitHub Delivery Check

Target type: a product project repository with code, README, config examples, and deployment files. Do not use this skill for prompts, other skills, agent definitions, docs-only assets, or product copy alone.

Prepare a product project for GitHub delivery so another teammate can understand, configure, deploy, and verify it.

This is an execution workflow. By default, inspect the project, fix delivery docs, verify locally, and push to the GitHub main branch. MUST stop only when GitHub authorization is missing, real secret risk exists, required product facts are missing, verification cannot be completed, or the user requested discussion-only mode.

## Terminology

- `main branch` = `主分支`
- `production URL` = `生产链接`
- `local verification` = `本地验证`
- `deployment config` = `部署配置`
- `GitHub Delivery Card` = the final Chinese chat-message artifact
- `Delivery Ledger` = the structured internal record that feeds the final card

Use these terms consistently. The final user-facing card may use the Chinese labels above.

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

If the user intent is ambiguous, ask one confirmation question before Step 1:

```text
Do you want me to push this project to GitHub main, update an existing repository, or only prepare/check the README without pushing?
```

Continue only after the intent maps to GitHub delivery. If the answer is discussion-only, stop this skill.

## Ownership

Default ownership is `edit file + run verification + push GitHub`.

MUST edit project files when README, env examples, gitignore, or delivery metadata are missing and the fix is local to the target project.

MUST NOT push unless all conditions below hold:

- The user intent maps to GitHub delivery.
- GitHub authorization is confirmed.
- No real secret is present in files to be pushed.
- Required product metadata is available for first-push delivery.
- README deployment instructions are complete.
- Required local verification targets have status `pass`, `fixed`, or `not_applicable`.

## Delivery Ledger

Maintain this internal ledger while executing. Use the same field names when filling the final card.

```yaml
delivery_ledger:
  inspection:
    target_type: product_project_repository
    project_type: frontend|backend|full_stack|docker|static_site|server_deployment|unknown
    git_state: existing_remote|git_without_remote|not_git_repo|unknown
    default_branch: main|other|unknown
    repo_owner: string|unknown
    repo_name: string|unknown
    production_url: string|unknown
  prepush:
    blockers:
      - id: string
        status: pass|fixed|blocked
        reason: string
        next_step: string
    secrets: pass|fixed|blocked
    readme: pass|fixed|blocked
    env_example: pass|fixed|not_applicable|blocked
  verification:
    targets:
      - id: install|build|test|lint|web_http|api_health|docker_build|docker_compose|static_assets
        command_or_check: string
        status: pass|fail|fixed|not_applicable|blocked
        observable_signal: exit_code_0|http_200|page_rendered|file_exists|not_applicable|blocked_reason
  github:
    authorization: pass|blocked
    push_status: pushed|not_pushed
    repository: owner/repo|unknown
    branch: string|unknown
  final:
    conclusion: 已推送完成|未推送：待 GitHub 授权|未推送：需先修复|暂不建议推送
```

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Inspect project and Git state.
2. Complete first-push product metadata when needed.
3. Verify GitHub authorization.
4. Run pre-push checks.
5. Complete README deployment instructions.
6. Run local verification.
7. Push to GitHub main branch.
8. Produce the GitHub Delivery Card.

Done means:

- `delivery_ledger.inspection.project_type` and `git_state` are not `unknown`, or the final card says why they remain blocked.
- First-push metadata fields are resolved when `git_state != existing_remote`.
- `delivery_ledger.github.authorization` is `pass`, or final conclusion is `未推送：待 GitHub 授权`.
- `delivery_ledger.prepush.blockers[]` has no item with `status=blocked`, unless final conclusion is a non-push state.
- README.md exists and contains deployment instructions.
- `delivery_ledger.prepush.secrets` is `pass` or `fixed`.
- Each verification target has status `pass`, `fixed`, `not_applicable`, or `blocked`; blocked targets must appear in the final card.
- GitHub has been pushed to the main branch, or the final card gives a precise non-push reason.

## Failure Paths

- Missing or unreadable project directory -> ask for the correct path and stop.
- Git CLI unavailable -> final conclusion `未推送：需先修复`; next step: install or expose Git.
- Git state cannot be determined -> final conclusion `未推送：需先修复`; next step: fix Git repository state.
- GitHub CLI unavailable and no other GitHub tool can create/push repos -> final conclusion `未推送：待 GitHub 授权`.
- GitHub auth, network, or API failure -> final conclusion `未推送：待 GitHub 授权` or `未推送：需先修复`, matching the concrete error.
- Existing remote diverges or push is non-fast-forward -> pull/rebase only when safe; otherwise final conclusion `未推送：需先修复`.
- Branch protection blocks direct main push -> create PR only if user accepts; otherwise final conclusion `未推送：需先修复`.
- Current environment lacks write permission -> final conclusion `未推送：需先修复`.
- Verification cannot be reproduced -> final conclusion `未推送：需先修复`.
- User asks to operate on another repository outside the current target -> confirm scope before editing.

## Step 1: Inspect Project And Git State

Task: Identify project type, deployment shape, and repository state before asking the user.

Input: Current project directory, file tree, Git status, README, env examples, package files, deployment files.

Output: `delivery_ledger.inspection`.

Procedure:

1. Verify the target directory exists and is readable. If not -> use Failure Paths and stop.
2. Verify `git` is available before reading Git state. If not -> set `git_state=unknown`, use Failure Paths, and stop.
3. Inspect files before asking the user about project type.
4. Classify project type:
   - Frontend: `package.json`, Vite, Next.js, React, Vue, Astro, Svelte, static build scripts, or static assets.
   - Backend: server entrypoint, route definitions, API framework, port config, database config, or service start command.
   - Full-stack: both UI and API surfaces in one repository.
   - Docker: `Dockerfile`, `docker-compose.yml`, or `compose.yml`.
   - Static site: HTML/CSS/JS or build output that can be served statically.
   - Server deployment: env vars, long-running service, database, reverse proxy, daemon, or container runtime.
   - Otherwise -> set `project_type=unknown`.
5. Classify Git state:
   - Existing Git remote -> `existing_remote`.
   - Git repository without remote -> `git_without_remote`.
   - Not a Git repository -> `not_git_repo`.
   - Otherwise -> `unknown`.
6. If `project_type=unknown`, ask at most three key questions and stop this run.
7. If `git_state=unknown`, final conclusion is `未推送：需先修复` and stop.
8. Write `delivery_ledger.inspection` and continue.

## Step 2: Complete First-Push Product Metadata

Task: Collect only the product facts that cannot be inferred from code.

Input: `delivery_ledger.inspection`, user-provided facts, existing README, package metadata.

Output: completed first-push metadata in `delivery_ledger.inspection`.

Dispatch by Git state from Step 1:

- `existing_remote` -> skip first-push metadata collection and continue to Step 3.
- `git_without_remote` -> continue this step.
- `not_git_repo` -> continue this step.
- Otherwise -> final conclusion `未推送：需先修复` and stop.

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

If required metadata is incomplete at the end of this step, final conclusion is `未推送：需先修复` and the next step is to provide the missing metadata.

## Step 3: Verify GitHub Authorization

Task: Confirm that the current environment can create or push GitHub repositories.

Input: GitHub CLI state or available GitHub tool state.

Output: `delivery_ledger.github.authorization`.

Procedure:

1. Verify `gh` CLI exists. If another authenticated GitHub tool is available, use it and set authorization status from that tool.
2. If neither `gh` nor another GitHub tool exists -> final conclusion `未推送：待 GitHub 授权` and stop.
3. If `gh` exists, run:

```bash
gh auth status
```

4. If authorization is missing, start a web/device authorization flow such as:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

5. MUST give the user the real link and one-time code printed by the command:

```text
请打开这个链接：
https://github.com/login/device

输入授权码：
XXXX-XXXX
```

```text
WRONG:
  输入授权码：ABCD-1234

Reason: The agent invented a code instead of reading live command output.

GOOD:
  输入授权码：<code printed by gh auth login --web>
```

NEVER invent an authorization code. The code must come from live command output.

Failure exit: if authorization cannot be completed, final conclusion is `未推送：待 GitHub 授权`.

## Step 4: Run Pre-Push Checks

Task: Decide whether the project is safe and complete enough to push.

Input: Project files, Git staged/unstaged files, README, env files, local config, deployment config.

Output: `delivery_ledger.prepush`.

Pre-push guards:

- If real or suspected secrets are present -> follow Secret handling below before continuing.
- If `.env`, local config, deployment config, database files, dependency folders, or build caches are staged -> unstage/remove them, update ignore rules when needed, set blocker status `fixed`, and re-run this step.
- If env vars are needed and `.env.example` or equivalent example config is missing -> create placeholder-only example config, set `env_example=fixed`, and re-run this step.
- If README.md is missing -> run Step 5 to create it, then return to Step 4.
- If README.md exists but lacks deployment instructions -> run Step 5 to complete it, then return to Step 4.
- If dependencies cannot be installed or are missing -> add a Step 6 verification target with status `blocked` or `not_applicable`, then continue to Step 6.
- If a build command exists -> add verification target `build`.
- If tests or lint exist -> add verification target `test` or `lint`.
- If a local service start command exists -> add verification target `web_http`, `api_health`, or both.
- If ports, commands, env vars, or deployment notes conflict -> fix README/config consistency, set blocker status `fixed`, and re-run this step.
- If no verification target exists and the project type requires runtime validation -> final conclusion `未推送：需先修复`; next step: add a runnable verification command or explain why verification is not applicable.
- If no verification target exists and the project is docs/static-only -> set target status `not_applicable` with reason.
- If all guards pass -> continue to Step 5.

Secret handling:

- MUST scan hidden files, but exclude `.git`, dependency directories, and generated build output.
- NEVER quote real secret values in the final reply.
- If a real secret is in a tracked file, remove it, replace with placeholders, update ignore rules, set `secrets=fixed`, and re-scan.
- If a real secret is already in Git history, stop. Final conclusion is `暂不建议推送`, and the next step is to clean history or rotate the secret.

Each guard MUST update `delivery_ledger.prepush.blockers[]` with `id`, `status`, `reason`, and `next_step`.

## Step 5: Complete README Deployment Instructions

Task: Make README.md usable for engineer handoff.

Input: Project type, product metadata, install command, start command, build command, port, env vars, deploy method, production URL.

Output: README.md with deployment instructions and `delivery_ledger.prepush.readme`.

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
- If engineers must configure server env vars, keep placeholders in README and list the exact required config block in the GitHub Delivery Card.

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

Input: Project type, README commands, package manager, test scripts, Docker files, deployment files, Step 4 verification targets.

Output: `delivery_ledger.verification.targets[]`.

MUST run actual commands. Do not rely on static inspection only.

Verification by project type:

- Node project -> MUST infer package manager from lockfile; run install when dependencies are missing; run build, tests, or lint when scripts exist.
- Web project -> MUST start the local server when a start command exists; MUST check `http_200` or `page_rendered` when a browser or HTTP tool is available.
- API project -> MUST start the service and request a health endpoint or representative route when a route can be inferred.
- Docker project -> MUST run docker build or compose startup when Docker files exist and Docker is available.
- Static site -> MUST serve locally or check static asset existence.

For every verification target, record:

- `command_or_check`
- `status`
- `observable_signal`
- `blocked_reason` when blocked

If verification fails, fix the issue and re-run the failing check.

MUST NOT mark blocked unless the failure depends on external accounts, paid services, production secrets, third-party permissions, unavailable local runtime, or missing commands that cannot be created safely.

If no local verification can run:

- Runtime project with no runnable verification -> final conclusion `未推送：需先修复`.
- Static/docs-only delivery with no runtime -> record `not_applicable` and continue.

## Step 7: Push To GitHub

Task: Push the verified project to GitHub.

Input: `delivery_ledger.inspection`, `delivery_ledger.github`, `delivery_ledger.prepush`, `delivery_ledger.verification`, commit message, default branch.

Output: `delivery_ledger.github.push_status`.

Before dispatch:

1. Verify first-push metadata is complete when `git_state != existing_remote`; if incomplete -> return to Step 2.
2. Verify all required verification targets have status `pass`, `fixed`, or `not_applicable`; if not -> return to Step 6 or stop with `未推送：需先修复`.
3. Verify target owner/repo is known; if not -> return to Step 2.
4. For first push, check whether `owner/repo` already exists.
   - If it exists and belongs to the intended project -> run Existing repository procedure.
   - If it exists but may be a different project -> stop with `未推送：需先修复` and ask for repo confirmation.
   - If it does not exist -> run First push procedure.

Dispatch by Git state from Step 1:

- `existing_remote` -> run Existing repository procedure.
- `git_without_remote` -> run First push procedure.
- `not_git_repo` -> run First push procedure.
- Otherwise -> final conclusion `未推送：需先修复` and stop.

Default branch behavior:

- Existing repository -> use the existing default/main branch.
- New repository -> use `main`.
- Default action -> push directly to main branch.

Do not create a PR by default. Use a PR only when:

- The repository is not directly maintained by the user/team.
- Branch protection blocks direct push.
- The change is high risk and user confirmation is missing.
- GitHub permission is insufficient.
- The user explicitly requests a PR.

First push procedure:

1. Initialize Git when needed.
2. Create the GitHub repository only after repo-existence check passes.
3. Add remote.
4. Commit all intended delivery files.
5. Push to main branch.

Existing repository procedure:

1. Confirm remote and current branch.
2. Check remote state to avoid overwriting teammate changes.
3. If remote diverges -> pull/rebase only when safe; otherwise stop with `未推送：需先修复`.
4. Commit delivery changes.
5. Push to main branch.

Commit message MUST be clear, for example:

```text
Prepare product for GitHub delivery
```

Create a tag or release only when the project needs a downloadable or deployable version artifact. Do not create releases by default.

## Step 8: Produce GitHub Delivery Card

Task: Report the delivery result in a short Chinese card.

Input: `delivery_ledger`.

Output artifact: `GitHub Delivery Card`, a single chat-message artifact unless the user explicitly asks for a file.

Final conclusion MUST be exactly one of:

- `已推送完成`
- `未推送：待 GitHub 授权`
- `未推送：需先修复`
- `暂不建议推送`

Use this success shape:

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

Use these minimum blocked shapes:

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

```text
WRONG:
  交付结论：基本完成了

Reason: Free-form conclusion breaks the required four-state delivery card.

GOOD:
  交付结论：已推送完成
```

If no additional engineer config is needed, write `部署配置：无额外配置`.

If not pushed, the GitHub Delivery Card MUST include the blocker and the shortest next step.

## What NOT to do

- NEVER say GitHub push means production is deployed.
- NEVER say local build success means production is live.
- NEVER expose real secrets in GitHub, README, screenshots, or final replies.
- NEVER push before completing README deployment instructions.
- NEVER skip local verification unless the final card clearly marks verification as blocked or not applicable.
- NEVER create a PR by default; this skill defaults to direct main branch delivery.
- NEVER invent GitHub authorization codes, repository URLs, or production URLs.
- NEVER commit `.env`, private keys, database files, dependency directories, build caches, or local-only config.
