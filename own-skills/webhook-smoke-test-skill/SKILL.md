---
name: webhook-smoke-test-skill
description: >-
  Test-only skill used to verify the automated Skill PR review webhook. Trigger when maintainers explicitly ask to smoke test the PR review bot; do not trigger for normal user tasks.
version: 0.1.0
author: Hermes PR reviewer
origin: own
userInvocable: false
---

# Webhook Smoke Test Skill

## Purpose

This is a harmless test-only skill for verifying that pull requests which add or modify a `SKILL.md` file trigger the automated skill review workflow.

## Workflow

1. Confirm the request is explicitly a webhook smoke test.
2. Report that this skill is only a placeholder for PR review automation.
3. Do not perform any external actions.

## Completion Criteria

The skill completes when it states that the webhook smoke test placeholder was recognized.

## Failure Path

If the request is not explicitly a webhook smoke test, do not run this skill and explain that it is test-only.
