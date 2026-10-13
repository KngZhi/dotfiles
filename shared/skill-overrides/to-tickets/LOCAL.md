## Local conventions

For KngZhi repositories, read `linear-usage` before the first Linear operation
(`~/.agents/skills/linear-usage/SKILL.md`; source fallback:
`~/repo/dotfiles/shared/skills/linear-usage/SKILL.md`). Publish each ticket through
`create-linear-issue` in the repository's engineering project. Use its human
summary followed by Agent instructions, preserving the ticket's content and
acceptance criteria. Use native parent and blocking relationships.

The upstream `ready-for-agent` label instruction is replaced for team JUN by the
native state/owner mapping in `linear-usage`'s workspace reference: ready work
uses `Todo` with agent delegation/assignment; planned work with an open blocker
uses `Blocked` and native `blockedBy`. Apply live category labels separately.
