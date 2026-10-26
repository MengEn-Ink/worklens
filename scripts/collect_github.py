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


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_time(value: object) -> dt.datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except ValueError:
        return None


def is_fresh(value: object, max_stale_hours: float, now: dt.datetime) -> bool:
    timestamp = parse_time(value)
    return timestamp is not None and now - timestamp <= dt.timedelta(hours=max_stale_hours)


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


def full_name_from(repo: dict) -> str:
    full_name = repo.get("full_name")
    if isinstance(full_name, str) and full_name.count("/") == 1:
        return full_name.strip("/")
    url = repo.get("html_url")
    if isinstance(url, str):
        parsed = urllib.parse.urlparse(url)
        parts = parsed.path.strip("/").split("/")
        if parsed.hostname in {"github.com", "www.github.com"} and len(parts) >= 2:
            return "/".join(parts[:2]).removesuffix(".git")
    raise KeyError("candidate requires full_name or a GitHub html_url")


def normalize(repo: dict, source: str, relationship: str | None = None, collected_at: str | None = None) -> dict:
    full_name = full_name_from(repo)
    license_info = repo.get("license") or {}
    license_id = license_info.get("spdx_id") if isinstance(license_info, dict) else license_info
    item = {
        "full_name": full_name,
        "html_url": repo.get("html_url") or f"https://github.com/{full_name}",
        "description": repo.get("description") or "",
        "topics": repo.get("topics") or [],
        "language": repo.get("language"),
        "stars": repo.get("stargazers_count", repo.get("stars", 0)) or 0,
        "forks": repo.get("forks_count", repo.get("forks", 0)) or 0,
        "open_issues": repo.get("open_issues_count", repo.get("open_issues", 0)) or 0,
        "license": license_id,
        "archived": repo.get("archived", False),
        "pushed_at": repo.get("pushed_at"),
        "updated_at": repo.get("updated_at"),
        "source": source,
        "collected_at": collected_at or repo.get("collected_at") or utcnow().isoformat(),
    }
    relationships = list(repo.get("relationships") or [])
    if relationship and relationship not in relationships:
        relationships.append(relationship)
    if relationships:
        item["relationships"] = relationships
    for seen_source in repo.get("also_seen_in") or []:
        if seen_source != source:
            item.setdefault("also_seen_in", []).append(seen_source)
    return item


def merge_candidate(candidates: dict[str, dict], item: dict, source: str, replace_facts: bool = False) -> None:
    previous = candidates.get(item["full_name"])
    if not previous:
        candidates[item["full_name"]] = item
        return
    if replace_facts:
        previous_sources = [previous.get("source"), *previous.get("also_seen_in", [])]
        previous_relationships = previous.get("relationships", [])
        candidates[item["full_name"]] = item
        previous = item
        sources = previous.setdefault("also_seen_in", [])
        for seen_source in previous_sources:
            if seen_source and seen_source != source and seen_source not in sources:
                sources.append(seen_source)
        relationships = previous.setdefault("relationships", [])
        for relationship in previous_relationships:
            if relationship not in relationships:
                relationships.append(relationship)
        return
    sources = previous.setdefault("also_seen_in", [])
    for seen_source in [source, *item.get("also_seen_in", [])]:
        if seen_source != previous.get("source") and seen_source not in sources:
            sources.append(seen_source)
    relationships = previous.setdefault("relationships", [])
    for relationship in item.get("relationships", []):
        if relationship not in relationships:
            relationships.append(relationship)


def feed_items(payload: object) -> tuple[list, str | None]:
    if isinstance(payload, list):
        return payload, None
    if not isinstance(payload, dict):
        raise TypeError("curated feed must be a JSON object or array")
    for key in ("candidates", "items", "repositories"):
        if isinstance(payload.get(key), list):
            return payload[key], payload.get("generated_at")
    raise KeyError("curated feed requires candidates, items, repositories, or a top-level array")


