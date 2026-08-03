#!/usr/bin/env python3
import argparse
import importlib.util
import json
import pathlib
import re
import shutil
import sys
import tempfile


VALIDATOR_SCRIPT = pathlib.Path(__file__).with_name("validate_artifact.py")
VALIDATOR_SPEC = importlib.util.spec_from_file_location(
    "weibo_validate_artifact", VALIDATOR_SCRIPT
)
VALIDATOR = importlib.util.module_from_spec(VALIDATOR_SPEC)
VALIDATOR_SPEC.loader.exec_module(VALIDATOR)

TOPIC_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class DeliveryError(ValueError):
    pass


def _resolve_source(run_dir, value):
    if not isinstance(value, str) or not value.strip():
        raise DeliveryError("source path must be a non-empty string")
    root = pathlib.Path(run_dir).resolve()
    path = (root / value).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise DeliveryError("source path must stay inside the run directory") from exc
    return path


def _read_text(path, label):
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeError as exc:
        raise DeliveryError(f"{label} must be UTF-8 text") from exc


def _read_json(path, label):
    try:
        return json.loads(_read_text(path, label))
    except json.JSONDecodeError as exc:
        raise DeliveryError(f"{label} must be valid JSON") from exc


def _validate_complete_topic(topic, run_dir):
    topic_id = topic["topic_id"]
    decision = topic.get("product_mention_decision")
    if decision not in {"none", "allowed"}:
        raise DeliveryError(
            f"{topic_id} product_mention_decision must be none or allowed"
        )

    long_path = _resolve_source(run_dir, topic.get("long_copy"))
    if not long_path.is_file():
        raise DeliveryError(f"{topic_id} long copy is missing")
    long_text = _read_text(long_path, f"{topic_id} long copy")
    try:
        long_result = VALIDATOR.validate_copy(long_text, "long")
    except VALIDATOR.ValidationError as exc:
        raise DeliveryError(f"{topic_id} long copy is invalid: {exc}") from exc

    image_manifest_path = _resolve_source(run_dir, topic.get("image_manifest"))
    if not image_manifest_path.is_file():
        raise DeliveryError(f"{topic_id} image manifest is missing")
    image_manifest = _read_json(
        image_manifest_path, f"{topic_id} image manifest"
    )
    try:
        image_result = VALIDATOR.validate_image_manifest(
            image_manifest, image_manifest_path.parent
        )
    except VALIDATOR.ValidationError as exc:
        raise DeliveryError(f"{topic_id} image manifest is invalid: {exc}") from exc

    return {
        "topic_id": topic_id,
        "product_mention_decision": decision,
        "long_path": long_path,
        "long_character_count": long_result["character_count"],
        "image_manifest_path": image_manifest_path,
        "image_manifest": image_manifest,
        "image_result": image_result,
    }


def _validate_request(request, run_dir):
    if not isinstance(request, dict):
        raise DeliveryError("package request must be an object")
    run_status = request.get("run_status")
    if run_status not in {"COMPLETE", "PARTIAL"}:
        raise DeliveryError("run_status must be COMPLETE or PARTIAL")
    topics = request.get("topics")
    if not isinstance(topics, list) or not topics:
        raise DeliveryError("package request topics must be a non-empty array")
    if any(not isinstance(topic, dict) for topic in topics):
        raise DeliveryError("package request topic rows must be objects")

    seen_ids = set()
    complete_topics = []
    failed_topics = []
    for topic in topics:
        topic_id = topic.get("topic_id")
        if not isinstance(topic_id, str) or not TOPIC_ID_PATTERN.fullmatch(topic_id):
            raise DeliveryError("topic_id must be a safe non-empty identifier")
        if topic_id in seen_ids:
            raise DeliveryError("package request topic_id values must be unique")
        seen_ids.add(topic_id)

        if topic.get("status") == "COMPLETE":
            complete_topics.append(_validate_complete_topic(topic, run_dir))
            continue

        status = topic.get("status")
        failure_stage = topic.get("failure_stage")
        failure_reason = topic.get("failure_reason")
        if not isinstance(status, str) or not status.strip():
            raise DeliveryError(f"{topic_id} failed topic status must be non-empty")
        if not isinstance(failure_stage, str) or not failure_stage.strip():
            raise DeliveryError(f"{topic_id} failed topic needs failure_stage")
        if not isinstance(failure_reason, str) or not failure_reason.strip():
            raise DeliveryError(f"{topic_id} failed topic needs failure_reason")
        failed_topics.append(
            {
                "topic_id": topic_id,
                "status": status,
                "failure_stage": failure_stage,
                "failure_reason": failure_reason,
            }
        )

    if not complete_topics:
        raise DeliveryError("at least one complete topic is required for delivery")
    if run_status == "COMPLETE" and failed_topics:
        raise DeliveryError("COMPLETE delivery cannot contain failed topics")
    if run_status == "PARTIAL" and not failed_topics:
        raise DeliveryError("PARTIAL delivery requires at least one failed topic")
    return run_status, complete_topics, failed_topics


