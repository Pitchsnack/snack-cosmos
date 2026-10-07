# Advisor decisions

- Advisor My Company: firm profiles live in advisor_firms (+ fees/team/credentials/documents/reviews), read/written only via advisor-firm.functions.ts; verification and check statuses are Admin-only, enforced by DB triggers.
- Advisor firm setup wizard (advisor-setup-wizard.tsx at /advisor/company/$id/setup) autosaves via saveAdvisorWizard into the same advisor_firms row; Review & complete renders FirmEditForm in setup mode, so wizard and Edit profile share one form and one set of checks (advisor-firm.ts, advisor-firm-fields.tsx).
- Advisor deal size is a band key (deal_size_band); baht labels are derived from config/display-rates.json at render time and never stored. Fees are structured (fee_type + amount/pct/own words) with display text rebuilt on save.
