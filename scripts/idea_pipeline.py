#!/usr/bin/env python3
"""校验 Idea → 调研 → 方案 → 脚手架 → 验收项目化流程的数据契约。

只读工具：不访问网络、不创建脚手架、不写数据。阶段流转由人工（自动化最多
推进到 research）记录在 data/idea-pipeline.json 的 history 中，validate 强制
状态机顺序、阶段准入材料、公开证据与隐私边界。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/idea-pipeline.json"

STAGES = ["idea", "research", "plan", "scaffold", "accepted"]
ARCHIVED = "archived"
STAGE_INDEX = {stage: index for index, stage in enumerate(STAGES)}
AUTOMATION_ACTOR = "worklens-bot"
HUMAN_GATED_STAGES = {"plan", "scaffold", "accepted"}

ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
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


def validate_evidence(evidence: dict, label: str, errors: list[str]) -> None:
    url = evidence.get("url", "")
    host_match = re.match(r"^https://([^/:?#]+)", url)
    if not host_match:
        errors.append(f"{label}: evidence url must be https: {url!r}")
    else:
        host = host_match.group(1).lower()
        if INTERNAL_HOST_PATTERN.search(host) or host.startswith("10.") or host.startswith("192.168."):
            errors.append(f"{label}: evidence must be public, internal host rejected: {host}")
        query = url.split("?", 1)[1] if "?" in url else ""
        for key in re.findall(r"(?:^|[?&])([^=]+)=", query):
            if key.lower() in CREDENTIAL_QUERY_KEYS:
                errors.append(f"{label}: credential query parameter rejected: {key}")
    if not evidence.get("title"):
        errors.append(f"{label}: evidence requires a title")
    observed_at = evidence.get("observed_at", "")
    if not TIMESTAMP_PATTERN.match(observed_at):
        errors.append(f"{label}: evidence observed_at must be RFC3339: {observed_at!r}")


def validate_history(idea: dict, errors: list[str]) -> None:
    idea_id = idea.get("id", "<unknown>")
    history = idea.get("history", [])
    if not history:
        errors.append(f"{idea_id}: history must record at least the creation event")
        return
    current = None
    for index, event in enumerate(history):
        label = f"{idea_id} history[{index}]"
        from_stage = event.get("from_stage")
        to_stage = event.get("to_stage")
        actor = event.get("actor", "")
        if not actor:
            errors.append(f"{label}: event requires actor")
        if not event.get("note"):
            errors.append(f"{label}: event requires note")
        if not TIMESTAMP_PATTERN.match(event.get("at", "")):
            errors.append(f"{label}: at must be RFC3339")
        if index == 0 and (from_stage is not None or to_stage != "idea"):
            errors.append(f"{label}: first event must create the idea (from_stage=null → idea)")
        if to_stage not in STAGES and to_stage != ARCHIVED:
            errors.append(f"{label}: unknown to_stage {to_stage!r}")
            continue
        if index > 0:
            if current == ARCHIVED:
                errors.append(f"{label}: archived ideas cannot move again")
            elif to_stage == ARCHIVED:
                if from_stage != current:
                    errors.append(f"{label}: archive event must start from current stage {current}")
            else:
                if from_stage != current:
                    errors.append(f"{label}: from_stage {from_stage!r} does not match replay {current!r}")
                expected_index = STAGE_INDEX[current] + 1
                if STAGE_INDEX.get(to_stage) != expected_index:
                    errors.append(f"{label}: stages must advance one step (no skip/no rollback): {current} → {to_stage}")
            if to_stage in HUMAN_GATED_STAGES and actor == AUTOMATION_ACTOR:
                errors.append(f"{label}: automation may not advance ideas to {to_stage}")
        current = to_stage
    if current != idea.get("stage"):
        errors.append(
            f"{idea_id}: current stage {idea.get('stage')!r} does not match history replay {current!r}"
        )


def validate_stage_requirements(idea: dict, errors: list[str]) -> None:
    idea_id = idea["id"]
    stage = idea.get("stage")
    if stage == ARCHIVED:
        if not idea.get("archive_reason"):
            errors.append(f"{idea_id}: archived idea requires archive_reason")
        return
    reached = STAGE_INDEX.get(stage, -1)
    evidence = idea.get("evidence", [])
    if reached >= STAGE_INDEX["research"]:
        if len(evidence) < 2:
            errors.append(f"{idea_id}: research stage requires at least 2 public evidence items")
        if not idea.get("research_notes"):
            errors.append(f"{idea_id}: research stage requires research_notes")
    for index, item in enumerate(evidence):
        validate_evidence(item, f"{idea_id} evidence[{index}]", errors)
    if reached >= STAGE_INDEX["plan"]:
        plan = idea.get("plan") or {}
        criteria = plan.get("acceptance_criteria")
        if not isinstance(criteria, list) or not criteria or not all(criteria):
            errors.append(f"{idea_id}: plan stage requires non-empty acceptance_criteria")
    if reached >= STAGE_INDEX["scaffold"]:
        scaffold = idea.get("scaffold") or {}
        repo_path = scaffold.get("repo_path", "")
        if not repo_path or repo_path.startswith(("/", ".")) or ".." in repo_path.split("/"):
            errors.append(f"{idea_id}: scaffold stage requires a repo-relative path")
    if reached >= STAGE_INDEX["accepted"]:
        acceptance = idea.get("acceptance") or {}
        if acceptance.get("result") != "pass":
            errors.append(f"{idea_id}: accepted idea requires acceptance.result == 'pass'")
        if not TIMESTAMP_PATTERN.match(acceptance.get("verified_at", "")):
            errors.append(f"{idea_id}: acceptance requires RFC3339 verified_at")
        acceptance_evidence = acceptance.get("evidence", [])
        if not acceptance_evidence:
            errors.append(f"{idea_id}: acceptance requires verification evidence")
        for index, item in enumerate(acceptance_evidence):
            validate_evidence(item, f"{idea_id} acceptance.evidence[{index}]", errors)


def validate(data: dict) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    policy = data.get("policy", {})
    if policy.get("public_only") is not True:
        errors.append("policy.public_only must be true")
    if policy.get("auto_scaffold") is not False:
        errors.append("policy.auto_scaffold must be false")
    if policy.get("require_evidence") is not True:
        errors.append("policy.require_evidence must be true")
    if policy.get("automation_max_stage") != "research":
        errors.append("policy.automation_max_stage must be 'research'")
    if data.get("stages") != STAGES:
        errors.append("stages must be the canonical ordered list: idea → research → plan → scaffold → accepted")
    ideas = data.get("ideas")
    if not isinstance(ideas, list):
        errors.append("ideas must be a list")
        return errors
    ids = [idea.get("id", "") for idea in ideas]
    if len(ids) != len(set(ids)):
        errors.append("duplicate idea id")
    for idea in ideas:
        idea_id = idea.get("id", "<unknown>")
        if not ID_PATTERN.match(idea_id):
            errors.append(f"invalid idea id (need slug): {idea_id!r}")
        if not idea.get("title") or not idea.get("summary"):
            errors.append(f"{idea_id}: title and summary are required")
        if idea.get("stage") not in STAGES and idea.get("stage") != ARCHIVED:
            errors.append(f"{idea_id}: invalid stage {idea.get('stage')!r}")
            continue
        validate_history(idea, errors)
        validate_stage_requirements(idea, errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate"], help="校验数据契约")
    args = parser.parse_args()
    del args
    data = json.loads(DATA.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"idea-pipeline valid: {len(data.get('ideas', []))} ideas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
