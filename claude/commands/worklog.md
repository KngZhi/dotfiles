# Session Worklog

Summarize this conversation and append the summary to the worklog file.

Optional user notes: $ARGUMENTS

## Instructions

1. Review the entire conversation and identify:
   - Main topics and tasks worked on
   - Key decisions made and their reasoning
   - Files created, modified, or deleted
   - Problems solved
   - Open items or unresolved issues

2. Determine the current project from the working directory basename.

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

5. If the user provided $ARGUMENTS, incorporate those notes into the summary.

6. Keep the summary concise — aim for 5-15 lines total. Focus on what would be useful to recall in a week.

7. After writing, confirm with the file path and a one-line preview of what was logged.