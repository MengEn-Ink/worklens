import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "security_scan.py"
SPEC = importlib.util.spec_from_file_location("security_scan", MODULE_PATH)
security_scan = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(security_scan)


class SecurityScanTest(unittest.TestCase):
    def scan_in(self, root: Path, files: list[Path], allowlist=None):
        old_root = security_scan.ROOT
        try:
            security_scan.ROOT = root
            return security_scan.scan(files, allowlist or [])
        finally:
            security_scan.ROOT = old_root

    def test_detects_github_pat_and_internal_host(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bad = root / "notes.md"
            bad.write_text(
                "token ghp_" + "a" * 40 + "\nsee http://wiki.bytedance.net/x\n",
                encoding="utf-8",
            )
            joined = "\n".join(self.scan_in(root, [bad]))
            self.assertIn("github_token", joined)
            self.assertIn("internal_host", joined)

    def test_detects_url_credential_and_allows_registered_fixture(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            fixture = root / "test_demo.py"
            fixture.write_text(
                "url = 'https://example.com/feed.xml?token=secret&x=1'\n",
                encoding="utf-8",
            )
            self.assertTrue(self.scan_in(root, [fixture]))
            findings = self.scan_in(
                root,
                [fixture],
                [
                    {
                        "path": "test_demo.py",
                        "rule": "url_credential_param",
                        "contains": "example.com/feed.xml?token=secret",
                    }
                ],
            )
            self.assertEqual(findings, [])

    def test_clean_file_has_no_findings(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            clean = root / "readme.md"
            clean.write_text(
                "# WorkLens\n公开项目介绍 https://github.com/owner/repo\n", encoding="utf-8"
            )
            self.assertEqual(self.scan_in(root, [clean]), [])


if __name__ == "__main__":
    unittest.main()
