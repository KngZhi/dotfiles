---
name: linear-usage
description: Linear rules for handling, planning, or explaining reads, searches, issue creation or updates, comments, attachments, statuses, and relationships, including steps reached through another skill. Read the common rules and applicable reference in the current turn before answering or acting.
---

# Linear usage, planning, and explanations

When handling, planning, or explaining a Linear-related step, read this
entrypoint and the applicable reference in the current turn before answering
or acting, including a step reached through another skill. Then return to that
workflow. For a read-only planning or explanation task, skill-file reads are
part of preparation and happen before the answer.
Apply live channel and object checks below when the task calls for Linear operations.
Incidental historical mentions alone do not trigger this workflow.
Its description supports discovery; an explicit read instruction establishes
the dependency. A mention of Linear alone does not guarantee recursive loading.
Resolve relative reference paths from the directory containing this `SKILL.md`.

## Fixed operations

Use existing connectors, CLIs, or API clients. Read their tool schema or `--help`
for the operation; reuse an existing workflow script where it implements these
checks. This skill supplies the shared contract, rather than another API client.

1. Read [references/workspaces.md](references/workspaces.md). Resolve the
   intended workspace/team/project from the request and repository instructions.
   Verify the selected channel's viewer, organization, and target team before
   operating; a configured token or successful request alone does not prove the
   destination. Use separate environment variables for different workspace keys.
2. Read the current object and the context needed for this task: full body,
   metadata, parent and relevant children, relationships, comments, and Links
   attachments. Follow pagination on each required collection until its terminal
   page. Record the queried scope and as-of time; a truncated result is incomplete.
   New issues, comments, or attachments require a search for an existing match.
3. For a write, retain the object IDs and the pre-write values. Change only the
   requested fields and preserve concurrent or unrelated content. Pass real
   newlines through structured arguments or a body file. Apply the domain's
   writing and attachment rules before saving.
4. Fetch each changed object through the same verified workspace. Compare the
   saved fields, comment body, attachment target, and native relationships with
   the intended result. An accepted mutation without this readback is unverified.

### An uncertain write

A timeout or error can follow a successful mutation. Inspect the existing result
before any retry: read the known object ID, or search the intended scope for the
issue; paginate the target's comments or attachments for those operations.
Compare the intended content and relevant IDs, not just a generic success flag.

If the intended result exists, reuse it and continue only unfinished steps. Retry
only when a complete read establishes that the result is absent. When reads fail,
remain incomplete, or matches are ambiguous, stop that write and report the
unresolved result. Wait until an existing-result query establishes the outcome;
repeating a create while the outcome is unknown can duplicate it.

## Judgment and workflow routing

- **Engineering:** read `create-linear-issue` when creating, revising, or planning
  engineering issues. It owns the human/Agent sections, dependencies, milestones,
  and PR boundaries. Repository instructions select the project.
- **Chile business operations:** read
  [references/chile-operations.md](references/chile-operations.md), then the
  relevant chile-ops skill and SOP. They own the operator text, stage/checklist,
  order/container context, and document-link exceptions.
- **Other workspaces:** use their repository or operator conventions; verify
  live teams, states, and labels rather than borrowing the KngZhi mappings.

Existing standing authorization applies to task-scoped reads and writes. Ask
only for missing business facts or actions outside existing authorization.
Missing credentials or an unavailable channel block the dependent operation.
Respect an explicit read-only instruction.

Report the actual read or write, its verified destination and result, and any
incomplete verification. Installation proves the entrypoint is available;
observed invocation proves that a particular run loaded it.
