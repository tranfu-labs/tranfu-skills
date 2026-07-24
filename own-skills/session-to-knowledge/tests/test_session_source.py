from __future__ import annotations

import importlib.util
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "session_source.py"
SPEC = importlib.util.spec_from_file_location("session_source", SCRIPT_PATH)
assert SPEC and SPEC.loader
session_source = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = session_source
SPEC.loader.exec_module(session_source)


SESSION_ID = "11111111-2222-4333-8444-555555555555"


def write_jsonl(path: Path, records: list[dict], trailing: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = "\n".join(json.dumps(record) for record in records) + "\n" + trailing
    path.write_text(body, encoding="utf-8")


def codex_records(session_id: str = SESSION_ID) -> list[dict]:
    return [
        {
            "type": "session_meta",
            "timestamp": "2026-07-23T00:00:00Z",
            "payload": {
                "id": session_id,
                "cwd": "/Users/alice/private-project",
                "base_instructions": "never expose this bootstrap secret",
            },
        },
        {
            "type": "turn_context",
            "payload": {"summary": "hidden compacted summary", "agents_md": "hidden policy"},
        },
        {
            "type": "world_state",
            "payload": {"full": {"developer": "hidden world state"}},
        },
        {
            "type": "event_msg",
            "payload": {"type": "task_started", "turn_id": "turn-private", "model_context_window": 10000},
        },
        {
            "type": "response_item",
            "payload": {"type": "message", "role": "user", "content": "synthetic bootstrap input"},
        },
        {
            "type": "event_msg",
            "payload": {
                "type": "user_message",
                "message": (
                    "Fix login. api_key=abc123 user@example.com "
                    "https://private.example/x /Users/alice/private-project/file.py "
                    f"{session_id} data:text/plain;base64,{'A' * 120}"
                ),
            },
        },
        {
            "type": "event_msg",
            "payload": {"type": "agent_message", "phase": "commentary", "message": "I am checking the failure."},
        },
        {
            "type": "response_item",
            "payload": {
                "type": "message",
                "role": "assistant",
                "phase": "commentary",
                "content": [{"type": "output_text", "text": "I am checking the failure."}],
            },
        },
        {
            "type": "response_item",
            "payload": {"type": "reasoning", "content": "hidden chain of thought"},
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call",
                "name": "spawn_agent",
                "call_id": "call-internal",
                "arguments": "internal delegation instructions",
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call_output",
                "call_id": "call-internal",
                "output": "internal worker message",
                "status": "completed",
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call",
                "name": "exec_command",
                "call_id": "call-secret",
                "arguments": (
                    r'{\"password\":\"swordfish\",\"cmd\":\"tool --token raw-token '
                    r'--password flag-secret /Users/alice/private-project\"}'
                ),
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call_output",
                "call_id": "call-secret",
                "output": "tests passed",
                "status": "completed",
                "exit_code": 0,
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "message",
                "role": "assistant",
                "phase": "final_answer",
                "content": [{"type": "output_text", "text": "The verified tests passed."}],
            },
        },
        {"type": "event_msg", "payload": {"type": "task_complete", "last_agent_message": "duplicate final"}},
    ]


class SessionSourceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def prepare_codex(self, *, trailing: str = "", max_bytes: int = 2048) -> tuple[Path, dict]:
        source = self.root / "rollout.jsonl"
        write_jsonl(source, codex_records(), trailing=trailing)
        work_root = self.root / "project" / "session-knowledge" / ".work"
        summary = session_source.prepare(str(source), work_root, None, max_bytes)
        return Path(summary["run_dir"]), summary

    def load_manifest(self, run_dir: Path) -> dict:
        return json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))

    def chunk_text(self, run_dir: Path, manifest: dict) -> str:
        return "".join((run_dir / chunk["file"]).read_text(encoding="utf-8") for chunk in manifest["chunks"])

    def write_card(self, run_dir: Path, chunk_id: str) -> str:
        relative = f"cards/{chunk_id}.json"
        path = run_dir / relative
        path.write_text(
            json.dumps({"chunk_id": chunk_id, "coverage": {"complete": True}, "cards": []}),
            encoding="utf-8",
        )
        return relative

    def prepared_events(self, run_dir: Path) -> list[dict]:
        manifest = self.load_manifest(run_dir)
        return [
            json.loads(line)
            for chunk in session_source._active_chunks(manifest)
            for line in (run_dir / chunk["file"]).read_text(encoding="utf-8").splitlines()
        ]

    def write_valid_stage_artifacts(self, run_dir: Path) -> tuple[str, str]:
        manifest = self.load_manifest(run_dir)
        events = self.prepared_events(run_dir)
        problem = next(event for event in events if event["role"] == "user")
        action = next(event for event in events if event["role"] == "assistant")
        solution = next(
            event
            for event in reversed(events)
            if event["role"] == "assistant" and event["kind"] == "message"
        )
        verification = next(event for event in events if event["kind"] == "tool_result")
        candidate_name = "login verification failure"
        card = {
            "candidate": candidate_name,
            "problem_type": "task",
            "problem_evidence": [{"ordinal": problem["ordinal"], "fact": "Login was broken."}],
            "constraints": [],
            "actions": [{"ordinal": action["ordinal"], "action": "Investigated.", "result": "Found cause."}],
            "root_cause_evidence": [{"ordinal": action["ordinal"], "fact": "The cause was isolated."}],
            "solution_evidence": [{"ordinal": solution["ordinal"], "fact": "The fix was applied."}],
            "verification_evidence": [],
            "important_failures": [],
            "open_questions": [],
            "confidence": "high",
        }
        reduce_relative = "reductions/final.json"
        (run_dir / reduce_relative).write_text(
            json.dumps(
                {
                    "coverage": {
                        "complete": True,
                        **session_source._coverage_commitment(manifest),
                    },
                    "cards": [card],
                }
            ),
            encoding="utf-8",
        )
        reference = lambda event, fact: {"ordinal": event["ordinal"], "fact": fact}
        verification_reference = reference(verification, "Tests passed with a successful exit status.")
        verification_reference.update(
            {"call_id": verification["call_id"], "verification_kind": "tool_result"}
        )
        verify_relative = "reductions/verified.json"
        (run_dir / verify_relative).write_text(
            json.dumps(
                {
                    "coverage": {"complete": True},
                    "candidates": [
                        {
                            "candidate": candidate_name,
                            "accepted": True,
                            "problem_evidence": [reference(problem, "Login was broken.")],
                            "action_evidence": [reference(action, "The issue was investigated.")],
                            "root_cause_evidence": [reference(action, "The root cause was identified.")],
                            "solution_evidence": [reference(solution, "The fix was applied.")],
                            "verification_evidence": [verification_reference],
                            "contradictions": [],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        return reduce_relative, verify_relative

    def article_body(self) -> str:
        sections = "\n\n".join(f"{heading}\n\nVerified content." for heading in session_source.ARTICLE_HEADINGS)
        return f"# Verified result\n\n{sections}\n"

    def test_article_structure_requires_semantic_headings_in_order(self) -> None:
        wrong = self.article_body().replace(session_source.ARTICLE_HEADINGS[3], "## Arbitrary Section")
        with self.assertRaisesRegex(session_source.SourceError, "semantic headings"):
            session_source._validate_article_body(wrong.encode("utf-8"))

        english = "# Verified result\n\n" + "\n\n".join(
            f"{heading}\n\nVerified content." for heading in session_source.ARTICLE_HEADINGS_ENGLISH
        )
        session_source._validate_article_body(english.encode("utf-8"))

    def complete_pipeline(self, run_dir: Path) -> tuple[str, str]:
        manifest = self.load_manifest(run_dir)
        for chunk in session_source._active_chunks(manifest):
            card = self.write_card(run_dir, chunk["id"])
            session_source.mark(run_dir, chunk["id"], None, "completed", card)
        session_source.mark(run_dir, None, "map", "completed", None)
        reduce_relative, verify_relative = self.write_valid_stage_artifacts(run_dir)
        session_source.mark(run_dir, None, "reduce", "completed", reduce_relative)
        session_source.mark(run_dir, None, "verify", "completed", verify_relative)
        return reduce_relative, verify_relative

    def test_prepare_filters_redacts_deduplicates_and_preserves_machine_status(self) -> None:
        run_dir, summary = self.prepare_codex()
        manifest = self.load_manifest(run_dir)
        text = self.chunk_text(run_dir, manifest)

        self.assertFalse(summary["resumed"])
        self.assertNotIn("bootstrap", text)
        self.assertNotIn("world state", text)
        self.assertNotIn("chain of thought", text)
        self.assertNotIn("internal delegation instructions", text)
        self.assertNotIn("internal worker message", text)
        self.assertNotIn("synthetic bootstrap input", text)
        self.assertEqual(text.count("I am checking the failure."), 1)
        self.assertIn("The verified tests passed.", text)
        self.assertIn("tests passed", text)
        self.assertIn('\\"exit_code\\":0', text)
        self.assertIn('\\"status\\":\\"completed\\"', text)
        for private_value in (
            "abc123",
            "swordfish",
            "raw-token",
            "flag-secret",
            "user@example.com",
            "private.example",
            "/Users/alice/private-project",
            SESSION_ID,
            "A" * 100,
        ):
            self.assertNotIn(private_value, text)
        for marker in ("<secret>", "<email-1>", "<url-1>", "<path-1>", "<id-1>", "<binary-data>"):
            self.assertIn(marker, text)
        self.assertTrue(all(chunk["bytes"] <= 2048 for chunk in manifest["chunks"]))
        self.assertEqual(manifest["source"]["cwd"], "/Users/alice/private-project")
        self.assertEqual(
            (run_dir.parent.parent / ".gitignore").read_text(encoding="utf-8"),
            ".work/\n.session-to-knowledge-*.draft.md\n",
        )

    def test_codex_uses_response_item_user_message_when_high_level_event_is_absent(self) -> None:
        source = self.root / "fallback-user.jsonl"
        records = [
            codex_records()[0],
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "Visible fallback question."}],
                },
            },
        ]
        write_jsonl(source, records)

        summary = session_source.prepare(
            str(source), self.root / "fallback-project" / "session-knowledge" / ".work", None, 4096
        )
        prepared_text = json.dumps(self.prepared_events(Path(summary["run_dir"])))

        self.assertIn("Visible fallback question.", prepared_text)

    def test_redactor_covers_headers_and_escaped_quoted_secrets(self) -> None:
        source = (
            "Authorization: Bearer opaque-token-123456\n"
            "Cookie: session=one; refresh=two\n"
            r'{\"password\":\"sword fish\",\"authorization\":\"Basic abcdefghijkl\"}'
        )
        redacted = session_source.Redactor().redact(source)

        for secret in ("opaque-token-123456", "session=one", "refresh=two", "sword fish", "abcdefghijkl"):
            self.assertNotIn(secret, redacted)
        self.assertFalse(session_source.Redactor.scan(redacted))

    def test_incomplete_tail_and_malformed_middle_fail_closed(self) -> None:
        with self.assertRaisesRegex(session_source.SourceError, "incomplete trailing JSON"):
            self.prepare_codex(trailing='{"type":"event_msg"')

        source = self.root / "broken.jsonl"
        source.write_text(json.dumps(codex_records()[0]) + "\n{broken}\n", encoding="utf-8")
        with self.assertRaisesRegex(session_source.SourceError, "invalid JSON"):
            session_source.prepare(str(source), self.root / "work", None, 2048)

    def test_internal_tool_filter_does_not_evict_old_call_ids(self) -> None:
        records = [codex_records()[0]]
        records.extend(
            {
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "name": "spawn_agent",
                    "call_id": f"internal-{index}",
                    "arguments": "private delegation",
                },
            }
            for index in range(4097)
        )
        records.append(
            {
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "internal-0",
                    "output": "LEAKED_INTERNAL_OUTPUT",
                },
            }
        )
        source = self.root / "many-internal-calls.jsonl"
        write_jsonl(source, records)

        context = session_source.ParseContext()
        events = list(session_source._iter_codex_events(source, source.stat().st_size, context))

        self.assertNotIn("LEAKED_INTERNAL_OUTPUT", json.dumps(events))
        self.assertEqual(context.ignored["internal_agent_tool"], 4097)
        self.assertEqual(context.ignored["internal_agent_tool_output"], 1)

    def test_locate_uses_state_database_and_rejects_conflicts(self) -> None:
        codex_home = self.root / ".codex"
        rollout = codex_home / "sessions" / "2026" / "07" / "23" / f"rollout-now-{SESSION_ID}.jsonl"
        write_jsonl(rollout, [codex_records()[0]])
        database = codex_home / "state_5.sqlite"
        database.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database)
        connection.execute("CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL)")
        connection.execute("INSERT INTO threads VALUES (?, ?)", (SESSION_ID, str(rollout)))
        connection.commit()
        connection.close()

        self.assertEqual(session_source.locate_codex_session(SESSION_ID, codex_home), rollout.resolve())

        archived = codex_home / "archived_sessions" / f"rollout-old-{SESSION_ID}.jsonl"
        write_jsonl(archived, [codex_records()[0]])
        with self.assertRaisesRegex(session_source.SourceError, "multiple verified rollouts"):
            session_source.locate_codex_session(SESSION_ID, codex_home)

    def test_resume_validates_hash_budget_and_chunk_integrity(self) -> None:
        run_dir, first = self.prepare_codex()
        second = session_source.prepare(
            str(self.root / "rollout.jsonl"), run_dir.parent, None, first["max_chunk_bytes"]
        )
        self.assertTrue(second["resumed"])

        manifest = self.load_manifest(run_dir)
        chunk = run_dir / manifest["chunks"][0]["file"]
        chunk.write_text(chunk.read_text(encoding="utf-8") + "{}\n", encoding="utf-8")
        with self.assertRaisesRegex(session_source.SourceError, "integrity"):
            session_source.prepare(str(self.root / "rollout.jsonl"), run_dir.parent, None, 2048)

    def test_bisect_updates_active_set_and_rejects_completed_parent(self) -> None:
        source = self.root / "large.txt"
        source.write_text("alpha beta gamma " * 400, encoding="utf-8")
        summary = session_source.prepare(str(source), self.root / "session-knowledge" / ".work", None, 4096)
        run_dir = Path(summary["run_dir"])
        manifest = self.load_manifest(run_dir)
        parent_id = max(manifest["chunks"], key=lambda chunk: chunk["bytes"])["id"]

        split = session_source.bisect_chunk(run_dir, parent_id)
        self.assertGreaterEqual(len(split["children"]), 2)
        updated = self.load_manifest(run_dir)
        parent = next(chunk for chunk in updated["chunks"] if chunk["id"] == parent_id)
        self.assertEqual(parent["status"], "split")
        self.assertEqual(updated["budget"]["active_chunk_count"], len(session_source._active_chunks(updated)))

        child_id = split["children"][0]
        card = self.write_card(run_dir, child_id)
        session_source.mark(run_dir, child_id, None, "completed", card)
        with self.assertRaisesRegex(session_source.SourceError, "status completed"):
            session_source.bisect_chunk(run_dir, child_id)

    def test_recursive_bisect_preserves_part_path_and_content(self) -> None:
        original = "recursive segment " * 1000
        source = self.root / "recursive.jsonl"
        write_jsonl(source, [{"type": "user", "content": original}])
        summary = session_source.prepare(
            str(source), self.root / "recursive-project" / "session-knowledge" / ".work", None, 4096
        )
        run_dir = Path(summary["run_dir"])
        manifest = self.load_manifest(run_dir)
        parent_id = max(session_source._active_chunks(manifest), key=lambda chunk: chunk["bytes"])["id"]
        first_split = session_source.bisect_chunk(run_dir, parent_id)
        session_source.bisect_chunk(run_dir, first_split["children"][0])

        manifest = self.load_manifest(run_dir)
        parts = [
            json.loads(line)
            for chunk in session_source._active_chunks(manifest)
            for line in (run_dir / chunk["file"]).read_text(encoding="utf-8").splitlines()
            if json.loads(line)["ordinal"] == 1
        ]
        paths = [tuple(event["part_path"]) for event in parts]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual("".join(event["content"] for event in sorted(parts, key=lambda event: event["part_path"])), original)

    def test_cost_confirmation_blocks_workers(self) -> None:
        source = self.root / "huge.txt"
        source.write_text(
            "\n\n".join(f"section-{index} " + "alpha beta gamma " * 55 for index in range(70)),
            encoding="utf-8",
        )
        summary = session_source.prepare(str(source), self.root / "session-knowledge" / ".work", None, 1024)
        run_dir = Path(summary["run_dir"])
        manifest = self.load_manifest(run_dir)
        self.assertEqual(summary["confirmation"], "required")
        chunk_id = session_source._active_chunks(manifest)[0]["id"]
        with self.assertRaisesRegex(session_source.SourceError, "confirmation"):
            session_source.mark(run_dir, chunk_id, None, "running", None)
        confirmed = session_source.confirm(run_dir)
        self.assertEqual(confirmed["confirmation"], "confirmed")
        session_source.mark(run_dir, chunk_id, None, "running", None)

    def test_oversized_stream_and_single_event_stay_bounded(self) -> None:
        source = self.root / "oversized.jsonl"
        records = [{"type": "user", "content": "oversized event text " * 3000}]
        records.extend(
            {"type": "assistant", "content": f"segment {index} " + "alpha beta gamma " * 80}
            for index in range(120)
        )
        write_jsonl(source, records)

        summary = session_source.prepare(
            str(source), self.root / "session-knowledge" / ".work", None, 1024
        )
        run_dir = Path(summary["run_dir"])
        manifest = self.load_manifest(run_dir)
        prepared = [
            json.loads(line)
            for chunk in manifest["chunks"]
            for line in (run_dir / chunk["file"]).read_text(encoding="utf-8").splitlines()
        ]
        oversized_parts = [event for event in prepared if event["ordinal"] == 1]

        self.assertNotIn("chunks", summary)
        self.assertGreater(manifest["budget"]["active_chunk_count"], 50)
        self.assertTrue(all(chunk["bytes"] <= 1024 for chunk in manifest["chunks"]))
        self.assertGreater(len(oversized_parts), 1)
        self.assertTrue(all(event["parts"] == len(oversized_parts) for event in oversized_parts))
        self.assertEqual([event["part"] for event in oversized_parts], list(range(1, len(oversized_parts) + 1)))

        reduce_package = {
            "coverage": {"complete": True, **session_source._coverage_commitment(manifest)},
            "cards": [
                {
                    "candidate": "bounded coverage",
                    "problem_type": "agent",
                    "problem_evidence": [],
                    "constraints": [],
                    "actions": [],
                    "root_cause_evidence": [],
                    "solution_evidence": [],
                    "verification_evidence": [],
                    "important_failures": [],
                    "open_questions": [],
                    "confidence": "low",
                }
            ],
        }
        self.assertLess(len(json.dumps(reduce_package, separators=(",", ":")).encode("utf-8")), 1024)
        session_source._validate_reduce_package(run_dir, manifest, reduce_package)

    def test_parallel_marks_do_not_lose_completed_chunks(self) -> None:
        source = self.root / "parallel.txt"
        source.write_text("\n\n".join("alpha beta gamma " * 55 for _ in range(8)), encoding="utf-8")
        summary = session_source.prepare(str(source), self.root / "session-knowledge" / ".work", None, 1024)
        run_dir = Path(summary["run_dir"])
        manifest = self.load_manifest(run_dir)
        if manifest["confirmation"]["status"] == "required":
            session_source.confirm(run_dir)
        chunk_ids = [chunk["id"] for chunk in session_source._active_chunks(manifest)[:4]]
        artifacts = {chunk_id: self.write_card(run_dir, chunk_id) for chunk_id in chunk_ids}
        with ThreadPoolExecutor(max_workers=4) as executor:
            list(
                executor.map(
                    lambda chunk_id: session_source.mark(
                        run_dir, chunk_id, None, "completed", artifacts[chunk_id]
                    ),
                    chunk_ids,
                )
            )
        updated = self.load_manifest(run_dir)
        states = {chunk["id"]: chunk["status"] for chunk in updated["chunks"]}
        self.assertTrue(all(states[chunk_id] == "completed" for chunk_id in chunk_ids))

    def test_mark_rejects_invalid_map_artifacts(self) -> None:
        run_dir, _summary = self.prepare_codex(max_bytes=32768)
        manifest = self.load_manifest(run_dir)
        chunk_id = session_source._active_chunks(manifest)[0]["id"]
        card_path = run_dir / "cards" / "invalid.json"

        card_path.write_text(
            json.dumps({"chunk_id": "wrong", "coverage": {"complete": True}, "cards": []}),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(session_source.SourceError, "chunk_id"):
            session_source.mark(run_dir, chunk_id, None, "completed", "cards/invalid.json")

        card_path.write_text(
            json.dumps(
                {"chunk_id": chunk_id, "coverage": {"complete": True}, "cards": [{}] * 9}
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(session_source.SourceError, "at most 8"):
            session_source.mark(run_dir, chunk_id, None, "completed", "cards/invalid.json")

        events = self.prepared_events(run_dir)
        tool_result = next(event for event in events if event["kind"] == "tool_result")
        malformed_card = {
            "candidate": "missing provenance",
            "problem_type": "task",
            "problem_evidence": [],
            "constraints": [],
            "actions": [{"ordinal": tool_result["ordinal"], "action": "Ran tests.", "result": "Done."}],
            "root_cause_evidence": [],
            "solution_evidence": [],
            "verification_evidence": [],
            "important_failures": [],
            "open_questions": [],
            "confidence": "low",
        }
        card_path.write_text(
            json.dumps(
                {"chunk_id": chunk_id, "coverage": {"complete": True}, "cards": [malformed_card]}
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(session_source.SourceError, "call_id"):
            session_source.mark(run_dir, chunk_id, None, "completed", "cards/invalid.json")

        card_path.write_text(
            json.dumps(
                {
                    "chunk_id": chunk_id,
                    "coverage": {"complete": True, "notes": ["user@example.com"]},
                    "cards": [],
                }
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(session_source.SourceError, "privacy scan"):
            session_source.mark(run_dir, chunk_id, None, "completed", "cards/invalid.json")

    def test_reduce_verify_gate_and_upstream_invalidation(self) -> None:
        run_dir, _summary = self.prepare_codex(max_bytes=32768)
        manifest = self.load_manifest(run_dir)
        chunk = session_source._active_chunks(manifest)[0]
        session_source.mark(run_dir, chunk["id"], None, "completed", self.write_card(run_dir, chunk["id"]))
        session_source.mark(run_dir, None, "map", "completed", None)

        bad_reduce = run_dir / "reductions" / "bad-reduce.json"
        bad_reduce.write_text('{"coverage":{"complete":false},"cards":[]}\n', encoding="utf-8")
        with self.assertRaisesRegex(session_source.SourceError, "coverage"):
            session_source.mark(run_dir, None, "reduce", "completed", "reductions/bad-reduce.json")

        reduce_relative, verify_relative = self.write_valid_stage_artifacts(run_dir)
        session_source.mark(run_dir, None, "reduce", "completed", reduce_relative)
        bad_verify = run_dir / "reductions" / "bad-verify.json"
        bad_verify.write_text('{"coverage":{"complete":true},"candidates":[]}\n', encoding="utf-8")
        with self.assertRaisesRegex(session_source.SourceError, "1 to 3"):
            session_source.mark(run_dir, None, "verify", "completed", "reductions/bad-verify.json")
        session_source.mark(run_dir, None, "verify", "completed", verify_relative)

        session_source.mark(run_dir, chunk["id"], None, "pending", None)
        updated = self.load_manifest(run_dir)
        self.assertEqual(updated["stages"], {stage: "pending" for stage in session_source.STAGE_ORDER})
        self.assertFalse(updated.get("stage_artifacts"))

    def test_failed_machine_result_and_negated_user_message_do_not_verify(self) -> None:
        self.assertFalse(
            session_source._explicit_user_confirmation(
                {"role": "user", "kind": "message", "content": "It is not fixed."},
                {"quote": "It is not fixed."},
            )
        )
        for message in (
            "Was it fixed?",
            "I can't confirm it is fixed.",
            "It was fixed, but now it is broken again.",
        ):
            self.assertFalse(
                session_source._explicit_user_confirmation(
                    {"role": "user", "kind": "message", "content": message},
                    {"quote": message},
                )
            )
        for message in (
            "It is still broken; saying it works now would be false.",
            "The assistant claimed it works now, but I cannot confirm that.",
            "Do not record 'it works now': it does not.",
        ):
            self.assertFalse(
                session_source._explicit_user_confirmation(
                    {"role": "user", "kind": "message", "content": message},
                    {"quote": "it works now"},
                )
            )
        self.assertTrue(
            session_source._explicit_user_confirmation(
                {"role": "user", "kind": "message", "content": "Thanks, it works now!"},
                {"quote": "Thanks, it works now!"},
            )
        )
        self.assertFalse(
            session_source._tool_result_succeeded(
                {"role": "tool", "kind": "tool_result", "content": '{"output":"tests failed"}'}
            )
        )
        self.assertFalse(
            session_source._tool_result_succeeded(
                {
                    "role": "tool",
                    "kind": "tool_result",
                    "content": '{"status":"failed","exit_code":1}',
                }
            )
        )
        self.assertFalse(
            session_source._tool_result_succeeded(
                {
                    "role": "tool",
                    "kind": "tool_result",
                    "content": '{"output":"tests failed","status":"completed"}',
                }
            )
        )

    def test_generic_jsonl_preserves_tool_result_status(self) -> None:
        source = self.root / "generic.jsonl"
        write_jsonl(
            source,
            [
                {"type": "user", "content": "Please verify the change."},
                {
                    "type": "assistant",
                    "content": [
                        {"type": "text", "text": "Visible response."},
                        {"type": "thinking", "thinking": "hidden nested thought"},
                        {"type": "redacted_thinking", "data": "hidden redacted thought"},
                        {"type": "thought", "text": "hidden unknown thought"},
                        {"type": "analysis_text", "text": "hidden analysis text"},
                    ],
                },
                {
                    "type": "tool_call",
                    "name": "spawn_agent",
                    "call_id": "generic-internal-1",
                    "arguments": "PRIVATE generic delegation",
                },
                {
                    "type": "tool_result",
                    "call_id": "generic-internal-1",
                    "output": "PRIVATE generic worker",
                },
                {
                    "type": "tool_result",
                    "call_id": "generic-call-1",
                    "content": "tests passed",
                    "status": "completed",
                    "exit_code": 0,
                },
            ],
        )
        summary = session_source.prepare(
            str(source), self.root / "generic-project" / "session-knowledge" / ".work", None, 4096
        )
        events = self.prepared_events(Path(summary["run_dir"]))
        tool_result = next(event for event in events if event["kind"] == "tool_result")

        self.assertIn('\"status\":\"completed\"', tool_result["content"])
        self.assertIn('\"exit_code\":0', tool_result["content"])
        self.assertTrue(session_source._tool_result_succeeded(tool_result))
        self.assertTrue(tool_result["call_id"].startswith("<id-"))
        prepared_text = json.dumps(events)
        self.assertIn("Visible response.", prepared_text)
        self.assertNotIn("hidden nested thought", prepared_text)
        self.assertNotIn("hidden redacted thought", prepared_text)
        self.assertNotIn("hidden unknown thought", prepared_text)
        self.assertNotIn("hidden analysis text", prepared_text)
        self.assertNotIn("PRIVATE generic delegation", prepared_text)
        self.assertNotIn("PRIVATE generic worker", prepared_text)

    def test_oversized_tool_result_keeps_machine_status_across_parts(self) -> None:
        records = codex_records()
        output_record = next(
            record
            for record in records
            if record.get("payload", {}).get("type") == "function_call_output"
            and record.get("payload", {}).get("call_id") == "call-secret"
        )
        output_record["payload"]["output"] = "tests passed " * 100000
        source = self.root / "large-tool.jsonl"
        write_jsonl(source, records)
        summary = session_source.prepare(
            str(source), self.root / "tool-project" / "session-knowledge" / ".work", None, 4096
        )
        parts = [
            event
            for event in self.prepared_events(Path(summary["run_dir"]))
            if event["kind"] == "tool_result"
        ]

        self.assertGreater(len(parts), 1)
        self.assertTrue(all(event["status"] == "completed" for event in parts))
        self.assertTrue(all(event["exit_code"] == 0 for event in parts))
        self.assertTrue(all(session_source._tool_result_succeeded(event) for event in parts))
        self.assertEqual([event["part"] for event in parts], list(range(1, len(parts) + 1)))
        self.assertEqual("".join(event["content"] for event in parts), session_source._tool_content(output_record["payload"], True))

    def test_event_units_yield_before_consuming_an_unbounded_call_stream(self) -> None:
        consumed = 0

        def events():
            nonlocal consumed
            for ordinal in range(1, 10001):
                consumed += 1
                yield {
                    "ordinal": ordinal,
                    "role": "tool",
                    "kind": "tool_result",
                    "call_id": "one-streaming-call",
                    "content": "stream item",
                }

        first = next(session_source._event_units(events(), 1024))

        self.assertLess(consumed, 10000)
        self.assertLessEqual(
            sum(len((session_source._json_dump(event) + "\n").encode("utf-8")) for event in first),
            1024,
        )

    def test_claim_is_bounded_and_enforces_retry_limit(self) -> None:
        run_dir, _summary = self.prepare_codex(max_bytes=32768)
        chunk_id = session_source._active_chunks(self.load_manifest(run_dir))[0]["id"]
        for expected_attempt in range(1, 5):
            claimed = session_source.claim(run_dir, 1)
            self.assertEqual(len(claimed["claimed"]), 1)
            self.assertEqual(claimed["claimed"][0]["id"], chunk_id)
            self.assertEqual(claimed["claimed"][0]["attempt"], expected_attempt)
            self.assertNotIn("chunks", claimed)
            if expected_attempt == 1:
                requeued = session_source.requeue_running(run_dir)
                self.assertEqual(requeued["requeued"], 1)
                self.assertEqual(self.load_manifest(run_dir)["chunks"][0]["attempts"], 1)
            else:
                session_source.mark(run_dir, chunk_id, None, "pending", None)
        exhausted = session_source.claim(run_dir, 1)
        self.assertEqual(exhausted["claimed"], [])
        self.assertEqual(exhausted["exhausted"], [chunk_id])
        self.assertEqual(self.load_manifest(run_dir)["chunks"][0]["status"], "failed")

        source = self.root / "concurrent.txt"
        source.write_text("\n\n".join("alpha beta gamma " * 60 for _ in range(8)), encoding="utf-8")
        summary = session_source.prepare(
            str(source), self.root / "concurrent-project" / "session-knowledge" / ".work", None, 1024
        )
        concurrent_run = Path(summary["run_dir"])
        first = session_source.claim(concurrent_run, 4)
        second = session_source.claim(concurrent_run, 4)
        self.assertEqual(len(first["claimed"]), 4)
        self.assertEqual(second["claimed"], [])
        pending_id = next(
            chunk["id"]
            for chunk in session_source._active_chunks(self.load_manifest(concurrent_run))
            if chunk["status"] == "pending"
        )
        with self.assertRaisesRegex(session_source.SourceError, "maximum map worker concurrency"):
            session_source.mark(concurrent_run, pending_id, None, "running", None)
        completed_id = first["claimed"][0]["id"]
        session_source.mark(
            concurrent_run,
            completed_id,
            None,
            "completed",
            self.write_card(concurrent_run, completed_id),
        )
        requeued = session_source.requeue_running(concurrent_run)
        self.assertEqual(requeued["requeued"], 3)
        self.assertEqual(
            next(chunk for chunk in self.load_manifest(concurrent_run)["chunks"] if chunk["id"] == completed_id)["status"],
            "completed",
        )
        reclaimed = session_source.claim(concurrent_run, 4)
        self.assertEqual(len(reclaimed["claimed"]), 4)
        self.assertTrue(any(item["attempt"] == 2 for item in reclaimed["claimed"]))

    def test_stage_dependencies_finalize_and_clean(self) -> None:
        run_dir, _summary = self.prepare_codex(max_bytes=32768)
        manifest = self.load_manifest(run_dir)
        chunk = session_source._active_chunks(manifest)[0]
        card = self.write_card(run_dir, chunk["id"])
        session_source.mark(run_dir, chunk["id"], None, "completed", card)
        session_source.mark(run_dir, None, "map", "completed", None)

        reduce_relative, verify_relative = self.write_valid_stage_artifacts(run_dir)
        with self.assertRaisesRegex(session_source.SourceError, "completed reduce"):
            session_source.mark(run_dir, None, "verify", "completed", verify_relative)
        session_source.mark(run_dir, None, "reduce", "completed", reduce_relative)
        session_source.mark(run_dir, None, "verify", "completed", verify_relative)

        knowledge_dir = run_dir.parent.parent
        unsafe = knowledge_dir / ".session-to-knowledge-unsafe.draft.md"
        unsafe.write_text("# Result\n\nContact user@example.com", encoding="utf-8")
        with self.assertRaisesRegex(session_source.SourceError, "privacy scan failed"):
            session_source.finalize(
                run_dir, unsafe, knowledge_dir / "2026-07-23-1200-unsafe-result.md"
            )

        article = knowledge_dir / ".session-to-knowledge-article.draft.md"
        article.write_text(self.article_body(), encoding="utf-8")
        final = knowledge_dir / "2026-07-23-1200-verified-result.md"
        result = session_source.finalize(run_dir, article, final)
        self.assertEqual(result["output"], str(final.resolve()))
        self.assertTrue(final.is_file())
        session_source.clean(run_dir)
        self.assertFalse(run_dir.exists())

    def test_finalize_rejects_work_output_and_recovers_interrupted_publish(self) -> None:
        run_dir, _summary = self.prepare_codex(max_bytes=32768)
        self.complete_pipeline(run_dir)
        knowledge_dir = run_dir.parent.parent
        article = knowledge_dir / ".session-to-knowledge-article.draft.md"
        article.write_text(self.article_body(), encoding="utf-8")

        with self.assertRaisesRegex(session_source.SourceError, "directly inside"):
            session_source.finalize(run_dir, article, run_dir / "result.md")

        raced_output = knowledge_dir / "2026-07-23-1200-raced-result.md"
        with mock.patch.object(session_source.os, "link", side_effect=FileExistsError):
            with self.assertRaisesRegex(session_source.SourceError, "not overwritten"):
                session_source.finalize(run_dir, article, raced_output)
        after_race = self.load_manifest(run_dir)
        self.assertEqual(after_race["stages"]["write"], "pending")
        self.assertNotIn("final_artifact", after_race)
        self.assertTrue(article.exists())

        output = knowledge_dir / "2026-07-23-1200-recovered-result.md"
        body = article.read_bytes()
        output.write_bytes(body)
        manifest = self.load_manifest(run_dir)
        manifest["stages"]["write"] = "finalizing"
        manifest["final_artifact"] = {
            "path": output.name,
            "source_article": article.name,
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
        }
        session_source._atomic_json(run_dir / "manifest.json", manifest)

        result = session_source.finalize(run_dir, article, output)
        self.assertTrue(result["recovered"])
        self.assertFalse(article.exists())
        self.assertEqual(self.load_manifest(run_dir)["stages"]["write"], "completed")

        different = knowledge_dir / ".session-to-knowledge-different.draft.md"
        different.write_text(self.article_body().replace("Verified content.", "Different content."), encoding="utf-8")
        with self.assertRaisesRegex(session_source.SourceError, "original temporary article"):
            session_source.finalize(run_dir, different, output)
        self.assertTrue(different.exists())

    def test_clean_rejects_incomplete_run_and_scan_reports_counts_only(self) -> None:
        run_dir, _summary = self.prepare_codex()
        with self.assertRaisesRegex(session_source.SourceError, "before finalization"):
            session_source.clean(run_dir)
        findings = session_source.Redactor.scan("Basic dXNlcjpwYXNz and /private/path/file")
        self.assertIn("basic", findings)
        self.assertIn("posix_path", findings)


if __name__ == "__main__":
    unittest.main()
