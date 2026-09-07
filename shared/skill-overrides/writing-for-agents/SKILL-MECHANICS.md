# Skill Mechanics

Keep the name stable and the description short and discriminating. The description
helps selection; the body carries the workflow. Preserve supported host metadata
and existing invocation policy unless the user wants it changed.

Hosts differ in how they expose skills. Use the host's supported metadata for
explicit-only invocation; a sentence claiming automatic loading is not an
installation mechanism. Keep Claude's disable-model-invocation and Codex's
agents/openai.yaml policy consistent when both are present.

Refer to another installed skill only when it provides a needed capability.
Ordinary references can be linked directly. A router recommends useful workflows;
it need not turn every task into a sequence of skill invocations.

For substantial edits, use skill-creator's validation guidance. Check that linked
references and scripts are shipped with the deployed skill, not just present in
the author's checkout.
