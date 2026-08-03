# Delivery Contract

## Contents

1. Character Count And Composition
2. Run Layout
3. Topic Evidence
4. Editorial Bridge And Promotion Decision
5. Candidate Record
6. Copy Ledger
7. Image Manifest
8. Package Request
9. Terminal States
10. Final Delivery

## Character Count And Composition

Count Unicode code points after trimming leading and trailing whitespace. Internal spaces and line breaks count, as do punctuation, hashtags, `@` mentions, digits and Latin letters.

- Canonical long post: 1500-2000 characters including title, hashtags and image captions.
- `event_context`: cause, process and result, at most 40% of the publishable body.
- `hotspot_analysis`: at least 35% of the publishable body.
- `event_context + hotspot_analysis`: 75%-85% of the publishable body.
- Final `ai_analysis`: 15%-25%, after hotspot analysis, and explicitly tied to the same event.

The ratio denominator excludes exact title, hashtags and image captions. Internal formatting whitespace remains in the denominator.

## Run Layout

```text
runs/<timestamp>-<company>-<slug>/
  00-intake/request.md
  00-intake/intake.json
  00-intake/company-profile.snapshot.json
  01-hot-topics/weibo-top50.json              # live-discovery only
  01-hot-topics/weibo-top50.md                # live-discovery only
  01-hot-topics/review.json                   # live-discovery only
  01-hot-topics/review.md                     # live-discovery only
  01-hot-topics/topic-evidence.json           # fixed-event/fixed-theme only
  01-hot-topics/topic-evidence.md             # fixed-event/fixed-theme only
  02-sources/source-log.md
  02-sources/evidence-brief.md
  02-sources/promotion-decision.json
  03-topics/editorial-bridges.json
  03-topics/candidates.md
  03-topics/review.md
  03-topics/provider/<topic-id>/02-选题方案.md
  04-content/<topic-id>/brief.md
  04-content/<topic-id>/long/initial.md
  04-content/<topic-id>/long/rewrite-result.md
  04-content/<topic-id>/long/final.md
  04-content/<topic-id>/copy-ledger.json
  04-content/<topic-id>/images/factual/
  04-content/<topic-id>/images/references/
  04-content/<topic-id>/images/generated/images/
  04-content/<topic-id>/images/generated/prompts/
  04-content/<topic-id>/images/image-manifest.json
  package-request.json
  delivery.md                              # internal run status
  final-delivery/manifest.json
  final-delivery/delivery.md
  final-delivery/<topic-id>/long.md
  final-delivery/<topic-id>/images/
```

Create a new timestamped directory for every run. Never overwrite or migrate previous runs or bundled profiles. `final-delivery/` is created once, only after production ends.

## Topic Evidence

`00-intake/intake.json` records `topic_mode` as `live-discovery`, `fixed-event` or `fixed-theme`.

For fixed routes, save `01-hot-topics/topic-evidence.json`:

```json
{
  "platform": "weibo",
  "topic_mode": "fixed-theme",
  "requested_topic": "enterprise AI adoption",
  "reviewed_at": "2026-07-31T12:00:00+08:00",
  "search_attempts": [
    {"window_days": 7, "status": "NO_ACCEPTABLE_EVENT", "result_count": 0},
    {"window_days": 30, "status": "PASS", "result_count": 2}
  ],
  "selected_event": {
    "title": "verified current event",
    "published_at": "2026-07-20T09:00:00+08:00",
    "source_url": "https://example.com/original",
    "evidence_urls": ["https://example.com/original"],
    "review_status": "PASS",
    "review_reason": "current primary source supports the event",
    "risk_flags": []
  }
}
```

For `fixed-event`, `search_attempts` is `[]`. For a fixed theme without an event after both windows, set `selected_event: null` and `terminal_reason: no_current_event_anchor`.

## Editorial Bridge And Promotion Decision

Every passing event must have an `editorial_bridge` before topic review:

```json
{
  "event_claim": "verified event claim",
  "event_evidence_urls": ["https://example.com/source"],
  "ai_angle": "specific event-derived AI implication",
  "audience_value": "specific reader value",
  "analysis_questions": [
    "mechanism",
    "impact",
    "judgment",
    "boundary_or_counterpoint"
  ],
  "status": "PASS"
}
```

An event that cannot support a defensible AI analysis ends as `CANCELLED_NO_RELEVANCE: no_ai_editorial_angle`. Missing company relevance does not end creation.

Save optional promotion evidence separately:

```json
{
  "promotion_evidence_status": "unavailable",
  "product_mention_decision": {
    "decision": "none",
    "reason": "no product claim materially improves this hotspot analysis",
    "allowed_product_claims": [],
    "product_evidence_refs": [],
    "prohibited_claims": []
  }
}
```

