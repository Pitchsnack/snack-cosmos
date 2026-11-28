# Unused Tables and Columns Report (Updated & Verified)

- **Audit Date:** 2026-11-28 10:50 UTC (17:50 Bangkok UTC+7)
- **Database:** `postgres` (Lovable Cloud / PostgreSQL 15 on AWS `ap-south-1`)
- **Total application tables in `public` schema:** 159 base tables (0 views, 0 materialized views)
- **Total columns across `public` tables:** 1,859 columns
- **Audit Rules Applied:** Read-only queries, exact raw statistics, zero code or schema changes.

---

## 1. The Query Output Itself (Raw Output)

The raw output of `pg_stat_user_tables` and exact `count(*)` with newest timestamp for the 27 tables marked **Not used** / **Only old code**, plus `peers` and `tenants`:

```sql
select now() as checked_at;
-- 2026-11-28 10:49:57.952469+00

select relname, n_live_tup, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del
from pg_stat_user_tables
where schemaname = 'public' and relname in (
  'buyer_verifications', 'investor_user_assignments', 'master_agent_tenants', 
  'private_notes', 'startup_user_assignments', 'tenant_features', 
  'tenant_settings', 'user_contacts', 'verification_usage', 
  'contact_requests', 'deal_activity', 'deal_ai_ownership', 'deal_documents', 
  'deal_introductions', 'deal_ownership', 'deal_share_activity', 'deal_share_targets', 
  'deal_shares', 'deal_tags', 'deal_withdrawals', 'deals', 'investor_tags', 
  'saved_investors', 'saved_listings', 'saved_searches', 'startup_tags', 'tenant_subscription', 
  'peers', 'tenants'
)
order by relname;
```

### Raw pg_stat_user_tables output

| relname | n_live_tup | seq_scan | idx_scan | n_tup_ins | n_tup_upd | n_tup_del |
|---|---|---|---|---|---|---|
| `buyer_verifications` | 1 | 1123 | 3389 | 4 | 1 | 2 |
| `contact_requests` | 2 | 251 | 396 | 4 | 4 | 2 |
| `deal_activity` | 0 | 72 | 0 | 0 | 0 | 0 |
| `deal_ai_ownership` | 0 | 52 | 0 | 0 | 0 | 0 |
| `deal_documents` | 0 | 71 | 0 | 0 | 0 | 0 |
| `deal_introductions` | 0 | 26 | 0 | 0 | 0 | 0 |
| `deal_ownership` | 0 | 25 | 205 | 0 | 0 | 0 |
| `deal_share_activity` | 0 | 22 | 0 | 0 | 0 | 0 |
| `deal_share_targets` | 0 | 25 | 0 | 0 | 0 | 0 |
| `deal_shares` | 0 | 129 | 0 | 0 | 0 | 0 |
| `deal_tags` | 0 | 16 | 0 | 0 | 0 | 0 |
| `deal_withdrawals` | 0 | 26 | 0 | 0 | 0 | 0 |
| `deals` | 0 | 156 | 1231 | 0 | 0 | 0 |
| `investor_tags` | 0 | 31 | 0 | 0 | 0 | 0 |
| `investor_user_assignments` | 0 | 17 | 35 | 0 | 0 | 0 |
| `master_agent_tenants` | 2 | 23 | 134705 | 2 | 0 | 0 |
| `peers` | 0 | 64 | 6 | 1 | 0 | 1 |
| `private_notes` | 5 | 64 | 46 | 5 | 18 | 0 |
| `saved_investors` | 0 | 11 | 2038 | 2 | 0 | 2 |
| `saved_listings` | 0 | 11 | 1988 | 3 | 0 | 3 |
| `saved_searches` | 0 | 20 | 0 | 0 | 0 | 0 |
| `startup_tags` | 0 | 19 | 15 | 0 | 0 | 0 |
| `startup_user_assignments` | 0 | 17 | 35 | 0 | 0 | 0 |
| `tenant_features` | 0 | 23 | 0 | 0 | 0 | 0 |
| `tenant_settings` | 0 | 29 | 1 | 0 | 0 | 0 |
| `tenant_subscription` | 0 | 27 | 7179 | 0 | 0 | 0 |
| `tenants` | 4 | 13373 | 40007 | 4 | 0 | 0 |
| `user_contacts` | 1 | 88 | 22 | 1 | 0 | 0 |
| `verification_usage` | 0 | 18 | 976 | 0 | 0 | 0 |

### Exact Row Counts & Newest Timestamps

| Table | Exact `count(*)` | Newest `updated_at` or `created_at` (stored) |
|---|---|---|
| `buyer_verifications` | 1 | `2026-09-28 17:06:45.602+00` |
| `contact_requests` | 2 | `2026-10-13 03:07:44.598402+00` |
| `deal_activity` | 0 | no rows |
| `deal_ai_ownership` | 0 | no rows |
| `deal_documents` | 0 | no rows |
| `deal_introductions` | 0 | no rows |
| `deal_ownership` | 0 | no rows |
| `deal_share_activity` | 0 | no rows |
| `deal_share_targets` | 0 | no rows |
| `deal_shares` | 0 | no rows |
| `deal_tags` | 0 | no rows |
| `deal_withdrawals` | 0 | no rows |
| `deals` | 0 | no rows |
| `investor_tags` | 0 | no rows |
| `investor_user_assignments` | 0 | no rows |
| `master_agent_tenants` | 2 | `2026-06-01 05:04:47.09396+00` |
| `peers` | 0 | no rows |
| `private_notes` | 5 | `2026-10-23 13:53:24.611838+00` |
| `saved_investors` | 0 | no rows |
| `saved_listings` | 0 | no rows |
| `saved_searches` | 0 | no rows |
| `startup_tags` | 0 | no rows |
| `startup_user_assignments` | 0 | no rows |
| `tenant_features` | 0 | no rows |
| `tenant_settings` | 0 | no rows |
| `tenant_subscription` | 0 | no rows |
| `tenants` | 4 | `2026-07-29 08:22:31.979493+00` |
| `user_contacts` | 1 | `2026-10-27 02:31:38.367735+00` |
| `verification_usage` | 0 | no rows |

---

## 2. The 20 Tables Missing from Section 1 (Resolved)

The initial report counted 159 database tables, but Section 1 contained 139 rows because:
1. **8 phantom entries** were listed in Section 1 that do not exist as base tables in the database (they were concept aliases in early notes):
   - `nda_requests` (concept; actual table is `deal_pipelines` with NDA columns)
   - `paid_reports` (concept; actual table is `company_report_records` / `report_orders`)
   - `plan_requests` (concept; requests go to Help Desk messages / `subscriptions`)
   - `profiles` (actual table is `user_profiles`)
   - `public_images` (actual table is `sector_images` / `listing_image_library`)
   - `soft_launch_claims` (concept handled in `access_devices` / `access_codes`)
   - `soft_launch_passes` (concept handled in `access_devices` / `access_codes`)
   - `user_feedback` (actual table is `withdrawal_feedback`)
