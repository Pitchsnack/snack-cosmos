# Project decisions

- Reuse `StartupCard` for the My Business private card and Startup Directory grid card so their presentation stays identical.
- Preview anonymous Public view from business fields before listing; only Admin approval publishes, enforced by DB trigger.

- Public listing image is Admin-only (hidden_profiles.pending_cover, promoted to cover_image_url on approval); sellers never write it — keeps Marketplace cards consistent.
- Admin listing review renders MyBusinessProfiles inside AdminReviewCtx instead of separate admin tables, so Admin sees exactly the seller screen.
- Seller report offers live after the shared founder section via an optional slot; keep samples and prices in report-catalog.json so Directory cards remain unchanged and preview-only offers cannot be mistaken for paid orders.
- Paid report orders live in report_orders/report_order_events (report-orders.functions.ts); seller My Financials unlocks only when the order is delivered, replacing the localStorage bypass — Admin must generate and publish.
- Buyer↔seller deal steps live in deal_pipelines/deal_pipeline_events (pipeline.functions.ts); writes only via server functions after checking buyer or startup access, so neither side can skip a step.
- Pipeline 'waiting on you' logic lives in pipeline-state.ts and drives both Tracking filters and the Pipeline menu badge, so the counts never drift; buyer report opens are logged server-side in getPipelineReport.
- Marketplace messages live in marketplace_messages/marketplace_message_reads keyed 'p:<pipeline id>' or 'a:<user id>' (messages.functions.ts); membership is checked server-side via can_read_message_thread and pipeline events are read from deal_pipelines, never copied as messages.
- Private notes live in private_notes with owner overrides; server-only access hides them from the other party.
- Keep Business Address on startups through shared StartupForm so seller and Control use one saved field.
