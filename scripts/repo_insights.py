#!/usr/bin/env python3
"""仓库深度解读缓存：一次解读，按 README 指纹复用。

为 data/discoveries.json 里的每个仓库生成结构化「深度解读」并写入
data/repo-insights.json，页面只读这份缓存：

- 设计场景 / 解决的痛点 / 优点 / 能帮你做什么 / 设计思路 / 架构特点 / 注意事项 / 快速上手；
- 每条结论都带来源标记：readme（README 原文摘录）、facts（GitHub 实测元数据）、
  inferred（由话题与目录结构推断）、editor（人工精读）、llm（模型解读）；
- 缓存键 = full_name + README blob sha + schema 版本。README 没变就不重读、不重解读；
  只在仓库有新推送且距上次核对超过 recheck_hours，或超过 max_age_days 时，才花 1 次请求核对指纹；
- 去重：README 指纹相同的仓库（镜像、模板复制）共用同一份解读；
- 人工精读（method=editor）永不被机器覆盖，README 变化时只打上 readme_changed 标记；
- 可选模型解读：设置 WORKLENS_LLM_BASE_URL / WORKLENS_LLM_API_KEY / WORKLENS_LLM_MODEL 后，
  每轮最多 max_llm_per_run 个新仓库，只发送 ≤ digest_chars 的压缩摘要，不发送 README 全文。

只读公开 API，不克隆、不执行仓库代码。
"""

from __future__ import annotations

import argparse
import base64
import http.client
import datetime as dt
import importlib.util
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DISCOVERIES_PATH = ROOT / "data" / "discoveries.json"
OUTPUT_PATH = ROOT / "data" / "repo-insights.json"
CONFIG_PATH = ROOT / "config" / "sources.json"
API = "https://api.github.com"
SCHEMA = 1
METHODS = {"editor", "llm", "readme"}
ORIGINS = {"readme", "facts", "inferred", "editor", "llm"}
FIELDS = ("scenario", "pain_points", "strengths", "helps_you", "design", "caveats")
DEFAULTS = {
    "max_new_per_run": 120,
    "recheck_hours": 72,
    "max_age_days": 21,
    "prune_after_days": 45,
    "max_llm_per_run": 20,
    "digest_chars": 2400,
    "request_interval_seconds": 0.2,
}


# ---------------------------------------------------------------- 基础工具

def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(value: dt.datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_time(value: object) -> dt.datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)).astimezone(dt.timezone.utc)


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback


def load_settings() -> dict:
    config = load_json(CONFIG_PATH, {})
    settings = dict(DEFAULTS)
    settings.update((config.get("insights") or {}) if isinstance(config, dict) else {})
    return settings


def _load_security_rules():
    path = ROOT / "scripts" / "security_scan.py"
    try:
        spec = importlib.util.spec_from_file_location("worklens_security_scan", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return [rule.pattern for rule in module.RULES]
    except Exception:  # noqa: BLE001 - 扫描器缺失时退回最小规则
        return [re.compile(r"(?:gh[pousr]_|github_pat_|sk-)[A-Za-z0-9_]{16,}")]


SENSITIVE = _load_security_rules()


def safe_text(text: str) -> bool:
    return not any(pattern.search(text) for pattern in SENSITIVE)


def request(path: str, accept: str = "application/vnd.github+json"):
    headers = {"Accept": accept, "User-Agent": "worklens-insights/1.0", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(f"{API}{path}", headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in (404, 451):
                return None
            last = error
            if error.code not in (403, 429) and error.code < 500:
                raise
        except (urllib.error.URLError, http.client.HTTPException, OSError, ValueError) as error:
            last = error
        time.sleep(1.5 * (2**attempt))
    raise last  # type: ignore[misc]


# ---------------------------------------------------------------- README 解析

BADGE = re.compile(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)|!\[[^\]]*\]\([^)]*\)")
LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
REF_BADGE = re.compile(r"!?\[!?\[[^\]]*\]\[[^\]]*\]\]\[[^\]]*\]|!\[[^\]]*\]\[[^\]]*\]")
REF_LINK = re.compile(r"\[([^\]]+)\]\[[^\]]*\]")
REF_DEF = re.compile(r"^\s*\[[^\]]+\]:\s*\S+")
HTML = re.compile(r"<[^>]+>")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
BULLET = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+(.*)")
EMOJI = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200d]")

