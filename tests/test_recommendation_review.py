import importlib.util
import json
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts/recommendation_review.py"
SPEC = importlib.util.spec_from_file_location("recommendation_review", MODULE)
recommendation_review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recommendation_review)

DATA = Path(__file__).resolve().parents[1] / "data/recommendation-reviews.json"

TS_REC = "2026-10-25T06:07:53Z"
TS_FROM = "2026-10-25T06:07:53Z"
TS_TO = "2026-10-26T06:20:00Z"
TS_REVIEWED = "2026-10-26T06:26:00Z"

DISCOVERIES = {
    "candidates": [
        {
            "full_name": "fighting41love/funNLP",
            "html_url": "https://github.com/fighting41love/funNLP",
        },
        {"full_name": "owner/other", "html_url": "https://github.com/owner/other"},
    ]
}


def policy():
    return {
        "public_only": True,
        "auto_adjust_profile": False,
        "require_human_policy_ref": True,
        "automation_max_conclusion": "downgrade",
        "conclusions": ["keep", "downgrade", "remove"],
    }


def base_data():
    return {"schema_version": 1, "policy": policy(), "reviews": []}


def review(**overrides):
    item = {
        "id": "rr-20261026-01",
        "recommendation": {
            "id": "rec-20261025-01",
            "recommended_at": TS_REC,
            "channel": "daily_discovery",
            "signal_source": "profile:MengEn-Ink:starred",
            "reason": "公开 Star 弱信号进入每日发现批次",
        },
        "subject": {
            "full_name": "fighting41love/funNLP",
            "html_url": "https://github.com/fighting41love/funNLP",
        },
        "observation_window": {"from": TS_FROM, "to": TS_TO},
        "observed_facts": [
            {
                "fact": "仍未声明许可证，默认分支两年无推送",
                "source_url": "https://api.github.com/repos/fighting41love/funNLP",
                "observed_at": TS_TO,
            }
        ],
        "conclusion": "downgrade",
        "adjustment": "弱信号不得单独推荐，叠加许可证与活跃度门槛（人工策略说明）",
        "reviewed_by": "worklens-loop",
        "authority": "human-policy",
        "policy_ref": "README 数据与隐私原则第 4 条",
        "reviewed_at": TS_REVIEWED,
    }
    item.update(overrides)
    return item


class RecommendationReviewTest(unittest.TestCase):
    def test_empty_and_real_data_are_valid(self):
        self.assertEqual(recommendation_review.validate(base_data(), DISCOVERIES), [])
        real = json.loads(DATA.read_text(encoding="utf-8"))
        self.assertEqual(recommendation_review.validate(real), [])

    def test_policy_constants_are_enforced(self):
        data = base_data()
        data["policy"]["public_only"] = False
        self.assertTrue(any("public_only" in e for e in recommendation_review.validate(data, DISCOVERIES)))
        data = base_data()
        data["policy"]["auto_adjust_profile"] = True
        self.assertTrue(
            any("auto_adjust_profile" in e for e in recommendation_review.validate(data, DISCOVERIES))
        )

    def test_subject_must_hit_discoveries_candidates(self):
        item = review()
        item["subject"] = {
            "full_name": "ghost/not-in-discoveries",
            "html_url": "https://github.com/ghost/not-in-discoveries",
        }
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("not found in data/discoveries.json" in e for e in errors))

        item = review()
        item["subject"]["html_url"] = "https://github.com/owner/other"
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("does not match discoveries record" in e for e in errors))

    def test_duplicate_and_bad_ids_rejected(self):
        data = base_data() | {"reviews": [review(), review()]}
        self.assertIn("duplicate review id", recommendation_review.validate(data, DISCOVERIES))
        data = base_data() | {"reviews": [review(id="BAD")]}
        self.assertTrue(
            any("invalid review id" in e for e in recommendation_review.validate(data, DISCOVERIES))
        )

    def test_conclusion_enum_and_required_fields(self):
        item = review(conclusion="promote")
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("conclusion must be one of" in e for e in errors))
        item = review(adjustment="")
        self.assertTrue(
            any("adjustment" in e for e in recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES))
        )

    def test_internal_host_and_credential_query_rejected(self):
        item = review()
        item["observed_facts"][0]["source_url"] = "https://wiki.bytedance.net/x"
        self.assertTrue(
            any("internal host" in e for e in recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES))
        )
        item = review()
        item["subject"]["html_url"] = "https://github.com/fighting41love/funNLP?token=abcsecret"
        self.assertTrue(
            any("credential query" in e for e in recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES))
        )

    def test_observation_window_ordering_and_fact_bounds(self):
        item = review()
        item["observation_window"] = {"from": TS_TO, "to": TS_FROM}
        self.assertTrue(
            any("from must be <= to" in e for e in recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES))
        )
        item = review()
        item["observed_facts"][0]["observed_at"] = "2026-10-27T00:00:00Z"
        self.assertTrue(
            any("outside observation_window" in e for e in recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES))
        )

    def test_automation_cannot_remove_or_claim_human_authority(self):
        item = review(conclusion="remove")
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("may not conclude 'remove'" in e for e in errors))

        item = review(authority="human")
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("cannot claim authority=human" in e for e in errors))

        item = review()
        item["policy_ref"] = ""
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("requires policy_ref" in e for e in errors))

    def test_human_can_remove_without_policy_ref(self):
        item = review(
            reviewed_by="MengEn-Ink",
            authority="human",
            conclusion="remove",
        )
        item.pop("policy_ref")
        self.assertEqual(recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES), [])

    def test_reviewed_before_recommended_rejected(self):
        item = review(reviewed_at="2026-10-24T00:00:00Z")
        errors = recommendation_review.validate(base_data() | {"reviews": [item]}, DISCOVERIES)
        self.assertTrue(any("reviewed_at must be >= recommendation" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
