# Upstream source

- Official Type4Me README link: https://github.com/joewongjc/type4me#中文
- Skill repository: https://github.com/joewongjc/type4me-vocab-skill
- Revision: `bfb67f3156dac700d898c7e9f82d49c275612492`
- Retrieved: 2026-09-16
- License: [MIT](LICENSE)
- Installed with the Codex `skill-installer` GitHub helper, repository root path.
- [Original skill](references/upstream-SKILL.md), [README](README.md), and license
  are preserved byte-for-byte as provenance. Original skill SHA-256: `589fcde3e0efce98342aceccdb31b958f6ef8f55420c7750cbb2bdf01bd7b4b0`.
  The upstream `anthropics/type4me` links are a typo for https://github.com/joewongjc/type4me.

The local `SKILL.md` is the procedure; the original skill is not followed directly.
Its variant and hotword guidance is condensed into `SKILL.md`, and its inline Python
is replaced by `scripts/vocab.py` (tests in `tests/`), which applies the 2.8.0
storage behavior below. Compared with the original, the script deduplicates against
user files only, treats missing built-in files as normal, normalizes all whitespace
and case, reports conflicting triggers instead of skipping them, backs up and writes
atomically, and builds `hotwords.txt` from user hotwords only.

Compatibility evidence from the installed release's source:

- [SnippetStorage.swift](https://github.com/joewongjc/type4me/blob/v2.8.0/Type4Me/Services/SnippetStorage.swift#L381-L383): compiled rules come from `load()` (the user file).
- [HotwordStorage.swift](https://github.com/joewongjc/type4me/blob/v2.8.0/Type4Me/Services/HotwordStorage.swift#L178-L180): effective hotwords come from `load()` (the user file).
