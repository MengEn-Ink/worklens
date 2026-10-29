#!/usr/bin/env python3
"""收口 Issue 请求账本与 CI 执行器。

背景：Loop 沙箱使用的 fine-grained PAT 通常只有 contents 写权限，
GitHub 对 Issue 评论 / 关闭接口返回 403；即便 PR 描述带 Closes 关键字，
由该令牌合并时服务端也不会自动关单。本账本把「需要关闭哪个 Issue、
为什么、证据在哪」沉淀在公开仓库内，由 GitHub Actions 内置的
GITHUB_TOKEN（workflow 显式声明 issues: write）执行关闭，全程不接触
任何私有凭证。

- data/issue-close-requests.json：只登记公开可披露的收口请求；
- validate：离线契约校验，CI 强制，脚本不访问网络；
- apply：只在 CI 中运行，逐条幂等处理，已关闭的 Issue 跳过。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "issue-close-requests.json"
API = "https://api.github.com"
SCHEMA = 1

ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
TIMESTAMP_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$"
)
EVIDENCE_REF_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_./-]{2,128}$")
INTERNAL_HOST_PATTERN = re.compile(
    r"\b(?:[a-z0-9-]+\.)+(?:byted\.org|bytedance\.net|larkoffice\.com|feishu\.cn)\b",
    re.IGNORECASE,
)
GITHUB_TOKEN_PATTERN = re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,})")
URL_CREDENTIAL_PATTERN = re.compile(
    r"[?&](?:access_token|api_key|apikey|token|secret|password|signature|sig|authkey)="
    r"[^\s\"'&<>#]{6,}",
    re.IGNORECASE,
)

TITLE_MAX = 200
REASON_MAX = 500


def load(path: Path = DATA) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_text(field: str, value, max_len: int, errors: list[str], label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}: {field} 必须是非空字符串")
        return
    if len(value) > max_len:
        errors.append(f"{label}: {field} 长度不能超过 {max_len}")
    if GITHUB_TOKEN_PATTERN.search(value) or URL_CREDENTIAL_PATTERN.search(value):
        errors.append(f"{label}: {field} 不允许包含凭证")
    if INTERNAL_HOST_PATTERN.search(value):
        errors.append(f"{label}: {field} 不允许包含内网地址")


def validate_request(request, index: int, seen: set[int], errors: list[str]) -> None:
    label = f"requests[{index}]"
    if not isinstance(request, dict):
        errors.append(f"{label}: 必须是对象")
        return
    issue = request.get("issue")
    if not isinstance(issue, int) or isinstance(issue, bool) or issue <= 0:
        errors.append(f"{label}: issue 必须是正整数")
    elif issue in seen:
        errors.append(f"{label}: issue #{issue} 重复登记")
    else:
        seen.add(issue)
    validate_text("title", request.get("title"), TITLE_MAX, errors, label)
    validate_text("reason", request.get("reason"), REASON_MAX, errors, label)
    requester = request.get("requested_by")
    if not ID_PATTERN.match(requester or ""):
        errors.append(f"{label}: requested_by 必须是 slug（小写字母、数字、连字符）")
    requested_at = request.get("requested_at")
    if not TIMESTAMP_PATTERN.match(requested_at or ""):
        errors.append(f"{label}: requested_at 必须是 RFC3339 时间戳")
    evidence_ref = request.get("evidence_ref")
    if not isinstance(evidence_ref, str) or not EVIDENCE_REF_PATTERN.match(evidence_ref):
        errors.append(f"{label}: evidence_ref 必须是仓库内安全相对路径")
    elif ".." in evidence_ref.split("/"):
        errors.append(f"{label}: evidence_ref 不允许目录回溯")


def validate(data: dict) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != SCHEMA:
        errors.append("schema_version 必须是 1")
    policy = data.get("policy", {})
    if not isinstance(policy, dict):
        errors.append("policy 必须是对象")
    else:
        if policy.get("public_only") is not True:
            errors.append("policy.public_only 必须为 true")
        if policy.get("close_via_ci_only") is not True:
            errors.append("policy.close_via_ci_only 必须为 true")
    requests = data.get("requests")
    if not isinstance(requests, list) or not requests:
        errors.append("requests 必须是非空数组")
        return errors
    seen: set[int] = set()
    for index, request in enumerate(requests):
        validate_request(request, index, seen, errors)
    return errors


def render_comment(request: dict) -> str:
    """渲染关闭 Issue 时的公开评论（只含可公开事实）。"""
    return (
        "## WorkLens Loop 收口\n\n"
        f"- 标题：{request['title'].strip()}\n"
        f"- 收口原因：{request['reason'].strip()}\n"
        f"- 验收证据：`{request['evidence_ref']}`（main 最新轮次记录）\n"
        f"- 登记时间（UTC）：{request['requested_at']}\n"
        f"- 登记人：{request['requested_by']}\n\n"
        "本 Issue 由 GitHub Actions 内置 GITHUB_TOKEN（仅授予 issues: write）"
        "依据仓库内 `data/issue-close-requests.json` 关闭；"
        "Loop 沙箱令牌无 Issues 写权限，不使用任何私有凭证。"
    )


def github_request(method: str, url: str, token: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "worklens-loop-ci",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def apply_requests(requests: list[dict], repo: str, token: str, reporter=print) -> int:
    """幂等关闭：已关闭 / 计划外状态跳过；任一写操作失败则整体失败。"""
    for request in requests:
        issue = request["issue"]
        url = f"{API}/repos/{repo}/issues/{issue}"
        detail = github_request("GET", url, token)
        state = detail.get("state")
        if state != "open":
            reporter(f"跳过 #{issue}：当前状态 {state}")
            continue
        github_request("POST", f"{url}/comments", token, {"body": render_comment(request)})
        github_request("PATCH", url, token, {"state": "closed", "state_reason": "completed"})
        reporter(f"已关闭 #{issue}：{request['title']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "apply"], help="离线校验或在 CI 中执行关闭")
    parser.add_argument("--dry-run", action="store_true", help="apply 的演练模式，只打印计划不发请求")
    args = parser.parse_args(argv)

    data = load()
    errors = validate(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    requests = data["requests"]
    if args.command == "validate":
        print(f"issue-close-requests valid: {len(requests)} requests")
        return 0

    repo = os.environ.get("GITHUB_REPOSITORY", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", repo) or not token:
        print("apply 只能在 GitHub Actions 中运行，需要 GITHUB_REPOSITORY 与 GITHUB_TOKEN", file=sys.stderr)
        return 2
    if args.dry_run:
        for request in requests:
            print(f"计划关闭 #{request['issue']}：{request['title']}")
        return 0
    try:
        return apply_requests(requests, repo, token)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"GitHub API 返回 {error.code}：{detail}", file=sys.stderr)
        return 1
    except (urllib.error.URLError, OSError, ValueError) as error:
        print(f"关闭 Issue 失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
