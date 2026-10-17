# Profile handover and approval — one pass

Built in one pass in the order below, then checked once against the brief's "Done when" list at 1440px and 390px, in Thai and English. The uploaded Markdown controls; the two HTML files are visual reference.

## 1. Data
- Each business, investor profile and firm gets "Run by" (not assigned / owner / PitchSnack), who prepared it and when, and "who they are".
- Existing profiles: made by sign-up become Owner; in Control and owned only by Admin become Managed; the rest become Not assigned.
- New records: invitations (7-day, single-use link), managed clients, part checks, field changes, history events. Only Control Admins read or write them; sellers and buyers never receive them.

## 2. Admin Ownership
- Badge (Managed by / Owner / Not assigned) on every card and panel header in Startups, Investors and Advisors; old owner/client chips, hats and "Prepare for a client" removed; Draft/Live, Prepared, Invited and In review chips kept.
- ⋮ › Ownership with status; Run by filter replaces Owner: All; header counts line; empty-filter message.
- Ownership dialog in every state: Not assigned, Invited, Expired, Accepted, Submitted, Owner, Managed (Draft and Live, Publish, Stop managing, Invite the client to take over).
- Manage dialog with client details, who they are, Managed by and the written-agreement checkbox.

## 3. Invite dialog and email
- Invite dialog per kind with live email check (new / has an account without a profile / already owns one, which blocks sending), language, Sent by, note, Back/Cancel/Send.
- Resend, Change email, Cancel invitation, Send a new invitation.
- Bilingual email per kind from PitchSnack <noreply@notify.pitchsnack.com>, Reply-To support@pitchsnack.com: logo, role chip, no icon, the right copy, and the no-orphan closing line.

## 4. Accept page
- Sign-up layout with invitation box: new account, has an account (sign in), expired, already used. The link passes the access page during the soft launch.
- Accepting moves the profile to the owner's account, sets Run by = Owner, keeps one company per account; a managed profile stays managed until then.

## 5. Owner check on My Company
- Handover box in place of the setup banner: every part by view, each opens the existing Edit information pop-up at that part; saving marks it checked and records changes.
- Declaration and Submit for approval / Submit for verification; box disappears after Admin approves or verifies. Thai and English.

## 6. Approvals and directory panel
- Handed-over items in Listings, Buyers and Advisors: "Handed over from PitchSnack" box, owner's changes, part chips, collapsed history, Request changes and the existing Approve / Verify actions; counts in the menu badge as today.
- Directory panel after submit: Review in Approvals, changed-fields box, history.

## Final check
- Walk the "Done when" list at 1440px and 390px, Thai and English for user-facing pages, no sideways scroll.

## Technical notes
- Additive migration: `run_by`, `prepared_by`, `prepared_at`, `owner_relation` on startups, investors, advisor_firms with backfill; new `profile_invitations`, `managed_clients`, `profile_part_checks`, `profile_field_changes`, `profile_handover_events`, Control-only RLS and grants.
- All actions in `profile-handover.functions.ts` behind Control+Admin checks; accept uses a serialized, email-bound, retry-safe claim like share invitations; Browse `managed_by_pitchsnack` badge rule unchanged.
- roadmap.md gets the six steps; AGENTS.md gets one handover rule.
