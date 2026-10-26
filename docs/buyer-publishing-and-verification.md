# Buyer Profile Publishing and Buyer Verification Report

**PitchSnack — Architecture, Database, Admin Approvals & Buyer Journey**  
**Date:** 26 October 2026  
**Scope:** Current production behavior (no code, styles, data, or settings modified)

---

## 1. The Journey, Step by Step

### Standard Buyer Journey

The buyer journey consists of two completely independent tracks:
- **Track A (Profile Publishing):** Makes the buyer visible as an anonymous investor card in **Browse investors**.
- **Track B (Buyer Verification):** Verifies the buyer's real identity, work email, and company registration, unlocking the ability to sign and request NDAs.

| Step | Action | Who Does It | Where (Page, Route, Component, File) | Data Changes |
|---|---|---|---|---|
| **1. Sign-up** | User creates an account with role `buyer` | Buyer | `/login`, component `src/routes/login.tsx` | `users` (`account_role = 'buyer'`), `user_roles`, `user_profiles`. |
| **2. Buyer Profile & Investor Row Auto-Provisioning** | Trigger automatically creates linked investor shell | Server (Trigger) | PostgreSQL trigger `zz_buyer_one_investor` / `tg_buyer_link_verification_owner` | `buyer_profiles` (`ref_no = 'INV-xxxx', status = 'draft', approval_status = 'draft'`), `investors` (`status = 'Prospect', visibility = 'Tenant'`), `investor_profile_verifications` (`status = 'unverified'`). |
| **3. Complete Setup Wizard** | Answers mandate questions (role, type, address, website, ticket, sectors, etc.) | Buyer | `/buyer/company/$id/setup`, component `BuyerSetupWizard` (`src/components/my-business/buyer-setup-wizard.tsx`) | Updates `investors` (`setup_done_at`, `investor_name`, `ticket_band`, `preferred_industries`, etc.) and mirrors to `buyer_profiles`. |
| **4. Submit Profile for Approval (Track A)** | Clicks **Submit for approval** | Buyer | `/marketplace/my-company`, component `PublicPanel` (`src/components/my-business/buyer-my-company.tsx`), calls `setBuyerListing` (`src/lib/buyer-profile.functions.ts`) | `buyer_profiles.approval_status = 'in_review'`, `buyer_profiles.submitted_at = now()`, inserts into `approval_events` (`item_type = 'buyer_profile', action = 'submit'`). |
| **5. Admin Approves Profile (Track A)** | Clicks **Approve & publish** | Admin | `/approvals?tab=buyers`, component `BuyerProfileApprovals` (`src/components/reports/buyer-profile-approvals.tsx`), calls `decideBuyerProfile` (`src/lib/approvals.functions.ts`) | `buyer_profiles.approval_status = 'approved'`, `buyer_profiles.status = 'live'`, `buyer_profiles.live_since = now()`, `buyer_profiles.decided_at = now()`, `buyer_profiles.decided_by = admin_id`. Inserts into `approval_events` and creates in-app notification + email. **(a) PROFILE NOW SHOWS IN BROWSE INVESTORS.** |
| **6. Submit Buyer Verification (Track B)** | Fills company name, registration number, work email, website, LinkedIn and clicks **Submit for verification** | Buyer | `/my-page` (My Profile), component `BuyerVerificationCard` (`src/components/marketplace/buyer-verification.tsx`), calls `submitVerification` (`src/lib/approvals.functions.ts`) OR via Exclusive view footer (`submitMyBuyerForVerification`) | `investor_profile_verifications` (`status = 'pending', company_name, registration_no, work_email, website, linkedin, email_domain_match, submitted_at = now()`). Inserts into `approval_events` (`item_type = 'buyer', action = 'submit'`). |
| **7. Admin Verifies Buyer (Track B)** | Reviews DBD registration, email domain match, checklist and clicks **Verify buyer** | Admin | `/approvals/buyers/$id`, component `BuyerReview` (`src/routes/_authenticated/approvals.buyers.$id.tsx`), calls `decideBuyer` (`src/lib/approvals.functions.ts`) | `investor_profile_verifications.status = 'verified'`, `investor_profile_verifications.decided_at = now()`, upserts `user_verifications` (`user_id, verified_at, verified_by`). Inserts into `approval_events` (`item_type = 'buyer', action = 'verify'`). **(b) BUYER CAN NOW SIGN AND REQUEST NDAs.** |

