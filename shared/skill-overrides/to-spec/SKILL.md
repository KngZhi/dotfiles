---
name: to-spec
description: Turn the agreed conversation into a specification, saving or publishing it as requested.
disable-model-invocation: true
---

# To Spec

Synthesize the current conversation and relevant project evidence. Preserve
decisions and uncertainty; ask only when an unresolved point would materially
change the outcome.

Describe the problem, desired behavior, scope, acceptance criteria, important
implementation decisions, and verification approach. Include user stories only
when they clarify distinct needs. Match detail to the work; completeness is
coverage of requirements, not the length of a template.

Use concrete interfaces or paths when they clarify the agreed contract. Identify
them as current evidence rather than permanent truths.

Reuse the project's artifact and tracker conventions. When the user requests
GitHub publication in a KngZhi repository, follow create-github-issue for the
shared Project fields and body contract. A local spec or conversational draft
needs no tracker setup or publication.

The result is complete when an implementer can distinguish required behavior,
open decisions, and how success will be checked.
