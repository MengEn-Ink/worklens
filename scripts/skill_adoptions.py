#!/usr/bin/env python3
"""Skill 正式引入账本（adoptions）契约与校验。

正式引入 = 真人在 Skill 待审队列把某条流转到 ``adopted`` 之后，再在
``data/skill-adoptions.json`` 中登记一条可审计的引入记录：谁、何时、因何
决定、使用范围、如何回滚。本脚本只做校验与查询，不做任何写入；不执行、
不安装、不下载任何候选 Skill。

与 ``skill_review.py`` 的边界：
- ``skill_review.py`` 管队列（candidate → ... → adopted / rejected）；
- 本脚本管「决定本身」留下的工程记录，并校验与队列的一致性：
  * 每条 adoption 必须对应队列中 ``state == "adopted"`` 的真实条目；
  * 队列中每个 ``state == "adopted"`` 的条目必须在账本中有对应 adoption；
  * ``decided_by`` 必须是真人；``human_accepted`` 必须为 ``True``。

缺省账本是空数组。本轮 WorkLens 队列中尚无 ``adopted`` 条目（SR-0011 仍在
``trial``），因此账本为空属于合法最小值。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ADOPTIONS = ROOT / "data" / "skill-adoptions.json"
DEFAULT_QUEUE = ROOT / "data" / "skill-review-queue.json"

SCHEMA_VERSION = 1
BOT_HINTS = ("bot", "github-actions", "worklens-bot")

REQUIRED_FIELDS = (
    "adoption_id",
    "skill_review_id",
    "subject",
    "html_url",
    "decided_by",
    "decided_at",
    "decision_reason",
    "trial_report_url",
    "import_scope",
    "rollback_plan",
    "revert_command",
    "human_accepted",
    "history",
)

ADOPTION_ID_RE = re.compile(r"^ADOPT-\d{4,}$")
SKILL_REVIEW_ID_RE = re.compile(r"^SR-\d{4,}$")
SUBJECT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9._-]+$")
HTTPS_URL_RE = re.compile(r"^https://")
ALLOWED_HISTORY_EVENTS = {"adopted", "scope_tightened", "rolled_back", "quarantined"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _is_bot(name: str) -> bool:
    if not isinstance(name, str) or not name.strip():
        return True
    lowered = name.lower()
    return any(hint in lowered for hint in BOT_HINTS)


def _parse_iso(value: str) -> dt.datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _validate_history(history: list, prefix: str, errors: list[str]) -> None:
    if not isinstance(history, list) or not history:
        errors.append(f"{prefix}：history 必须是非空数组")
        return
    first = history[0]
    if not isinstance(first, dict) or first.get("event") != "adopted":
        errors.append(f"{prefix}：history 首条必须是 event=adopted")
    seen_ids: set[int] = set()
    for index, event in enumerate(history):
        if not isinstance(event, dict):
            errors.append(f"{prefix}：history[{index}] 必须是对象")
            continue
        event_name = event.get("event")
        if event_name not in ALLOWED_HISTORY_EVENTS:
            errors.append(
                f"{prefix}：history[{index}] event={event_name} 非法；允许 {sorted(ALLOWED_HISTORY_EVENTS)}"
            )
        by = event.get("by")
        if _is_bot(by):
            errors.append(f"{prefix}：history[{index}] by={by!r} 不是真人")
        note = event.get("note")
        if not isinstance(note, str) or not note.strip():
            errors.append(f"{prefix}：history[{index}] 缺少人工说明 note")
        if _parse_iso(event.get("at")) is None:
            errors.append(f"{prefix}：history[{index}] at 不是合法 RFC3339 时间")
        seen_ids.add(id(event))


def _queue_adoption_map(queue: dict | None) -> dict[str, dict]:
    if not isinstance(queue, dict):
        return {}
    entries = queue.get("queue")
    if not isinstance(entries, list):
        return {}
    out: dict[str, dict] = {}
    for entry in entries:
        if isinstance(entry, dict) and entry.get("state") == "adopted":
            key = entry.get("id") or ""
            if isinstance(key, str) and key:
                out[key] = entry
    return out


def validation_errors(doc: dict, queue: dict | None = None) -> list[str]:
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["skill-adoptions.json 根必须是对象"]
    if doc.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version 不匹配")
    policy = doc.get("policy")
    if not isinstance(policy, dict):
        errors.append("policy 必须是对象")
    else:
        if policy.get("auto_install") is not False:
            errors.append("policy.auto_install 必须为 false")
        if policy.get("auto_execute") is not False:
            errors.append("policy.auto_execute 必须为 false")
        if policy.get("human_decision_required") is not True:
            errors.append("policy.human_decision_required 必须为 true")
        if policy.get("public_github_only") is not True:
            errors.append("policy.public_github_only 必须为 true")
        if policy.get("max_automation_stage") != "candidate":
            errors.append("policy.max_automation_stage 必须为 'candidate'（自动化不得越过候选）")

    adoptions = doc.get("adoptions")
    if not isinstance(adoptions, list):
        return errors + ["adoptions 必须是数组"]

    queue_adopted = _queue_adoption_map(queue)
    covered_queue_ids: set[str] = set()
    seen_adoption_ids: set[str] = set()
    seen_subjects: set[str] = set()
    seen_review_ids: set[str] = set()

    for index, adoption in enumerate(adoptions):
        prefix = f"adoption[{index}]"
        if not isinstance(adoption, dict):
            errors.append(f"{prefix} 必须是对象")
            continue
        for field in REQUIRED_FIELDS:
            if field not in adoption or adoption.get(field) in (None, ""):
                errors.append(f"{prefix}：缺少字段 {field}")

        aid = adoption.get("adoption_id")
        if isinstance(aid, str) and not ADOPTION_ID_RE.fullmatch(aid):
            errors.append(f"{prefix}：adoption_id={aid!r} 必须形如 ADOPT-0001")
        elif isinstance(aid, str):
            if aid in seen_adoption_ids:
                errors.append(f"{prefix}：adoption_id={aid} 重复")
            seen_adoption_ids.add(aid)

        rid = adoption.get("skill_review_id")
        if isinstance(rid, str) and not SKILL_REVIEW_ID_RE.fullmatch(rid):
            errors.append(f"{prefix}：skill_review_id={rid!r} 必须形如 SR-0001")
        elif isinstance(rid, str):
            if rid in seen_review_ids:
                errors.append(f"{prefix}：skill_review_id={rid} 重复")
            seen_review_ids.add(rid)

        subject = adoption.get("subject")
        if isinstance(subject, str) and not SUBJECT_RE.fullmatch(subject):
            errors.append(f"{prefix}：subject={subject!r} 必须形如 owner/repo")
        elif isinstance(subject, str):
            if subject in seen_subjects:
                errors.append(f"{prefix}：subject={subject} 重复")
            seen_subjects.add(subject)

        html_url = adoption.get("html_url")
        if isinstance(html_url, str) and not HTTPS_URL_RE.match(html_url):
            errors.append(f"{prefix}：html_url 必须以 https:// 开头")

        trial_report_url = adoption.get("trial_report_url")
        if isinstance(trial_report_url, str) and not (
            HTTPS_URL_RE.match(trial_report_url) or trial_report_url.startswith("data/")
        ):
            errors.append(
                f"{prefix}：trial_report_url 必须是 https 链接或仓库内 data/ 路径"
            )

        if adoption.get("human_accepted") is not True:
            errors.append(f"{prefix}：human_accepted 必须为 true")

        decided_by = adoption.get("decided_by")
        if _is_bot(decided_by):
            errors.append(f"{prefix}：decided_by={decided_by!r} 不是真人")

        if _parse_iso(adoption.get("decided_at")) is None:
            errors.append(f"{prefix}：decided_at 不是合法 RFC3339 时间")

        for text_field in ("decision_reason", "import_scope", "rollback_plan", "revert_command"):
            value = adoption.get(text_field)
            if not isinstance(value, str) or len(value.strip()) < 4:
                errors.append(f"{prefix}：{text_field} 必须是不少于 4 字符的描述")

        _validate_history(adoption.get("history"), prefix, errors)

        # Cross-check: queue 中必须有对应 adopted 条目
        if queue is not None and isinstance(rid, str):
            matched = queue_adopted.get(rid)
            if matched is None:
                errors.append(
                    f"{prefix}：skill_review_id={rid} 在 skill-review-queue 中没有 state=adopted 的条目"
                )
            else:
                if isinstance(subject, str) and matched.get("subject") != subject:
                    errors.append(
                        f"{prefix}：subject 与队列不一致（账本={subject}，队列={matched.get('subject')}）"
                    )
                covered_queue_ids.add(rid)

    # Cross-check: 队列中所有 adopted 条目必须都在账本中
    if queue is not None:
        missing = sorted(set(queue_adopted) - covered_queue_ids)
        for mid in missing:
            errors.append(
                f"skill-review-queue 条目 {mid}({queue_adopted[mid].get('subject')}) 为 adopted 但未登记在 skill-adoptions.json"
            )

    return errors


def validate(adoptions_path: Path, queue_path: Path | None) -> int:
    doc = load_json(adoptions_path)
    queue = load_json(queue_path) if queue_path and queue_path.exists() else None
    errors = validation_errors(doc, queue)
    if errors:
        for error in errors:
            print(f"✗ {error}", file=sys.stderr)
        print(f"skill-adoptions 契约校验失败：{len(errors)} 个问题", file=sys.stderr)
        return 1
    adoptions = doc.get("adoptions", [])
    print(f"skill-adoptions valid: {len(adoptions)} adoption(s); auto_install=false, auto_execute=false")
    return 0


def list_cmd(adoptions_path: Path) -> int:
    doc = load_json(adoptions_path)
    adoptions = doc.get("adoptions") or []
    if not adoptions:
        print("当前没有正式引入记录（本账本为空属于合法最小值）")
        return 0
    for a in adoptions:
        print(
            f"{a.get('adoption_id')} ← {a.get('skill_review_id')} · {a.get('subject')} · "
            f"decided_by={a.get('decided_by')} at {a.get('decided_at')}"
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    v = sub.add_parser("validate", help="校验账本契约及与 skill-review-queue 的一致性")
    v.add_argument("--adoptions", type=Path, default=DEFAULT_ADOPTIONS)
    v.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)

    ls = sub.add_parser("list", help="列出当前正式引入记录")
    ls.add_argument("--adoptions", type=Path, default=DEFAULT_ADOPTIONS)

    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "validate":
        return validate(args.adoptions, args.queue)
    if args.command == "list":
        return list_cmd(args.adoptions)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