Unreadable company evidence sets `promotion_evidence_status: unavailable`, decision `none`, and continues. 只有一般 AI 联系时也使用 `none`。On the `none` path, 全文不得出现公司名、品牌、产品或产品 CTA. On the `allowed` path, only listed public claims may appear.

## Candidate Record

Every proposed candidate binds event evidence to editorial value. Company fields are nullable:

```json
{
  "topic_id": "topic-01",
  "topic_mode": "fixed-theme",
  "event_claim": "verified event claim",
  "event_evidence_urls": ["https://example.com/original"],
  "editorial_bridge": {
    "ai_angle": "specific AI implication",
    "audience_value": "specific reader value"
  },
  "product_mention_decision": "none",
  "company_claim": null,
  "company_source_url": null,
  "core_angle": "one focused editorial thesis",
  "review_status": "PASS",
  "review_reason": "evidence-based reason"
}
```

For `live-discovery`, also record rank, hotspot URL and snapshot time. A row may not omit event evidence, `editorial_bridge` or `core_angle`. It may omit company evidence.

## Copy Ledger

Save `04-content/<topic-id>/copy-ledger.json`:

```json
{
  "topic_id": "topic-01",
  "title": "exact title in final.md",
  "hashtags": ["#exact topic#"],
  "image_captions": ["配图：exact caption"],
  "event_context": {
    "cause": ["exact cause passage"],
    "process": ["exact process passage"],
    "result": ["exact result passage"]
  },
  "hotspot_analysis": ["exact deep-analysis passage"],
  "analysis_facets": {
    "mechanism": ["exact mechanism passage inside hotspot_analysis"],
    "impact": ["exact impact passage inside hotspot_analysis"],
    "judgment": ["exact judgment passage inside hotspot_analysis"],
    "boundary_or_counterpoint": ["exact boundary passage inside hotspot_analysis"]
  },
  "ai_analysis": ["exact final event-specific AI passage"],
  "product_mention_decision": "none",
  "product_segments": [],
  "product_evidence_refs": []
}
```

Every excluded and primary segment appears exactly once. Primary segments cover all non-whitespace body content and follow `cause -> process -> result -> hotspot_analysis -> ai_analysis`. Each analysis facet is inside `hotspot_analysis` and facets do not overlap.

The deterministic result records `event_context_ratio`, `hotspot_analysis_ratio`, `hotspot_ratio` and `ai_ratio`. Semantic QA separately verifies that mechanism, impact, judgment and boundary add reasoning rather than复述事件。

When `product_mention_decision` is `none`, both product arrays are empty and every final text is free of company, brand, product and CTA. When it is `allowed`, products remain optional. 产品内容必须完全位于 `ai_analysis`，have HTTP(S) public evidence, and occupy no more than AI 段的 25%。Product content remains part of the 15%-25% AI section and cannot reduce the 75%-85% hotspot allocation.

## Image Manifest

Save one `04-content/<topic-id>/images/image-manifest.json` for the long copy:

```json
{
  "route": "long",
  "chosen_total": 3,
  "selection_reason": "one factual source and two grounded workflow anchors",
  "factual_discovery": {
    "status": "PASS",
    "searched_claim_count": 2,
    "publish_ready_count": 1,
    "reference_only_count": 1
  },
  "generation": {
    "provider": "imagegen",
    "fallback_from": "post-illustration-images",
    "fallback_reason": "style reference PNG failed decoding",
    "style_reference_status": "skipped-corrupt"
  },
  "factual_images": [
    {
      "file": "factual/01-official.png",
      "source_page": "https://example.com/original-report",
      "publisher": "Original Publisher",
      "retrieved_at": "2026-07-31T12:00:00+08:00",
      "caption": "what the original image establishes",
      "usage_status": "publish-ready"
    }
  ],
  "reference_images": [
    {
      "file": "references/01-original.png",
      "source_page": "https://example.com/original-source",
      "publisher": "Original Publisher",
      "retrieved_at": "2026-07-31T12:00:00+08:00",
      "caption": "internal factual reference only",
      "usage_status": "verification_required"
    }
  ],
  "generated_images": [
    {
      "file": "generated/images/02-method.png",
      "prompt_path": "generated/prompts/02-method.md",
      "qa_status": "pass"
    },
    {
      "file": "generated/images/03-workflow.png",
      "prompt_path": "generated/prompts/03-workflow.md",
      "qa_status": "pass"
    }
  ]
}
```

`chosen_total` is one of `1`, `2`, `3`, `4`, `6`, or `9`. Factual plus generated rows equal that number. `reference_images` are real internal raster references but never count or enter the publishable folder. Provider `none` is valid only when factual images fill every slot.

## Package Request

After all selected topics finish, save `package-request.json`:

