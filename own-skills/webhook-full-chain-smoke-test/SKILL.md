---
name: webhook-full-chain-smoke-test
description: Temporary skill for testing the full tranfu-skills webhook chain: pre-agent name_zh, squash merge, catalog sync, tranfucom CI, and Feishu notification.
argument-hint: "<smoke test input>"
version: 0.1.0
author: pr-reviewer
updated_at: 2026-07-09
origin: own
---

# Webhook Full Chain Smoke Test

This temporary skill verifies the full production webhook chain for new skills.

## Usage

Use only for end-to-end webhook smoke testing.

## Workflow

1. Create a real pull request without `name_zh`.
2. Let the pre-agent workflow add `name_zh`.
3. Let the script workflow squash merge the PR.
4. Wait for catalog sync and tranfucom CI to complete.
5. Delete this temporary skill in a follow-up cleanup PR.
