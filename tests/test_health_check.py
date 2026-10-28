import unittest

from scripts import health_check


class HealthCheckContractTest(unittest.TestCase):
    def build_payload(self):
        return {
            "schema_version": 1,
            "policy": {
                "public_only": True,
                "no_private_data": True,
                "stale_threshold_minutes": 240,
                "automation_scope": "health-check-and-data-refresh",
            },
            "checks": [
                {
                    "id": "loop-20261028-1204-cst",
                    "checked_at": "2026-10-28T04:09:00Z",
                    "actor": "worklens-loop",
                    "scope": "四小时健康巡检与数据刷新",
                    "result": "pass",
                    "issue_url": "https://github.com/MengEn-Ink/worklens/issues/71",
                    "actions": [
                        {
                            "name": "刷新数据",
                            "result": "pass",
                            "evidence": "公开数据已刷新。",
                        }
                    ],
                    "data_freshness": [
                        {
                            "path": "data/ai-news.json",
                            "generated_at": "2026-10-28T04:08:19Z",
                            "age_minutes_at_check": 1,
                            "item_count": 200,
                            "status": "fresh",
                        }
                    ],
                    "next_action": "继续健康巡检。",
                }
            ],
        }

    def test_valid_payload_passes(self):
        self.assertEqual([], health_check.validate(self.build_payload()))

    def test_rejects_internal_issue_url(self):
        payload = self.build_payload()
        payload["checks"][0]["issue_url"] = "https://bytedance.net/wiki/demo"
        errors = health_check.validate(payload)
        self.assertTrue(any("internal host rejected" in error for error in errors))

    def test_rejects_fresh_status_when_age_exceeds_threshold(self):
        payload = self.build_payload()
        payload["checks"][0]["data_freshness"][0]["age_minutes_at_check"] = 241
        errors = health_check.validate(payload)
        self.assertTrue(any("status cannot be fresh" in error for error in errors))

    def test_rejects_unsupported_data_path(self):
        payload = self.build_payload()
        payload["checks"][0]["data_freshness"][0]["path"] = "data/private.json"
        errors = health_check.validate(payload)
        self.assertTrue(any("unsupported data path" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
