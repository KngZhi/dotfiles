---
name: improve-codebase-architecture
description: Find worthwhile module-boundary improvements and explore the candidates with the user.
disable-model-invocation: true
---

# Improve Codebase Architecture

Inspect the requested area. If none is named, use recent changes and recurring
maintenance friction to choose useful starting points.

Look for behavior that requires understanding too many scattered details,
interfaces that expose internal sequencing, and boundaries that make realistic
verification difficult. Trace the callers and ownership before recommending a
change. Respect existing domain terms and decisions.

Use codebase-design when its interface vocabulary helps. A candidate should state
the observed problem, affected paths, proposed improvement, tradeoff, and smallest
meaningful verification. Do not invent candidates to fill a report.

Present the strongest options in a concise report. An HTML report with before/after
diagrams is useful when there are several relationships to compare; a small finding
may be clearer in text. Choose format from the requested deliverable.

If the user asked for an audit, finish with recommendations. If they asked to
improve a specified area, continue the authorized work. Ask them to choose only
when alternatives require a material product or architectural decision.
