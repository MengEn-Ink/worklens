#!/usr/bin/env python3
"""Build the GitHub Pages artifact from versioned WorkLens surfaces.

The builder keeps Pages assembly deterministic and prepares an optional Atelier
route for the next PC v4 surface. If the v4 source directory is absent, the
route is recorded as skipped rather than silently publishing stale files.
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
    PageTarget(
        name="mobile",
        source_dir=Path("worklens-mobile_8a6r/v2"),
        entry_file="worklens-mobile_8a6r_h5.html",
        output_dir=".",
    ),
    PageTarget(
        name="desktop",
        source_dir=Path("worklens_zn3k/v3"),
        entry_file="worklens_zn3k_pc.html",
        output_dir="desktop",
    ),
    PageTarget(
        name="atelier",
        source_dir=Path("worklens_zn3k/v4"),
        entry_file="index.html",
        output_dir="atelier",
        required=False,
    ),
    PageTarget(
        name="ai-news",
        source_dir=Path("worklens-ai-news/v2"),
        entry_file="index.html",
        output_dir="ai-news",
    ),
)


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


def assemble(root: Path = ROOT, site_dir: Path | None = None) -> dict:
    root = root.resolve()
    site_dir = (site_dir or root / "_site").resolve()
    reset_dir(site_dir)

    target_results = [copy_target(root, site_dir, target) for target in TARGETS]
    data_files = copy_data(root, site_dir)
    (site_dir / ".nojekyll").write_text("", encoding="utf-8")

    manifest = {
        "schema_version": 1,
        "targets": target_results,
        "data_files": data_files,
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
