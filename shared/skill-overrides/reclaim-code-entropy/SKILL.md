---
name: reclaim-code-entropy
description: Audit or remove unnecessary codebase complexity when the user requests repository simplification, dead-code removal, or 熵回收.
---

# Reclaim Code Entropy

Find maintenance surface with no current purpose. Audit requests produce ranked
findings; requests to apply or simplify authorize the corresponding in-scope edits.

Start from the requested area and actual consumers. Inspect repository guidance,
relevant history, and runtime entrypoints. Scanners supply candidates, not proof
that deletion is safe.

## Prove a candidate

Look for unused surfaces, duplicate state, forwarding layers, abandoned features,
and custom mechanisms already covered by the current stack. For a promising cut,
verify direct and dynamic callers, public or persisted contracts, lifecycle
ownership, and the reason the code exists. Trace only the relationships relevant
to that candidate; not every cut needs a full-system inventory.

Explain what would disappear, what behavior must survive, and the smallest check
that would expose a wrong deletion. Keep or downgrade uncertain candidates.
Security boundaries, data compatibility, and resource cleanup remain necessary
when they carry real obligations.

## Apply and verify

Remove a proved duplicate or obsolete path through its actual consumers. Preserve
tests of surviving behavior and user changes. Prefer existing capabilities over
replacement frameworks; net line reduction alone is not the goal.

Run the decisive check first and any required repository gates. Broaden validation
when the change spans more consumers or reveals uncertainty. If a check fails,
repair the change or withdraw the candidate rather than weaken the check.

Report the strongest findings or completed cuts with locations, consequences,
and verification. Finding nothing worth removing is a valid result.