---

### PML VENTURES (NB Siripun) — Exact History & Current State

- **User ID:** `4bcb105a-3472-43b8-88d1-ee5fca54fb6e`
- **Name:** NB SIRIPUN
- **Investor Profile Ref:** `INV-1008`
- **Linked Investor Row ID:** `bc8dee9b-85ef-4069-9b4f-e8c56dabb8dc` (`investor_name = 'PML VENTURES'`)

#### Timeline in the Database:
1. **12 Oct 2026, 17:38:32 UTC:** Account and linked investor shell created (`INV-1008`).
2. **12 Oct 2026, 17:43:22 UTC:** Nina submitted the investor profile for publishing (`approval_events` record `b0dd3ef5`, `item_type = 'buyer_profile', action = 'submit'`).
3. **12 Oct 2026, 17:59:20 UTC:** Admin Dan Antakon approved and published the profile (`approval_events` record `ee7c8402`, `item_type = 'buyer_profile', action = 'approve'`).
   - `buyer_profiles.approval_status` became `approved`.
   - `buyer_profiles.status` became `live`.
   - `buyer_profiles.live_since` became `2026-10-12 17:59:20.814 UTC`.
4. **13 Oct 2026, 08:13:21 UTC:** Setup wizard marked complete (`setup_done_at`).
5. **15 Oct 2026, 10:49:21 UTC:** Migration / trigger auto-created an entry in `investor_profile_verifications` (`id = 73e52cd4-205d-41b3-97ee-1bddf4fca84f`, `status = 'unverified'`).
6. **Current Status:**
   - **Profile Publishing (Track A):** **APPROVED & LIVE** (`approval_status = 'approved', status = 'live'`). PML VENTURES appears in Browse Investors.
   - **Buyer Verification (Track B):** **NOT SUBMITTED / UNVERIFIED** (`investor_profile_verifications.status = 'unverified', submitted_at = NULL`). `user_verifications` has no row.
   - **Result:** When Nina (PML VENTURES) received a seller invitation on PS-1028 and clicked **Sign and request NDA**, `pipeline.functions.ts` (`requestNda`) checked `user_verifications` and `investor_profile_verifications.status === 'verified'`. Because Track B was never submitted or approved, it blocked with: **`"Verify your buyer profile first"`**.

---

## 2. Publishing an Investor Profile

### The Buyer's Side
- **Page & Route:** My Company (`/marketplace/my-company`), Edit view (`/marketplace/my-company/edit`).
- **Component & File:** `PublicPanel` in `src/components/my-business/buyer-my-company.tsx`.
- **Button:**
  - Label in draft: **"Submit for approval"**
  - Label when changes requested / declined: **"Resubmit for approval"**
  - Label when paused and already approved: **"Resume listing"**
  - Label while in review: **"Withdraw"** (secondary button)
  - Label when live: **"Pause listing"** (secondary button)
- **Pre-requisites before publishing works:**
  Enforced in `setBuyerListing` (`src/lib/buyer-profile.functions.ts`):
  1. `setup_done_at` must be set on the linked `investors` record.
  2. `investor_name` (Company name) must not be empty.
  3. `ticket_band` (Average investment) must be selected.
  4. `deal_types` in `buyer_profiles` must have at least 1 deal type picked.
  5. If `showsStages(investor_type)` is true, `preferred_stages` must have at least 1 stage.
  6. `preferred_industries` (Sectors) must have at least 1 entry.
  7. Client-side identity check: `descriptionLeaks` verifies that `description` does not leak firm name, website, or contact info.
- **What the buyer sees in each state:**
  - **Draft (Setup incomplete):** Banner: *"Finish setting up your profile to publish it."* Button: *"Finish setup to publish"*.
  - **Draft (Setup complete):** Notice: *"Everything is ready. Submit your profile for Admin review so sellers can find you in Browse investors."* Button: *"Submit for approval"*.
  - **In Review:** Notice: *"Admin is reviewing your profile. It goes live in Browse investors once approved."* Button: *"Withdraw"*.
  - **Changes Requested / Declined:** Notice: *"Admin note: <decision_note>"*. Button: *"Resubmit for approval"*.
  - **Live:** Footer: *"Live in Browse investors since <date> · X NDAs · Y LOIs"*. Button: *"Pause listing"*.
  - **Paused:** Footer: *"Hidden from Browse investors since <date>."* Button: *"Resume listing"*.
