---
name: to-questionnaire
description: Prepare questions for another person whose knowledge is needed to resolve a decision.
disable-model-invocation: true
---

# To Questionnaire

Identify the recipient, what they know, and the decisions or facts needed from
them. Use existing context; ask the user only for missing information that changes
the questionnaire.

Write a Markdown document at the requested location, or a clearly named file in
the current workspace. Include its purpose, intended recipient, enough background,
and the most important questions first. Group by theme when that improves scanning.

Each question should request one answer and provide room for it. Explain why it
matters only when that is not obvious. Invite partial answers and explicit unknowns.
Include a deadline or time estimate only if supported by the user's context.

Verify that the questions cover the stated information gaps. Report the document
path; creating a questionnaire does not authorize sending it to the recipient.
