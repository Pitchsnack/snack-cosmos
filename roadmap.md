# Roadmap — One-step approval (sellers, buyers, advisors)

Brief: `lovable-one-step-approval_2.md` + reference HTML. Build in one go; Dan checks himself (no tests/screenshots requested).

## Explore
- [ ] Map buyer approval + verification flow
- [ ] Map seller listing approval + advisor verification
- [ ] Map Admin Approvals UI, menu, emails, banners, i18n, DBD data

## Build
- [ ] 1. DB migration: suggested/published listing name + headline (startups, buyer_profiles/investors, advisor_firms); buyer revenue band; contact number (buyers/sellers); approval_events logging; per-user banner/approved-pop-up state
- [ ] 2. Server: one-step Register your company submit per role; merged buyer decide (publish+verify in one transaction); seller decide certifies company+owner; advisor decide verifies+publishes; Browse/Connect/invite/NDA server gates require verified+published
- [ ] 3. My Company footers per state (Draft/Pending/Changes/Not approved/Live/Paused), status pills, remove state notices, remove Withdraw-while-pending, remove Exclusive-view Submit for verification
- [ ] 4. "Review your company data" pop-up (880px, 3 numbered sections, tick box, fail line)
- [ ] 5. "Sent for approval" pop-up (520px, 3-step tracker)
- [ ] 6. Banners: yellow (pending, foldable, per-role rows), red (changes/declined, reason pills, note, sidebar badge), green (2 steps, per-user stored); mount under breadcrumb on every user page
- [ ] 7. Sidebar status chip states; Browse locked Connect buttons + tooltips; My Profile verification status-only + Open My Company
- [ ] 8. Admin Approvals: Sellers/Buyers/Advisors/History tabs, counts, Paid reports as own menu item, queue items, review layout (header, directory bar, sent-back note, listing name/headline table, verification table with DBD compare + Mark checked, visual-check box, preview cards, footer), decision pop-ups
- [ ] 9. Withdraw pop-up (live state); Pause/Resume renamed, no Admin step
- [ ] 10. Approved pop-up (once per user) + three decision emails per role
- [ ] 11. Data: PML VENTURES (INV-1008) + LINE MAN Wongnai (INV-1015) → Pending approval, out of Browse, no email; list live-but-unverified sellers/advisors in reply
- [ ] 12. Thai: all new texts via t(), Buddhist-year dates, IBM Plex Sans Thai Looped, three seller-specific texts

## Reply must list
- Column holding each of the 4 listing name/headline values per role
- Where Certified is stored today
- Which DBD fields exist
- Live sellers/advisors not certified/verified
- Anything not built as written
