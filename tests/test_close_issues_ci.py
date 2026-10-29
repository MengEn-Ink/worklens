import importlib.util
import io
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "close_issues_ci.py"
SPEC = importlib.util.spec_from_file_location("close_issues_ci", MODULE_PATH)
close_issues_ci = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(close_issues_ci)

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "issue-close-requests.json"


def make_request(**overrides):
    request = {
        "issue": 85,
        "title": "健康巡检测试 Issue",
        "reason": "验收标准已满足，登记收口。",
        "evidence_ref": "docs/loop-log.md",
        "requested_by": "worklens-loop",
        "requested_at": "2026-10-29T08:15:00Z",
    }
    request.update(overrides)
    return request


def make_payload(requests=None, **policy_overrides):
    policy = {"public_only": True, "close_via_ci_only": True}
    policy.update(policy_overrides)
    return {
        "schema_version": 1,
        "policy": policy,
        "requests": [make_request()] if requests is None else requests,
    }


class ValidateTests(unittest.TestCase):
    def test_checked_in_ledger_is_valid(self):
        payload = close_issues_ci.load(DATA_PATH)
        self.assertEqual(close_issues_ci.validate(payload), [])

    def test_policy_flags_required(self):
        payload = make_payload(public_only=False)
        errors = close_issues_ci.validate(payload)
        self.assertTrue(any("public_only" in item for item in errors))
        payload = make_payload(close_via_ci_only=False)
        errors = close_issues_ci.validate(payload)
        self.assertTrue(any("close_via_ci_only" in item for item in errors))

    def test_bad_schema_and_empty_requests(self):
        payload = make_payload()
        payload["schema_version"] = 2
        self.assertTrue(close_issues_ci.validate(payload))
        payload = make_payload(requests=[])
        self.assertTrue(close_issues_ci.validate(payload))

    def test_issue_must_be_positive_unique_int(self):
        for bad in (0, -1, "85", True):
            payload = make_payload(requests=[make_request(issue=bad)])
            self.assertTrue(close_issues_ci.validate(payload), bad)
        payload = make_payload(requests=[make_request(issue=85), make_request(issue=85)])
        self.assertTrue(any("重复登记" in item for item in close_issues_ci.validate(payload)))

    def test_text_fields_safe(self):
        payload = make_payload(requests=[make_request(title="  ")])
        self.assertTrue(any("title" in item for item in close_issues_ci.validate(payload)))
        payload = make_payload(requests=[make_request(reason="x" * 501)])
        self.assertTrue(any("reason" in item for item in close_issues_ci.validate(payload)))
        payload = make_payload(requests=[make_request(reason="token ghp_" + "a" * 36)])
        self.assertTrue(any("凭证" in item for item in close_issues_ci.validate(payload)))
        payload = make_payload(requests=[make_request(reason="见 http://x.byted.org/secret")])
        self.assertTrue(any("内网地址" in item for item in close_issues_ci.validate(payload)))

    def test_requester_timestamp_evidence_ref(self):
        payload = make_payload(requests=[make_request(requested_by="WorkLens Loop")])
        self.assertTrue(close_issues_ci.validate(payload))
        payload = make_payload(requests=[make_request(requested_at="2026-10-29 08:15")])
        self.assertTrue(close_issues_ci.validate(payload))
        payload = make_payload(requests=[make_request(evidence_ref="../secrets.txt")])
        self.assertTrue(close_issues_ci.validate(payload))
        payload = make_payload(requests=[make_request(evidence_ref="data/health-checks.json")])
        self.assertEqual(close_issues_ci.validate(payload), [])


class RenderCommentTests(unittest.TestCase):
    def test_comment_contains_all_public_facts(self):
        comment = close_issues_ci.render_comment(make_request())
        self.assertIn("健康巡检测试 Issue", comment)
        self.assertIn("验收标准已满足", comment)
        self.assertIn("docs/loop-log.md", comment)
        self.assertIn("worklens-loop", comment)
        self.assertIn("GITHUB_TOKEN", comment)


class ApplyTests(unittest.TestCase):
    def test_open_issue_gets_comment_and_close(self):
        calls = []

        def fake_github_request(method, url, token, payload=None):
            calls.append((method, url, payload))
            if method == "GET":
                return {"state": "open"}
            return {}

        with mock.patch.object(close_issues_ci, "github_request", side_effect=fake_github_request):
            code = close_issues_ci.apply_requests([make_request()], "MengEn-Ink/worklens", "tok")
        self.assertEqual(code, 0)
        self.assertEqual([call[0] for call in calls], ["GET", "POST", "PATCH"])
        self.assertTrue(calls[1][1].endswith("/issues/85/comments"))
        self.assertEqual(calls[2][2], {"state": "closed", "state_reason": "completed"})

    def test_closed_issue_is_skipped_idempotently(self):
        calls = []

        def fake_github_request(method, url, token, payload=None):
            calls.append(method)
            if method == "GET":
                return {"state": "closed"}
            return {}

        with mock.patch.object(close_issues_ci, "github_request", side_effect=fake_github_request):
            code = close_issues_ci.apply_requests([make_request()], "MengEn-Ink/worklens", "tok")
        self.assertEqual(code, 0)
        self.assertEqual(calls, ["GET"])

    def test_http_error_bubbles_up(self):
        def fake_github_request(method, url, token, payload=None):
            raise urllib.error.HTTPError(
                url,
                403,
                "Forbidden",
                {},
                io.BytesIO(b'{"message":"Resource not accessible"}'),
            )

        with mock.patch.object(close_issues_ci, "github_request", side_effect=fake_github_request):
            with self.assertRaises(urllib.error.HTTPError):
                close_issues_ci.apply_requests([make_request()], "MengEn-Ink/worklens", "tok")


class CliTests(unittest.TestCase):
    def test_validate_command(self):
        self.assertEqual(close_issues_ci.main(["validate"]), 0)

    def test_apply_requires_ci_environment(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertEqual(close_issues_ci.main(["apply"]), 2)

    def test_dry_run_prints_plan_without_requests(self):
        env = {"GITHUB_REPOSITORY": "MengEn-Ink/worklens", "GITHUB_TOKEN": "tok"}
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(close_issues_ci, "github_request") as api:
                self.assertEqual(close_issues_ci.main(["apply", "--dry-run"]), 0)
                api.assert_not_called()


if __name__ == "__main__":
    unittest.main()