def _image_source_path(prepared, item, run_dir):
    path = (prepared["image_manifest_path"].parent / item["file"]).resolve()
    try:
        path.relative_to(run_dir)
    except ValueError as exc:
        raise DeliveryError("image source must stay inside the run directory") from exc
    return path


def _write_json(path, payload):
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _render_delivery(manifest):
    lines = [
        "# Unified Weibo Delivery",
        "",
        f"Status: `{manifest['status']}`",
        "",
        "## Complete Topics",
        "",
    ]
    for topic in manifest["topics"]:
        lines.extend(
            (
                f"### {topic['topic_id']}",
                "",
                f"- Product decision: `{topic['product_mention_decision']}`",
                f"- Long: `{topic['long_copy']['delivery_path']}`",
            )
        )
        for image in topic["images"]:
            lines.append(f"- Publishable image: `{image['delivery_path']}`")
        lines.append("")

    lines.extend(("## Internal Reference Images", ""))
    if manifest["internal_reference_images"]:
        for image in manifest["internal_reference_images"]:
            lines.append(
                f"- `{image['topic_id']}`: `{image['source_path']}` "
                f"(`{image['usage_status']}`, not copied)"
            )
    else:
        lines.append("- None")

    lines.extend(("", "## Failed Topics", ""))
    if manifest["failed_topics"]:
        for topic in manifest["failed_topics"]:
            lines.append(
                f"- `{topic['topic_id']}` / `{topic['status']}` / "
                f"`{topic['failure_stage']}`: {topic['failure_reason']}"
            )
    else:
        lines.append("- None")

    lines.extend(("", "## Residual Risks", ""))
    if manifest["residual_risks"]:
        lines.extend(f"- {risk}" for risk in manifest["residual_risks"])
    else:
        lines.append("- None")
    return "\n".join(lines) + "\n"