- **Pausing / Unpublishing:**
  - The buyer can pause at any time by clicking **"Pause listing"**. This immediately updates `buyer_profiles.status = 'paused'`.
  - Pausing **does not require Admin approval**.
  - Resuming when already approved sets `status = 'live'` directly without re-submitting to Admin.

### Admin's Side: Profiles to Publish
- **Queue Location:** Top navigation **Approvals** (`/approvals`), **Buyers** tab (`/approvals?tab=buyers`).
- **Queue Component:** `BuyerProfileApprovals` (`src/components/reports/buyer-profile-approvals.tsx`) and split review `approvals-split.tsx`.
- **Server Function:** `listApprovals` (`src/lib/approvals.functions.ts`).
- **What puts a profile in this queue:**
  `buyer_profiles.approval_status IN ('in_review', 'changes_requested')`.
- **What takes it out:**
  Admin action: `decideBuyerProfile` with action `approve` (sets `approval_status = 'approved', status = 'live'`) or `decline` (sets `approval_status = 'declined'`). Buyer withdrawing sets `approval_status = 'draft'`.
- **Queue Columns:**
  `Investor` (name, ref_no, user name, link to Investors Directory), `Type`, `Public description` (with identity leak checker), `Submitted` (date), `Status` (In review / Changes requested), Action buttons.
- **Review Page:**
  Inline on `/approvals?tab=buyers`, or split review panel (`approvals-split.tsx`). Links to `/investors/$id` for full Directory editing.
- **Admin Actions (`decideBuyerProfile` in `src/lib/approvals.functions.ts`):**
  1. **Approve & publish:**
     - Data: `buyer_profiles.approval_status = 'approved', status = 'live', live_since = COALESCE(live_since, now()), decided_at = now(), decided_by = admin_id`.
     - Email & Notification: Sends email alert `approved` (Subject: *"You are verified and live on PitchSnack"*, Title: *"Your profile is approved"*, Body: *"Admin verified your account and published your investor profile. Sellers can now find your firm as {buyer code name} in Browse investors, and you can request NDAs."*). In-app notification: *"Your investor profile is live — Sellers can now find you in Browse investors."*
     - Log: Writes to `approval_events` (`item_type = 'buyer_profile', action = 'approve', actor_id = admin_id`).
  2. **Request changes:**
     - Data: `buyer_profiles.approval_status = 'changes_requested', decision_note = note, decided_at = now(), decided_by = admin_id`.
     - Email & Notification: In-app notification *"Changes requested on your investor profile — <note>"*. Email alert `changes_requested`.
     - Log: Writes to `approval_events` (`action = 'request_changes'`, with note).
  3. **Decline:**
     - Data: `buyer_profiles.approval_status = 'declined', decision_note = note, decided_at = now(), decided_by = admin_id`.
     - Email & Notification: In-app notification *"Investor profile not approved — <note>"*. Email alert `declined`.
     - Log: Writes to `approval_events` (`action = 'decline'`, with note).

### The Data and the Rules
- **Statuses (`buyer_profiles` table):**
  - `status`: `draft` | `live` | `paused`. Controls whether the profile is currently active.
  - `approval_status`: `draft` | `in_review` | `approved` | `changes_requested` | `declined`. Controls the governance gate.
- **Two fields that both say whether a profile is published:**
  `buyer_profiles.status` and `buyer_profiles.approval_status`.
  - **Where they could disagree:** A profile can have `approval_status = 'approved'` but `status = 'paused'` (if the buyer paused their own live listing). However, a profile should NEVER have `status = 'live'` if `approval_status !== 'approved'`.
- **Query and access rules for Browse Investors:**
  `loadPublicInvestors` in `src/lib/investor-browse.functions.ts`:
  ```sql
  SELECT * FROM buyer_profiles WHERE status = live AND investor_id IS NOT NULL;
  ```
  Only sellers can call `listBrowseInvestors` (enforced by `requireRole(userId, [seller])`).
- **Does publishing check verification anywhere?**
  **NO.** `setBuyerListing` and `decideBuyerProfile` check mandate completeness and public text cleanliness, but **never check `investor_profile_verifications` or `user_verifications`**.

