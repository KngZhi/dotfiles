# History and evidence

Run the read-only doctor first. The MCP tools are optional facades for the same
installed backend. Use them for ordinary discovery and recent activity, or use
the CLI through the unified entrypoint:

```sh
python3 scripts/wechat.py query list --json
python3 scripts/wechat.py query read CONTACT -d 7 -n 50 --json
python3 scripts/wechat.py query search KEYWORD -d 30 -n 50 --json
python3 scripts/wechat.py query recent -d 3 -n 100 --json
python3 scripts/wechat.py query summary -d 3 --json
python3 scripts/wechat.py query events -e pat -d 30 -n 100 --json
python3 scripts/wechat.py query stats -d 30 --json
```

These commands provide display results. The current display formatter truncates
long text, and its cached sender row ID can refer to a different person in
another shard. For full text, exact dates, payment evidence, or sender
attribution, use the scoped adapter instead:

```sh
python3 scripts/wechat.py evidence --chat EXACT_WXID \
  --start 2026-09-01 --end 2026-09-03 --timezone Asia/Shanghai \
  --keyword KEYWORD --limit 200 --out /path/to/new-messages.json
```

`--end` includes that whole date. The adapter uses the backend's existing
exporter to read each shard, joins the sender through that shard's own
`Name2Id`, and preserves local ID, server ID, source database, epoch and ISO
time with offset. It decodes full text before keyword filtering. Repeat
`--keyword` for alternative matches, or omit it to read the scoped context.
Choose the time zone from the task evidence; the operator's computer time zone
does not establish the time zone intended by a chat date.

The output is a new private JSON file. Ambiguous contacts stop with candidates.
Read `coverage` before answering. It records readable and unread local shards,
quarantined shards, scanned rows, matched rows and whether the requested output
limit truncated matches. A limit, quarantine or unread shard leaves a gap. Narrow the dates or raise the
limit only as needed. The check compares numeric `message_*.db` candidates
against the backend's readable list, so it also surfaces shards that an older
backend's single-digit glob omitted. It does not certify all historical
messages, quarantined archives or server-side content.

App-message output preserves selected titles and attachment metadata. It omits
raw XML, binary payloads, CDN fields and media decryption parameters. Plain
message text is retained in full. Use the raw message's structured type and
quoted metadata when a card or quote contains evidence.

Locate an image after selecting its server ID in that chat:

```sh
python3 scripts/wechat.py evidence image-locate --chat EXACT_WXID \
  --server-id SERVER_ID --out /path/to/new-image-manifest.json
python3 scripts/wechat.py images recover \
  --manifest /path/to/new-image-manifest.json --out /path/to/new-images
```

The locator cross-checks the message against the resource database using chat,
server ID, local ID and creation time. It reports the resource state and local
candidate files rather than treating the XML image hash as a filename. An
ambiguous resource hash stops. The resulting manifest includes its account and
can be passed directly to recovery. Existing bare manifest lists are also
accepted when `--account` is supplied. The locator only supports the inspected
local resource schema; a schema failure is a specific unsupported lookup,
not proof that no image exists.

Read the surrounding messages and inspect the recovered image. Keep proposed
amounts, transfer amounts, confirmations, and the referenced order distinct.
State the evidence time zone and separate an order date from a transfer date.