def package_delivery(request, run_dir, output_dir=None):
    run_dir = pathlib.Path(run_dir).resolve()
    if not run_dir.is_dir():
        raise DeliveryError("run directory is missing")
    if output_dir is None:
        output_path = run_dir / "final-delivery"
    else:
        candidate = pathlib.Path(output_dir)
        output_path = (
            candidate.resolve() if candidate.is_absolute() else (run_dir / candidate).resolve()
        )
    try:
        output_path.relative_to(run_dir)
    except ValueError as exc:
        raise DeliveryError("delivery output must stay inside the run directory") from exc
    if output_path.exists():
        raise DeliveryError("delivery output already exists")
    if not output_path.parent.is_dir():
        raise DeliveryError("delivery output parent is missing")

    run_status, complete_topics, failed_topics = _validate_request(
        request, run_dir
    )
    temp_path = pathlib.Path(
        tempfile.mkdtemp(prefix=f".{output_path.name}.", dir=output_path.parent)
    )
    try:
        delivered_topics = []
        internal_references = []
        for prepared in complete_topics:
            topic_id = prepared["topic_id"]
            topic_temp = temp_path / topic_id
            images_temp = topic_temp / "images"
            images_temp.mkdir(parents=True)

            long_temp = topic_temp / "long.md"
            long_final = output_path / topic_id / "long.md"
            shutil.copy2(prepared["long_path"], long_temp)
            long_row = {
                "role": "long",
                "source_path": str(prepared["long_path"]),
                "delivery_path": str(long_final),
                "character_count": prepared["long_character_count"],
                "exists": True,
            }

            image_rows = []
            image_manifest = prepared["image_manifest"]
            generation_provider = image_manifest["generation"]["provider"]
            image_index = 0
            for field, role in (
                ("factual_images", "factual"),
                ("generated_images", "generated"),
            ):
                for item in image_manifest.get(field, []):
                    image_index += 1
                    source_path = _image_source_path(prepared, item, run_dir)
                    destination_name = (
                        f"{image_index:02d}-{pathlib.Path(item['file']).name}"
                    )
                    image_temp = images_temp / destination_name
                    image_final = output_path / topic_id / "images" / destination_name
                    shutil.copy2(source_path, image_temp)
                    image_rows.append(
                        {
                            "role": role,
                            "source_path": str(source_path),
                            "delivery_path": str(image_final),
                            "usage_status": item.get(
                                "usage_status", "generated-qa-pass"
                            ),
                            "provider": (
                                "network-source"
                                if role == "factual"
                                else generation_provider
                            ),
                            "source_page": item.get("source_page"),
                            "exists": True,
                        }
                    )

            for item in image_manifest.get("reference_images", []):
                source_path = _image_source_path(prepared, item, run_dir)
                internal_references.append(
                    {
                        "topic_id": topic_id,
                        "source_path": str(source_path),
                        "source_page": item.get("source_page"),
                        "publisher": item.get("publisher"),
                        "retrieved_at": item.get("retrieved_at"),
                        "caption": item.get("caption"),
                        "usage_status": "verification_required",
                        "copied": False,
                    }
                )

            delivered_topics.append(
                {
                    "topic_id": topic_id,
                    "status": "COMPLETE",
                    "product_mention_decision": prepared[
                        "product_mention_decision"
                    ],
                    "long_copy": long_row,
                    "images": image_rows,
                    "source_image_manifest_path": str(
                        prepared["image_manifest_path"]
                    ),
                }
            )

        residual_risks = []
        if internal_references:
            residual_risks.append(
                f"{len(internal_references)} verification_required image(s) "
                "remain internal and were not copied"
            )
        if failed_topics:
            residual_risks.append(
                f"{len(failed_topics)} incomplete topic(s) were excluded"
            )
        manifest = {
            "status": run_status,
            "complete_topic_count": len(delivered_topics),
            "failed_topic_count": len(failed_topics),
            "topics": delivered_topics,
            "failed_topics": failed_topics,
            "internal_reference_images": internal_references,
            "residual_risks": residual_risks,
        }
        _write_json(temp_path / "manifest.json", manifest)
        (temp_path / "delivery.md").write_text(
            _render_delivery(manifest), encoding="utf-8"
        )
        temp_path.replace(output_path)
    except Exception:
        if temp_path.exists():
            shutil.rmtree(temp_path)
        raise
    return manifest


def build_parser():
    parser = argparse.ArgumentParser(
        description="Package complete Weibo artifacts into one final delivery"
    )
    parser.add_argument("request", help="path to package-request.json")
    parser.add_argument(
        "--output",
        help="optional output path inside the run directory",
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    request_path = pathlib.Path(args.request).resolve()
    if not request_path.is_file():
        print(
            json.dumps({"ok": False, "error": "package request is missing"}),
            file=sys.stderr,
        )
        return 2
    try:
        request = _read_json(request_path, "package request")
        result = package_delivery(request, request_path.parent, args.output)
    except DeliveryError as exc:
        print(
            json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2
    print(
        json.dumps(
            {
                "ok": True,
                "status": result["status"],
                "complete_topic_count": result["complete_topic_count"],
                "failed_topic_count": result["failed_topic_count"],
                "delivery_path": str(
                    request_path.parent / (args.output or "final-delivery")
                ),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
