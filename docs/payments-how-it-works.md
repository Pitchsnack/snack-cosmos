# Payments, Plans, and Report Access in PitchSnack: Current Backend & Architecture

> **Document purpose:** Technical analysis of how payment rules, subscription plans, and report orders operate in the PitchSnack backend today, and how time-limited free report promotions can be introduced without disrupting existing order and authorization logic.
> **Scope:** Code and database inspection of the live repository. No code, schema, or configuration changes have been applied.

---

## Executive Summary & Direct Confirmations

1. **"The checkout opens but can't take a payment."**
   - **CONFIRMED.** 
   - In `src/components/company-verification/checkout.tsx`, the dialog renders PromptPay, Credit Card, and Bank Transfer tabs, but all submit buttons are permanently `disabled`, accompanied by an explicit status notice: *"Payments are not available yet... A secure payment service must be connected before you can pay. No payment has been taken."*
   - In `src/components/reports/reports-hub.tsx`, non-verification reports display: *"Online payments are not available. Confirming records a manual order as paid for Admin review, using the existing checkout. No money is collected."* For buyers, it displays: *"Payments are not available yet. No payment has been taken and no report has been ordered."*
   - In `src/components/settings/subscription-section.tsx`, plan changes are gated with: *"To change, renew or buy a bundle, contact PitchSnack — online payment isn't open yet."* The public `/plans` route (`src/routes/plans.tsx`) renders `<ComingSoon />`.

2. **"`createMyReportOrder` creates report orders already `paid` (`method = 'Manual'`), with no payment check."**
   - **CONFIRMED.**
   - Located in `src/lib/report-orders.functions.ts`. When a seller confirms a non-verification report order, `createMyReportOrder` inserts a record directly into `public.report_orders` with `status: "paid"`, `method: "Manual"`, `payment_ref: "MAN-XXXXXX"`, and `paid_at: new Date().toISOString()`.
   - If the business's DBD filings are already stored in `public.dbd_company_records`, the function immediately transitions the order to `status: "generated"`.
   - There is zero payment validation, no payment gateway integration, and no financial transaction processed.

3. **"Admin sets plans in Admin › Users. An access code gives a plan free until `term_end` (`subscriptions.source = 'access_code'`)."**
   - **CONFIRMED.**
   - In `src/lib/users.functions.ts` (`updateUserRoleAndPlan`), a Control Admin assigns plans to accounts in Admin › Users. This updates or inserts a record into `public.subscriptions` with `status: "active"` and computes a fresh `term_start` and `term_end` from the plan's `term_months`.
   - In `src/lib/access-gate.functions.ts` (`claimAccessPass`), an access code with a free plan sets `subscriptions.source = "access_code"`, `subscriptions.price_paid_thb = 0`, and calculates `term_end` using `lastFreeDay(today, code.free_months)` formatted to Asia/Bangkok time (`YYYY-MM-DDTHH:mm:ss+07:00`).

---

## 1. Each Type of User: Plans, Lifecycles, and Limits

### 1.1 Plans Overview & Pricing Storage

All subscription plan definitions are stored centrally in the PostgreSQL database table **`public.plans`**. Prices are defined in Thai Baht (THB) in column `plans.price_thb`, alongside `plans.price_type` (`"free"` | `"paid"` | `"on_request"`).

| Role | Plan Key | Display Name | Price (THB) | Price Type | Term | Deal Value Cap | Requests / Term | Verification Mode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Seller** | `entry` | Entry | ฿0 (Free) | `free` | 6 mo | ฿50M | None (`none`) | ฿3,000 / report (`paid`) |
| **Seller** | `promo_pro` | Promo Professional | ฿25,000 | `paid` | 3 mo | ฿200M | 5 contacts (`number`) | Included free (`included`) |
| **Seller** | `pro` | Professional | ฿95,000 | `paid` | 12 mo | ฿200M | 20 contacts (`number`) | Included free (`included`) |
| **Seller** | `executive` | Executive | Bespoke | `on_request` | 12 mo | Unlimited | Unlimited (`unlimited`) | Included free (`included`) |
| **Buyer** | `basic` | Basic | ฿45,000 | `paid` | 6 mo | ฿50M | Bundles (`bundles`) | Not included (`none`) |
| **Buyer** | `investor` | Investor | ฿195,000 | `on_request` | 12 mo | ฿200M | 30 NDAs (`number`) | 10 reports / term (`number`) |
| **Buyer** | `institutional`| Institutional | Bespoke | `on_request` | 12 mo | Unlimited | Unlimited (`unlimited`) | Bespoke (`contract`) |
| **Advisor** | `basic` | Basic | ฿45,000 | `paid` | 3 mo | ฿50M | 10 contacts (`number`)| Not included |
| **Advisor** | `pro` | Pro | Bespoke | `on_request` | 12 mo | Unlimited | 40 contacts (`number`)| Not included |

