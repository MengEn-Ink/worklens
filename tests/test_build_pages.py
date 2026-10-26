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
        self.write("worklens-mobile_8a6r/v2/worklens-mobile_8a6r_h5.html", '<link href="../../shared/worklens-shell.css"><script src="../../shared/worklens-shell.js" data-current="field"></script>')
        self.write("worklens-mobile_8a6r/v2/app.jsx", "mobile-app")
        self.write("worklens_zn3k/v3/worklens_zn3k_pc.html", '<link href="../../shared/worklens-shell.css"><script src="../../shared/worklens-shell.js" data-current="desktop"></script>')
        self.write("worklens_zn3k/v3/views.jsx", "desktop-views")
        self.write("worklens-ai-news/v2/index.html", '<script src="../../shared/worklens-shell.js" data-current="ai-news"></script>')
        self.write("worklens-ai-news/v2/app.jsx", "ai-news-app")
        self.write("shared/worklens-shell.css", ":root { --wl-paper: #f3ede1; }")
        self.write("shared/worklens-shell.js", "const routes = ['desktop/', 'atelier/', 'ai-news/']")
        self.write("data/discoveries.json", '{"candidates": []}')
        self.write("data/skill-review-queue.json", '{"queue": []}')
        self.write("data/idea-pipeline.json", '{"ideas": []}')

    def tearDown(self):
        self.temp.cleanup()

    def write(self, rel_path, content):
        path = self.root / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def test_builds_mobile_desktop_and_manifest(self):
        manifest = build_pages.assemble(self.root)
        site = self.root / "_site"

        root_html = (site / "index.html").read_text(encoding="utf-8")
        desktop_html = (site / "desktop/index.html").read_text(encoding="utf-8")
        self.assertIn('./shared/worklens-shell.js', root_html)
        self.assertIn('data-current="field"', root_html)
        self.assertIn('../shared/worklens-shell.js', desktop_html)
        self.assertIn('data-current="desktop"', desktop_html)
        self.assertFalse((site / "worklens-mobile_8a6r_h5.html").exists())
        self.assertIn('data-current="ai-news"', (site / "ai-news/index.html").read_text(encoding="utf-8"))
        self.assertTrue((site / "shared/worklens-shell.css").is_file())
        self.assertTrue((site / "shared/worklens-shell.js").is_file())
        self.assertEqual((site / "data/discoveries.json").read_text(encoding="utf-8"), '{"candidates": []}')
        self.assertEqual((site / "data/idea-pipeline.json").read_text(encoding="utf-8"), '{"ideas": []}')
        self.assertTrue((site / ".nojekyll").exists())

        targets = {target["name"]: target for target in manifest["targets"]}
        self.assertEqual(targets["mobile"]["status"], "published")
        self.assertEqual(targets["desktop"]["route"], "/desktop/")
        self.assertEqual(targets["ai-news"]["route"], "/ai-news/")
        self.assertEqual(targets["atelier"]["status"], "skipped")
        persisted = json.loads((site / "pages-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(persisted["targets"], manifest["targets"])

    def test_publishes_atelier_when_v4_source_exists(self):
        self.write("worklens_zn3k/v4/index.html", '<script src="../../shared/worklens-shell.js" data-current="atelier"></script>')
        self.write("worklens_zn3k/v4/app.jsx", "atelier-app")

        manifest = build_pages.assemble(self.root)
        site = self.root / "_site"
        targets = {target["name"]: target for target in manifest["targets"]}
        shell = (site / "shared/worklens-shell.js").read_text(encoding="utf-8")

        self.assertIn('data-current="atelier"', (site / "atelier/index.html").read_text(encoding="utf-8"))
        self.assertEqual((site / "atelier/app.jsx").read_text(encoding="utf-8"), "atelier-app")
        self.assertEqual(targets["atelier"]["status"], "published")
        self.assertEqual(targets["atelier"]["route"], "/atelier/")
        for route in ("desktop/", "atelier/", "ai-news/"):
            self.assertIn(route, shell)
        self.assertEqual(
            manifest["shared_files"],
            ["shared/worklens-shell.css", "shared/worklens-shell.js"],
        )

    def test_shared_shell_accessibility_and_source_preview_contracts(self):
        repository = MODULE.parents[1]
        css = (repository / "shared/worklens-shell.css").read_text(encoding="utf-8")
        script = (repository / "shared/worklens-shell.js").read_text(encoding="utf-8")
        self.assertIn(".wl-shell__menu, .wl-shell__scrim, .wl-bottom { display: none; }", css)
        self.assertIn(".wl-shell-layer { position: fixed; inset: 0; z-index: 2147483000;", css)
        self.assertIn(".wl-bottom { position: fixed;", css)
        self.assertIn("display: grid; grid-template-columns: repeat(4, 1fr);", css)
        self.assertNotIn("!important", css)
        for marker in ("wl-shell-layer", "layer.append(header, bottom, scrim)", "previousFocus", "event.key !== 'Tab'", "event.key === 'Escape'", "aria-hidden"):
            self.assertIn(marker, script)
        for source in (
            "worklens-mobile_8a6r/v2/worklens-mobile_8a6r_h5.html",
            "worklens_zn3k/v3/worklens_zn3k_pc.html",
            "worklens_zn3k/v4/index.html",
            "worklens-ai-news/v2/index.html",
        ):
            html = (repository / source).read_text(encoding="utf-8")
            self.assertIn("../../shared/worklens-shell.css", html)
            self.assertIn("../../shared/worklens-shell.js", html)


if __name__ == "__main__":
    unittest.main()
