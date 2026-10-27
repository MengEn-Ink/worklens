import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts/discover_core_circle.py"
SPEC = importlib.util.spec_from_file_location("discover_core_circle", MODULE)
discover_core_circle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(discover_core_circle)


def _config(**overrides):
    base = {
        "seeds": [{"login": "alchaincyf", "tier": "seed"}],
        "privacy": {
            "public_github_only": True,
            "store_email": False,
            "auto_follow": False,
            "auto_message": False,
        },
        "discovery": {
            "max_contributors_per_repository": 20,
            "max_discovered_users": 50,
        },
    }
    base.update(overrides)
    return base


def _circle():
    return {
        "people": [
            {"login": "alchaincyf", "tier": "seed"},
            {"login": "Jiandong7", "tier": "candidate"},
        ],
        "projects": [
            {
                "full_name": "alchaincyf/nuwa-skill",
                "evidence": {
                    "contributors": [
                        {"login": "alchaincyf", "contributions": 59},
                        {"login": "github-actions[bot]", "contributions": 1},
                        {"login": "oppenheimor", "contributions": 1},
                        {"login": "tens1x", "contributions": 1},
                    ]
                },
            },
            {
                "full_name": "alchaincyf/huashu-design",
                "evidence": {
                    "contributors": [
                        {"login": "alchaincyf", "contributions": 98},
                        {"login": "Jiandong7", "contributions": 2},
                    ]
                },
            },
            {
                "full_name": "alchaincyf/darwin-skill",
                "evidence": {
                    "contributors": [
                        {"login": "alchaincyf", "contributions": 40},
                        {"login": "oppenheimor", "contributions": 2},
                        {"login": "jiezeng2004-design", "contributions": 1},
                    ]
                },
            },
        ],
    }


class SelectCandidatesTest(unittest.TestCase):
    def test_skips_seed_bot_and_existing_people(self):
        rows = discover_core_circle.select_candidates(_circle(), _config())
        logins = [row["login"] for row in rows]
        self.assertIn("oppenheimor", logins)
        self.assertIn("tens1x", logins)
        self.assertIn("jiezeng2004-design", logins)
        self.assertNotIn("alchaincyf", logins)
        self.assertNotIn("Jiandong7", logins)
        self.assertFalse(any(l.endswith("[bot]") for l in logins))

    def test_contributions_are_summed_and_sources_merged(self):
        rows = discover_core_circle.select_candidates(_circle(), _config())
        by_login = {row["login"]: row for row in rows}
        self.assertEqual(by_login["oppenheimor"]["contributions_total"], 3)
        self.assertEqual(
            sorted(by_login["oppenheimor"]["source_projects"]),
            ["alchaincyf/darwin-skill", "alchaincyf/nuwa-skill"],
        )

    def test_order_is_contributions_desc_then_login(self):
        rows = discover_core_circle.select_candidates(_circle(), _config())
        contribs = [row["contributions_total"] for row in rows]
        self.assertEqual(contribs, sorted(contribs, reverse=True))

    def test_discovery_cap_is_respected(self):
        rows = discover_core_circle.select_candidates(_circle(), _config(discovery={
            "max_contributors_per_repository": 20,
            "max_discovered_users": 1,
        }))
        self.assertEqual(len(rows), 1)


class EnrichCandidateTest(unittest.TestCase):
    def test_offline_record_has_null_evidence(self):
        enriched = discover_core_circle.enrich_candidate(
            {"login": "foo", "source_projects": ["a/b"], "contributions_total": 1},
            None,
            "2026-10-27T00:00:00Z",
        )
        self.assertEqual(enriched["public_evidence"], None)
        self.assertFalse(enriched["profile_fetched"])
        self.assertTrue(enriched["promotion_hint"]["human_decision_required"])
        self.assertEqual(enriched["promotion_hint"]["proposed_tier"], "watch")
        self.assertEqual(enriched["evidence_url"], "https://api.github.com/users/foo")

    def test_online_record_keeps_only_allowed_signals(self):
        profile = {
            "login": "foo",
            "public_repos": 10,
            "followers": 2,
            "following": 3,
            "created_at": "2020-01-01T00:00:00Z",
            "html_url": "https://github.com/foo",
            "type": "User",
            "email": "secret@example.com",  # must be dropped
            "bio": "I write code",         # must be dropped
        }
        enriched = discover_core_circle.enrich_candidate(
            {"login": "foo", "source_projects": ["a/b"], "contributions_total": 1},
            profile,
            "2026-10-27T00:00:00Z",
        )
        self.assertTrue(enriched["profile_fetched"])
        self.assertEqual(
            set(enriched["public_evidence"].keys()),
            {"public_repos", "followers", "following", "created_at", "html_url", "type"},
        )


class BuildOutputTest(unittest.TestCase):
    def test_policy_is_echoed_and_promotion_is_blocked(self):
        output = discover_core_circle.build_output([], _config(), "2026-10-27T00:00:00Z", [])
        self.assertTrue(output["policy"]["public_github_only"])
        self.assertFalse(output["policy"]["auto_follow"])
        self.assertFalse(output["policy"]["auto_message"])
        self.assertTrue(output["policy"]["human_promote_required"])
        self.assertEqual(output["schema_version"], 1)


class DiscoverIntegrationTest(unittest.TestCase):
    def test_offline_does_not_call_fetcher(self):
        calls = []

        def fetcher(login):
            calls.append(login)
            return (200, {"login": login}, None)

        result = discover_core_circle.discover(
            _config(),
            _circle(),
            enable_network=False,
            fetcher=fetcher,
            sleep=lambda _s: None,
            now=lambda: "2026-10-27T00:00:00Z",
        )
        self.assertEqual(calls, [])
        self.assertEqual(result["summary"]["fetched_count"], 0)
        self.assertTrue(all(c["public_evidence"] is None for c in result["candidates"]))

    def test_online_records_fetch_status(self):
        def fetcher(login):
            if login == "oppenheimor":
                return (200, {"login": login, "public_repos": 42, "followers": 5, "following": 1, "created_at": "2020-01-01T00:00:00Z", "html_url": f"https://github.com/{login}", "type": "User"}, None)
            return (-1, None, "fake_failure")

        result = discover_core_circle.discover(
            _config(),
            _circle(),
            enable_network=True,
            fetcher=fetcher,
            sleep=lambda _s: None,
            now=lambda: "2026-10-27T00:00:00Z",
        )
        statuses = {row["login"]: row for row in result["source_status"]}
        self.assertTrue(statuses["oppenheimor"]["fetched"])
        self.assertFalse(statuses["tens1x"]["fetched"])
        for candidate in result["candidates"]:
            if candidate["login"] == "oppenheimor":
                self.assertEqual(candidate["public_evidence"]["public_repos"], 42)
            else:
                self.assertIsNone(candidate["public_evidence"])


if __name__ == "__main__":
    unittest.main()