*(Reference: `public.plans` records, `src/lib/admin-plans.functions.ts`, and `src/lib/sidebar-plans.ts`)*

---

### 1.2 How a Plan Starts

There are three ways a plan can be attached to a user account today:

1. **At Sign-up (`finishSignup` in `src/lib/signup.functions.ts`):**
   - **Sellers:** Automatically assigned the live **Entry** plan (`plans.role = 'seller' ORDER BY sort LIMIT 1`). A row is upserted into `public.subscriptions` with `user_id`, `plan_id: entry.id`, and `term_end: now + 6 months`.
   - **Buyers & Advisors:** **No plan** is assigned at sign-up. Their subscription remains `null` until an access code or Admin assigns one.

2. **From an Access Code (`claimAccessPass` in `src/lib/access-gate.functions.ts`):**
   - Soft-launch invitation codes from `public.access_codes` may specify `free_plan` (e.g., `"Professional"`) and `free_months` (e.g., `3`).
   - The user claims the seat via RPC `claim_access_seat`.
   - `claimAccessPass` upserts into `public.subscriptions`:
     - `status: "active"`
     - `source: "access_code"`
     - `access_code_id: code.id`
     - `price_paid_thb: 0`
     - `term_start: now()`
     - `term_end: ${lastFreeDay(bkkToday(), code.free_months)}T23:59:59+07:00`

3. **Set by Admin (`updateUserRoleAndPlan` in `src/lib/users.functions.ts`):**
   - In Admin › Users, a Control Admin selects an account, assigns an account role, and picks a plan.
   - Caller authorization is verified via `is_control` RPC and `requireAccountAdmin`.
   - Upserts into `public.subscriptions`:
     - `status: "active"`
     - `plan_id: plan.id`
     - `term_start: now()`
     - `term_end: now + plan.term_months`
     - `manager_user_id`: optional assigned manager.
     - `nda_credits`: optional bundle credits (for buyer Basic plan).
   - If the account was previously on a running soft-launch free plan and the admin switches the plan or toggles "make normal", the free plan metadata is cleared (`source: null`).
   - Action is audited in `public.security_events` with `event_type: "ROLE_CHANGE"`.

4. **From the Checkout:**
   - **Does not exist.** There is no server function or client form that accepts payments or starts a subscription from checkout.

---

### 1.3 What "Paid" Means in the Data

Subscription states are tracked in table **`public.subscriptions`**:

```sql
TABLE public.subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL,                    -- 'active' or 'ended'
  source text,                             -- 'access_code' or NULL
  access_code_id uuid,                     -- FK to access_codes(id)
  price_paid_thb numeric,                  -- Amount paid (0 for access codes or Entry)
  price_locked_thb numeric,                -- Grandfathered price on plan edit
  term_start timestamptz NOT NULL,         -- Current billing period start
  term_end timestamptz,                    -- Expiration timestamp
  nda_credits integer NOT NULL DEFAULT 0,  -- Request credits for bundle plans
  manager_user_id uuid,                    -- Dedicated PitchSnack manager
  free_plan_name text,                     -- History of free plan for banner notices
  free_ended_on date,                      -- Date the free plan ran out
  free_end_seen_at timestamptz,            -- Dismissal of end notification
  free_reminder_sent_at timestamptz,       -- 14-day warning email timestamp
  free_end_email_sent_at timestamptz       -- Expiration email timestamp
);
```

