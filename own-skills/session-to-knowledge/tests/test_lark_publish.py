from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import lark_publish  # noqa: E402
import session_source  # noqa: E402


class FakeRunner:
    def __init__(self, responses: list[lark_publish.CommandResult] | None = None, *, found: bool = True) -> None:
        self.responses = list(responses or [])
        self.found = found
        self.calls: list[tuple[list[str], str | None]] = []

    def which(self, executable: str) -> str | None:
        return f"/fake/{executable}" if self.found else None

    def run(self, argv: list[str], input_text: str | None = None) -> lark_publish.CommandResult:
        self.calls.append((list(argv), input_text))
        if not self.responses:
            raise AssertionError(f"unexpected command: {argv}")
        return self.responses.pop(0)


def result(payload: object, returncode: int = 0) -> lark_publish.CommandResult:
    return lark_publish.CommandResult(returncode, json.dumps(payload), "")


def version(value: str = "1.0.77") -> lark_publish.CommandResult:
    return lark_publish.CommandResult(0, f"lark-cli version {value}\n", "")


def auth(identity: str = "user", ready: bool = True) -> lark_publish.CommandResult:
    status = "ready" if ready else "missing"
    return result(
        {
            "verified": ready,
            "identity": identity if ready else "bot",
            "identities": {identity: {"status": status, "verified": ready}},
        }
    )


def parent_payload(
    *,
    obj_type: str = "docx",
    node_token: str = "wik-parent",
    space_id: str = "space-1",
    space_type: str = "team",
    obj_token: str | None = None,
) -> lark_publish.CommandResult:
    node = {
        "obj_type": obj_type,
        "node_token": node_token,
        "space_id": space_id,
        "space_type": space_type,
    }
    if obj_token:
        node["obj_token"] = obj_token
    return result(
        {
            "ok": True,
            "data": {
                "node": node
            },
        }
    )


def created_payload(obj_token: str | None = "docx-child") -> lark_publish.CommandResult:
    node = {
        "node_token": "wik-child",
        "obj_type": "docx",
        "url": "https://example.test/wiki/wik-child",
    }
    if obj_token:
        node["obj_token"] = obj_token
    return result(
        {
            "ok": True,
            "data": node,
        }
    )


def fetched(content: str, revision_id: int = 7) -> lark_publish.CommandResult:
    return result(
        {"ok": True, "data": {"document": {"content": content, "revision_id": revision_id}}}
    )


class LarkPublishTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.environ = {"XDG_CONFIG_HOME": str(self.root / "config")}

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def article(self, *, replacement: str | None = None) -> tuple[Path, str]:
        sections = []
        for index, heading in enumerate(session_source.ARTICLE_HEADINGS):
            content = "First verified marker." if index == 0 else "Verified content."
            if index == len(session_source.ARTICLE_HEADINGS) - 1:
                content = "Last verified marker."
            sections.append(f"{heading}\n\n{content}")
        body = "\n\n".join(sections) + "\n"
        text = f"# Verified result\n\n{body}"
        if replacement:
            text = text.replace("Verified content.", replacement, 1)
        directory = self.root / "project" / "session-knowledge"
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / "2026-07-30-1200-verified-result.md"
        path.write_text(text, encoding="utf-8")
        return path, body

    def write_config(self, *, identity: str = "user") -> Path:
        root, config_path, _publications_path = lark_publish._paths(self.environ)
        lark_publish._ensure_config_root(root)
        lark_publish._atomic_json(
            config_path,
            {
                "schema": lark_publish.CONFIG_SCHEMA,
                "identity": identity,
                "parent_node_token": "wik-parent",
                "space_id": "space-1",
            },
        )
        return config_path

    def test_status_reports_missing_and_old_cli_without_writing(self) -> None:
        missing = lark_publish.status(environ=self.environ, runner=FakeRunner(found=False))
        self.assertFalse(missing["ok"])
        self.assertFalse(missing["cli"]["found"])
        self.assertFalse((self.root / "config").exists())

        old = lark_publish.status(
            environ=self.environ,
            runner=FakeRunner([version("1.0.76")]),
        )
        self.assertFalse(old["ok"])
        self.assertFalse(old["cli"]["compatible"])

        unauthenticated = lark_publish.status(
            environ=self.environ,
            runner=FakeRunner([version(), auth(ready=False)]),
        )
        self.assertFalse(unauthenticated["ok"])
        self.assertFalse(unauthenticated["auth"]["ready"])

        with self.assertRaisesRegex(lark_publish.PublishError, "authentication is not ready"):
            lark_publish.configure(
                "user",
                "wik-parent",
                environ=self.environ,
                runner=FakeRunner([version(), auth(ready=False)]),
            )

    def test_configure_validates_identity_parent_and_private_storage(self) -> None:
        runner = FakeRunner([version(), auth(), parent_payload()])
        configured = lark_publish.configure(
            "user",
            "https://example.test/wiki/wik-parent",
            environ=self.environ,
            runner=runner,
        )

        root, config_path, _publications_path = lark_publish._paths(self.environ)
        self.assertTrue(configured["configured"])
        self.assertEqual(configured["parent_node_token"], "wik-parent")
        self.assertEqual(os.stat(root).st_mode & 0o777, 0o700)
        self.assertEqual(os.stat(config_path).st_mode & 0o777, 0o600)
        saved = json.loads(config_path.read_text(encoding="utf-8"))
        self.assertEqual(
            set(saved),
            {"schema", "identity", "parent_node_token", "space_id"},
        )
        node_call = runner.calls[-1][0]
        self.assertIn("+node-get", node_call)
        self.assertEqual(node_call[node_call.index("--as") + 1], "user")

        os.chmod(config_path, 0o644)
        with self.assertRaisesRegex(lark_publish.PublishError, "mode 0600"):
            lark_publish.status(environ=self.environ, runner=FakeRunner())

    def test_configure_rejects_drive_parent_non_docx_bot_personal_and_replacement(self) -> None:
        with self.assertRaisesRegex(lark_publish.PublishError, "Wiki page"):
            lark_publish.configure(
                "user",
                "https://example.test/docx/docx-parent",
                environ=self.environ,
                runner=FakeRunner(),
            )

        with self.assertRaisesRegex(lark_publish.PublishError, "Docx"):
            lark_publish.configure(
                "user",
                "wik-parent",
                environ=self.environ,
                runner=FakeRunner([version(), auth(), parent_payload(obj_type="sheet")]),
            )

        with self.assertRaisesRegex(lark_publish.PublishError, "personal"):
            lark_publish.configure(
                "bot",
                "wik-parent",
                environ=self.environ,
                runner=FakeRunner(
                    [
                        version(),
                        auth("bot"),
                        parent_payload(space_id="my_library", space_type="personal"),
                    ]
                ),
            )

        self.write_config()
        with self.assertRaisesRegex(lark_publish.PublishError, "--replace"):
            lark_publish.configure(
                "user",
                "wik-other",
                environ=self.environ,
                runner=FakeRunner(
                    [version(), auth(), parent_payload(node_token="wik-other", space_id="space-2")]
                ),
            )

    def test_publish_rejects_unconfigured_or_unsafe_local_article_before_lark_write(self) -> None:
        safe, _body = self.article()
        with self.assertRaisesRegex(lark_publish.PublishError, "not configured"):
            lark_publish.publish(safe, environ=self.environ, runner=FakeRunner())

        self.write_config()
        unsafe, _body = self.article(replacement="Blockchain content.")
        runner = FakeRunner()
        with self.assertRaisesRegex(lark_publish.PublishError, "local publication gate"):
            lark_publish.publish(unsafe, environ=self.environ, runner=runner)
        self.assertEqual(runner.calls, [])

    def test_publish_creates_writes_with_obj_token_verifies_and_is_idempotent(self) -> None:
        article, body = self.article()
        self.write_config()
        runner = FakeRunner(
            [
                version(),
                auth(),
                created_payload(),
                result({"ok": True, "data": {"result": "success"}}),
                fetched(f"# Verified result\n\n{body}"),
            ]
        )

        published = lark_publish.publish(
            article,
            environ=self.environ,
            runner=runner,
            sleeper=lambda _seconds: None,
        )
        self.assertTrue(published["published"])
        self.assertFalse(published["resumed"])
        update_argv, update_input = next(
            call for call in runner.calls if "+update" in call[0]
        )
        self.assertEqual(update_argv[update_argv.index("--doc") + 1], "docx-child")
        self.assertEqual(update_input, body)
        self.assertNotIn("# Verified result", update_input)

        runner.found = False
        repeated = lark_publish.publish(article, environ=self.environ, runner=runner)
        self.assertTrue(repeated["resumed"])
        self.assertEqual(sum("+node-create" in argv for argv, _input in runner.calls), 1)

    def test_publish_resumes_same_empty_node_after_write_failure(self) -> None:
        article, body = self.article()
        self.write_config()
        first = FakeRunner(
            [
                version(),
                auth(),
                created_payload(),
                result({"ok": False, "error": {"message": "write failed"}}, returncode=1),
            ]
        )
        with self.assertRaisesRegex(lark_publish.PublishError, "can resume"):
            lark_publish.publish(article, environ=self.environ, runner=first)

        second = FakeRunner(
            [
                version(),
                auth(),
                fetched("# Verified result\n"),
                result({"ok": True}),
                fetched(body),
            ]
        )
        resumed = lark_publish.publish(
            article,
            environ=self.environ,
            runner=second,
            sleeper=lambda _seconds: None,
        )
        self.assertTrue(resumed["published"])
        self.assertTrue(resumed["resumed"])
        self.assertFalse(any("+node-create" in argv for argv, _input in second.calls))
        update = next(argv for argv, _input in second.calls if "+update" in argv)
        self.assertEqual(update[update.index("--doc") + 1], "docx-child")
        self.assertEqual(update[update.index("--revision-id") + 1], "7")

    def test_publish_refuses_unknown_creation_and_conflicting_existing_content(self) -> None:
        article, _body = self.article()
        self.write_config()
        raw = article.read_bytes()
        key = lark_publish._publication_key("user", "wik-parent", raw)
        _root, _config_path, publications_path = lark_publish._paths(self.environ)

        lark_publish._atomic_json(
            publications_path,
            {
                "schema": lark_publish.PUBLICATIONS_SCHEMA,
                "publications": {key: {"status": "unknown"}},
            },
        )
        with self.assertRaisesRegex(lark_publish.PublishError, "outcome is unknown"):
            lark_publish.publish(
                article,
                environ=self.environ,
                runner=FakeRunner([version(), auth()]),
            )

        lark_publish._atomic_json(
            publications_path,
            {
                "schema": lark_publish.PUBLICATIONS_SCHEMA,
                "publications": {
                    key: {
                        "status": "created",
                        "node_token": "wik-child",
                        "obj_token": "docx-child",
                        "url": "https://example.test/wiki/wik-child",
                    }
                },
            },
        )
        conflict = FakeRunner([version(), auth(), fetched("Different safe content.")])
        with self.assertRaisesRegex(lark_publish.PublishError, "different content"):
            lark_publish.publish(article, environ=self.environ, runner=conflict)
        self.assertFalse(any("+update" in argv for argv, _input in conflict.calls))

    def test_failed_node_creation_records_unknown_and_is_not_retried(self) -> None:
        article, _body = self.article()
        self.write_config()
        failed_create = FakeRunner(
            [
                version(),
                auth(),
                result({"ok": False, "error": {"message": "timeout"}}, returncode=1),
            ]
        )

        with self.assertRaisesRegex(lark_publish.PublishError, "refusing to retry"):
            lark_publish.publish(article, environ=self.environ, runner=failed_create)

        raw = article.read_bytes()
        key = lark_publish._publication_key("user", "wik-parent", raw)
        _root, _config_path, publications_path = lark_publish._paths(self.environ)
        ledger = json.loads(publications_path.read_text(encoding="utf-8"))
        self.assertEqual(ledger["publications"][key], {"status": "unknown"})

        with self.assertRaisesRegex(lark_publish.PublishError, "outcome is unknown"):
            lark_publish.publish(
                article,
                environ=self.environ,
                runner=FakeRunner([version(), auth()]),
            )
        self.assertEqual(
            sum("+node-create" in argv for argv, _input in failed_create.calls),
            1,
        )

    def test_definitive_creation_rejection_can_retry_after_permissions_are_fixed(self) -> None:
        article, body = self.article()
        self.write_config()
        rejected = FakeRunner(
            [
                version(),
                auth(),
                result(
                    {"ok": False, "error": {"type": "permission", "message": "permission denied"}},
                    returncode=1,
                ),
            ]
        )
        with self.assertRaisesRegex(lark_publish.PublishError, "fix authentication"):
            lark_publish.publish(article, environ=self.environ, runner=rejected)

        _root, _config_path, publications_path = lark_publish._paths(self.environ)
        ledger = json.loads(publications_path.read_text(encoding="utf-8"))
        self.assertEqual(ledger["publications"], {})

        fixed = FakeRunner(
            [version(), auth(), created_payload(), result({"ok": True}), fetched(body)]
        )
        published = lark_publish.publish(
            article,
            environ=self.environ,
            runner=fixed,
            sleeper=lambda _seconds: None,
        )
        self.assertTrue(published["published"])

    def test_partial_create_response_recovers_only_the_recorded_node(self) -> None:
        article, body = self.article()
        self.write_config()
        first = FakeRunner([version(), auth(), created_payload(obj_token=None)])
        with self.assertRaisesRegex(lark_publish.PublishError, "resume only on that node"):
            lark_publish.publish(article, environ=self.environ, runner=first)

        second = FakeRunner(
            [
                version(),
                auth(),
                parent_payload(node_token="wik-child", obj_token="docx-child"),
                fetched("# Verified result\n"),
                result({"ok": True}),
                fetched(body),
            ]
        )
        published = lark_publish.publish(
            article,
            environ=self.environ,
            runner=second,
            sleeper=lambda _seconds: None,
        )
        self.assertTrue(published["published"])
        self.assertTrue(published["resumed"])
        self.assertFalse(any("+node-create" in argv for argv, _input in second.calls))
        recovery = next(argv for argv, _input in second.calls if "+node-get" in argv)
        self.assertEqual(recovery[recovery.index("--node-token") + 1], "wik-child")

    def test_remote_match_requires_the_complete_body(self) -> None:
        _article, body = self.article()
        changed = body.replace("Verified content.", "Manually changed content.", 1)
        title = "Verified result"

        self.assertTrue(lark_publish._remote_matches(body, body, title))
        self.assertTrue(lark_publish._remote_matches(body, f"# {title}\n\n{body}", title))
        self.assertFalse(lark_publish._remote_matches(body, f"# Remote title\n\n{body}", title))
        self.assertFalse(lark_publish._remote_matches(body, f"# {title}\n\n{changed}", title))
        self.assertTrue(lark_publish._remote_is_empty(f"# {title}\n", title))
        self.assertFalse(lark_publish._remote_is_empty("# Manually renamed\n", title))

    def test_publication_lock_serializes_callers(self) -> None:
        root = self.root / "locked-config"
        entered = threading.Event()
        release = threading.Event()
        acquired = threading.Event()

        def holder() -> None:
            with lark_publish._publication_lock(root):
                entered.set()
                release.wait(2)

        def waiter() -> None:
            with lark_publish._publication_lock(root):
                acquired.set()

        first = threading.Thread(target=holder)
        second = threading.Thread(target=waiter)
        first.start()
        self.assertTrue(entered.wait(1))
        second.start()
        try:
            self.assertFalse(acquired.wait(0.1))
        finally:
            release.set()
            first.join(2)
            second.join(2)
        self.assertTrue(acquired.is_set())

    def test_delayed_verification_recovers_from_a_malformed_first_fetch(self) -> None:
        article, body = self.article()
        self.write_config()
        sleeps: list[float] = []
        runner = FakeRunner(
            [
                version(),
                auth(),
                created_payload(),
                result({"ok": True}),
                result({"ok": True, "data": {"document": {"revision_id": 7}}}),
                fetched(body),
            ]
        )
        published = lark_publish.publish(
            article,
            environ=self.environ,
            runner=runner,
            sleeper=sleeps.append,
        )
        self.assertTrue(published["published"])
        self.assertEqual(sleeps, [1.0])
        self.assertEqual(sum("+update" in argv for argv, _input in runner.calls), 1)

    def test_verification_failure_does_not_overwrite_twice(self) -> None:
        article, _body = self.article()
        self.write_config()
        runner = FakeRunner(
            [
                version(),
                auth(),
                created_payload(),
                result({"ok": True}),
                fetched("Different safe content."),
                fetched("Different safe content."),
            ]
        )
        with self.assertRaisesRegex(lark_publish.PublishError, "different content"):
            lark_publish.publish(
                article,
                environ=self.environ,
                runner=runner,
                sleeper=lambda _seconds: None,
            )
        self.assertEqual(sum("+update" in argv for argv, _input in runner.calls), 1)


if __name__ == "__main__":
    unittest.main()