SECTION_KINDS = {
    "features": re.compile(r"feature|highlight|capabilit|what (it|can)|why .*(use|choose)|benefit|key |特性|功能|亮点|优势|能力", re.I),
    "why": re.compile(r"\bwhy\b|motivation|problem|background|the idea|philosophy|背景|动机|为什么|初衷|痛点", re.I),
    "how": re.compile(r"how it works|architecture|design|overview|under the hood|concept|internals|原理|架构|设计|工作方式", re.I),
    "usecases": re.compile(r"use ?case|example|scenario|who is (this|it) for|for whom|适用|场景|案例", re.I),
    "install": re.compile(r"install|quick ?start|getting started|setup|usage|安装|快速开始|上手|使用", re.I),
}
PAIN_CUES = re.compile(r"tired of|without|instead of|no more|problem|struggl|pain|hard to|difficult|tedious|manual|waste|frustrat|costly|slow|痛点|麻烦|繁琐|难以|费时", re.I)


def clean_inline(text: str) -> str:
    text = BADGE.sub("", text)
    text = REF_BADGE.sub("", text)
    text = LINK.sub(r"\1", text)
    text = REF_LINK.sub(r"\1", text)
    text = HTML.sub("", text)
    text = EMOJI.sub("", text)
    text = re.sub(r"[*_`~]{1,3}", "", text)
    text = re.sub(r"\s+", " ", text).strip(" -:|>")
    return text.strip()


def clip(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0] if " " in text[:limit] else text[:limit]
    return cut.rstrip(",;:，；：") + "…"


def parse_readme(markdown: str) -> dict:
    """把 README 拆成 {title, intro, sections:[{title, kind, paragraphs, bullets, code}]}。"""
    sections: list[dict] = []
    current = {"title": "", "kind": "intro", "paragraphs": [], "bullets": [], "code": []}
    in_code = False
    code_lines: list[str] = []
    paragraph: list[str] = []

    def flush_paragraph():
        if paragraph:
            text = clean_inline(" ".join(paragraph))
            if len(text) >= 24 and not text.lower().startswith(("table of contents", "contents")):
                current["paragraphs"].append(text)
            paragraph.clear()

    for raw in markdown.replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        if line.strip().startswith(("```", "~~~")):
            if in_code:
                current["code"].append("\n".join(code_lines).strip())
                code_lines = []
            else:
                flush_paragraph()
            in_code = not in_code
            continue
        if in_code:
            code_lines.append(line)
            continue
        heading = HEADING.match(line)
        if heading:
            flush_paragraph()
            sections.append(current)
            title = clean_inline(heading.group(2))
            kind = next((key for key, pattern in SECTION_KINDS.items() if pattern.search(title)), "other")
            current = {"title": title, "kind": kind, "paragraphs": [], "bullets": [], "code": []}
            continue
        bullet = BULLET.match(line)
        if bullet:
            flush_paragraph()
            body = bullet.group(1).strip()
            # 目录项 / 纯链接 / 纯徽章不是要点
            if re.fullmatch(r"\[[^\]]+\]\([^)]*\)[.,;:]?", body) or re.fullmatch(r"(?:!?\[[^\]]*\]\([^)]*\)\s*)+", body):
                continue
            text = clean_inline(body)
            if is_point(text):
                current["bullets"].append(text)
            continue
        if not line.strip() or REF_DEF.match(line) or line.strip().startswith(("|", "<!--", "---", "===")):
            flush_paragraph()
            continue
        paragraph.append(line.strip())
    flush_paragraph()
    sections.append(current)
    sections = [section for section in sections if section["paragraphs"] or section["bullets"] or section["code"]]
    intro = ""
    for section in sections[:4]:
        for text in section["paragraphs"]:
            if is_prose(text):
                intro = text
                break
        if intro:
            break
    return {"intro": intro, "sections": sections}


def is_point(text: str) -> bool:
    """像一条要点：英文 ≥ 4 个词或中文 ≥ 8 字，且不是纯标题式短语。"""
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    words = len(re.findall(r"[A-Za-z][A-Za-z'-]+", text))
    if cjk >= 8:
        return True
    return words >= 5 and len(text) >= 28


def is_prose(text: str) -> bool:
    """像一句正常介绍：不是语言切换条、徽章残留、链接堆或目录。"""
    if len(text) < 40 or re.search(r"https?://", text):
        return False
    if text.count("·") + text.count("|") + text.count("•") >= 3:
        return False
    words = re.findall(r"[A-Za-z]{2,}|[\u4e00-\u9fff]", text)
    if len(words) < 8:
        return False
    letters = sum(ch.isalpha() for ch in text)
    return letters / max(len(text), 1) > 0.6


def section_items(parsed: dict, kind: str, limit: int, prefer: str = "bullets") -> list[str]:
    out: list[str] = []
    for section in parsed["sections"]:
        if section["kind"] != kind:
            continue
        pool = section[prefer] + section["paragraphs" if prefer == "bullets" else "bullets"]
        for text in pool:
            text = clip(text, 150)
            if text and text not in out and safe_text(text):
                out.append(text)
            if len(out) >= limit:
                return out
    return out


def first_sentences(text: str, count: int = 2) -> str:
    parts = re.split(r"(?<=[.!?。！？])\s+", text)
    return " ".join(parts[:count]).strip()


