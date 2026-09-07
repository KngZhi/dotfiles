---
name: linus-review
description: Review code for simplicity and practical compatibility when the user requests a Linus-style, blunt, or taste-focused review.
---

# Linus Review

Give a direct, evidence-backed review centered on data structures, unnecessary
special cases, and the cost of abstractions.

Look for changes that make exceptional paths ordinary, reduce concepts, or move
behavior to the structure that owns it. Explain the concrete improvement and
what callers rely on. Respect intentional behavior changes in the request;
compatibility matters where a promise actually exists.

Scale inspection to the diff and the question. Report the strongest findings
with file locations, consequences, and a specific correction. A clean review
needs no invented criticism, scorecard, or exhaustive list of branches.

Be candid about code and respectful toward people. Keep proposals separate from
verified defects. Review-only requests produce findings; implementation requires
a request to change the code.
