import importlib.util
import json
import pathlib
import tempfile
import unittest


SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "package_delivery.py"
SPEC = importlib.util.spec_from_file_location("package_delivery", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


PNG = b"\x89PNG\r\n\x1a\ncontent"


def write_complete_topic(run_dir, topic_id="topic-01"):
    topic_root = run_dir / topic_id
    long_dir = topic_root / "long"
    images_dir = topic_root / "images"
    prompts_dir = images_dir / "prompts"
    references_dir = images_dir / "references"
    generated_dir = images_dir / "generated"
    for path in (
        long_dir,
        prompts_dir,
        references_dir,
        generated_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)

    long_path = long_dir / "final.md"
    long_path.write_text("热点深度评论与人工智能启示" * 120, encoding="utf-8")

    factual_path = images_dir / "01-factual.png"
    generated_path = generated_dir / "02-generated.png"
    reference_path = references_dir / "03-reference.png"
    rejected_path = images_dir / "04-rejected.png"
    prompt_path = prompts_dir / "02-generated.md"
    factual_path.write_bytes(PNG + b"factual")
    generated_path.write_bytes(PNG + b"generated")
    reference_path.write_bytes(PNG + b"reference")
    rejected_path.write_bytes(PNG + b"rejected")
    prompt_path.write_text("grounded image prompt", encoding="utf-8")

    image_manifest = {
        "route": "long",
        "chosen_total": 2,
        "selection_reason": "One factual anchor and one generated explainer",
        "factual_discovery": {
            "status": "PASS",
            "searched_claim_count": 2,
            "publish_ready_count": 1,
            "reference_only_count": 1,
        },
        "generation": {
            "provider": "post-illustration-images",
            "fallback_from": None,
            "fallback_reason": None,
            "style_reference_status": "pass",
        },
        "factual_images": [
            {
                "file": "01-factual.png",
                "source_page": "https://example.com/report",
                "publisher": "Example Authority",
                "retrieved_at": "2026-07-31T10:00:00+08:00",
                "caption": "Official event image",
                "usage_status": "publish-ready",
            }
        ],
        "reference_images": [
            {
                "file": "references/03-reference.png",
                "source_page": "https://example.com/reference",
                "publisher": "Example Publisher",
                "retrieved_at": "2026-07-31T10:05:00+08:00",
                "caption": "Internal rights reference",
                "usage_status": "verification_required",
            }
        ],
        "generated_images": [
            {
                "file": "generated/02-generated.png",
                "prompt_path": "prompts/02-generated.md",
                "qa_status": "pass",
            }
        ],
    }
    manifest_path = images_dir / "image-manifest.json"
    manifest_path.write_text(
        json.dumps(image_manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "topic_id": topic_id,
        "status": "COMPLETE",
        "product_mention_decision": "none",
        "long_copy": str(long_path.relative_to(run_dir)),
        "image_manifest": str(manifest_path.relative_to(run_dir)),
    }


def failed_topic(topic_id="topic-02"):
    return {
        "topic_id": topic_id,
        "status": "FAILED_IMAGE_QA",
        "failure_stage": "images",
        "failure_reason": "generated image failed raster QA",
    }


class PackageDeliveryTest(unittest.TestCase):
    def test_complete_packages_all_frozen_publishable_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()
            topic = write_complete_topic(run_dir)

            result = MODULE.package_delivery(
                {"run_status": "COMPLETE", "topics": [topic]}, run_dir
            )

            output = run_dir / "final-delivery"
            manifest = json.loads(
                (output / "manifest.json").read_text(encoding="utf-8")
            )
            delivered = manifest["topics"][0]
            self.assertEqual("COMPLETE", result["status"])
            self.assertEqual(1, manifest["complete_topic_count"])
            self.assertEqual(0, manifest["failed_topic_count"])
            self.assertTrue((output / "delivery.md").is_file())
            self.assertEqual(
                pathlib.Path(delivered["long_copy"]["source_path"]).read_bytes(),
                pathlib.Path(delivered["long_copy"]["delivery_path"]).read_bytes(),
            )
            self.assertNotIn("shorts", delivered)
            self.assertFalse(any(output.glob("topic-01/short-*.md")))
            for row in delivered["images"]:
                self.assertEqual(
                    pathlib.Path(row["source_path"]).read_bytes(),
                    pathlib.Path(row["delivery_path"]).read_bytes(),
                )
                self.assertTrue(row["exists"])

    def test_partial_packages_only_complete_topics_and_records_failures(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()
            complete = write_complete_topic(run_dir)
            failed = failed_topic()

            MODULE.package_delivery(
                {"run_status": "PARTIAL", "topics": [complete, failed]},
                run_dir,
            )

            output = run_dir / "final-delivery"
            manifest = json.loads(
                (output / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual("PARTIAL", manifest["status"])
            self.assertEqual(["topic-01"], [row["topic_id"] for row in manifest["topics"]])
            self.assertEqual([failed], manifest["failed_topics"])
            self.assertFalse((output / "topic-02").exists())
            self.assertIn("PARTIAL", (output / "delivery.md").read_text(encoding="utf-8"))

    def test_reference_and_rejected_images_are_not_publishable(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()
            topic = write_complete_topic(run_dir)

            MODULE.package_delivery(
                {"run_status": "COMPLETE", "topics": [topic]}, run_dir
            )

            output = run_dir / "final-delivery"
            image_names = {
                path.name for path in (output / "topic-01/images").iterdir()
            }
            manifest = json.loads(
                (output / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(2, len(image_names))
            self.assertFalse(any("reference" in name for name in image_names))
            self.assertFalse(any("rejected" in name for name in image_names))
            self.assertEqual(1, len(manifest["internal_reference_images"]))
            self.assertFalse(manifest["internal_reference_images"][0]["copied"])

    def test_missing_source_fails_without_creating_delivery(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()
            topic = write_complete_topic(run_dir)
            topic["long_copy"] = "topic-01/long/missing.md"

            with self.assertRaisesRegex(MODULE.DeliveryError, "long copy is missing"):
                MODULE.package_delivery(
                    {"run_status": "COMPLETE", "topics": [topic]}, run_dir
                )

            self.assertFalse((run_dir / "final-delivery").exists())

    def test_invalid_image_manifest_fails_without_creating_delivery(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()
            topic = write_complete_topic(run_dir)
            manifest_path = run_dir / topic["image_manifest"]
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["chosen_total"] = 3
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(MODULE.DeliveryError, "image manifest"):
                MODULE.package_delivery(
                    {"run_status": "COMPLETE", "topics": [topic]}, run_dir
                )

            self.assertFalse((run_dir / "final-delivery").exists())

    def test_zero_complete_topics_does_not_create_delivery(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()

            with self.assertRaisesRegex(MODULE.DeliveryError, "complete topic"):
                MODULE.package_delivery(
                    {"run_status": "PARTIAL", "topics": [failed_topic()]},
                    run_dir,
                )

            self.assertFalse((run_dir / "final-delivery").exists())

    def test_existing_delivery_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            output = run_dir / "final-delivery"
            output.mkdir(parents=True)
            marker = output / "keep.txt"
            marker.write_text("keep", encoding="utf-8")
            topic = write_complete_topic(run_dir)

            with self.assertRaisesRegex(MODULE.DeliveryError, "already exists"):
                MODULE.package_delivery(
                    {"run_status": "COMPLETE", "topics": [topic]}, run_dir
                )

            self.assertEqual("keep", marker.read_text(encoding="utf-8"))

    def test_run_status_must_match_topic_outcomes(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            run_dir = pathlib.Path(temp_dir) / "run"
            run_dir.mkdir()
            complete = write_complete_topic(run_dir)
            cases = (
                ("COMPLETE", [complete, failed_topic()], "cannot contain failed"),
                ("PARTIAL", [complete], "requires at least one failed"),
            )
            for status, topics, message in cases:
                with self.subTest(status=status):
                    with self.assertRaisesRegex(MODULE.DeliveryError, message):
                        MODULE.package_delivery(
                            {"run_status": status, "topics": topics}, run_dir
                        )

    def test_source_paths_cannot_escape_the_run(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            run_dir = root / "run"
            run_dir.mkdir()
            outside = root / "outside.md"
            outside.write_text("外部文稿" * 100, encoding="utf-8")
            topic = write_complete_topic(run_dir)
            topic["long_copy"] = "../outside.md"

            with self.assertRaisesRegex(MODULE.DeliveryError, "inside the run"):
                MODULE.package_delivery(
                    {"run_status": "COMPLETE", "topics": [topic]}, run_dir
                )


if __name__ == "__main__":
    unittest.main()
