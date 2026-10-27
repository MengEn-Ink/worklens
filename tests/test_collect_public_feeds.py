import datetime as dt
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "collect_public_feeds.py"
SPEC = importlib.util.spec_from_file_location("collect_public_feeds", MODULE_PATH)
feeds = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(feeds)


class PublicFeedParserTest(unittest.TestCase):
    def test_parse_rss_and_atom(self):
        rss = b"""<rss><channel><item><title>RSS item</title><link>https://example.com/post?utm_source=x</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>"""
        atom = b"""<feed xmlns='http://www.w3.org/2005/Atom'><entry><title>v1.2</title><link href='https://github.com/acme/tool/releases/tag/v1.2'/><updated>2026-10-26T11:00:00Z</updated></entry></feed>"""
        rss_items = feeds.parse_xml(rss, {"name": "RSS", "site_name": "RSS", "priority": "P2"})
        atom_items = feeds.parse_xml(atom, {"name": "Releases", "repository": "acme/tool", "category": "release", "priority": "P1"})
        self.assertEqual(rss_items[0]["url"], "https://example.com/post")
        self.assertEqual(rss_items[0]["published_at"], "2026-10-26T10:00:00Z")
        self.assertEqual(atom_items[0]["metadata"], {"repository": "acme/tool", "release": "v1.2"})

    def test_parse_xml_recognizes_namespaced_item_and_entry_together(self):
        payload = b"""<root xmlns:r='urn:rss' xmlns:a='urn:atom'><r:item><r:title>RSS namespaced</r:title><r:link>https://example.com/rss</r:link></r:item><a:entry><a:title>Atom namespaced</a:title><a:link href='https://example.com/atom'/></a:entry></root>"""
        items = feeds.parse_xml(payload, {"name": "mixed", "priority": "P2"})
        self.assertEqual([item["title"] for item in items], ["RSS namespaced", "Atom namespaced"])

    def test_canonical_url_rejects_invalid_port(self):
        self.assertEqual(feeds.canonical_url("https://example.com:not-a-port/path"), "")

    def test_parse_aggregator_filters_and_normalizes(self):
        payload = json.dumps({"items": [
            {"title": "not relevant", "url": "https://example.com/no"},
            {"title_zh": "Agent 发布", "title": "Agent release", "url": "https://example.com/yes?gclid=1"},
        ]}).encode()
        items = feeds.parse_aggregator(payload, {"name": "Aggregator", "keywords": ["agent"], "priority": "P2"})
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "Agent 发布")
        self.assertEqual(items[0]["url"], "https://example.com/yes")

    def test_hacker_news_lists_details_and_applies_heat(self):
        source = {"name": "HN", "url": "https://hn/v0", "lists": ["top", "new"], "max_ids_per_list": 2, "minimum_score": 20, "keywords": ["agent"], "priority": "P2"}

        def response(url, *_args, **_kwargs):
            if url.endswith("topstories.json"):
                return 200, b"[1, 2]", {}
            if url.endswith("newstories.json"):
                return 200, b"[2, 3]", {}
            item_id = int(url.split("/")[-1].split(".")[0])
            raw = {"id": item_id, "title": "Agent tooling" if item_id != 3 else "Other", "url": f"https://example.com/{item_id}", "time": 1, "score": 25 if item_id == 1 else 5}
            return 200, json.dumps(raw).encode(), {}

        with mock.patch.object(feeds, "request_bytes", side_effect=response):
            items, _ = feeds.fetch_hacker_news(source, {"attempts": 1, "backoff": 0})
        self.assertEqual([item["metadata"]["hn_id"] for item in items], [1])

    def test_hacker_news_skips_null_and_non_object_details(self):
        source = {"name": "HN", "url": "https://hn/v0", "lists": ["top"], "keywords": ["agent"], "minimum_score": 1}

        def response(url, *_args, **_kwargs):
            if url.endswith("topstories.json"):
                return 200, b"[1, 2, 3]", {}
            item_id = int(url.split("/")[-1].split(".")[0])
            payloads = {
                1: {"id": 1, "title": "Agent item", "url": "https://example.com/1", "score": 2},
                2: None,
                3: ["not", "an", "object"],
            }
            return 200, json.dumps(payloads[item_id]).encode(), {}

        with mock.patch.object(feeds, "request_bytes", side_effect=response):
            items, _ = feeds.fetch_hacker_news(source, {"attempts": 1, "backoff": 0})
        self.assertEqual([item["metadata"]["hn_id"] for item in items], [1])

    def test_osv_querybatch_and_cisa_high_value_filter(self):
        osv_payload = {"results": [{"vulns": [{"id": "GHSA-2345-6789-cfgh", "aliases": ["CVE-2026-12345"], "modified": "2026-10-26T00:00:00Z", "summary": "Package issue"}]}]}
        with mock.patch.object(feeds, "request_bytes", return_value=(200, json.dumps(osv_payload).encode(), {})) as request:
            items, _ = feeds.fetch_osv({"name": "OSV", "url": "https://osv", "priority": "P0", "queries": [{"ecosystem": "PyPI", "package": "openai"}]}, {"attempts": 1, "backoff": 0})
        sent = json.loads(request.call_args.args[4])
        self.assertEqual(sent["queries"][0]["package"]["name"], "openai")
        self.assertEqual(items[0]["metadata"]["aliases"], ["GHSA-2345-6789-cfgh", "CVE-2026-12345"])

        cisa_payload = {"vulnerabilities": [
            {"cveID": "CVE-2026-9999", "vendorProject": "Unrelated", "product": "Old", "vulnerabilityName": "Old issue", "dateAdded": "2020-01-01"},
            {"cveID": "CVE-2026-10000", "vendorProject": "GitHub", "product": "Runner", "vulnerabilityName": "Runner issue", "dateAdded": "2020-01-01"},
            {"cveID": "CVE-2026-10001", "vendorProject": "Other", "product": "New", "vulnerabilityName": "New issue", "dateAdded": "2026-10-25"},
        ]}
        with mock.patch.object(feeds, "request_bytes", return_value=(200, json.dumps(cisa_payload).encode(), {})):
            items, _ = feeds.fetch_cisa({"name": "CISA", "url": "https://cisa", "priority": "P0", "keywords": ["GitHub"], "recent_days": 14}, {"attempts": 1, "backoff": 0}, dt.datetime(2026, 10, 27, tzinfo=dt.timezone.utc))
        self.assertEqual({item["metadata"]["id"] for item in items}, {"CVE-2026-10000", "CVE-2026-10001"})


