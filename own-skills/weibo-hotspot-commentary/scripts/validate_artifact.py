#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone


ALLOWED_IMAGE_TOTALS = frozenset((1, 2, 3, 4, 6, 9))
HOT_TOPIC_COUNT = 50
EVENT_CONTEXT_ELEMENTS = ("cause", "process", "result")
ANALYSIS_FACETS = (
    "mechanism",
    "impact",
    "judgment",
    "boundary_or_counterpoint",
)


class ValidationError(ValueError):
    pass


def count_visible_chars(text):
    return len(text.strip())


def _parse_time(value, field_name="generated_at"):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as exc:
        raise ValidationError(f"{field_name} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValidationError(f"{field_name} must include a timezone")
    return parsed


def validate_hot_topics(payload, now=None, max_age_minutes=10):
    now = now or datetime.now(timezone.utc)
    if not payload.get("ok"):
        raise ValidationError("hot-topics provider did not succeed")
    if payload.get("platform") != "weibo":
        raise ValidationError("hot-topics platform must be weibo")
    items = payload.get("data")
    if (
        payload.get("count") != HOT_TOPIC_COUNT
        or not isinstance(items, list)
        or len(items) != HOT_TOPIC_COUNT
    ):
        raise ValidationError("hot-topics snapshot must contain exactly 50 items")
    titles = [str(item.get("title", "")).strip() for item in items]
    if any(not title for title in titles):
        raise ValidationError("every hot topic must have a title")
    if len({title.casefold() for title in titles}) != HOT_TOPIC_COUNT:
        raise ValidationError("hot-topics snapshot must contain 50 unique titles")
    if [item.get("rank") for item in items] != list(
        range(1, HOT_TOPIC_COUNT + 1)
    ):
        raise ValidationError("hot-topics ranks must be exactly 1 through 50")
    generated_at = _parse_time(payload.get("generated_at"))
    age_seconds = (
        now.astimezone(timezone.utc) - generated_at.astimezone(timezone.utc)
    ).total_seconds()
    if age_seconds < -60:
        raise ValidationError("generated_at is in the future")
    if age_seconds > max_age_minutes * 60:
        raise ValidationError(
            f"hot-topics snapshot is older than {max_age_minutes} minutes"
        )
    return {"topic_count": HOT_TOPIC_COUNT, "fresh": True}


def validate_hot_topic_review(payload, snapshot):
    if payload.get("platform") != "weibo":
        raise ValidationError("hot-topic review platform must be weibo")
    reviewed_at = _parse_time(payload.get("reviewed_at"), "reviewed_at")
    validate_hot_topics(snapshot, now=reviewed_at)

    rows = payload.get("topics")
    if not isinstance(rows, list) or len(rows) != HOT_TOPIC_COUNT:
        raise ValidationError("hot-topic review must contain exactly 50 rows")
    if any(not isinstance(item, dict) for item in rows):
        raise ValidationError("hot-topic review rows must be objects")

    expected = [
        (item["rank"], str(item["title"]).strip()) for item in snapshot["data"]
    ]
    actual = [
        (item.get("rank"), str(item.get("title", "")).strip()) for item in rows
    ]
    if actual != expected:
        raise ValidationError(
            "hot-topic review ranks and titles must match the snapshot"
        )

    pass_count = 0
    for item in rows:
        status = item.get("review_status")
        if status not in {"PASS", "REJECTED"}:
            raise ValidationError("review_status must be PASS or REJECTED")
        reason = item.get("review_reason")
        if not isinstance(reason, str) or not reason.strip():
            raise ValidationError("every hot-topic review row needs a reason")
        evidence = item.get("evidence_urls", [])
        flags = item.get("risk_flags", [])
        if status == "PASS":
            if (
                not isinstance(evidence, list)
                or not evidence
                or any(
                    not str(url).startswith(("http://", "https://"))
                    for url in evidence
                )
            ):
                raise ValidationError(
                    "PASS hot-topic rows need HTTP(S) evidence"
                )
            pass_count += 1
        elif (
            not isinstance(flags, list)
            or not flags
            or any(not str(flag).strip() for flag in flags)
        ):
            raise ValidationError("REJECTED hot-topic rows need a risk flag")

    return {
        "reviewed_count": HOT_TOPIC_COUNT,
        "pass_count": pass_count,
        "rejected_count": HOT_TOPIC_COUNT - pass_count,
    }


def validate_topic_evidence(payload):
    if payload.get("platform") != "weibo":
        raise ValidationError("topic evidence platform must be weibo")
    topic_mode = payload.get("topic_mode")
    if topic_mode not in {"fixed-event", "fixed-theme"}:
        raise ValidationError("topic_mode must be fixed-event or fixed-theme")
    requested_topic = payload.get("requested_topic")
    if not isinstance(requested_topic, str) or not requested_topic.strip():
        raise ValidationError("requested_topic must be a non-empty string")
    reviewed_at = _parse_time(payload.get("reviewed_at"), "reviewed_at")

    attempts = payload.get("search_attempts")
    search_window_days = None
    if topic_mode == "fixed-event":
        if attempts != []:
            raise ValidationError("fixed-event search_attempts must be empty")
    else:
        if not isinstance(attempts, list) or len(attempts) not in {1, 2}:
            raise ValidationError("fixed-theme needs one or two search_attempts")
        expected_windows = [7] if len(attempts) == 1 else [7, 30]
        if [item.get("window_days") for item in attempts] != expected_windows:
            raise ValidationError("fixed-theme search windows must be 7 then 30 days")
        statuses = [item.get("status") for item in attempts]
        valid_statuses = [["PASS"]]
        if len(attempts) == 2:
            valid_statuses = [
                ["NO_ACCEPTABLE_EVENT", "PASS"],
                ["NO_ACCEPTABLE_EVENT", "NO_ACCEPTABLE_EVENT"],
            ]
        if statuses not in valid_statuses:
            raise ValidationError(
                "fixed-theme may expand only after NO_ACCEPTABLE_EVENT"
            )
        for item in attempts:
            status = item.get("status")
            result_count = item.get("result_count")
            if type(result_count) is not int or result_count < 0:
                raise ValidationError("search_attempt result_count must be non-negative")
            if status == "PASS" and result_count < 1:
                raise ValidationError("PASS search_attempt needs at least one result")
        search_window_days = expected_windows[-1]

    selected = payload.get("selected_event")
    if (
        topic_mode == "fixed-theme"
        and attempts[-1]["status"] == "NO_ACCEPTABLE_EVENT"
    ):
        if selected is not None:
            raise ValidationError("no-current-event evidence cannot select an event")
        if payload.get("terminal_reason") != "no_current_event_anchor":
            raise ValidationError(
                "no-current-event evidence needs terminal_reason no_current_event_anchor"
            )
        return {
            "topic_mode": topic_mode,
            "review_status": "REJECTED",
            "event_title": None,
            "search_window_days": search_window_days,
            "terminal_reason": "no_current_event_anchor",
        }
    if not isinstance(selected, dict):
        raise ValidationError("selected_event must be an object")
    title = selected.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValidationError("selected_event title must be non-empty")
    published_at = _parse_time(selected.get("published_at"), "published_at")
    if topic_mode == "fixed-theme":
        age_seconds = (
            reviewed_at.astimezone(timezone.utc)
            - published_at.astimezone(timezone.utc)
        ).total_seconds()
        if age_seconds < 0 or age_seconds > search_window_days * 24 * 60 * 60:
            raise ValidationError("selected_event must fall within the search window")
    source_url = selected.get("source_url")
    if not str(source_url).startswith(("http://", "https://")):
        raise ValidationError("selected_event source_url must be HTTP(S)")
    evidence_urls = selected.get("evidence_urls")
    if (
        not isinstance(evidence_urls, list)
        or not evidence_urls
        or any(
            not str(url).startswith(("http://", "https://"))
            for url in evidence_urls
        )
    ):
        raise ValidationError("selected_event needs HTTP(S) evidence")
    review_status = selected.get("review_status")
    if review_status not in {"PASS", "REJECTED"}:
        raise ValidationError("selected_event review_status must be PASS or REJECTED")
    reason = selected.get("review_reason")
    if not isinstance(reason, str) or not reason.strip():
        raise ValidationError("selected_event review_reason must be non-empty")
    if review_status == "REJECTED":
        flags = selected.get("risk_flags")
        if (
            not isinstance(flags, list)
            or not flags
            or any(not str(flag).strip() for flag in flags)
        ):
            raise ValidationError("REJECTED selected_event needs a risk flag")

    result = {
        "topic_mode": topic_mode,
        "review_status": review_status,
        "event_title": title.strip(),
    }
    if search_window_days is not None:
        result["search_window_days"] = search_window_days
    return result


def validate_copy(text, route):
    limits = {"short": (1, 140), "long": (1500, 2000)}
    if route not in limits:
        raise ValidationError("route must be short or long")
    count = count_visible_chars(text)
    minimum, maximum = limits[route]
    if count < minimum or count > maximum:
        raise ValidationError(
            f"{route} copy must contain {minimum}-{maximum} visible characters"
        )
    return {"route": route, "character_count": count}


def _exact_segment_spans(text, values, field_name):
    spans = []
    seen = set()
    for value in values:
        if not isinstance(value, str) or not value.strip():
            raise ValidationError(f"{field_name} entries must be non-empty strings")
        if value in seen:
            raise ValidationError(f"{field_name} entries must be unique")
        seen.add(value)
        if text.count(value) != 1:
            raise ValidationError(
                f"every {field_name} entry must appear exactly once in the long copy"
            )
        start = text.index(value)
        spans.append((start, start + len(value)))
    return spans


def _ensure_non_overlapping(spans):
    ordered = sorted(spans)
    for previous, current in zip(ordered, ordered[1:]):
        if current[0] < previous[1]:
            raise ValidationError("copy ledger segments must not overlap")


def _require_string_list(value, field_name, allow_empty=False):
    if not isinstance(value, list):
        raise ValidationError(f"copy ledger {field_name} must be an array")
    if not allow_empty and not value:
        raise ValidationError(f"copy ledger {field_name} must not be empty")
    if any(not isinstance(item, str) or not item.strip() for item in value):
        raise ValidationError(
            f"copy ledger {field_name} entries must be non-empty strings"
        )
    return value


def validate_long_copy_bundle(text, ledger):
    total = validate_copy(text, "long")["character_count"]
    if not isinstance(ledger, dict):
        raise ValidationError("copy ledger must be an object")
    topic_id = ledger.get("topic_id")
    if not isinstance(topic_id, str) or not topic_id.strip():
        raise ValidationError("copy ledger topic_id must be non-empty")
    title = ledger.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValidationError("copy ledger title must be non-empty")

    hashtags = _require_string_list(ledger.get("hashtags"), "hashtags", True)
    captions = _require_string_list(
        ledger.get("image_captions"), "image_captions", True
    )
    event_context = ledger.get("event_context")
    if (
        not isinstance(event_context, dict)
        or set(event_context) != set(EVENT_CONTEXT_ELEMENTS)
    ):
        raise ValidationError(
            "copy ledger event_context must contain cause, process, and result"
        )
    event_groups = [
        _require_string_list(
            event_context[key], f"event_context.{key}"
        )
        for key in EVENT_CONTEXT_ELEMENTS
    ]
    hotspot_analysis = _require_string_list(
        ledger.get("hotspot_analysis"), "hotspot_analysis"
    )
    analysis_facets = ledger.get("analysis_facets")
    if (
        not isinstance(analysis_facets, dict)
        or set(analysis_facets) != set(ANALYSIS_FACETS)
    ):
        raise ValidationError(
            "copy ledger analysis_facets must contain mechanism, impact, "
            "judgment, and boundary_or_counterpoint"
        )
    facet_groups = [
        _require_string_list(
            analysis_facets[key], f"analysis_facets.{key}"
        )
        for key in ANALYSIS_FACETS
    ]
    ai_analysis = _require_string_list(
        ledger.get("ai_analysis"), "ai_analysis"
    )
    product_decision = ledger.get("product_mention_decision")
    if product_decision not in {"none", "allowed"}:
        raise ValidationError(
            "copy ledger product_mention_decision must be none or allowed"
        )
    product_segments = _require_string_list(
        ledger.get("product_segments"), "product_segments", True
    )
    product_refs = _require_string_list(
        ledger.get("product_evidence_refs"), "product_evidence_refs", True
    )

    excluded_spans = _exact_segment_spans(
        text, [title, *hashtags, *captions], "excluded"
    )
    primary_groups = [*event_groups, hotspot_analysis, ai_analysis]
    primary_values = [value for group in primary_groups for value in group]
    primary_spans = _exact_segment_spans(text, primary_values, "body segments")
    _ensure_non_overlapping([*excluded_spans, *primary_spans])
    if any(
        current[0] < previous[1]
        for previous, current in zip(primary_spans, primary_spans[1:])
    ):
        raise ValidationError(
            "body segments must follow cause, process, result, "
            "hotspot_analysis, then ai_analysis"
        )

    uncovered = text
    for start, end in sorted([*excluded_spans, *primary_spans], reverse=True):
        uncovered = uncovered[:start] + uncovered[end:]
    if uncovered.strip():
        raise ValidationError(
            "body segments must cover the complete publishable body"
        )

    body = text
    for start, end in sorted(excluded_spans, reverse=True):
        body = body[:start] + body[end:]

    facet_values = [value for group in facet_groups for value in group]
    facet_spans = _exact_segment_spans(
        text, facet_values, "analysis facet segments"
    )
    _ensure_non_overlapping(facet_spans)
    event_value_count = sum(len(group) for group in event_groups)
    hotspot_spans = primary_spans[
        event_value_count : event_value_count + len(hotspot_analysis)
    ]
    if any(
        not any(
            hotspot_start <= start and end <= hotspot_end
            for hotspot_start, hotspot_end in hotspot_spans
        )
        for start, end in facet_spans
    ):
        raise ValidationError(
            "analysis facet segments must be contained inside hotspot_analysis"
        )

    if product_decision == "none" and (product_segments or product_refs):
        raise ValidationError(
            "product_mention_decision none requires empty product fields"
        )
    if bool(product_segments) != bool(product_refs):
        raise ValidationError(
            "product segments and product evidence refs must both be empty "
            "or both be non-empty"
        )
    if any(
        not ref.startswith(("http://", "https://")) for ref in product_refs
    ):
        raise ValidationError("product evidence refs must be HTTP(S)")

    product_spans = _exact_segment_spans(
        text, product_segments, "product_segments"
    )
    _ensure_non_overlapping(product_spans)
    ai_spans = primary_spans[-len(ai_analysis) :]
    if any(
        not any(
            ai_start <= start and end <= ai_end
            for ai_start, ai_end in ai_spans
        )
        for start, end in product_spans
    ):
        raise ValidationError(
            "product segments must be contained inside ai_analysis"
        )

    event_count = sum(
        count_visible_chars(value)
        for group in event_groups
        for value in group
    )
    analysis_count = sum(
        count_visible_chars(value) for value in hotspot_analysis
    )
    hotspot_count = event_count + analysis_count
    ai_count = sum(count_visible_chars(value) for value in ai_analysis)
    product_count = sum(
        count_visible_chars(value) for value in product_segments
    )
    body_count = count_visible_chars(body)
    if event_count * 100 > body_count * 40:
        raise ValidationError(
            "event context must not exceed 40% of the publishable body"
        )
    if analysis_count * 100 < body_count * 35:
        raise ValidationError(
            "hotspot analysis must be at least 35% of the publishable body"
        )
    if (
        hotspot_count * 100 < body_count * 75
        or hotspot_count * 100 > body_count * 85
    ):
        raise ValidationError(
            "hotspot content must be between 75% and 85% of the publishable body"
        )
    if ai_count * 100 < body_count * 15 or ai_count * 100 > body_count * 25:
        raise ValidationError(
            "ai content must be between 15% and 25% of the publishable body"
        )
    if product_count * 100 > ai_count * 25:
        raise ValidationError(
            "product content must not exceed 25% of ai content"
        )

    return {
        "route": "long",
        "character_count": total,
        "body_character_count": body_count,
        "event_context_character_count": event_count,
        "event_context_ratio": round(event_count / body_count, 4),
        "hotspot_analysis_character_count": analysis_count,
        "hotspot_analysis_ratio": round(analysis_count / body_count, 4),
        "hotspot_character_count": hotspot_count,
        "hotspot_ratio": round(hotspot_count / body_count, 4),
        "ai_character_count": ai_count,
        "ai_ratio": round(ai_count / body_count, 4),
        "event_context_elements": list(EVENT_CONTEXT_ELEMENTS),
        "analysis_facets": list(ANALYSIS_FACETS),
        "product_mention_decision": product_decision,
        "product_character_count": product_count,
        "product_mentioned": bool(product_segments),
    }


def _resolve_artifact(base_dir, value):
    if not value or not isinstance(value, str):
        raise ValidationError("artifact path must be a non-empty string")
    base = base_dir.resolve()
    path = (base / value).resolve()
    try:
        path.relative_to(base)
    except ValueError as exc:
        raise ValidationError(
            "artifact path must stay inside the manifest directory"
        ) from exc
    return path


def _is_raster(path):
    if not path.is_file():
        return False
    head = path.read_bytes()[:12]
    return (
        head.startswith(b"\x89PNG\r\n\x1a\n")
        or head.startswith(b"\xff\xd8\xff")
        or head.startswith((b"GIF87a", b"GIF89a"))
        or (head.startswith(b"RIFF") and head[8:12] == b"WEBP")
    )


def validate_image_manifest(payload, base_dir):
    route = payload.get("route")
    if route != "long":
        raise ValidationError("image manifest route must be long")

    chosen_total = payload.get("chosen_total")
    if type(chosen_total) is not int or chosen_total not in ALLOWED_IMAGE_TOTALS:
        raise ValidationError("chosen_total must be one of 1, 2, 3, 4, 6, or 9")

    selection_reason = payload.get("selection_reason")
    if not isinstance(selection_reason, str) or not selection_reason.strip():
        raise ValidationError("selection_reason must be a non-empty string")
    selection_reason = selection_reason.strip()

    factual = payload.get("factual_images", [])
    references = payload.get("reference_images", [])
    generated = payload.get("generated_images", [])
    if (
        not isinstance(factual, list)
        or not isinstance(references, list)
        or not isinstance(generated, list)
    ):
        raise ValidationError("image manifest lists must be arrays")

    discovery = payload.get("factual_discovery")
    if not isinstance(discovery, dict) or discovery.get("status") != "PASS":
        raise ValidationError("factual_discovery status must be PASS")
    for field in (
        "searched_claim_count",
        "publish_ready_count",
        "reference_only_count",
    ):
        if type(discovery.get(field)) is not int or discovery[field] < 0:
            raise ValidationError(
                f"factual_discovery {field} must be a non-negative integer"
            )
    if discovery["publish_ready_count"] != len(factual):
        raise ValidationError("publish_ready_count must equal factual image rows")
    if discovery["reference_only_count"] != len(references):
        raise ValidationError(
            "reference_only_count must equal reference image rows"
        )

    generation = payload.get("generation")
    if not isinstance(generation, dict):
        raise ValidationError("generation must be an object")
    provider = generation.get("provider")
    if generated:
        if provider not in {"post-illustration-images", "imagegen"}:
            raise ValidationError(
                "generated images require post-illustration-images or imagegen"
            )
        style_reference_status = generation.get("style_reference_status")
        if (
            not isinstance(style_reference_status, str)
            or not style_reference_status.strip()
        ):
            raise ValidationError("style_reference_status must be non-empty")
        if provider == "imagegen":
            if generation.get("fallback_from") != "post-illustration-images":
                raise ValidationError(
                    "imagegen fallback_from must be post-illustration-images"
                )
            fallback_reason = generation.get("fallback_reason")
            if not isinstance(fallback_reason, str) or not fallback_reason.strip():
                raise ValidationError(
                    "imagegen fallback_reason must be non-empty"
                )
    elif provider != "none":
        raise ValidationError("generation provider must be none without generated images")

    seen = set()
    factual_fields = (
        "file",
        "source_page",
        "publisher",
        "retrieved_at",
        "caption",
        "usage_status",
    )
    for item in factual:
        missing = [field for field in factual_fields if not item.get(field)]
        if missing:
            raise ValidationError("factual image is missing: " + ", ".join(missing))
        if item["usage_status"] != "publish-ready":
            raise ValidationError("factual image usage_status must be publish-ready")
        if not str(item["source_page"]).startswith(("https://", "http://")):
            raise ValidationError("factual image source_page must be HTTP(S)")
        _parse_time(item["retrieved_at"], "retrieved_at")
        path = _resolve_artifact(base_dir, item["file"])
        if path in seen:
            raise ValidationError("image manifest contains duplicate files")
        if not _is_raster(path):
            raise ValidationError(
                f"image is missing or not a readable raster: {item['file']}"
            )
        seen.add(path)

    for item in references:
        missing = [field for field in factual_fields if not item.get(field)]
        if missing:
            raise ValidationError("reference image is missing: " + ", ".join(missing))
        if item["usage_status"] != "verification_required":
            raise ValidationError(
                "reference image usage_status must be verification_required"
            )
        if not str(item["source_page"]).startswith(("https://", "http://")):
            raise ValidationError("reference image source_page must be HTTP(S)")
        _parse_time(item["retrieved_at"], "retrieved_at")
        path = _resolve_artifact(base_dir, item["file"])
        if path in seen:
            raise ValidationError("image manifest contains duplicate files")
        if not _is_raster(path):
            raise ValidationError(
                f"image is missing or not a readable raster: {item['file']}"
            )
        seen.add(path)

    for item in generated:
        missing = [
            field for field in ("file", "prompt_path", "qa_status") if not item.get(field)
        ]
        if missing:
            raise ValidationError("generated image is missing: " + ", ".join(missing))
        if item["qa_status"] != "pass":
            raise ValidationError("generated image qa_status must be pass")
        path = _resolve_artifact(base_dir, item["file"])
        prompt_path = _resolve_artifact(base_dir, item["prompt_path"])
        if path in seen:
            raise ValidationError("image manifest contains duplicate files")
        if not _is_raster(path):
            raise ValidationError(
                f"image is missing or not a readable raster: {item['file']}"
            )
        if not prompt_path.is_file():
            raise ValidationError(
                f"generated image prompt is missing: {item['prompt_path']}"
            )
        seen.add(path)

    total = len(factual) + len(generated)
    if total != chosen_total:
        raise ValidationError("image rows must equal chosen_total")
    return {
        "route": route,
        "chosen_total": chosen_total,
        "selection_reason": selection_reason,
        "factual_count": len(factual),
        "reference_count": len(references),
        "generated_count": len(generated),
        "generation_provider": provider,
        "generated_target": chosen_total - len(factual),
        "total_count": total,
    }


def _read_json(path):
    with pathlib.Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def build_parser():
    parser = argparse.ArgumentParser(description="Validate Weibo production artifacts.")
    commands = parser.add_subparsers(dest="command", required=True)
    topics = commands.add_parser("hot-topics")
    topics.add_argument("input_json")
    topics.add_argument("--max-age-minutes", type=int, default=10)
    review = commands.add_parser("hot-topic-review")
    review.add_argument("input_json")
    review.add_argument("--snapshot", required=True)
    evidence = commands.add_parser("topic-evidence")
    evidence.add_argument("input_json")
    copy = commands.add_parser("copy")
    copy.add_argument("input_text")
    copy.add_argument("--route", choices=("short", "long"), required=True)
    long_copy = commands.add_parser("long-copy")
    long_copy.add_argument("input_text")
    long_copy.add_argument("--ledger", required=True)
    images = commands.add_parser("images")
    images.add_argument("manifest_json")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.command == "hot-topics":
            result = validate_hot_topics(
                _read_json(args.input_json), max_age_minutes=args.max_age_minutes
            )
        elif args.command == "hot-topic-review":
            result = validate_hot_topic_review(
                _read_json(args.input_json), _read_json(args.snapshot)
            )
        elif args.command == "topic-evidence":
            result = validate_topic_evidence(_read_json(args.input_json))
        elif args.command == "copy":
            text = pathlib.Path(args.input_text).read_text(encoding="utf-8")
            result = validate_copy(text, args.route)
        elif args.command == "long-copy":
            text = pathlib.Path(args.input_text).read_text(encoding="utf-8")
            result = validate_long_copy_bundle(text, _read_json(args.ledger))
        else:
            manifest_path = pathlib.Path(args.manifest_json)
            result = validate_image_manifest(
                _read_json(manifest_path), manifest_path.parent
            )
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        print(
            json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 1
    print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
