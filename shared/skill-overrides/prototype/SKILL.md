---
name: prototype
description: Build a small throwaway artifact to answer a concrete question about behavior, state, or UI.
---

# Prototype

Identify the question from the request and current context. Choose an artifact
that lets the user inspect the uncertain behavior quickly.

- For logic or state transitions, read [LOGIC.md](LOGIC.md).
- For visual layout or interaction, read [UI.md](UI.md).

Follow existing project conventions and mark experimental code clearly.
Make it easy to run, expose the relevant state, and use disposable data.
Add only the handling needed for a credible demonstration.

Inspect the result against the question and report what was learned and what
the prototype cannot prove. Preserve a useful artifact at the agreed location.
Production integration, commits, and issue publication happen only when included
in the user's request; a prototype alone does not authorize them.
