import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import vocab  # noqa: E402


class VocabTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.write("snippets.json", [{"trigger": "cloud code", "replacement": "Claude Code"}])
        self.write("hotwords.json", ["PR"])
        (self.dir / "hotwords.txt").write_text("PR")
        self.write("builtin-hotwords.json", ["GitHub"])

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name, data):
        (self.dir / name).write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def read(self, name):
        return json.loads((self.dir / name).read_text())

    def run_cli(self, *args):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = vocab.main(["--data-dir", str(self.dir), *args])
        return code, out.getvalue()

    def backups(self):
        return sorted(p.name for p in self.dir.glob("*.bak-*"))

    def test_add_snippet_and_builtin_only_hotword(self):
        code, out = self.run_cli("add", "--snippet", "ghosty=>Ghostty", "--hotword", "GitHub", "--no-reload")
        self.assertEqual(code, 0, out)
        self.assertIn({"trigger": "ghosty", "replacement": "Ghostty"}, self.read("snippets.json"))
        self.assertEqual(self.read("hotwords.json"), ["PR", "GitHub"])
        self.assertEqual((self.dir / "hotwords.txt").read_text(), "PR\nGitHub")
        self.assertIn("also built-in", out)
        self.assertEqual(len(self.backups()), 3)

    def test_duplicate_is_skipped_across_case_and_whitespace(self):
        code, out = self.run_cli("add", "--snippet", "Cloud\tCODE=>Claude Code", "--hotword", "pr", "--no-reload")
        self.assertEqual(code, 0, out)
        self.assertIn("no changes", out)
        self.assertEqual(self.backups(), [])

    def test_conflict_blocks_all_writes_until_replace(self):
        before = (self.dir / "snippets.json").read_text()
        code, out = self.run_cli("add", "--snippet", "CloudCode=>Claude", "--snippet", "x=>Y", "--no-reload")
        self.assertEqual(code, 1)
        self.assertIn("conflict: cloud code => Claude Code", out)
        self.assertEqual((self.dir / "snippets.json").read_text(), before)

        code, out = self.run_cli("add", "--snippet", "CloudCode=>Claude", "--replace", "--no-reload")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read("snippets.json"), [{"trigger": "cloud code", "replacement": "Claude"}])

    def test_dry_run_writes_nothing(self):
        code, out = self.run_cli("add", "--snippet", "a=>B", "--dry-run", "--no-reload")
        self.assertEqual(code, 0, out)
        self.assertEqual(len(self.read("snippets.json")), 1)
        self.assertEqual(self.backups(), [])

    def test_remove(self):
        code, out = self.run_cli("remove", "--trigger", "CLOUD code", "--hotword", "PR", "--no-reload")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read("snippets.json"), [])
        self.assertEqual((self.dir / "hotwords.txt").read_text(), "")

    def test_invalid_shape_is_rejected(self):
        self.write("hotwords.json", [{"word": "PR"}])
        code, out = self.run_cli("add", "--hotword", "X", "--no-reload")
        self.assertEqual(code, 2)
        self.assertIn("unexpected entry", out)


if __name__ == "__main__":
    unittest.main()