---

## 3. Buyer Verification

### The Buyer's Side
- **Where the buyer submits it:**
  Primary entry: **My Profile** (`/my-page`), rendered by `BuyerVerificationCard` (`src/components/marketplace/buyer-verification.tsx`).
  Secondary entry: **My Company › Exclusive view** footer, calls `submitMyBuyerForVerification` (`src/components/my-business/buyer-private-view.tsx`).

#### Every Field in Buyer Verification:

| Field Label | Required? | Checks | Saved in (Table & Column) | Who Sees It |
|---|---|---|---|---|
| **Company / fund name** | Yes | Max 200 chars, non-empty | `investor_profile_verifications.company_name` | Admin only (shared with sellers only after approved NDA) |
| **Buyer type** | Optional | Select from 5 types: Private equity, Family office, Corporate, Individual investor, Search fund | `investor_profile_verifications.buyer_type` | Admin, public category on card |
| **Registration number** | Optional (Req in TH setup) | Checked against DBD registry format | `investor_profile_verifications.registration_no` | Admin only (DBD check) |
| **Company website** | Optional | Max 255 chars, compared to work email domain | `investor_profile_verifications.website` | Admin only (NDA gated) |
| **Work email** | Yes | Valid email format, domain parsed | `investor_profile_verifications.work_email` | Admin only (NDA gated) |
| **LinkedIn** | Optional | Max 255 chars | `investor_profile_verifications.linkedin` | Admin only (person check) |

- **Documents:**
  - The database table `investor_profile_verifications` has a `documents text[]` column, and Admin's review page (`/approvals/buyers/$id`) renders `{bv.documents.length} file(s)`.
  - **However, in `BuyerVerificationCard`, there is no file upload input.** Buyers cannot currently upload registration certificates or proof of funds via this card.
- **Submit button and declaration:**
  - Button label: **"Submit for verification"**.
  - There is currently **no checkbox declaration** on the card (unlike the NDA signing dialog which has *"I have read the NDA and agree to its terms"*).
- **Does anything else start the check?**
  - Setup wizard completion (`Review & complete`) **does not** start verification.
  - Edit information (`saveMyBuyerInvestor`) **does not** start verification.
  - Only clicking **Submit for verification** (in `/my-page` or the Exclusive view footer) invokes `submitVerification` or `submitMyBuyerForVerification`.
- **What the buyer sees in each state on `/my-page`:**
  - **Not verified yet:** Form fields with header: *"Submit for verification — Verified buyers can request NDAs. Admin checks your company and work email."*
  - **Pending:** Blue banner with clock icon: *"Pending verification. You can browse and save listings; NDA requests open once Admin verifies you (usually within 1 business day)."*
  - **Verified:** Green banner with shield icon: *"Verified buyer · you can request NDAs."*
  - **More info needed:** Amber banner: *"More info needed: <decision_note>"* above the form.
  - **Declined:** Red banner: *"Verification declined: <decision_note>"* above the form.

### The States and the Data
- **Primary Table:** `investor_profile_verifications`:
  - Columns: `id` (uuid), `investor_id` (uuid fk), `user_id` (uuid), `company_name`, `buyer_type`, `registration_no`, `work_email`, `website`, `linkedin`, `documents` (text[]), `status` (text), `email_domain_match` (boolean), `decision_note` (text), `assignee_id` (uuid), `submitted_at`, `decided_at`, `created_at`, `updated_at`.
- **Secondary Table:** `user_verifications` (`user_id`, `verified_at`, `verified_by`):
  - Created when Admin verifies a buyer (`decideBuyer`).
- **Triggers:**
  - `zz_investor_verification_entry`: On `investors` INSERT, inserts an initial row into `investor_profile_verifications` with status `unverified`.
  - `zz_buyer_link_verification_owner`: On `buyer_profiles` INSERT/UPDATE, updates `user_id` on the verification row.
- **Older / Legacy Tables:**
  - `buyer_verifications`: Schema exists in DB (0 rows), but is **completely unused** in application code (only auto-generated TypeScript types reference it).
- **State Transitions:**
  - `unverified` / `none` $	o$ `pending`: Buyer calls `submitVerification` or `submitMyBuyerForVerification`.
  - `pending` $	o$ `verified`: Admin calls `decideBuyer({ action: verify })`.
  - `pending` $	o$ `more_info`: Admin calls `decideBuyer({ action: more_info, note })`.
  - `pending` $	o$ `declined`: Admin calls `decideBuyer({ action: decline, note })`.
  - `more_info` / `declined` $	o$ `pending`: Buyer edits and resubmits.

