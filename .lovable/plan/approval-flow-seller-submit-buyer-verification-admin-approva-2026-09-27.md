# Approval flow: seller submit, buyer verification, Admin Approvals

Updates the existing My Business page and Admin area in place. No new duplicate panels.

## Phase 1 — Data (one migration)
- `listing_submissions`: startup, version number, status (draft | in_review | changes_requested | live | live_edits_pending | rejected | unpublished), frozen snapshot of Public + Private view, submitted by/at, assignee, decided by/at.
- `listing_status` on the existing hidden profile: current status, live version id, current version.
- `buyer_verifications`: user, company/fund name, registration no., work email, LinkedIn, document paths, status (unverified | pending | verified | more_info | declined), checks (DBD match, email-domain match).
- `approval_events`: item type/id, version, action, admin, note, reasons[], fields[], created_at.
- RLS: owners read/write their own drafts and submissions; only admins decide; buyers only see live snapshots (the approved version stays live while a new one is in review).

## Phase 2 — Seller (My Business panel)
- Remove Submit/Publish from the panel header (keeps Edit public view / Share info · progress pill · ⋮).
- New footer bar on both tabs: not ready (linked missing items + disabled navy "Submit for approval") / ready message + enabled button. Progress pill goes green with tick at 100%; "+ Add financials" hides once financials exist.
- "Confirm and submit" dialog (640px): Public view and Private view lists with Edit links, scrolling body, fixed authorisation checkbox, Back / Submit.
- State notices above both tabs + matching footer + card badge / "How buyers see it" pill: In review (Withdraw), Changes requested (note, fields, Resubmit), Live (Unpublish, "Posted on"), Live · edits pending (N changes list, "See what changed", Resubmit), Rejected (reason, stays Draft). "Startups can't be listed yet" strip hidden in review/live/edits pending.
- Any edit after approval flips to "edits pending" by comparing current views against the live snapshot.

## Phase 3 — Buyer verification
- "Submit for verification" step at the end of buyer setup (company/fund, registration no., work email checked against website domain, LinkedIn, optional documents).
- Status chip: Pending verification → Verified buyer / More info needed / Declined.
- Pending buyers can browse and save; NDA button reads "Available after verification".

## Phase 4 — Admin Approvals
- Sidebar "Approvals" with count badge next to Startups Directory (admin only).
- `/approvals`: subtitle counts, tabs Listings · Buyers · History, search/status/sector/sort, Assign to me; tables per the brief, "Waiting on sellers (n)".
- `/approvals/listings/$id`: header actions (Assign, Reject with reason, Request changes dialog, Approve & publish); left = the same Marketplace listing card + Activity; right sticky = Private-view cross-check with "N of N match", identity check, reviewer checklist, link to Startups Directory. Resubmissions show v2 with changed fields highlighted.
- `/approvals/buyers/$id`: profile, mandate, activity; verification checks, checklist, what verification unlocks; Decline / Request more info / Verify buyer.
- Startup Directory's Marketplace listing tab shows the same status with a link to the review.

## Notifications
Every submit/withdraw/approve/request-changes/reject/resubmit/verify is logged in `approval_events` and creates an in-app notification (existing notification center). Real emails need an email domain set up first — I'll wire them in once you connect one.

## Notes / limits
- Startup-type businesses: currently can't publish. I'll let them submit, and Approve will make them Live, unless you want them kept blocked.
- The admin-approvals.html prototype wasn't attached this time; I'll follow the written brief for the Admin screens.
- Build order: Phase 1 → 2 → 4 (listings) → 3 → 4 (buyers).