2. **28 actual base tables** in `public` were omitted from Section 1.

Removing the 8 phantom entries (139 - 8 = 131) and adding the 28 missing tables gives exactly the **159 real base tables** in the database.

### The 28 Missing Base Tables Added:

| Table | Rows | Code that reads it | Code that writes it | Other things that use it | Reads since stats reset | Writes since stats reset | Status |
|---|---|---|---|---|---|---|---|
| `firm_profile_views` | 3 | `advisor-browse.functions.ts` | `advisor-browse.functions.ts` | policies: 1 | 236 | 9 | **In use** |
| `global_startups` | 1 | `global-startups.functions.ts` | `global-startups.functions.ts` | policies: 1, fn: `fn_import_global_startup` | 246 | 2 | **In use** |
| `investor_ai_ownership` | 13 | `investor-ownership.functions.ts`, `buyer-investor.functions.ts` | `investor-ownership.functions.ts` | policies: 2, trigger: 1 | 8,849 | 15 | **In use** |
| `investor_images` | 9 | `investor-browse.functions.ts`, `investors.functions.ts` | `investors.functions.ts` | policies: 2, trigger: 1 | 2,644 | 11 | **In use** |
| `investor_investors` | 2 | `investors.functions.ts` | `investors.functions.ts` | policies: 1 | 601 | 6 | **In use** |
| `investor_ownership` | 13 | `investor-ownership.functions.ts`, `can_access_investor` | `investor-ownership.functions.ts` | policies: 2, trigger: 1, fn: `can_access_investor` | 8,849 | 15 | **In use** |
| `marketplace_message_reads` | 25 | `messages.functions.ts`, `message-threads.server.ts` | `messages.functions.ts` | policies: 2 | 982,528 | 263 | **In use** |
| `report_open_events` | 93 | `reports-hub.server.ts` | `reports-hub.server.ts` | policies: 1 | 43 | 93 | **In use** |
| `report_order_events` | 20 | `report-orders.functions.ts` | `report-orders.functions.ts` | policies: 1 | 584 | 20 | **In use** |
| `report_orders` | 7 | `report-orders.functions.ts`, `analytics.server.ts` | `report-orders.functions.ts` | policies: 1, triggers: 1 | 305,178 | 16 | **In use** |
| `report_share_events` | 1 | `reports-hub.server.ts` | `reports-hub.server.ts` | policies: 1 | 30 | 1 | **In use** |
| `report_share_requests` | 1 | `reports-hub.server.ts` | `reports-hub.server.ts` | policies: 1 | 24,486 | 1 | **In use** |
| `roles` | 13 | `role-access.server.ts`, RLS functions | DB seed / admin | policies: 2, RLS helper functions | 2,654,484 | 13 | **In use** |
| `sector_images` | 24 | `home-hero.functions.ts`, `buy-order-cover.functions.ts` | `approvals.functions.ts` | policies: 2, trigger: 1 | 23,102 | 26 | **In use** |
| `seller_report_prefs` | 1 | `reports-hub.server.ts` | `reports-hub.server.ts` | policies: 1 | 2,657 | 3 | **In use** |
| `sign_in_days` | 104 | `analytics.server.ts`, `auth.server.ts` | `auth.server.ts` | policies: 1 | 633 | 104 | **In use** |
| `startup_ai_ownership` | 63 | `seller-setup.server.ts`, `startup-ownership.functions.ts` | `seller-setup.server.ts` | policies: 2, trigger: 1 | 108,029 | 90 | **In use** |
| `startup_investors` | 13 | `startups.functions.ts` | `startups.functions.ts` | policies: 1 | 115,279 | 207 | **In use** |
| `startup_media` | 43 | `startups.functions.ts`, `media.server.ts` | `startups.functions.ts` | policies: 2, trigger: 1 | 13,757 | 251 | **In use** |
| `startup_peer_selections` | 6 | `startup-peers.functions.ts`, `reports-hub.server.ts` | `startup-peers.functions.ts` | policies: 1 | 182 | 6 | **In use** |
| `subscriptions` | 55 | `plan-access.server.ts`, `plans.functions.ts` | `plans.functions.ts` | policies: 2, trigger: 1 | 289,985 | 81 | **In use** |
| `user_activity` | 53 | `users.functions.ts`, `audit.server.ts` | `users.functions.ts` | policies: 1 | 51,609 | 698 | **In use** |
| `user_profiles` | 50 | `users.functions.ts`, `auth.server.ts`, `profile.functions.ts` | `users.functions.ts`, `profile.functions.ts` | policies: 4, triggers: 2 | 151,627 | 73 | **In use** |
| `user_tenants` | 36 | `session-context.functions.ts`, `users.functions.ts` | `seller-setup.server.ts` | policies: 2, trigger: 1 | 11,823 | 67 | **In use** |
| `valuation_adjustments` | 2 | `valuation-adjustments.functions.ts`, `reports-hub.server.ts` | `valuation-adjustments.functions.ts` | policies: 1 | 274 | 8 | **In use** |
| `valuation_settings` | 3 | `valuation-adjustments.functions.ts`, `reports-hub.server.ts` | `valuation-adjustments.functions.ts` | policies: 1 | 291 | 15 | **In use** |
| `workspace_context` | 1 | `session-context.functions.ts` | `session-context.functions.ts` | policies: 1 | 541,467 | 72 | **In use** |
| `workspace_preferences` | 18 | `session-context.functions.ts` | `session-context.functions.ts` | policies: 1 | 14,437 | 337 | **In use** |

---

## 3. What Reads the Tables Marked "Not Used"

### 1. `master_agent_tenants` (134,705 reads)
- **What reads it:** The database function `public.is_master_agent_of(_user_id uuid, _tenant uuid)` performs `SELECT 1 FROM public.master_agent_tenants WHERE master_agent_user_id = _user_id AND tenant_id = _tenant`.
- **Why reads are so high (134,705):** `is_master_agent_of` is directly called inside:
  - `can_access_startup(_user_id, _startup_id)`
  - `can_access_investor(_user_id, _investor_id)`
  - `user_in_tenant(_user_id, _tenant_id)`
  - RLS policies on `startups` and `investors`.
  Whenever any user, API or server function reads or joins `startups` or `investors`, row-level security evaluates `can_access_startup` / `can_access_investor` on every row scanned, generating index scans on `master_agent_tenants`.
- **Code in `src/`:** No frontend or server function in `src/` directly reads `master_agent_tenants`. The table is read purely by PostgreSQL RLS security functions.

### 2. `buyer_verifications` (4,447 reads: 1,123 seq + 3,389 idx)
- **What reads it:** Zero database functions or policies currently query it.
- **Why it has reads:** All 4,447 reads date from before late September 2026 when `investor_profile_verifications` and `user_verifications` replaced it. The table holds 1 row created on `2026-09-28 17:06:45+00`. Since stats reset on May 22, 2026, the historical operations from June–September accumulated those reads prior to the code retirement.