```json
{
  "run_status": "PARTIAL",
  "topics": [
    {
      "topic_id": "topic-01",
      "status": "COMPLETE",
      "product_mention_decision": "none",
      "long_copy": "04-content/topic-01/long/final.md",
      "image_manifest": "04-content/topic-01/images/image-manifest.json"
    },
    {
      "topic_id": "topic-02",
      "status": "FAILED_IMAGE_QA",
      "failure_stage": "images",
      "failure_reason": "generated image failed raster QA"
    }
  ]
}
```

Invoke `scripts/package_delivery.py`. It prevalidates all complete topics, builds a temporary sibling directory, copies frozen files byte-for-byte, writes `final-delivery/manifest.json` and `final-delivery/delivery.md`, then atomically renames the directory. Existing output is never overwritten.

Only factual and generated images are copied. `verification_required` rows appear in `internal_reference_images` with `copied: false`. Rejected images remain stage diagnostics only.

## Terminal States

| State | Meaning | Publish-ready content |
|---|---|---:|
| `BLOCKED_PROVIDER` | A required provider is unavailable | no |
| `BLOCKED_HOT_TOPICS` | Live Top 50 or its review failed | no |
| `BLOCKED_TOPIC_EVIDENCE` | Fixed event failed or fixed theme lacks a 30-day anchor | no |
| `BLOCKED_SOURCES` | A user-required company/product claim is unverifiable | no |
| `CANCELLED_NO_RELEVANCE` | No event passed, or the reason is `no_ai_editorial_angle` | no |
| `CANCELLED_REVIEW` | Every editorial candidate was rejected | no |
| `FAILED_DRAFT_QA` | Long copy depth, plain-language, composition, or fact QA failed | no incomplete topic |
| `FAILED_IMAGE_QA` | A topic lacks a valid image bundle | no incomplete topic |
| `PARTIAL` | At least one topic completed and at least one failed | complete topics only |
| `COMPLETE` | Every delivered topic passed every gate | yes |

No complete topic means no `final-delivery/`. Do not represent incomplete files as publishable.

## Final Delivery

Use this stable summary in internal `delivery.md` and the final response:

```yaml
WEIBO_PRODUCTION_RESULT:
  run_status: BLOCKED_PROVIDER|BLOCKED_HOT_TOPICS|BLOCKED_TOPIC_EVIDENCE|BLOCKED_SOURCES|CANCELLED_NO_RELEVANCE|CANCELLED_REVIEW|FAILED_DRAFT_QA|FAILED_IMAGE_QA|PARTIAL|COMPLETE
  terminal_reason: "state-specific reason or null"
  run_dir: "/absolute/path/to/run"
  final_delivery_dir: "/absolute/path/to/run/final-delivery or null"
  company: tranfu
  promotion_evidence_status: unavailable|reviewed|verified
  topic_mode: live-discovery|fixed-event|fixed-theme
  topic_evidence:
    status: PASS|BLOCKED|CANCELLED
    path: "/absolute/path/to/review.json or topic-evidence.json"
    reviewed_count: 50|null
    selected_event: "event title or null"
    search_window_days: 7|30|null
  candidates: []
  deliverables:
    - topic_id: topic-01
      long_copy_path: "/absolute/path/to/final-delivery/topic-01/long.md"
      long_character_count: 1800
      body_character_count: 1750
      event_context_character_count: 525
      event_context_ratio: 0.3
      hotspot_analysis_character_count: 875
      hotspot_analysis_ratio: 0.5
      hotspot_character_count: 1400
      hotspot_ratio: 0.8
      ai_character_count: 350
      ai_ratio: 0.2
      event_context_elements: [cause, process, result]
      analysis_facets: [mechanism, impact, judgment, boundary_or_counterpoint]
      product_mention_decision: none
      product_mentioned: false
      product_evidence_refs: []
      copy_ledger_path: "/absolute/path/to/copy-ledger.json"
      chosen_total: 3
      selection_reason: "three grounded visual anchors"
      factual_image_count: 1
      reference_image_count: 1
      generated_image_count: 2
      generation_provider: post-illustration-images|imagegen|none
      fallback_from: post-illustration-images|null
      fallback_reason: "fallback reason or null"
      style_reference_status: "verified, not-needed, or fallback status"
      provider_attempts: []
      ordered_image_files:
        - "/absolute/path/to/final-delivery/topic-01/images/01-official.png"
      image_manifest_path: "/absolute/path/to/images/image-manifest.json"
  final_manifest_path: "/absolute/path/to/final-delivery/manifest.json"
  checklist_path: "/absolute/path/to/final-delivery/delivery.md"
  internal_reference_images: []
  failed_topics: []
  residual_risks: []
```

The final response performs one 统一交付 only after packaging finishes. It lists every complete long post, every publishable image, internal references, failed topics and residual risks. Every claimed path must exist. No-product content is valid and records `product_mentioned: false`.
