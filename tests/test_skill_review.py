import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "skill_review.py"
SPEC = importlib.util.spec_from_file_location("skill_review", MODULE_PATH)
skill_review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(skill_review)

DISCOVERIES = {
    "candidates": [
        {
            "full_name": "acme/skill-one",
            "html_url": "https://github.com/acme/skill-one",
            "description": "A claude skill",
            "topics": ["agent-skills"],
            "language": "Python",
            "license": "MIT",
            "stars": 100,
            "archived": False,
            "pushed_at": "2026-10-20T00:00:00Z",
            "source": "search:topic:agent-skills",
        },
        {
            "full_name": "acme/ui-kit",
            "html_url": "https://github.com/acme/ui-kit",
            "description": "React component library",
            "topics": ["ui", "design-system"],
            "license": "MIT",
            "source": "search:topic:design-system",
        },
        {
            "full_name": "acme/no-license-skill",
            "html_url": "https://github.com/acme/no-license-skill",
            "description": "agent skill without license",
            "topics": ["codex-skill"],
            "license": None,
            "source": "search:topic:agent-skills",
        },
    ]
}


class SkillQueueSyncTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.discoveries = Path(self.temp.name) / "discoveries.json"
        self.queue_path = Path(self.temp.name) / "skill-review-queue.json"
        self.discoveries.write_text(json.dumps(DISCOVERIES), encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def sync(self):
        self.assertEqual(skill_review.sync(self.discoveries, self.queue_path), 0)
        return json.loads(self.queue_path.read_text(encoding="utf-8"))

    def test_sync_enqueues_skill_candidates_and_skips_ui(self):
        queue = self.sync()
        subjects = [entry["subject"] for entry in queue["queue"]]
        self.assertEqual(subjects, ["acme/skill-one", "acme/no-license-skill"])
        self.assertNotIn("acme/ui-kit", subjects)
        entry = queue["queue"][0]
        self.assertEqual(entry["state"], "candidate")
        self.assertEqual(entry["checks"]["license_declared"]["status"], "pass")
        self.assertIsNone(entry["trial"])
        self.assertEqual(entry["history"][0]["by"], "worklens-bot")
        missing = queue["queue"][1]
        self.assertEqual(missing["checks"]["license_declared"]["status"], "fail")
        self.assertIn("no_license", missing["risk_flags"])

    def test_sync_is_idempotent_and_refreshes_metadata(self):
        first = self.sync()
        generated = first["generated_at"]
        first_id = first["queue"][0]["id"]
        second = self.sync()
        self.assertEqual([e["id"] for e in second["queue"]], [first_id, "SR-0002"])
        self.assertEqual(len(second["queue"]), 2)
        self.assertEqual(second["queue"][0]["history"][0]["event"], "enqueued")

        payload = json.loads(self.discoveries.read_text(encoding="utf-8"))
        payload["candidates"][0]["stars"] = 999
        self.discoveries.write_text(json.dumps(payload), encoding="utf-8")
        refreshed = self.sync()
        self.assertEqual(refreshed["queue"][0]["stars"], 999)
        self.assertEqual(len(refreshed["queue"][0]["history"]), 1)


class SkillQueueStateMachineTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.queue_path = Path(self.temp.name) / "queue.json"
        queue = skill_review.empty_queue()
        queue["queue"].append(self.entry("SR-0001", "acme/skill-one", "candidate"))
        self.write(queue)

    def tearDown(self):
        self.temp.cleanup()

    def entry(self, entry_id, subject, state, checks=None, trial=None):
        entry = {
            "id": entry_id,
            "subject": subject,
            "html_url": f"https://github.com/{subject}",
            "source": "search:x",
            "also_seen_in": [],
            "enqueued_at": "2026-10-01T00:00:00+00:00",
            "metadata_synced_at": "2026-10-01T00:00:00+00:00",
            "state": state,
            "license": "MIT",
            "archived": False,
            "stars": 10,
            "pushed_at": "2026-10-01T00:00:00Z",
            "checks": checks or {},
            "risk_flags": [],
            "trial": trial,
            "history": [
                {
                    "at": "2026-10-01T00:00:00+00:00",
                    "event": "enqueued",
                    "by": "worklens-bot",
                    "note": "auto",
                }
            ],
        }
        return entry

    def write(self, queue):
        self.queue_path.write_text(json.dumps(queue, ensure_ascii=False), encoding="utf-8")

    def read(self):
        return json.loads(self.queue_path.read_text(encoding="utf-8"))

    def errors(self):
        return skill_review.validation_errors(self.read())

    def args(self, **overrides):
        base = {
            "subject": "acme/skill-one",
            "to": "screening",
            "by": "molala",
            "note": "开始人工评测",
            "trial_scope": "",
            "trial_days": 7,
            "trial_result": None,
            "trial_note": "",
        }
        base.update(overrides)
        return type("Args", (), base)()

    def test_valid_fresh_queue(self):
        self.assertEqual(self.errors(), [])

    def test_auto_install_must_stay_false(self):
        queue = self.read()
        queue["policy"]["auto_install"] = True
        self.write(queue)
        self.assertTrue(any("auto_install" in error for error in self.errors()))

    def test_bot_cannot_transition_and_reject_requires_note(self):
        with self.assertRaisesRegex(SystemExit, "真人"):
            skill_review.transition(self.queue_path, self.args(by="ci-bot"))
        with self.assertRaisesRegex(SystemExit, "note"):
            skill_review.transition(self.queue_path, self.args(note="   "))

    def test_illegal_transition_rejected(self):
        with self.assertRaisesRegex(SystemExit, "非法流转"):
            skill_review.transition(self.queue_path, self.args(to="adopted"))

    def test_full_human_path_to_adoption(self):
        skill_review.transition(self.queue_path, self.args(to="screening"))
        for key in skill_review.BLOCKING_CHECKS:
            if key == "license_declared":
                continue
            skill_review.check_update(
                self.queue_path,
                type(
                    "Args",
                    (),
                    {
                        "subject": "acme/skill-one",
                        "check": key,
                        "status": "pass",
                        "by": "molala",
                        "evidence": f"人工核对 {key}",
                    },
                )(),
            )
        queue = self.read()
        queue["queue"][0]["checks"]["license_declared"] = {
            "status": "pass",
            "evidence": "MIT",
            "checked_at": "2026-10-01T00:00:00+00:00",
            "by": "worklens-bot",
        }
        self.write(queue)

        with self.assertRaisesRegex(SystemExit, "trial-scope"):
            skill_review.transition(
                self.queue_path, self.args(to="trial", note="阻断项通过，开始试用", trial_scope="")
            )
        skill_review.transition(
            self.queue_path,
            self.args(to="trial", note="阻断项通过，开始试用", trial_scope="只读方式辅助整理周报"),
        )
        self.assertEqual(self.read()["queue"][0]["state"], "trial")

        with self.assertRaisesRegex(SystemExit, "trial-result"):
            skill_review.transition(
                self.queue_path, self.args(to="adopted", note="试用通过", trial_result=None)
            )
        skill_review.transition(
            self.queue_path,
            self.args(
                to="adopted",
                note="试用一周效果稳定，正式引入",
                trial_result="pass",
                trial_note="无越权访问，输出稳定",
            ),
        )
        entry = self.read()["queue"][0]
        self.assertEqual(entry["state"], "adopted")
        self.assertEqual(entry["trial"]["result"], "pass")
        self.assertEqual(self.errors(), [])

    def test_trial_blocked_when_checks_fail(self):
        skill_review.transition(self.queue_path, self.args(to="screening"))
        with self.assertRaisesRegex(SystemExit, "阻断评测项"):
            skill_review.transition(
                self.queue_path,
                self.args(to="trial", note="尝试试用", trial_scope="scope"),
            )

    def test_quarantine_requires_reason_and_replay_consistency(self):
        skill_review.transition(self.queue_path, self.args(to="screening"))
        skill_review.transition(
            self.queue_path,
            self.args(to="quarantined", note="发现可疑外发域名"),
        )
        self.assertEqual(self.errors(), [])
        queue = self.read()
        queue["queue"][0]["state"] = "trial"
        self.write(queue)
        self.assertTrue(any("历史回放" in error for error in self.errors()))


if __name__ == "__main__":
    unittest.main()
