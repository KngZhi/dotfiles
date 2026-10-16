# Existing tools and older installations

The canonical entrypoint is `wechat`. The dotfiles build retains the complete
`tzwkb/wechat-decrypt` pack as its backend while excluding the old duplicate
catalog entry. Existing MCP commands that point to that checkout keep working.
Use `WECHAT_BACKEND_DIR` when the configured working backend is elsewhere.

The older `wechat-local-image-recovery` code and format references now live in
this skill. A retained Hermes copy is historical material; use the bundled
scripts for current tasks. Do not delete private files, keys, or another
checkout while consolidating discovery.

| Existing installation | How to use it |
|---|---|
| `wx-cli` or `wx-cli-again` | Inspect its version, help and read-only doctor. An installed binary or a successful diagnostic does not prove initialization, key coverage or readable chats. Keep it as an alternative when its data path is verified; avoid initializing or extracting keys as a fallback to a text query. |
| Another `wechat-decrypt` checkout or MCP | Check its configured command and interpreter, then doctor and a bounded read. Matching repository names do not establish matching private state. Never migrate or print raw keys to make paths look uniform. |
| WeChat backup or a local vault | Confirm whether it is encrypted app data, a plaintext export, an attachment cache, or a full backup. Preserve the original and query a working copy. State its coverage date and missing shards or media. |
| Sending or UI automation tools, including WeChat-MCP and wx4py | History access does not authorize sending. Do not operate WeChat through Computer Use on this host. Read-only file recovery is the default for an attachment task. |

When a previous session solved the same failure, search its history for the
actual script, inputs, output, and verification. Treat old success as a route to
retest, and distinguish it from current evidence. Runtime availability and
format support can change after an app update.
