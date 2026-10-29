import datetime as dt
import importlib.util
import unittest
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "repo_insights.py"
SPEC = importlib.util.spec_from_file_location("repo_insights", MODULE_PATH)
repo_insights = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(repo_insights)

NOW = dt.datetime(2026, 10, 29, tzinfo=dt.timezone.utc)
README = """# Demo MCP

[![build](https://img.shields.io/x.svg)](https://ci)

Demo MCP is a server that lets Claude call your internal tools without writing glue code for every client.

## Why

Tired of rewriting the same integration for every AI client? Demo gives one protocol for all of them.

## Features

- **Zero config**: auto-discovers tools from an OpenAPI spec
- Streaming responses with backpressure
- Fine-grained permission scopes per tool

## How it works

The server translates OpenAPI operations into MCP tools. Each call is validated before execution.

## Quick start

```bash
npx demo-mcp init
```
"""


def candidate(name="acme/demo", pushed="2026-10-28T00:00:00Z", **extra):
    base = {"full_name": name, "description": "demo mcp", "topics": ["mcp", "claude-code"], "language": "TypeScript",
            "stars": 1200, "open_issues": 3, "license": "MIT", "pushed_at": pushed, "source": "trending:daily",
            "also_seen_in": ["search:a", "search:b"]}
    base.update(extra)
    return base


SETTINGS = dict(repo_insights.DEFAULTS, request_interval_seconds=0)


class ParseTest(unittest.TestCase):
    def test_readme_sections_and_quickstart(self):
        with mock.patch.object(repo_insights, "utcnow", return_value=NOW):
            insight = repo_insights.build_readme_insight(candidate(), README, {"TypeScript": 900, "Shell": 100}, ["packages", "examples", "package.json"])
        self.assertIn("lets Claude call your internal tools", insight["tagline"])
        self.assertTrue(any("Zero config" in s["text"] and s["from"] == "readme" for s in insight["strengths"]))
        self.assertTrue(any("Tired of rewriting" in p["text"] for p in insight["pain_points"]))
        self.assertTrue(any("OpenAPI operations" in d["text"] for d in insight["design"]))
        self.assertEqual(insight["quickstart"], "npx demo-mcp init")
        self.assertEqual(insight["facets"][0], "mcp")
        self.assertEqual(insight["architecture"]["stack"][0], {"lang": "TypeScript", "pct": 90.0})
        self.assertTrue(any("monorepo" in x for x in insight["architecture"]["layout"]))
        self.assertTrue(any(s["from"] == "facts" and "MIT" in s["text"] for s in insight["strengths"]))

    def test_sensitive_text_is_dropped(self):
        readme = "# X\n\n## Features\n\n- token ghp_" + "a" * 40 + " leaked here in docs\n- Clean feature that is long enough\n"
        insight = repo_insights.build_readme_insight(candidate(), readme, {}, [])
        self.assertFalse(any("ghp_" in s["text"] for s in insight["strengths"]))
        self.assertEqual(repo_insights.validate({"schema_version": 1, "items": {"a/b": dict(insight, schema=1, readme_sha="x")}}), [])