- **Statuses in use:**
  - `active`: Plan is currently active.
  - `ended`: Plan duration has elapsed (`term_end < now()`) or was terminated.
  - *(Note: Admins clearing a user's plan or assigning role `admin` delete the row entirely).*
- **Financial recording reality:** Because no payment gateway is connected, `price_paid_thb` is either `0` (for soft-launch access codes / Entry revert) or `NULL` (when assigned by Admin). It does not reflect a settled financial transaction from a bank or merchant provider.

---

### 1.4 Plan Feature Unlocks & Enforcement Points

Every restriction is enforced on the server, primarily in `src/lib/plan-access.server.ts`:

1. **Business Value Cap (`plans.value_cap_thb_m`):**
   - Evaluated by `valueCap(a)` in `src/lib/plan-access.server.ts`.
   - **Server enforcement:** Database trigger `tg_asking_price_cap()` on `public.startups` and `public.hidden_profiles` prevents saving asking prices above the seller's plan cap.
   - **Buyer/Advisor browse filters:** Buyers on plans with caps (e.g., ฿50M on Basic, ฿200M on Investor) cannot view listings exceeding their cap without an upgrade prompt.
2. **Contact & NDA Requests (`plans.requests_mode`, `plans.requests_n`):**
   - Evaluated by `requestsLeft(a, kind)` in `src/lib/plan-access.server.ts`.
   - **Server enforcement:** `spendRequest(userId, kind, ref)`:
     - Throws an error if the user has no plan, if `ended == true`, or if `requestsLeft <= 0`.
     - Logs the consumption in `public.plan_usage` (`user_id, kind: 'contact' | 'nda', ref: target_id, term_start`).
     - Re-requesting the same counterparty within the same term is free (`eq('ref', ref)`).
     - For buyer Basic (`requests_mode = 'bundles'`), decrements `subscriptions.nda_credits`.
3. **Reports Included in Plan:**
   - Stored in `public.plan_reports` (`plan_id, report_key, mode, per_term`).
   - Evaluated atomically in PostgreSQL via RPC `reports_open_plan` (for 6 reports) and `verification_open` (for Company Verification).
4. **Users, Clients & Companies:**
   - Evaluated in `assertCanAddCompany(userId, kind)` in `src/lib/plan-access.server.ts`.
   - Sellers and Advisors are strictly capped at **1 company / firm** on the platform. Admins have no limit.
   - Advisor client caps (`plans.clients_n`) are enforced in `src/lib/advisor-firm.functions.ts`.

---

### 1.5 When a Plan Ends: The Expiration Mechanism

Plan expiration is governed by `src/lib/free-plan.server.ts` and evaluated dynamically on every request in `planAccess()`:

1. **Scheduled Daily Job (`/api/public/free-plan-job`):**
   - Triggered at 00:05 Asia/Bangkok time. Runs `runFreePlanJob()`.
   - Sends a reminder email 14 days before `term_end`.
   - When `lastDayOf(term_end) < bkkToday()`, executes `endFreePlan()`:
     - **Sellers:** Automatically transitioned back to **Entry** (`plan_id: entry.id, status: 'active', source: null, price_paid_thb: 0`). A seller's business remains discoverable, but they lose the ability to initiate contact requests.
     - **Buyers & Advisors:** Subscription status is set to `ended` (`subscriptions.status = 'ended'`). They now have **no plan**, disabling new NDA and contact requests until a new plan is assigned.
     - Sends the official "Free plan ended" bilingual notification email once (`free_end_email_sent_at`).
2. **Request-Time Lazy Expiration:**
   - If the cron job is delayed, `planAccess(userId)` runs `if (freeOverdue(sub)) await endFreePlan(sb, sub)`. An expired user cannot slip through between cron executions.
3. **Paid Plans Expiration:**
   - For non-access-code subscriptions (`source IS NULL`), when `term_end < now()`, `planAccess()` sets `ended = true`. Because there is no recurring card charge engine, the plan does not auto-renew; features lock until an Admin extends the term.

---

### 1.6 Who Can Change Plans

- Only **Control Admins** (`is_control(auth.uid()) = true`) and Account Admins (`is_account_admin`) can change plans or pricing.
- **Admin › Plans Editor (`/admin/plans`, `src/lib/admin-plans.functions.ts`):**
  - Admins can create new plans, edit pricing (`price_thb`), term length, caps, and report allowances.
  - Edits can take effect immediately via `apply_plan_edit` RPC or be scheduled for a future date (`public.plan_changes`).
  - Admins specify whether existing subscribers keep their grandfathered price (`keepPrice: 'stay'`, recorded in `subscriptions.price_locked_thb`) or pay the new price on renewal (`keepPrice: 'renewal'`).
  - Every change is permanently audited in `public.plan_history`.
- **Admin › Users (`/admin/users`):**
  - Control Admins can grant or revoke plans and assign NDA credits. All changes write to `public.security_events`.

---

## 2. Reports Architecture & Access Engine

### 2.1 The Seven Reports Catalog

| # | Report Key | Catalog / DB Key | Display Name (EN) | Display Name (TH) | Catalog Price | Included in Plans |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `verification` | `verification` | Company verification | การตรวจสอบบริษัท | ฿3,000 + 7% VAT (฿3,210) | Seller: Promo Pro, Pro, Exec<br>Buyer: Investor (10), Inst. |
| 2 | `shareholders` | `shareholders` | Shareholders report | รายงานโครงสร้างผู้ถือหุ้น | ฿1,500 | Buyer: Inst. (contract) |
| 3 | `statements` | `financials` / `fs1`/`fs3`/`fs5` | Financial statements | งบการเงิน | ฿10,000 (1-yr: ฿10k, bundle: ฿22k) | Buyer: Investor (5 fs1, 3 fs3, 2 fs5) |
| 4 | `valuation` | `valuation` | Company valuation | การประเมินมูลค่ากิจการ | ฿15,000 | Buyer: Inst. (contract) |
| 5 | `pnl` | `pnl` (maps to `financials`)| P&L analysis | การวิเคราะห์กำไรขาดทุน | ฿10,000 | Buyer: Investor (2), Inst. |
| 6 | `risk` | `risk` | Company risk | การวิเคราะห์ความเสี่ยง | ฿12,000 | Buyer: Investor (2), Inst. |
| 7 | `credit` | `credit` | Credit risk | การประเมินความเสี่ยงสินเชื่อ | Analyst quote (no fixed price) | Buyer: Investor (2), Inst. |

*(Reference: `src/config/report-catalog.json`, `public.plans.verification_price_thb`, and `src/lib/reports-hub.ts`)*

---

### 2.2 Who Can Obtain Reports

1. **Sellers:**
   - Can access reports only for their **own company** in their workspace.
   - **Company Verification:** If on Promo Pro, Pro, or Executive (`verification_mode = 'included'`), the check triggers automatically for free as soon as the company registration number is saved. If on Entry, the check costs ฿3,000 (checkout currently disabled).
   - **Other 6 Reports:** Ordered through Reports Hub (`createMyReportOrder`). Once Admin verifies and delivers the report, the seller can view it and choose to share it with approved NDA buyers in their pipeline.
2. **Buyers:**
   - Must have an **approved, active NDA** (`hubNdaActive(deal)`) for the target business.
   - Can access reports **shared by the seller** (`public.report_shares`), OR
   - Can open/order reports **included in their buyer plan** using `reports_open_plan` or `verification_open`.
   - Cannot purchase reports unbundled online today (checkout modal is disabled for buyers).
3. **Advisors:**
   - Cannot order or buy reports in Reports Hub today. The Reports Hub route and server functions restrict access to `role IN ('seller', 'buyer', 'admin')`.

---

### 2.3 Orders: Tables, Columns, Statuses, and The Pay Action

Two separate tables manage report orders:

#### A. Company Verification Orders: `public.verification_orders`
- **Columns:** `id`, `ref` (`PAY-XXXX`), `company_id`, `ordered_by`, `buyer_account_id`, `amount`, `vat`, `total`, `method`, `slip`, `status`, `paid_at`, `receipt_no`, `tax_invoice_no`, `refund_requested_at`.
- **Status Lifecycle:** `pending` → `paid` → `refunded`.
- **Current Behavior on Pay:** In `src/components/company-verification/checkout.tsx`, the action button is permanently `disabled`. No record is created.

#### B. The Other Six Reports: `public.report_orders`
- **Columns:** `id`, `ref` (`RO-XXXX`), `startup_id`, `kind`, `amount`, `currency`, `status`, `paid_at`, `due_at`, `payment_ref`, `method`, `ordered_by`, `generated_at`, `analyst_id`, `delivered_at`, `delivered_by`, `invoice_no`.
- **Status Lifecycle:** `paid` → `generated` → `delivered` (or `cancelled`, `refunded`).
- **What Happens When User Clicks Pay (`createMyReportOrder`):**
  1. Validates that the caller has access to the startup (`can_access_startup`).
  2. Pulls price from `src/config/report-catalog.json`.
  3. Inserts into `public.report_orders` with:
     - `status: "paid"`
     - `method: "Manual"`
     - `payment_ref: "MAN-" + timestamp`
     - `due_at: now + 2 business days`
  4. Writes event to `public.report_order_events` (`event: "paid"`).
  5. **DBD Automation Check:** Checks if DBD records exist via `producedKeys()`. If statements/risk/pnl exist in the DBD store, the order immediately jumps to `status: "generated"`, `generated_at: now`, with event note *"Already produced from stored DBD data · waiting for Authorise seller"*.
  6. Sends internal notifications to Control Admins (*"Paid report waiting"*).

#### C. Moving From "Generated" to "Delivered" (`authoriseSeller` in `src/lib/report-orders.functions.ts`):
- Control Admin reviews the generated report in Admin › Paid reports or Approvals.
- Admin clicks **[Authorise seller]**.
- Updates `report_orders`: `status = "delivered"`, `delivered_at = now()`, `delivered_by = admin_id`.
- For financials/bundle orders, updates `financial_statements.verified_status = "verified"`.
- The seller is notified, the report status becomes `ready`, and the seller can now view and share it.

---

### 2.4 Reports Included in a Plan (`public.plan_reports`)

Plan entitlements are configured in `public.plan_reports`:

```sql
TABLE public.plan_reports (
  plan_id uuid REFERENCES public.plans(id),
  report_key text,       -- 'fs1', 'fs3', 'fs5', 'verification', 'pnl', 'risk', 'credit', 'shareholders'
  mode text,             -- 'none', 'number', 'unlimited', 'contract'
  per_term integer       -- e.g., 10 for verification, 5 for fs1, 2 for pnl
);
```

- **Usage Tracking:**
  - Company Verification: Tracked in `public.verification_usage` (`buyer_account_id, company_id, term_start, returned_at IS NULL`).
  - Other 6 Reports: Tracked in `public.plan_usage` (`user_id, kind = 'report:' || planKey, ref = company_id, term_start`).
- **Idempotency & Re-opening:** Opening the same report for the same target business multiple times during the same billing term does **not** consume extra units (`ref = company_id`).
- **Allowance Reset:** Reset is tied to the subscription's `term_start`. When a subscription term rolls over, queries filtering by `term_start = s.term_start` naturally return 0, refreshing the user's allowance.

---

### 2.5 Access Afterwards: Does Access Ever Expire?

Here lies an important distinction in the platform between Company Verification and the other reports:

1. **For Sellers:**
   - Once an order reaches `status = delivered` or `company_verifications.status = certified`, the seller's access to view their own report **NEVER expires**. Reverting to the free Entry plan does not remove or lock delivered reports.
2. **For Buyers (via Seller Share - `public.report_shares`):**
   - Access persists as long as the seller has not revoked it (`revoked_at IS NULL`) and the counterparty deal NDA remains valid (`hubNdaActive`, up to 730 days). A change in the buyer's plan does **not** revoke reports the seller shared with them.
3. **For Buyers (via Plan Open - `public.buyer_report_access`):**
   - **For the 6 Reports (`statements`, `valuation`, `shareholders`, `pnl`, `risk`, `credit`):** Stored in `public.buyer_report_access`. This table has **no expiration column**. Once opened via a plan, the buyer keeps access for that deal indefinitely (while the NDA is active), even if their subscription later ends!
4. **For Buyers (Company Verification - `public.verification_access`):**
   - **EXPIRES WITH THE PLAN.** When a buyer opens Company Verification via plan (`via = plan`), `verification_access.open_until` is explicitly stamped with `subscriptions.term_end`.
   - The security check `public.verification_can_read()` enforces:
     ```sql
     AND (a.open_until IS NULL OR a.open_until > now())
     ```
   - Therefore, when the buyer's subscription term ends, their access to Company Verification **locks immediately**.

---

## 3. Designing Time-Limited Free Reports (Then Paid)

The platform requires a mechanism to offer specific reports free for a promotional period, automatically reverting to paid pricing once the period concludes, without manual database edits at the cutover.

### 3.1 What Makes a Report Free Today?

Today, reports are free only via:
1. **Plan Feature:** Seller plans having `verification_mode = included`.
2. **Plan Entitlement:** Buyer Investor plan having `plan_reports` allowances.
3. **Soft-Launch Invitation Code:** Subsidizing an upgraded plan for 1–6 months free.
4. *Direct global promotional overrides (e.g. "Free for everyone until Nov 30") do not exist.*

---

### 3.2 Evaluation of the Four Approaches

#### Option A: Free for Everyone Until a Set Date (Per Report Type)
- **Database Schema:** A dedicated table `public.report_promotions`:
  ```sql
  CREATE TABLE public.report_promotions (
    report_key text PRIMARY KEY,            -- 'verification', 'financials', etc.
    free_until timestamptz NOT NULL,        -- e.g. '2026-11-30 23:59:59+07'
    promo_badge_en text NOT NULL,           -- 'Free during soft launch until 30 Nov'
    promo_badge_th text NOT NULL,           -- 'ฟรีช่วงทดลองใช้งานถึง 30 พ.ย.'
    created_at timestamptz DEFAULT now()
  );
  ```
- **Where the Check Runs:**
  - Client & Hub Data: In `src/lib/reports-hub.server.ts` (`hubData`), query `report_promotions`. If `free_until > now()`, report price is displayed as `0` alongside the promotional badge.
  - Server Order Function: In `createMyReportOrder`, if `report_promotions.free_until > now()`, bypass checkout charge, set `amount = 0`, `method = Promotion`, and create the order.
  - For Buyers: In `reports_open_plan`, if the report has an active promotion, bypass plan allowance checks.
- **How It Switches Automatically:** Because the condition is `free_until > now()`, the transition is instantaneous at midnight. No background cron job or database worker is required. The moment `now()` passes `free_until`, all functions immediately revert to catalog pricing (`report-catalog.json`).

#### Option B: Free for N Days from User Sign-up or Approval
- **Database Schema:** Add a promotion duration setting, e.g. `free_report_days: 14` in `public.soft_launch_settings`.
- **Where the Check Runs:**
  - In `reports-hub.server.ts` and `createMyReportOrder`.
  - Calculate `const eligibilityEnd = new Date(user.created_at).getTime() + (free_report_days * 86400000)`.
  - Check: `now() < eligibilityEnd`.
- **How It Switches Automatically:** Evaluated per user dynamically. On day 15, the user's personal window closes, and standard pricing displays automatically.

#### Option C: Free on Certain Plans or via Access Code
- **Database Schema:** Reuse `public.access_codes` and `public.subscriptions`.
  - Add `free_report_keys text[] DEFAULT '{"verification","financials"}'` to `public.access_codes`.
  - When `claimAccessPass` runs, store allowed free reports or link the code to a plan that grants them.
- **Where the Check Runs:** Inside `reports-open-plan` and `verification_open`. Check `subscriptions.source = access_code` AND `subscriptions.term_end > now()`.
- **How It Switches Automatically:** Runs on the existing `free-plan-job` infrastructure. When the access code term expires, the free report allowance terminates alongside the subscription.

#### Option D: Quota-Based (First N Reports Free, Then Paid)
- **Database Schema:** Track promotional usages in a new table `public.promotional_report_usage` (`user_id, report_key, order_id, used_at`).
- **Where the Check Runs:** Count existing usages: `SELECT count(*) FROM promotional_report_usage WHERE user_id = ...`. If `count < allowed_quota`, price is 0; otherwise standard price.
- **How It Switches Automatically:** Switches immediately upon completion of the Nth report order.

---

### 3.3 User Experience at the Cutover & Data Integrity

1. **What the User Sees:**
   - **Before Cutover:**
     - Button: `[Order free · Soft launch]` / `[สั่งซื้อฟรี · ช่วงเปิดตัว]`
     - Subtitle: `Free until 30 Nov 2026 (Regular price: ฿10,000)`
   - **After Cutover:**
     - Button: `[Order for ฿10,000]` / `[สั่งซื้อ ฿10,000]`
     - Subtitle: Standard checkout terms.
2. **Orders in Progress at Cutover Moment:**
   - An order placed 5 minutes before the cutoff has already been recorded in `public.report_orders` with `status: "paid"` (or `"generated"`).
   - Order processing depends strictly on `report_orders.status`, **not** on current promotional status.
   - Admins can authoritatively deliver the report days after the promotion ends without friction or retroactive billing.
3. **Retention of Free Reports:**
   - Reports obtained for free during the promotion **must remain permanently available** in the seller's workspace and in `buyer_report_access` for that deal. Free promotional delivery must grant permanent read rights identical to paid delivery.

---

### 3.4 Reusing the Access Code Mechanism

Can the existing access code mechanism (`source = access_code`, `term_end`) be reused for reports?

**YES, and it is highly recommended for client-targeted promotions:**
- The access code subsystem (`src/lib/access-codes.ts`, `src/lib/free-plan.server.ts`) is already the most battle-tested time-gating architecture in the codebase.
- It already handles Asia/Bangkok midnight alignment, 14-day advance email warnings, daily cleanup cron execution (`/api/public/free-plan-job`), and lazy request-time verification.
- By configuring `plan_reports` or attaching report entitlements to an access code, marketing can distribute codes that give specific prospective corporate buyers or sellers 3 months of free reports that shut off cleanly when the access code term ends.

---

### 3.5 Recommendations & Implementation Roadmap

#### Recommended Architecture: Dual-Tier Promotion
1. **Tier 1 (Calendar Promo for All Users):** Implement **Option A** (`public.report_promotions`).
   - Cleanest implementation: zero cron jobs, zero background tasks, zero database drift.
   - Marketing can set a date (e.g. November 30, 2026 23:59:59+07:00), and the entire system seamlessly flips to paid pricing at midnight.
2. **Tier 2 (Client-Specific Vouchers):** Implement **Option C** via `access_codes`.
   - Allows bespoke partnerships (e.g., giving 5 free verification reports to a partner PE firm) without opening the promotion to the general public.

#### What It Would Take to Build (Implementation Scope):
- **Migration (1 file):** Create `public.report_promotions` table with RLS (public read, Admin write).
- **Backend (2 files):**
  - Update `src/lib/reports-hub.server.ts` to attach active promotion details to `HubRow`.
  - Update `src/lib/report-orders.functions.ts` (`createMyReportOrder`) to validate against `report_promotions` when determining whether an order is zero-cost.
- **Frontend (2 files):**
  - Update `src/components/reports/reports-hub.tsx` to display promotional badges and zero-baht confirmation dialogs.
  - Add an Admin control panel in Admin › Approvals or Paid Reports to configure promotion dates.
- **Effort Estimate:** Approximately 1 to 2 days of engineering, inclusive of end-to-end Playwright tests.

---

## 4. Current Gaps, Edge Cases & Technical Risks

1. **No External Payment Gateway Connected:**
   - There is no payment processor (Stripe, 2C2P, Omise, GB Prime Pay, etc.) in the repository.
   - Any order marked "paid" today is recorded through the manual administrative fallback (`method = Manual`).
2. **Buyer Report Purchasing Is Completely Blocked in UI:**
   - While sellers can place zero-charge "Manual" orders for Admin review in Reports Hub, buyers have no path to purchase unbundled reports if their plan allowance is exhausted. The checkout modal displays a hard block.
3. **Inconsistent Expiration Rules Between Reports:**
   - A buyer who opens a Company Verification report via a plan loses access the moment their subscription ends (`verification_access.open_until = subscriptions.term_end`).
   - In contrast, a buyer who opens any of the other 6 reports via a plan (`buyer_report_access`) retains access indefinitely for that pipeline deal, even after their subscription ends. This discrepancy should be harmonized before paid billing goes live.
4. **Advisors Have Zero Report Capabilities:**
   - Advisory firms cannot purchase, order, or receive reports in the Reports Hub. If advisors are intended to purchase reports on behalf of clients, new role permissions and billing delegation tables will be required.
5. **No Invoice or Tax Receipt Generation:**
   - Although `report_orders` and `verification_orders` possess columns for `receipt_no` and `tax_invoice_no`, there is no PDF rendering engine or automated billing document delivery in the backend today.
