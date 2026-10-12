---
name: install-shared-skill
description: Create, install, update, or repair global skills through dotfiles for Claude, Codex, and Hermes.
---

# Install a shared skill

This machine manages portable global skills in `~/repo/dotfiles`. Use its
`shared/build.sh` to deploy them. Apply this local convention before the default
destination in generic skill installers or skill creators.

## Choose the source

Read the checkout's `README.md`, `shared/build.sh`, and relevant Git status before
making changes. Preserve other work and inspect existing runtime destinations.

- Third-party skills belong in `shared/skill-packs/sources.txt`. The build clones
  their repositories and creates `shared/skill-packs/.deploy/`. Keep upstream
  checkouts intact; use `shared/skill-overrides/README.md` when adapting a skill.
- Author shared skills in `shared/skills/<name>/`. Use the available skill
  authoring guidance for content and validation, with this source location.
- Keep explicitly project-local or host-specific work in its own scope. Plugins
  that require hooks, commands, or other host features need the host's native
  installer; copying their skill files does not install those features.

## Install or update

For a GitHub link, inspect the upstream skill and any plugin manifest. Convert a
`tree/<ref>/<path>` URL to the repository URL for `--add`, while retaining the
requested ref and skill scope when checking what will be installed. The build
deploys its selected catalog from the repository. Resolve a requested subset or
non-default ref that the current build cannot express before installing extras.

Run from the persistent dotfiles checkout:

```sh
./shared/build.sh --add https://github.com/OWNER/REPO
```

For example, the plain-writing repository is
`https://github.com/docwriter-org/plain-writing-skill`.

The manifest is the durable registration. A standalone copy under
`~/.agents/skills`, `~/.codex/skills` or `~/.claude/skills` does not complete
this workflow.

## Where the build publishes

The shared catalog is published to `~/.agents/skills`, which Pi, Codex and
OpenCode read (Hermes reads it when listed in `skills.external_dirs`), and
mirrored into `~/.claude/skills` because Claude Code does not read the
user-scope `.agents/skills`. Codex reads both roots, so a shared skill is
published to `~/.agents/skills` only; `~/.codex/skills` carries Codex-only
skills from `codex/skills/`. A name present in both `~/.codex/skills` and
`~/.agents/skills` lists twice inside Codex. OpenCode also reads both roots but
dedupes by name, so the mirror only costs it a duplicate warning.

For a local skill change or a rebuild, run `./shared/build.sh`. Existing packs
are not updated by a normal build. Use `--update` only when updating all listed
packs is in scope; for one pack, inspect its status and remote, update that clean
checkout with `git pull --ff-only`, then rebuild.

If a destination already contains an unmanaged directory or link, inspect it
before changing it. Back up a confirmed duplicate before replacing it, and
preserve user modifications. After a failed build, inspect the manifest and
runtime state before retrying: `--add` registers the source before deployment.

When authoring in a temporary worktree, validate with `DOTFILES_DEPLOY_HOME` set
to a disposable directory. Bring the reviewed source changes into the persistent
checkout before live deployment, so runtime links survive worktree removal.

## Verify completion

Read back the source registration and deployed `SKILL.md`, and verify:

- Shared skills resolve under `~/.agents/skills`; Claude Code additionally sees
  them under `~/.claude/skills`. Codex-only skills resolve under
  `~/.codex/skills`. Supporting resources are present next to `SKILL.md`.
- Hermes `skills.external_dirs` includes the applicable shared directory. If it
  does not, inspect and correct only the task-relevant configuration.
- The requested skill is in the selected catalog, upstream files remain intact,
  and unrelated local work has not changed.

Keep source changes in the repository's normal Git workflow. Report local
deployment, commit, and push separately. Files and discovery links prove
installation; claim runtime activation only when actually observed.
