# Verified reports: Admin authorises the seller, the seller shares with each buyer

Updates existing screens only. No new pages or menu items.

## 1. Data (one migration)
- `report_shares`: business, buyer, financials, valuation, allow_download, shared/updated/revoked at + by. One active row per business + buyer; re-sharing after revoke adds a new row.
- `report_share_events`: share, event (shared | changed | revoked), by, detail, at.
- Service-role only (RLS on, no client policies); all reads/writes go through server functions.
- Existing report requests ("Asked {date}") and open logs ("opened {date}") are reused.

## 2. Admin › Approvals › Paid reports tracker
- Columns: Company (links to Directory card) · Report · Seller asked · Report ready · Seller can see it · one action.
- Actions: Generate report (runs the DBD refresh in place, spinner, retry on failure) → Authorise seller (one click, 6s Undo toast; notification + History event sent only after 6s) → View report.
- "Ready" comes from the startup's generated statements, so a report made before the order shows "before the seller asked".
- Show pills Waiting / Authorised / All, lock info line, overdue strip (paid > 2 business days, not authorised), new tiles SELLERS TO AUTHORISE / AUTHORISED THIS WEEK, subtitle, tab count and menu badge count waiting rows.
- Remove Due, Status, Sort and the stacked Directory link. History pill "Report published" → "Seller authorised"; filter "Published" → "Authorised".

## 3. Admin elsewhere
- Startup Financials page: remove the report strip (Refresh data stays). Same for Valuation tab.
- Startups Directory: card line "Report · seller can see it" / "can't see it yet"; remove panel strip and "paid" tab chip.

## 4. Seller › My Pipeline Financial & Valuation row
Six states (Buyer asked amber row, Not asked, Shared with chips + download/opened line, Revoked, No report, Ordered not ready) with matching buttons and card waiting text; filter counts follow. Buttons don't fold the card.

## 5. Share dialog (540px) and Manage access
Report cards with ticks, Allow download toggle, NDA end date line, notify line. Manage access variant with Shared pills, Revoke access, Save changes (disabled until changed), and an in-dialog revoke confirm.

## 6. Seller › My Financials › Who can see your reports
Panel above the report once a report is delivered: one row per active-NDA buyer with access chips, download, shared, last opened, Edit/Revoke or Share; "Share with a buyer" menu (arrow keys, Esc).

## 7. Buyer
- Notification on share. Row + Seller profile show "received {date} · View report".
- Viewer opens only shared reports; others show "not shared". Download disabled unless allowed (tooltip). After revoke or NDA end: "not received · Ask for it".

## Technical details
- New `report-shares.functions.ts`: listMyShares, shareReport, updateShare, revokeShare, buyer access check. Server check before any report leaves: order delivered + NDA approved and not ended + active share includes that report (+ allow_download for PDF).
- `report-orders.functions.ts`: `authoriseSeller` (= current publish, without notify/event), `undoAuthorise`, `finaliseAuthorise` (notify + event, called after 6s), `readyInfo` from financial_statements.
- `getPipelineReport` gains the share check; pipeline-state.ts gains the new waiting texts.

## Limits
- The seller email needs an email domain; an in-app notification is sent instead.
- The finalise step runs from the Admin's browser after 6s; if the tab is closed within 6s, the authorisation stays but the notification is sent next time Approvals loads.