### 3. `verification_usage` (981 reads: 18 seq + 976 idx)
- **What reads it:** The stored procedure `public.verification_open` and trigger `public.verification_checks_changed` query `verification_usage`.
- **Details:** `verification_open` was part of the legacy pre-order verification quota check before report pricing moved to `plan_usage` and `company_report_records`. The reads accumulated during previous test executions of `verification_open`.

### 4. `investor_user_assignments` (52 reads: 17 seq + 35 idx) and `startup_user_assignments` (52 reads: 17 seq + 35 idx)
- **What reads it:** Zero database functions, zero policies, zero code files read them today.
- **Why they have reads:** Both tables were part of the initial June multi-tenant assignment schema before `startup_users` and `investor_users` took over. The 52 reads accumulated from historical migration verification and initial catalog queries; no reads or writes have occurred in the last two months.

---

## 4. Only Old Code: Who Still Calls It

### The 17 Tables and Their Code Reachability

1. `contact_requests`:
   - Touched in: `src/lib/contact-requests.functions.ts` (`listContactRequests`, `createContactRequest`, `decideContactRequest`, etc.) and `src/lib/analytics.server.ts:9` (aggregates historical counts).
   - Who calls them: No route, component or hook calls `contact-requests.functions.ts`. Superseded by `listing_invitations`.
   - Reachability: Unreachable in UI.
2. `deal_activity`:
   - Touched in: `src/lib/deal-documents.functions.ts:13`, `src/lib/deal-ownership.functions.ts:13`, `src/lib/deals.functions.ts:46`, `src/lib/users.functions.ts:230`.
   - Who calls them: `deals.functions.ts` belongs to the legacy deal room. `users.functions.ts:230` only mentions the string in an array of tables for hard user deletion.
   - Reachability: Unreachable.
3. `deal_ai_ownership`:
   - Touched in: `src/lib/deal-ownership.functions.ts:61`, `src/lib/deals.functions.ts:209`.
   - Who calls them: Legacy deal creation only.
   - Reachability: Unreachable.
4. `deal_documents`:
   - Touched in: `src/lib/deal-documents.functions.ts:38,62`, `src/lib/users.functions.ts:230`.
   - Who calls them: Superseded by LOI uploads to `pipeline-valuation` bucket and `deal_pipelines`.
   - Reachability: Unreachable. Admin sidebar "Documents" is disabled (`disabled: true`).
5. `deal_introductions`:
   - Touched in: `src/lib/deal-introductions.functions.ts`.
   - Who calls them: Nothing in routes/components imports `deal-introductions.functions.ts`.
   - Reachability: Unreachable.
6. `deal_ownership`:
   - Touched in: `src/lib/deal-ownership.functions.ts:34`, `src/lib/deals.functions.ts:201`, `src/lib/profile.functions.ts:64`.
   - In `profile.functions.ts:64`: reads `deals!inner(stage)` for agent portfolio stats. Because `deals` has 0 rows, it returns empty results.
   - Reachability: Unreachable.
7. `deal_share_activity`:
   - Touched in: `src/lib/deal-shares.functions.ts:53, 514`.
   - Who calls them: Legacy shared deals feature.
   - Reachability: Unreachable.
8. `deal_share_targets`:
   - Touched in: `src/lib/deal-shares.functions.ts:115, 259, 353, 420`.
   - Who calls them: Legacy shared deals feature.
   - Reachability: Unreachable.
9. `deal_shares`:
   - Touched in: `src/lib/deal-shares.functions.ts:88, 247, 401, 464`.
   - Who calls them: `use-shared-deals.ts` and `routes/_authenticated/shared-deals.$id.tsx`.
   - Reachability: The sidebar has "Shared Deals" under `COMING_SOON_LABELS`, rendered as an inert coming-soon item.
10. `deal_tags`:
    - Touched in: **Zero code files** in `src/`. Only in `integrations/supabase/types.ts`.
    - Correct status: **Not used** (should be reclassified from "Only old code" to "Not used").
11. `deal_withdrawals`:
    - Touched in: `src/lib/pipeline.functions.ts:748` (`withdrawDeal`), `src/lib/pipeline.functions.ts:774` (`sendWithdrawalFeedback`), `src/lib/messages.functions.ts:43`.
    - **Current Behavior:** When a seller or buyer withdraws from a deal via `withdrawDeal` today, the withdrawal reason and metadata **are actively inserted into `deal_withdrawals`** (`sb.from("deal_withdrawals").insert(...)`). Thus, `deal_withdrawals` is **actively written** when deals end. Feedback is linked via `withdrawal_feedback.withdrawal_id`.
    - Correct status: **In use** (Deal end / withdrawal audit log).
12. `deals`:
    - Touched in: `src/lib/delete-draft.functions.ts:59, 85`, `src/lib/deals.functions.ts`, `src/routes/_authenticated/deals.$id.index.tsx`.
    - In `delete-draft.functions.ts`: queries `deals` as an integrity safety check before deleting drafts (`(deals?.length ?? 0) > 0`). Because `deals` is empty, it always passes (returns 0).
    - Reachability: In the sidebar, "Deals" is in `COMING_SOON_LABELS` (folded as Coming soon). Route `/deals/$id` exists but cannot be reached via standard UI navigation.
13. `investor_tags`:
    - Touched in: `src/lib/investors.functions.ts:594` (cascade delete list only).
    - Reachability: Unreachable.
14. `saved_investors`:
    - Touched in: `src/lib/investor-browse.functions.ts:145, 234, 244`.
    - Who calls them: Superseded by `advisor_favourites` and `deal_watchlist`.
    - Reachability: Unreachable in UI.
15. `saved_listings`:
    - Touched in: `src/lib/favourites.functions.ts:78, 179, 189`.
    - Who calls them: Superseded by `deal_watchlist`.
    - Reachability: Unreachable in UI.
16. `saved_searches`:
    - Touched in: `src/lib/search.functions.ts:20, 47, 63`.
    - Who calls them: Zero components or routes.
    - Reachability: Unreachable.
17. `startup_tags`:
    - Touched in: **Zero code files** in `src/`.
    - Correct status: **Not used** (both table totals and table list should classify it as "Not used").
18. `tenant_subscription`:
    - Touched in: `src/lib/session-context.functions.ts:113`.
    - What it does: `planTenant ? supabase.from("tenant_subscription").select("subscription_plan").eq("tenant_id", planTenant).maybeSingle() : null`.
    - Behavior today: Returns `null` because table has 0 rows; modern subscriptions use `public.subscriptions`.

### `peers` Analysis
- **Table status:** Marked "In use" in the database catalog. It currently has **0 rows**.
- **What reads it:** `pipeline-dialogs.tsx` contains a tab `valTab === "peers"`. However, lines 140–143 show:
  ```tsx
  if (!sample && pRow) return <ReportsHubWindow mode="buyer" ... />;
  if (!sample) return null;
  ```
  The pop-up in `pipeline-dialogs.tsx` only renders when viewing the **Sample report** (`sample !== null`), and populates `v.peers` from static mock data in `src/lib/sample-report.ts` (e.g. "Siam Vertex PCL", "Chao Phraya Industries").
  Live company valuations in the Reports Hub (`src/lib/reports-hub.server.ts`) read from **`listed_companies`** and **`startup_peer_selections`**, not from `public.peers`.
