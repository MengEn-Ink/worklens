#!/usr/bin/env python3
"""Build the GitHub Pages artifact from versioned WorkLens surfaces.

After the IA convergence there are exactly two published surfaces: the
responsive Hub at ``/`` (本期 / 待审 / 我的) and AI 情报 at ``/ai-news/``.
Optional targets whose source directory is absent are recorded as skipped
rather than silently publishing stale files.
"""
from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class PageTarget:
    name: str
    source_dir: Path
    entry_file: str
    output_dir: str
    required: bool = True


TARGETS = (
    # 收敛后的唯一主站：本期 / 待审 / 我的（同一套响应式页面，PC 与 H5 共用）。
    PageTarget(
        name="hub",
        source_dir=Path("worklens-hub_9bx8/v1"),
        entry_file="worklens-hub_9bx8_pc.html",
        output_dir=".",
    ),
    PageTarget(
        name="ai-news",
        source_dir=Path("worklens-ai-news/v2"),
        entry_file="index.html",
        output_dir="ai-news",
    ),
)


# 收敛前的旧入口：保留一个静态跳转页，避免书签和外链 404。
LEGACY_REDIRECTS = {
    "desktop": "../",
    "atelier": "../#review",
}

REDIRECT_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url={target}" />
    <link rel="canonical" href="{target}" />
    <title>WorkLens 已合并入口</title>
  </head>
  <body>
    <p>该入口已合并到 WorkLens 主站，正在跳转：<a href="{target}">{target}</a></p>
  </body>
</html>
"""


def write_legacy_redirects(site_dir: Path) -> list[dict]:
    written = []
    for route, target in LEGACY_REDIRECTS.items():
        destination = site_dir / route
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "index.html").write_text(REDIRECT_TEMPLATE.format(target=target), encoding="utf-8")
        written.append({"route": f"/{route}/", "target": target})
    return written


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_target(root: Path, site_dir: Path, target: PageTarget) -> dict:
    source = root / target.source_dir
    destination = site_dir if target.output_dir == "." else site_dir / target.output_dir
    if not source.exists():
        if target.required:
            raise FileNotFoundError(f"页面源目录不存在：{target.source_dir}")
        return {
            "name": target.name,
            "route": "/" if target.output_dir == "." else f"/{target.output_dir}/",
            "source": str(target.source_dir),
            "status": "skipped",
            "reason": "source_absent",
        }

    entry = source / target.entry_file
    if not entry.is_file():
        raise FileNotFoundError(f"页面入口不存在：{target.source_dir / target.entry_file}")

    destination.mkdir(parents=True, exist_ok=True)
    for child in source.iterdir():
        target_path = destination / child.name
        if child.is_dir():
            shutil.copytree(child, target_path, dirs_exist_ok=True)
        else:
            shutil.copy2(child, target_path)

    output_entry = destination / "index.html"
    if target.entry_file != "index.html":
        copied_entry = destination / target.entry_file
        if output_entry.exists():
            output_entry.unlink()
        copied_entry.rename(output_entry)

    # Source HTML remains directly previewable from its versioned directory;
    # published routes are shallower, so only the shared asset prefix is rebased.
    shared_prefix = "./shared/" if target.output_dir == "." else "../shared/"
    html = output_entry.read_text(encoding="utf-8")
    output_entry.write_text(html.replace("../../shared/", shared_prefix), encoding="utf-8")

    return {
        "name": target.name,
        "route": "/" if target.output_dir == "." else f"/{target.output_dir}/",
        "source": str(target.source_dir),
        "status": "published",
        "entry": str(output_entry.relative_to(site_dir)),
    }


def copy_data(root: Path, site_dir: Path) -> list[str]:
    data_dir = root / "data"
    output_dir = site_dir / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    copied = []
    for path in sorted(data_dir.glob("*.json")):
        shutil.copy2(path, output_dir / path.name)
        copied.append(f"data/{path.name}")
    return copied


def copy_shared(root: Path, site_dir: Path) -> list[str]:
    source = root / "shared"
    if not source.is_dir():
        raise FileNotFoundError("共享页面壳目录不存在：shared")
    destination = site_dir / "shared"
    shutil.copytree(source, destination)
    return [
        str(path.relative_to(site_dir))
        for path in sorted(destination.rglob("*"))
        if path.is_file()
    ]


def assemble(root: Path = ROOT, site_dir: Path | None = None) -> dict:
    root = root.resolve()
    site_dir = (site_dir or root / "_site").resolve()
    reset_dir(site_dir)

    target_results = [copy_target(root, site_dir, target) for target in TARGETS]
    redirects = write_legacy_redirects(site_dir)
    data_files = copy_data(root, site_dir)
    shared_files = copy_shared(root, site_dir)
    (site_dir / ".nojekyll").write_text("", encoding="utf-8")

    manifest = {
        "schema_version": 1,
        "targets": target_results,
        "redirects": redirects,
        "data_files": data_files,
        "shared_files": shared_files,
    }
    (site_dir / "pages-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    manifest = assemble()
    published = [target["route"] for target in manifest["targets"] if target["status"] == "published"]
    skipped = [target["name"] for target in manifest["targets"] if target["status"] == "skipped"]
    print(f"Pages artifact built: routes={', '.join(published)}; skipped={', '.join(skipped) or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
