import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "validate_artifact.py"
SPEC = importlib.util.spec_from_file_location("validate_artifact", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def topic_payload(now, count=50):
    return {
        "ok": True,
        "platform": "weibo",
        "count": count,
        "generated_at": now.isoformat(timespec="seconds"),
        "data": [
            {"rank": index, "title": f"热点 {index}", "url": f"https://s.weibo.com/{index}"}
            for index in range(1, count + 1)
        ],
    }


def review_payload(snapshot):
    reviewed_at = datetime.fromisoformat(snapshot["generated_at"]) + timedelta(
        minutes=5
    )
    topics = [
        {
            "rank": item["rank"],
            "title": item["title"],
            "review_status": "PASS",
            "review_reason": "Verified and suitable for responsible company expression",
            "risk_flags": [],
            "evidence_urls": [item["url"]],
        }
        for item in snapshot["data"]
    ]
    topics[-1].update(
        {
            "review_status": "REJECTED",
            "review_reason": "Pure entertainment gossip has no responsible company angle",
            "risk_flags": ["pure-entertainment"],
            "evidence_urls": [],
        }
    )
    return {
        "platform": "weibo",
        "reviewed_at": reviewed_at.isoformat(timespec="seconds"),
        "topics": topics,
    }


def fixed_event_payload(now):
    return {
        "platform": "weibo",
        "topic_mode": "fixed-event",
        "requested_topic": "A company announced a new robotics workflow",
        "reviewed_at": now.isoformat(timespec="seconds"),
        "search_attempts": [],
        "selected_event": {
            "title": "A company announced a new robotics workflow",
            "published_at": (now - timedelta(days=1)).isoformat(timespec="seconds"),
            "source_url": "https://example.com/original-announcement",
            "evidence_urls": ["https://example.com/original-announcement"],
            "review_status": "PASS",
            "review_reason": "Verified by a current primary public source",
            "risk_flags": [],
        },
    }


def long_copy_bundle(
    event_context_count=540,
    hotspot_analysis_count=900,
    ai_count=360,
    product=False,
    product_decision=None,
):
    title = "企业进入交付阶段"
    hashtag = "#行业观察#"
    caption = "配图：工作流示意"
    context_counts = [event_context_count // 3] * 3
    for index in range(event_context_count % 3):
        context_counts[index] += 1
    event_context = {
        "cause": ["因" * context_counts[0]],
        "process": ["经" * context_counts[1]],
        "result": ["果" * context_counts[2]],
    }
    facet_counts = [hotspot_analysis_count // 4] * 4
    for index in range(hotspot_analysis_count % 4):
        facet_counts[index] += 1
    analysis_facets = {
        "mechanism": ["机" * facet_counts[0]],
        "impact": ["影" * facet_counts[1]],
        "judgment": ["判" * facet_counts[2]],
        "boundary_or_counterpoint": ["界" * facet_counts[3]],
    }
    hotspot_analysis = "".join(
        values[0] for values in analysis_facets.values()
    )
    product_copy = "望船夫产品能力"
    ai = (
        product_copy + "智" * (ai_count - len(product_copy))
        if product
        else "智" * ai_count
    )
    body = (
        "".join(value[0] for value in event_context.values())
        + hotspot_analysis
        + ai
    )
    text = "\n".join((title, body, hashtag, caption))
    decision = product_decision or ("allowed" if product else "none")
    ledger = {
        "topic_id": "enterprise-ai-delivery",
        "title": title,
        "hashtags": [hashtag],
        "image_captions": [caption],
        "event_context": event_context,
        "hotspot_analysis": [hotspot_analysis],
        "analysis_facets": analysis_facets,
        "ai_analysis": [ai],
        "product_mention_decision": decision,
        "product_segments": [product_copy] if product else [],
        "product_evidence_refs": (
            ["https://tranfu.com/products/"] if product else []
        ),
    }
    return text, ledger


def image_stage_metadata(
    publish_ready_count=0,
    reference_only_count=0,
    provider="post-illustration-images",
):
    return {
        "factual_discovery": {
            "status": "PASS",
            "searched_claim_count": publish_ready_count + reference_only_count,
            "publish_ready_count": publish_ready_count,
            "reference_only_count": reference_only_count,
        },
        "generation": {
            "provider": provider,
            "fallback_from": None,
            "fallback_reason": None,
            "style_reference_status": "pass",
        },
        "reference_images": [],
    }


def generated_image_manifest(root, route="long", chosen_total=1, actual_total=None):
    actual_total = chosen_total if actual_total is None else actual_total
    (root / "prompts").mkdir(exist_ok=True)
    generated_images = []
    for index in range(1, actual_total + 1):
        image_path = root / f"{index}.png"
        prompt_path = root / f"prompts/{index}.md"
        image_path.write_bytes(b"\x89PNG\r\n\x1a\ncontent")
        prompt_path.write_text(f"prompt {index}", encoding="utf-8")
        generated_images.append(
            {
                "file": image_path.name,
                "prompt_path": f"prompts/{index}.md",
                "qa_status": "pass",
            }
        )
    return {
        "route": route,
        "chosen_total": chosen_total,
        "selection_reason": "Grounded visual anchors support this image sequence",
        **image_stage_metadata(),
        "factual_images": [],
        "generated_images": generated_images,
    }


class ArtifactValidationTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)

    def test_top_50_accepts_current_unique_snapshot(self):
        result = MODULE.validate_hot_topics(topic_payload(self.now), self.now)
        self.assertEqual({"topic_count": 50, "fresh": True}, result)

    def test_top_50_rejects_provider_failure(self):
        with self.assertRaisesRegex(MODULE.ValidationError, "provider did not succeed"):
            MODULE.validate_hot_topics(
                {"ok": False, "platform": "weibo", "error": "timeout"}, self.now
            )

    def test_top_50_rejects_49_items(self):
        with self.assertRaisesRegex(MODULE.ValidationError, "exactly 50"):
            MODULE.validate_hot_topics(topic_payload(self.now, count=49), self.now)

    def test_top_50_rejects_duplicate_title(self):
        payload = topic_payload(self.now)
        payload["data"][49]["title"] = payload["data"][0]["title"]
        with self.assertRaisesRegex(MODULE.ValidationError, "unique titles"):
            MODULE.validate_hot_topics(payload, self.now)

    def test_top_50_rejects_stale_snapshot(self):
        payload = topic_payload(self.now - timedelta(minutes=11))
        with self.assertRaisesRegex(MODULE.ValidationError, "older than 10 minutes"):
            MODULE.validate_hot_topics(payload, self.now)

    def test_top_50_rejects_invalid_platform_rank_title_and_future_time(self):
        cases = []

        wrong_platform = topic_payload(self.now)
        wrong_platform["platform"] = "zhihu"
        cases.append((wrong_platform, "platform must be weibo"))

        wrong_rank = topic_payload(self.now)
        wrong_rank["data"][0]["rank"] = 2
        cases.append((wrong_rank, "ranks must be exactly 1 through 50"))

        empty_title = topic_payload(self.now)
        empty_title["data"][0]["title"] = "  "
        cases.append((empty_title, "every hot topic must have a title"))

        future_snapshot = topic_payload(self.now + timedelta(minutes=2))
        cases.append((future_snapshot, "generated_at is in the future"))

        for payload, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(MODULE.ValidationError, message):
                    MODULE.validate_hot_topics(payload, self.now)

    def test_hot_topic_review_accepts_50_snapshot_bound_decisions(self):
        snapshot = topic_payload(self.now)
        result = MODULE.validate_hot_topic_review(review_payload(snapshot), snapshot)
        self.assertEqual(
            {"reviewed_count": 50, "pass_count": 49, "rejected_count": 1},
            result,
        )

    def test_hot_topic_review_rejects_invalid_status(self):
        snapshot = topic_payload(self.now)
        payload = review_payload(snapshot)
        payload["topics"][0]["review_status"] = "UNKNOWN"
        with self.assertRaisesRegex(
            MODULE.ValidationError, "review_status must be PASS or REJECTED"
        ):
            MODULE.validate_hot_topic_review(payload, snapshot)

    def test_hot_topic_review_requires_evidence_for_pass(self):
        snapshot = topic_payload(self.now)
        payload = review_payload(snapshot)
        payload["topics"][0]["evidence_urls"] = []
        with self.assertRaisesRegex(
            MODULE.ValidationError, "PASS hot-topic rows need HTTP\(S\) evidence"
        ):
            MODULE.validate_hot_topic_review(payload, snapshot)

    def test_hot_topic_review_requires_risk_flag_for_rejection(self):
        snapshot = topic_payload(self.now)
        payload = review_payload(snapshot)
        payload["topics"][0].update(
            {
                "review_status": "REJECTED",
                "risk_flags": [],
                "evidence_urls": [],
            }
        )
        with self.assertRaisesRegex(
            MODULE.ValidationError, "REJECTED hot-topic rows need a risk flag"
        ):
            MODULE.validate_hot_topic_review(payload, snapshot)

    def test_hot_topic_review_must_match_snapshot_rank_and_title(self):
        snapshot = topic_payload(self.now)
        payload = review_payload(snapshot)
        payload["topics"][10]["title"] = "另一个标题"
        with self.assertRaisesRegex(
            MODULE.ValidationError,
            "hot-topic review ranks and titles must match the snapshot",
        ):
            MODULE.validate_hot_topic_review(payload, snapshot)

    def test_topic_evidence_accepts_verified_fixed_event(self):
        result = MODULE.validate_topic_evidence(fixed_event_payload(self.now))
        self.assertEqual("fixed-event", result["topic_mode"])
        self.assertEqual("PASS", result["review_status"])
        self.assertEqual(
            "A company announced a new robotics workflow",
            result["event_title"],
        )

    def test_topic_evidence_accepts_fixed_theme_after_30_day_expansion(self):
        payload = fixed_event_payload(self.now)
        payload.update(
            {
                "topic_mode": "fixed-theme",
                "requested_topic": "enterprise AI adoption",
                "search_attempts": [
                    {
                        "window_days": 7,
                        "status": "NO_ACCEPTABLE_EVENT",
                        "result_count": 0,
                    },
                    {"window_days": 30, "status": "PASS", "result_count": 2},
                ],
            }
        )
        payload["selected_event"]["published_at"] = (
            self.now - timedelta(days=20)
        ).isoformat(timespec="seconds")

        result = MODULE.validate_topic_evidence(payload)

        self.assertEqual("fixed-theme", result["topic_mode"])
        self.assertEqual(30, result["search_window_days"])

    def test_topic_evidence_accepts_fixed_theme_without_current_anchor(self):
        payload = fixed_event_payload(self.now)
        payload.update(
            {
                "topic_mode": "fixed-theme",
                "requested_topic": "legacy enterprise software",
                "search_attempts": [
                    {
                        "window_days": 7,
                        "status": "NO_ACCEPTABLE_EVENT",
                        "result_count": 0,
                    },
                    {
                        "window_days": 30,
                        "status": "NO_ACCEPTABLE_EVENT",
                        "result_count": 0,
                    },
                ],
                "selected_event": None,
                "terminal_reason": "no_current_event_anchor",
            }
        )

        result = MODULE.validate_topic_evidence(payload)

        self.assertEqual("REJECTED", result["review_status"])
        self.assertIsNone(result["event_title"])
        self.assertEqual("no_current_event_anchor", result["terminal_reason"])

    def test_topic_evidence_rejects_fixed_theme_that_skips_7_day_search(self):
        payload = fixed_event_payload(self.now)
        payload.update(
            {
                "topic_mode": "fixed-theme",
                "search_attempts": [
                    {"window_days": 30, "status": "PASS", "result_count": 1}
                ],
            }
        )
        with self.assertRaisesRegex(
            MODULE.ValidationError, "search windows must be 7 then 30 days"
        ):
            MODULE.validate_topic_evidence(payload)

    def test_topic_evidence_rejects_event_outside_search_window(self):
        payload = fixed_event_payload(self.now)
        payload.update(
            {
                "topic_mode": "fixed-theme",
                "search_attempts": [
                    {"window_days": 7, "status": "PASS", "result_count": 1}
                ],
            }
        )
        payload["selected_event"]["published_at"] = (
            self.now - timedelta(days=8)
        ).isoformat(timespec="seconds")
        with self.assertRaisesRegex(MODULE.ValidationError, "within the search window"):
            MODULE.validate_topic_evidence(payload)

    def test_copy_counts_internal_whitespace(self):
        self.assertEqual(12, MODULE.count_visible_chars("AI Agent\n真有用"))

    def test_short_copy_accepts_140_and_rejects_141(self):
        self.assertEqual(
            140, MODULE.validate_copy("微" * 140, "short")["character_count"]
        )
        with self.assertRaisesRegex(MODULE.ValidationError, "1-140"):
            MODULE.validate_copy("微" * 141, "short")

    def test_long_copy_accepts_1500_to_2000_character_bounds(self):
        self.assertEqual(
            1500, MODULE.validate_copy("长" * 1500, "long")["character_count"]
        )
        self.assertEqual(
            2000, MODULE.validate_copy("长" * 2000, "long")["character_count"]
        )
        for count in (1499, 2001):
            with self.subTest(count=count):
                with self.assertRaisesRegex(MODULE.ValidationError, "1500-2000"):
                    MODULE.validate_copy("长" * count, "long")

    def test_long_copy_bundle_accepts_hotspot_ai_ratio_boundaries_and_target(self):
        cases = (
            (720, 630, 450, 0.40, 0.35, 0.75, 0.25),
            (540, 900, 360, 0.30, 0.50, 0.80, 0.20),
            (540, 990, 270, 0.30, 0.55, 0.85, 0.15),
        )
        for context_count, analysis_count, ai_count, *ratios in cases:
            with self.subTest(
                context_count=context_count,
                analysis_count=analysis_count,
                ai_count=ai_count,
            ):
                text, ledger = long_copy_bundle(
                    context_count, analysis_count, ai_count
                )
                result = MODULE.validate_long_copy_bundle(text, ledger)
                self.assertEqual(1800, result["body_character_count"])
                self.assertEqual(ratios[0], result["event_context_ratio"])
                self.assertEqual(ratios[1], result["hotspot_analysis_ratio"])
                self.assertEqual(ratios[2], result["hotspot_ratio"])
                self.assertEqual(ratios[3], result["ai_ratio"])
                self.assertEqual(
                    ["cause", "process", "result"],
                    result["event_context_elements"],
                )
                self.assertEqual(
                    [
                        "mechanism",
                        "impact",
                        "judgment",
                        "boundary_or_counterpoint",
                    ],
                    result["analysis_facets"],
                )
                self.assertEqual("none", result["product_mention_decision"])
                self.assertFalse(result["product_mentioned"])

    def test_long_copy_bundle_rejects_ratio_outside_allowed_range(self):
        for context_count, analysis_count, ai_count in (
            (540, 809, 451),
            (540, 991, 269),
        ):
            with self.subTest(context_count=context_count):
                text, ledger = long_copy_bundle(
                    context_count, analysis_count, ai_count
                )
                with self.assertRaisesRegex(
                    MODULE.ValidationError, "between 75% and 85%"
                ):
                    MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_event_context_over_40_percent(self):
        text, ledger = long_copy_bundle(738, 702, 360)
        with self.assertRaisesRegex(MODULE.ValidationError, "event context"):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_hotspot_analysis_under_35_percent(self):
        text, ledger = long_copy_bundle(720, 612, 468)
        with self.assertRaisesRegex(MODULE.ValidationError, "hotspot analysis"):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_requires_every_event_context_element(self):
        text, ledger = long_copy_bundle()
        ledger["event_context"]["result"] = []
        with self.assertRaisesRegex(
            MODULE.ValidationError, "event_context.result must not be empty"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_requires_ai_content(self):
        text, ledger = long_copy_bundle()
        ledger["ai_analysis"] = []
        with self.assertRaisesRegex(
            MODULE.ValidationError, "ai_analysis must not be empty"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_requires_every_analysis_facet(self):
        text, ledger = long_copy_bundle()
        ledger["analysis_facets"]["mechanism"] = []
        with self.assertRaisesRegex(
            MODULE.ValidationError, "analysis_facets.mechanism must not be empty"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_requires_facets_inside_hotspot_analysis(self):
        text, ledger = long_copy_bundle()
        ledger["analysis_facets"]["mechanism"] = [
            ledger["event_context"]["cause"][0]
        ]
        with self.assertRaisesRegex(
            MODULE.ValidationError, "inside hotspot_analysis"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_overlapping_analysis_facets(self):
        text, ledger = long_copy_bundle()
        old_analysis = ledger["hotspot_analysis"][0]
        analysis = "甲" * 225 + "乙" * 225 + "丙" * 225 + "丁" * 225
        text = text.replace(old_analysis, analysis)
        ledger["hotspot_analysis"] = [analysis]
        ledger["analysis_facets"] = {
            "mechanism": [analysis[:240]],
            "impact": [analysis[210:450]],
            "judgment": ["丙" * 225],
            "boundary_or_counterpoint": ["丁" * 225],
        }
        with self.assertRaisesRegex(MODULE.ValidationError, "must not overlap"):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_uncovered_body_text(self):
        text, ledger = long_copy_bundle()
        text = text.replace(
            ledger["ai_analysis"][0], "漏标" + ledger["ai_analysis"][0]
        )
        with self.assertRaisesRegex(
            MODULE.ValidationError, "cover the complete publishable body"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_counts_internal_whitespace_in_ratio_denominator(self):
        text, ledger = long_copy_bundle()
        analysis = ledger["hotspot_analysis"][0]
        ai = ledger["ai_analysis"][0]
        text = text.replace(analysis + ai, analysis + " \n" + ai)

        result = MODULE.validate_long_copy_bundle(text, ledger)

        self.assertEqual(1802, result["body_character_count"])
        self.assertEqual(0.7991, result["hotspot_ratio"])
        self.assertEqual(0.1998, result["ai_ratio"])

    def test_long_copy_bundle_requires_ai_after_hotspot_analysis(self):
        text, ledger = long_copy_bundle()
        analysis = ledger["hotspot_analysis"][0]
        ai = ledger["ai_analysis"][0]
        text = text.replace(analysis + ai, ai + analysis)
        with self.assertRaisesRegex(
            MODULE.ValidationError,
            "cause, process, result, hotspot_analysis, then ai_analysis",
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_allows_evidence_backed_product_inside_ai(self):
        text, ledger = long_copy_bundle(product=True)
        result = MODULE.validate_long_copy_bundle(text, ledger)
        self.assertTrue(result["product_mentioned"])
        self.assertEqual("allowed", result["product_mention_decision"])

    def test_long_copy_bundle_allows_allowed_decision_without_product_copy(self):
        text, ledger = long_copy_bundle(product_decision="allowed")
        result = MODULE.validate_long_copy_bundle(text, ledger)
        self.assertFalse(result["product_mentioned"])

    def test_long_copy_bundle_rejects_product_outside_ai(self):
        text, ledger = long_copy_bundle(product=True)
        product = ledger["product_segments"][0]
        ai = ledger["ai_analysis"][0]
        ledger["ai_analysis"] = [ai.replace(product, "智" * len(product))]
        analysis = ledger["hotspot_analysis"][0]
        ledger["hotspot_analysis"] = [analysis + product]
        text = text.replace(
            analysis + ai,
            ledger["hotspot_analysis"][0] + ledger["ai_analysis"][0],
        )
        with self.assertRaisesRegex(
            MODULE.ValidationError, "contained inside ai_analysis"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_none_decision_with_product(self):
        text, ledger = long_copy_bundle(product=True, product_decision="none")
        with self.assertRaisesRegex(
            MODULE.ValidationError, "decision none requires empty product fields"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_product_over_quarter_of_ai(self):
        text, ledger = long_copy_bundle(product=True)
        ledger["product_segments"] = [ledger["ai_analysis"][0][:91]]
        with self.assertRaisesRegex(MODULE.ValidationError, "25% of ai content"):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_rejects_product_without_evidence(self):
        text, ledger = long_copy_bundle(product=True)
        ledger["product_evidence_refs"] = []
        with self.assertRaisesRegex(
            MODULE.ValidationError, "both be empty or both be non-empty"
        ):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_long_copy_bundle_requires_exact_ledger_segments(self):
        text, ledger = long_copy_bundle()
        ledger["hotspot_analysis"] = ["文中不存在的评论段"]
        with self.assertRaisesRegex(MODULE.ValidationError, "appear exactly once"):
            MODULE.validate_long_copy_bundle(text, ledger)

    def test_image_manifest_accepts_factual_and_generated_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            (root / "prompts").mkdir()
            for index in range(1, 5):
                (root / f"{index}.png").write_bytes(b"\x89PNG\r\n\x1a\ncontent")
            for index in range(2, 5):
                (root / f"prompts/{index}.md").write_text(f"prompt {index}")
            payload = {
                "route": "long",
                "chosen_total": 4,
                "selection_reason": "One factual image and three product anchors",
                **image_stage_metadata(publish_ready_count=1),
                "factual_images": [
                    {
                        "file": "1.png",
                        "source_page": "https://example.com/report",
                        "publisher": "Example Authority",
                        "retrieved_at": "2026-07-29T12:00:00+00:00",
                        "caption": "原始报告截图",
                        "usage_status": "publish-ready",
                    }
                ],
                "generated_images": [
                    {
                        "file": f"{index}.png",
                        "prompt_path": f"prompts/{index}.md",
                        "qa_status": "pass",
                    }
                    for index in range(2, 5)
                ],
            }
            result = MODULE.validate_image_manifest(payload, root)
            self.assertEqual(
                {
                    "route": "long",
                    "chosen_total": 4,
                    "selection_reason": "One factual image and three product anchors",
                    "factual_count": 1,
                    "reference_count": 0,
                    "generated_count": 3,
                    "generation_provider": "post-illustration-images",
                    "generated_target": 3,
                    "total_count": 4,
                },
                result,
            )

    def test_image_manifest_accepts_allowed_totals_for_long_route(self):
        for chosen_total in (1, 2, 3, 4, 6, 9):
            with self.subTest(chosen_total=chosen_total):
                with tempfile.TemporaryDirectory() as temp_dir:
                    root = pathlib.Path(temp_dir)
                    payload = generated_image_manifest(
                        root, route="long", chosen_total=chosen_total
                    )
                    result = MODULE.validate_image_manifest(payload, root)
                self.assertEqual("long", result["route"])
                self.assertEqual(chosen_total, result["chosen_total"])
                self.assertEqual(0, result["reference_count"])
                self.assertEqual(
                    "post-illustration-images", result["generation_provider"]
                )
                self.assertEqual(chosen_total, result["generated_target"])
                self.assertEqual(chosen_total, result["total_count"])

    def test_image_manifest_rejects_legacy_short_route(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            payload = generated_image_manifest(root, route="short")
            with self.assertRaisesRegex(
                MODULE.ValidationError, "image manifest route must be long"
            ):
                MODULE.validate_image_manifest(payload, root)

    def test_image_manifest_rejects_disallowed_totals(self):
        for chosen_total in (0, 5, 7, 8, 10):
            with self.subTest(chosen_total=chosen_total):
                with tempfile.TemporaryDirectory() as temp_dir:
                    root = pathlib.Path(temp_dir)
                    payload = generated_image_manifest(
                        root, chosen_total=chosen_total
                    )
                    with self.assertRaisesRegex(
                        MODULE.ValidationError,
                        "chosen_total must be one of 1, 2, 3, 4, 6, or 9",
                    ):
                        MODULE.validate_image_manifest(payload, root)

    def test_image_manifest_rejects_count_mismatch(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            payload = generated_image_manifest(
                root, route="long", chosen_total=4, actual_total=3
            )
            with self.assertRaisesRegex(
                MODULE.ValidationError, "image rows must equal chosen_total"
            ):
                MODULE.validate_image_manifest(payload, root)

    def test_image_manifest_requires_route_and_selection_reason(self):
        cases = ((None, "valid reason", "route must be long"),
                 ("other", "valid reason", "route must be long"),
                 ("long", "  ", "selection_reason must be a non-empty string"))
        for route, reason, message in cases:
            with self.subTest(route=route, reason=reason):
                with tempfile.TemporaryDirectory() as temp_dir:
                    root = pathlib.Path(temp_dir)
                    payload = generated_image_manifest(root)
                    payload["route"] = route
                    payload["selection_reason"] = reason
                    with self.assertRaisesRegex(MODULE.ValidationError, message):
                        MODULE.validate_image_manifest(payload, root)

    def test_image_manifest_rejects_unverified_factual_image(self):
        payload = {
            "route": "long",
            "chosen_total": 1,
            "selection_reason": "The factual image is the only necessary anchor",
            **image_stage_metadata(publish_ready_count=1, provider="none"),
            "factual_images": [
                {
                    "file": "1.png",
                    "source_page": "https://example.com/report",
                    "publisher": "Example Authority",
                    "retrieved_at": "2026-07-29T12:00:00+00:00",
                    "caption": "原始报告截图",
                    "usage_status": "verification_required",
                }
            ],
            "generated_images": [],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(MODULE.ValidationError, "publish-ready"):
                MODULE.validate_image_manifest(payload, pathlib.Path(temp_dir))

    def test_image_manifest_names_invalid_retrieved_at_field(self):
        payload = {
            "route": "long",
            "chosen_total": 1,
            "selection_reason": "The factual image is the only necessary anchor",
            **image_stage_metadata(publish_ready_count=1, provider="none"),
            "factual_images": [
                {
                    "file": "1.png",
                    "source_page": "https://example.com/report",
                    "publisher": "Example Authority",
                    "retrieved_at": "not-a-time",
                    "caption": "原始报告截图",
                    "usage_status": "publish-ready",
                }
            ],
            "generated_images": [],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(MODULE.ValidationError, "retrieved_at must"):
                MODULE.validate_image_manifest(payload, pathlib.Path(temp_dir))

    def test_image_manifest_rejects_failed_generated_qa(self):
        payload = {
            "route": "long",
            "chosen_total": 1,
            "selection_reason": "One product illustration is sufficient",
            **image_stage_metadata(),
            "factual_images": [],
            "generated_images": [
                {"file": "1.png", "prompt_path": "1.md", "qa_status": "failed"}
            ],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(MODULE.ValidationError, "qa_status must be pass"):
                MODULE.validate_image_manifest(payload, pathlib.Path(temp_dir))

    def test_reference_only_image_does_not_occupy_a_delivery_slot(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            (root / "references").mkdir()
            (root / "generated").mkdir()
            (root / "prompts").mkdir()
            (root / "references/01-source.png").write_bytes(
                b"\x89PNG\r\n\x1a\nreference"
            )
            (root / "generated/01-explainer.png").write_bytes(
                b"\x89PNG\r\n\x1a\ngenerated"
            )
            (root / "prompts/01-explainer.md").write_text(
                "grounded explainer prompt", encoding="utf-8"
            )
            payload = {
                "route": "long",
                "chosen_total": 1,
                "selection_reason": "One generated explainer covers the visual anchor",
                **image_stage_metadata(
                    reference_only_count=1, provider="imagegen"
                ),
                "factual_images": [],
                "reference_images": [
                    {
                        "file": "references/01-source.png",
                        "source_page": "https://example.com/original",
                        "publisher": "Original Publisher",
                        "retrieved_at": "2026-07-30T12:00:00+08:00",
                        "caption": "Internal factual reference",
                        "usage_status": "verification_required",
                    }
                ],
                "generated_images": [
                    {
                        "file": "generated/01-explainer.png",
                        "prompt_path": "prompts/01-explainer.md",
                        "qa_status": "pass",
                    }
                ],
            }
            payload["generation"].update(
                {
                    "fallback_from": "post-illustration-images",
                    "fallback_reason": "style reference PNG failed decoding",
                    "style_reference_status": "skipped-corrupt",
                }
            )
            result = MODULE.validate_image_manifest(payload, root)
        self.assertEqual(1, result["reference_count"])
        self.assertEqual(1, result["generated_count"])
        self.assertEqual(1, result["total_count"])
        self.assertEqual("imagegen", result["generation_provider"])

    def test_reference_image_requires_verification_required_status(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            payload = generated_image_manifest(root)
            payload["factual_discovery"]["reference_only_count"] = 1
            payload["reference_images"] = [
                {
                    "file": "reference.png",
                    "source_page": "https://example.com/original",
                    "publisher": "Original Publisher",
                    "retrieved_at": "2026-07-30T12:00:00+08:00",
                    "caption": "Reference",
                    "usage_status": "publish-ready",
                }
            ]
            with self.assertRaisesRegex(
                MODULE.ValidationError,
                "reference image usage_status must be verification_required",
            ):
                MODULE.validate_image_manifest(payload, root)

    def test_imagegen_fallback_requires_lineage_reason(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            payload = generated_image_manifest(root)
            payload["generation"].update(
                {
                    "provider": "imagegen",
                    "fallback_from": "post-illustration-images",
                    "fallback_reason": None,
                    "style_reference_status": "skipped-corrupt",
                }
            )
            with self.assertRaisesRegex(
                MODULE.ValidationError, "imagegen fallback_reason must be non-empty"
            ):
                MODULE.validate_image_manifest(payload, root)

    def test_cli_copy_success_prints_json_summary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            copy_path = pathlib.Path(temp_dir) / "copy.txt"
            copy_path.write_text("微博正文", encoding="utf-8")
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                exit_code = MODULE.main(
                    ["copy", str(copy_path), "--route", "short"]
                )
        self.assertEqual(0, exit_code)
        self.assertEqual(
            {"ok": True, "route": "short", "character_count": 4},
            json.loads(stdout.getvalue()),
        )

    def test_cli_topic_evidence_prints_json_summary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            evidence_path = pathlib.Path(temp_dir) / "topic-evidence.json"
            evidence_path.write_text(
                json.dumps(fixed_event_payload(self.now)), encoding="utf-8"
            )
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                exit_code = MODULE.main(["topic-evidence", str(evidence_path)])
        self.assertEqual(0, exit_code)
        self.assertEqual("fixed-event", json.loads(stdout.getvalue())["topic_mode"])

    def test_cli_long_copy_prints_composition_summary(self):
        text, ledger = long_copy_bundle()
        with tempfile.TemporaryDirectory() as temp_dir:
            copy_path = pathlib.Path(temp_dir) / "final.md"
            ledger_path = pathlib.Path(temp_dir) / "copy-ledger.json"
            copy_path.write_text(text, encoding="utf-8")
            ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                exit_code = MODULE.main(
                    ["long-copy", str(copy_path), "--ledger", str(ledger_path)]
                )
        self.assertEqual(0, exit_code)
        self.assertEqual(0.8, json.loads(stdout.getvalue())["hotspot_ratio"])
        self.assertEqual(0.2, json.loads(stdout.getvalue())["ai_ratio"])

if __name__ == "__main__":
    unittest.main()
