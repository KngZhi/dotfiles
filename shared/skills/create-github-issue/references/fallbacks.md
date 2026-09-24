# gh fallbacks

## ID-based field editing

Use this when the installed `gh project item-edit --help` does not expose
`--field` and `--value`.

1. Read the Project ID with `gh project view`.
2. Read field and option IDs with `gh project field-list`.
3. Read the Project item ID from `item-add` output or `gh project item-list`.
4. Call `gh project item-edit` once per single-select field using `--id`,
   `--project-id`, `--field-id`, and `--single-select-option-id`.

## Browser fallback

Use the target repository's `Work item` Issue Form only when `gh` is genuinely
unavailable after the authorized authentication path has been exhausted. The
body contract is the same. Verify the created Issue in Project `1` and set the
same fields (`Status` `Todo`, the chosen `Work Type`, `Horizon` unset unless
requested) before reporting success.