class PublicFeedMergeTest(unittest.TestCase):
    def item(self, title, url, priority="P2", source="one", metadata=None, published="2026-10-26T00:00:00Z"):
        return feeds.normalize_item({"title": title, "url": url, "priority": priority, "published_at": published, "metadata": metadata or {}}, source)

    def test_url_release_and_vulnerability_dedup_preserve_highest_priority(self):
        url_items = [
            self.item("first", "https://example.com/a?utm_source=x", "P2", "one"),
            self.item("second", "https://example.com/a?gclid=y", "P1", "two"),
        ]
        merged = feeds.deduplicate(url_items)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["priority"], "P1")
        self.assertEqual(merged[0]["source"], ["two", "one"])
        self.assertEqual(merged[0]["also_seen_in"], ["one"])

        releases = feeds.deduplicate([
            self.item("release A", "https://github.com/acme/tool/releases/tag/v1?utm_source=x", metadata={"repository": "acme/tool", "release": "v1"}),
            self.item("release B", "https://mirror.example/release", metadata={"repository": "ACME/TOOL", "tag": "V1"}),
        ])
        self.assertEqual(len(releases), 1)

        vulnerabilities = feeds.deduplicate([
            self.item("OSV GHSA-2345-6789-cfgh", "https://osv.dev/a", metadata={"aliases": ["CVE-2026-12345"]}),
            self.item("CISA CVE-2026-12345", "https://cisa.example/a", "P0"),
        ])
        self.assertEqual(len(vulnerabilities), 1)
        self.assertEqual(vulnerabilities[0]["priority"], "P0")

        transitive = feeds.deduplicate([
            self.item("CVE record", "https://security.example/cve", metadata={"aliases": ["CVE-2026-54321"]}),
            self.item("GHSA record", "https://security.example/ghsa", metadata={"aliases": ["GHSA-2345-6789-cfgh"]}),
            self.item("bridge", "https://security.example/bridge", metadata={"aliases": ["CVE-2026-54321", "GHSA-2345-6789-cfgh"]}),
        ])
        self.assertEqual(len(transitive), 1)

    def test_priority_then_time_sort(self):
        items = feeds.deduplicate([
            self.item("new p2", "https://e/1", "P2", published="2026-10-27T00:00:00Z"),
            self.item("old p0", "https://e/2", "P0", published="2026-10-20T00:00:00Z"),
            self.item("new p1", "https://e/3", "P1", published="2026-10-27T00:00:00Z"),
            self.item("old p1", "https://e/4", "P1", published="2026-10-26T00:00:00Z"),
        ])
        self.assertEqual([item["title"] for item in items], ["old p0", "new p1", "old p1", "new p2"])


