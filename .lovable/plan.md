## Goal
- Remove **Inactive** from the Startup **Status** field (UI + DB).
- Add **Inactive** to the **Investment Stage** field as the last option, styled red (UI + DB).

## Changes

### 1. Database migration
- Migrate any existing `startups.status = 'Inactive'` rows to `'Archived'` (safe fallback; no rows currently affected per check).
- Drop and recreate `startups_status_chk` without `'Inactive'`:
  `('Draft','Active','Fundraising','Due Diligence','Portfolio','Exited','Archived')`
- Drop and recreate `startups_investment_stage_chk` adding `'Inactive'` at the end:
  `('Pre-Seed','Seed','Series A','Series B','Series C','Growth','Other','Inactive')`

### 2. `src/lib/startups.functions.ts`
- `STATUSES` (line 6): remove `"Inactive"`.
- `INVESTMENT_STAGES` constant: append `"Inactive"` at the end so the Zod enum + types stay in sync with the DB.
- The `StartupStatus` / `InvestmentStage` types regenerate from these arrays — no other type edits needed.

### 3. `src/components/startups/startup-form.tsx`
- `STATUSES` (line 46): remove `"Inactive"`.
- `STAGES` (lines 37–40): move `"Inactive"` to the very bottom of the array.
- In the Investment Stage `<Select>`, render `Inactive` via a `SelectItem` with a red text class (e.g. `className="text-red-600 focus:text-red-600"`) so it is visually distinct.
- If the loaded startup's current status is `Inactive` (legacy data), the select will simply show empty until the user picks a valid value — acceptable since DB is being cleaned.

### 4. Verification
- Typecheck.
- Load `/startups/new`: confirm Status dropdown no longer lists Inactive, and Investment Stage shows Inactive last in red.

## Out of scope
- Other pre-existing mismatches between the frontend `STAGES` list (`Series C+`, `IPO`, `Acquired`) and the DB CHECK — not requested.
- Investor / Deal status fields — request is Startups-only.