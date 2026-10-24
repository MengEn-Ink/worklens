import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "collect_github.py"
SPEC = importlib.util.spec_from_file_location("collect_github", MODULE_PATH)
collect_github = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collect_github)


class CollectorTest(unittest.TestCase):
    def test_merge_preserves_multiple_sources_and_relationships(self):
        repo = {
            "full_name": "owner/repo",
            "html_url": "https://github.com/owner/repo",
            "description": "demo",
            "topics": [],
            "stargazers_count": 1,
            "forks_count": 0,
            "open_issues_count": 0,
        }
        candidates = {}
        owned = collect_github.normalize(repo, "profile:user:owned", "user:owned")
        starred = collect_github.normalize(repo, "profile:user:starred", "user:starred")
        collect_github.merge_candidate(candidates, owned, "profile:user:owned")
        collect_github.merge_candidate(candidates, starred, "profile:user:starred")

        item = candidates["owner/repo"]
        self.assertEqual(item["relationships"], ["user:owned", "user:starred"])
        self.assertEqual(item["also_seen_in"], ["profile:user:starred"])

    def test_normalize_does_not_copy_private_flag_or_credentials(self):
        repo = {
            "full_name": "owner/public",
            "html_url": "https://github.com/owner/public",
            "private": False,
            "description": "demo",
            "topics": ["agent"],
        }
        item = collect_github.normalize(repo, "profile:user:owned", "user:owned")
        self.assertNotIn("private", item)
        self.assertEqual(item["relationships"], ["user:owned"])


if __name__ == "__main__":
    unittest.main()
