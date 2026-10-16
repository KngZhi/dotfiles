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
        # Resolve so the checkout path is physical: macOS /var is a symlink to
        # /private/var, and owned_link compares a `pwd -P` result to this path.
        self.base = Path(self.temp.name).resolve()
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
        self.skill("shared/.claude/skills/claude-only", "claude")
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
        # The shared catalog reaches .claude and .agents, never Codex's own root
        # (Codex already reads .agents, so a copy there would list it twice).
        for host in (".claude", ".agents"):
            skill = self.runtime_skill(host, "example")
            self.assertEqual((skill / "SKILL.md").read_text(), "local instructions\n")
            self.assertEqual((skill / "reference.md").read_text(), "reference\n")
            self.assertIn("false", (skill / "agents/openai.yaml").read_text())
            self.assertTrue((self.runtime_skill(host, "git-commit") / "SKILL.md").is_file())
            self.assertEqual(self.runtime_skill(host, "explain-like-five").resolve(),
                             (self.repo / "shared/skills/explain-like-five").resolve())
            self.assertFalse(self.runtime_skill(host, "codex-only").exists())
        self.assertEqual((self.pack / "skills/example/SKILL.md").read_text(), "upstream\n")
        self.assertTrue(self.runtime_skill(".claude", "claude-only").exists())
        self.assertFalse(self.runtime_skill(".agents", "claude-only").exists())
        self.assertFalse(self.runtime_skill(".codex", "explain-like-five").exists())
        self.assertTrue(self.runtime_skill(".codex", "codex-only").exists())
        self.assertFalse(self.runtime_skill(".claude", "codex-only").exists())
        self.assertFalse(self.runtime_skill(".agents", "codex-only").exists())
        self.assertEqual((self.home / ".codex/AGENTS.md").read_text(), "shared instructions\n")

    def test_second_build_is_idempotent(self):
        self.run_build()
        result = self.run_build()
        # Nothing was retired or rewritten, so the catalog only grew the first time.
        self.assertNotIn("Retired managed link", result.stdout + result.stderr)
        for host in (".agents", ".claude", ".codex"):
            for entry in (self.home / host / "skills").iterdir():
                if entry.is_symlink():
                    self.assertTrue(entry.exists(), f"dangling link {entry}")

    def test_claude_skills_symlink_uses_relative_links(self):
        # The live layout makes ~/.claude/skills a symlink to the checkout's
        # claude/skills. owned_link's relative arm and link_skill's relative
        # rewrite only fire on that path, so exercise it instead of a plain dir.
        checkout_skills = self.repo / "claude/skills"
        checkout_skills.mkdir(parents=True)
        (self.home / ".claude").mkdir(parents=True, exist_ok=True)
        (self.home / ".claude/skills").symlink_to(checkout_skills)
        self.run_build()
        self.run_build()  # must not report an unmanaged skill for our own links
        link = checkout_skills / "explain-like-five"
        self.assertTrue(link.is_symlink())
        self.assertEqual(link.resolve(), (self.repo / "shared/skills/explain-like-five").resolve())

    def test_local_notes_follow_upstream_instructions(self):
        self.write("shared/skill-overrides/example/LOCAL.md", "local note\n")
        self.run_build()
        self.run_build()
        for host in (".claude", ".agents"):
            skill = self.runtime_skill(host, "example")
            self.assertEqual((skill / "SKILL.md").read_text(), "upstream\n\nlocal note\n")
            self.assertFalse((skill / "LOCAL.md").exists())
        self.assertEqual((self.pack / "skills/example/SKILL.md").read_text(), "upstream\n")

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
        custom = self.runtime_skill(".agents", "custom")
        custom.symlink_to(outside)
        dangling = self.runtime_skill(".agents", "custom-broken")
        dangling.symlink_to(self.base / "missing")
        # Neither an unselected clone nor custom runtime content is generated output.
        unlisted = self.write("shared/skill-packs/unlisted/notes.md", "keep me")
        shutil.rmtree(self.pack / "skills/removed")
        (self.pack / "skills/example/reference.md").unlink()
        self.run_build()
        for host in (".claude", ".agents"):
            self.assertFalse(self.runtime_skill(host, "removed").is_symlink())
            self.assertFalse((self.runtime_skill(host, "example") / "reference.md").exists())
        self.assertEqual((custom / "SKILL.md").read_text(), "custom")
        self.assertTrue(dangling.is_symlink())
        self.assertEqual(unlisted.read_text(), "keep me")

    def test_foreign_skill_collision_leaves_previous_view_unchanged(self):
        self.run_build()
        self.skill("shared/skill-overrides/example", "new overlay")
        # Would be published before the collision is reached if the preflight
        # were skipped, so this proves the failure happens before any link lands.
        self.skill("shared/skills/brand-new", "brand new")
        destination = self.runtime_skill(".agents", "example")
        destination.unlink()
        destination.mkdir()
        (destination / "SKILL.md").write_text("user work")
        result = self.run_build(False)
        self.assertIn("unmanaged skill", result.stderr)
        self.assertEqual((destination / "SKILL.md").read_text(), "user work")
        self.assertEqual((self.runtime_skill(".claude", "example") / "SKILL.md").read_text(), "upstream\n")
        self.assertFalse(self.runtime_skill(".agents", "brand-new").exists())
        self.assertFalse(self.runtime_skill(".claude", "brand-new").exists())

    def test_name_moving_into_claude_only_pool_leaves_agents(self):
        self.skill("shared/skills/mover", "shared body")
        self.run_build()
        self.assertTrue(self.runtime_skill(".agents", "mover").exists())
        self.assertTrue(self.runtime_skill(".claude", "mover").exists())
        shutil.rmtree(self.repo / "shared/skills/mover")
        self.skill("shared/.claude/skills/mover", "claude body")
        self.run_build()
        # The Claude-only pool must not survive in the other harnesses' root.
        self.assertFalse(os.path.lexists(self.runtime_skill(".agents", "mover")))
        self.assertEqual((self.runtime_skill(".claude", "mover") / "SKILL.md").read_text(),
                         "claude body\n")

    def test_codex_root_drops_shared_names_but_keeps_its_own(self):
        # Codex reads ~/.agents/skills too, so a shared link left in
        # ~/.codex/skills would make it list that skill twice.
        self.run_build()
        shared = self.runtime_skill(".codex", "explain-like-five")
        shared.symlink_to(self.repo / "shared/skills/explain-like-five")
        self.run_build()
        self.assertFalse(os.path.lexists(shared))
        self.assertTrue(self.runtime_skill(".agents", "explain-like-five").exists())
        self.assertTrue(self.runtime_skill(".codex", "codex-only").is_symlink())

    def test_unmanaged_instructions_are_preserved(self):
        path = self.home / ".codex/AGENTS.md"
        path.parent.mkdir(parents=True)
        path.write_text("personal instructions")
        self.assertIn("unmanaged instructions", self.run_build(False).stderr)
        self.assertEqual(path.read_text(), "personal instructions")

    def test_codex_manifest_array_and_excluded_skill(self):
        (self.pack / ".claude-plugin/plugin.json").unlink()
        self.write("shared/skill-packs/author-pack/.codex-plugin/plugin.json",
                   '{"skills":["./skills/example", "./skills/keel"]}')
        self.skill("shared/skill-packs/author-pack/skills/keel", "excluded")
        self.run_build()
        self.assertTrue(self.runtime_skill(".agents", "example").exists())
        self.assertFalse(self.runtime_skill(".agents", "keel").exists())

    def test_orphan_override_fails_before_publication(self):
        self.run_build()
        self.skill("shared/skill-overrides/missing", "orphan")
        self.assertIn("no selected upstream skill", self.run_build(False).stderr)
        self.assertTrue(self.runtime_skill(".agents", "example").exists())

    def test_wechat_backend_survives_discovery_consolidation(self):
        backend = self.skill("shared/skill-packs/author-pack/skills/tzwkb-wechat-decrypt", "backend")
        self.skill("shared/skills/wechat", "unified entrypoint")
        for host in (".agents", ".claude"):
            old = self.runtime_skill(host, "tzwkb-wechat-decrypt")
            old.parent.mkdir(parents=True, exist_ok=True)
            old.symlink_to(backend.parent)
        self.run_build()
        self.assertEqual(backend.read_text(), "backend\n")
        for host in (".agents", ".claude"):
            self.assertFalse(os.path.lexists(self.runtime_skill(host, "tzwkb-wechat-decrypt")))
            self.assertEqual((self.runtime_skill(host, "wechat") / "SKILL.md").read_text(), "unified entrypoint\n")

    def test_duplicate_local_name_is_rejected(self):
        self.skill("codex/skills/explain-like-five", "duplicate")
        self.assertIn("collision", self.run_build(False).stderr)

    def test_manifest_cannot_escape_pack(self):
        self.write("shared/skill-packs/author-pack/.claude-plugin/plugin.json",
                   '{"skills":"../../outside"}')
        self.assertIn("escapes pack", self.run_build(False).stderr)


if __name__ == "__main__":
    unittest.main()
