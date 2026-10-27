#!/usr/bin/env python3
"""Build a read-only candidate pool for the core open-source circle.

Pipeline
--------
1. Read ``config/core-circle.json`` for bounds and privacy policy.
2. Read ``data/core-circle.json`` for already-verified people and projects.
3. For every project, collect contributors that are **not** already in people,
   **not** the seed account, and **not** a bot (``[bot]`` suffix or type ``Bot``).
4. For each candidate, fetch the public GitHub profile (optional) to attach
   weak-signal evidence (``public_repos``, ``followers``, ``following``,
   ``created_at``). The script works offline too: when no profile is fetched
   the candidate is still recorded with ``profile_fetched`` set to ``false``.
5. Emit ``data/core-circle-candidates.json``. The file is advisory only —
   nothing is auto-promoted into ``data/core-circle.json`` and no social
   write (follow / message) is performed.

The module exposes pure helpers (``select_candidates``, ``build_output``) so
unit tests can run entirely without network access.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Iterable

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config/core-circle.json"
CIRCLE_PATH = ROOT / "data/core-circle.json"
OUTPUT_PATH = ROOT / "data/core-circle-candidates.json"

SCHEMA_VERSION = 1
WEAK_SIGNAL_KEYS = ("public_repos", "followers", "following", "created_at", "html_url", "type")


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _is_bot_login(login: str) -> bool:
    return login.lower().endswith("[bot]") or login.lower().endswith("-bot")


def iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def seed_logins(config: dict) -> set[str]:
    return {str(seed.get("login", "")).lower() for seed in config.get("seeds", []) if seed.get("login")}


def existing_people(circle: dict) -> set[str]:
    return {str(person.get("login", "")).lower() for person in circle.get("people", []) if person.get("login")}


def select_candidates(circle: dict, config: dict) -> list[dict]:
    """Collect per-login contribution aggregates across all projects.

    Returns a list sorted by (contributions_total desc, login asc) and bounded
    by ``config.discovery.max_discovered_users``.
    """
    skip = seed_logins(config) | existing_people(circle)
    bounds = config.get("discovery", {})
    cap_per_repo = int(bounds.get("max_contributors_per_repository", 20))
    cap_total = int(bounds.get("max_discovered_users", 100))

    acc: dict[str, dict] = {}
    for project in circle.get("projects", []):
        full_name = project.get("full_name") or ""
        evidence = project.get("evidence") or {}
        contributors = list(evidence.get("contributors") or [])[:cap_per_repo]
        for contributor in contributors:
            login = str(contributor.get("login", "")).strip()
            if not login or login.lower() in skip or _is_bot_login(login):
                continue
            contributions = int(contributor.get("contributions") or 0)
            row = acc.setdefault(
                login,
                {
                    "login": login,
                    "source_projects": [],
                    "contributions_total": 0,
                },
            )
            if full_name and full_name not in row["source_projects"]:
                row["source_projects"].append(full_name)
            row["contributions_total"] += max(0, contributions)

    candidates = sorted(
        acc.values(),
        key=lambda row: (-row["contributions_total"], row["login"].lower()),
    )
    return candidates[:cap_total]


def enrich_candidate(candidate: dict, profile: dict | None, checked_at: str) -> dict:
    """Return a new dict combining the candidate aggregate with weak signals."""
    enriched = {
        **candidate,
        "profile_url": f"https://github.com/{candidate['login']}",
        "evidence_url": f"https://api.github.com/users/{candidate['login']}",
        "profile_checked_at": checked_at,
        "profile_fetched": bool(profile),
        "promotion_hint": {
            "proposed_tier": "watch",
            "human_decision_required": True,
            "notes": "contributor 事实只代表存在协作；followers/stars 仅为弱信号，不构成背书",
        },
    }
    if profile:
        enriched["public_evidence"] = {key: profile.get(key) for key in WEAK_SIGNAL_KEYS if key in profile}
    else:
        enriched["public_evidence"] = None
    return enriched


def build_output(candidates: list[dict], config: dict, generated_at: str, source_status: list[dict]) -> dict:
    privacy = config.get("privacy", {})
    bounds = config.get("discovery", {})
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "source": "GitHub public REST API; contributors already recorded in data/core-circle.json",
        "policy": {
            "public_github_only": bool(privacy.get("public_github_only", True)),
            "auto_follow": bool(privacy.get("auto_follow", False)),
            "auto_message": bool(privacy.get("auto_message", False)),
            "human_promote_required": True,
            "store_email": bool(privacy.get("store_email", False)),
        },
        "bounds": {
            "max_contributors_per_repository": bounds.get("max_contributors_per_repository"),
            "max_discovered_users": bounds.get("max_discovered_users"),
        },
        "summary": {
            "candidate_count": len(candidates),
            "fetched_count": sum(1 for c in candidates if c.get("profile_fetched")),
        },
        "candidates": candidates,
        "source_status": source_status,
    }


# ---------------------------------------------------------------------------
# Network layer (optional)
# ---------------------------------------------------------------------------

def fetch_profile_via_gh(login: str, timeout: int = 15) -> tuple[int, dict | None, str | None]:
    """Fetch a GitHub user profile through the ``gh`` CLI.

    Returns ``(status_code, body, error)``. ``status_code`` is 200 on success,
    404 when the user does not exist, and -1 for transport failures.
    """
    try:
        proc = subprocess.run(
            ["gh", "api", f"/users/{login}", "-H", "Accept: application/vnd.github+json"],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError:
        return -1, None, "gh_not_installed"
    except subprocess.TimeoutExpired:
        return -1, None, "gh_timeout"
    if proc.returncode == 0:
        try:
            return 200, json.loads(proc.stdout), None
        except json.JSONDecodeError as exc:
            return -1, None, f"json_decode:{exc}"
    stderr = (proc.stderr or "").strip()
    if "HTTP 404" in stderr or "Not Found" in stderr:
        return 404, None, stderr
    return -1, None, stderr or "unknown"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def discover(
    config: dict,
    circle: dict,
    *,
    enable_network: bool,
    fetcher: Callable[[str], tuple[int, dict | None, str | None]] = fetch_profile_via_gh,
    sleep: Callable[[float], None] = time.sleep,
    now: Callable[[], str] = iso_now,
) -> dict:
    generated_at = now()
    candidates = select_candidates(circle, config)
    enriched: list[dict] = []
    source_status: list[dict] = []
    for candidate in candidates:
        login = candidate["login"]
        if not enable_network:
            enriched.append(enrich_candidate(candidate, None, generated_at))
            source_status.append({"login": login, "ok": True, "fetched": False})
            continue
        status, body, error = fetcher(login)
        if status == 200 and isinstance(body, dict):
            enriched.append(enrich_candidate(candidate, body, generated_at))
            source_status.append({"login": login, "ok": True, "fetched": True})
        else:
            enriched.append(enrich_candidate(candidate, None, generated_at))
            source_status.append({"login": login, "ok": False, "fetched": False, "status": status, "error": error})
        sleep(0.3)
    return build_output(enriched, config, generated_at, source_status)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="skip profile network calls")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args(argv)

    if not CONFIG_PATH.is_file():
        print(f"missing config: {CONFIG_PATH}", file=sys.stderr)
        return 2
    if not CIRCLE_PATH.is_file():
        print(f"missing circle data: {CIRCLE_PATH}", file=sys.stderr)
        return 2

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    circle = json.loads(CIRCLE_PATH.read_text(encoding="utf-8"))

    privacy = config.get("privacy", {})
    if not privacy.get("public_github_only") or privacy.get("auto_follow") or privacy.get("auto_message"):
        print("privacy policy rejects discovery: public_github_only must be true, auto_follow/message must be false", file=sys.stderr)
        return 2

    enable_network = not args.offline
    result = discover(config, circle, enable_network=enable_network)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = result["summary"]
    print(
        f"wrote {args.output.relative_to(ROOT)} · candidates={summary['candidate_count']} fetched={summary['fetched_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
