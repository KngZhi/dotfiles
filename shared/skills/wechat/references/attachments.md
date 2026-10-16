# Attachments and exports

Resolve the backend with `python3 scripts/wechat.py backend`. Its references
remain next to the upstream `SKILL.md`. Read the backend's
`references/export-transcription.md` for voice setup and format details.

For a received document, use scoped history evidence to establish its filename
and sender. Locate all matching local files and select the intended path first.
The backend's `openfile` currently takes the first filename match, so a repeated
filename is ambiguous. Use the backend's `read_doc.py` on the selected full path.
Keep an existing workbook as a file and read its cells with a file reader.

```sh
python3 scripts/wechat.py backend-script scripts/common/read_doc.py /path/to/selected-file
python3 scripts/wechat.py export CONTACT --start 2026-09-01 --end 2026-09-03 \
  --no-transcribe -o /path/to/private-chat.txt
python3 scripts/wechat.py transcribe CONTACT -o /path/to/private-voice-map.json
```

Resolve `CONTACT` to one exact wxid before exporting. The upstream exporter
currently chooses the first contact match. Use explicit dates for exports.
Omitting dates exports all history. The export
merges shards and writes private files. `query media` exports a broad account
media set, so use it only when the user requests that scope. Prefer copying
identified documents or recovering selected images for a narrow request.

The upstream text export interprets its date flags in the host's local time.
For an exact date range in another time zone, use `evidence --timezone` and
retain its structured output. Do not present the plain export's date boundary
as a verified China-time boundary on a computer configured for Chile.

The voice model stays offline after caching. A missing voice backend does not
block text exports. A first large-v3 download is about 3 GB and needs the user's
approval. Existing consent still applies; do not ask again for the same action.
Use `--no-transcribe` when voice is unnecessary, and never trigger an implicit
model download to complete an ordinary text or image query.

Some voice or file content may never have been downloaded locally. Report the
missing local content and preserve the original message metadata. Do not equate
an attachment reference with a successfully read attachment.
