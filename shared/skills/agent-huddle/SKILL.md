---
name: agent-huddle
description: Consult the other coding agent for a second opinion when technical uncertainty remains after a normal investigation.
---

# Agent Huddle

Use a second opinion when another reasoning pass could resolve a hard diagnosis
or disputed technical conclusion. Credentials, product choices, and authorization
remain the user's decisions.

Run the bundled bridge with the other agent: `--ask claude` from Codex, or
`--ask codex` from Claude. Resolve the script relative to this skill's directory.

```bash
scripts/huddle.sh --ask <claude|codex> '<question, evidence, attempts, current hypothesis>'
```

The prompt must stand alone. Treat it as shell data and omit secrets. Use
`--resume-last` for a follow-up when retaining the consultation context helps.

The bridge runs Claude in plan mode and Codex in its read-only sandbox.
These are CLI controls, not an OS-level isolation guarantee; treat the result
as advice. The script's `AGENT_HUDDLE_ACTIVE` guard prevents nested consultations.
If you are the consulted agent, answer directly.

Stop consulting when another round would not add new evidence or a different
angle. Then continue with the strongest available evidence if the decision is
safe and within scope; ask the user only when a material uncertainty or required
authority still prevents progress.