def pain_sentences(parsed: dict, limit: int = 2) -> list[str]:
    out: list[str] = []
    for kind in ("why", "intro", "features"):
        for section in parsed["sections"]:
            if section["kind"] != kind:
                continue
            for text in section["paragraphs"] + section["bullets"]:
                for sentence in re.split(r"(?<=[.!?。！？])\s+", text):
                    if PAIN_CUES.search(sentence) and 30 <= len(sentence) <= 260 and safe_text(sentence):
                        sentence = clip(sentence, 160)
                        if sentence not in out:
                            out.append(sentence)
                    if len(out) >= limit:
                        return out
    return out


def quickstart(parsed: dict) -> str:
    for section in parsed["sections"]:
        if section["kind"] != "install":
            continue
        for block in section["code"]:
            lines = [line.strip() for line in block.split("\n") if line.strip() and not line.strip().startswith("#")]
            if not lines:
                continue
            snippet = "\n".join(lines[:3])
            if len(snippet) <= 220 and safe_text(snippet) and not re.search(r"[{}<>]{3,}", snippet):
                return snippet
    return ""


# ---------------------------------------------------------------- 推断模板

FACETS = [
    ("mcp", re.compile(r"\bmcp\b|model-context-protocol|model context protocol", re.I), {
        "scenario": "让 Claude / Cursor 等 AI 客户端通过 MCP 协议直接调用外部工具与数据",
        "pain": "每接入一个工具都要为不同 AI 客户端各写一套胶水代码，上下文与权限难以统一",
        "help": "把现有服务包装成标准 MCP 工具，一次接入、多个 Agent 客户端复用",
        "design": "以 MCP Server 形态暴露 tools / resources，协议层与业务层解耦",
    }),
    ("skill", re.compile(r"agent-skill|claude-skill|skills?\b.*(claude|codex|agent)|SKILL\.md", re.I), {
        "scenario": "给 Claude Code / Codex 等编码 Agent 装上可复用的领域流程（Skill）",
        "pain": "同样的流程每次都要在对话里重新描述，提示词散落、效果不稳定",
        "help": "把团队经验沉淀为可版本化的 Skill，Agent 按需加载，减少重复提示与 token",
        "design": "以 Markdown 指令 + 脚本资源组织能力，按触发条件渐进加载",
    }),
    ("coding-agent", re.compile(r"claude-code|codex|coding-agent|cursor|copilot|aider|ai-coding", re.I), {
        "scenario": "在终端或 IDE 里用 AI 编码 Agent 完成改代码、跑测试、提 PR 的日常开发",
        "pain": "AI 编码助手缺少项目上下文与可控边界，产出难以复核",
        "help": "给编码 Agent 补齐上下文、工具或工作流，让 AI 改动更可控、可复现",
        "design": "围绕编码 Agent 的会话 / 工具调用循环做扩展，而不是重造一个 IDE",
    }),
    ("agent", re.compile(r"\bagents?\b|multi-agent|autonomous|agentic", re.I), {
        "scenario": "需要让 LLM 自主规划、调用工具并多步完成任务的应用",
        "pain": "从单轮问答走向多步任务时，状态管理、工具编排与失败恢复都要自己造轮子",
        "help": "提供现成的 Agent 运行时与编排范式，缩短从原型到可用的距离",
        "design": "以「规划 → 工具调用 → 观察」循环为核心，工具与模型可插拔",
    }),
    ("rag", re.compile(r"\brag\b|retrieval|vector|embedding|knowledge-base|semantic-search", re.I), {
        "scenario": "基于私有文档 / 知识库做问答与检索增强生成",
        "pain": "大模型不了解私有资料、容易幻觉，而自建检索链路涉及切分、向量化、召回多处细节",
        "help": "把文档接入、索引与召回打包好，快速得到可引用来源的问答能力",
        "design": "采用「摄取 → 切分 → 向量化 → 召回 → 生成」流水线，各环节可替换",
    }),
    ("llm-infra", re.compile(r"inference|llm-serving|quantiz|gguf|vllm|ollama|local-llm|llama|fine-?tun", re.I), {
        "scenario": "在本地或自有 GPU 上部署、推理或微调大模型",
        "pain": "云端 API 成本高、数据不出域要求下难以使用，自建推理又面临显存与吞吐问题",
        "help": "降低本地 / 私有化运行模型的门槛与成本",
        "design": "围绕推理效率（批处理、量化、缓存）做性能取舍",
    }),
    ("workflow", re.compile(r"workflow|automation|orchestrat|pipeline|n8n|zapier|low-code|no-code", re.I), {
        "scenario": "把跨系统的重复操作串成可视化或声明式的自动化流程",
        "pain": "跨工具的手工搬运耗时易错，脚本分散又缺少监控与重试",
        "help": "把重复流程交给可重跑、可观测的自动化，人只处理异常",
        "design": "以节点 / 步骤为单位组合流程，触发器、执行器与状态存储分离",
    }),
    ("ui", re.compile(r"\bui\b|component|design-system|tailwind|shadcn|react|vue|svelte|css", re.I), {
        "scenario": "搭建 Web 界面时直接复用成熟的组件与视觉规范",
        "pain": "从零写组件费时，且交互细节、可访问性与一致性很难兼顾",
        "help": "用现成组件 / 设计令牌提速界面开发，同时保持风格一致",
        "design": "组件化 + 设计令牌，样式与行为尽量解耦，便于按需拷贝或主题化",
    }),
    ("cli", re.compile(r"\bcli\b|terminal|command-line|tui|shell", re.I), {
        "scenario": "习惯在终端里工作、希望用命令行完成高频操作的开发者",
        "pain": "图形界面操作慢、难以脚本化和批量执行",
        "help": "把高频操作压缩成一条命令，并能嵌进脚本与 CI",
        "design": "CLI 优先，强调可组合（管道 / 参数）与可脚本化",
    }),
    ("browser", re.compile(r"browser|playwright|puppeteer|scrap|crawl|selenium", re.I), {
        "scenario": "需要程序化操作网页：采集、测试或让 Agent 代替人点网页",
        "pain": "网页结构多变、反爬与动态渲染让脚本脆弱难维护",
        "help": "提供更稳的浏览器自动化 / 采集能力，减少维护选择器的成本",
        "design": "在无头浏览器之上封装更高层的动作与等待语义",
    }),
    ("selfhost", re.compile(r"self-?host|docker|homelab|privacy|local-first|offline", re.I), {
        "scenario": "希望数据留在自己服务器或本机的个人与团队",
        "pain": "SaaS 订阅贵、数据不在自己手里，迁移与合规都受制于人",
        "help": "以自托管方式获得同类能力，数据与成本自己掌控",
        "design": "自托管优先，通常提供 Docker 一键部署与本地存储",
    }),
    ("feed", re.compile(r"\brss\b|feed|newsletter|aggregat|reader", re.I), {
        "scenario": "持续跟踪博客、资讯与更新源的信息收集场景",
        "pain": "信息散落在各个站点，逐个打开效率低且容易漏",
        "help": "把多个来源聚合到一处，按自己的节奏阅读与筛选",
        "design": "订阅 → 抓取 → 去重 → 呈现的聚合模型",
    }),
    ("devtool", re.compile(r"developer-tools?|devtools?|debug|lint|testing|observability|monitor|logging", re.I), {
        "scenario": "日常开发中的调试、质量检查与可观测性",
        "pain": "问题定位靠猜、质量问题上线才暴露",
        "help": "让问题更早被发现、定位更快",
        "design": "以开发者工作流为中心，尽量零配置接入",
    }),
]

