# One-step approval — roadmap

## Second pass — 29 October 2026
- [ ] Fix company-name, website, revenue and date comparisons across roles.
- [ ] Replace Admin queue/review and decision pop-ups per the second-pass brief.
- [ ] Finish user review, editor labels/help, sidebar badge and approved messages.
- [ ] Apply full Thai text table and report added/replaced counts.
- [ ] Return INV-1008 and INV-1015 to pending without email; list legacy live seller refs without changing them.
- [ ] Review compilation signals only; no test accounts/data or screenshots.

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
- [ ] J. Final reply: name/headline columns per role, Certified storage, DBD fields available, live sellers/advisors lacking certification/verification, anything not built

## Shared DBD store — approved 28 October 2026

- [x] Pre-migration audit: shared registrations are 0105561234567 (ADV-1008 Rita Test Advisory / INV-1012 Rita Test Capital) and 0105567088689 (PS-1006 pml / Petmyli without a listing reference); no conflicting company-info or registration/year financial-statement duplicates found.
- [x] Dan confirmed typos: PS-1006 pml now 0105599000006, INV-1012 Rita Test Capital now 0105599000012; no shared registrations remain.
- [ ] Implement successful fetch-once store and linked read-only data with Control Admin-only mutation enforcement.
- [ ] Implement logged retries, atomic failed-refresh preservation and replacement confirmations.
- [ ] Link verification source/date to approval history and synchronise legacy company fields from the store.
- [ ] Update Generate/Extract data and seller Ready to order states without changing prices or running waiting orders.
- [ ] Validate rules and report stored registrations, links and produced seller reports.

- [x] DBD fetch-once shared store (items 1–9)
- [ ] DBD CSV export/import (section 2.3) — later step, per Dan

- [x] Admin › Paid reports menu page (one row per company, store-first, bulk, side panel, Admin view)

## Admin Approvals queue fix — 29 October 2026

- [x] listOneStepApprovals no longer selects `sector` from `hidden_profiles` (that column lives on `startups`); PS-1030 now appears in the seller queue.
- [x] Seller review rows read the stored vocabulary: `owner_stays` yes/no through `handoverLine()`, asking price through the price-band label (test/approvals/one-step-review.test.ts, 6 tests).
