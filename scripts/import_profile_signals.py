#!/usr/bin/env python3
"""把本地工作信号聚合为可公开提交的脱敏画像，不保存原文。"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from collections import Counter, defaultdict
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from xml.etree import ElementTree

ALLOWED_SOURCES = {"meeting", "lark_doc", "podcast", "article", "repository", "rss"}
ALLOWED_INPUT_FIELDS = {"source_type", "occurred_at", "topics", "evidence", "duration_minutes"}
DEFAULT_OUTPUT = Path("data/profile-signals.json")
TOPIC_KEYWORDS = {
    "agent": {"agent", "agents", "ai", "llm", "prompt", "智能体", "模型"},
    "automation": {"automation", "workflow", "workflows", "自动化", "工作流", "zapier"},
    "design": {"design", "ux", "ui", "设计", "figma"},
    "frontend": {"frontend", "react", "vue", "css", "前端", "javascript", "typescript"},
    "backend": {"backend", "api", "server", "golang", "python", "infra", "后端"},
    "productivity": {"productivity", "效率", "knowledge", "笔记", "管理"},
}
PODCAST_MARKERS = {
    "podcast",
    "podcasts",
    "播客",
    "itunes",
    "megaphone",
    "simplecast",
    "transistor",
    "buzzsprout",
    "captivate",
    "podbean",
    "libsyn",
    "anchor",
    "audioboom",
    "feeds.fm",
}


def evidence_hash(value: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()[:16]


def parse_timestamp(value: str, line_number: int | None = None) -> dt.datetime:
    if not isinstance(value, str) or not value.strip():
        prefix = f"第 {line_number} 行 " if line_number is not None else ""
        raise ValueError(f"{prefix}occurred_at 不是有效时间")
    candidate = value.strip()
    try:
        timestamp = dt.datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        try:
            timestamp = parsedate_to_datetime(candidate)
        except (TypeError, ValueError) as error:
            prefix = f"第 {line_number} 行 " if line_number is not None else ""
            raise ValueError(f"{prefix}occurred_at 不是 ISO 8601 或 RFC 822 时间") from error
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=dt.timezone.utc)
    return timestamp.astimezone(dt.timezone.utc)


def canonicalize_evidence(value: str) -> str:
    try:
        parts = urlsplit(value.strip())
    except ValueError as error:
        raise ValueError("订阅地址不是合法 URL") from error
    if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
        raise ValueError("订阅地址必须是 http/https URL")
    port = ""
    if parts.port and not (
        (parts.scheme.lower() == "http" and parts.port == 80)
        or (parts.scheme.lower() == "https" and parts.port == 443)
    ):
        port = f":{parts.port}"
    path = parts.path or "/"
    return urlunsplit((parts.scheme.lower(), f"{parts.hostname.lower()}{port}", path, "", ""))


def tokenize(value: str) -> list[str]:
    return [token for token in re.split(r"[^0-9A-Za-z\u4e00-\u9fff+#]+", value.lower()) if token]


def infer_topics(labels: list[str], source_type: str) -> list[str]:
    normalized = " ".join(filter(None, labels)).lower()
    topics = {source_type, "subscription"}
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            topics.add(topic)
    return sorted(topics)


def detect_source_type(mode: str, labels: list[str], xml_url: str) -> str:
    if mode != "auto":
        return mode
    normalized = " ".join(filter(None, labels + [xml_url])).lower()
    if any(marker in normalized for marker in PODCAST_MARKERS):
        return "podcast"
    return "rss"


def parse_categories(raw: str | None) -> list[str]:
    if not raw:
        return []
    values = []
    for item in raw.split(","):
        token = item.strip().strip("/")
        if not token:
            continue
        values.extend(part for part in token.split("/") if part)
    return values


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
    timestamp = parse_timestamp(raw.get("occurred_at"), line_number)
    evidence = raw.get("evidence")
    if not isinstance(evidence, str) or not evidence.strip():
        raise ValueError(f"第 {line_number} 行 evidence 不能为空")
    duration = raw.get("duration_minutes", 0)
    if not isinstance(duration, (int, float)) or duration < 0:
        raise ValueError(f"第 {line_number} 行 duration_minutes 非法")
    return {
        "source_type": source_type,
        "occurred_at": timestamp,
        "topics": sorted({topic.strip().lower() for topic in topics if topic.strip()}),
        "evidence_hash": evidence_hash(evidence, salt),
        "duration_minutes": round(float(duration), 2),
    }


def parse_jsonl_records(path: Path, salt: str) -> list[dict]:
    records = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            records.append(parse_record(json.loads(line), line_number, salt))
    return records


def parse_opml_timestamp(root: ElementTree.Element) -> dt.datetime:
    head = root.find("head")
    for tag in ("dateModified", "dateCreated"):
        if head is None:
            break
        node = head.find(tag)
        if node is not None and node.text:
            return parse_timestamp(node.text)
    return dt.datetime.now(dt.timezone.utc)


def build_opml_record(node: ElementTree.Element, ancestors: list[str], timestamp: dt.datetime, salt: str, source_mode: str) -> dict:
    label = (node.attrib.get("title") or node.attrib.get("text") or "").strip()
    categories = parse_categories(node.attrib.get("category"))
    xml_url = canonicalize_evidence(node.attrib.get("xmlUrl") or node.attrib.get("xmlurl") or "")
    source_type = detect_source_type(source_mode, ancestors + categories + [label], xml_url)
    topics = infer_topics(ancestors + categories + [label, node.attrib.get("description") or ""], source_type)
    return {
        "source_type": source_type,
        "occurred_at": timestamp,
        "topics": topics,
        "evidence_hash": evidence_hash(xml_url, salt),
        "duration_minutes": 0.0,
    }


def walk_opml_outline(node: ElementTree.Element, ancestors: list[str], timestamp: dt.datetime, salt: str, source_mode: str) -> list[dict]:
    label = (node.attrib.get("title") or node.attrib.get("text") or "").strip()
    next_ancestors = ancestors + ([label] if label else [])
    records = []
    xml_url = node.attrib.get("xmlUrl") or node.attrib.get("xmlurl")
    if xml_url:
        records.append(build_opml_record(node, ancestors, timestamp, salt, source_mode))
    for child in node.findall("outline"):
        records.extend(walk_opml_outline(child, next_ancestors, timestamp, salt, source_mode))
    return records


def parse_opml_records(path: Path, salt: str, source_mode: str) -> list[dict]:
    try:
        root = ElementTree.parse(path).getroot()
    except ElementTree.ParseError as error:
        raise ValueError("OPML 文件无法解析，请先修复 XML 结构") from error
    if root.tag.lower() != "opml":
        raise ValueError("输入文件不是 OPML")
    body = root.find("body")
    if body is None:
        raise ValueError("OPML 缺少 body")
    timestamp = parse_opml_timestamp(root)
    records = []
    for outline in body.findall("outline"):
        records.extend(walk_opml_outline(outline, [], timestamp, salt, source_mode))
    if not records:
        raise ValueError("OPML 中未找到任何订阅节点")
    return records


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


def detect_input_format(path: Path, mode: str) -> str:
    if mode != "auto":
        return mode
    if path.suffix.lower() in {".opml", ".xml"}:
        return "opml"
    return "jsonl"


def load_records(path: Path, salt: str, input_format: str, source_mode: str) -> list[dict]:
    if input_format == "opml":
        return parse_opml_records(path, salt, source_mode)
    return parse_jsonl_records(path, salt)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="本地 JSONL 或 OPML 文件；不得提交到仓库")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--salt", required=True, help="本地散列盐；不要提交")
    parser.add_argument("--input-format", choices=["auto", "jsonl", "opml"], default="auto")
    parser.add_argument("--source-type", choices=["auto", "rss", "podcast"], default="auto")
    args = parser.parse_args()

    input_format = detect_input_format(args.input, args.input_format)
    records = load_records(args.input, args.salt, input_format, args.source_type)
    result = aggregate(records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已聚合 {len(records)} 条记录；未保存标题、URL 或原文")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
