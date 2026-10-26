import datetime as dt
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

# Load the module under test
MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "collect_ai_news.py"
SPEC = importlib.util.spec_from_file_location("collect_ai_news", MODULE_PATH)
collect_ai_news = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collect_ai_news)


class AiNewsCollectorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config_path = self.root / "sources.json"
        self.output_path = self.root / "ai-news.json"

        self.patches = [
            mock.patch.object(collect_ai_news, "ROOT", self.root),
            mock.patch.object(collect_ai_news, "CONFIG_PATH", self.config_path),
            mock.patch.object(collect_ai_news, "OUTPUT_PATH", self.output_path),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def test_filter_and_sort_news(self):
        config = {
            "ai_news": {
                "enabled": True,
                "url": "http://example.com/news.json",
                "keywords": ["Agent", "LLM"],
                "max_items": 2,
            }
        }
        self.config_path.write_text(json.dumps(config), encoding="utf-8")

        mock_payload = {
            "items": [
                {
                    "title": "Agent breakthrough",
                    "url": "url1",
                    "published_at": "2026-10-26T10:00:00Z",
                },
                {
                    "title": "Random tech",
                    "url": "url2",
                    "published_at": "2026-10-26T09:00:00Z",
                },
                {
                    "title": "LLM study",
                    "url": "url3",
                    "published_at": "2026-10-26T11:00:00Z",
                },
                {
                    "title": "Duplicate Agent",
                    "url": "url1",
                    "published_at": "2026-10-26T12:00:00Z",
                },
            ]
        }

        with mock.patch.object(collect_ai_news, "fetch_json", return_value=mock_payload):
            collect_ai_news.main()

        output = json.loads(self.output_path.read_text(encoding="utf-8"))
        items = output["items"]

        # Should filter "Random tech", deduplicate "url1", sort by time desc, limit to 2
        # url3 (11:00) and url1 (10:00) are kept and sorted.
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["url"], "url3")  # 11:00
        self.assertEqual(items[1]["url"], "url1")  # 10:00

    def test_chinese_keyword_matching(self):
        config = {
            "ai_news": {
                "enabled": True,
                "url": "http://example.com/news.json",
                "keywords": ["智能体", "大模型"],
                "max_items": 10,
            }
        }
        self.config_path.write_text(json.dumps(config), encoding="utf-8")

        mock_payload = {
            "items": [
                {"title": "OpenAI 发布新智能体", "url": "url1"},
                {"title": "普通新闻", "url": "url2"},
                {"title": "深度解析大模型架构", "url": "url3"},
            ]
        }

        with mock.patch.object(collect_ai_news, "fetch_json", return_value=mock_payload):
            collect_ai_news.main()

        output = json.loads(self.output_path.read_text(encoding="utf-8"))
        self.assertEqual(len(output["items"]), 2)
        titles = [item["title"] for item in output["items"]]
        self.assertIn("OpenAI 发布新智能体", titles)
        self.assertIn("深度解析大模型架构", titles)

    def test_failure_preserves_old_items(self):
        config = {"ai_news": {"enabled": True, "url": "fail"}}
        self.config_path.write_text(json.dumps(config), encoding="utf-8")

        old_data = {"items": [{"title": "Old news", "url": "old"}], "schema_version": 1}
        self.output_path.write_text(json.dumps(old_data), encoding="utf-8")

        with mock.patch.object(
            collect_ai_news, "fetch_json", side_effect=Exception("network error")
        ):
            collect_ai_news.main()

        output = json.loads(self.output_path.read_text(encoding="utf-8"))
        self.assertEqual(output["items"][0]["title"], "Old news")
        self.assertFalse(output["source_status"]["fail"]["ok"])


if __name__ == "__main__":
    unittest.main()
