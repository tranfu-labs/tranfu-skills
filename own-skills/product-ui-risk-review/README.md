---
description: Review and improve high-risk product UI flows for asset, account, authorization, confirmation, transaction, and async recovery risks.
prompt_examples:
  - prompt: Use $product-ui-risk-review to review this asset exchange flow before launch.
    scene: Pre-launch risk review
  - prompt: Use $product-ui-risk-review to improve this authorization and transaction confirmation flow.
    scene: Fix high-risk UI flow
---

# product-ui-risk-review

`product-ui-risk-review` reviews product UI flows where user misunderstanding can cause costly or hard-to-recover outcomes. It focuses on decision clarity, state coverage, confirmation design, error recovery, risk copy, and launch readiness.

Use it for asset, account, authorization, signature/confirmation, transaction submission, payment, transfer, async result, and cross-system handoff flows. It is intentionally packaged as a general UI risk solution while retaining deep coverage for asset/authorization/transaction-style product scenarios.

## What It Checks

- Whether users understand the object, scope, amount, target, cost, and consequence before acting.
- Whether authorization, confirmation, and final submission are separated when they represent different decisions.
- Whether loading, partial data, insufficient permission, cancellation, pending, success, failure, timeout, and partial-success states are recoverable.
- Whether high-risk buttons use specific action copy instead of generic `Confirm`, `Submit`, or `OK`.
- Whether runtime verification is clearly separated from static review.

## Typical Prompts

```text
Use $product-ui-risk-review to review this payment flow before launch.
Use $product-ui-risk-review to improve this asset exchange page according to product UI risk rules.
使用 $product-ui-risk-review 审查这个授权确认流程的上线风险。
```

## Boundaries

This skill does not provide legal compliance conclusions, investment advice, low-level security audit results, brand design, or purely visual taste review. It only reviews and improves product UI risk around user operations.
