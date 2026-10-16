---
name: wechat
description: Search and export authorized local WeChat (微信) history, inspect messages and attachments, recover V2 or WXGF images, transcribe voice, and diagnose local access. Use for chats, groups, contacts, payment evidence, or local archives.
---

# WeChat

Use this entrypoint for local WeChat work. It combines the installed history
backend with bundled image recovery. Operate on the user's authorized account
and requested scope. Keep keys, chat exports, images, and databases local unless
the user names a destination. Never print a raw key. Use local files and tools
for queries. Do not control the WeChat app through Computer Use.

## Scripts

Set `SKILL_DIR` to this skill's directory. First run the read-only diagnostic:

```sh
python3 "$SKILL_DIR/scripts/wechat.py" doctor --json
```

A failed key or database check blocks history reads. Optional MCP or voice
warnings do not block text queries or independent image recovery. Resolve the
requested account and contact before reading data. Ask for a choice when
multiple identities remain plausible.

| Request | Procedure |
|---|---|
| Groups, contacts, recent messages, search, events, statistics | Read [history](references/history.md). |
| A specific date, a payment, full message text, or attachment identity | Use the scoped evidence helper in [history](references/history.md). |
| A `.dat` image, unreadable image export, or screenshot matching | Read [images](references/images.md), then run the bundled recovery. |
| Documents, voice, or a chat export | Read [attachments and exports](references/attachments.md). |
| A missing key, missing messages, a damaged shard, setup, or a WeChat update | Read [diagnostics](references/diagnostics.md). |
| An old wx-cli, backup, MCP, or automation installation | Read [existing tools](references/existing-tools.md). |

`wechat.py backend` prints the resolved backend and interpreter paths. The
normal backend is the sibling dotfiles skill pack. `WECHAT_BACKEND_DIR` selects
an existing alternative checkout; `WECHAT_PYTHON` selects its interpreter.
Images use the Python that launched the entrypoint, or `WECHAT_IMAGE_PYTHON`. Paths
are resolved at runtime, including when this skill is reached through a link.

## Judgment

Use a bounded date range and message limit. Preserve the message IDs, shard,
sender identity, and explicit time zone for claims about money or attribution.
Read surrounding messages and the actual receipt when available. A proposed
amount, a sent image, and a receipt confirmation are separate pieces of evidence.

When the ordinary media exporter skips V2 images, continue with the image
procedure. Inspect all WXGF planes. Confirm the useful image visually, and call
a thumbnail a thumbnail. Local decoding cannot restore missing detail or fetch
an image that was never downloaded.

Stop on a failed prerequisite and report the exact missing condition. A key
diagnostic, a text query, an attachment locator, and a decoded image prove
different steps. Report the step that actually passed.
