# Profile handover and approval — build in 4 phases

The brief covers three kinds (business, investor, advisor firm), four Admin dialogs, an email, an accept page, an owner check flow and an Approvals view. It is built in phases so each one can be checked before the next. The uploaded Markdown controls; the two HTML files are visual reference.

## Phase 1 — Data and Admin ownership (no emails yet)
- Each business, investor profile and firm gets "Run by" (not assigned / owner / PitchSnack), who prepared it and when, and "who they are". Existing profiles made by sign-up become "Owner"; profiles Admin created with only Admin owners become "Managed"; the rest "Not assigned".
- New records: invitations (7-day, single-use link), managed clients, part checks, field changes, history events. Only Control Admins can read or write them.
- Ownership badge (Managed by / Owner / Not assigned) on every directory card and panel header in Startups, Investors and Advisors; old owner/client chips and hats removed; keep Draft/Live, Prepared, Invited, In review chips.
- ⋮ › Ownership item with status; Run by filter replaces Owner: All; header counts line.
- Ownership dialog: Not assigned (two option boxes), Owner, Managed (client row, team row, Draft/Live actions, Publish, Stop managing).
- "Let PitchSnack manage it" dialog with the written-agreement checkbox.

## Phase 2 — Invitations and the email
- Invite the owner dialog: who-they-are options per kind, language, Sent by, note, live email check (new / existing account without profile / already owns one → blocked).
- Invited / Expired / Accepted states with Resend, Change email, Cancel invitation, Send a new invitation.
- Bilingual invitation email per kind with logo, role chip, no icon and the no-orphan closing line. Sender question below.

## Phase 3 — Accept page and owner check on My Company
- Accept page in the sign-up layout: new account, has-account (sign in), expired, already used; link passes the access page during soft launch.
- Accepting moves the profile to the owner's account and sets Run by = Owner (one-company-per-account kept).
- Handover box on My Company: every part listed by view, Check/Edit opens the existing Edit information pop-up at that part, saving records changes; declaration + Submit for approval / verification. Thai and English.

## Phase 4 — Approvals and directory follow-up
- Approvals items marked "Handed over from PitchSnack": what the owner changed, part chips, collapsed history, existing Approve / Verify / Request changes actions.
- Directory panel after submit: Review in Approvals, changed-fields box, history.
- Check at 1440px and 390px, Thai and English.

## Open point
- The brief says the email comes from alerts@pitchsnack.com. Only notify.pitchsnack.com is set up to send today, so the plan uses PitchSnack <noreply@notify.pitchsnack.com> with Reply-To support@pitchsnack.com unless you set up the alerts address.

## Technical notes
- Additive migration: `run_by`, `prepared_by`, `prepared_at`, `owner_relation` on startups, investors, advisor_firms; new `profile_invitations`, `managed_clients`, `profile_part_checks`, `profile_field_changes`, `profile_handover_events`, RLS Control-only.
- All actions in one `profile-handover.functions.ts` behind Control+Admin checks; `managed_by_pitchsnack` Browse badge rule unchanged.
- Accept reuses the share-invitation claim pattern (email-bound, serialized, retry-safe).
