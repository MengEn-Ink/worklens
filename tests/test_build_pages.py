import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts/build_pages.py"
SPEC = importlib.util.spec_from_file_location("build_pages", MODULE)
build_pages = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = build_pages
SPEC.loader.exec_module(build_pages)


class BuildPagesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.write("worklens-hub_9bx8/v1/worklens-hub_9bx8_pc.html", '<link href="../../shared/worklens-shell.css"><script src="../../shared/worklens-shell.js" data-current="hub"></script>')
        self.write("worklens-hub_9bx8/v1/app.jsx", "hub-app")
        self.write("worklens-ai-news/v2/index.html", '<script src="../../shared/worklens-shell.js" data-current="ai-news"></script>')
        self.write("worklens-ai-news/v2/app.jsx", "ai-news-app")
        self.write("shared/worklens-shell.css", ":root { --wl-paper: #f3ede1; }")
        self.write("shared/worklens-shell.js", "const routes = ['#issue', 'ai-news/', '#review', '#me']")
        self.write("shared/assets/favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>')
        self.write("data/discoveries.json", '{"candidates": []}')
        self.write("data/skill-review-queue.json", '{"queue": []}')
        self.write("data/idea-pipeline.json", '{"ideas": []}')

    def tearDown(self):
        self.temp.cleanup()

    def write(self, rel_path, content):
        path = self.root / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def test_builds_hub_ai_news_and_manifest(self):
        manifest = build_pages.assemble(self.root)
        site = self.root / "_site"

        root_html = (site / "index.html").read_text(encoding="utf-8")
        self.assertIn('./shared/worklens-shell.js', root_html)
        self.assertIn('data-current="hub"', root_html)
        self.assertEqual((site / "app.jsx").read_text(encoding="utf-8"), "hub-app")
        self.assertFalse((site / "worklens-hub_9bx8_pc.html").exists())
        ai_news = (site / "ai-news/index.html").read_text(encoding="utf-8")
        self.assertIn('data-current="ai-news"', ai_news)
        self.assertIn('../shared/worklens-shell.js', ai_news)
        self.assertTrue((site / "shared/worklens-shell.css").is_file())
        self.assertTrue((site / "shared/worklens-shell.js").is_file())
        self.assertTrue((site / "shared/assets/favicon.svg").is_file())
        self.assertEqual((site / "data/discoveries.json").read_text(encoding="utf-8"), '{"candidates": []}')
        self.assertEqual((site / "data/idea-pipeline.json").read_text(encoding="utf-8"), '{"ideas": []}')
        self.assertTrue((site / ".nojekyll").exists())

        targets = {target["name"]: target for target in manifest["targets"]}
        self.assertEqual(set(targets), {"hub", "ai-news"})
        self.assertEqual(targets["hub"]["status"], "published")
        self.assertEqual(targets["hub"]["route"], "/")
        self.assertEqual(targets["ai-news"]["route"], "/ai-news/")
        persisted = json.loads((site / "pages-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(persisted["targets"], manifest["targets"])
        self.assertEqual(
            manifest["shared_files"],
            [
                "shared/assets/favicon.svg",
                "shared/worklens-shell.css",
                "shared/worklens-shell.js",
            ],
        )

    def test_legacy_routes_redirect_into_hub(self):
        manifest = build_pages.assemble(self.root)
        site = self.root / "_site"
        desktop = (site / "desktop/index.html").read_text(encoding="utf-8")
        atelier = (site / "atelier/index.html").read_text(encoding="utf-8")
        self.assertIn('url=../"', desktop)
        self.assertIn('url=../#review"', atelier)
        self.assertEqual({item["route"] for item in manifest["redirects"]}, {"/desktop/", "/atelier/"})

    def test_shared_shell_accessibility_and_source_preview_contracts(self):
        repository = MODULE.parents[1]
        css = (repository / "shared/worklens-shell.css").read_text(encoding="utf-8")
        script = (repository / "shared/worklens-shell.js").read_text(encoding="utf-8")
        self.assertIn(".wl-shell__menu, .wl-shell__scrim, .wl-bottom { display: none; }", css)
        self.assertIn(".wl-shell-layer { position: fixed; inset: 0; z-index: 2147483000;", css)
        self.assertIn(".wl-bottom { position: fixed;", css)
        self.assertIn("display: grid; grid-template-columns: repeat(4, 1fr);", css)
        self.assertNotIn("!important", css)
        for marker in ("wl-shell-layer", "layer.append(header, bottom, scrim)", "shared/assets/worklens-mark.svg", "previousFocus", "event.key !== 'Tab'", "event.key === 'Escape'", "aria-hidden"):
            self.assertIn(marker, script)
        for source in (
            "worklens-hub_9bx8/v1/worklens-hub_9bx8_pc.html",
            "worklens-ai-news/v2/index.html",
        ):
            html = (repository / source).read_text(encoding="utf-8")
            self.assertIn("../../shared/worklens-shell.css", html)
            self.assertIn("../../shared/worklens-shell.js", html)

    def test_shell_has_exactly_four_converged_entries(self):
        repository = MODULE.parents[1]
        script = (repository / "shared/worklens-shell.js").read_text(encoding="utf-8")
        for marker in ("label: '本期'", "label: '情报'", "label: '待审'", "label: '我的'", "addEventListener('hashchange', syncCurrent)"):
            self.assertIn(marker, script)
        for removed in ("'田野'", "'工作台'", "'工坊'", "desktop/", "atelier/"):
            self.assertNotIn(removed, script)


if __name__ == "__main__":
    unittest.main()
