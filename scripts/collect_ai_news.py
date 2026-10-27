#!/usr/bin/env python3
"""Collect AI news from upstream aggregator for WorkLens."""

from __future__ import annotations

import datetime as dt
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "sources.json"
OUTPUT_PATH = ROOT / "data" / "ai-news.json"


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_time(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        # Standard ISO format with Z or offset
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except ValueError:
        return None


def is_fresh(value: str | None, hours: float, now: dt.datetime) -> bool:
    timestamp = parse_time(value)
    return timestamp is not None and now - timestamp <= dt.timedelta(hours=hours)


def is_retryable(error: BaseException) -> bool:
    return (
        not isinstance(error, urllib.error.HTTPError)
        or error.code == 429
        or 500 <= error.code < 600
    )


def fetch_json(url: str, attempts: int = 3, backoff_seconds: float = 1.0) -> dict:
    headers = {"Accept": "application/json", "User-Agent": "worklens-collector/1.0"}
    request = urllib.request.Request(url, headers=headers)
    attempts = max(1, attempts)
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except (urllib.error.URLError, urllib.error.HTTPError) as error:
            if attempt + 1 >= attempts or not is_retryable(error):
                raise
            time.sleep(backoff_seconds * (2**attempt))
    raise RuntimeError("unreachable")


def read_previous() -> dict:
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"Failed to load config: {e}")
        return 1

    news_config = config.get("ai_news", {})
    if not news_config.get("enabled", False):
        print("AI news collection is disabled.")
        return 0

    url = news_config.get("url")
    if not url:
        print("AI news URL not configured.")
        return 1

    now = utcnow()
    previous = read_previous()
    previous_status = previous.get("source_status", {}).get(url, {})
    fetched_at = previous_status.get("fetched_at") or previous.get("generated_at")
    cache_hours = float(news_config.get("cache_hours", 24))
    if previous.get("items") and is_fresh(fetched_at, cache_hours, now):
        previous["source_status"] = {
            url: {
                "ok": True,
                "cached": True,
                "count": len(previous["items"]),
                "fetched_at": fetched_at,
            }
        }
        OUTPUT_PATH.write_text(
            json.dumps(previous, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Reused {len(previous['items'])} cached AI news items.")
        return 0

    keywords = [k.lower() for k in news_config.get("keywords", [])]
    max_items = news_config.get("max_items", 50)
    attempts = int(news_config.get("retry_attempts", config.get("policy", {}).get("retry_attempts", 3)))
    backoff = float(news_config.get("retry_backoff_seconds", config.get("policy", {}).get("retry_backoff_seconds", 1)))

    status = {"ok": True, "source": url}
    try:
        payload = fetch_json(url, attempts=attempts, backoff_seconds=backoff)
        raw_items = payload.get("items", [])

        filtered_items = []
        seen_urls = set()

        # Keyword pattern for better matching
        pattern = None
        if keywords:
            pattern = re.compile(r"|".join(map(re.escape, keywords)), re.IGNORECASE)

        for item in raw_items:
            link = item.get("url")
            if not link or link in seen_urls:
                continue

            # We prefer bilingual or Chinese title if available
            title = item.get("title_zh") or item.get("title") or ""
            if not title:
                continue

            if pattern and not pattern.search(title):
                continue

            seen_urls.add(link)

            # Normalize item for WorkLens
            normalized = {
                "title": title,
                "url": link,
                "published_at": item.get("published_at"),
                "site_name": item.get("site_name"),
                "source": item.get("source"),
            }
            filtered_items.append(normalized)

        # Sort by published_at desc
        filtered_items.sort(
            key=lambda x: parse_time(x["published_at"])
            or dt.datetime.min.replace(tzinfo=dt.timezone.utc),
            reverse=True,
        )

        # Limit items
        final_items = filtered_items[:max_items]

        output = {
            "generated_at": now.isoformat(),
            "items": final_items,
            "source_status": {
                url: {
                    "ok": True,
                    "count": len(final_items),
                    "fetched_at": now.isoformat(),
                }
            },
            "schema_version": 1,
        }

        OUTPUT_PATH.write_text(
            json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Collected {len(final_items)} AI news items.")

    except Exception as e:
        print(f"Failed to collect AI news: {e}")
        # Preserve old file if possible but update status. Keep the last real
        # successful fetch time so repeated failures never extend the TTL.
        old_items = previous.get("items", [])
        status["ok"] = False
        status["degraded"] = bool(old_items)
        status["cached"] = bool(old_items)
        status["count"] = len(old_items)
        status["error"] = str(e)
        if fetched_at:
            status["fetched_at"] = fetched_at

        output = {
            "generated_at": now.isoformat(),
            "items": old_items,
            "source_status": {url: status},
            "schema_version": 1,
        }
        OUTPUT_PATH.write_text(
            json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return 0 if old_items else 1

    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
