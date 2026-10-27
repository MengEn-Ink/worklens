"""skill_adoptions 契约校验测试。

覆盖：
- 空账本 + queue 中无 adopted → 通过（这是本轮 WorkLens 的真实状态）
- 字段缺失、格式错、bot 决定 → 失败
- adoption 引用的 SR id 不在 queue → 失败
- queue 中有 adopted 条目但账本未登记 → 失败
- 政策位 auto_install / auto_execute 被篡改为 true → 失败
- 真实数据：data/skill-adoptions.json + data/skill-review-queue.json 必须通过
"""
from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "skill_adoptions.py"
SPEC = importlib.util.spec_from_file_location("skill_adoptions", MODULE_PATH)
skill_adoptions = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(skill_adoptions)

REAL_ADOPTIONS = ROOT / "data" / "skill-adoptions.json"
REAL_QUEUE = ROOT / "data" / "skill-review-queue.json"


BASE_POLICY = {
    "auto_install": False,
    "auto_execute": False,
    "human_decision_required": True,
    "public_github_only": True,
    "max_automation_stage": "candidate",
    "notes": "test",
}


def make_doc(adoptions=None):
    return {
        "schema_version": 1,
        "generated_at": "2026-10-27T16:00:00+00:00",
        "source": "test",
        "policy": copy.deepcopy(BASE_POLICY),
        "fields": {"adoption_id": "demo"},
        "adoptions": list(adoptions or []),
    }


def make_queue(adopted_entries=None):
    return {
        "schema_version": 1,
        "generated_at": "2026-10-27T16:00:00+00:00",
        "policy": {
            "auto_install": False,
            "human_gate": "x",
            "blocking_checks": [],
            "states": ["candidate", "adopted"],
        },
        "queue": list(adopted_entries or []),
    }


def make_adoption(**overrides):
    base = {
        "adoption_id": "ADOPT-0001",
        "skill_review_id": "SR-0999",
        "subject": "demo/skill",
        "html_url": "https://github.com/demo/skill",
        "decided_by": "MengEn-Ink",
        "decided_at": "2026-10-27T16:30:00+00:00",
        "decision_reason": "试用通过并记录结论",
        "trial_report_url": "data/skill-review-queue.json#SR-0999",
        "import_scope": "仅文档引用，不随 Pages 分发脚本",
        "rollback_plan": "删除本条记录即可，无运行时副作用",
        "revert_command": "git revert <adoption-commit>",
        "human_accepted": True,
        "history": [
            {
                "at": "2026-10-27T16:30:00+00:00",
                "event": "adopted",
                "by": "MengEn-Ink",
                "note": "试用通过，正式登记引入",
            }
        ],
    }
    base.update(overrides)
    return base


def make_queue_entry(review_id="SR-0999", subject="demo/skill", state="adopted"):
    return {"id": review_id, "subject": subject, "state": state}


class SkillAdoptionsValidationTests(unittest.TestCase):
    def test_empty_doc_with_empty_queue_passes(self):
        errors = skill_adoptions.validation_errors(make_doc(), make_queue())
        self.assertEqual(errors, [])

    def test_valid_adoption_with_matching_queue_passes(self):
        doc = make_doc([make_adoption()])
        queue = make_queue([make_queue_entry()])
        errors = skill_adoptions.validation_errors(doc, queue)
        self.assertEqual(errors, [], msg=errors)

    def test_missing_required_field_fails(self):
        adoption = make_adoption()
        del adoption["rollback_plan"]
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry()])
        )
        self.assertTrue(any("rollback_plan" in e for e in errors), errors)

    def test_human_accepted_must_be_true(self):
        adoption = make_adoption(human_accepted=False)
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry()])
        )
        self.assertTrue(any("human_accepted" in e for e in errors), errors)

    def test_bot_decided_by_fails(self):
        adoption = make_adoption(decided_by="worklens-bot")
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry()])
        )
        self.assertTrue(any("decided_by" in e for e in errors), errors)

    def test_adoption_without_queue_adopted_entry_fails(self):
        adoption = make_adoption(skill_review_id="SR-0888")
        # queue 中 SR-0888 不存在为 adopted
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry(review_id="SR-0999")])
        )
        self.assertTrue(
            any("SR-0888" in e and "没有 state=adopted" in e for e in errors), errors
        )

    def test_queue_adopted_without_adoption_fails(self):
        # queue 有 adopted，但账本为空
        errors = skill_adoptions.validation_errors(
            make_doc([]), make_queue([make_queue_entry(review_id="SR-0999")])
        )
        self.assertTrue(any("SR-0999" in e and "未登记" in e for e in errors), errors)

    def test_subject_mismatch_between_adoption_and_queue_fails(self):
        adoption = make_adoption(subject="demo/other")
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry(subject="demo/skill")])
        )
        self.assertTrue(any("subject 与队列不一致" in e for e in errors), errors)

    def test_policy_auto_install_true_fails(self):
        doc = make_doc()
        doc["policy"]["auto_install"] = True
        errors = skill_adoptions.validation_errors(doc, make_queue())
        self.assertTrue(any("auto_install" in e for e in errors), errors)

    def test_policy_auto_execute_true_fails(self):
        doc = make_doc()
        doc["policy"]["auto_execute"] = True
        errors = skill_adoptions.validation_errors(doc, make_queue())
        self.assertTrue(any("auto_execute" in e for e in errors), errors)

    def test_history_first_event_must_be_adopted(self):
        adoption = make_adoption()
        adoption["history"][0]["event"] = "scope_tightened"
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry()])
        )
        self.assertTrue(any("event=adopted" in e for e in errors), errors)

    def test_history_bot_author_fails(self):
        adoption = make_adoption()
        adoption["history"][0]["by"] = "github-actions"
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry()])
        )
        self.assertTrue(any("不是真人" in e for e in errors), errors)

    def test_adoption_id_format_fails(self):
        adoption = make_adoption(adoption_id="ADOPT-1")
        errors = skill_adoptions.validation_errors(
            make_doc([adoption]), make_queue([make_queue_entry()])
        )
        self.assertTrue(any("adoption_id" in e for e in errors), errors)

    def test_duplicate_adoption_id_fails(self):
        a1 = make_adoption()
        a2 = make_adoption(skill_review_id="SR-1000", subject="demo/other")
        errors = skill_adoptions.validation_errors(
            make_doc([a1, a2]),
            make_queue([make_queue_entry(), make_queue_entry(review_id="SR-1000", subject="demo/other")]),
        )
        self.assertTrue(any("adoption_id=ADOPT-0001 重复" in e for e in errors), errors)

    def test_real_data_validates(self):
        """真实仓库数据必须通过校验：队列中无 adopted，账本为空数组。"""
        doc = json.loads(REAL_ADOPTIONS.read_text(encoding="utf-8"))
        queue = json.loads(REAL_QUEUE.read_text(encoding="utf-8"))
        errors = skill_adoptions.validation_errors(doc, queue)
        self.assertEqual(errors, [], msg=errors)
        # 并且断言：当前真实队列确实没有 adopted，账本确实为空
        adopted = [e for e in queue.get("queue", []) if e.get("state") == "adopted"]
        self.assertEqual(adopted, [])
        self.assertEqual(doc.get("adoptions"), [])


if __name__ == "__main__":
    unittest.main()