KIND_FALLBACK = {
    "scenario": "适合想快速了解该领域现成方案、做技术选型对比的开发者",
    "pain": "同类问题往往需要自己从零搭建，试错成本高",
    "help": "先读 README 与示例，判断能否替代你手头的自研方案",
    "design": "从目录结构与依赖看，以 {lang} 实现核心逻辑",
}

LAYOUT_SIGNALS = [
    (re.compile(r"^(packages|apps|crates|libs)$"), "多包 monorepo（{name}/），核心与扩展分包维护"),
    (re.compile(r"^(plugins?|extensions?|integrations|adapters|providers)$"), "插件化：{name}/ 目录承载可插拔扩展"),
    (re.compile(r"^(skills?)$"), "以 {name}/ 目录组织多个可单独加载的 Skill"),
    (re.compile(r"^SKILL\.md$", re.I), "仓库根即一个 Skill（SKILL.md 描述触发与流程）"),
    (re.compile(r"^(docker-compose\.ya?ml|compose\.ya?ml)$"), "提供 docker compose 编排，适合一键自托管"),
    (re.compile(r"^Dockerfile$"), "附 Dockerfile，可容器化部署"),
    (re.compile(r"^(cmd|bin)$"), "{name}/ 下为命令行入口，CLI 优先"),
    (re.compile(r"^(server|backend|api)$"), "前后端分层：{name}/ 承载服务端"),
    (re.compile(r"^(web|frontend|ui|client)$"), "带独立前端 {name}/"),
    (re.compile(r"^(examples?|demos?|cookbook|samples)$"), "附 {name}/ 示例，可直接照抄上手"),
    (re.compile(r"^(tests?|__tests__|spec|e2e)$"), "有 {name}/ 自动化测试"),
    (re.compile(r"^(docs?|website)$"), "有独立文档目录 {name}/"),
    (re.compile(r"^(\.claude-plugin|\.claude|\.cursor|\.codex)$"), "内置 {name} 配置，可直接被 AI 编码工具识别"),
    (re.compile(r"^(helm|charts|k8s|deploy|terraform)$"), "附 {name}/ 部署清单，面向生产环境"),
]

