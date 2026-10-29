# Decisions
- Marketplace Contacts shares role UI; list/card reads recheck active NDA and owner/view access before shared projection, keeping Admin access separate.
- Admin contacts use a dedicated Control+Admin-authorized directory and separate admin_contact_notes, keyed by user ID; lazy company DTOs adapt shared cards without viewer controls, and profile/status/sign-in/NDA projections serve both Admin entry points without changing marketplace privacy.
- Seller founders use a browser-safe structured story helper and the existing founder bio plus nullable bio_story; existing startup authorization/saving and bio display gates remain authoritative.
- Pipeline chat uses the Messages Chat in a lazy locked presentation inside the existing ProfileBox dialog; Pipeline-parent in-memory drafts preserve unsent content without new storage or authorization paths.
- Pipeline full-profile dialogs reuse invitationPrivateProfile's selected-deal gate, the seller InvestorDetailPanel body and shared company identity/section/pill parts; only All deals/watchlist opt in so other profile viewers stay unchanged.
- Shared Pipeline card company chips use an own-organisation DTO sourced from each deal's startup or linked buyer firm; counterparty privacy fields and page-selected organisations are not chip sources, so pending/ended cards retain correct identity without changing NDA gates.
- Discovery Grid and Split-list cards share StandardBrowseCard through listing/investor adapters; watchlist wrappers own view state and existing DTO gates own privacy, so panels and List rows remain independent.
- Seller Connect flight is browser-only presentation using the stored invitation ID, shared Pipeline opening signal and public investor cover markers; invitation writes and authorization remain in the existing server function.
- Pending contact presentation uses the existing seller Connect, buyer verification and session DTOs with one shared focusable tooltip button; status is derived server-side from own approval records and request authorization is unchanged.
- Marketplace My Company, Pipeline and the Admin menu share WorkspaceSubmenu (Admin: toggleOnly rows never navigate); role colour vars default to amber at :root so the shared styles work outside the Marketplace.
- Live agreement cards use a browser-safe Bangkok calendar-day helper and a Pipeline-parent context for midnight updates and reload-only expansion reset; existing document dialogs and stored legal end dates remain authoritative.

- Listings publish only by Admin approval (DB trigger). Sellers pick via setMyListingImage; covers use picks only while sector-matched.
- Admin review uses MyBusinessProfiles in AdminReviewCtx; StartupCard serves My Business/Directory; private_notes stay server-only.
- Reports: reports-hub scopes company/deal reads; report_shares gates buyer DTOs. Private company_report_records hold analyst content. Sellers unlock on delivery; one seven-report hub reuses viewers and legacy redirects. Valuation generation needs usable peer-based inputs, not import alone.
- Deal steps: deal_pipelines/_events via pipeline.functions.ts only, after access checks; 'waiting on you' logic in pipeline-state.ts drives filters and badge.
- Messages share messages-page.tsx; check membership each call. admin-help.server.ts requires Control+Admin; latest receipt clears team unread; user DTOs hide admin identity. Users ?edit= opens editor; chat profiles read-only.
- Buyer My Company: buyer_profiles.investor_id links to the Investors Directory row (buyer-investor.functions.ts); sellers get toPublic() only until NDA.
- Loading: meta.pageLoading; LOI: config/loi-request.json; tour: marketplaceMenu/data-tour + mark_welcome_tour_seen().
- Listing covers: one rule in resolveCover (use-sector-images.ts), drawn by SectorArt — picked → oldest → drawn; private public-images bucket via server fns.
- Seller Browse uses listBrowseInvestors: code names, ranges, revenue minimum; investor-browse.ts filters public ranges, never exact figures.
- Buyer investor profiles go live only by Admin approval (buyer_profiles.approval_status, decideBuyerProfile); setBuyerListing sends unapproved profiles to review.
- Email alerts: wording defaults in src/config/email-alerts.ts, Admin overrides/switches in email_alert_settings; every send goes through sendAlert (email-alerts.server.ts), which checks the user switch and logs to email_alert_log; pipeline emails fire from pipeline log() so steps and emails never drift.
- Advisor view: users.advisor_view gates it; advisor stars live in advisor_favourites (view='advisor'), separate from buyer/seller saves; advisor-marketplace.tsx reuses existing cards/panels and only public loaders (listAdvisorMarketplace).
- Edit-at-section: My Company Edit/Add links pass ?section=; forms use EditSec + useOpenAtSection (edit-section.tsx).
- Sign-up answers live in signup_answers; finishSignup creates each role's Draft and records sign-up-answered fields so wizards skip them while set.
- Sellers edit only own businesses via is_startup_member policies; a guard trigger preserves tenant/visibility.
- Buyer identity: buyer_profiles.buyer_relation is who the buyer is; a representative's types live in investors.acts_for_types and every display/filter uses typeName/actsForText/sortActsFor in investor-bands.ts.
- One SetSectorPicker (common/set-sector-picker.tsx) everywhere — seller single radio, buyer/advisor up to 5 with Sector agnostic; buyers store agnostic as the "Sector Agnostic" entry in preferred_industries (advisors: sector_agnostic).
- saveMyBuyerInvestor/resolveBuyer: Admin (stored role + can_manage_investor, as Edit Investor) may edit any Directory investor; buyer-side fields go to the linked buyer's row (bpUser), never the caller's.
- Roles/plans: account_role checked in plan-access.server.ts + role_is() policies; plan values from plans, counts in plan_usage.
- Seller Connect: listing_invitations (one open per listing+investor) via invitations.functions.ts only; status derived server-side; contact_requests deprecated.
- Admin Plans publish atomically; public cards share the live-plan renderer.
- Contact enquiries: sendContactEnquiry (rate-limited); email-identity.ts drives replies and Sending rules.
- Edit information = one ?edit= pop-up (edit-info-popup.tsx); forms portal Cancel/Save into it, and Edit my startup holds the public view tabs so one Save stores both.
- Directory and valuation edit hosts reuse StartupForm, BuyerInvestorForm and FirmEditForm; page wrappers own dismissal so form saves cannot change the originating page.
- Browse/Favourites header, plan pill, NDA strip, match tags: browse-header.tsx; matches only via myBrowseMatches. Buyer Company Type follows buyer_relation (trigger).
- Soft-launch gate: AccessGate wraps public pages; codes/passes/claims checked only in access-gate.functions.ts; free-plan ends in free-plan.server.ts.
- Asking price: asking_price_thb + DB asking_price_band(); servers send priceFor() (asking-price.ts): exact only to Admin/own users/approved NDA, else the range. Advisor email live from owner.
- Listing names Admin-only (zz trigger); NULL = ref_no.
- Handover: run_by; profile-handover.functions.ts only.
- Buyer verification: one investor_profile_verifications row per investor via triggers; readers use profile-verification.server.ts; sellers get only investor_is_verified(). Control holds many profiles.
- workspace-scope.server.ts scopes sellers; Control sees all. Analytics: Admin readers, DB sign-ins.

