# Local skill overrides

These files adapt the selected third-party skills to this workspace.
The original repositories remain in `shared/skill-packs/`; their source URLs
are listed in `shared/skill-packs/sources.txt`.

`shared/build.sh` copies each overridden skill and its supporting resources into
the generated `shared/skill-packs/.deploy/` view, then overlays only the tracked
files here. Claude, Codex, and Hermes use that view. Edit these sources, not the
generated view or the ignored upstream checkout.

Directories are keyed by the existing skill name. Keep inherited invocation policy,
licenses, and resources. When an upstream name disappears from the selected catalog,
the build fails so the override can be reviewed rather than silently forgotten.

Prefer `LOCAL.md` to replacing upstream files. The build appends it to the
upstream `SKILL.md`, so upstream updates keep arriving and local notes carry only
workspace conventions. A replaced file hides every later upstream change to it,
and past rewrites silently dropped outputs such as the architecture HTML report.

Current overrides:
- Matt Pocock skills: `LOCAL.md` for to-spec and to-tickets (KngZhi GitHub issues).
- lencx skills: coding-protocol, replaced.
- Yevanchen/reclaim-code-entropy: repository simplification, replaced.
