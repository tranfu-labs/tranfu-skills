---
description: Research Privy’s official documentation through its public MCP and turn the evidence into safe implementation guidance or verified code changes.
prompt_examples:
  - prompt: Use Privy MCP to check the current React embedded wallet setup.
    scene: Check Privy docs
  - prompt: Implement Privy login in this app using official documentation evidence.
    scene: Implement auth
  - prompt: Verify whether this wallet policy matches Privy’s current API.
    scene: Verify policy
---

# Privy Docs MCP

Use Privy’s public documentation MCP as the source of truth, then reconcile it with the project’s installed SDK and architecture.

## When to use it

**Check Privy docs**

I need the current Privy documentation for login, embedded wallets, funding, policies, webhooks, or migrations, and I want exact source URLs instead of remembered API shapes.

**Implement auth**

I am changing a Privy integration and want the skill to inspect the project first, build an evidence table, then make the smallest safe code change.

**Verify policy**

I already have code or an architecture decision and want to compare it with the official Privy docs without exposing app secrets or private user data.

**Not for**

This is not for generic blockchain work, Privy dashboard administration, production credential handling, or private support. It treats the MCP as public documentation only.

## What it produces

**Documentation evidence is not runtime verification.** The skill separates official claims, project constraints, and inferences before changing code.

- **Evidence packet**: emits `PRIVY_EVIDENCE_PACKET` with the question, project context, citations, conflicts, and unverified items.
- **Documentation lookup**: uses the exposed MCP when available, otherwise the bundled read-only client or official static documentation fallback.
- **Implementation changes**: edits only files authorized by the user and project rules, preserving security boundaries around secrets and server trust.
- **Checks**: runs targeted tests, type checks, lint, build, or other project-defined verification when implementation work occurs.
- **Never does**: call feedback-writing tools, send secrets to MCP queries, modify editor MCP config without permission, or claim dashboard access.

## Prerequisites & boundaries

**Prerequisites**

A target question or project path, public Privy documentation access, and enough project context to identify installed Privy packages and trust boundaries.

**Adjacent work**

| Need | Use instead |
|---|---|
| Generic wallet architecture unrelated to Privy | A blockchain architecture workflow |
| Privy dashboard operations or secret rotation | Manual operator workflow |
| Production incident support | The project’s support / on-call process |

**Hard boundaries**

- Public App ID configuration is separate from private App Secret handling.
- MCP queries must be minimal and sanitized.
- Vendor recipes never override accepted project architecture silently.
- If documentation and installed types disagree, the mismatch is reported rather than hidden.
