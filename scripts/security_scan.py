#!/usr/bin/env python3
"""仓库敏感信息扫描：高置信密钥、内网域名与 URL 凭证参数。

只扫描 git 已跟踪的文本文件；命中规则即失败，误报通过
config/security-scan-allow.json 精确登记（文件 + 规则 + 行内容片段）。
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST_PATH = ROOT / "config" / "security-scan-allow.json"
TEXT_SUFFIXES = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".yml", ".yaml",
    ".html", ".css", ".txt", ".sh", ".toml", ".xml", ".csv", ".env.example",
}


class Rule(NamedTuple):
    key: str
    description: str
    pattern: re.Pattern


RULES = (
    Rule("aws_access_key", "AWS Access Key", re.compile(r"AKIA[0-9A-Z]{16}")),
    Rule(
        "github_token",
        "GitHub Token / PAT",
        re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,})"),
    ),
    Rule("slack_token", "Slack Token", re.compile(r"xox[baprs]-[0-9A-Za-z-]{10,}")),
    Rule("npm_token", "npm Token", re.compile(r"\bnpm_[A-Za-z0-9]{36}\b")),
    Rule("private_key", "私钥块", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    Rule(
        "jwt",
        "JWT",
        re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"),
    ),
    Rule(
        "internal_host",
        "公司内网域名",
        re.compile(
            r"\b(?:[a-z0-9-]+\.)+(?:byted\.org|bytedance\.net|larkoffice\.com|feishu\.cn)\b",
            re.IGNORECASE,
        ),
    ),
    Rule(
        "url_credential_param",
        "URL 查询参数中的凭证",
        re.compile(
            r"[?&](?:access_token|api_key|apikey|token|secret|password|signature|sig|authkey)"
            r"=[^\s\"'&<>#]{6,}",
            re.IGNORECASE,
        ),
    ),
    Rule(
        "basic_auth_url",
        "URL 内嵌账号密码",
        re.compile(r"https?://[^\s/@:'\"]+:[^\s/@'\"]+@[^\s/'\"]+"),
    ),
)


def tracked_files() -> list[Path]:
    output = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    files = []
    for line in output.splitlines():
        path = ROOT / line
        if path.resolve() == ALLOWLIST_PATH.resolve():
            continue
        if not path.is_file():
            continue
        suffix = "".join(path.suffixes[-2:]) if path.name.endswith(".env.example") else path.suffix
        if suffix.lower() in TEXT_SUFFIXES:
            files.append(path)
    return files


def load_allowlist() -> list[dict]:
    if not ALLOWLIST_PATH.exists():
        return []
    data = json.loads(ALLOWLIST_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("security-scan-allow.json 必须是数组")
    return data


def is_allowed(rel_path: str, rule_key: str, line: str, allowlist: list[dict]) -> bool:
    for item in allowlist:
        if item.get("path") != rel_path or item.get("rule") != rule_key:
            continue
        fragment = item.get("contains", "")
        if not fragment or fragment in line:
            return True
    return False


def scan(files: list[Path], allowlist: list[dict]) -> list[str]:
    findings = []
    for path in files:
        rel_path = str(path.relative_to(ROOT))
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for line_number, line in enumerate(lines, 1):
            for rule in RULES:
                match = rule.pattern.search(line)
                if match and not is_allowed(rel_path, rule.key, line, allowlist):
                    findings.append(f"{rel_path}:{line_number} [{rule.key}] {rule.description}")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="（默认即严格，预留）")
    args = parser.parse_args()
    del args

    allowlist = load_allowlist()
    findings = scan(tracked_files(), allowlist)
    if findings:
        print(f"✗ 敏感信息扫描发现 {len(findings)} 处命中：", file=sys.stderr)
        for finding in findings:
            print(f"  {finding}", file=sys.stderr)
        print("如确属公开测试夹具，请在 config/security-scan-allow.json 精确登记。", file=sys.stderr)
        return 1
    print("敏感信息扫描通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
