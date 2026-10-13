## Local conventions

For KngZhi repositories, read `linear-usage` before the first Linear operation
(`~/.agents/skills/linear-usage/SKILL.md`; source fallback:
`~/repo/dotfiles/shared/skills/linear-usage/SKILL.md`). Publish through
`create-linear-issue` in the repository's engineering project. Its human summary
followed by Agent instructions replaces the template above; preserve the
specification's content and acceptance criteria within those two parts.

The upstream `ready-for-agent` label instruction is replaced for team JUN by the
native state/owner mapping in `linear-usage`'s workspace reference: ready work
uses `Todo` with agent delegation/assignment; planned work with an open blocker
uses `Blocked` and native `blockedBy`. Apply live category labels separately.
