---
name: worklog
description: Summarize the current conversation session and append a structured entry to the worklog. Use when the user asks to log, summarize, or record what was done in this session — e.g. "write worklog", "log this session", "总结这次会话", "记录一下".
---

# Session Worklog

Summarize the current conversation and append the summary to the daily worklog file.

## Steps

1. Review the entire conversation and identify:
   - Main topics and tasks worked on
   - Key decisions made and their reasoning
   - Files created, modified, or deleted
   - Problems solved
   - Open items or unresolved issues

2. Determine the project name from the working directory basename.

3. Create or append to `~/repo/org/worklog/YYYY-MM-DD.md` (use today's date). If the file doesn't exist, start it with a `# Worklog YYYY-MM-DD` header.

4. Append an entry in this format:

```markdown
### HH:MM — [project-name] — [one-line summary of session]

**What was done:**
- [concise bullet points]

**Decisions:**
- [key decisions and why, omit section if none]

**Files changed:**
- `path/to/file` — [what changed]

**Open items:**
- [unresolved issues, omit section if none]
```

5. If the user provided additional notes, incorporate them into the summary.

6. Keep the summary concise — aim for 5-15 lines total. Focus on what would be useful to recall in a week.

7. After writing, confirm with the file path and a one-line preview of what was logged.
