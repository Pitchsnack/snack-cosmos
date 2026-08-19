# Why "Not saved — needs a record" shows in Investor → Investment Portfolio

## What's actually happening

The Investment Portfolio editor accepts two kinds of rows:

- **Linked** — a real startup picked from the search dropdown (has a record id).
- **Pending** — a name you typed and added via *Add "X" as pending* (no record id).

Pending rows render the hint *"Not saved — needs a record."* (`relationship-links-editor.tsx:426`) because no startup record exists behind that name yet.

Two separate gaps, both confirmed in the code:

1. **Pending rows have no way to become real.** The editor supports a promote action (`onPromotePending`), but the investor form never passes one, so there is no "Create startup" button on a pending row — only remove.
2. **Even linked rows do not persist on the investor side.** On save, the investor form calls `investorStartupLinksAdapter.saveInvestorInvestmentPortfolio(...)`, which is a documented no-op stub. The startup form, by contrast, sends `investorIds` to the server and `syncInvestors` writes rows into `startup_investors`. The investor form has no equivalent, and it also never loads existing portfolio rows, so the editor is always empty when you re-open Edit Investor.

So: the hint is correct for pending rows, and separately the portfolio never saves at all today.

## Plan

### 1. Persist linked portfolio rows (investor → startup)
Reuse the same table the startup side already uses (`startup_investors`) — no schema, RLS, or migration changes.

- Add an optional `startupIds: string[]` input to the existing `createInvestor` / `updateInvestor` server functions in `src/lib/investors.functions.ts`, with a `syncPortfolio` helper mirroring `syncInvestors` (delete existing rows for this investor, insert the unique set with the investor's `tenant_id`).
- Load existing links: the investor detail query already selects `startup_investors(id, startups:startup_id(id, startup_name))`, so map those into `portfolioEntries` initial state in `investor-form.tsx`.
- Replace the stub adapter calls in `createM.onSuccess` / `updateM.onSuccess` with the linked ids passed through the mutation payload.

### 2. Make pending rows actionable
- Pass an `onPromotePending` handler into the Investment Portfolio editor that opens a small inline confirm and creates a minimal startup record via the existing startup create path, then swaps the pending row for a linked one.
- Keep the "Not saved" hint only for rows still pending.

### 3. Save-time guard
- If pending rows remain on submit, show a confirm: *"N pending companies won't be saved."* with **Create all / Remove all / Back to edit**, matching the behaviour planned for the startup side.

## Out of scope
No new tables, no RLS/policy changes, no changes to `syncInvestors` or the startup form's persistence path, no changes to the adapter's other stubs.

## Verification
1. Edit an investor → add a portfolio company from the dropdown → Save → re-open Edit: the row is still there.
2. The linked startup's card/detail shows the investor under its investors list (same table, both directions).
3. Type a new name → *Create startup* → row becomes linked and saves.
4. Leave a pending row → save → guard appears, nothing lost silently.

## Files touched
- `src/lib/investors.functions.ts` — `startupIds` input + `syncPortfolio`.
- `src/components/investors/investor-form.tsx` — load existing links, send linked ids, promote handler, pending guard.
- `src/components/relationships/relationship-links-editor.tsx` — only if the promote affordance needs a label tweak.
