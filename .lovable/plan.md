# Admin: paid report orders in Approvals and Startups Directory

Updates Approvals, the Startups Directory and the startup Financials tab in place. No new menu items; Listings and Buyers tabs are unchanged.

## 1. Data (one migration)
- `report_orders`: ref (RO-1042 style), startup, kind (financials | valuation | bundle), amount, currency, status (paid | generated | delivered | cancelled | refunded), paid_at, payment_ref, method, ordered_by, delivered_at/by, invoice_no, analyst. One active order per kind per startup. Due = paid + 2 business days.
- `report_order_events`: order, event (paid | generated | published | overdue), actor (or System), note, time.
- Admin-only access; sellers can read their own orders (so My Financials can switch to the read-only report once delivered).
- Overdue: one "overdue" event written when Approvals loads and an order is past due without being published.

## 2. Approvals header + tabs
- Eyebrow "APPROVALS & ALERTS", subtitle with listings · buyers · paid reports · overdue counts.
- Four tiles: Listings to review, Buyer verifications, Paid reports waiting (amber, overdue count), Delivered this week.
- "Alert settings" placeholder button. Tabs: Listings · Buyers · Paid reports · History (pill turns red when overdue).
- Sidebar Approvals badge adds paid reports.

## 3. Paid reports tab
Overdue amber strips, Show/Sort filters, table (Company, Report, Paid, Due countdown, Status pill, stacked actions: Open Financials / Review & publish / View report + Startup Directory link).

## 4. History tab
Listing, buyer and report events merged, newest first, grouped TODAY / YESTERDAY / date, 50 per page. Search, Type, Event, Period filters, Export CSV. Three-colour event pills, Detail column, no logos/avatars, stacked links.

## 5. Startups Directory
- "Report:" chip under a card only when an order exists (paid / overdue / generated · review / delivered).
- Amber strip on top of the panel (green once delivered) with order ref, paid/due dates and Open Financials; small "paid" chip on the Financials tab label.

## 6. Startup Financials tab
One strip above the existing overview: status title, order line with "details" toggle, Paid · Generated · Published dots, one action per state:
Generate from DBD (reuses the existing DBD refresh) → Edit figures + Verify & publish → Edit figures + Download PDF. Dashed empty state before generation. Valuation tab gets the same strip, Generate disabled until the financial report is published.
- Verify & publish marks statements verified, order delivered, writes the event, and unlocks the seller's My Financials read-only view.

## Limits
- Payments aren't turned on, so orders can't be created by sellers yet. I'll let the seller's current "Pay" button create a paid order (method "Manual", no charge) so the flow can be tested end to end.
- Seller email on publish needs an email domain; an in-app notification is sent instead for now.
- Download PDF will be a placeholder until a PDF generator is added.
