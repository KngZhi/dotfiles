---
name: type4me-vocab
description: Manage Type4Me speech-recognition corrections, snippet mappings, and hotwords when the user reports a misrecognized word or requests vocabulary changes.
---

# Type4Me vocabulary

Type4Me keeps two user vocabularies in `~/Library/Application Support/Type4Me/`:

- **Snippets** (`snippets.json`) replace recognized text after ASR. Matching ignores
  case and whitespace. Every correction goes here.
- **Hotwords** (`hotwords.json`, mirrored to `hotwords.txt`) bias the ASR model.
  They help only for terms already in the model's vocabulary: standard words,
  well-known brands, common technical abbreviations, and common Chinese words.
  Coined spellings (Type4Me), very recent names, and arbitrary letter strings get
  snippets only.

## Choose the entries

Take the correct term and any misrecognition the user reported, then add the
plausible ASR variants: homophones (Claude → cloud), wrong syllable splits
(GitHub → git hub), vowel or consonant slips, dropped or added endings, merged
words, and transliterations in Chinese context (Cursor → 克色). Usually a handful
is enough; each variant should be a realistic mishearing that cannot collide
with ordinary text the user wants kept.

## Write with the script

Run from this skill directory. Check existing entries first, preview, then write:

```bash
python3 scripts/vocab.py show --grep "ghostty"
python3 scripts/vocab.py add --snippet 'ghosty=>Ghostty' --snippet 'ghost tea=>Ghostty' --hotword Ghostty --dry-run
python3 scripts/vocab.py add --snippet 'ghosty=>Ghostty' --snippet 'ghost tea=>Ghostty' --hotword Ghostty
python3 scripts/vocab.py remove --trigger 'ghost tea' --hotword Ghostty
```

The script validates the files, backs up each changed file as `<name>.bak-<timestamp>`,
writes atomically, regenerates `hotwords.txt` from the user hotwords, reads the
result back, and dispatches `type4me://reload-vocabulary` when the app supports it.
It deduplicates against the user files only: a term present only in a built-in
file still needs a user entry, and built-in files are never written.

An existing trigger mapped to a different replacement is a conflict; the script
writes nothing and exits 1. Use `--replace` when the user's requested correction
supersedes the old mapping; otherwise drop that variant.

The storage behavior was verified against Type4Me 2.8.0 (see [SOURCE.md](SOURCE.md)).
`show` prints the installed version; for a different version, check the release's
`SnippetStorage.swift` and `HotwordStorage.swift` before writing.

## Report

Report the added, updated, skipped, and conflicting entries and whether a hotword
was added and why. A successful `open` only confirms the reload URL was dispatched;
claim the app reloaded only with app evidence. Snippets apply on the next
recording; without the URL scheme, local hotwords need the refresh button in
Type4Me's vocabulary settings or an app restart.
