# Browse cards brief (lovable-seller-buyer-cards.md)

- [ ] 1. DB: user_activity table (last_active_at), RLS own-row read, touch_last_active() RPC (15-min throttle), backfill from auth.users.last_sign_in_at
- [ ] 2. Server: last-login step helpers (week/month/two_months/three_months_plus) + touchLastActive server fn
- [ ] 3. DTOs: lastLoginStep on listings (loadMarketplaceTeasers), investors (loadPublicInvestors), firms (loadFirmCards); never send timestamps
- [ ] 4. Client: touch on sign-in + app open/focus (__root.tsx)
- [ ] 5. Buyer card = seller card shape: US$-only rows, Investment focus one-line textRow, Geography + baht rows into Show more
- [ ] 6. Show more row: last login left (log-in icon, 12px #6B7280), Show more right; previews/Admin unchanged
- [ ] 7. Badges all 24px (Managed by, Verified advisor green #15803D/#ECFDF3), star 32px
- [ ] 8. Firm card: 150px cover, logo ≤96x240, Languages row in figures box, foot = last login + Show more, Send enquiry inside Show more (navy 36px)
- [ ] 9. i18n: 4 last-login lines EN/TH + tooltips
- [ ] 10. Tests: step thresholds; typecheck; build
- [ ] 11. Playwright: advisor Browse marketplace EN/TH, seller Browse investors, buyer Browse listings, firm card opened; 1440/1024/390, light/dark
