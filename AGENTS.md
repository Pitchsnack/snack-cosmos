# Project decisions

- Reuse `StartupCard` for the My Business private card and Startup Directory grid card so their presentation stays identical.
- Show an anonymous Public view preview from existing business fields even before a listing exists; keep startup publication unavailable so owners can inspect without exposing it to buyers.- Marketplace listings go live only through Admin approval (approvals.functions.ts); a DB trigger blocks sellers from setting live/decision fields so they cannot self-publish.
