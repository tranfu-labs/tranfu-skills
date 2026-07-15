---
description: "A safe-write workflow Skill for Lark (Feishu) wiki. Enforces a four-step loop — preflight, backup, write, verify — so a wiki page never gets clobbered or silently fails to update."
prompt_examples:
  - prompt: Create a new page in this Lark knowledge base.
    scene: Create a wiki page
  - prompt: Update this Lark wiki page without losing the existing content.
    scene: Update a wiki page
  - prompt: Back up this page before writing the new content.
    scene: Back up before writing
---

# Lark Safe Write

A safe-write workflow Skill for Lark (Feishu) wiki. Enforces a four-step loop — preflight, backup, write, verify — so a wiki page never gets clobbered or silently fails to update.

## When to use it

- Creating a new wiki node under a Lark knowledge space
- Updating or overwriting an existing wiki page
- Worried that a direct write will destroy existing content
- Need to confirm the page really landed the way you intended

## How to trigger it

Say something like:
- "Use lark-safe-write to update this wiki page"
- "Write to the Lark wiki, back it up first and then verify"
- "Create a new Lark wiki doc for me"
- "Overwrite this wiki page, and make a backup first"

## What you get back

- Preflight results: bot permissions, token resolution, doc-type check
- Backup path: `.backups/YYYYMMDD-HHMMSS-{token}.md`
- Write result: success or failure, plus the doc URL
- Verification report: title, first paragraph, and key-marker diff

---

## Problems it solves

When you write into a Lark wiki through `lark-cli`, these are the traps this Skill closes off:

- **Page silently clobbered**: A raw `update` wipes existing content and there is no undo.
- **Success that isn't**: The API returns 200 but the page never actually changes.
- **Path written as content**: Passing `--markdown /path/to/file.md` ends up storing the literal path string instead of the file's contents.
- **Permission whack-a-mole**: No preflight, so you burn several failed calls before realizing the bot lacks access.

The Skill wraps every write in a mandatory workflow so those failure modes cannot happen in the first place.

---

## Install

### Claude Code

```bash
# 1. Clone into the local skills directory
git clone https://github.com/duo-lark/lark-safe-write.git ~/.claude/skills/lark-safe-write

# 2. Trigger the Skill
/lark-safe-write
```

### OpenAI Codex

```bash
# 1. Clone into the Codex skills directory
git clone https://github.com/duo-lark/lark-safe-write.git ~/.agents/skills/lark-safe-write

# 2. Restart Codex so the new Skill is picked up
# 3. To trigger: mention the skill name in chat, or reference $lark-safe-write
Use lark-safe-write to update the Lark doc
```

### OpenClaw

```bash
# 1. Clone into the OpenClaw skills directory
git clone https://github.com/duo-lark/lark-safe-write.git ~/.openclaw/skills/lark-safe-write

# 2. To trigger: reference the skill name in a task or chat
Please use the lark-safe-write flow to write to the wiki
```

### Hermess

```bash
# 1. Clone into the Hermess skills directory
git clone https://github.com/duo-lark/lark-safe-write.git ~/.hermes/skills/lark-safe-write

# 2. To trigger: just ask in chat
Use the lark-safe-write safe-write flow for this wiki update
```

### Claude Chat / Claude CoWork

Upload `SKILL.md` straight into the conversation and it is ready to use.

---

## Core workflow

```
Preflight → Backup → Write → Verify
```

### 1. Preflight (cannot be skipped)

- Confirm the `--bot` identity flag is set
- Run `lark-cli auth test` to check the token is valid
- Resolve the wiki_token / node_token
- On first touch of a space, confirm the bot actually has access

### 2. Backup (mandatory on update / overwrite)

- Read the full current content of the doc
- Save it to `.backups/YYYYMMDD-HHMMSS-{token}.md`
- Report the backup path back to the user

### 3. Write

- **New doc**: pin down `parent_node_token`, then use `lark-cli wiki +node-create`
- **Updating an existing doc**: pipe content via **stdin** (never `--markdown /path`)
- Wait 2 seconds after the write for Lark's async indexer to catch up

### 4. Verify (cannot be skipped)

- Re-read the doc
- Diff title, first paragraph, and key markers against what you wrote
- Report the verification result and the doc URL explicitly

---

## Error handling

| Scenario | What the Skill does |
|---|---|
| `auth test` fails | Halt; prompt user to check env vars and bot permissions |
| Backup read fails (doc does not exist) | Fall through to the "create new doc" branch |
| Backup read fails (permission denied) | Halt; ask user to grant permission in the Lark admin console |
| Write fails (4xx / 5xx) | Halt; keep the backup; do not run verification |
| Verify fails (content mismatch) | Halt; keep the backup; do not silently retry the overwrite |

---

## Dependencies

- [lark-cli](https://open.larksuite.com/document/mcp_open_tools/feishu-cli-let-ai-actually-do-your-work-in-feishu) — bot identity and permissions already configured

---

## License

MIT License
