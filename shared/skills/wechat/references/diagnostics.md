# Diagnostics and repair

Run `python3 scripts/wechat.py doctor --json` and inspect each check. Exit status
alone is not proof of complete history or attachment access. A missing MCP
facade is optional because the same backend is available through the CLI.

The backend's `skill` check still expects the older `wechat-decrypt` discovery
link. Its warning is expected after consolidation when the current `wechat`
entry resolves to the persistent shared source. Verify that entry and its
resources; keep the single catalog entry. Key, database and key-database
failures still block history reads.

Resolve `scripts/wechat.py backend` before reading the corresponding upstream
reference. The backend checkout contains the full platform setup, recovery
scripts, requirements, and license; do not duplicate its engine into this skill.

| Condition | Upstream reference and next check |
|---|---|
| macOS key missing or invalid | `references/macos.md`; confirm account, app version, existing private state and device key. |
| Windows key missing or invalid | `references/windows.md`; confirm the active account and local plaintext mirror. |
| A date range or shard is missing | `references/db-repair.md`; inventory live and quarantined shards and measure the gap. |
| Optional voice dependency or model absent | `references/export-transcription.md`; continue text work and scope voice setup separately. |
| V2 `.dat` export skipped | Use the bundled [image procedure](images.md), which does not need a database key. |

Run a backend Python helper without copying it:

```sh
python3 scripts/wechat.py backend-script scripts/common/rebuild_from_factory.py \
  /path/to/selected-factory-copy -o /path/to/private-rebuilt.db --verify
```

Recovery works on copies. Verify rebuilt output and back up before any restore.
Restoring into the live WeChat database is a distinct action with visible app
effects. A successful integrity check does not prove that every message exists.
Keep shard-local sender mappings when comparing recovered and live data.

Daily search and export do not require changing the app signature, extracting a
new key, restarting WeChat, or changing SIP. Extraction can close WeChat and
require a QR login; macOS methods can change the official signature. Explain the
specific required action before a repair that changes the app or security
state. Use existing valid private state first. Do not infer permission for an
app or security change from a request to search history or recover one image.

Upstream setup can register a separate legacy skill link. Check its current
behavior before running it so the unified catalog remains owned by the dotfiles
build. Preserve private key/configuration files and existing MCP paths. After a
repair, rerun doctor and one bounded query that exercises the original failure.
