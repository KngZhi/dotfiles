---
name: wizard
description: Create an interactive setup script when a workflow contains steps only the human can perform.
---

# Wizard

Use a wizard for the genuinely manual parts of the request. Complete work available
to the agent directly.

Inspect the relevant configuration and determine each manual step, where its value
comes from, where it belongs, and whether it is secret. Reuse scope already supplied;
ask only about unresolved choices. Verify current UI paths or commands before
presenting them as instructions.

Copy [template.sh](template.sh) and author the stages below its STAGES marker.
Keep its common helpers unchanged. Use hidden input for secrets, safe environment
updates, and confirmations at irreversible operations. Write only values needed
by the requested setup, respecting the user's shared credential conventions.

Check shell syntax and trace each captured value to its intended destination.
Use ShellCheck if available. Hand the script to the user with its exact run command;
an interactive wizard need not be run unattended by the agent.

Keep it in the requested scratch or scripts location. Commit a repeatable setup
path only when that is part of the workflow.
