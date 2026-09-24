---
name: reminders-cli
description: Read and manage Apple Reminders on macOS using keith/reminders-cli, including lists, due dates, notes, and completion status.
---

# Reminders CLI

Use the local `reminders` executable for Apple Reminders requests. Discover the
user's lists and use their requested list; ask when the destination is ambiguous.

## Access and command support

Run `command -v reminders` and `reminders show-lists --format json`. If the binary
is missing, follow the [official installation instructions](https://github.com/keith/reminders-cli#installation).
macOS may request Reminders access even for `--help`. If access is denied, the
user must enable the requesting app under System Settings → Privacy & Security
→ Reminders, then retry the read.

Use `reminders <subcommand> --help` as the authority for the installed release.
The upstream README can describe newer features: check help before using flags
such as `edit --due-date`, `edit --clear-due-date`, or `--include-overdue`.

## Read and identify

```sh
reminders show-lists --format json
reminders show "LIST" --format json
reminders show "LIST" --only-completed --format json
reminders show "LIST" --include-completed --format json
reminders show-all --due-date "today" --format json
```

Reads default to incomplete reminders. `--due-date` selects that calendar day;
for overdue work, fetch reminders and compare their dates in the user's timezone
unless the installed help offers an overdue flag.

Prefer the JSON `externalId` when editing or changing completion status. Match it
to the intended list, title, notes, and date before writing. Numeric indexes are
temporary: `edit` and `complete` resolve against incomplete items, while
`uncomplete` resolves against completed items. If an index is necessary, refresh
the corresponding unsorted list immediately before each mutation; indexes from
`show-all` or a combined completed/incomplete view are not interchangeable.

## Make the requested change

Replace `LIST`, `ID`, and reminder text with the selected values; quote arguments.

```sh
reminders add "LIST" "Reminder title" --due-date "tomorrow 9am" --notes "Details" --format json
reminders edit "LIST" "ID" "Updated title"
reminders edit "LIST" "ID" --notes "Replacement notes"
reminders complete "LIST" "ID"
reminders uncomplete "LIST" "ID"
```

Include a due date or notes only when the task calls for them. `edit --notes`
replaces existing notes. Editing operates on incomplete reminders; changing an
already completed item may need another supported interface. Use local help for
list creation, deletion, priorities, and other requested operations.

Resolve relative dates in the user's intended timezone and verify the saved
date/time. After a mutation, reread the list as JSON, including completed items
when relevant, and confirm the target's `externalId` and changed fields. If a
write times out or returns an ambiguous result, reread before retrying; an
unverified `add` retry can create duplicates. Report the verified list, title,
due date/time, and completion state as relevant to the request.
