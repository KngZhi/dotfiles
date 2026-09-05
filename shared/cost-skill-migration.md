# Cost skill migration

`chile-ops/skills/` owns the `container-cost` and
`chile-landed-cost-calculator` skill instructions. The executable implementation
belongs to `chile-mono/apps/container-cost/`. Dotfiles retires their global
distribution after both replacements are available.

## Delivery order

1. Deliver the cost engine to `chile-mono` (default branch: `master`) and the
   two skill entrypoints to `chile-ops` (default branch: `main`). Each repository
   must pass its own checks; verify the skill commands against the new engine.
2. Make the verified replacements available in the checkouts used for operations.
   The original checkouts may contain user changes: preserve them and use separate
   worktrees for integration. Do not reset them or force a branch switch.
3. Apply the dotfiles retirement change only after the replacement skills and
   engine work. It removes the tracked `shared/skills/container-cost/` files and
   prevents either skill from being distributed again from legacy shared copies.

## Runtime cutover

1. Confirm the new calculator is saved in the destination repository and its
   checks pass before archiving the untracked
   `shared/skills/chile-landed-cost-calculator/` from the old dotfiles checkout.
   Preserve that source in an archive outside `shared/skills/`. Inspect and archive
   any ignored `container-cost/` residue, such as `node_modules/`, outside the same
   shared directory; do not discard user data or credentials.
2. Keep Hermes pointed at `chile-ops/skills/` through its existing
   `skills.external_dirs` entry. Hermes also reads dotfiles' shared skill directory
   directly, so archiving the old physical directories is part of the cutover.
   Codex and Claude should load the replacement skills from the relevant business
   project, using project-scoped entries rather than global skill links.
3. Run the normal `shared/build.sh` from the intended dotfiles checkout. It removes
   the four old Claude/Codex symlinks only when they point to that checkout's shared
   sources, accepting the original Claude relative targets and absolute targets
   with an optional trailing slash. It preserves other targets and real directories.
4. In fresh processes, confirm the default global Codex/Claude environment no
   longer discovers the retired shared skills, Hermes resolves both names from
   `chile-ops`, and the relevant project can run the new engine. Inspect any custom
   same-name global links separately; the build deliberately preserves them.

Keep checkout-specific paths, archive locations, and verification results in the
execution handoff. A local commit or a passing fixture does not complete the
runtime cutover.
