#!/usr/bin/env python3
"""Skill 待审队列：数据契约、评测状态机与人工门禁。

自动化（sync）只允许入队和刷新公开元数据；任何进入 screening 之后的
状态流转、评测项更新都必须由真人执行，Skill 永不自动安装。
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DISCOVERIES = ROOT / "data" / "discoveries.json"
DEFAULT_QUEUE = ROOT / "data" / "skill-review-queue.json"

SCHEMA_VERSION = 1
BOT_AUTHOR = "worklens-bot"

STATES = ("candidate", "screening", "needs_changes", "trial", "adopted", "rejected", "quarantined")
ACTIVE_STATES = ("candidate", "screening", "needs_changes", "trial")
CHECK_STATUSES = ("pass", "fail", "warn", "unknown")

CHECKLIST = {
    "license_declared": {
        "blocking": True,
        "question": "是否声明了可识别的开源许可证（不能是 NOASSERTION）",
        "automated": True,
    },
    "license_compatible": {
        "blocking": True,
        "question": "许可证是否与 WorkLens 的使用与再分发方式兼容",
        "automated": False,
    },
    "secret_clean": {
        "blocking": True,
        "question": "Skill 包与示例数据是否不含密钥、Token、Cookie 或私有地址",
        "automated": False,
    },
    "install_safe": {
        "blocking": True,
        "question": "安装脚本/钩子是否透明、无混淆代码、无 curl|sh 等远程执行",
        "automated": False,
    },
    "network_declared": {
        "blocking": True,
        "question": "外发网络访问的主机、用途与数据内容是否已声明且最小化",
        "automated": False,
    },
    "write_scope_declared": {
        "blocking": True,
        "question": "文件系统写操作的目录范围与副作用是否已声明",
        "automated": False,
    },
    "injection_surface_reviewed": {
        "blocking": True,
        "question": "是否已审查外部拉取内容导致的提示注入/工具投放入口",
        "automated": False,
    },
    "dependencies_pinned": {
        "blocking": False,
        "question": "依赖是否锁定版本/哈希，供应链可追溯",
        "automated": False,
    },
    "maintained": {
        "blocking": False,
        "question": "项目是否仍在维护、问题处理是否及时",
        "automated": False,
    },
}
BLOCKING_CHECKS = tuple(key for key, spec in CHECKLIST.items() if spec["blocking"])

ALLOWED_TRANSITIONS = {
    "candidate": {"screening", "rejected"},
    "screening": {"needs_changes", "trial", "rejected", "quarantined"},
    "needs_changes": {"screening", "rejected", "quarantined"},
    "trial": {"adopted", "needs_changes", "rejected", "quarantined"},
    "adopted": {"quarantined"},
    "rejected": set(),
    "quarantined": {"screening", "rejected"},
}

UI_PATTERN = re.compile(r"design-system|ui|component|tailwind|token|css|react|svelte", re.I)
SKILL_PATTERN = re.compile(r"agent-skill|skill|claude-skill|codex-skill", re.I)
STALE_DAYS = 180


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def classify_skill(candidate: dict) -> bool:
    """与页面 data-adapter.js 的分类顺序保持一致：先 UI 后 Skill。"""
    text = " ".join(
        [
            candidate.get("full_name", ""),
            candidate.get("description") or "",
            candidate.get("language") or "",
            *(candidate.get("topics") or []),
            candidate.get("source") or "",
        ]
    ).lower()
    if UI_PATTERN.search(text):
        return False
    return bool(SKILL_PATTERN.search(text))


def risk_flags_from_metadata(candidate: dict) -> list[str]:
    flags = []
    license_id = candidate.get("license")
    if not license_id:
        flags.append("no_license")
    elif license_id == "NOASSERTION":
        flags.append("license_unrecognized")
    if candidate.get("archived"):
        flags.append("archived")
    pushed_at = candidate.get("pushed_at") or candidate.get("updated_at")
    if pushed_at:
        try:
            pushed = dt.datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
            if pushed.tzinfo is None:
                pushed = pushed.replace(tzinfo=dt.timezone.utc)
            if dt.datetime.now(dt.timezone.utc) - pushed > dt.timedelta(days=STALE_DAYS):
                flags.append("stale_upstream")
        except ValueError:
            pass
    return flags


def build_entry(candidate: dict, next_index: int) -> dict:
    now = utc_now()
    license_id = candidate.get("license")
    license_ok = bool(license_id) and license_id != "NOASSERTION"
    entry = {
        "id": f"SR-{next_index:04d}",
        "subject": candidate["full_name"],
        "html_url": candidate.get("html_url")
        or f"https://github.com/{candidate['full_name']}",
        "source": candidate.get("source"),
        "also_seen_in": candidate.get("also_seen_in", []),
        "enqueued_at": now,
        "metadata_synced_at": now,
        "state": "candidate",
        "license": license_id,
        "archived": bool(candidate.get("archived")),
        "stars": int(candidate.get("stars") or 0),
        "pushed_at": candidate.get("pushed_at"),
        "checks": {
            "license_declared": {
                "status": "pass" if license_ok else "fail",
                "evidence": (
                    f"GitHub API：license.spdx_id={license_id}"
                    if license_id
                    else "GitHub API：未声明许可证"
                ),
                "checked_at": now,
                "by": BOT_AUTHOR,
            }
        },
        "risk_flags": risk_flags_from_metadata(candidate),
        "trial": None,
        "history": [
            {
                "at": now,
                "event": "enqueued",
                "by": BOT_AUTHOR,
                "note": "从 discoveries.json 自动入队（Skill 分类，仅公开元数据）",
            }
        ],
    }
    return entry


def refresh_metadata(entry: dict, candidate: dict) -> bool:
    changed = False
    now = utc_now()
    for field in ("source", "html_url"):
        value = candidate.get(field)
        if value and entry.get(field) != value:
            entry[field] = value
            changed = True
    seen = entry.setdefault("also_seen_in", [])
    for source in candidate.get("also_seen_in", []):
        if source not in seen:
            seen.append(source)
            changed = True
    for field in ("license", "archived", "stars", "pushed_at"):
        value = candidate.get(field)
        if field == "archived":
            value = bool(value)
        elif field == "stars":
            value = int(value or 0)
        if entry.get(field) != value:
            entry[field] = value
            changed = True
    flags = risk_flags_from_metadata(candidate)
    if entry.get("risk_flags") != flags:
        entry["risk_flags"] = flags
        changed = True
    if changed:
        entry["metadata_synced_at"] = now
    return changed


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def empty_queue() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": utc_now(),
        "policy": {
            "auto_install": False,
            "human_gate": "candidate 之后的所有流转必须由真人记录 decided_by、时间与理由",
            "blocking_checks": list(BLOCKING_CHECKS),
            "states": list(STATES),
        },
        "queue": [],
    }


def sync(discoveries_path: Path, queue_path: Path) -> int:
    discoveries = load_json(discoveries_path)
    if queue_path.exists():
        queue = load_json(queue_path)
    else:
        queue = empty_queue()
    entries = queue.setdefault("queue", [])
    by_subject = {entry["subject"]: entry for entry in entries}
    next_index = max((int(entry["id"].split("-", 1)[1]) for entry in entries), default=0)

    added = 0
    refreshed = 0
    for candidate in discoveries.get("candidates", []):
        if not candidate.get("full_name") or not classify_skill(candidate):
            continue
        entry = by_subject.get(candidate["full_name"])
        if entry is None:
            next_index += 1
            entry = build_entry(candidate, next_index)
            entries.append(entry)
            by_subject[entry["subject"]] = entry
            added += 1
        elif entry["state"] in ACTIVE_STATES and refresh_metadata(entry, candidate):
            refreshed += 1

    queue["schema_version"] = SCHEMA_VERSION
    generated = utc_now()
    queue["generated_at"] = generated
    queue["policy"] = empty_queue()["policy"]
    if queue_path.exists():
        previous = load_json(queue_path)
        previous.pop("generated_at", None)
        candidate_payload = dict(queue)
        candidate_payload.pop("generated_at", None)
        if previous == candidate_payload:
            print(f"待审队列无变化，保持 {len(entries)} 条；未自动流转、未安装")
            return 0
    write_json(queue_path, queue)
    print(f"待审队列：新增 {added} 条，刷新元数据 {refreshed} 条，当前共 {len(entries)} 条；未自动流转、未安装")
    return 0


def validation_errors(queue: dict) -> list[str]:
    errors: list[str] = []
    if queue.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version 不匹配")
    policy = queue.get("policy") or {}
    if policy.get("auto_install") is not False:
        errors.append("policy.auto_install 必须为 false")
    if set(policy.get("blocking_checks", [])) != set(BLOCKING_CHECKS):
        errors.append("policy.blocking_checks 与契约不一致")

    entries = queue.get("queue")
    if not isinstance(entries, list):
        return errors + ["queue 必须是数组"]

    seen_ids: set[str] = set()
    seen_subjects: set[str] = set()
    for index, entry in enumerate(entries):
        prefix = f"第 {index + 1} 条({entry.get('subject', entry.get('id', '?'))})"
        entry_id = entry.get("id")
        subject = entry.get("subject")
        if not isinstance(entry_id, str) or not re.fullmatch(r"SR-\d{4,}", entry_id):
            errors.append(f"{prefix}：id 必须形如 SR-0001")
        elif entry_id in seen_ids:
            errors.append(f"{prefix}：id {entry_id} 重复")
        seen_ids.add(entry_id)
        if not isinstance(subject, str) or "/" not in subject:
            errors.append(f"{prefix}：subject 必须是 owner/repo")
        elif subject in seen_subjects:
            errors.append(f"{prefix}：subject {subject} 重复")
        seen_subjects.add(subject)

        state = entry.get("state")
        if state not in STATES:
            errors.append(f"{prefix}：state 非法")
            continue
        checks = entry.get("checks") or {}
        unknown_checks = set(checks) - set(CHECKLIST)
        if unknown_checks:
            errors.append(f"{prefix}：未知评测项 {', '.join(sorted(unknown_checks))}")
        for key, detail in checks.items():
            status = (detail or {}).get("status")
            if status not in CHECK_STATUSES:
                errors.append(f"{prefix}：评测项 {key} 状态非法")
            for field in ("evidence", "checked_at", "by"):
                if not isinstance((detail or {}).get(field), str) or not detail.get(field):
                    errors.append(f"{prefix}：评测项 {key} 缺少 {field}")

        history = entry.get("history")
        if not isinstance(history, list) or not history:
            errors.append(f"{prefix}：history 不能为空")
        else:
            first = history[0]
            if first.get("event") != "enqueued" or first.get("by") != BOT_AUTHOR:
                errors.append(f"{prefix}：首个历史事件必须是 bot 入队")
            current = "candidate"
            for event_index, event in enumerate(history[1:], 1):
                if event.get("by") == BOT_AUTHOR:
                    errors.append(f"{prefix}：history[{event_index}] 不允许 bot 操作")
                note = event.get("note")
                if not isinstance(note, str) or not note.strip():
                    errors.append(f"{prefix}：history[{event_index}] 缺少人工说明")
                if event.get("event") == "transition":
                    target = event.get("to")
                    source = event.get("from", current)
                    if target not in ALLOWED_TRANSITIONS.get(source, set()):
                        errors.append(f"{prefix}：非法流转 {source} → {target}")
                    current = target if target in STATES else current
            if state != current:
                errors.append(f"{prefix}：state={state} 与历史回放结果 {current} 不一致")

        blocking_failed = [
            key for key in BLOCKING_CHECKS
            if (checks.get(key) or {}).get("status") != "pass"
        ]
        if state == "trial":
            if blocking_failed:
                errors.append(f"{prefix}：进入试用前阻断项未全部通过：{', '.join(blocking_failed)}")
            trial = entry.get("trial")
            if not isinstance(trial, dict) or not trial.get("scope") or not trial.get("started_at"):
                errors.append(f"{prefix}：试用记录缺少 scope/started_at")
            elif not trial.get("planned_end_at") or trial["planned_end_at"] <= trial["started_at"]:
                errors.append(f"{prefix}：试用 planned_end_at 必须晚于 started_at")
        if state == "adopted":
            if blocking_failed:
                errors.append(f"{prefix}：正式引入前阻断项未全部通过：{', '.join(blocking_failed)}")
            trial = entry.get("trial")
            if not isinstance(trial, dict) or trial.get("result") != "pass" or not trial.get("finished_at"):
                errors.append(f"{prefix}：正式引入要求试用完成且 result=pass")
            elif trial.get("started_at") and trial["finished_at"] < trial["started_at"]:
                errors.append(f"{prefix}：试用结束时间早于开始时间")
        if state in {"rejected", "quarantined", "needs_changes"}:
            last_transition = [event for event in (history or []) if event.get("event") == "transition"]
            if not last_transition or not (last_transition[-1].get("note") or "").strip():
                errors.append(f"{prefix}：{state} 状态必须给出人工理由")
    return errors


def validate(queue_path: Path) -> int:
    errors = validation_errors(load_json(queue_path))
    if errors:
        for error in errors:
            print(f"✗ {error}", file=sys.stderr)
        print(f"待审队列契约校验失败：{len(errors)} 个问题", file=sys.stderr)
        return 1
    print("待审队列契约与状态机校验通过")
    return 0


def find_entry(queue: dict, subject: str) -> dict:
    for entry in queue["queue"]:
        if entry["subject"] == subject:
            return entry
    raise SystemExit(f"未找到 subject：{subject}")


def require_human(author: str) -> None:
    if not author or author == BOT_AUTHOR or "bot" in author.lower():
        raise SystemExit("评测与流转必须由真人执行（--by 不能是 bot 身份）")


def transition(queue_path: Path, args: argparse.Namespace) -> int:
    require_human(args.by)
    queue = load_json(queue_path)
    entry = find_entry(queue, args.subject)
    source = entry["state"]
    target = args.to
    if target not in ALLOWED_TRANSITIONS.get(source, set()):
        raise SystemExit(f"非法流转 {source} → {target}；允许：{sorted(ALLOWED_TRANSITIONS[source])}")
    if not args.note.strip():
        raise SystemExit("流转必须填写 --note 说明理由")

    checks = entry.setdefault("checks", {})
    if target == "trial":
        pending = [key for key in BLOCKING_CHECKS if (checks.get(key) or {}).get("status") != "pass"]
        if pending:
            raise SystemExit(f"阻断评测项未全部通过：{', '.join(pending)}")
        if not args.trial_scope:
            raise SystemExit("进入试用必须提供 --trial-scope")
        now = utc_now()
        entry["trial"] = {
            "started_at": now,
            "scope": args.trial_scope,
            "planned_end_at": (
                dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=args.trial_days)
            ).isoformat(),
            "result": None,
            "finished_at": None,
        }
    if target == "adopted":
        if args.trial_result != "pass":
            raise SystemExit("正式引入必须提供 --trial-result pass 且试用结论为通过")
        trial = entry.get("trial")
        if not isinstance(trial, dict) or not trial.get("started_at"):
            raise SystemExit("缺少有效试用记录，不能正式引入")
        trial["result"] = "pass"
        trial["finished_at"] = trial.get("finished_at") or utc_now()
        if args.trial_note:
            trial["conclusion"] = args.trial_note
        entry["adopted_at"] = utc_now()

    entry["state"] = target
    entry["history"].append(
        {"at": utc_now(), "event": "transition", "by": args.by, "note": args.note, "from": source, "to": target}
    )
    queue["generated_at"] = utc_now()
    write_json(queue_path, queue)
    errors = validation_errors(queue)
    if errors:
        raise SystemExit("流转后契约校验失败：\n" + "\n".join(errors))
    print(f"{entry['id']} {args.subject}：{source} → {target}")
    return 0


def check_update(queue_path: Path, args: argparse.Namespace) -> int:
    require_human(args.by)
    if args.check not in CHECKLIST:
        raise SystemExit(f"未知评测项：{args.check}；可选 {', '.join(CHECKLIST)}")
    queue = load_json(queue_path)
    entry = find_entry(queue, args.subject)
    if entry["state"] in {"rejected", "adopted"} and args.check != "maintained":
        raise SystemExit(f"{entry['state']} 为终态，不再更新评测项（如需处置请先隔离/重审）")
    now = utc_now()
    entry.setdefault("checks", {})[args.check] = {
        "status": args.status,
        "evidence": args.evidence,
        "checked_at": now,
        "by": args.by,
    }
    entry["history"].append(
        {
            "at": now,
            "event": "check_updated",
            "by": args.by,
            "note": f"{args.check}={args.status}：{args.evidence}",
        }
    )
    queue["generated_at"] = now
    write_json(queue_path, queue)
    print(f"{entry['id']} {args.subject}：{args.check}={args.status}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sync_parser = sub.add_parser("sync", help="从 discoveries.json 同步 Skill 候选入队（只追加不流转）")
    sync_parser.add_argument("--discoveries", type=Path, default=DEFAULT_DISCOVERIES)
    sync_parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)

    validate_parser = sub.add_parser("validate", help="校验队列数据契约与状态机不变量")
    validate_parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)

    transition_parser = sub.add_parser("transition", help="人工流转队列状态")
    transition_parser.add_argument("--subject", required=True)
    transition_parser.add_argument("--to", required=True, choices=STATES)
    transition_parser.add_argument("--by", required=True, help="真人标识，禁止 bot")
    transition_parser.add_argument("--note", required=True)
    transition_parser.add_argument("--trial-scope", default="", help="进入 trial 时必填")
    transition_parser.add_argument("--trial-days", type=int, default=7)
    transition_parser.add_argument("--trial-result", choices=["pass"], help="adopted 时必须为 pass")
    transition_parser.add_argument("--trial-note", default="", help="试用结论摘要")
    transition_parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)

    check_parser = sub.add_parser("check-update", help="人工更新评测项结果")
    check_parser.add_argument("--subject", required=True)
    check_parser.add_argument("--check", required=True, choices=tuple(CHECKLIST))
    check_parser.add_argument("--status", required=True, choices=CHECK_STATUSES)
    check_parser.add_argument("--by", required=True)
    check_parser.add_argument("--evidence", required=True)
    check_parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "sync":
        return sync(args.discoveries, args.queue)
    if args.command == "validate":
        return validate(args.queue)
    if args.command == "transition":
        return transition(args.queue, args)
    if args.command == "check-update":
        return check_update(args.queue, args)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
