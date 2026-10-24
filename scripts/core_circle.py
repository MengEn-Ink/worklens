#!/usr/bin/env python3
"""Validate and rank the public GitHub core-circle graph without external writes."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/core-circle.json"
DATA = ROOT / "data/core-circle.json"
TIERS = {"seed", "core", "candidate", "watch"}
RELATIONS = {"following", "follower", "contributor", "co_contributor", "shared_topic"}


def dedupe_key(item: dict) -> tuple[str, str, str]:
    return item["from"].lower(), item["to"].lower(), item["type"]


def validate(config: dict, data: dict) -> list[str]:
    errors: list[str] = []
    privacy = config.get("privacy", {})
    if not privacy.get("public_github_only") or privacy.get("store_email"):
        errors.append("privacy policy must allow public GitHub facts only and reject email")
    if privacy.get("auto_follow") or privacy.get("auto_message"):
        errors.append("external social writes must remain disabled")
    limits = config.get("discovery", {})
    for key in ("max_seed_users", "max_repositories_per_seed", "max_contributors_per_repository", "max_follow_relations_per_seed", "max_discovered_users"):
        if not isinstance(limits.get(key), int) or not 0 < limits[key] <= 500:
            errors.append(f"invalid bounded limit: {key}")
    people = data.get("people", [])
    logins = [person.get("login", "").lower() for person in people]
    if len(logins) != len(set(logins)):
        errors.append("duplicate people")
    for person in people:
        if person.get("tier") not in TIERS:
            errors.append(f"invalid tier: {person.get('login')}")
        if "email" in person:
            errors.append(f"email is forbidden: {person.get('login')}")
    seen = set()
    for edge in data.get("relationships", []):
        if edge.get("type") not in RELATIONS:
            errors.append(f"invalid relationship: {edge.get('type')}")
            continue
        key = dedupe_key(edge)
        if key in seen:
            errors.append(f"duplicate relationship: {key}")
        seen.add(key)
        if edge["type"] in {"following", "follower"} and edge.get("strength") not in {"weak", None}:
            errors.append("follow relations may only be weak signals")
        if not edge.get("evidence_url") or not edge.get("observed_at"):
            errors.append(f"relationship lacks evidence: {key}")
    for project in data.get("projects", []):
        evidence = project.get("evidence", {})
        if project.get("recommendation") and not evidence.get("license_spdx"):
            errors.append(f"recommended project lacks declared license: {project.get('full_name')}")
    return errors


def main() -> int:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    data = json.loads(DATA.read_text(encoding="utf-8"))
    errors = validate(config, data)
    if errors:
        print("\n".join(errors))
        return 1
    print(f"core-circle valid: {len(data.get('people', []))} people, {len(data.get('projects', []))} projects")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
