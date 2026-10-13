# Chile business operations

Use the explicitly selected chile-ops checkout, or the active chile-ops checkout,
as the source of business rules. Read its
`AGENTS.md`, `docs/workflow-index.md`, `docs/operating-model.md`, and the relevant
SOP before changing a business workflow or record. Only when no checkout is
specified and the active workspace is outside chile-ops, use its registered
installed location or `~/repo/chile-ops` as the fallback. Missing business context
is a fact to resolve, not a reason to substitute the engineering issue template.

Orders start from their Linear parent and its actual Links, body, children,
relationships, and comments. Apply `sop/purchase-order.md` and
`sop/post-order-follow-up.md` to the structure found there. Containers use
`sop/container.md`. Preserve supported older structures; a changed template
alone does not authorize migrating an existing order.

The repository's operator-text rule governs: 结论 → 要你做的事 → 依据, short
business Chinese with exact objects, dated quantities, units, and currencies.
Place work links and technical evidence in the parent issue's Links attachments;
keep commands, paths, skill names, and URLs out of business bodies and comments.
Preserve the SOP's explicit K2046 document-link exceptions, including required
parent and designated-stage-child placements; this default does not remove them.

The SOP owns stages, completion gates, deadlines, and the authoritative place
for VRO/Vin numbers. Use existing scripts to update those records and verify their
saved result. A script that lacks complete reads or write readback still needs
the corresponding checks; citing this entrypoint does not add those capabilities.
