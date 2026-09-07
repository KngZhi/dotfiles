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

Current sources:
- Matt Pocock skills: workflow and writing entries.
- lencx skills: coding-protocol.
- Yevanchen/reclaim-code-entropy: repository simplification.

The adaptations keep project contracts and evidence requirements while removing
broad activation, routine approval gates, fixed agent/session counts, and mandatory
document or template overhead. Supporting documents are overridden when they would
otherwise reintroduce a removed constraint.
