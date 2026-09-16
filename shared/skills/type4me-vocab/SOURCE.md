# Upstream source

- Official Type4Me README link: https://github.com/joewongjc/type4me#中文
- Skill repository: https://github.com/joewongjc/type4me-vocab-skill
- Revision: `bfb67f3156dac700d898c7e9f82d49c275612492`
- Retrieved: 2026-09-16
- License: [MIT](LICENSE)
- Installed with the Codex `skill-installer` GitHub helper, repository root path.
- [Original skill](references/upstream-SKILL.md), [README](README.md), and license
  are preserved byte-for-byte. Original skill SHA-256: `589fcde3e0efce98342aceccdb31b958f6ef8f55420c7750cbb2bdf01bd7b4b0`.

The local `SKILL.md` is a short Codex/Claude entrypoint. It keeps detailed official
instructions on demand, uses portable metadata, corrects the upstream install URL,
and adds v2.8.0 storage compatibility and write/readback guidance.

Compatibility evidence from the installed release's source:

- [SnippetStorage.swift](https://github.com/joewongjc/type4me/blob/v2.8.0/Type4Me/Services/SnippetStorage.swift#L381-L383): compiled rules come from `load()` (the user file).
- [HotwordStorage.swift](https://github.com/joewongjc/type4me/blob/v2.8.0/Type4Me/Services/HotwordStorage.swift#L178-L180): effective hotwords come from `load()` (the user file).