### Admin's Side: Buyer Verifications
- **Queue Location:** Approvals › Buyers tab (`/approvals?tab=buyers`), section **Buyer verifications**.
- **Queue Query:** `investor_profile_verifications.status IN ('pending', 'more_info')`.
- **Review Page Route & Component:**
  Route: `/_authenticated/approvals/buyers/$id` (`src/routes/_authenticated/approvals.buyers.$id.tsx`).
  Component: `BuyerReview`.
- **Checks shown on the review page:**
  1. **Company registration:** Shows `registration_no` with prompt *"check against DBD"*.
  2. **Work email domain:** Compares domain of `work_email` against `website`. Shows green *"Matches the website"* or amber *"Domain differs from the website"*.
  3. **LinkedIn:** Shows whether a profile URL was provided.
  4. **Documents:** Shows file count (`bv.documents?.length`).
  5. **Reviewer Checklist (Manual Admin Checkboxes):**
     - [ ] Company exists and is active
     - [ ] Work email belongs to the company
     - [ ] LinkedIn matches the person
     - [ ] Mandate is plausible
- **Admin Actions (`decideBuyer` in `src/lib/approvals.functions.ts`):**
  1. **Verify buyer (`action: "verify"`):**
     - Sets `investor_profile_verifications.status = 'verified', decided_at = now()`.
     - Upserts into `user_verifications` (`user_id, verified_at = now(), verified_by = admin_id`).
     - Inserts into `approval_events` (`item_type = 'buyer', action = 'verify', actor_id = admin_id`).
     - In-app notification: *"You're a verified buyer — You can now request NDAs."*
  2. **Request more info (`action: "more_info"`):**
     - Sets `investor_profile_verifications.status = 'more_info', decision_note = note, decided_at = now()`.
     - Inserts into `approval_events`.
     - In-app notification + Email alert `changes_requested`.
  3. **Decline (`action: "decline"`):**
     - Sets `investor_profile_verifications.status = 'declined', decision_note = note, decided_at = now()`.
     - Inserts into `approval_events`.
     - In-app notification + Email alert `declined`.

---

### Where Verification is Enforced