class PublicFeedCacheTest(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 27, tzinfo=dt.timezone.utc)
        self.source = {"name": "feed", "type": "rss", "url": "https://feed", "ttl_hours": 24}
        self.policy = {"ttl_hours": 24, "attempts": 1, "backoff": 0}
        fingerprint = {"source": self.source, "effective_max_items": 50}
        self.config_hash = feeds.hashlib.sha256(json.dumps(fingerprint, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        self.cached_item = feeds.normalize_item({"title": "cached", "url": "https://example.com/cached"}, "feed")

    def test_fresh_ttl_skips_network(self):
        cache = {"items": [self.cached_item], "fetched_at": (self.now - dt.timedelta(hours=2)).isoformat(), "checked_at": (self.now - dt.timedelta(hours=2)).isoformat(), "config_hash": self.config_hash}
        with mock.patch.object(feeds, "fetch_regular") as fetch:
            items, status, _ = feeds.collect_source(self.source, cache, self.policy, self.now)
        fetch.assert_not_called()
        self.assertEqual(items, [self.cached_item])
        self.assertTrue(status["cached"])

    def test_fresh_empty_cache_skips_network(self):
        cache = {"items": [], "fetched_at": self.now.isoformat(), "checked_at": self.now.isoformat(), "config_hash": self.config_hash}
        with mock.patch.object(feeds, "fetch_regular") as fetch:
            items, status, returned_cache = feeds.collect_source(self.source, cache, self.policy, self.now)
        fetch.assert_not_called()
        self.assertEqual(items, [])
        self.assertEqual(returned_cache["items"], [])
        self.assertTrue(status["cached"])
        self.assertEqual(status["count"], 0)

    def test_empty_success_degrades_to_nonempty_cache_by_default(self):
        fetched = (self.now - dt.timedelta(days=2)).isoformat()
        cache = {"items": [self.cached_item], "fetched_at": fetched, "checked_at": fetched, "config_hash": self.config_hash}
        with mock.patch.object(feeds, "fetch_regular", return_value=([], {}, False)):
            items, status, returned_cache = feeds.collect_source(self.source, cache, self.policy, self.now)
        self.assertEqual(items, [self.cached_item])
        self.assertEqual(returned_cache["items"], [self.cached_item])
        self.assertFalse(status["ok"])
        self.assertTrue(status["degraded"])
        self.assertEqual(status["fetched_at"], fetched)

    def test_allow_empty_explicitly_clears_nonempty_cache(self):
        source = dict(self.source, allow_empty=True)
        fingerprint = {"source": source, "effective_max_items": 50}
        config_hash = feeds.hashlib.sha256(json.dumps(fingerprint, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        fetched = (self.now - dt.timedelta(days=2)).isoformat()
        cache = {"items": [self.cached_item], "fetched_at": fetched, "checked_at": fetched, "config_hash": config_hash}
        with mock.patch.object(feeds, "fetch_regular", return_value=([], {}, False)):
            items, status, returned_cache = feeds.collect_source(source, cache, self.policy, self.now)
        self.assertEqual(items, [])
        self.assertEqual(returned_cache["items"], [])
        self.assertTrue(status["ok"])
        self.assertFalse(status["cached"])

    def test_failure_degrades_only_failed_source_without_extending_ttl(self):
        fetched = (self.now - dt.timedelta(days=2)).isoformat()
        cache = {"items": [self.cached_item], "fetched_at": fetched, "checked_at": fetched, "config_hash": self.config_hash}
        with mock.patch.object(feeds, "fetch_regular", side_effect=OSError("offline")):
            items, status, returned_cache = feeds.collect_source(self.source, cache, self.policy, self.now)
        self.assertEqual(items, [self.cached_item])
        self.assertFalse(status["ok"])
        self.assertTrue(status["degraded"])
        self.assertEqual(returned_cache["fetched_at"], fetched)

    def test_source_limit_and_config_change_invalidate_cache(self):
        changed = dict(self.source, max_items=2)
        cached = {"items": [self.cached_item], "fetched_at": self.now.isoformat(), "checked_at": self.now.isoformat(), "config_hash": self.config_hash}
        fresh_items = [feeds.normalize_item({"title": f"item {index}", "url": f"https://example.com/{index}", "published_at": f"2026-10-2{index}T00:00:00Z"}, "feed") for index in range(1, 5)]
        with mock.patch.object(feeds, "fetch_regular", return_value=(fresh_items, {}, False)) as fetch:
            items, _status, returned_cache = feeds.collect_source(changed, cached, self.policy, self.now)
        fetch.assert_called_once()
        self.assertEqual(len(items), 2)
        self.assertEqual(len(returned_cache["items"]), 2)
        self.assertNotEqual(returned_cache["config_hash"], self.config_hash)

    def test_source_limit_is_minimum_of_global_and_source_limit(self):
        changed = dict(self.source, max_items=99)
        policy = dict(self.policy, source_max_items=2)
        fresh_items = [feeds.normalize_item({"title": f"item {index}", "url": f"https://example.com/{index}"}, "feed") for index in range(4)]
        with mock.patch.object(feeds, "fetch_regular", return_value=(fresh_items, {}, False)):
            items, _status, returned_cache = feeds.collect_source(changed, {}, policy, self.now)
        self.assertEqual(len(items), 2)
        self.assertEqual(len(returned_cache["items"]), 2)

    def test_not_modified_reuses_cache_and_updates_check_only(self):
        fetched = (self.now - dt.timedelta(days=2)).isoformat()
        cache = {"items": [self.cached_item], "fetched_at": fetched, "checked_at": fetched, "etag": '"old"', "config_hash": self.config_hash}
        with mock.patch.object(feeds, "fetch_regular", return_value=(None, {"ETag": '"old"'}, True)):
            items, status, returned_cache = feeds.collect_source(self.source, cache, self.policy, self.now)
        self.assertEqual(items, [self.cached_item])
        self.assertTrue(status["not_modified"])
        self.assertEqual(returned_cache["fetched_at"], fetched)
        self.assertEqual(returned_cache["checked_at"], self.now.isoformat())


class PublicFeedMainTest(unittest.TestCase):
    def test_configured_source_limits_do_not_exceed_global_limit(self):
        config = json.loads((MODULE_PATH.parents[1] / "config" / "sources.json").read_text(encoding="utf-8"))
        public = config["public_feeds"]
        global_limit = public["source_max_items"]
        self.assertTrue(all(source.get("max_items", global_limit) <= global_limit for source in public["sources"]))

    def test_main_keeps_legacy_aggregator_items(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "sources.json"
            output_path = root / "ai-news.json"
            config_path.write_text(json.dumps({"public_feeds": {"enabled": True, "sources": [{"name": "new", "type": "rss", "url": "https://new"}]}}), encoding="utf-8")
            output_path.write_text(json.dumps({"items": [{"title": "legacy", "url": "https://legacy", "site_name": "old"}]}), encoding="utf-8")
            new_item = feeds.normalize_item({"title": "new", "url": "https://new/item"}, "new")
            with mock.patch.object(feeds, "CONFIG_PATH", config_path), mock.patch.object(feeds, "OUTPUT_PATH", output_path), mock.patch.object(feeds, "collect_source", return_value=([new_item], {"ok": True, "count": 1}, {"items": [new_item]})):
                self.assertEqual(feeds.main(), 0)
            result = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual({item["title"] for item in result["items"]}, {"legacy", "new"})
            self.assertEqual(result["schema_version"], 2)

    def test_main_enforces_total_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "sources.json"
            output_path = root / "ai-news.json"
            config_path.write_text(json.dumps({"public_feeds": {"enabled": True, "max_items": 2, "sources": [{"name": "feed", "type": "rss", "url": "https://feed"}]}}), encoding="utf-8")
            generated = [feeds.normalize_item({"title": f"item {index}", "url": f"https://example.com/{index}"}, "feed") for index in range(4)]
            with mock.patch.object(feeds, "CONFIG_PATH", config_path), mock.patch.object(feeds, "OUTPUT_PATH", output_path), mock.patch.object(feeds, "collect_source", return_value=(generated, {"ok": True, "count": 4}, {"items": generated})):
                self.assertEqual(feeds.main(), 0)
            result = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(len(result["items"]), 2)


if __name__ == "__main__":
    unittest.main()