def load_feed(feed: dict) -> object:
    location = feed["url"] if feed.get("url") else feed["path"]
    if feed.get("url"):
        parsed = urllib.parse.urlparse(location)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("curated feed URL must be public HTTPS")
        request = urllib.request.Request(location, headers={"Accept": "application/json", "User-Agent": "worklens-collector/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    path = Path(location)
    if not path.is_absolute():
        path = ROOT / path
    return json.loads(path.read_text(encoding="utf-8"))


def cached_source_items(previous: dict, source: str) -> list[dict]:
    return [item for item in previous.get("candidates", []) if item.get("source") == source or source in item.get("also_seen_in", [])]


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    policy = config.get("policy", {})
    max_results = int(policy.get("max_candidates_per_query", 10))
    feed_ttl = float(policy.get("curated_feed_max_stale_hours", 24))
    discovery_ttl = float(policy.get("discovery_cache_hours", 24))
    now = utcnow()
    candidates: dict[str, dict] = {}
    status: dict[str, dict] = {}
    feed_fresh: set[str] = set()

    previous = {}
    try:
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        pass

    for index, feed in enumerate(config.get("curated_feeds", [])):
        if not feed.get("enabled", True):
            continue
        name = feed.get("name") or f"feed-{index + 1}"
        source = f"curated:{name}"
        try:
            payload = load_feed(feed)
            items, generated_at = feed_items(payload)
            feed_timestamp = generated_at or now.isoformat()
            fresh = is_fresh(feed_timestamp, float(feed.get("max_stale_hours", feed_ttl)), now)
            imported = 0
            for repo in items:
                item = normalize(repo, source, collected_at=repo.get("collected_at") or generated_at or now.isoformat())
                merge_candidate(candidates, item, source)
                imported += 1
                if fresh:
                    feed_fresh.add(item["full_name"])
            status[source] = {"ok": True, "count": imported, "fresh": fresh, "generated_at": generated_at}
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError, urllib.error.URLError, urllib.error.HTTPError) as error:
            status[source] = {"ok": False, "error": str(error)}

    for full_name in config.get("repositories", []):
        source = f"repository:{full_name}"
        if full_name in feed_fresh:
            merge_candidate(candidates, normalize({"full_name": full_name}, source), source)
            status[source] = {"ok": True, "cached": True, "cache_source": candidates[full_name]["source"]}
            continue
        try:
            repo = request_json(f"/repos/{full_name}")
            merge_candidate(candidates, normalize(repo, source), source, replace_facts=True)
            status[source] = {"ok": True, "fetched_at": now.isoformat()}
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as error:
            status[source] = {"ok": False, "error": str(error)}
        time.sleep(0.2)

    def reuse_discovery(source: str) -> bool:
        previous_status = previous.get("source_status", {}).get(source, {})
        cached = cached_source_items(previous, source)
        source_was_collected = bool(cached) or previous_status.get("ok") is True
        fetched_at = previous_status.get("fetched_at") or previous.get("generated_at")
        if not source_was_collected or not is_fresh(fetched_at, discovery_ttl, now):
            return False
        for repo in cached:
            merge_candidate(candidates, normalize(repo, source, collected_at=repo.get("collected_at")), source)
        status[source] = {
            "ok": True,
            "count": len(cached),
            "cached": True,
            "fetched_at": fetched_at,
        }
        return True

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
            if reuse_discovery(source):
                continue
            try:
                repos = request_json(path)
                public_repos = [repo for repo in repos if not repo.get("private", False)]
                for repo in public_repos:
                    merge_candidate(candidates, normalize(repo, source, f"{username}:{relationship}"), source)
                status[source] = {"ok": True, "count": len(public_repos), "fetched_at": now.isoformat()}
            except (urllib.error.URLError, urllib.error.HTTPError, KeyError, TypeError) as error:
                status[source] = {"ok": False, "error": str(error)}
            time.sleep(0.2)

    for query in config.get("github_queries", []):
        source = f"search:{query}"
        if reuse_discovery(source):
            continue
        encoded = urllib.parse.quote(query)
        try:
            payload = request_json(f"/search/repositories?q={encoded}&sort=updated&order=desc&per_page={max_results}")
            for repo in payload.get("items", []):
                merge_candidate(candidates, normalize(repo, source), source)
            status[source] = {"ok": True, "count": len(payload.get("items", [])), "fetched_at": now.isoformat()}
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as error:
            status[source] = {"ok": False, "error": str(error)}
        time.sleep(0.2)

    output = {
        "generated_at": now.isoformat(),
        "candidates": sorted(candidates.values(), key=lambda item: (item["stars"], item["updated_at"] or ""), reverse=True),
        "source_status": status,
        "schema_version": 1,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"collected {len(candidates)} repositories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
