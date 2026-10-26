#!/usr/bin/env python3
"""Collect AI news from upstream aggregator for WorkLens."""

from __future__ import annotations

import datetime as dt
import json
import re
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


def fetch_json(url: str) -> dict:
    headers = {"Accept": "application/json", "User-Agent": "worklens-collector/1.0"}
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


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

    keywords = [k.lower() for k in news_config.get("keywords", [])]
    max_items = news_config.get("max_items", 50)

    status = {"ok": True, "source": url}
    try:
        payload = fetch_json(url)
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
            "generated_at": utcnow().isoformat(),
            "items": final_items,
            "source_status": {url: {"ok": True, "count": len(final_items)}},
            "schema_version": 1,
        }

        OUTPUT_PATH.write_text(
            json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Collected {len(final_items)} AI news items.")

    except Exception as e:
        print(f"Failed to collect AI news: {e}")
        # Preserve old file if possible but update status
        previous = {}
        if OUTPUT_PATH.exists():
            try:
                previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass

        status["ok"] = False
        status["error"] = str(e)

        output = {
            "generated_at": utcnow().isoformat(),
            "items": previous.get("items", []),
            "source_status": {url: status},
            "schema_version": 1,
        }
        OUTPUT_PATH.write_text(
            json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return 1

    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
