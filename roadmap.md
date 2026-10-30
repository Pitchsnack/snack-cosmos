# One-step approval — roadmap

## Buy-order Share pop-up — 30 October 2026
- [x] Restore shared dialog padding, grey text, industry icon and bordered/focused email input; preserve text, validation and sending.
- [x] Verified signed-in Admin Seller card/details entry points, EN desktop and TH 390px layouts, sector icon, focus ring and required-email error; 30 existing tests pass and build OK. Shared dialog covers other personas; no email sent or other account impersonated.

## Businesses Wanted menu NEW tag — 30 October 2026
- [x] Replace the "{n} new" amber/white pill (count, tooltip, fill) on the Businesses Wanted menu row with the app's own NEW tag, always shown; keep icon, name, place, link and the cards' NEW pill.
- [x] Verify Seller/Buyer/Advisor personas and Control admin: tag matches Advertisement's dashed style, no fill on the selected row (row text colour), folded menu hides it, Thai shows ใหม่, cards keep their NEW pill; 30 buy-order tests pass, build OK, no runtime errors.


## Buy-order cover pills — 30 October 2026
- [x] Isolate cover pill styles and align top/bottom rows across shared card views; preserve 112px pictures and prevent the 96px details cover shrinking.
- [x] Verify signed-in Admin Buyer/Seller, EN/TH at 390px and 300px cards, photo/drawn fallback and details; all 30 buy-order rule tests pass, no runtime errors.
- [ ] Other-account seller Apply and Applications/Admin-check cards — unavailable in this session: no eligible managed seller or applications, and no waiting orders. Shared card implementation updated; no data invented or changed.

## Businesses Wanted filter bars — 30 October 2026
- [x] Align grouped filters on Businesses Wanted and Admin Advertisement at desktop/tablet/phone widths.
- [x] Set exact EN/TH Admin Buyer subtitle and persona-coloured MARKETPLACE eyebrow; preserve existing card rules.
- [x] Verify signed-in Admin personas, EN/TH layouts at 1440/1280/1024/390, search/kind controls and 18 existing rule tests; no runtime errors or horizontal overflow. Shared layouts apply to users; no other account was impersonated.

## Buy-order photo covers — 30 October 2026
- [x] Add protected cover fields/storage and shared upload/picked/oldest/drawn resolution.
- [x] Show pictures on all buy-order covers and add bilingual Admin Change picture dialog.
- [x] Test cover precedence, file limits/authorization and check live controls without invented business data: 30 tests; BO-1003 sector save/upload/reload/remove, deleted temporary file, Thai invalid-file/Escape checks. Order remains waiting; no new businesses or orders created.

## Paid reports — no-orders queue
- [x] Include successful linked DBD companies with zero orders in the server directory and sixth queue.
- [x] Add row, panel and seven-report Admin presentation without mutations or access changes.
- [x] Check the queue and report today's real company names and references.

## Second pass — 29 October 2026
- [x] Fix company-name, revenue and date comparisons; website checks safely fall back to manual review (automatic reachability blocked pending destination-pinned egress).
- [x] Replace Admin queue/review and decision pop-ups per the second-pass brief.
- [x] Finish user review, editor labels/help, sidebar badge and approved messages.
- [x] Apply full Thai text table and report added/replaced counts.
- [x] Return INV-1008 and INV-1015 to pending without email; list legacy live seller refs without changing them.
- [x] Review compilation signals only; no test accounts/data or screenshots.

Brief: /mnt/user-uploads/lovable-one-step-approval_2.md. No tests, no test accounts, no screenshots (user's instruction).

- [x] A. Data: migration 0113 (suggested/published name+headline per role, revenue band, contact number, decision reasons, review checks, approval_notices)
- [x] B. Server: approval-notices fns, one-step.server review data, approvals-one-step fns (listOneStepApprovals, decideOneStep, markReviewCheck, paidReportsCount, registerBuyerCompany, registerAdvisorFirm), submitListing suggestion checks, verified-only browse filters, resumeListing
- [x] C. Shared UI: approval-banners.css, yellow/red/green banners, sidebar badge, Sent for approval, Withdraw, Approved pop-up, Review your company data; mounted in _authenticated
- [x] D. My Company footers: seller (approval-bits), buyer (buyer-my-company), advisor (advisor-my-company)
- [x] E. Edit information: suggested name/headline fields (120 chars) in seller/buyer/advisor forms; buyer revenue band + contact number fields
- [x] F. Admin Approvals one-step review UI (listOneStepApprovals, decideOneStep with editable name/headline, markReviewCheck, paid reports count)
- [x] G. Browse cards show published name/headline; My Company card title = published name once live
- [x] H. Sidebar red badge on My Company while changes requested/declined
- [x] I. Approval decision emails + Thai translations for all new strings
- [x] J. Final reply: name/headline columns per role, Certified storage, DBD fields available, live sellers/advisors lacking certification/verification, anything not built

## Shared DBD store — approved 28 October 2026

- [x] Pre-migration audit: shared registrations are 0105561234567 (ADV-1008 Rita Test Advisory / INV-1012 Rita Test Capital) and 0105567088689 (PS-1006 pml / Petmyli without a listing reference); no conflicting company-info or registration/year financial-statement duplicates found.
- [x] Dan confirmed typos: PS-1006 pml now 0105599000006, INV-1012 Rita Test Capital now 0105599000012; no shared registrations remain.
- [x] Implement successful fetch-once store and linked read-only data with Control Admin-only mutation enforcement.
- [x] Implement logged retries, atomic failed-refresh preservation and replacement confirmations.
- [x] Link verification source/date to approval history and synchronise legacy company fields from the store.
- [x] Update Generate/Extract data and seller Ready to order states without changing prices or running waiting orders.
- [x] Previous DBD milestone recorded; no additional report orders run in this pass.

- [x] DBD fetch-once shared store (items 1–9)
- [ ] DBD CSV export/import (section 2.3) — later step, per Dan

- [x] Admin › Paid reports menu page (one row per company, store-first, bulk, side panel, Admin view)

## Admin Approvals queue fix — 29 October 2026

- [x] listOneStepApprovals no longer selects `sector` from `hidden_profiles` (that column lives on `startups`); PS-1030 now appears in the seller queue.
- [x] Seller review rows read the stored vocabulary: `owner_stays` yes/no through `handoverLine()`, asking price through the price-band label (test/approvals/one-step-review.test.ts, 6 tests).

## Businesses Wanted (brief: lovable-businesses-wanted.md), in stages
- [x] Admin all-tabs extension: persona-specific browsing/counts, managed Live seller picker and applications, full-name sharing; 18 rule tests pass and all three signed-in Admin tabs render without errors.
- [ ] Admin managed-company Apply/share end-to-end check — blocked: no buy orders exist and no Live managed companies are available in Control; no test business or buy order was invented.
- [x] Stage 1: tables, menu row, page, filters, industry tiles, cards, View details, seller Apply
- [ ] Stage 2: Pipeline › NDA Invitations › Applications (seller + buyer/Control), Request NDA / Not a fit, Sealed NDA naming (sections 6.5, 7, 8)
- [x] Stage 3: Advertisement menu + My advertisements + buy order form; Admin › Approvals › Advertisement; daily 00:05 close job (sections 9–11)
- [x] Stage 4: Share by email, sign-up from a shared buy order, first look (section 12); nightly close at 00:05 Bangkok
- [ ] Sealed NDA "PitchSnack Private Client" name rule until LOI (section 8.5)
- [ ] Full Thai pass against section 14 table
