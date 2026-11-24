# Remove buyer "Revenue in {year} (THB)" and show DBD revenue vs ticket size in Admin review

## What was found
- The value lives only in `buyer_profiles.revenue_band` (no seller table uses a column of that name). 1 of 27 buyer profiles has a value.
- Sellers' revenue uses separate data (`last_year_revenue` / story sales) and stays untouched.

## Steps
1. **Re-check the column is buyer-only** in the database (views, triggers, functions, policies that mention `revenue_band`). If anything else uses it, stop before the drop and report it.
2. **Save a CSV copy** of every buyer value (buyer ref, company name, value, last updated) to `/mnt/documents/buyer-revenue-band-backup.csv`.
3. **Remove the field for buyers**
   - Edit information / Review & complete › About Company: remove the "Revenue in {year} (THB)" dropdown and its New tag; Contact number keeps its place and width, the old slot stays empty.
   - "Review your company data" pop-up (Exclusive view): remove the buyer "Revenue in {year}" row (both the My Company and Admin review sources).
   - Server save schema, select lists, autosave/review-draft keys and `buyer-listing-text` reading of it.
4. **Admin › Approvals › Buyers › Verification**: replace the buyer Revenue comparison with **Revenue vs ticket size**:
   - From the buyer: "Ticket size {band}"
   - Company verification: "{amount} in the {year} accounts filed with DBD" + "DBD financial statements", or grey "No filed accounts"
   - Result: grey "Shown, not compared"; excluded from match/differ/by-hand totals and from Verify and publish "Still open". {year} = latest filed DBD year.
   - Individual buyers keep "Not needed". Seller revenue row unchanged.
   - Thai: รายได้เทียบกับขนาดเงินลงทุน / ขนาดเงินลงทุน {band} / แสดงเพื่อประกอบการพิจารณา / ไม่มีงบการเงินที่ยื่นไว้.
5. **Drop the column** with a migration (`drop_buyer_revenue_band`) after code no longer refers to it; regenerate types.
6. **Check (look only)** with buyer pitchsnack+corporate@gmail.co.th and Admin admin.acme@prd2.test at 1440px EN, plus Thai; tests for the new row's totals exclusion; two screenshots to Files.

## Technical notes
- Files: `buyer-investor-edit.tsx`, `buyer-my-company.tsx`, `buyer-investor.functions.ts`, `approvals-one-step.functions.ts`, `one-step.server.ts` (new `ticketVsRevenueRow`, result kind `shown`), approval totals/"Still open" counting, `review-company-dialog.tsx`, `buyer-listing-text.ts`, Thai dictionary.
- The drop is a breaking schema change; it may need the "backward incompatible migrations" permission approved.
