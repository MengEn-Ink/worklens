#!/usr/bin/env python3
"""Collect factual GitHub repository metadata for WorkLens."""

from __future__ import annotations

import datetime as dt
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "sources.json"
OUTPUT_PATH = ROOT / "data" / "discoveries.json"
API = "https://api.github.com"


def request_json(path: str):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "worklens-collector/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        return open_json(path, headers)
    except urllib.error.HTTPError as error:
        if error.code != 401 or "Authorization" not in headers:
            raise
        public_headers = dict(headers)
        public_headers.pop("Authorization", None)
        return open_json(path, public_headers)


def open_json(path: str, headers: dict[str, str]):
    request = urllib.request.Request(f"{API}{path}", headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def normalize(repo: dict, source: str, relationship: str | None = None) -> dict:
    license_info = repo.get("license") or {}
    item = {
        "full_name": repo["full_name"],
        "html_url": repo["html_url"],
        "description": repo.get("description") or "",
        "topics": repo.get("topics") or [],
        "language": repo.get("language"),
        "stars": repo.get("stargazers_count", 0),
        "forks": repo.get("forks_count", 0),
        "open_issues": repo.get("open_issues_count", 0),
        "license": license_info.get("spdx_id"),
        "archived": repo.get("archived", False),
        "pushed_at": repo.get("pushed_at"),
        "updated_at": repo.get("updated_at"),
        "source": source,
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    if relationship:
        item["relationships"] = [relationship]
    return item


def merge_candidate(candidates: dict[str, dict], item: dict, source: str) -> None:
    previous = candidates.get(item["full_name"])
    if not previous:
        candidates[item["full_name"]] = item
        return
    sources = previous.setdefault("also_seen_in", [])
    if source != previous.get("source") and source not in sources:
        sources.append(source)
    relationships = previous.setdefault("relationships", [])
    for relationship in item.get("relationships", []):
        if relationship not in relationships:
            relationships.append(relationship)


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    max_results = int(config["policy"].get("max_candidates_per_query", 10))
    candidates: dict[str, dict] = {}
    status: dict[str, dict] = {}

    for full_name in config.get("repositories", []):
        source = f"repository:{full_name}"
        try:
            repo = request_json(f"/repos/{full_name}")
            merge_candidate(candidates, normalize(repo, source), source)
            status[source] = {"ok": True}
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as error:
            status[source] = {"ok": False, "error": str(error)}
        time.sleep(0.2)

    for profile in config.get("github_profiles", []):
        username = profile["username"]
        limit = min(int(profile.get("max_per_relation", 100)), 100)
        relations = []
        if profile.get("owned_public_repositories"):
            relations.append(("owned", f"/users/{username}/repos?type=owner&sort=updated&per_page={limit}"))
        if profile.get("starred_public_repositories"):
            relations.append(("starred", f"/users/{username}/starred?sort=updated&per_page={limit}"))
        for relationship, path in relations:
            source = f"profile:{username}:{relationship}"
            try:
                repos = request_json(path)
                public_repos = [repo for repo in repos if not repo.get("private", False)]
                for repo in public_repos:
                    merge_candidate(
                        candidates,
                        normalize(repo, source, f"{username}:{relationship}"),
                        source,
                    )
                status[source] = {"ok": True, "count": len(public_repos)}
            except (urllib.error.URLError, urllib.error.HTTPError, KeyError, TypeError) as error:
                status[source] = {"ok": False, "error": str(error)}
            time.sleep(0.2)

    for query in config.get("github_queries", []):
        source = f"search:{query}"
        encoded = urllib.parse.quote(query)
        try:
            payload = request_json(
                f"/search/repositories?q={encoded}&sort=updated&order=desc&per_page={max_results}"
            )
            for repo in payload.get("items", []):
                merge_candidate(candidates, normalize(repo, source), source)
            status[source] = {"ok": True, "count": len(payload.get("items", []))}
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as error:
            status[source] = {"ok": False, "error": str(error)}
        time.sleep(0.2)

    output = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "candidates": sorted(
            candidates.values(), key=lambda item: (item["stars"], item["updated_at"] or ""), reverse=True
        ),
        "source_status": status,
        "schema_version": 1,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"collected {len(candidates)} repositories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
