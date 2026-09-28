# Project decisions

- Reuse `StartupCard` for the My Business private card and Startup Directory grid card so their presentation stays identical.
- Show an anonymous Public view preview from existing business fields even before a listing exists; keep startup publication unavailable so owners can inspect without exposing it to buyers.- Marketplace listings go live only through Admin approval (approvals.functions.ts); a DB trigger blocks sellers from setting live/decision fields so they cannot self-publish.

- Public listing image is Admin-only (hidden_profiles.pending_cover, promoted to cover_image_url on approval); sellers never write it — keeps Marketplace cards consistent.
- Admin listing review renders MyBusinessProfiles inside AdminReviewCtx instead of separate admin tables, so Admin sees exactly the seller screen.
- Seller report offers live after the shared founder section via an optional slot; keep samples and prices in report-catalog.json so Directory cards remain unchanged and preview-only offers cannot be mistaken for paid orders.
- Paid report orders live in report_orders/report_order_events (report-orders.functions.ts); seller My Financials unlocks only when the order is delivered, replacing the localStorage bypass — Admin must generate and publish.
- Buyer↔seller deal steps live in deal_pipelines/deal_pipeline_events (pipeline.functions.ts); writes only via server functions after checking buyer or startup access, so neither side can skip a step.
