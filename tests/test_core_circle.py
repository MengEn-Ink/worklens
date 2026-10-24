import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts/core_circle.py"
SPEC = importlib.util.spec_from_file_location("core_circle", MODULE)
core_circle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(core_circle)


class CoreCircleTest(unittest.TestCase):
    def config(self):
        return {"privacy": {"public_github_only": True, "store_email": False, "auto_follow": False, "auto_message": False}, "discovery": {key: 10 for key in ("max_seed_users", "max_repositories_per_seed", "max_contributors_per_repository", "max_follow_relations_per_seed", "max_discovered_users")}}

    def test_follow_is_rejected_as_strong_signal(self):
        data = {"people": [], "projects": [], "relationships": [{"from": "a", "to": "b", "type": "follower", "strength": "strong", "evidence_url": "https://api.github.com/users/a/followers", "observed_at": "2026-10-24T00:00:00Z"}]}
        self.assertIn("follow relations may only be weak signals", core_circle.validate(self.config(), data))

    def test_recommendation_requires_license(self):
        data = {"people": [], "relationships": [], "projects": [{"full_name": "a/game", "recommendation": True, "evidence": {"license_spdx": None}}]}
        self.assertTrue(any("lacks declared license" in error for error in core_circle.validate(self.config(), data)))

    def test_email_and_unbounded_limit_are_rejected(self):
        config = self.config()
        config["discovery"]["max_discovered_users"] = 9999
        data = {"people": [{"login": "a", "tier": "seed", "email": "forbidden"}], "relationships": [], "projects": []}
        errors = core_circle.validate(config, data)
        self.assertTrue(any("bounded limit" in error for error in errors))
        self.assertTrue(any("email is forbidden" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