| Where (Page or Action) | What's Checked, and Where (Component, Function or Policy) | What an Unverified Buyer Sees (Exact Text) |
|---|---|---|
| **1. Request NDA button (Browse listings)** | `src/components/marketplace/listing-panel.tsx` (`NdaButton`) checks `data?.verified` from `useMyVerification()`. | If unverified: button is disabled with tooltip **`"Submit for verification on My Profile first"`**.<br>If pending: renders `<PendingContactButton>` labelled **`"Connect seller"`** with tooltip **`"Pending verification · Admin usually verifies within 1 business day"`**. |
| **2. Server enforcement on NDA Request (`requestNda`)** | `src/lib/pipeline.functions.ts` (`requestNda`): checks `user_verifications` and `investor_profile_verifications.status === 'verified'`. | Server throws error: **`"Verify your buyer profile first"`** (shown as toast). |
| **3. Sign and request NDA (Seller Connect Invitation)** | `src/components/marketplace/buyer-invitations.tsx` (`DecisionBar`) & `src/components/pipeline/workspace-invitations.tsx` (Sign dialog): modal allows ticking checkbox, but clicking **Sign and request NDA** calls `requestNda`. | Error toast: **`"Verify your buyer profile first"`**. |
| **4. Accept NDA on NDA Invitations** | Same as above: accepting an invitation triggers the mutual NDA signing flow (`requestNda`). | Error toast: **`"Verify your buyer profile first"`**. |
| **5. Messages (Direct Chat with Counterparty)** | `src/lib/messages.functions.ts` (`myPipelineIds`): only queries pipelines where `nda_approved_at IS NOT NULL`. | Unverified buyers cannot sign NDAs $	o$ no deal pipeline reaches approved NDA $	o$ **no chat thread exists**. (Help Desk with Admin is still available). |
| **6. Verified investor chip (Sellers' view)** | `src/lib/investor-browse.functions.ts` calls DB function `investor_is_verified(_ids)`, requiring `v.status = 'verified'` AND `bp.approval_status = 'approved'`. | Card **does not show** the green **`✓ Verified investor`** chip. |

---

## 4. How the Two Fit Together

### 1. Can a profile be published while its buyer isn't verified? Can Admin approve one without the other?
- **YES.** Profile publishing (`buyer_profiles.approval_status`) and buyer verification (`investor_profile_verifications.status`) are two separate database records and two separate admin workflows.
- Admin can click **Approve & publish** under *Profiles to publish* without checking or verifying the buyer's identity.
- This is exactly what happened with **PML VENTURES (INV-1008)** and **LINE MAN Wongnai (INV-1015)**: both profiles are approved and live in Browse Investors, but neither buyer is verified.

### 2. Does the Profiles to Publish review show the buyer's verification? Does the verification review show whether the profile is published?
- **In Profiles to Publish:** In the split view (`approvals-split.tsx`), line 120 displays a check: `[verified, "Verified buyer", verified ? "Since ..." : "Not verified yet"]`. However, in the standard table (`buyer-profile-approvals.tsx`), verification status is **not shown in the table columns**. Admin can approve without seeing or resolving verification.
- **In Buyer Verifications (`/approvals/buyers/$id`):** The review page focuses entirely on company registration, DBD checks, work email domain, and LinkedIn. It **does not display** whether the buyer's profile is published, live, or still a draft.

### 3. In Browse Investors, can sellers see, save and Connect with a buyer who isn't verified?
- **See:** **YES.** Any buyer with `buyer_profiles.status = 'live'` is listed in Browse Investors. The only difference is that an unverified buyer lacks the green `✓ Verified investor` badge.
- **Save (Star):** **YES.** Sellers can save any published investor profile (`saved_investors`).
- **Connect:** **YES.** A seller can spend a Connect request to invite an unverified buyer (`sendInvitation` in `invitations.functions.ts` only requires the profile to be in `loadPublicInvestors`).
- **The Breakdown:** When the invited buyer receives the invitation, clicks it, and attempts to **"Sign and request NDA"**, the platform blocks them with `"Verify your buyer profile first"`.

### 4. Which emails a buyer gets for each decision, and what each says about NDAs:
- **When Profile is Approved (`decideBuyerProfile`):**
  - Alert key: `approved`.
  - Body: *"Admin verified your account and published your investor profile. Sellers can now find your firm as {buyer code name} in Browse investors, and you can request NDAs."*
  - **Misleading wording:** The email currently tells the buyer they can request NDAs, even if their account verification has not actually been approved!
- **When Profile Changes are Requested:**
  - Alert key: `changes_requested`.
  - Body quotes the admin note.
- **When Verification is Approved (`decideBuyer`):**
  - Notification: *"You're a verified buyer — You can now request NDAs."*
- **When Verification Info is Requested (`decideBuyer`):**
  - Email alert `changes_requested`. Details list: `Needed: <admin note>`.

### 5. Control's Investor Profiles: How they're published and verified
- When Admin creates an investor profile directly via `/investors/new` (`createInvestor` in `investors.functions.ts`), it creates a record in `investors`.
- Trigger `zz_investor_verification_entry` automatically creates a row in `investor_profile_verifications` with `status = 'unverified'`.
- However, creating an investor in `/investors/new` **does not create a `buyer_profiles` row**.
- There are currently 13 directory-only investor profiles created by Admin (such as Beacon VC, SpaceF, Test1A) that have no `buyer_profiles` entry and therefore cannot be published to Browse Investors or sign NDAs.
- The only Control-owned buyer profile that is live is **Lakeshore Capital (INV-1001)**: Admin Dan Antakon linked his own user account, approved the profile on 3 Oct 2026, and verified the account on 28 Sep 2026.

---

## 5. Every Investor Profile Today

*Total: 12 investor profiles with buyer accounts in the database (Names only, no email addresses).*

| Ref | Profile Name | Owner (or Control) | Published? (Since, By Whom) | Verification (Status, Submitted, Decided, By Whom) | In Browse Investors? | Can Sign an NDA? |
|---|---|---|---|---|---|---|
| **INV-1001** | Lakeshore Capital | Control (Dan Antakon) | **Live** (since 3 Oct 2026, by Dan Antakon) | **Verified** (sub 28 Sep, dec 28 Sep 2026, by Dan Antakon) | **Yes** (with Verified badge) | **Yes** |
| **INV-1002** | test | User | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1003** | test | User | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1004** | jola | User | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1005** | — | User | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1007** | Rita Venture | Rita Lala | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1008** | PML VENTURES | NB SIRIPUN | **Live** (since 12 Oct 2026, by Dan Antakon) | **Unverified** (never submitted) | **Yes** (no badge) | **No** (Blocks: *"Verify your buyer profile first"*) |
| **INV-1009** | test | Dan A | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1010** | testete | test test | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1012** | Rita Test Capital | Rita Buyer | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1013** | — | Rita Land | **Draft** | **Unverified** (never submitted) | **No** | **No** |
| **INV-1015** | LINE MAN Wongnai | Thananan Suwanchai | **Live** (since 21 Oct 2026, by Dan Antakon) | **Unverified** (never submitted) | **Yes** (no badge) | **No** (Blocks: *"Verify your buyer profile first"*) |

*(In addition, 13 unlinked directory records exist in `investors` created by Admin with no buyer accounts: Beacon VC, SpaceF, Edit information check · 25 October, Test1A, Test2A, test1b, tes1C, test1D, TEst2E, Test6b, test7F, test10A, TESTTEST10. None of these can appear in Browse Investors or sign NDAs).*

---

## 6. Gaps You Can See

### 1. Screen vs. Server Disagreement on Direct Seller Invitations
- **The Issue:** A seller is permitted to browse, find PML VENTURES in Browse Investors, spend a Connect credit, and invite PML VENTURES to their listing. The buyer receives the invitation notification and an action button **"Sign and request NDA"**. The client UI does not disable this button. However, when clicked, the server throws an unhandled error toast: `"Verify your buyer profile first"`.
- **The Mismatch:** A seller can invite an unverified buyer, but the invited buyer cannot accept the invitation without prior identity verification.

### 2. Disconnected Approvals Queues
- Approving a profile to go live in Browse Investors (`decideBuyerProfile`) does not check whether the buyer has completed identity verification.
- As a result, Admin can approve a buyer profile, which publishes the card to sellers, while the buyer remains completely unable to interact with sellers who reach out to them.

### 3. Misleading Email Copy on Profile Approval
- When Admin approves a buyer profile under *Profiles to publish*, the email alert states:  
  *"Admin verified your account and published your investor profile... and you can request NDAs."*  
  This tells the buyer they are verified and can request NDAs, which is factually false if they haven't completed Buyer Verification.

### 4. Two Competing Verification Submission Paths
- **Path 1 (`/my-page`):** `BuyerVerificationCard` submits to `submitVerification` in `approvals.functions.ts` with 6 fields (company, type, reg, email, website, linkedin).
- **Path 2 (`/marketplace/my-company` Exclusive view footer):** Calls `submitMyBuyerForVerification` in `buyer-investor.functions.ts`, which auto-populates from the `investors` record and only checks whether ticket size is filled.
- Having two separate submission endpoints for the same underlying table (`investor_profile_verifications`) can lead to conflicting status or stale values.

### 5. Document Upload Column with No UI
- The database schema and the Admin review page both support `documents text[]`, but there is currently no file upload mechanism in `BuyerVerificationCard` for buyers to attach registration certificates or ID documents.

### 6. Legacy Table `buyer_verifications`
- The database contains a table named `buyer_verifications` that is completely empty and unused by the application. All verification records live in `investor_profile_verifications` and `user_verifications`.

---

## Questions for Admin / Product Decision

1. **Direct Seller Invitations:** When a seller explicitly invites a buyer via Connect (as happened with PS-1028 and PML VENTURES), should that direct seller invitation **exempt** the buyer from the pre-verification check, allowing them to sign the NDA immediately? Or must all invited buyers complete Buyer Verification before accepting any invitation?
2. **Unified Approval vs. Two-Step Approval:** Would you prefer to unify these two steps so that a buyer profile cannot be submitted or approved for publishing until identity verification is also completed? Or do you prefer keeping them as two separate steps (e.g. allowing anonymous browsing first, verification only when deals start)?
3. **Email Copy Alignment:** Should we update the profile approval email so it only states that the profile is live, without claiming that the buyer "can request NDAs" until their identity verification is actually approved?
