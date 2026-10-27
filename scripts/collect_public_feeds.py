#!/usr/bin/env python3
"""Collect and merge WorkLens public feeds using only the Python standard library."""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "sources.json"
OUTPUT_PATH = ROOT / "data" / "ai-news.json"
USER_AGENT = "worklens-public-feed-collector/1.0"
PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2}
TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid", "oc", "ref", "ref_src", "source"}
CVE_RE = re.compile(r"\bCVE-\d{4}-\d{4,}\b", re.I)
GHSA_RE = re.compile(r"\bGHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}\b", re.I)


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso_time(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return dt.datetime.fromtimestamp(value, dt.timezone.utc).isoformat().replace("+00:00", "Z")
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = email.utils.parsedate_to_datetime(text)
        except (TypeError, ValueError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_time(value: Any) -> dt.datetime | None:
    normalized = iso_time(value)
    return dt.datetime.fromisoformat(normalized.replace("Z", "+00:00")) if normalized else None


def canonical_url(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    try:
        parts = urllib.parse.urlsplit(value.strip())
        hostname = parts.hostname
        port = parts.port
    except ValueError:
        return ""
    if parts.scheme.lower() not in {"http", "https"} or not hostname:
        return ""
    host = hostname.lower()
    if port and not ((parts.scheme == "http" and port == 80) or (parts.scheme == "https" and port == 443)):
        host += f":{port}"
    query = []
    for key, item in urllib.parse.parse_qsl(parts.query, keep_blank_values=True):
        lowered = key.lower()
        if lowered.startswith("utm_") or lowered in TRACKING_PARAMS:
            continue
        query.append((key, item))
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((parts.scheme.lower(), host, path, urllib.parse.urlencode(sorted(query)), ""))


def source_names(item: dict) -> list[str]:
    values = item.get("source", [])
    if isinstance(values, str):
        values = [values]
    values = [str(value).strip() for value in values if str(value).strip()]
    values.extend(str(value).strip() for value in item.get("also_seen_in", []) if str(value).strip())
    return list(dict.fromkeys(values))


def normalize_item(item: dict, source: str, defaults: dict | None = None) -> dict | None:
    defaults = defaults or {}
    title = str(item.get("title") or "").strip()
    url = canonical_url(item.get("url"))
    if not title or not url:
        return None
    names = source_names(item) or [source]
    result = {
        "title": title,
        "url": url,
        "published_at": iso_time(item.get("published_at")),
        "site_name": str(item.get("site_name") or defaults.get("site_name") or source),
        "source": names,
        "category": str(item.get("category") or defaults.get("category") or "ai"),
        "priority": str(item.get("priority") or defaults.get("priority") or "P2").upper(),
        "tags": list(dict.fromkeys(str(tag).strip() for tag in item.get("tags", defaults.get("tags", [])) if str(tag).strip())),
        "metadata": dict(item.get("metadata") or {}),
        "also_seen_in": list(dict.fromkeys(str(value).strip() for value in item.get("also_seen_in", []) if str(value).strip())),
    }
    if result["priority"] not in PRIORITY_ORDER:
        result["priority"] = "P2"
    return result


def entity_keys(item: dict) -> set[str]:
    keys = {f"url:{canonical_url(item.get('url'))}"}
    metadata = item.get("metadata") or {}
    repo = str(metadata.get("repository") or "").lower()
    release = str(metadata.get("release") or metadata.get("tag") or "").lower()
    match = re.search(r"github\.com/([^/]+/[^/]+)/releases/tag/([^/?#]+)", str(item.get("url", "")), re.I)
    if match:
        repo, release = match.group(1).lower(), urllib.parse.unquote(match.group(2)).lower()
    if repo and release:
        keys.add(f"release:{repo}@{release}")
    aliases = metadata.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [aliases]
    identity_text = " ".join([str(item.get("title", "")), str(metadata.get("id", "")), *map(str, aliases)])
    keys.update(f"vuln:{match.group(0).upper()}" for match in CVE_RE.finditer(identity_text))
    keys.update(f"vuln:{match.group(0).upper()}" for match in GHSA_RE.finditer(identity_text))
    return {key for key in keys if not key.endswith(":")}


def merge_pair(current: dict, incoming: dict) -> dict:
    current_priority = PRIORITY_ORDER.get(current.get("priority"), 9)
    incoming_priority = PRIORITY_ORDER.get(incoming.get("priority"), 9)
    winner, other = (incoming, current) if incoming_priority < current_priority else (current, incoming)
    merged = dict(winner)
    names = list(dict.fromkeys(source_names(winner) + source_names(other)))
    merged["source"] = names
    merged["also_seen_in"] = names[1:]
    merged["tags"] = list(dict.fromkeys(current.get("tags", []) + incoming.get("tags", [])))
    metadata = dict(current.get("metadata") or {})
    metadata.update(incoming.get("metadata") or {})
    aliases = []
    for value in [current.get("metadata", {}).get("aliases", []), incoming.get("metadata", {}).get("aliases", [])]:
        aliases.extend(value if isinstance(value, list) else [value])
    if aliases:
        metadata["aliases"] = list(dict.fromkeys(str(value).upper() for value in aliases if value))
    merged["metadata"] = metadata
    dates = [value for value in (current.get("published_at"), incoming.get("published_at")) if parse_time(value)]
    if dates:
        merged["published_at"] = max(dates, key=parse_time)
    return merged


def deduplicate(items: list[dict]) -> list[dict]:
    merged: list[dict] = []
    for item in items:
        keys = entity_keys(item)
        matching = [index for index, current in enumerate(merged) if keys & entity_keys(current)]
        if not matching:
            merged.append(item)
            continue
        combined = item
        for index in matching:
            combined = merge_pair(merged[index], combined)
        first = matching[0]
        merged[first] = combined
        for index in reversed(matching[1:]):
            del merged[index]
    merged.sort(key=lambda item: (PRIORITY_ORDER.get(item.get("priority"), 9), -(parse_time(item.get("published_at")) or dt.datetime.min.replace(tzinfo=dt.timezone.utc)).timestamp()))
    return merged


def parse_xml(payload: bytes, source: dict) -> list[dict]:
    root = ET.fromstring(payload)
    items = []
    nodes = [
        node
        for node in root.iter()
        if isinstance(node.tag, str) and node.tag.rsplit("}", 1)[-1] in {"item", "entry"}
    ]
    for node in nodes:
        values: dict[str, str] = {}
        link = ""
        for child in node:
            name = child.tag.rsplit("}", 1)[-1]
            if name == "link":
                candidate = child.attrib.get("href") or (child.text or "")
                if not link or child.attrib.get("rel", "alternate") == "alternate":
                    link = candidate
            elif name in {"title", "pubDate", "published", "updated", "id"}:
                values[name] = "".join(child.itertext()).strip()
        item = normalize_item({"title": values.get("title"), "url": link or values.get("id"), "published_at": values.get("pubDate") or values.get("published") or values.get("updated"), "tags": source.get("tags", [])}, source["name"], source)
        if item:
            repository = source.get("repository")
            if repository:
                item["metadata"]["repository"] = repository
                release_match = re.search(r"/releases/tag/([^/?#]+)", item["url"])
                if release_match:
                    item["metadata"]["release"] = urllib.parse.unquote(release_match.group(1))
            items.append(item)
    return items


def parse_aggregator(payload: bytes, source: dict) -> list[dict]:
    raw = json.loads(payload.decode("utf-8"))
    pattern = keyword_pattern(source.get("keywords", []))
    items = []
    for candidate in raw.get("items", []):
        title = candidate.get("title_zh") or candidate.get("title") or ""
        if pattern and not pattern.search(title):
            continue
        candidate = dict(candidate)
        candidate["title"] = title
        item = normalize_item(candidate, source["name"], source)
        if item:
            items.append(item)
    return items


def keyword_pattern(keywords: list[str]) -> re.Pattern | None:
    cleaned = [str(value).strip() for value in keywords if str(value).strip()]
    return re.compile("|".join(map(re.escape, cleaned)), re.I) if cleaned else None


def request_bytes(url: str, attempts: int, backoff: float, headers: dict | None = None, body: bytes | None = None) -> tuple[int, bytes, dict]:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "application/json, application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.5"}
    request_headers.update(headers or {})
    request = urllib.request.Request(url, data=body, headers=request_headers, method="POST" if body is not None else "GET")
    for attempt in range(max(1, attempts)):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, response.read(), dict(response.headers.items())
        except urllib.error.HTTPError as error:
            if error.code == 304:
                return 304, b"", dict(error.headers.items())
            retryable = error.code == 429 or 500 <= error.code < 600
            if attempt + 1 >= attempts or not retryable:
                raise
        except urllib.error.URLError:
            if attempt + 1 >= attempts:
                raise
        time.sleep(backoff * (2**attempt))
    raise RuntimeError("unreachable")


def fetch_hacker_news(source: dict, policy: dict) -> tuple[list[dict], dict]:
    base = source.get("url", "https://hacker-news.firebaseio.com/v0").rstrip("/")
    ids: list[int] = []
    headers = {}
    for listing in source.get("lists", ["top", "new"]):
        _, payload, response_headers = request_bytes(f"{base}/{listing}stories.json", policy["attempts"], policy["backoff"])
        headers.update(response_headers)
        ids.extend(json.loads(payload.decode("utf-8"))[: int(source.get("max_ids_per_list", 30))])
    ids = list(dict.fromkeys(ids))
    details = []
    workers = max(1, min(int(source.get("concurrency", 4)), 8))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(request_bytes, f"{base}/item/{item_id}.json", 1, 0) for item_id in ids]
        for future in futures:
            try:
                raw = json.loads(future.result()[1].decode("utf-8"))
                if isinstance(raw, dict):
                    details.append(raw)
            except (OSError, ValueError, TypeError):
                continue
    pattern = keyword_pattern(source.get("keywords", []))
    minimum_score = int(source.get("minimum_score", 20))
    items = []
    for raw in details:
        title = str(raw.get("title") or "")
        if not pattern or not pattern.search(title) or int(raw.get("score") or 0) < minimum_score:
            continue
        item = normalize_item({"title": title, "url": raw.get("url") or f"https://news.ycombinator.com/item?id={raw.get('id')}", "published_at": raw.get("time"), "tags": ["community"], "metadata": {"hn_id": raw.get("id"), "score": raw.get("score"), "comments": raw.get("descendants", 0)}}, source["name"], source)
        if item:
            items.append(item)
    return items, headers


def fetch_osv(source: dict, policy: dict) -> tuple[list[dict], dict]:
    queries = source.get("queries", [])
    body = json.dumps({"queries": [{"package": {"ecosystem": query["ecosystem"], "name": query["package"]}} for query in queries]}).encode()
    status, payload, headers = request_bytes(source["url"], policy["attempts"], policy["backoff"], {"Content-Type": "application/json"}, body)
    if status != 200:
        return [], headers
    results = json.loads(payload.decode("utf-8")).get("results", [])
    items = []
    for query, result in zip(queries, results):
        for vuln in result.get("vulns", []):
            vuln_id = vuln.get("id", "")
            aliases = list(dict.fromkeys([vuln_id, *vuln.get("aliases", [])]))
            title = vuln.get("summary") or f"{query['package']} 安全公告 {vuln_id}"
            item = normalize_item({"title": title, "url": f"https://osv.dev/vulnerability/{vuln_id}", "published_at": vuln.get("modified") or vuln.get("published"), "tags": ["security", query["ecosystem"], query["package"]], "metadata": {"id": vuln_id, "aliases": aliases, "ecosystem": query["ecosystem"], "package": query["package"]}}, source["name"], source)
            if item:
                items.append(item)
    return items, headers


def fetch_cisa(source: dict, policy: dict, now: dt.datetime) -> tuple[list[dict], dict]:
    _, payload, headers = request_bytes(source["url"], policy["attempts"], policy["backoff"])
    raw = json.loads(payload.decode("utf-8"))
    pattern = keyword_pattern(source.get("keywords", []))
    recent_days = int(source.get("recent_days", 14))
    cutoff = now - dt.timedelta(days=recent_days)
    items = []
    for vuln in raw.get("vulnerabilities", []):
        added = parse_time(vuln.get("dateAdded"))
        haystack = " ".join(str(vuln.get(key, "")) for key in ("vendorProject", "product", "vulnerabilityName", "shortDescription", "cveID"))
        if not ((added and added >= cutoff) or (pattern and pattern.search(haystack))):
            continue
        cve = vuln.get("cveID", "")
        item = normalize_item({"title": vuln.get("vulnerabilityName") or cve, "url": f"https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext={urllib.parse.quote(cve)}", "published_at": vuln.get("dateAdded"), "tags": ["security", "known-exploited"], "metadata": {"id": cve, "aliases": [cve], "vendor": vuln.get("vendorProject"), "product": vuln.get("product"), "due_date": vuln.get("dueDate"), "known_ransomware": vuln.get("knownRansomwareCampaignUse")}}, source["name"], source)
        if item:
            items.append(item)
    return items, headers


def fetch_regular(source: dict, policy: dict, conditional: dict) -> tuple[list[dict] | None, dict, bool]:
    headers = {}
    if conditional.get("etag"):
        headers["If-None-Match"] = conditional["etag"]
    if conditional.get("last_modified"):
        headers["If-Modified-Since"] = conditional["last_modified"]
    status, payload, response_headers = request_bytes(source["url"], policy["attempts"], policy["backoff"], headers)
    if status == 304:
        return None, response_headers, True
    parser = parse_aggregator if source["type"] == "json_aggregator" else parse_xml
    return parser(payload, source), response_headers, False


def collect_source(source: dict, cached: dict, policy: dict, now: dt.datetime) -> tuple[list[dict], dict, dict]:
    ttl = float(source.get("ttl_hours", policy["ttl_hours"]))
    global_limit = max(1, int(policy.get("source_max_items", 50)))
    configured_limit = max(1, int(source.get("max_items", global_limit)))
    source_limit = min(global_limit, configured_limit)
    fingerprint = {"source": source, "effective_max_items": source_limit}
    config_hash = hashlib.sha256(json.dumps(fingerprint, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    cache_matches = cached.get("config_hash") == config_hash
    cache_is_valid = "items" in cached and isinstance(cached["items"], list)
    cached_items = deduplicate(cached["items"] if cache_is_valid else [])[:source_limit]
    checked = parse_time(cached.get("checked_at") or cached.get("fetched_at"))
    if cache_matches and cache_is_valid and checked and now - checked <= dt.timedelta(hours=ttl):
        status = {"ok": True, "cached": True, "count": len(cached_items), "fetched_at": cached.get("fetched_at"), "checked_at": cached.get("checked_at", cached.get("fetched_at"))}
        entry = dict(cached)
        entry["items"] = cached_items
        return cached_items, status, entry
    try:
        if source["type"] == "hacker_news":
            items, headers = fetch_hacker_news(source, policy)
            not_modified = False
        elif source["type"] == "osv":
            items, headers = fetch_osv(source, policy)
            not_modified = False
        elif source["type"] == "cisa_kev":
            items, headers = fetch_cisa(source, policy, now)
            not_modified = False
        else:
            items, headers, not_modified = fetch_regular(source, policy, cached if cache_matches else {})
        if not_modified:
            items = cached_items
        items = items or []
        if not not_modified and not items and cached_items and not source.get("allow_empty", False):
            status = {
                "ok": False,
                "degraded": True,
                "cached": True,
                "count": len(cached_items),
                "error": "source returned an empty parsed result",
            }
            if cached.get("fetched_at"):
                status["fetched_at"] = cached["fetched_at"]
            fallback = dict(cached)
            fallback["items"] = cached_items
            return cached_items, status, fallback
        items = deduplicate(items)[:source_limit]
        entry = {"items": items, "fetched_at": cached.get("fetched_at") if not_modified else now.isoformat(), "checked_at": now.isoformat(), "config_hash": config_hash}
        entry["etag"] = headers.get("ETag") or headers.get("Etag") or cached.get("etag")
        entry["last_modified"] = headers.get("Last-Modified") or cached.get("last_modified")
        entry = {key: value for key, value in entry.items() if value is not None}
        status = {"ok": True, "cached": not_modified, "not_modified": not_modified, "count": len(items), "fetched_at": entry["fetched_at"], "checked_at": entry["checked_at"]}
        return items, status, entry
    except Exception as error:  # one source must never stop the others
        items = cached_items
        status = {"ok": False, "degraded": bool(items), "cached": bool(items), "count": len(items), "error": str(error)}
        if cached.get("fetched_at"):
            status["fetched_at"] = cached["fetched_at"]
        fallback = dict(cached)
        fallback["items"] = items
        return items, status, fallback


def legacy_items(previous: dict) -> list[dict]:
    cached_urls = {canonical_url(item.get("url")) for entry in previous.get("source_cache", {}).values() for item in entry.get("items", [])}
    results = []
    for raw in previous.get("items", []):
        if canonical_url(raw.get("url")) in cached_urls:
            continue
        source = source_names(raw)
        name = source[0] if source else str(raw.get("site_name") or "legacy-ai-news")
        item = normalize_item(raw, name, {"priority": raw.get("priority", "P2"), "category": raw.get("category", "ai")})
        if item:
            results.append(item)
    return results


def main() -> int:
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Failed to load config: {error}")
        return 1
    public = config.get("public_feeds", {})
    if not public.get("enabled", False):
        print("Public feed collection is disabled.")
        return 0
    try:
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        previous = {}
    policy_config = config.get("policy", {})
    policy = {"ttl_hours": float(public.get("ttl_hours", 24)), "attempts": int(public.get("retry_attempts", policy_config.get("retry_attempts", 3))), "backoff": float(public.get("retry_backoff_seconds", policy_config.get("retry_backoff_seconds", 1))), "source_max_items": max(1, int(public.get("source_max_items", 50)))}
    now = utcnow()
    statuses = {}
    cache = {}
    all_items = legacy_items(previous)
    enabled_sources = [source for source in public.get("sources", []) if source.get("enabled", True)]
    workers = max(1, min(int(public.get("concurrency", 4)), 8, len(enabled_sources) or 1))
    results: dict[str, tuple[list[dict], dict, dict]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                collect_source,
                source,
                previous.get("source_cache", {}).get(source["name"], {}),
                policy,
                now,
            ): source["name"]
            for source in enabled_sources
        }
        for future in concurrent.futures.as_completed(futures):
            results[futures[future]] = future.result()
    for source in enabled_sources:
        items, status, entry = results[source["name"]]
        statuses[source["name"]] = status
        if entry:
            cache[source["name"]] = entry
        all_items.extend(items)
    total_limit = max(1, int(public.get("max_items", 200)))
    final_items = deduplicate(all_items)[:total_limit]
    output = {"generated_at": now.isoformat(), "items": final_items, "source_status": statuses, "source_cache": cache, "schema_version": 2}
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failures = sum(not status["ok"] for status in statuses.values())
    print(f"Collected {len(final_items)} public feed items from {len(statuses)} sources ({failures} degraded/failed).")
    return 0 if final_items or not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
