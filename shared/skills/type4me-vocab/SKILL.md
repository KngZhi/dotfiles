---
name: type4me-vocab
description: Manage Type4Me speech-recognition corrections, snippet mappings, and hotwords when the user reports a misrecognized word or requests vocabulary changes.
---

# Type4Me vocabulary

Use this skill to correct Type4Me vocabulary on macOS. For Apple Reminders tasks,
use the `reminders-cli` skill or Type4Me's Mac Actions mode.

Read the [official procedure](references/upstream-SKILL.md) when making a
vocabulary change. It contains the intent/variant guidance, JSON examples, and
reload procedure. Apply the compatibility corrections below to those examples.
[Upstream source and pinned revision](SOURCE.md) are retained with the original
README and MIT license.

## Installed-version compatibility

For Type4Me v2.8.0, inspect `/Applications/Type4Me.app` and
`~/Library/Application Support/Type4Me/` before writing. The app's actual install
URL is https://github.com/joewongjc/type4me; the upstream example's
`anthropics/type4me` link is a typo. A missing `builtin-snippets.json` by itself
does not establish that the profile is incomplete.

User `snippets.json` holds an array of `{ "trigger": "...", "replacement": "..." }`;
user `hotwords.json` holds an array of strings. This release uses the user arrays
for effective vocabulary. Read built-in files for reference, keep them unchanged,
and deduplicate against the user arrays: a term present only in a built-in file
still needs a user entry. Normalize all whitespace and case for trigger matching.
A trigger already mapped to a different output is a conflict to resolve from the
user's requested correction, rather than silently skipping it.

## Write and verify

Preserve existing entries and back up files that will change. Validate the loaded
JSON shape and write each changed file atomically. For this release, generate
`hotwords.txt` from effective user hotwords rather than merging inactive built-ins.
Use only plausible correction variants that retain the user's intended meaning.

After writing, run the upstream reload procedure when supported and reread the
user JSON to confirm the intended trigger/output and hotwords. An `open` exit code
confirms URL dispatch; report a successful app reload only with app evidence.
Report the added or updated mappings and any unresolved ambiguity concisely.
