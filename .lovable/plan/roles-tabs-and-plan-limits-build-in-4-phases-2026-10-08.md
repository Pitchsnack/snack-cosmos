# Roles, tabs and plan limits — build in 4 phases

The spec touches sign-up, every Browse page, requests, reports, Admin › Users and access to Admin itself. I'll build it in four phases, each one tested before the next, so nothing half-finished goes live at once.

## Phase 1 — Role and plan data (sections 1–3)
- Every account gets one role: seller, buyer, advisor or admin. Sign-up sets it from the role step.
- Add the plans table and the plan reports table, filled with the nine plans and their values from section 2. The app reads every price, limit and feature from these tables.
- Add who is on which plan. New sellers start on Entry; new buyers and advisors have no plan until Admin sets one.
- Give existing users their role and plan once, following the rules in sections 1 and 3, then post the counts and the list of users left to set.

## Phase 2 — Tabs, badge, Admin › Users (sections 4, 5, 11)
- Seller · Buyer · Advisor switch: only your own tab is active. The other two are grey with a lock, a tooltip and a toast. Admins get all three tabs.
- Opening another role's page by its address takes you to your own Browse page. This is checked on the server.
- Plan badge in all 8 styles, replacing the purple "Pro" pill and the crown badge.
- Admin › Users:
  - Role and Plan columns, the filter chips, and an edit panel with the role cards, the plan select and the Manager select.
  - The Advisor view setting is removed.
- Hiding the Marketplace | Admin switch from non-admins waits for your reply. First I'll post the pages sellers, buyers or advisors can only reach through Admin today, as section 4 asks.

## Phase 3 — Plan strip, closed cards, requests (sections 6–8, 10)
- Plan strip on the three Browse pages:
  - the badge, the price line and the ✓ / 🔒 chips;
  - the counter of what's left this term;
  - the amber bar when a plan has ended.
- Closed listing cards above a plan's price cap. The server never sends a closed listing's details, and the star still works.
- A seller can't save an asking price above their plan's cap.
- Counters for each term, checked on the server:
  - contact requests and NDA requests, including the "bundles" credits;
  - each buyer report, through the checks `can_open_report` and `record_report_open`;
  - clients, users and mandates.
- Locked buttons and their toasts: "No requests left", "{Plan} plan", "Buy a bundle", "Renew to request".

## Phase 4 — Seller verification (section 9)
- A Registration verified switch on the company's Admin page.
- A Certified badge on the listing card and the listing page once the company is verified.

## Questions answered during the build
- In Phase 1, if a "Tenant Admin" is also a seller or a buyer, they still become admin, as the spec says. I'll list these people in the chat.

## Technical notes
- New tables: plans, plan_reports, subscriptions (or the existing tenant_subscription extended, whichever fits), plan_usage (per user, term and kind).
- New columns: users.account_role, startups.registration_verified_at.
- The role and plan checks run in server functions and database policies. Every count and check is done on the server.
- users.advisor_view stays in the database marked as deprecated, so nothing that still reads it breaks.
