# Images

The history backend's media exporter skips V2 `.dat` files. Skipping means the
exporter lacks that decoder. Use the bundled decoder before reporting that a
locally cached image is unavailable.

First locate the message with the scoped evidence helper described in
[history](history.md). Use its image resource mapping to identify the account,
conversation directory, month, and hash. A directory hash by itself does not
identify the sender. When the message has no mapping, use a task screenshot to
match candidates within the confirmed account and date scope.

Read [local recovery](local-recovery.md) for the manifest, matching command,
V2 validation, and WXGF plane selection. Run the same commands through
`scripts/wechat.py images`. The
dependencies are Pillow and cryptography; WXGF additionally needs `ffmpeg` on
`PATH`. If unavailable, install them in an isolated virtual environment and set
`WECHAT_IMAGE_PYTHON` to that interpreter. History reads keep their separate
backend interpreter.

The decoder needs three distinct local V2 ciphertext templates to validate the
derived key. The key stays in memory. Candidate matching writes rankings, while
recovery writes only an explicit manifest. Both require a new output directory
outside the account tree. Keep the manifest and outputs in the task's private
workspace, and inspect every output plane before choosing the final image.

Compare dimensions and contents across `.dat`, `_h.dat`, `_t.dat`, and visually
matching hashes. File size and a match score do not prove that a candidate is
the correct image or the highest resolution. Preserve the source hash and
conversion metadata. A PNG decoded from WXGF retains the cached image detail,
not an unavailable camera original.

For requested Tencent Sheet delivery, read [Tencent delivery](tencent-sheet.md)
and the currently installed Tencent document instructions. Image recovery alone
does not authorize a cloud upload or edit.

The image scripts were authored by Junwei for `wechat-local-image-recovery` in
2026-09 and migrated here so their availability no longer depends on a separate
Hermes directory. The format references and algorithm sources are retained in
[local recovery](local-recovery.md). No new license is assigned to that code.
