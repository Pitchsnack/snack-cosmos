# Fix shared startup pickers

## Changes
- Move both shared dropdown panels into the existing portal-based popover so card overflow cannot clip them.
- Give each option list a bounded height and its own vertical scrolling.
- Add standard listbox keyboard behavior: Arrow Up/Down moves through options, Enter selects, and Escape closes.
- Keep the existing sector grouping, search, availability badges, and save callbacks unchanged.

## Verification
- On Valuation, scroll to and select the final sector option, then select the final business model; confirm each save refreshes the match.
- Confirm the same shared pickers scroll, select, and respond to keyboard controls on New Startup and Edit Startup.
- Check desktop rendering and current build diagnostics.
