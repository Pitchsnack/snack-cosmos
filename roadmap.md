# One-step approval — roadmap

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