ENTRY_FILES = {
    "package.json": "Node.js 包", "pyproject.toml": "Python 包", "setup.py": "Python 包", "Cargo.toml": "Rust crate",
    "go.mod": "Go module", "pom.xml": "Maven 工程", "build.gradle": "Gradle 工程", "Makefile": "Makefile 构建",
    "pnpm-workspace.yaml": "pnpm workspace", "turbo.json": "Turborepo", "mcp.json": "MCP 配置",
}


def detect_facets(candidate: dict, readme_text: str) -> list[dict]:
    head = " ".join([candidate.get("full_name") or "", candidate.get("description") or "", " ".join(candidate.get("topics") or [])])
    body = readme_text[:6000]
    scored = []
    for key, pattern, text in FACETS:
        head_hits = len(pattern.findall(head))
        body_hits = len(pattern.findall(body))
        hits = head_hits * 3 + (min(body_hits, 6) if body_hits >= 3 else 0)
        if hits >= 3:
            scored.append((hits, key, text))
    scored.sort(key=lambda item: -item[0])
    return [dict(key=key, **text) for _, key, text in scored[:3]]


def layout_signals(names: list[str]) -> list[str]:
    out = []
    for pattern, template in LAYOUT_SIGNALS:
        for name in names:
            if pattern.match(name):
                out.append(template.format(name=name))
                break
    return out[:6]


def stack_of(languages: dict) -> list[dict]:
    total = sum(v for v in languages.values() if isinstance(v, (int, float))) or 0
    if not total:
        return []
    rows = sorted(languages.items(), key=lambda item: -item[1])
    return [{"lang": lang, "pct": round(bytes_ * 100 / total, 1)} for lang, bytes_ in rows[:5] if bytes_ * 100 / total >= 1]


def item(text: str, origin: str) -> dict:
    return {"text": text, "from": origin}


