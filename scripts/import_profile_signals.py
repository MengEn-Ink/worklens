#!/usr/bin/env python3
"""把本地工作信号聚合为可公开提交的脱敏画像，不保存原文。"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ALLOWED_SOURCES = {"meeting", "lark_doc", "podcast", "article", "repository"}
ALLOWED_INPUT_FIELDS = {"source_type", "occurred_at", "topics", "evidence", "duration_minutes"}


def evidence_hash(value: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()[:16]


def parse_record(raw: dict, line_number: int, salt: str) -> dict:
    unknown = set(raw) - ALLOWED_INPUT_FIELDS
    if unknown:
        raise ValueError(f"第 {line_number} 行包含禁止字段：{', '.join(sorted(unknown))}")
    source_type = raw.get("source_type")
    if source_type not in ALLOWED_SOURCES:
        raise ValueError(f"第 {line_number} 行 source_type 不受支持")
    topics = raw.get("topics")
    if not isinstance(topics, list) or not topics or not all(isinstance(item, str) for item in topics):
        raise ValueError(f"第 {line_number} 行 topics 必须是非空字符串数组")
    occurred_at = raw.get("occurred_at")
    try:
        timestamp = dt.datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as error:
        raise ValueError(f"第 {line_number} 行 occurred_at 不是 ISO 8601 时间") from error
    evidence = raw.get("evidence")
    if not isinstance(evidence, str) or not evidence.strip():
        raise ValueError(f"第 {line_number} 行 evidence 不能为空")
    duration = raw.get("duration_minutes", 0)
    if not isinstance(duration, (int, float)) or duration < 0:
        raise ValueError(f"第 {line_number} 行 duration_minutes 非法")
    return {
        "source_type": source_type,
        "occurred_at": timestamp.astimezone(dt.timezone.utc),
        "topics": sorted({topic.strip().lower() for topic in topics if topic.strip()}),
        "evidence_hash": evidence_hash(evidence, salt),
        "duration_minutes": round(float(duration), 2),
    }


def aggregate(records: list[dict]) -> dict:
    topic_counts = Counter()
    sources = defaultdict(lambda: {"count": 0, "duration_minutes": 0.0, "latest_at": None})
    evidence_hashes = []
    for record in records:
        topic_counts.update(record["topics"])
        source = sources[record["source_type"]]
        source["count"] += 1
        source["duration_minutes"] += record["duration_minutes"]
        iso = record["occurred_at"].isoformat()
        if source["latest_at"] is None or iso > source["latest_at"]:
            source["latest_at"] = iso
        evidence_hashes.append(record["evidence_hash"])
    return {
        "schema_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "privacy": {
            "raw_content_stored": False,
            "titles_stored": False,
            "urls_stored": False,
            "evidence_hashed": True,
        },
        "summary": {
            "record_count": len(records),
            "sources": dict(sorted(sources.items())),
            "topics": [
                {"topic": topic, "count": count}
                for topic, count in topic_counts.most_common(50)
            ],
            "evidence_hashes": sorted(set(evidence_hashes)),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="本地 JSONL 文件；不得提交到仓库")
    parser.add_argument("--output", type=Path, default=Path("data/profile-signals.json"))
    parser.add_argument("--salt", required=True, help="本地散列盐；不要提交")
    args = parser.parse_args()

    records = []
    for line_number, line in enumerate(args.input.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            records.append(parse_record(json.loads(line), line_number, args.salt))
    result = aggregate(records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已聚合 {len(records)} 条记录；未保存标题、URL 或原文")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
