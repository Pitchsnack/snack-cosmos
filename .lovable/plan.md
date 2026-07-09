## Goal
Match PitchSnack1: one combined input in `RelationshipLinksEditor` that both searches existing records and adds pending names.

## File
`src/components/relationships/relationship-links-editor.tsx` (only)

## Changes

1. **Placeholders**
   - investors: `Search investors or type a new name...`
   - startups: `Search startups or type a new name...`

2. **Remove pending block**: delete the second `<Input>` + "Add Pending" `<Button>`, and the `pendingDraft` state. Drop the unused `Plus` import if no longer referenced.

3. **Refactor `tryCreatePending`** to accept a `name: string` argument (instead of reading `pendingDraft`). Same duplicate-check flow via `investorStartupLinksAdapter.checkInvestorDuplicates` / `checkStartupDuplicates`; opens `DuplicateWarningDialog` on candidates, else calls `commitPending(name)`.

4. **Combined dropdown**: while `debouncedQuery.length > 0`, keep existing suggestions list. Compute:
   ```ts
   const exactMatch =
     suggestions.some(s => s.name.toLowerCase() === debouncedQuery.toLowerCase()) ||
     rows.some(r => r.name.toLowerCase() === debouncedQuery.toLowerCase());
   ```
   When `!exactMatch && debouncedQuery.length > 0`, append a final `<li>` at the bottom:
   - Label: `Add "<debouncedQuery>" as pending`
   - onClick: `tryCreatePending(debouncedQuery)`
   Remove the "No matches." message when the add-pending row is shown (still show it if searching yields nothing AND that row also isn't relevant — but since a non-empty query with no match always yields the add-pending row, the "No matches" line becomes unreachable in that case).

5. **Enter key** on the search `<Input>`: if `Enter` pressed, `query.trim()` non-empty, and no exact match → `e.preventDefault()` and `tryCreatePending(query.trim())`.

6. **Cleanup after add**: `commitPending` also clears `query` and `debouncedQuery` (dropdown closes). `addRow` already clears both — keep as-is.

7. **Update `EMPTY_STATE`** wording so it no longer references a "below" pending field:
   - investors: `No investors linked yet. Search to link one, or type a new name to add a pending investor.`
   - startups: `No portfolio companies yet. Search to link one, or type a new name to add a pending company.`

## Preserve
Search icon, 200 ms debounce, `listInvestors`/`listStartups` calls + query keys, `DuplicateWarningDialog`, `dupOpen`/`dupCandidates`/`dupTypedName`, `commitPending`, `linkCandidateFromDialog`, toolbar (≥11 threshold), grouping, chips, relationship-type Select, remove button, error surface, card layout. No backend/schema/RLS/adapter/server-fn changes.

## Verification
- `/startups/new` and `/startups/:id/edit`: single input with exact placeholder.
- Typing existing investor → dropdown shows it → click links it.
- Typing new name → dropdown shows `Add "<name>" as pending` row → click adds pending row with badge.
- Enter on non-empty non-matching query → same add-pending flow.
- Near-match name → `DuplicateWarningDialog` opens as before.
- `mode="startups"` (investor form's portfolio editor): placeholder becomes `Search startups or type a new name...`; both flows still work.
