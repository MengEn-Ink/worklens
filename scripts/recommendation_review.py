#!/usr/bin/env python3
"""校验推荐复盘（recommendation reviews）数据契约。

只读工具：不访问网络、不写数据、不自动调整画像或推荐算法。每条复盘记录
把一次公开推荐（对象必须命中 data/discoveries.json 的公开候选）与一个观察
窗口内的公开事实对应起来，并给出 keep / downgrade / remove 结论；自动化
（worklens-loop 等）只能依据既有真人策略给出最高 downgrade 的结论，
remove 与画像规则固化必须由真人记录。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/recommendation-reviews.json"
DISCOVERIES = ROOT / "data/discoveries.json"

CONCLUSIONS = ["keep", "downgrade", "remove"]
AUTOMATION_ACTORS = {"worklens-bot", "worklens-loop"}
AUTOMATION_MAX_CONCLUSION = "downgrade"
AUTHORITIES = ["human", "human-policy"]
PROFILE_ACTION_CONCLUSIONS = {"downgrade", "remove"}


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


def parse_ts(value: str) -> str | None:
    if not TIMESTAMP_PATTERN.match(value or ""):
        return None
    # 规整为可比较的 UTC 字符串（Z 与 +08:00 两种写法统一）
    if value.endswith("Z"):
        return value[:-1] + "+00:00"
    return value


def check_public_url(url: str, label: str, errors: list[str]) -> None:
    host_match = re.match(r"^https://([^/:?#]+)", url or "")
    if not host_match:
        errors.append(f"{label}: url must be https: {url!r}")
        return
    host = host_match.group(1).lower()
    if INTERNAL_HOST_PATTERN.search(host) or host.startswith("10.") or host.startswith("192.168."):
        errors.append(f"{label}: public url required, internal host rejected: {host}")
    query = url.split("?", 1)[1] if "?" in url else ""
    for key in re.findall(r"(?:^|[?&])([^=]+)=", query):
        if key.lower() in CREDENTIAL_QUERY_KEYS:
            errors.append(f"{label}: credential query parameter rejected: {key}")


def validate_review(review: dict, candidates: dict[str, str], errors: list[str]) -> None:
    review_id = review.get("id", "<unknown>")
    if not ID_PATTERN.match(review_id or ""):
        errors.append(f"{review_id}: invalid review id (need slug): {review_id!r}")

    recommendation = review.get("recommendation")
    if not isinstance(recommendation, dict):
        errors.append(f"{review_id}: recommendation object is required")
    else:
        rec_id = recommendation.get("id", "")
        if not ID_PATTERN.match(rec_id or ""):
            errors.append(f"{review_id}: recommendation.id must be a slug: {rec_id!r}")
        rec_at = recommendation.get("recommended_at", "")
        if not TIMESTAMP_PATTERN.match(rec_at or ""):
            errors.append(f"{review_id}: recommendation.recommended_at must be RFC3339")
        if not recommendation.get("channel"):
            errors.append(f"{review_id}: recommendation.channel is required")
        if not recommendation.get("signal_source"):
            errors.append(f"{review_id}: recommendation.signal_source is required")
        if not recommendation.get("reason"):
            errors.append(f"{review_id}: recommendation.reason is required")

    subject = review.get("subject")
    if not isinstance(subject, dict) or not subject.get("full_name"):
        errors.append(f"{review_id}: subject.full_name is required")
    else:
        full_name = subject["full_name"]
        html_url = subject.get("html_url", "")
        if full_name not in candidates:
            errors.append(
                f"{review_id}: subject {full_name!r} not found in data/discoveries.json public candidates"
            )
        elif html_url != candidates[full_name]:
            errors.append(
                f"{review_id}: subject.html_url {html_url!r} does not match discoveries record "
                f"{candidates[full_name]!r}"
            )
        check_public_url(html_url, f"{review_id} subject.html_url", errors)

    window = review.get("observation_window")
    window_from = window_to = None
    if not isinstance(window, dict):
        errors.append(f"{review_id}: observation_window is required")
    else:
        window_from = parse_ts(window.get("from", ""))
        window_to = parse_ts(window.get("to", ""))
        if window_from is None:
            errors.append(f"{review_id}: observation_window.from must be RFC3339")
        if window_to is None:
            errors.append(f"{review_id}: observation_window.to must be RFC3339")
        if window_from and window_to and window_from > window_to:
            errors.append(f"{review_id}: observation_window.from must be <= to")

    facts = review.get("observed_facts")
    if not isinstance(facts, list) or not facts:
        errors.append(f"{review_id}: observed_facts must be a non-empty list")
    else:
        for index, fact in enumerate(facts):
            label = f"{review_id} observed_facts[{index}]"
            if not isinstance(fact, dict) or not fact.get("fact"):
                errors.append(f"{label}: fact text is required")
                continue
            observed_at = fact.get("observed_at", "")
            if not TIMESTAMP_PATTERN.match(observed_at or ""):
                errors.append(f"{label}: observed_at must be RFC3339")
            elif window_from and window_to:
                fact_ts = parse_ts(observed_at)
                if fact_ts and not (window_from <= fact_ts <= window_to):
                    errors.append(f"{label}: observed_at outside observation_window")
            check_public_url(fact.get("source_url", ""), f"{label}.source_url", errors)

    conclusion = review.get("conclusion")
    if conclusion not in CONCLUSIONS:
        errors.append(f"{review_id}: conclusion must be one of {CONCLUSIONS}, got {conclusion!r}")

    if not review.get("adjustment"):
        errors.append(f"{review_id}: adjustment (human-readable action) is required")

    reviewed_by = review.get("reviewed_by", "")
    if not reviewed_by:
        errors.append(f"{review_id}: reviewed_by is required")
    authority = review.get("authority")
    if authority not in AUTHORITIES:
        errors.append(f"{review_id}: authority must be one of {AUTHORITIES}, got {authority!r}")
    if authority == "human-policy" and not review.get("policy_ref"):
        errors.append(f"{review_id}: authority=human-policy requires policy_ref")
    if reviewed_by in AUTOMATION_ACTORS and authority == "human":
        errors.append(f"{review_id}: automation actor cannot claim authority=human")
    if reviewed_by in AUTOMATION_ACTORS and conclusion == "remove":
        errors.append(
            f"{review_id}: automation actors may not conclude 'remove'; a human must record it"
        )

    reviewed_at = parse_ts(review.get("reviewed_at", ""))
    if reviewed_at is None:
        errors.append(f"{review_id}: reviewed_at must be RFC3339")
    rec_at_raw = isinstance(recommendation, dict) and recommendation.get("recommended_at")
    rec_at = parse_ts(rec_at_raw or "")
    if reviewed_at and rec_at and reviewed_at < rec_at:
        errors.append(f"{review_id}: reviewed_at must be >= recommendation.recommended_at")


def load_candidates(discoveries_path: Path, errors: list[str]) -> dict[str, str]:
    if not discoveries_path.exists():
        errors.append(f"discoveries data missing: {discoveries_path}")
        return {}
    try:
        payload = json.loads(discoveries_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"discoveries data invalid JSON: {exc}")
        return {}
    candidates = {}
    for item in payload.get("candidates", []):
        full_name = item.get("full_name")
        html_url = item.get("html_url")
        if full_name and html_url:
            candidates[full_name] = html_url
    return candidates


def build_profile_action_summary(data: dict) -> dict:
    """生成推荐复盘到画像调整的只读待办摘要。

    摘要只把 human-policy 授权下的 downgrade/remove 结论暴露为“待真人确认”事项，
    不写 profile.json、不改变权重，也不把真人已经直接确认的记录重复列为待办。
    """
    policy = data.get("policy", {}) if isinstance(data, dict) else {}
    reviews = data.get("reviews", []) if isinstance(data, dict) else []
    if not isinstance(reviews, list):
        reviews = []

    totals = {conclusion: 0 for conclusion in CONCLUSIONS}
    pending_actions = []
    for review in reviews:
        if not isinstance(review, dict):
            continue
        conclusion = review.get("conclusion")
        if conclusion in totals:
            totals[conclusion] += 1
        if conclusion not in PROFILE_ACTION_CONCLUSIONS or review.get("authority") != "human-policy":
            continue
        subject = review.get("subject") if isinstance(review.get("subject"), dict) else {}
        pending_actions.append(
            {
                "review_id": review.get("id", ""),
                "subject": subject.get("full_name", ""),
                "conclusion": conclusion,
                "adjustment": review.get("adjustment", ""),
                "policy_ref": review.get("policy_ref", ""),
                "reviewed_by": review.get("reviewed_by", ""),
                "reviewed_at": review.get("reviewed_at", ""),
                "requires_human_confirmation": True,
            }
        )

    return {
        "schema_version": 1,
        "generated_at": data.get("generated_at") if isinstance(data, dict) else None,
        "review_count": len(reviews),
        "totals": totals,
        "public_only": policy.get("public_only") is True,
        "auto_adjust_profile": policy.get("auto_adjust_profile") is True,
        "profile_write_allowed": False,
        "pending_human_confirmations": len(pending_actions),
        "pending_profile_actions": pending_actions,
    }


def validate(data: dict, discoveries: dict | None = None) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    policy = data.get("policy", {})
    if policy.get("public_only") is not True:
        errors.append("policy.public_only must be true")
    if policy.get("auto_adjust_profile") is not False:
        errors.append("policy.auto_adjust_profile must be false")
    if policy.get("require_human_policy_ref") is not True:
        errors.append("policy.require_human_policy_ref must be true")
    if policy.get("automation_max_conclusion") != AUTOMATION_MAX_CONCLUSION:
        errors.append(f"policy.automation_max_conclusion must be {AUTOMATION_MAX_CONCLUSION!r}")
    if policy.get("conclusions") != CONCLUSIONS:
        errors.append("policy.conclusions must be the canonical ordered list: keep → downgrade → remove")

    reviews = data.get("reviews")
    if not isinstance(reviews, list):
        errors.append("reviews must be a list")
        return errors

    discovery_errors: list[str] = []
    candidates = (
        load_candidates(DISCOVERIES, discovery_errors)
        if discoveries is None
        else {
            item.get("full_name"): item.get("html_url")
            for item in discoveries.get("candidates", [])
            if item.get("full_name") and item.get("html_url")
        }
    )
    errors.extend(discovery_errors)

    ids = [review.get("id", "") for review in reviews]
    if len(ids) != len(set(ids)):
        errors.append("duplicate review id")

    for review in reviews:
        if not isinstance(review, dict):
            errors.append("reviews entries must be objects")
            continue
        validate_review(review, candidates, errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "summarize"], help="校验数据契约或输出画像调整待办摘要")
    args = parser.parse_args()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    if args.command == "summarize":
        print(json.dumps(build_profile_action_summary(data), ensure_ascii=False, indent=2))
        return 0
    print(f"recommendation-reviews valid: {len(data.get('reviews', []))} reviews")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
