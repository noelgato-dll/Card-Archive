# Archive v0.2.35 — Other Custom Date Field Simplification

- Removed the special rule that automatically turned an Other custom field named `Date` into DD / MM / YYYY boxes.
- All Other custom fields now use the normal Value text input, including fields named Date.
- The standard Date [DD] [MM] [YYYY] row remains available by default for every collectible type, including Other.
- Existing Other custom field values, including previously saved Date values, are preserved as ordinary text. No migration or backup-format changes.
- Retains v0.2.34 Edit-button alignment and v0.2.33 character limits.
- No unrelated data, layout, or functionality changes.

## Browser tests
1. Add/Edit an Other item. Verify the standard Date row remains and defaults to the local current date on new items.
2. Add a custom field named `Date`; confirm its Value remains a normal single-line text input.
3. Reopen an Other item with an existing custom `Date` value and confirm the text is unchanged.
4. Confirm the Edit pencil remains on the right in Item Detail.
5. Verify ordinary custom fields and other item types still save and reopen.

## Static checks
JavaScript syntax and ZIP integrity passed. Browser testing pending.
