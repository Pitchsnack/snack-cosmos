# Browse cards brief (lovable-seller-buyer-cards.md)

## Compact advisor panels
- [x] Compact shared Browse/My Company and separate Admin sections; accessible photo viewer, scoped hover and section-specific edits.
- [x] Ten exact EN/TH service lines updated throughout app and Partners; saved data and fee words elsewhere unchanged.
- [x] Admin and seller/buyer/advisor view switches checked; 1440/1024/390 without overflow; EN/TH, hover/focus, dark tokens, 0/1/3-photo browser-only cases and 20 focused tests passed. Separate role-account sessions and populated feedback remain unverified.

## Advisor licence dropdown
- [x] Shared grouped picker, issuer lines, Other, duplicate prevention and validation.
- [x] Persist keys, preserve legacy credentials, localize displays and snapshots, including active one-step review.
- [x] 64 relevant tests; authenticated Admin save/read-back on ADV-1009; eight desktop/mobile EN/TH light/dark checks. Legacy ADV-1014 “test”: “accoutning” remains Other, possible CPA match (note “2 CPA”).

- [x] 1. DB: user_activity table (last_active_at), RLS own-row read, touch_last_active() RPC (15-min throttle), backfill from auth.users.last_sign_in_at
- [x] 2. Server: last-login step helpers + touchLastActive server fn
- [x] 3. DTOs: lastLoginStep on listings, investors, firms; never send timestamps
- [x] 4. Client: touch on sign-in + app open/focus (__root.tsx)
- [x] 5. Buyer card = seller card shape: US$-only rows, Investment focus one-line, Geography + baht rows in Show more
- [x] 6. Show more row: last login left, Show more right; previews/Admin unchanged
- [x] 7. Badges all 24px (Managed by, Verified advisor green), star 32px
- [x] 8. Firm card: 150px cover, logo ≤96x240, Languages row in box, foot = last login + Show more, Send enquiry inside Show more
- [x] 9. i18n: 4 last-login lines EN/TH + tooltips
- [x] 10. Tests: step thresholds pass; tsgo clean
- [x] 11. Advisor Browse EN/TH and opened firm checked; investor/listing cards unchanged by compact advisor work.
- Architecture baseline remains untouched (479 direct calls versus frozen 243); not part of this task.
