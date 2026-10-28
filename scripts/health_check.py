#!/usr/bin/env python3
"""校验 WorkLens 四小时 Loop 健康巡检账本。

账本只记录公开仓库可披露的巡检事实：数据新鲜度、公开 Issue、公开
GitHub Actions/Pages 证据和下一项。脚本不访问网络、不读取私有来源，
用于把每轮健康巡检从临时对话沉淀为可版本化的数据契约。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/health-checks.json"

ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{3,63}$")
TIMESTAMP_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$"
)
INTERNAL_HOST_PATTERN = re.compile(
    r"(?:^|\.)(?:byted\.org|bytedance\.net|larkoffice\.com|feishu\.cn|localhost|local)$",
    re.IGNORECASE,
)
CREDENTIAL_QUERY_KEYS = {
    "access_token",
    "api_key",
    "apikey",
    "token",
    "secret",
    "password",
    "signature",
    "sig",
    "authkey",
}
ALLOWED_DATA_PATHS = {
    "data/ai-news.json",
    "data/discoveries.json",
    "data/skill-review-queue.json",
}
CHECK_RESULTS = {"pass", "warn", "fail", "blocked"}
FRESHNESS_STATUS = {"fresh", "stale", "refreshed", "blocked"}


def validate_public_url(url: str, label: str, errors: list[str]) -> None:
    host_match = re.match(r"^https://([^/:?#]+)", url or "")
    if not host_match:
        errors.append(f"{label}: url must be https: {url!r}")
        return
    host = host_match.group(1).lower()
    if INTERNAL_HOST_PATTERN.search(host) or host.startswith(("10.", "192.168.", "172.")):
        errors.append(f"{label}: public url required, internal host rejected: {host}")
    query = url.split("?", 1)[1] if "?" in url else ""
    for key in re.findall(r"(?:^|[?&])([^=]+)=", query):
        if key.lower() in CREDENTIAL_QUERY_KEYS:
            errors.append(f"{label}: credential query parameter rejected: {key}")


def validate_action(action: dict, check_id: str, index: int, errors: list[str]) -> None:
    label = f"{check_id} actions[{index}]"
    if not isinstance(action, dict):
        errors.append(f"{label}: action must be an object")
        return
    if not action.get("name"):
        errors.append(f"{label}: name is required")
    if action.get("result") not in CHECK_RESULTS:
        errors.append(f"{label}: result must be one of {sorted(CHECK_RESULTS)}")
    if not action.get("evidence"):
        errors.append(f"{label}: evidence is required")


def validate_freshness(row: dict, check_id: str, index: int, threshold: int, errors: list[str]) -> None:
    label = f"{check_id} data_freshness[{index}]"
    if not isinstance(row, dict):
        errors.append(f"{label}: freshness row must be an object")
        return
    path = row.get("path")
    if path not in ALLOWED_DATA_PATHS:
        errors.append(f"{label}: unsupported data path {path!r}")
    if not TIMESTAMP_PATTERN.match(row.get("generated_at", "")):
        errors.append(f"{label}: generated_at must be RFC3339")
    age = row.get("age_minutes_at_check")
    if not isinstance(age, int) or age < 0:
        errors.append(f"{label}: age_minutes_at_check must be a non-negative integer")
    elif age > threshold and row.get("status") == "fresh":
        errors.append(f"{label}: status cannot be fresh when age exceeds threshold")
    item_count = row.get("item_count")
    if not isinstance(item_count, int) or item_count < 0:
        errors.append(f"{label}: item_count must be a non-negative integer")
    if row.get("status") not in FRESHNESS_STATUS:
        errors.append(f"{label}: status must be one of {sorted(FRESHNESS_STATUS)}")


def validate_check(check: dict, threshold: int, errors: list[str]) -> None:
    check_id = check.get("id", "<unknown>")
    if not ID_PATTERN.match(check_id or ""):
        errors.append(f"{check_id}: invalid check id (need slug): {check_id!r}")
    if not TIMESTAMP_PATTERN.match(check.get("checked_at", "")):
        errors.append(f"{check_id}: checked_at must be RFC3339")
    if check.get("actor") != "worklens-loop":
        errors.append(f"{check_id}: actor must be worklens-loop")
    if not check.get("scope"):
        errors.append(f"{check_id}: scope is required")
    if check.get("result") not in CHECK_RESULTS:
        errors.append(f"{check_id}: result must be one of {sorted(CHECK_RESULTS)}")
    validate_public_url(check.get("issue_url", ""), f"{check_id}.issue_url", errors)

    actions = check.get("actions")
    if not isinstance(actions, list) or not actions:
        errors.append(f"{check_id}: actions must be a non-empty list")
    else:
        for index, action in enumerate(actions):
            validate_action(action, check_id, index, errors)

    freshness = check.get("data_freshness")
    if not isinstance(freshness, list) or not freshness:
        errors.append(f"{check_id}: data_freshness must be a non-empty list")
    else:
        for index, row in enumerate(freshness):
            validate_freshness(row, check_id, index, threshold, errors)

    if not check.get("next_action"):
        errors.append(f"{check_id}: next_action is required")


def validate(data: dict) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    policy = data.get("policy", {})
    if policy.get("public_only") is not True:
        errors.append("policy.public_only must be true")
    if policy.get("no_private_data") is not True:
        errors.append("policy.no_private_data must be true")
    threshold = policy.get("stale_threshold_minutes")
    if not isinstance(threshold, int) or threshold < 60:
        errors.append("policy.stale_threshold_minutes must be an integer >= 60")
        threshold = 240
    if policy.get("automation_scope") != "health-check-and-data-refresh":
        errors.append("policy.automation_scope must be health-check-and-data-refresh")

    checks = data.get("checks")
    if not isinstance(checks, list) or not checks:
        errors.append("checks must be a non-empty list")
        return errors
    ids = [check.get("id", "") for check in checks if isinstance(check, dict)]
    if len(ids) != len(set(ids)):
        errors.append("duplicate check id")
    for check in checks:
        if not isinstance(check, dict):
            errors.append("each check must be an object")
            continue
        validate_check(check, threshold, errors)
    return errors


def summarize(data: dict) -> dict:
    latest = data.get("checks", [])[-1]
    fresh = latest.get("data_freshness", [])
    return {
        "latest_check": latest.get("id"),
        "checked_at": latest.get("checked_at"),
        "result": latest.get("result"),
        "freshness": [
            {
                "path": row.get("path"),
                "status": row.get("status"),
                "age_minutes_at_check": row.get("age_minutes_at_check"),
                "item_count": row.get("item_count"),
            }
            for row in fresh
        ],
        "next_action": latest.get("next_action"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "summarize"], help="校验或摘要健康巡检账本")
    args = parser.parse_args()

    data = json.loads(DATA.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    if args.command == "summarize":
        print(json.dumps(summarize(data), ensure_ascii=False, indent=2))
    else:
        print(f"health-checks valid: {len(data.get('checks', []))} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
