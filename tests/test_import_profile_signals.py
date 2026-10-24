import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "import_profile_signals.py"
SPEC = importlib.util.spec_from_file_location("import_profile_signals", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class ProfileSignalImportTest(unittest.TestCase):
    def test_aggregate_keeps_only_statistics_and_hashes(self):
        raw = {
            "source_type": "meeting",
            "occurred_at": "2026-10-24T08:00:00+08:00",
            "topics": ["Agent", "Testing", "agent"],
            "evidence": "private-meeting-id",
            "duration_minutes": 30,
        }
        record = module.parse_record(raw, 1, "local-salt")
        output = module.aggregate([record])
        encoded = str(output)
        self.assertNotIn("private-meeting-id", encoded)
        self.assertFalse(output["privacy"]["titles_stored"])
        self.assertEqual(output["summary"]["record_count"], 1)
        self.assertEqual(output["summary"]["sources"]["meeting"]["duration_minutes"], 30.0)
        self.assertEqual(output["summary"]["topics"][0], {"topic": "agent", "count": 1})

    def test_rejects_raw_content_and_title_fields(self):
        for field in ("title", "content", "url", "transcript"):
            raw = {
                "source_type": "article",
                "occurred_at": "2026-10-24T00:00:00Z",
                "topics": ["agent"],
                "evidence": "local-id",
                field: "sensitive",
            }
            with self.assertRaisesRegex(ValueError, "禁止字段"):
                module.parse_record(raw, 1, "salt")

    def test_hash_depends_on_local_salt(self):
        self.assertNotEqual(
            module.evidence_hash("same-id", "salt-a"),
            module.evidence_hash("same-id", "salt-b"),
        )

    def test_opml_records_strip_sensitive_url_parts(self):
        opml = """<?xml version='1.0' encoding='UTF-8'?>
        <opml version='2.0'>
          <head>
            <dateModified>Fri, 24 Oct 2026 08:00:00 +0800</dateModified>
          </head>
          <body>
            <outline text='AI'>
              <outline text='Latent Space' type='rss' xmlUrl='https://example.com/feed.xml?token=secret#frag' />
            </outline>
          </body>
        </opml>
        """
        temp_path = Path(self.id().replace(".", "_") + ".opml")
        try:
            temp_path.write_text(opml, encoding="utf-8")
            records = module.parse_opml_records(temp_path, "salt", "rss")
        finally:
            temp_path.unlink(missing_ok=True)
        self.assertEqual(records[0]["source_type"], "rss")
        self.assertIn("rss", records[0]["topics"])
        self.assertIn("subscription", records[0]["topics"])
        self.assertEqual(
            records[0]["evidence_hash"],
            module.evidence_hash("https://example.com/feed.xml", "salt"),
        )

    def test_opml_auto_detects_podcast_and_topics(self):
        opml = """<?xml version='1.0' encoding='UTF-8'?>
        <opml version='2.0'>
          <body>
            <outline text='Podcasts'>
              <outline text='AI Podcast Weekly' category='/AI/Automation' xmlUrl='https://feeds.megaphone.fm/demo' />
            </outline>
          </body>
        </opml>
        """
        temp_path = Path(self.id().replace(".", "_") + ".opml")
        try:
            temp_path.write_text(opml, encoding="utf-8")
            records = module.parse_opml_records(temp_path, "salt", "auto")
        finally:
            temp_path.unlink(missing_ok=True)
        self.assertEqual(records[0]["source_type"], "podcast")
        self.assertIn("agent", records[0]["topics"])
        self.assertIn("automation", records[0]["topics"])
        self.assertIn("podcast", records[0]["topics"])

    def test_rejects_opml_without_subscription_nodes(self):
        opml = """<?xml version='1.0' encoding='UTF-8'?>
        <opml version='2.0'><body><outline text='Empty folder' /></body></opml>
        """
        temp_path = Path(self.id().replace(".", "_") + ".opml")
        try:
            temp_path.write_text(opml, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "未找到任何订阅节点"):
                module.parse_opml_records(temp_path, "salt", "auto")
        finally:
            temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
