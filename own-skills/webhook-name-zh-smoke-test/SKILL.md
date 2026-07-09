---
name: webhook-name-zh-smoke-test
description: Temporary smoke-test skill used to verify the tranfu-skills webhook name_zh pre-agent workflow.
argument-hint: "<test input>"
version: 0.1.0
author: pr-reviewer
updated_at: 2026-07-09
origin: own
---

# Webhook Name Zh Smoke Test

This temporary skill exists only to verify the real GitHub webhook flow for adding `name_zh` through the pre-agent workflow.

## Usage

Use this skill only for webhook smoke testing.

## Workflow

1. Confirm the webhook received a real pull request event.
2. Confirm the pre-agent workflow can add `name_zh` to this file.
3. Remove this skill after the test is complete.