- Sidebar sharing: email-bound retry-safe claims, no deletion or code seats/free plans; requests only to Help Desk.

- Company verification: whitelisted DTOs; selected-deal NDA + entitlement on buyer reads; DB-enforced quotas and six-check badge.

- Seller/buyer Pipeline uses shared workspace-page/cards and six child routes; invitations and counts share existing authenticated DTOs, and watchlist keys the stable pipeline ID so NDA approval preserves stars. Pipeline › Reports embeds the shared ReportsHub (buyer or per-buyer seller mode) behind a deal selector in workspace-reports.tsx — never a table; per-buyer extras there are gated by the pipelinePage prop so /my-reports and the pop-up stay unchanged.
- Invitation dialogs reuse extracted watchlist profile bodies; no route-module component imports and no private profile payload before a valid approved NDA.
- NDA Invitations: one row per NDA (linked requests show only on the invitation row); Invite again (invite_count ≤ 2) via inviteAgain; approval boxes come from nda-approval.tsx and the buyer's box shows once via deal_pipelines.buyer_approval_seen_at.
- Pipeline Investor/Seller profile box is read-only from getProfileBox (profile-box.functions.ts): private person/firm facts only while the NDA is approved and valid, else the public investor profile; nothing is stored.
- Seller's view of a buyer's private profile is InvestorDetailPanel with the buyer.seller option (private-investor-panel.tsx); private fields, media and portfolio come only from listSellerFavourites' approved-NDA gate, so directory changes show in both.

- Shared editor layouts use EditInfoPopup, CompactFields and common/business-address; directory create rows own transient highlighting/focus so editor state never changes permissions or saving rules.

- Buyer description counts and grandfathering use the browser-safe buyer-description helper in existing form/server validators; editor previews adapt unsaved public-only values into StandardInvestorCard, preserving existing persistence and authorization.

- DBD fetch-once store: dbd_company_records (per registration number) is the only source of DBD facts; writes only via DB functions dbd_store_save/dbd_store_delete/dbd_apply_edit (Control-checked, trigger-guarded); seller report tables are materialised copies and analyst edits re-apply after refresh.
- Subdirectories have their own AGENTS.md; read it before changing files there.
- Admin Paid reports uses paid-reports.functions.ts and paid-reports.ts for ordered and linked zero-order companies; no-orders presentation never stores readiness or unlocks seller access; linking uses dbd_link_startup only.

- Startups Directory list reads rows with deferMedia and fills card images via signStartupListMedia (RLS re-read) + useListMedia's browser cache; other listStartups callers still get signed URLs inline.