def build_readme_insight(candidate: dict, readme: str, languages: dict, tree: list[str]) -> dict:
    """纯函数：仓库元数据 + README + 语言 + 根目录 → 结构化解读（method=readme）。"""
    parsed = parse_readme(readme)
    facets = detect_facets(candidate, readme)
    language = candidate.get("language") or "多语言"
    stars = int(candidate.get("stars") or 0)
    issues = int(candidate.get("open_issues") or 0)
    license_ = candidate.get("license") or ""

    tagline = clip(first_sentences(parsed["intro"], 2), 220) if parsed["intro"] and safe_text(parsed["intro"]) else ""
    if not tagline or len(tagline) < len(candidate.get("description") or "") * 0.6:
        tagline = clip(candidate.get("description") or "", 220)

    topics = [t for t in candidate.get("topics") or [] if isinstance(t, str)][:3]
    desc = clip(candidate.get("description") or "", 90)
    scenario = [item(f["scenario"], "inferred") for f in facets[:2]]
    if not facets and desc:
        scenario.append(item(f"面向需要「{desc}」的场景" + (f"，关键词：{' / '.join(topics)}" if topics else ""), "inferred"))
    scenario += [item(text, "readme") for text in section_items(parsed, "usecases", 2)]
    if not scenario:
        scenario = [item(KIND_FALLBACK["scenario"], "inferred")]

    pains = [item(text, "readme") for text in pain_sentences(parsed, 2)]
    pains += [item(f["pain"], "inferred") for f in facets[: 3 - len(pains)]]
    if not pains:
        pains = [item(KIND_FALLBACK["pain"], "inferred")]

    strengths = [item(text, "readme") for text in section_items(parsed, "features", 5)]
    if len(strengths) < 3:
        for section in parsed["sections"][:4]:
            for text in section["bullets"]:
                text = clip(text, 150)
                if len(strengths) < 4 and safe_text(text) and all(text != s["text"] for s in strengths):
                    strengths.append(item(text, "readme"))
    if re.match(r"^(mit|apache-2\.0|bsd|isc|0bsd|unlicense|mpl-2\.0)", license_, re.I):
        strengths.append(item(f"{license_} 宽松许可，可商用与二次改造", "facts"))
    pushed = parse_time(candidate.get("pushed_at"))
    if pushed and (utcnow() - pushed).days <= 14:
        strengths.append(item("近两周仍在推送，维护活跃", "facts"))
    hits = len({candidate.get("source"), *(candidate.get("also_seen_in") or [])} - {None})
    if hits >= 3:
        strengths.append(item(f"在 {hits} 个采集来源中被交叉命中，社区关注度高", "facts"))

    helps = [item(f["help"], "inferred") for f in facets[:3]]
    if not helps and desc:
        helps = [item(f"如果你正在自研同类能力，可直接参考或复用它的实现：{desc}", "inferred")]
    helps = helps or [item(KIND_FALLBACK["help"], "inferred")]

    design = []
    for section in parsed["sections"]:
        if section["kind"] == "how" and section["paragraphs"]:
            sentence = clip(first_sentences(section["paragraphs"][0]), 200)
            if safe_text(sentence):
                design.append(item(sentence, "readme"))
            break
    design += [item(f["design"], "inferred") for f in facets[:2]]
    layout = layout_signals(tree)
    design += [item(text, "inferred") for text in layout[:3]]
    if not design:
        design = [item(KIND_FALLBACK["design"].format(lang=language), "inferred")]

    caveats = []
    if candidate.get("archived"):
        caveats.append(item("仓库已归档，不会再修复问题", "facts"))
    if not license_ or license_ == "NOASSERTION":
        caveats.append(item("未声明许可证，默认保留所有权利，引入前需确认授权", "facts"))
    elif re.search(r"gpl|agpl|sspl", license_, re.I):
        caveats.append(item(f"{license_} 带传染性条款，闭源集成前需法务评估", "facts"))
    if re.search(r"OPENAI_API_KEY|ANTHROPIC_API_KEY|api[ _-]?key", readme, re.I):
        caveats.append(item("运行需要自备模型或第三方服务的 API Key，会产生调用费用", "readme"))
    if any(re.match(r"^(docker-compose\.ya?ml|compose\.ya?ml|helm|charts|k8s)$", n) for n in tree):
        caveats.append(item("依赖多个服务编排，部署与运维成本高于单文件工具", "inferred"))
    if stars and issues / max(stars / 1000, 1) > 20:
        caveats.append(item(f"未结议题 {issues} 个，相对热度偏多，可能存在维护积压", "facts"))
    if len(readme) < 1500:
        caveats.append(item("README 较短，文档可能不完整，需要读源码确认用法", "facts"))
    if readme and not re.search(r"[\u4e00-\u9fff]", readme):
        caveats.append(item("文档为英文，团队推广时需补中文说明", "facts"))

    entries = [label for name, label in ENTRY_FILES.items() if name in tree]
    return {
        "method": "readme",
        "tagline": tagline,
        "scenario": scenario[:3],
        "pain_points": pains[:3],
        "strengths": strengths[:6],
        "helps_you": helps[:3],
        "design": design[:5],
        "architecture": {"stack": stack_of(languages), "layout": layout, "entry": entries[:4]},
        "caveats": caveats[:4],
        "quickstart": quickstart(parsed),
        "facets": [f["key"] for f in facets],
        "evidence": {
            "readme_chars": len(readme),
            "headings": [s["title"] for s in parsed["sections"] if s["title"]][:10],
        },
    }


# ---------------------------------------------------------------- 可选：模型解读

def digest_for_llm(candidate: dict, insight: dict, limit: int) -> str:
    """只把压缩后的摘要发给模型：元数据 + 标题目录 + 已抽取要点，不发 README 全文。"""
    lines = [
        f"repo: {candidate.get('full_name')}",
        f"description: {candidate.get('description') or ''}",
        f"topics: {', '.join(candidate.get('topics') or [])}",
        f"language/stars/license: {candidate.get('language')}/{candidate.get('stars')}/{candidate.get('license')}",
        f"intro: {insight.get('tagline', '')}",
        "headings: " + " | ".join(insight.get("evidence", {}).get("headings", [])),
        "layout: " + "; ".join(insight.get("architecture", {}).get("layout", [])),
        "stack: " + ", ".join(f"{s['lang']} {s['pct']}%" for s in insight.get("architecture", {}).get("stack", [])),
    ]
    for key in ("strengths", "pain_points", "design"):
        lines.append(f"{key}: " + " / ".join(x["text"] for x in insight.get(key, []) if x["from"] == "readme"))
    return "\n".join(lines)[:limit]


LLM_PROMPT = (
    "你是资深技术编辑。根据下面的开源仓库摘要，用简体中文输出严格 JSON："
    '{"tagline":"一句话定位","scenario":[..2-3条],"pain_points":[..2-3条],"strengths":[..3-4条],'
    '"helps_you":[..2-3条],"design":[..2-3条 设计思路与架构特点],"caveats":[..1-3条]}。'
    "每条 ≤ 60 字，只依据摘要，不确定的不要写。"
)


def llm_enabled() -> bool:
    return bool(os.getenv("WORKLENS_LLM_BASE_URL") and os.getenv("WORKLENS_LLM_API_KEY") and os.getenv("WORKLENS_LLM_MODEL"))