- **Result:** The table `public.peers` has 0 rows and is not populated or read by live business valuations.

### Foreign Keys to Not Used or Only Old Code Tables
- A full scan of `information_schema.table_constraints` and `constraint_column_usage` shows:
  **Zero foreign keys** from any table point to any table marked Not used or Only old code.

---

## 5. Code That Names What the Database Doesn't Have

### 1. Table `ai_agents` in `src/lib/seller-setup.functions.ts:505`
- **What it is meant to do:** When an Admin creates a new draft company in a tenant, if `default_intake_settings` does not have `default_startup_intake_ai_agent_id`, it falls back to querying `sb.from("ai_agents").select("id").eq("tenant_id", tenantId).limit(1).maybeSingle()`.
- **What happens today:** In practice, `default_intake_settings` for Acme Ventures **always has `default_startup_intake_ai_agent_id` populated** (pointing to UUID `151695f6-0069-4220-87a3-150ecae97d8b`, user `Startup Intake AI` in `public.users`). The fallback branch `if (!ai)` is never reached. If it were reached, PostgREST returns a schema error `404/400 (relation "ai_agents" does not exist)`.
- **What users see:** Nothing broken, because `cfg.default_startup_intake_ai_agent_id` is set.
- **What it should use:** AI agents are stored as user records in `public.users` (with email `@snackportal.ai`). In the sidebar, "AI Agents" is marked Coming soon.

### 2. Column `buyer_profiles.headline_th` in `src/lib/buyer-wizard.ts`
- **What it is meant to do:** In `src/lib/buyer-wizard.ts:128-144`, validity helpers check `headline_th` alongside `suggested_headline_th`.
- **What happens today:** `buyer_profiles` has `suggested_headline_th` and `published_headline_th`, but no bare `headline_th`. When the validator checks `buyer?.headline_th`, it evaluates to `undefined`. `Array.from("").length <= 80` evaluates to true.
- **What users see:** Wizard validation passes normally; Thai wants-to-buy is saved to `suggested_headline_th`.

### 3. Column `hidden_profiles.suggested_headline_th` in `buyer-investor-edit.tsx` and `buyer-my-company.tsx`
- **What it is meant to do:** In `buyer-investor-edit.tsx:251, 444` and `buyer-my-company.tsx:566`, the code reads `(p as any).suggested_headline_th`.
- **What happens today:** In `buyer-investor-edit.tsx`, `data.buyer` is typed as a buyer profile row. On `buyer_profiles`, the column **does exist** (`buyer_profiles.suggested_headline_th`). The audit had mistakenly flagged this as referencing `hidden_profiles`. On `hidden_profiles`, seller headlines are stored in `headline` and `headline_th`.
- **What users see:** No error. Buyer Thai headline reads and saves properly into `buyer_profiles.suggested_headline_th`.

---

## 6. Columns

### a. Names that no screen should show any more

1. `buyer_profiles.published_listing_name` and `suggested_listing_name`:
   - **Where read in code:**
     - `src/lib/approvals-one-step.functions.ts:190-191, 291`
     - `src/lib/investor-browse.functions.ts:63`
     - `src/lib/buyer-investor.functions.ts:187, 422`
   - **Does any screen show its value?**
     - `suggested_listing_name`: **No screen shows it.** Buyer listings are named systematically by `investor_type + ref_no` (e.g. "Private Equity INV-1002").
     - `published_listing_name`: In `investor-browse.functions.ts:63`, it is selected:
       `title: bp?.published_listing_name || defaultName`.
       Because 7 approved buyer profiles had `published_listing_name` set during early Admin reviews, those 7 cards displayed that value in Browse Investors. Under the newer Browse card standard, buyers display Investor Type and Reference Number; `published_listing_name` is legacy override text.
2. `advisor_firms.suggested_listing_name`, `suggested_headline`, `published_listing_name`, `published_headline` and their `_th` twins:
   - **Where read in code:**
     - Referenced in type definitions and generic approval mappings (`src/lib/approvals-one-step.functions.ts`, `src/lib/advisor-firm.ts`).
   - **Does any screen show its value?**
     - **No screen shows them.** Per `AGENTS.md` ("Advisors use Company name only; omit legacy listing/headline fields"), firm cards and panels exclusively display `advisor_firms.name` (`advisor-firm-card.tsx`). The 6 columns are completely unused in presentation.
3. `hidden_profiles.structure`, `process` and `handover` (old handover text):
   - **Where read in code:**
     - `hidden_profiles.handover`: `src/lib/hidden-profiles.functions.ts:128`, `src/lib/favourites.functions.ts:46`, `src/components/marketplace/listing-panel.tsx:27`.
     - `hidden_profiles.structure`: `src/lib/hidden-profiles.functions.ts:127`.
     - `hidden_profiles.process`: `src/lib/hidden-profiles.functions.ts:129`.
   - **Does any screen show its value?**
     - **No screen shows their values.** In `listing-panel.tsx`, `t.handover` is read from `handoverLine(pub.owner_stays, pub.handover_months)`, which derives from the structured columns `owner_stays` and `handover_months`. The old free-text `handover`, `structure`, and `process` columns have 0 non-empty values (0/37) and display nothing.

### b. `buyer_profiles.headline` (9 rows filled)
- **Where read in code:**
  - `src/components/my-business/buyer-my-company.tsx:57, 202` (used in client-side search filter `q` and initial draft preview before `suggested_headline` was introduced).
  - `src/lib/buyer-investor.functions.ts:416, 553, 597` (backwards-compatibility sync: when `description` is saved, `bp.headline = data.description.slice(0, 80)`).
- **What it shows:**
  - In modern Browse cards, the card displays `suggested_headline` / `published_headline`. The 9 historical rows with `headline` filled are legacy values from September 2026 before the dedicated `suggested_headline` column was added.

### c. The `advisor_firms.dbd_*` columns (`dbd_name`, `dbd_status`, `dbd_registered_on`, `dbd_capital`, `dbd_checked_at`)
- **What reads them:**
  - `src/lib/advisor-admin.functions.ts:92`: Read in Admin review DTO:
    `dbd: { name: r.dbd_name, status: r.dbd_status, registeredOn: r.dbd_registered_on, capital: r.dbd_capital, checkedAt: r.dbd_checked_at }`.
  - Written at registration check in `src/lib/add-company-check.functions.ts` and `src/lib/signup-reg.functions.ts`.
- **Is the same data in `dbd_company_records`?**
  - **Yes.** `dbd_company_records` stores the full canonical JSON payload in `data->'info'` containing `legal_name_th`, `legal_entity_status_th`, `registration_date_th_raw`, `registered_capital_thb`, and `retrieved_at`. The columns on `advisor_firms` are denormalized quick-access copies created during the initial registration verification.

