---
name: create-verification-skill
description: Create or update a project-local verification skill that launches the real app, exercises user-facing behavior, and preserves evidence for future agents.
license: MIT
---

# Create a verification skill

Turn a repository's real run and interaction paths into a reusable
`verify-<app>` skill. The next agent should be able to launch an isolated
instance, exercise a feature, inspect its effects, and retain proof after cleanup.
Use this when building or repairing that reusable procedure; an ordinary request
to verify a change should use the project's existing procedure.

## Discover the project

Read the repository instructions and inspect existing verification skills,
development commands, and harnesses before adding anything. Extend an existing
skill when it already owns the same surface; preserve project-specific knowledge.

Determine from the repository and runtime:

- **Surface.** What users operate: web UI, CLI/TUI, desktop app, API, mobile app,
  or library. Name the covered surface and any others left unverified.
- **Run.** Exact build/start commands, working directory, readiness signal,
  configuration, authentication prerequisites, and seed data. Document secret
  references or variable names, never credential values.
- **Drive.** Existing Playwright/Cypress tests, PTY helpers, HTTP clients, or
  other harnesses. Reuse working mechanisms before creating another one.
- **Observe.** Outputs that prove behavior: response bodies, terminal output,
  screenshots, persisted state, logs, exit codes, and relevant side effects.
- **Isolate.** Ownership of ports, profiles, data directories, and sessions.
  Explain when parallel instances are possible and when a shared instance must
  have one operator.

Ask only for material facts or choices that cannot be discovered. Respect the
authorized environment and actions; generating a verification skill does not
authorize production writes, real messages, purchases, or unrelated app repairs.
If the baseline cannot run, diagnose the blocker and report it precisely. Repair
in-scope setup issues; otherwise retain the unexecuted procedure as a draft.

## Write the project skill

Use the repository's established skill directory and discovery mechanism. If
none exists, inspect what the active host supports and choose a project-local
location it actually discovers. Do not hard-code a Cursor path or create copies
for every host. State the chosen path and how the skill will be discovered.

Write `verify-<app>/SKILL.md` with `name` and `description` frontmatter and these
operational sections, grounded in observed project behavior:

- **Launch.** Exact commands and working directory; readiness and teardown.
  For a short-lived command, describe build/setup and the isolated invocation.
- **Doctor.** A read-only check for the intended instance, version/build, port
  ownership, and required authentication. Run it first when state is uncertain.
- **Drive.** Real selectors, commands, routes, or public API calls. Prefer stable
  handles to coordinates. Link the feature map for feature-specific steps.
- **Evidence.** Capture the action and resulting state. Check relevant side
  effects as well as visible output. Name artifact paths outside disposable
  state and identify the tested revision/build and environment. Exclude secrets
  and unrelated user data from captured artifacts.
- **Cleanup.** Stop only instances the run created and remove owned scratch
  state. Use recorded process/session identities, not process-name matching.
  Keep proof artifacts after teardown, including on failed attempts.

Exercise real user paths. Internal setters and test-only endpoints do not prove
the corresponding UI or public API works. Use mocks only at an existing external
boundary and label what remains unverified. For dry-run/test modes, inspect what
they skip and observe relevant file, network, and state effects rather than
assuming the mode is side-effect free.

Add helper scripts only when they make the procedure reliably repeatable.
Document their invocations, dependencies, and ownership of temporary resources;
make directly invoked scripts executable. Keep host-specific tool names in the
project skill only when that project's workflow actually depends on them.

## Map the features

Create `features/README.md` as a coverage index, with linked files for the
in-scope user-facing features. Start with the core path for a narrow request;
expand to the requested coverage rather than inventing a full product catalog.

Each feature file records:

- What the feature does and its meaningful variants or entry points.
- Prerequisites and how a user reaches it.
- Exact harness actions and observable expected results.
- Relevant persistence/side-effect checks and cleanup needs.
- Known limitations and gotchas.

Distinguish documented paths from paths actually exercised. One passing feature
does not establish coverage of the rest of the map.

## Execute before delivery

Follow the generated instructions end to end: launch, doctor, drive a mapped
feature, capture evidence, and clean up. Verify that the evidence still exists
after cleanup. Fix procedural failures and repeat the affected path, cleaning up
owned instances after failed attempts too.

For a new skill, one real mapped feature is the minimum proof that the procedure
works. Exercise further paths when the user's requested scope or distinct harness
mechanisms require it. For an update, run the changed procedure and affected
paths. Validate skill metadata, links, and any helpers using available validators.

Report the generated location, actual commands and outcomes, evidence paths,
coverage gaps, and any runtime blockers. A procedure never executed against the
app is a draft. Structural validation alone does not make it verified. Keep the
map with the project so future changes can update the relevant instructions and
rerun their proof.

## Source

Adapted from Lauren Tan's pstack
[create-verification-skill](https://github.com/cursor/plugins/blob/f5bdd6826fd0a0d9cbc4347134c3a74a200b9d9d/pstack/skills/create-verification-skill/SKILL.md).
Local adaptation uses repository/host discovery, integrates feature-map guidance,
and removes dependencies on other pstack skills. See [LICENSE](LICENSE).
