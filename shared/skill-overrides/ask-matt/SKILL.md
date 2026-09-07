---
name: ask-matt
description: Choose a skill or workflow for the user's current task.
disable-model-invocation: true
---

# Choose a Workflow

Recommend the smallest useful workflow from the installed catalog. Ordinary work
can proceed directly; a chain of skills is optional.

| Need | Suggested skill |
| --- | --- |
| Challenge an idea | grilling, or grill-me |
| Explore and save agreed terms/decisions | grill-with-docs |
| Resolve a large uncertain plan over time | wayfinder |
| Turn an agreed conversation into a spec | to-spec |
| Split work into dependent tickets | to-tickets |
| Implement a defined outcome | implement |
| Work test-first | tdd |
| Investigate a bug | diagnosing-bugs |
| Review changed code | code-review |
| Simplify a whole codebase | reclaim-code-entropy |
| Explore module boundaries | codebase-design |
| Survey architecture improvements | improve-codebase-architecture |
| Try a design concretely | prototype |
| Manage incoming issue triage | triage |
| Prepare manual setup steps | wizard |
| Hand off to another session | handoff |
| Teach in a learning workspace | teach |
| Ask someone else for missing knowledge | to-questionnaire |
| Re-explain a confusing answer | wait-what |
| Write agent-facing instructions | writing-for-agents |

Check availability before recommending a skill. Names here describe choices,
not a requirement to invoke every stage. Research can use the host's tools
directly; agreed domain terms can use the project's existing documents.

Use setup-matt-pocock-skills when the user wants shared tracker/document conventions,
not as a prerequisite for an isolated review, bug fix, or specification.
