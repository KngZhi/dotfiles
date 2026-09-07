---
name: agent-huddle
description: Ambient policy for consulting the other coding agent (Claude Code ↔ Codex CLI) when genuinely stuck on a technical problem, before escalating to the user. Loaded automatically by both tools — no explicit invocation needed.
---

# Agent Huddle

You and the other agent (Codex if you're Claude Code; Claude Code if you're Codex) can act as consultants for each other. When you hit real technical uncertainty, get a second opinion from the other agent before pulling in the user — but only when a second opinion could actually help.

## When to consult

Only for genuine technical uncertainty or disagreement that another reasoning pass could resolve:

- You've ruled out the obvious causes of a bug and are still stuck.
- Two plausible approaches with real trade-offs and no clear winner.
- You suspect your own conclusion but want it stress-tested before acting on it.

Do NOT consult for:

- Anything only the user can decide (credentials, business/product choices, ambiguous requirements, destructive or irreversible actions).
- Routine errors a normal debug loop would resolve on its own.
- A way to get permission or approval — that's the user's job, not the other agent's.

## How to consult

Run the bridge script, asking for the **other** agent:

```bash
~/repo/dotfiles/shared/skills/agent-huddle/scripts/huddle.sh --ask <claude|codex> "<the problem, what you've already tried, and your current best guess>"
```

- Pass `--ask claude` if you are Codex; `--ask codex` if you are Claude Code.
- Include enough context in the prompt to stand alone — the other agent has no memory of your session and cannot see your conversation.
- The call is best-effort read-only/advisory: Claude runs in `plan` permission mode, Codex runs in its `read-only` sandbox. These are the strongest built-in no-edit guarantees each CLI offers, not an OS-level sandbox — treat the reply as advice, not as something that's guaranteed to have touched nothing. (Known upstream gap: [openai/codex#15524](https://github.com/openai/codex/issues/15524) — a nested `codex exec -s read-only` call can fail to enforce read-only. The recursion guard below closes off the specific nesting path that would trigger it here.)
- Do not attempt to consult the other agent from *inside* a huddle call — the script hard-blocks this (`AGENT_HUDDLE_ACTIVE` env var) and will exit immediately. If you're the consulted agent, answer directly.

## Round cap

- Consult at most **3 times** per issue: one fresh call, then up to two follow-ups with `--resume-last` (cheaper — continues the same thread instead of re-pasting context).
- After each reply, decide: resolved → proceed; still uncertain and under the cap → one more round.
- Hit the cap without convergence → stop consulting immediately. Never loop past 3 calls on the same issue.

## Escalation

If the two of you don't converge within the round cap, stop and hand it to the user: state your position, the other agent's position, and exactly where they diverge. Don't silently pick a side.
