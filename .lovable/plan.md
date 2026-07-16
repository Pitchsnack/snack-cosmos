## Root cause

The Startup Edit form's "Investor Relationships" editor supports two kinds of rows:

- **Linked** — an existing investor picked from the search dropdown (has `refId`).
- **Pending** — a name typed by the user via *"Add … as pending"* (no `refId`, `status: "pending"`).

On save (`src/components/startups/startup-form.tsx` lines 266–268, 358, 402–439):

```ts
const investorIds = investorLinks
  .filter((l) => l.status === "linked" && l.investorId)
  .map((l) => l.investorId!);
```

Only **linked** rows are forwarded to the server via `investorIds` → `syncInvestors` (writes `startup_investors`). **Pending** rows are handed to `investorStartupLinksAdapter.saveStartupInvestorRelationships`, which is a documented **no-op stub** (`src/adapters/investorStartupLinksAdapter.ts` lines 184–190) awaiting the future SnackPortal2 API Gateway.

Because you added *Test1B* via the "Add \"Test1B\" as pending" affordance, no investor record was ever created and no row was inserted into `startup_investors`. The card query (`listStartups` → `related_investors`) correctly reads from `startup_investors`; it has nothing to show. Cache invalidation, chip rendering, and joins are all working — the link was never persisted.

So the three hypotheses resolve to:
- Card data refresh — **fine** (`qc.invalidateQueries({ queryKey: ["startups"] })` matches the list query prefix).
- Card query missing the relationship — **fine** (`startup_investors → investors(investor_name)` is joined).
- Stale chip component — **fine** (rerenders from fresh query data).
- **Actual cause:** pending investors never persist, and the UI gives no visible indication of this.

## What to change (frontend/UX only)

Keep persistence rules unchanged (no schema, no RLS, no new server fn beyond calling the existing `createInvestor`). Improve the UX so the user cannot silently lose a pending row.

1. **Editor UX — make "pending" explicit and actionable** (`relationship-links-editor.tsx`)
   - Add an inline hint on any pending chip: *"Not saved — needs an investor record."*
   - Replace the "Pending" badge affordance with two actions on each pending row:
     - **Create investor** — opens a lightweight inline form (name prefilled). On confirm, calls the existing `createInvestor` server fn (already used by `/investors/new`) for the active tenant, replaces the row with a linked one carrying the new `refId`.
     - **Remove**.
   - When picking Test1B from the editor's own search (fuzzy match), auto-promote a matching pending row instead of creating a duplicate.

2. **Save-time guard** (`startup-form.tsx`)
   - Before submit, if any `status === "pending"` rows remain, show a blocking confirm: *"N pending investors won't be saved. Create them now or remove them."* with **Create all** / **Remove all** / **Back to edit**.
   - Only proceed when zero pending rows remain, so `investorIds` reflects the user's intent.

3. **Toast copy on success** — after save, if links changed, toast "Saved. X investors linked."

4. **Card-side sanity** — no changes needed; verify via preview that after creating Test1B and saving Treetoscope, the chip appears on the card list (existing `["startups"]` invalidation already triggers refetch and `related_investors` includes it).

## Out of scope

- No changes to `investorStartupLinksAdapter` stubs, backend schema, RLS, triggers, `syncInvestors`, or `listStartups`. 
- No new tables, no realtime subscriptions.
- `VITE_WORKSPACE_ENFORCEMENT` behavior unchanged.

## Verification

1. Preview: open Treetoscope → Edit → Investor Relationships → type "Test1B" → *Create investor* inline → Save.
2. Return to `/startups` — Test1B chip appears on the Treetoscope card.
3. Repeat with an existing investor from the dropdown — still works.
4. Try saving with a pending row remaining — blocking confirm appears; nothing lost.

## Files touched

- `src/components/relationships/relationship-links-editor.tsx` — inline create/remove for pending rows, pending hint.
- `src/components/startups/startup-form.tsx` — save-time pending guard, toast copy.
- (mirror the same guard in `src/components/investors/investor-form.tsx` for symmetry, portfolio side.)

Nothing else.