class CacheTest(unittest.TestCase):
    def run_refresh(self, cache, candidates, fetch, now=NOW, llm=None):
        calls = []

        def structure(name):
            calls.append(name)
            return {"TypeScript": 1}, []
        with mock.patch.object(repo_insights, "utcnow", return_value=now), mock.patch.object(repo_insights.time, "sleep"):
            out = repo_insights.refresh({"candidates": candidates}, cache, SETTINGS, now, fetch=fetch, structure=structure, llm=llm)
        return out, calls

    def test_new_then_reused_without_requests(self):
        fetch = mock.Mock(return_value=("sha1", README, {}, []))
        first, _ = self.run_refresh({}, [candidate()], fetch)
        self.assertEqual(first["summary"]["last_run"]["new"], 1)
        fetch.reset_mock()
        second, calls = self.run_refresh(first, [candidate()], fetch, now=NOW + dt.timedelta(hours=5))
        fetch.assert_not_called()
        self.assertEqual(calls, [])
        self.assertEqual(second["summary"]["last_run"]["reused"], 1)

    def test_push_after_recheck_window_costs_one_request_when_readme_same(self):
        fetch = mock.Mock(return_value=("sha1", README, {}, []))
        first, _ = self.run_refresh({}, [candidate()], fetch)
        later = NOW + dt.timedelta(hours=80)
        out, calls = self.run_refresh(first, [candidate(pushed="2026-10-31T00:00:00Z")], fetch, now=later)
        self.assertEqual(out["summary"]["last_run"]["rechecked_same"], 1)
        self.assertEqual(calls, [], "README 指纹未变时不再请求语言与目录")
        self.assertEqual(out["items"]["acme/demo"]["generated_at"], first["items"]["acme/demo"]["generated_at"])

    def test_readme_change_regenerates(self):
        first, _ = self.run_refresh({}, [candidate()], mock.Mock(return_value=("sha1", README, {}, [])))
        out, _ = self.run_refresh(first, [candidate()], mock.Mock(return_value=("sha2", README, {}, [])), now=NOW + dt.timedelta(days=30))
        self.assertEqual(out["summary"]["last_run"]["regenerated"], 1)
        self.assertEqual(out["items"]["acme/demo"]["readme_sha"], "sha2")

    def test_identical_readme_is_shared(self):
        fetch = mock.Mock(return_value=("same", README, {}, []))
        out, calls = self.run_refresh({}, [candidate("a/one", stars=10), candidate("b/two", stars=1)], fetch)
        self.assertEqual(out["summary"]["last_run"]["shared"], 1)
        self.assertEqual(len(calls), 1)
        self.assertEqual(out["items"]["b/two"]["shared_with"], "a/one")

    def test_editor_record_is_never_overwritten(self):
        cache = {"items": {"acme/demo": {"method": "editor", "tagline": "人工", "readme_sha": "old", "checked_at": "2026-09-01T00:00:00Z"}}}
        out, _ = self.run_refresh(cache, [candidate()], mock.Mock(return_value=("new", README, {}, [])))
        record = out["items"]["acme/demo"]
        self.assertEqual(record["tagline"], "人工")
        self.assertTrue(record["readme_changed"])

    def test_budget_defers_and_llm_gets_digest_only(self):
        seen = []

        def llm(digest):
            seen.append(digest)
            return {"tagline": "一句话", "strengths": ["优点 A"]}
        settings = dict(SETTINGS, max_new_per_run=1, max_llm_per_run=1, digest_chars=600)
        with mock.patch.object(repo_insights.time, "sleep"):
            out = repo_insights.refresh({"candidates": [candidate("a/x"), candidate("b/y", stars=1)]}, {}, settings, NOW,
                                        fetch=mock.Mock(return_value=("s", README * 20, {}, [])), structure=lambda n: ({}, []), llm=llm)
        self.assertEqual(out["summary"]["last_run"]["deferred"], 1)
        self.assertLessEqual(len(seen[0]), 600)
        record = out["items"]["a/x"]
        self.assertEqual(record["method"], "llm")
        self.assertEqual(record["strengths"][0], {"text": "优点 A", "from": "llm"})

    def test_prune_unseen(self):
        cache = {"items": {"gone/repo": {"method": "readme", "tagline": "", "readme_sha": "x", "last_seen_at": "2026-08-01T00:00:00Z", "checked_at": "2026-08-01T00:00:00Z"}}}
        out, _ = self.run_refresh(cache, [], mock.Mock())
        self.assertNotIn("gone/repo", out["items"])

    def test_validate_rejects_bad_origin(self):
        errors = repo_insights.validate({"schema_version": 1, "items": {"a/b": {"method": "readme", "tagline": "", "readme_sha": "x", "strengths": [{"text": "t", "from": "guess"}]}}})
        self.assertTrue(errors)


class RepositoryDataTest(unittest.TestCase):
    def test_committed_cache_is_valid(self):
        path = repo_insights.OUTPUT_PATH
        if path.exists():
            self.assertEqual(repo_insights.validate(repo_insights.load_json(path, {})), [])


if __name__ == "__main__":
    unittest.main()
