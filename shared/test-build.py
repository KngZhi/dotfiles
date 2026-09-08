"""Exercise deployment in disposable repositories and homes, without network access."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


BUILD = Path(__file__).with_name("build.sh")


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="dotfiles-build-test-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.repo = self.base / "repo"
        self.home = self.base / "runtime"
        self.write("shared/build.sh", BUILD.read_text())
        self.write("shared/agent-instructions.md", "shared instructions\n")
        self.write("claude/CLAUDE.md", "@~/repo/dotfiles/shared/agent-instructions.md\n")
        self.write("shared/skill-packs/sources.txt", "https://example.invalid/author/pack\n")
        self.pack = self.repo / "shared/skill-packs/author-pack"
        (self.pack / ".git").mkdir(parents=True)
        self.write("shared/skill-packs/author-pack/.claude-plugin/plugin.json", '{"skills":"./skills"}')
        self.skill("shared/skill-packs/author-pack/skills/example", "upstream")
        self.write("shared/skill-packs/author-pack/skills/example/reference.md", "reference\n")
        self.write("shared/skill-packs/author-pack/skills/example/agents/openai.yaml",
                   "policy:\n  allow_implicit_invocation: false\n")
        self.skill("shared/skills/explain-like-five", "shared")
        self.skill("shared/.agents/skills/git-commit", "commit")
        self.skill("codex/skills/codex-only", "codex")

    def write(self, relative, text):
        path = self.repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def skill(self, relative, text):
        return self.write(relative + "/SKILL.md", text + "\n")

    def run_build(self, succeeds=True):
        result = subprocess.run(
            ["bash", str(self.repo / "shared/build.sh")],
            env={**os.environ, "DOTFILES_DEPLOY_HOME": str(self.home)},
            text=True, capture_output=True, timeout=20,
        )
        if succeeds:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def runtime_skill(self, host, name):
        return self.home / host / "skills" / name

    def test_overlay_resources_policy_and_idempotence(self):
        self.skill("shared/skill-overrides/example", "local instructions")
        self.run_build()
        self.run_build()
        for host in (".claude", ".codex"):
            skill = self.runtime_skill(host, "example")
            self.assertEqual((skill / "SKILL.md").read_text(), "local instructions\n")
            self.assertEqual((skill / "reference.md").read_text(), "reference\n")
            self.assertIn("false", (skill / "agents/openai.yaml").read_text())
            self.assertTrue((self.runtime_skill(host, "git-commit") / "SKILL.md").is_file())
            self.assertEqual(self.runtime_skill(host, "explain-like-five").resolve(),
                             (self.repo / "shared/skills/explain-like-five").resolve())
        self.assertEqual((self.pack / "skills/example/SKILL.md").read_text(), "upstream\n")
        self.assertFalse(self.runtime_skill(".claude", "codex-only").exists())
        self.assertTrue(self.runtime_skill(".codex", "codex-only").exists())
        self.assertEqual((self.home / ".codex/AGENTS.md").read_text(), "shared instructions\n")

    def test_claude_instructions_migrate_and_remain_independent(self):
        claude = self.home / ".claude/CLAUDE.md"
        claude.parent.mkdir(parents=True)
        shared = self.repo / "shared/agent-instructions.md"
        claude.symlink_to(shared)
        self.run_build()
        self.assertEqual(claude.resolve(), (self.repo / "claude/CLAUDE.md").resolve())
        custom = "@~/repo/dotfiles/shared/agent-instructions.md\nClaude-only rule\n"
        claude.write_text(custom)
        self.run_build()
        self.assertEqual(claude.read_text(), custom)
        self.assertEqual((self.home / ".codex/AGENTS.md").resolve(), shared.resolve())
        self.assertEqual(shared.read_text(), "shared instructions\n")

    def test_rebuild_retires_managed_links_and_stale_resources_only(self):
        self.skill("shared/skill-overrides/example", "overlay")
        self.skill("shared/skill-packs/author-pack/skills/removed", "old")
        self.run_build()
        outside = self.base / "custom"
        outside.mkdir()
        (outside / "SKILL.md").write_text("custom")
        custom = self.runtime_skill(".codex", "custom")
        custom.symlink_to(outside)
        dangling = self.runtime_skill(".codex", "custom-broken")
        dangling.symlink_to(self.base / "missing")
        # Neither an unselected clone nor custom runtime content is generated output.
        unlisted = self.write("shared/skill-packs/unlisted/notes.md", "keep me")
        shutil.rmtree(self.pack / "skills/removed")
        (self.pack / "skills/example/reference.md").unlink()
        self.run_build()
        self.assertFalse(self.runtime_skill(".codex", "removed").is_symlink())
        self.assertFalse((self.runtime_skill(".codex", "example") / "reference.md").exists())
        self.assertEqual((custom / "SKILL.md").read_text(), "custom")
        self.assertTrue(dangling.is_symlink())
        self.assertEqual(unlisted.read_text(), "keep me")

    def test_foreign_skill_collision_leaves_previous_view_unchanged(self):
        self.run_build()
        self.skill("shared/skill-overrides/example", "new overlay")
        destination = self.runtime_skill(".codex", "example")
        destination.unlink()
        destination.mkdir()
        (destination / "SKILL.md").write_text("user work")
        result = self.run_build(False)
        self.assertIn("unmanaged skill", result.stderr)
        self.assertEqual((destination / "SKILL.md").read_text(), "user work")
        self.assertEqual((self.runtime_skill(".claude", "example") / "SKILL.md").read_text(), "upstream\n")

    def test_unmanaged_instructions_are_preserved(self):
        path = self.home / ".codex/AGENTS.md"
        path.parent.mkdir(parents=True)
        path.write_text("personal instructions")
        self.assertIn("unmanaged instructions", self.run_build(False).stderr)
        self.assertEqual(path.read_text(), "personal instructions")

    def test_codex_manifest_array_and_excluded_skill(self):
        (self.pack / ".claude-plugin/plugin.json").unlink()
        self.write("shared/skill-packs/author-pack/.codex-plugin/plugin.json",
                   '{"skills":["./skills/example", "./skills/research"]}')
        self.skill("shared/skill-packs/author-pack/skills/research", "excluded")
        self.run_build()
        self.assertTrue(self.runtime_skill(".codex", "example").exists())
        self.assertFalse(self.runtime_skill(".codex", "research").exists())

    def test_orphan_override_fails_before_publication(self):
        self.run_build()
        self.skill("shared/skill-overrides/missing", "orphan")
        self.assertIn("no selected upstream skill", self.run_build(False).stderr)
        self.assertTrue(self.runtime_skill(".codex", "example").exists())

    def test_duplicate_local_name_is_rejected(self):
        self.skill("codex/skills/explain-like-five", "duplicate")
        self.assertIn("collision", self.run_build(False).stderr)

    def test_manifest_cannot_escape_pack(self):
        self.write("shared/skill-packs/author-pack/.claude-plugin/plugin.json",
                   '{"skills":"../../outside"}')
        self.assertIn("escapes pack", self.run_build(False).stderr)


if __name__ == "__main__":
    unittest.main()