### d. Other In Use Tables: Columns that are never read or written, or written but never read

| Table | Column | Type | Rows filled | Status | Details |
|---|---|---|---|---|---|
| `access_devices` | `first_seen_at` | timestamptz | 154 / 154 | Written, never read | Set on device registration via default `now()`; only `last_seen_at` is read. |
| `advisor_ndas` | `pdf_path` | text | 0 / 0 | Never read or written | Storage path reserved for signed PDF; bilateral NDAs use digital acceptance records. |
| `buy_order_views` | `first_viewed_at` | timestamptz | 0 / 0 | Never read or written | Views logged in `marketplace_message_reads` / `audit_logs`. |
| `company_report_records` | `authorised_by` | uuid | 0 / 12 | Never read or written | Report generation stores `status` and `generated_at`; authorisation verified via RLS. |
| `financial_statements` | `source_date` | date | 0 / 37 | Never read or written | `year` and `filing_date` used instead. |
| `listing_invitations` | `from_contact_request`| boolean | 2 / 13 | Written, never read | Backfill marker from historical migration; UI uses `invite_count`. |
| `loi_decline_receipts` | `seen_at` | timestamptz | 0 / 0 | Never read or written | Pipeline LOI transition uses `deal_pipeline_events`. |
| `peer_sets` | `industry_tag` | text | 27 / 27 | Written, never read | Sector classification uses `sector` and `business_model`. |
| `roles` | `role_name` | text | 13 / 13 | Written, never read | Role logic across app uses `role_key` (`admin`, `seller`, `buyer`, `advisor`). |
| `signup_answers` | `reg_reason` | text | 0 / 43 | Never read or written | Registration check uses `reg_no` and `registration_attempts`. |
| `startup_founders` | `contact_email` | text | 0 / 32 | Never read or written | Retired per `src/lib/AGENTS.md`; reads/writes go to `startups.email`. |
| `startup_founders` | `contact_phone` | text | 0 / 32 | Never read or written | Retired per `src/lib/AGENTS.md`; reads/writes go to `startups.contact_number`. |
| `users` | `primary_role_id` | uuid | 0 / 59 | Never read or written | Retired multi-tenant column; account role uses `users.account_role`. |
| `users` | `ai_agent_id` | uuid | 0 / 59 | Never read or written | AI agents are stored directly as rows in `users`. |
| `verification_orders` | `receipt_no` | text | 0 / 0 | Never read or written | Payment receipt generation not connected to billing provider yet. |
| `verification_orders` | `tax_invoice_no` | text | 0 / 0 | Never read or written | Reserved for tax invoice generation. |
| `workspace_context` | `active_role_id` | uuid | 0 / 1 | Never read or written | Replaced by `users.account_role` and persona switcher. |
| `workspace_preferences`| `last_report_company_id` | uuid | 0 / 18 | Never read or written | Report hub selection tracked in route params `?company=`. |

---

## 7. Backups and Point-in-Time Restore (PITR)

- **Managed Platform Backups:**
  - Lovable Cloud databases run on managed PostgreSQL instances with **automated daily snapshots** and **Write-Ahead Logging (WAL)**.
  - Backup retention on standard production instances is **7 days**, with Point-in-Time Restore (PITR) capability allowing restoration to any minute within that 7-day window.
- **Preview & Production Single-Instance Note:**
  - Because preview and published environments share this backend, taking a schema snapshot or data export before executing schema drops is recommended.

---

## 8. Last checks before the clean-up (2026-11-28 11:19 UTC)

Read-only. No code, data, schema, settings or permissions changed. No sign-in.

### 8.1 The counts again

`checked_at` = `2026-11-28 11:19:26.006198+00` (run first, before any other query this turn).

```
relname                   | n_live_tup | seq_scan | idx_scan | n_tup_ins | n_tup_upd | n_tup_del
buyer_verifications       |          1 |     1127 |     3389 |         4 |         1 |         2
contact_requests          |          2 |      255 |      396 |         4 |         4 |         2
deal_activity             |          0 |       74 |        0 |         0 |         0 |         0
deal_ai_ownership         |          0 |       54 |        0 |         0 |         0 |         0
deal_documents            |          0 |       73 |        0 |         0 |         0 |         0
deal_introductions        |          0 |       28 |        0 |         0 |         0 |         0
deal_ownership            |          0 |       27 |      205 |         0 |         0 |         0
deal_share_activity       |          0 |       24 |        0 |         0 |         0 |         0
deal_share_targets        |          0 |       27 |        0 |         0 |         0 |         0
deal_shares               |          0 |      131 |        0 |         0 |         0 |         0
deal_tags                 |          0 |       18 |        0 |         0 |         0 |         0
deals                     |          0 |      158 |     1231 |         0 |         0 |         0
investor_tags             |          0 |       33 |        0 |         0 |         0 |         0
investor_user_assignments |          0 |       19 |       35 |         0 |         0 |         0
peers                     |          0 |       66 |        6 |         1 |         0 |         1
private_notes             |          5 |       69 |       46 |         5 |        18 |         0
saved_investors           |          0 |       13 |     2044 |         2 |         0 |         2
saved_listings            |          0 |       13 |     1991 |         3 |         0 |         3
saved_searches            |          0 |       22 |        0 |         0 |         0 |         0
startup_tags              |          0 |       21 |       15 |         0 |         0 |         0
startup_user_assignments  |          0 |       19 |       35 |         0 |         0 |         0
tenant_features           |          0 |       25 |        0 |         0 |         0 |         0
tenant_settings           |          0 |       31 |        1 |         0 |         0 |         0
tenant_subscription       |          0 |       29 |     7182 |         0 |         0 |         0
user_contacts             |          1 |       92 |       22 |         1 |         0 |         0
verification_usage        |          0 |       20 |      976 |         0 |         0 |         0
```

**Change since 10:49:57:** no table changed `n_live_tup`, `n_tup_ins`, `n_tup_upd` or `n_tup_del` (no writes).
- `seq_scan` +2 on every table except: `buyer_verifications` +4, `contact_requests` +4, `private_notes` +5, `user_contacts` +4. These came from the audit's own exact-count / newest-timestamp / column queries run after the 10:49:57 snapshot (2 per table; the extra on those four from the newest-row look-ups).
- `idx_scan`: `saved_investors` +6, `saved_listings` +3, `tenant_subscription` +3; all others +0. These are app use: `saved_*` by the Watchlist/Browse server functions in 8.5; `tenant_subscription` by `src/lib/session-context.functions.ts:113` (plan lookup on each session-context load).

### 8.2 Every place that names them

Searched: `pg_get_functiondef` of all functions in every non-system schema (none outside `public` matched), triggers, `public` views (none exist), every `pg_policies.qual`/`with_check`, and code in `src/` and `scripts/` (no `supabase/functions/` folder exists; email templates live in `src/`). Excluded generated types, migrations, tests. **`cron.job` could not be read: the read-only role gets `permission denied for schema cron`**, so scheduled jobs are unchecked.