def call_llm(digest: str) -> dict | None:
    body = json.dumps({
        "model": os.environ["WORKLENS_LLM_MODEL"],
        "messages": [{"role": "system", "content": LLM_PROMPT}, {"role": "user", "content": digest}],
        "temperature": 0.2,
        "max_tokens": 900,
    }).encode()
    req = urllib.request.Request(
        os.environ["WORKLENS_LLM_BASE_URL"].rstrip("/") + "/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {os.environ['WORKLENS_LLM_API_KEY']}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            content = json.load(response)["choices"][0]["message"]["content"]
        match = re.search(r"\{.*\}", content, re.S)
        return json.loads(match.group(0)) if match else None
    except Exception:  # noqa: BLE001 - 模型失败时保留 README 解读
        return None


def merge_llm(insight: dict, result: dict) -> dict:
    merged = dict(insight)
    merged["method"] = "llm"
    if isinstance(result.get("tagline"), str) and result["tagline"].strip():
        merged["tagline"] = clip(result["tagline"], 160)
    for key in FIELDS:
        values = [clip(str(v), 120) for v in result.get(key) or [] if str(v).strip() and safe_text(str(v))]
        if values:
            facts = [x for x in insight.get(key, []) if x["from"] == "facts"]
            merged[key] = [item(v, "llm") for v in values[:4]] + facts[:2]
    return merged


# ---------------------------------------------------------------- 缓存调度

def needs_check(record: dict | None, candidate: dict, now: dt.datetime, settings: dict) -> str:
    """返回 '' 表示直接复用缓存；否则返回核对原因。"""
    if not record:
        return "missing"
    if record.get("schema") != SCHEMA and record.get("method") != "editor":
        return "schema"
    checked = parse_time(record.get("checked_at")) or dt.datetime.min.replace(tzinfo=dt.timezone.utc)
    age = now - checked
    if age > dt.timedelta(days=settings["max_age_days"]):
        return "expired"
    pushed = parse_time(candidate.get("pushed_at"))
    if pushed and pushed > checked and age > dt.timedelta(hours=settings["recheck_hours"]):
        return "pushed"
    return ""


def fetch_inputs(full_name: str) -> tuple[str, str, dict, list[str]] | None:
    quoted = urllib.parse.quote(full_name)
    readme = request(f"/repos/{quoted}/readme")
    if not readme:
        return None
    try:
        text = base64.b64decode(readme.get("content") or "").decode("utf-8", "replace")
    except (ValueError, TypeError):
        text = ""
    return readme.get("sha") or "", text, {}, []


def fetch_structure(full_name: str) -> tuple[dict, list[str]]:
    quoted = urllib.parse.quote(full_name)
    languages = request(f"/repos/{quoted}/languages") or {}
    contents = request(f"/repos/{quoted}/contents/") or []
    names = [entry.get("name", "") for entry in contents if isinstance(entry, dict)]
    return languages, names


def priority_order(candidates: list[dict]) -> list[dict]:
    """先解读最可能被看到的：多源命中、热榜、Stars 高。"""
    def key(c):
        hits = len({c.get("source"), *(c.get("also_seen_in") or [])} - {None})
        trending = any(str(s).startswith("trending") for s in [c.get("source"), *(c.get("also_seen_in") or [])])
        return (-hits, -int(trending), -int(c.get("stars") or 0))
    return sorted(candidates, key=key)


def refresh(discoveries: dict, cache: dict, settings: dict, now: dt.datetime, fetch=fetch_inputs, structure=fetch_structure, llm=None) -> dict:
    items = dict((cache or {}).get("items") or {})
    candidates = [c for c in discoveries.get("candidates") or [] if isinstance(c, dict) and c.get("full_name")]
    stats = {"reused": 0, "rechecked_same": 0, "regenerated": 0, "new": 0, "shared": 0, "llm": 0, "skipped": 0, "deferred": 0, "requests": 0}
    by_sha = {rec.get("readme_sha"): name for name, rec in items.items() if rec.get("readme_sha")}
    budget = int(settings["max_new_per_run"])
    llm_budget = int(settings["max_llm_per_run"]) if llm else 0
    now_iso = iso(now)

    for candidate in priority_order(candidates):
        name = candidate["full_name"]
        record = items.get(name)
        reason = needs_check(record, candidate, now, settings)
        if not reason:
            stats["reused"] += 1
            record["last_seen_at"] = now_iso
            continue
        if budget <= 0:
            stats["deferred"] += 1
            if record:
                record["last_seen_at"] = now_iso
            continue
        budget -= 1
        try:
            fetched = fetch(name)
            stats["requests"] += 1
        except Exception:  # noqa: BLE001 - 单仓失败不影响整体
            stats["skipped"] += 1
            continue
        if fetched is None:
            stats["skipped"] += 1
            if record:
                record["checked_at"] = now_iso
            continue
        sha, readme, _, _ = fetched
        if record and record.get("readme_sha") == sha and record.get("schema") == SCHEMA:
            record["checked_at"] = now_iso
            record["last_seen_at"] = now_iso
            record["pushed_at"] = candidate.get("pushed_at")
            stats["rechecked_same"] += 1
            continue
        if record and record.get("method") == "editor":
            record.update({"readme_changed": record.get("readme_sha") != sha, "checked_at": now_iso, "last_seen_at": now_iso})
            stats["rechecked_same"] += 1
            continue
        twin = by_sha.get(sha)
        if twin and twin != name and items.get(twin):
            shared = json.loads(json.dumps(items[twin]))
            shared.update({"shared_with": twin, "checked_at": now_iso, "last_seen_at": now_iso, "pushed_at": candidate.get("pushed_at")})
            items[name] = shared
            stats["shared"] += 1
            continue
        try:
            languages, tree = structure(name)
        except Exception:  # noqa: BLE001 - 结构信息缺失时只用 README
            languages, tree = {}, []
        stats["requests"] += 2
        insight = build_readme_insight(candidate, readme, languages, tree)
        if llm and llm_budget > 0:
            result = llm(digest_for_llm(candidate, insight, int(settings["digest_chars"])))
            if result:
                insight = merge_llm(insight, result)
                llm_budget -= 1
                stats["llm"] += 1
        insight.pop("evidence", None)  # 只在生成时喂给模型摘要，不落盘
        insight.update({
            "schema": SCHEMA, "readme_sha": sha, "pushed_at": candidate.get("pushed_at"),
            "generated_at": now_iso, "checked_at": now_iso, "last_seen_at": now_iso,
        })
        stats["regenerated" if record else "new"] += 1
        items[name] = insight
        by_sha[sha] = name
        time.sleep(float(settings["request_interval_seconds"]))

    cutoff = now - dt.timedelta(days=settings["prune_after_days"])
    for name in list(items):
        seen = parse_time(items[name].get("last_seen_at"))
        if items[name].get("method") != "editor" and seen and seen < cutoff:
            del items[name]

    live = {c["full_name"] for c in candidates}
    covered = sum(1 for name in live if name in items)
    methods: dict[str, int] = {}
    for name in live:
        if name in items:
            methods[items[name].get("method", "readme")] = methods.get(items[name].get("method", "readme"), 0) + 1
    return {
        "schema_version": SCHEMA,
        "generated_at": now_iso,
        "summary": {"candidates": len(live), "covered": covered, "methods": methods, "last_run": stats},
        "items": dict(sorted(items.items())),
    }


# ---------------------------------------------------------------- 校验

def validate(payload: dict) -> list[str]:
    errors = []
    if payload.get("schema_version") != SCHEMA:
        errors.append("schema_version 必须为 1")
    for name, record in (payload.get("items") or {}).items():
        if record.get("method") not in METHODS:
            errors.append(f"{name}: method 非法")
        if not isinstance(record.get("tagline"), str):
            errors.append(f"{name}: 缺少 tagline")
        for key in FIELDS:
            for entry in record.get(key) or []:
                if not isinstance(entry, dict) or entry.get("from") not in ORIGINS or not entry.get("text"):
                    errors.append(f"{name}.{key}: 每条需含 text 与合法 from")
                elif not safe_text(entry["text"]):
                    errors.append(f"{name}.{key}: 含疑似敏感信息")
        if record.get("method") != "editor" and not record.get("readme_sha"):
            errors.append(f"{name}: 机器解读必须记录 readme_sha 作为缓存键")
    return errors


def write_payload(payload: dict, path: Path | None = None) -> None:
    """一仓一行：体积接近紧凑 JSON，git diff 仍按仓库粒度可读。"""
    path = path or OUTPUT_PATH
    head = {k: v for k, v in payload.items() if k != "items"}
    lines = ["{"] + [f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))}," for k, v in head.items()]
    rows = [f"  {json.dumps(name, ensure_ascii=False)}: {json.dumps(record, ensure_ascii=False, separators=(',', ':'))}" for name, record in payload["items"].items()]
    lines.append('  "items": {')
    lines.append(",\n".join("  " + row for row in rows))
    lines.append("  }")
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("command", nargs="?", default="refresh", choices=["refresh", "validate"])
    args = parser.parse_args(argv)
    if args.command == "validate":
        errors = validate(load_json(OUTPUT_PATH, {}))
        for error in errors[:50]:
            print(f"✗ {error}")
        print("仓库解读缓存校验通过" if not errors else f"共 {len(errors)} 处问题")
        return 1 if errors else 0
    settings = load_settings()
    discoveries = load_json(DISCOVERIES_PATH, {})
    cache = load_json(OUTPUT_PATH, {})
    payload = refresh(discoveries, cache, settings, utcnow(), llm=call_llm if llm_enabled() else None)
    write_payload(payload)
    print(json.dumps(payload["summary"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
