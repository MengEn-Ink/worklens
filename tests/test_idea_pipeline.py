import importlib.util
import json
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts/idea_pipeline.py"
SPEC = importlib.util.spec_from_file_location("idea_pipeline", MODULE)
idea_pipeline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(idea_pipeline)

DATA = Path(__file__).resolve().parents[1] / "data/idea-pipeline.json"
TS = "2026-10-25T22:42:00+08:00"

HUMAN = "maintainer"


def base_pipeline():
    return {
        "schema_version": 1,
        "policy": {
            "public_only": True,
            "auto_scaffold": False,
            "require_evidence": True,
            "automation_max_stage": "research",
        },
        "stages": ["idea", "research", "plan", "scaffold", "accepted"],
        "ideas": [],
    }


def idea(stage="idea", evidence=None, history=None, **extra):
    history = history or [
        {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS}
    ]
    item = {"id": "weekly-picks", "title": "每周精选", "summary": "把候选沉淀为精选", "stage": stage,
            "evidence": evidence or [], "history": history}
    item.update(extra)
    return item


def evidence(url="https://github.com/MengEn-Ink/worklens"):
    return {"url": url, "title": "WorkLens 公开仓库", "observed_at": TS}


class IdeaPipelineTest(unittest.TestCase):
    def test_empty_pipeline_and_real_data_are_valid(self):
        self.assertEqual(idea_pipeline.validate(base_pipeline()), [])
        real = json.loads(DATA.read_text(encoding="utf-8"))
        self.assertEqual(idea_pipeline.validate(real), [])

    def test_policy_constants_are_enforced(self):
        data = base_pipeline()
        data["policy"]["auto_scaffold"] = True
        self.assertTrue(any("auto_scaffold" in e for e in idea_pipeline.validate(data)))
        data = base_pipeline()
        data["policy"]["public_only"] = False
        self.assertTrue(any("public_only" in e for e in idea_pipeline.validate(data)))

    def test_duplicate_and_bad_ids_rejected(self):
        data = base_pipeline()
        data["ideas"] = [idea(), idea()]
        self.assertIn("duplicate idea id", idea_pipeline.validate(data))
        data["ideas"] = [idea() | {"id": "Bad_Id"}]
        self.assertTrue(any("invalid idea id" in e for e in idea_pipeline.validate(data)))

    def test_research_requires_two_public_evidence_and_notes(self):
        item = idea(stage="research", history=[
            {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS},
            {"from_stage": "idea", "to_stage": "research", "actor": "worklens-bot", "note": "开始调研", "at": TS},
        ])
        errors = idea_pipeline.validate(base_pipeline() | {"ideas": [item]})
        self.assertTrue(any("at least 2 public evidence" in e for e in errors))
        self.assertTrue(any("research_notes" in e for e in errors))
        item["evidence"] = [evidence(), evidence("https://example.com/notes")]
        item["research_notes"] = "已核对公开证据"
        self.assertEqual(idea_pipeline.validate(base_pipeline() | {"ideas": [item]}), [])

    def test_internal_host_and_credential_query_rejected(self):
        item = idea(stage="research", evidence=[
            evidence("https://wiki.bytedance.net/x"),
            evidence("https://example.com/a?token=abcsecret"),
        ], history=[
            {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS},
            {"from_stage": "idea", "to_stage": "research", "actor": "worklens-bot", "note": "调研", "at": TS},
        ], research_notes="x")
        errors = idea_pipeline.validate(base_pipeline() | {"ideas": [item]})
        self.assertTrue(any("internal host" in e for e in errors))
        self.assertTrue(any("credential query" in e for e in errors))

    def test_stage_skip_and_rollback_rejected(self):
        item = idea(stage="plan", history=[
            {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS},
            {"from_stage": "idea", "to_stage": "plan", "actor": HUMAN, "note": "跳跃", "at": TS},
        ], plan={"acceptance_criteria": ["c1"]})
        errors = idea_pipeline.validate(base_pipeline() | {"ideas": [item]})
        self.assertTrue(any("one step" in e for e in errors))

    def test_automation_cannot_reach_plan_but_human_can(self):
        bot = idea(stage="plan", history=[
            {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS},
            {"from_stage": "idea", "to_stage": "research", "actor": "worklens-bot", "note": "调研", "at": TS},
            {"from_stage": "research", "to_stage": "plan", "actor": "worklens-bot", "note": "越权", "at": TS},
        ], evidence=[evidence(), evidence("https://example.com")], research_notes="n",
            plan={"acceptance_criteria": ["c1"]})
        self.assertTrue(any("automation may not advance" in e
                            for e in idea_pipeline.validate(base_pipeline() | {"ideas": [bot]})))
        bot["history"][-1]["actor"] = HUMAN
        self.assertEqual(idea_pipeline.validate(base_pipeline() | {"ideas": [bot]}), [])

    def test_accepted_requires_pass_record_and_archive_requires_reason(self):
        history = [
            {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS},
            {"from_stage": "idea", "to_stage": "research", "actor": HUMAN, "note": "调研", "at": TS},
            {"from_stage": "research", "to_stage": "plan", "actor": HUMAN, "note": "方案", "at": TS},
            {"from_stage": "plan", "to_stage": "scaffold", "actor": HUMAN, "note": "脚手架", "at": TS},
            {"from_stage": "scaffold", "to_stage": "accepted", "actor": HUMAN, "note": "验收", "at": TS},
        ]
        accepted = idea(stage="accepted", history=history, evidence=[evidence(), evidence("https://example.com")],
                        research_notes="n", plan={"acceptance_criteria": ["c1"]},
                        scaffold={"repo_path": "scripts/weekly_picks.py"},
                        acceptance={"result": "fail", "verified_at": TS, "evidence": [evidence()]})
        errors = idea_pipeline.validate(base_pipeline() | {"ideas": [accepted]})
        self.assertTrue(any("result == 'pass'" in e for e in errors))
        accepted["acceptance"] = {"result": "pass", "verified_at": TS,
                                  "evidence": [{"url": "https://example.com/check", "title": "验收证据", "observed_at": TS}]}
        self.assertEqual(idea_pipeline.validate(base_pipeline() | {"ideas": [accepted]}), [])

        archived = idea(stage="archived", history=[
            {"from_stage": None, "to_stage": "idea", "actor": "worklens-bot", "note": "登记", "at": TS},
            {"from_stage": "idea", "to_stage": "archived", "actor": HUMAN, "note": "不做了", "at": TS},
        ])
        self.assertIn("weekly-picks: archived idea requires archive_reason",
                      idea_pipeline.validate(base_pipeline() | {"ideas": [archived]}))


if __name__ == "__main__":
    unittest.main()