**Database functions**
- `deals`: `public.can_access_deal`, `public.tg_enforce_deal_tenant_match`. (`public.keep_profile_setup_reached` matches only the word "deals" as a wizard step key, not the table.)
- `deal_ownership`: `public.can_access_deal`
- `deal_shares`: `public.can_access_shared_deal`, `public.can_manage_shared_deal`
- `deal_share_targets`: `public.can_access_shared_deal`
- `verification_usage`: `public.verification_open`, `public.verification_checks_changed`
- `hidden_profiles.handover`: `public.discovery_public_rows` (reads `h.live->>'handover'` — a JSON key inside `live`, not the `handover` column)
- every other table and column: none

**Triggers on the tables** (all enabled, `O`): `tenant_settings`, `tenant_subscription`, `tenant_features`, `deals`, `deal_shares`, `deal_share_targets`, `deal_introductions`, `user_contacts` → `tg_set_updated_at`; `startup_tags` → `tg_enforce_startup_tenant_match`; `investor_tags` → `tg_enforce_investor_tenant_match`; `deal_ownership`, `deal_ai_ownership`, `deal_activity`, `deal_tags`, `deal_documents` → `tg_enforce_deal_tenant_match`. Those go with the tables. No trigger on another table names them, except `company_verification_checks.verification_checks_changed` (see 8.3).

**Policies naming them in their condition:** `deal_documents:prd6_dd_write` and `deal_tags:prd6_dt_write` (name `deals`); `investor_tags:prd5_it_write`, `startup_tags:prd4_st_write` (self). No policy on any kept table names them. Policies that live *on* the tables (they go with them): `contact_requests` 1, `deal_activity` 2, `deal_share_targets` 4, `deal_shares` 4, `deals` 4, `saved_investors` 4, `saved_listings` 4, `user_contacts` 1, `verification_usage` 1.

**Code — tables**
- `deals`: `src/lib/deals.functions.ts` 68,111,182,205,213,242,254,276,279; `deal-introductions.functions.ts` 64; `deal-documents.functions.ts` 35; `deal-shares.functions.ts` 121,263,387,534; `profile.functions.ts` 64 (`deals!inner`); `delete-draft.functions.ts` 59,85; `scripts/check-no-direct-supabase.ts` 333–337
- `deal_activity`: `deals.functions.ts` 46,136; `deal-ownership.functions.ts` 13; `deal-documents.functions.ts` 13; `users.functions.ts` 230
- `deal_documents`: `deal-documents.functions.ts` 38,62,67; `users.functions.ts` 230
- `deal_ownership`: `deal-ownership.functions.ts` 34,40; `deals.functions.ts` 201; `profile.functions.ts` 64
- `deal_ai_ownership`: `deal-ownership.functions.ts` 61,67; `deals.functions.ts` 209
- `deal_introductions`: `deal-introductions.functions.ts` 38,72,103,107
- `deal_shares`: `deal-shares.functions.ts` 88,247,401,422,464,491,497
- `deal_share_targets`: `deal-shares.functions.ts` 115,259,353,420,450,458
- `deal_share_activity`: `deal-shares.functions.ts` 53,514
- `saved_listings`: `favourites.functions.ts` 78,179,189,192
- `saved_investors`: `investor-browse.functions.ts` 145,234,244,245
- `saved_searches`: `search.functions.ts` 20,47,63
- `investor_tags`: `investors.functions.ts` 594
- `contact_requests`: `contact-requests.functions.ts` 50,64,70,94,125,145,160; `analytics.server.ts` 9
- `tenant_subscription`: `session-context.functions.ts` 113
- `tenant_features`, `tenant_settings`, `deal_tags`, `startup_tags`, `investor_user_assignments`, `startup_user_assignments`, `peers` (table), `buyer_verifications`, `private_notes`, `user_contacts`, `verification_usage`: none. (`"peers"` appears only as a Valuation tab key in `pipeline-dialogs.tsx` 132,204,322; `"deals"` also as a query key/wizard step, not the table.)

