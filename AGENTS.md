# Project decisions

- Reuse `StartupCard` for My Business private card and Directory grid card so they stay identical.
- Only Admin approval publishes a listing (DB trigger); Public view previews from business fields. Listing image is Admin-only (pending_cover → cover_image_url).
- Admin listing review renders MyBusinessProfiles in AdminReviewCtx so Admin sees the seller screen.
- Report offers/prices live in report-catalog.json; paid orders in report_orders(+_events); My Financials unlocks only on delivered orders.
- Deal steps: deal_pipelines/_events via pipeline.functions.ts only, after access checks; 'waiting on you' logic in pipeline-state.ts drives filters and badge.
- Messages: marketplace_messages keyed 'p:<pipeline>'/'a:<user>', membership via can_read_message_thread; pipeline events never copied.
- Private notes (private_notes) are server-only so the other party never sees them.
- Business Address stays on startups via shared StartupForm.
- Buyer My Company: buyer_profiles.investor_id links to the Investors Directory row (buyer-investor.functions.ts, service client scoped to caller); sellers get toPublic() only until NDA.
- My Financials/Valuation = one page (my-reports-page.tsx), prefs in seller_report_prefs.
- Page loading overlay is opt-in (meta.pageLoading); badges use light count functions.
- Seller LOI request's starting note lives in config/loi-request.json so its editable default can change without changing dialog behavior.
