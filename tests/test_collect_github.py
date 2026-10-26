import datetime as dt
import importlib.util
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "collect_github.py"
SPEC = importlib.util.spec_from_file_location("collect_github", MODULE_PATH)
collect_github = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collect_github)


def repo(name="owner/repo", stars=1):
    return {
        "full_name": name,
        "html_url": f"https://github.com/{name}",
        "description": "demo",
        "topics": ["agent"],
        "stargazers_count": stars,
        "forks_count": 0,
        "open_issues_count": 0,
        "updated_at": "2026-10-25T00:00:00Z",
    }


class CollectorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config_path = self.root / "sources.json"
        self.output_path = self.root / "discoveries.json"
        self.patches = [
            mock.patch.object(collect_github, "ROOT", self.root),
            mock.patch.object(collect_github, "CONFIG_PATH", self.config_path),
            mock.patch.object(collect_github, "OUTPUT_PATH", self.output_path),
            mock.patch.object(collect_github.time, "sleep"),
        ]
        for patch in self.patches:
            patch.start()

    def tearDown(self):
        for patch in reversed(self.patches):
            patch.stop()
        self.temp.cleanup()

    def run_collector(self, config, request=None, previous=None):
        self.config_path.write_text(json.dumps(config), encoding="utf-8")
        if previous is not None:
            self.output_path.write_text(json.dumps(previous), encoding="utf-8")
        request = request or mock.Mock(return_value={"items": []})
        with mock.patch.object(collect_github, "request_json", request):
            collect_github.main()
        return json.loads(self.output_path.read_text(encoding="utf-8")), request

    def test_merge_preserves_multiple_sources_and_relationships(self):
        candidates = {}
        owned = collect_github.normalize(repo(), "profile:user:owned", "user:owned")
        starred = collect_github.normalize(repo(), "profile:user:starred", "user:starred")
        collect_github.merge_candidate(candidates, owned, "profile:user:owned")
        collect_github.merge_candidate(candidates, starred, "profile:user:starred")
        item = candidates["owner/repo"]
        self.assertEqual(item["relationships"], ["user:owned", "user:starred"])
        self.assertEqual(item["also_seen_in"], ["profile:user:starred"])

    def test_normalize_accepts_curated_fields_and_html_url(self):
        item = collect_github.normalize({
            "html_url": "https://github.com/owner/public",
            "private": False,
            "stars": 7,
            "forks": 2,
            "open_issues": 3,
            "license": "MIT",
        }, "curated:test")
        self.assertEqual(item["full_name"], "owner/public")
        self.assertEqual((item["stars"], item["forks"], item["open_issues"], item["license"]), (7, 2, 3, "MIT"))
        self.assertNotIn("private", item)

    def test_feed_is_imported_first_and_fresh_repository_uses_no_github_request(self):
        feed_path = self.root / "feed.json"
        feed_path.write_text(json.dumps({"generated_at": collect_github.utcnow().isoformat(), "candidates": [repo(stars=9)]}), encoding="utf-8")
        output, request = self.run_collector({
            "curated_feeds": [{"name": "local", "path": "feed.json"}],
            "repositories": ["owner/repo"],
            "policy": {"curated_feed_max_stale_hours": 24},
        })
        request.assert_not_called()
        item = output["candidates"][0]
        self.assertEqual(item["source"], "curated:local")
        self.assertIn("repository:owner/repo", item["also_seen_in"])
        self.assertTrue(output["source_status"]["repository:owner/repo"]["cached"])

    def test_fresh_discovery_cache_avoids_all_github_requests_and_keeps_relationship(self):
        now = collect_github.utcnow().isoformat()
        previous_item = collect_github.normalize(repo(), "profile:user:owned", "user:owned", now)
        previous = {"generated_at": now, "candidates": [previous_item], "source_status": {}, "schema_version": 1}
        output, request = self.run_collector({
            "github_profiles": [{"username": "user", "owned_public_repositories": True}],
            "policy": {"discovery_cache_hours": 24},
        }, previous=previous)
        request.assert_not_called()
        self.assertEqual(output["candidates"][0]["relationships"], ["user:owned"])
        self.assertEqual(output["candidates"][0]["source"], "profile:user:owned")

    def test_expired_feed_and_discovery_cache_refresh_from_github(self):
        old = "2020-01-01T00:00:00+00:00"
        feed_path = self.root / "feed.json"
        feed_path.write_text(json.dumps({"generated_at": old, "repositories": [repo()]}), encoding="utf-8")
        previous = {"generated_at": old, "candidates": [collect_github.normalize(repo("cached/search"), "search:test", collected_at=old)], "schema_version": 1}
        request = mock.Mock(side_effect=[repo(stars=5), {"items": [repo("fresh/search")]}])
        output, request = self.run_collector({
            "curated_feeds": [{"name": "old", "path": "feed.json", "max_stale_hours": 1}],
            "repositories": ["owner/repo"],
            "github_queries": ["test"],
            "policy": {"discovery_cache_hours": 1},
        }, request=request, previous=previous)
        self.assertEqual(request.call_count, 2)
        self.assertFalse(output["source_status"]["curated:old"]["fresh"])
        self.assertFalse(output["source_status"]["repository:owner/repo"].get("cached", False))
        refreshed = next(item for item in output["candidates"] if item["full_name"] == "owner/repo")
        self.assertEqual(refreshed["stars"], 5)
        self.assertEqual(refreshed["source"], "repository:owner/repo")
        self.assertIn("curated:old", refreshed["also_seen_in"])

    def test_discovery_cache_does_not_extend_original_fetch_time(self):
        start = dt.datetime(2026, 10, 26, 0, 0, tzinfo=dt.timezone.utc)
        config = {"github_queries": ["test"], "policy": {"discovery_cache_hours": 24}}

        first_request = mock.Mock(return_value={"items": [repo("first/result")]})
        with mock.patch.object(collect_github, "utcnow", return_value=start):
            first, _ = self.run_collector(config, request=first_request)
        origin = first["source_status"]["search:test"]["fetched_at"]
        self.assertEqual(origin, start.isoformat())

        cached_request = mock.Mock()
        with mock.patch.object(collect_github, "utcnow", return_value=start + dt.timedelta(hours=12)):
            cached, _ = self.run_collector(config, request=cached_request)
        cached_request.assert_not_called()
        self.assertEqual(cached["source_status"]["search:test"]["fetched_at"], origin)
        self.assertNotEqual(cached["generated_at"], origin)

        refresh_request = mock.Mock(return_value={"items": [repo("refreshed/result")]})
        refresh_time = start + dt.timedelta(hours=25)
        with mock.patch.object(collect_github, "utcnow", return_value=refresh_time):
            refreshed, _ = self.run_collector(config, request=refresh_request)
        refresh_request.assert_called_once()
        self.assertEqual(refreshed["source_status"]["search:test"]["fetched_at"], refresh_time.isoformat())
        self.assertEqual(refreshed["candidates"][0]["full_name"], "refreshed/result")

    def test_feed_failure_is_recorded_and_github_fallback_continues(self):
        request = mock.Mock(return_value=repo())
        output, request = self.run_collector({
            "curated_feeds": [{"name": "missing", "path": "missing.json"}],
            "repositories": ["owner/repo"],
        }, request=request)
        request.assert_called_once_with("/repos/owner/repo")
        self.assertFalse(output["source_status"]["curated:missing"]["ok"])
        self.assertTrue(output["source_status"]["repository:owner/repo"]["ok"])

    def test_duplicate_feed_and_search_merge_sources(self):
        feed_path = self.root / "feed.json"
        feed_path.write_text(json.dumps([repo()]), encoding="utf-8")
        request = mock.Mock(return_value={"items": [repo()]})
        output, _ = self.run_collector({
            "curated_feeds": [{"name": "array", "path": "feed.json"}],
            "github_queries": ["test"],
            "policy": {"discovery_cache_hours": 0},
        }, request=request)
        self.assertEqual(len(output["candidates"]), 1)
        self.assertEqual(output["candidates"][0]["source"], "curated:array")
        self.assertIn("search:test", output["candidates"][0]["also_seen_in"])


if __name__ == "__main__":
    unittest.main()