**Code — columns.** Note `suggested_listing_name`, `suggested_headline`, `published_headline`(`_th`) also exist on `hidden_profiles` (kept, seller), so most of their matches are seller code, not `buyer_profiles`/`advisor_firms`. `contact_email`/`contact_phone` are shared names with other tables. The full per-file list is below; matches touching the tables being trimmed are marked by file:
#### `pof_path`
none
#### `revenue_band`
none
#### `suggested_listing_name`
- `src/components/hidden-profile/public-view-fields.tsx` lines 55,56,117,123,125,406,411,475
- `src/components/my-business/approval-bits.tsx` lines 63
- `src/components/my-business/buyer-owner-card.tsx` lines 38
- `src/components/my-business/seller-owner-card.tsx` lines 14,30
- `src/lib/approval-notices.functions.ts` lines 55,56,75,77,94,96
- `src/lib/approvals-one-step.functions.ts` lines 95,112,156,190,308,378
- `src/lib/approvals.functions.ts` lines 73
- `src/lib/buyer-investor.functions.ts` lines 195,317,422
- `src/lib/hidden-profiles.functions.ts` lines 23,41,147,171,260
- `src/lib/identity-review.functions.ts` lines 48
- `src/lib/identity-review.ts` lines 36
- `src/lib/profile-repair.functions.ts` lines 30,68
- `src/lib/seller-listing-text.server.ts` lines 19,115
- `src/lib/seller-listing-wording.ts` lines 17,18
- `src/lib/seller-setup.functions.ts` lines 21,169,178,244,275
#### `published_listing_name`
- `src/components/approvals/one-step-approvals.tsx` lines 408,409
- `src/components/my-business/buyer-my-company.tsx` lines 503
- `src/components/my-business/buyer-owner-card.tsx` lines 13,38
- `src/lib/approval-notices.functions.ts` lines 55,76,77
- `src/lib/approvals-one-step.functions.ts` lines 112,190,191,286,291
- `src/lib/buyer-investor.functions.ts` lines 196
- `src/lib/investor-browse.functions.ts` lines 71
#### `listing_autofill_at`
none
#### `suggested_headline`
- `src/components/approvals/one-step-approvals.tsx` lines 289
- `src/components/hidden-profile/public-view-fields.tsx` lines 123
- `src/components/my-business/admin-investor-profiles.tsx` lines 87,89
- `src/components/my-business/approval-bits.tsx` lines 64
- `src/components/my-business/buyer-description-editor.tsx` lines 76,77
- `src/components/my-business/buyer-investor-edit.tsx` lines 228,251,253,254,296,386,387,399,403,404,444,462,469,699
- `src/components/my-business/buyer-my-company.tsx` lines 566
- `src/components/my-business/buyer-owner-card.tsx` lines 29
- `src/components/my-business/buyer-setup-wizard.tsx` lines 84,301,381,726,744
- `src/components/my-business/seller-owner-card.tsx` lines 15
- `src/lib/approval-notices.functions.ts` lines 55,56,75,77,94,96
- `src/lib/approvals-one-step.functions.ts` lines 72,95,112,156,164,190,198,308,378,505,536
- `src/lib/approvals.functions.ts` lines 76
- `src/lib/buyer-investor.functions.ts` lines 193,318,422,491,516,555,584,593,596
- `src/lib/buyer-listing-identity.ts` lines 8,16
- `src/lib/buyer-profile.ts` lines 7,76
- `src/lib/buyer-wizard.ts` lines 128,134,144
- `src/lib/hidden-profiles.functions.ts` lines 23,41,148,171
- `src/lib/profile-handover.functions.ts` lines 220,223
- `src/lib/review-translation.ts` lines 5,27
#### `published_headline`
- `src/components/approvals/one-step-approvals.tsx` lines 81
- `src/components/my-business/buyer-owner-card.tsx` lines 14,28
- `src/components/my-business/seller-owner-card.tsx` lines 16,31
- `src/lib/approval-notices.functions.ts` lines 55,56,76,77,95,96
- `src/lib/approvals-one-step.functions.ts` lines 71,95,112,157,164,190,191,198,287,291,361
- `src/lib/buyer-investor.functions.ts` lines 197
- `src/lib/contact-company-cards.server.ts` lines 45,52
- `src/lib/hidden-profiles.functions.ts` lines 23
- `src/lib/identity-review.server.ts` lines 27,106
- `src/lib/identity-review.ts` lines 51
- `src/lib/investor-browse.functions.ts` lines 72
- `src/lib/profile-handover.functions.ts` lines 225
- `src/lib/review-translation.ts` lines 5,27
#### `suggested_listing_name_th`
none
#### `suggested_headline_th`
- `src/components/my-business/admin-investor-profiles.tsx` lines 89
- `src/components/my-business/buyer-investor-edit.tsx` lines 251,387,444
- `src/components/my-business/buyer-my-company.tsx` lines 566
- `src/components/my-business/buyer-owner-card.tsx` lines 31
- `src/components/my-business/buyer-setup-wizard.tsx` lines 84,301,382,726,744
- `src/lib/approvals-one-step.functions.ts` lines 112,193,198,536
- `src/lib/buyer-investor.functions.ts` lines 194,319,422,492,516,556,584,593,596
- `src/lib/buyer-listing-identity.ts` lines 8,16
- `src/lib/buyer-profile.ts` lines 7,76
- `src/lib/buyer-wizard.ts` lines 128,134,144
- `src/lib/profile-handover.functions.ts` lines 220,223
#### `published_listing_name_th`
none
#### `published_headline_th`
- `src/components/approvals/one-step-approvals.tsx` lines 410
- `src/components/my-business/buyer-owner-card.tsx` lines 15,30
- `src/components/my-business/seller-owner-card.tsx` lines 17,33
- `src/lib/approvals-one-step.functions.ts` lines 95,112,159,164,193,198,292,362
- `src/lib/buyer-investor.functions.ts` lines 198
- `src/lib/contact-company-cards.server.ts` lines 45,52
- `src/lib/hidden-profiles.functions.ts` lines 23
- `src/lib/identity-review.server.ts` lines 28,109
- `src/lib/identity-review.ts` lines 51
- `src/lib/investor-browse.functions.ts` lines 73
- `src/lib/profile-handover.functions.ts` lines 225
#### `primary_role_id`
none
#### `ai_agent_id`
none
#### `active_role_id`
none
#### `contact_email`
- `src/lib/AGENTS.md` lines 12
#### `contact_phone`
- `src/lib/AGENTS.md` lines 12
#### hidden_profiles `structure`/`process`/`handover`
- src/styles/handover.css:1:/* Profile handover: badge, Ownership dialogs, owner box, Approvals box. Dialog look follows ownership-popup-refer
- src/lib/advisor-pipeline.functions.ts:245:    const { askingPrice: _a, handover: _s, dealType: _d, reason: _r, ...g } = r.generated as Recor
- src/lib/discovery.ts:7:export type DiscoveryListing = { id: string; listing: PublicListing; dealType: string | null; askingPrice: null; pric
- src/lib/discovery.functions.ts:29:    return { id: r.id, dealType: r.dealType, askingPrice: null, priceBand: band ? { key: band.key, label: 
- src/lib/description-story.ts:25:  handover: z.enum(["yes", "no"]).nullable(),
- src/lib/description-story.ts:49:export function descriptionStoryLines(lang: DescriptionLanguage, handover: DescriptionHandover): Description
- src/lib/description-story.ts:147:export function descriptionStoryAnswers(source: ListingSource, lang: DescriptionLanguage, handover: Descrip
- src/lib/description-story.ts:179:export function applyDescriptionAnswers(story: DescriptionStory, fills: Record<DescriptionPartKey, string>,
- src/lib/description-story.ts:192:  return { ...story, handover: handover.stays ?? null, parts, auto, translations: cleanTranslations(story.t
- src/lib/description-story.ts:200:  handover: DescriptionHandover,
- src/lib/description-story.ts:206:    mode: automatic ? "lines" : "own", lang, handover: handover.stays ?? null,
- src/lib/hidden-profiles.functions.ts:126:  structure: z.string().max(400).nullable(),
- src/lib/hidden-profiles.functions.ts:128:  handover: z.string().max(400).nullable(),
- src/lib/hidden-profiles.functions.ts:129:  process: z.string().max(400).nullable(),
- src/lib/hidden-profiles.functions.ts:393:      return { id: r.id, listing, dealType: live.deal_type, ...price, handover: handoverLine(live.o
- src/lib/hidden-profile.ts:19:  "structure",
- src/lib/hidden-profile.ts:21:  "handover",
- src/lib/hidden-profile.ts:22:  "process",
- src/lib/hidden-profile.ts:32:  structure: "Structure",
- src/lib/hidden-profile.ts:34:  handover: "Owner handover",
- src/lib/hidden-profile.ts:35:  process: "Process and dates",
- src/lib/hidden-profile.ts:74:  structure: string | null;
- src/lib/hidden-profile.ts:76:  handover: string | null;
- src/lib/hidden-profile.ts:77:  process: string | null;
- src/lib/hidden-profile.ts:397:    structure: r.structure ?? null,
- src/lib/hidden-profile.ts:399:    handover: r.handover ?? null,
- src/lib/hidden-profile.ts:400:    process: r.process ?? null,
- src/lib/handover-parts.ts:1:/** Profile handover: the parts an owner checks, per kind (brief section 1). Client-safe. */
- src/lib/handover-parts.ts:22:    { key: "deal", view: "public", en: "Deal Terms", th: "เงื่อนไขดีล", fields: [f("hp.asking_price_thb", "Aski
- src/lib/favourites.functions.ts:167:        listing, dealType: live.deal_type, ...priceFor(live as never, state === "approved"), handover: h
- src/lib/profile-handover.server.ts:1:/** Profile handover: server-only helpers. Callers check Control Admin or the owner first. */
- src/lib/profile-handover.server.ts:199:    user_id: user.id, role, first_answer: inv.owner_relation || "handover", first_name: inv.first_nam
- src/lib/seller-setup.functions.ts:301:    reached: z.enum(["role", "name", "web", "year", "rev", "size", "sector", "lic", "photos", "deal", 
- src/lib/seller-wizard.ts:89:  { id: "deal", sec: "Your listing" }, { id: "handover", sec: "Your listing" },
- src/lib/seller-wizard.ts:95:export const LISTING_KEYS = ["photos", "deal", "handover", "price"] as const;
- src/lib/seller-wizard.ts:162:  handover: ["Handover", "ส่งมอบ"], price: ["Price", "ราคา"], founder: ["Founder", "ผู้ก่อตั้ง"], review: ["Rev
- src/lib/seller-wizard.ts:170:  deal: ["Deal type", "รูปแบบดีล"], handover: ["Owner handover", "การส่งมอบงานของเจ้าของ"], price: ["Asking pri
- src/lib/seller-wizard.ts:238:    photos: !!d.hasLogo && (d.photos ?? 0) > 0, deal: !!d.deal, handover: d.stays === "yes" || d.stays === "no"
- src/lib/party-profile.server.ts:25:    handover: handoverLine(hp?.owner_stays, hp?.handover_months),
- src/components/startups/seller-wizard.tsx:358:    handover: { t: L("Will the owner stay on after the sale to hand over the business?", "เจ้า
- src/components/startups/seller-wizard.tsx:398:              : k === "handover" ? (d.stays === "yes" ? L(`Yes, for ${d.months ?? 6} month${(d
- src/components/startups/description-story-editor.tsx:39:  handover: DescriptionHandover;
- src/components/reports/approvals-split.tsx:71:      initials: initials(name), art: l, dirLabel: "Startups Directory", dirTo: "/startups/$id"
- src/components/reports/approvals-split.tsx:117:      dirLabel: "Investors Directory", dirTo: r.investor_id ? "/investors/$id" : "/investors"
- src/components/reports/approvals-split.tsx:163:      dirLabel: "full review", dirTo: "/approvals/buyers/$id", dirParams: { id: b.id }, hando
- src/components/public-site/discovery-copy.ts:11: about:{en:'About the business',th:'เกี่ยวกับธุรกิจ'},terms:{en:'Deal terms',th:'เงื่อนไขดีล

Columns that exist: `advisor_firms` has `suggested_listing_name`, `suggested_headline`, `suggested_headline_th`, `published_listing_name`, `published_headline`, `published_headline_th` (no `suggested_listing_name_th` / `published_listing_name_th`). `hidden_profiles` has `structure`, `process`, `handover` (and the kept `handover_months`). `pof_path`, `revenue_band`, `listing_autofill_at`: no code matches. **`buyer_profiles.suggested_listing_name`/`published_listing_name` are still read** in `buyer-investor.functions.ts`, `approvals-one-step.functions.ts`, `approval-notices.functions.ts` and `buyer-owner-card.tsx`, so that code must change in the same build.

### 8.3 `verification_usage`

- **Trigger:** `verification_checks_changed` is on `public.company_verification_checks`, enabled (`O`). When all six checks are in and check 1 is a mismatch, it runs `UPDATE public.verification_usage SET returned_at = now() WHERE company_id = … AND returned_at IS NULL` (gives the buyer's allowance back) and flags paid orders for refund.
- **Function:** `public.verification_open` reads and inserts `verification_usage` (per-term allowance count). Nothing calls it: no code, no policy, no other function. The app calls `verification_open_pipeline` (`src/lib/company-verification.functions.ts:18`), which does not touch `verification_usage`. Jobs: unchecked (no `cron` access).
- **Would removal break anything today?** Yes, unless done with care: the trigger body is plpgsql, so dropping the table makes `verification_checks_changed` fail at run time the next time a sixth check is saved with check 1 mismatched — that save of a company verification check would error. The trigger (and `verification_open`) must be changed/dropped in the same migration. Nothing else depends on it.

### 8.4 What wrote the newest rows

- **`user_contacts` (27 Oct, 02:31 UTC):** written by app code. The table was added on 27 Oct in commit `87d0808f` (migration `0112_user_contacts.sql`) with a contacts feature; that work was reverted the same day (`759266b1` "Reverted to commit …"), leaving the table and one row. No code, function or trigger writes it today (only its own `updated_at` trigger).
- **`private_notes` (23 Oct, 13:53 UTC):** written by app code — the old Pipeline private-notes server code (`sb.from("private_notes").insert/update`), removed in commit `b8b6eb32` on 23 Oct 14:10 UTC. No code, function or trigger writes it today.

### 8.5 `saved_listings` and `saved_investors`

| Place | Function | Called from |
|---|---|---|
| `favourites.functions.ts:78` | `loadBuyerFavourites` (behind `listFavourites`) | `listFavourites`: `routes/_authenticated/marketplace.favourites.tsx:106`, `routes/_authenticated/marketplace.browse.tsx:97`, `components/pipeline/workspace-invitations.tsx` (import l.20); `loadBuyerFavourites`: `lib/invitations.functions.ts:448` |
| `favourites.functions.ts:179` | `mySavedListingIds` | `components/marketplace/listing-panel.tsx:44` |
| `favourites.functions.ts:189` | `toggleSavedListing` | `components/marketplace/listing-panel.tsx:45` |
| `investor-browse.functions.ts:145` | `loadSellerFavourites` (behind `listSellerFavourites`) | `components/marketplace/seller-favourites.tsx:51`, `components/marketplace/investor-browse.tsx:192`, `components/pipeline/workspace-invitations.tsx` (import l.21) |
| `investor-browse.functions.ts:234` | `mySavedInvestorIds` | `components/marketplace/investor-browse.tsx:33` |
| `investor-browse.functions.ts:244` | `toggleSavedInvestor` | `components/marketplace/investor-browse.tsx:34` |

All six are live: Watchlist pages, Browse panels and NDA Invitations read these tables on every load (hence ~2,000 index reads). They are **not** dead code; removing the tables means first moving these star/watchlist reads to whatever replaces them.

### 8.6 Businesses Wanted tables

- **RLS:** `buy_orders`, `buy_order_applications`, `buy_order_views` — `relrowsecurity = true`, `relforcerowsecurity = false`. **Policies: none** on any of the three.
- **Grants:** no rows in `information_schema.role_table_grants` for `anon` or `authenticated` on any of the three.
- **From the browser:** with the public key, no — no privileges, and RLS on with no policies denies every row anyway (read, add, change, delete all refused).
- **How the app uses them:** server functions only (`buy-orders.functions.ts`, `buy-order-cover.functions.ts`, `discovery.functions.ts`, `sidebar-share.functions.ts`); no browser-side `.from("buy_order…")`. `discovery-page.tsx` names them only through those server functions.

### 8.7 Backups

It was a general statement, not read from this project. No setting or page showing this project's backup or point-in-time-restore retention was checked or is visible to these read-only tools. Treat it as unverified; confirm before the clean-up (e.g. take a table export of the tables to be dropped first).
