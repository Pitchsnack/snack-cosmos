# Browse cards brief (lovable-seller-buyer-cards.md)

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
- [ ] 11. Playwright visual check (advisor Browse marketplace EN/TH, Browse investors/listings, firm card opened) — NOT YET RUN
- [ ] Note: test/architecture baseline failures are pre-existing (tree has 479 direct calls vs frozen 243 baseline); baseline left untouched
