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
        self.write("worklens-mobile_8a6r/v2/worklens-mobile_8a6r_h5.html", "mobile")
        self.write("worklens-mobile_8a6r/v2/app.jsx", "mobile-app")
        self.write("worklens_zn3k/v3/worklens_zn3k_pc.html", "desktop")
        self.write("worklens_zn3k/v3/views.jsx", "desktop-views")
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

        self.assertEqual((site / "index.html").read_text(encoding="utf-8"), "mobile")
        self.assertFalse((site / "worklens-mobile_8a6r_h5.html").exists())
        self.assertEqual((site / "desktop/index.html").read_text(encoding="utf-8"), "desktop")
        self.assertEqual((site / "data/discoveries.json").read_text(encoding="utf-8"), '{"candidates": []}')
        self.assertEqual((site / "data/idea-pipeline.json").read_text(encoding="utf-8"), '{"ideas": []}')
        self.assertTrue((site / ".nojekyll").exists())

        targets = {target["name"]: target for target in manifest["targets"]}
        self.assertEqual(targets["mobile"]["status"], "published")
        self.assertEqual(targets["desktop"]["route"], "/desktop/")
        self.assertEqual(targets["atelier"]["status"], "skipped")
        persisted = json.loads((site / "pages-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(persisted["targets"], manifest["targets"])

    def test_publishes_atelier_when_v4_source_exists(self):
        self.write("worklens_zn3k/v4/index.html", "atelier")
        self.write("worklens_zn3k/v4/app.jsx", "atelier-app")

        manifest = build_pages.assemble(self.root)
        site = self.root / "_site"
        targets = {target["name"]: target for target in manifest["targets"]}

        self.assertEqual((site / "atelier/index.html").read_text(encoding="utf-8"), "atelier")
        self.assertEqual((site / "atelier/app.jsx").read_text(encoding="utf-8"), "atelier-app")
        self.assertEqual(targets["atelier"]["status"], "published")
        self.assertEqual(targets["atelier"]["route"], "/atelier/")


if __name__ == "__main__":
    unittest.main()
