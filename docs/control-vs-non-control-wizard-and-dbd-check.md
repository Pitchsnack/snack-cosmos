# Control vs Non-Control: Setup Wizard and DBD Check (Seller, Buyer, Advisor)

**Document path:** `docs/control-vs-non-control-wizard-and-dbd-check.md`  
**Date:** November 18, 2026  
**Status:** Architecture audit (Read-only analysis)

---

## Executive Summary

1. **What opened the pop-up:** The blocking modal was opened by `AddCompanyCheck` (`src/components/setup/add-company-check.tsx`) triggered from `AddBusinessButton` (`src/components/my-business/add-business-button.tsx`) on Seller › My Company. It did not open from opening the draft or clicking "Continue setup".
2. **Current vs Designed check:** The designed background check with a top-bar "Verifying your company…" chip and Review-step "Is this your company?" dialog **does not exist in the codebase today**. Instead, the DBD check runs in the foreground as a blocking pre-check modal before any profile is created.
3. **Control vs Non-Control:** Control and non-Control share the **exact same setup wizard components and routes** for all three roles. The DBD check behavior, dialogs, and lookup limits are identical.
4. **Where Control differs:**
   - **Buyer:** Only Control/Admin can add multiple investor profiles (`+ Add Investor Profile`). Non-Control buyers are locked to exactly one profile.
   - **Seller Save:** `saveSellerSetup` writes listing name to `code_name` if Control, but `suggested_listing_name` if non-Control.
   - **Advisor:** Control bypasses the `advisor_view` entitlement check and has safeguards preventing marking someone else's firm as setup-complete.
5. **Key Risk:** Drafts created before November 16 (such as the "test" draft) have `reg_locked_at: NULL`. Because the DBD check only exists in the pre-creation dialog (`+ Add` and Sign-up), continuing setup or editing those existing drafts **never triggers a DBD check**.

---

## 1. What Opened That Pop-up

### The Source
- **Component:** `<AddCompanyCheck kind="seller" ... />` in `src/components/setup/add-company-check.tsx`.
- **Dialogs displayed:**
  - `VerifyingDialog` (step `ver`): Spinner, text `"Verifying 0575569006490…"`, and a `"Cancel"` button (`src/components/login/signup-reg-parts.tsx:54`).
  - `FoundDialog` (step `found`): Title `"Is this your company?"` (`"ยืนยันข้อมูลบริษัท"`), company details table, `"No, this isn't my company"` button, and `"Yes, this is my company"` button (`src/components/login/signup-reg-parts.tsx:93`).

### The Trigger
- **The exact action:** The user clicked the **"+ Add My Business"** button (`AddBusinessButton` in `src/components/my-business/add-business-button.tsx`).
- **Database evidence:** A verified record exists in `registration_attempts`:
  - `id`: `8d21c85d-4de0-410d-ac45-0b12dd7f59a9`
  - `user_id`: `d4e90f3f-9630-4af7-833b-6c15a1670b27` (Dan)
  - `source`: `"add"`
  - `profile_kind`: `"seller"`
  - `reg_no`: `"0575569006490"`
  - `company_name`: `"บริษัท เฟอร์นิเจอร์นางฟ้า จำกัด"`
  - `result`: `"no"`
  - `created_at`: `2026-11-17 12:56:04 UTC`
- **Why it appeared over the "test" draft:** In `src/routes/_authenticated/my-startups.index.tsx`, `<AddBusinessButton />` is rendered in the top header and filter bar. When clicked, it does not navigate away; instead, it mounts `<AddCompanyCheck>` as a modal dialog directly over whatever is currently displayed on `/my-startups` (which was the "test" draft panel).
- **What did NOT trigger it:** Opening My Company, viewing the card, opening the draft, clicking "Continue setup", or the registration lock (`reg_locked_at`) did not open the pop-up. `DraftCompanyPanel`'s `onFinish` button (`my-business-profiles.tsx:502`) navigates directly to `/my-startups/setup/$id` without opening any dialog.

### Designed vs Implemented Reality
- **What was designed:** The check was conceptualized to run asynchronously in the background while the user fills in wizard steps, displaying a "Verifying your company…" chip in the top bar, with "Is this your company?" appearing when the user reaches the Review step.
- **What is implemented today:** Commit `c74d81c2` (Nov 16, 2026) introduced `AddCompanyCheck` as a **synchronous gate before draft creation**. No profile row is created until the user answers "Yes". The wizard itself has **no DBD check running in the background** and no verification chip in its top bar.

### Non-Control Comparison
- Does the same happen for non-Control? **Yes, identically.**
- When a non-Control seller clicks `+ Add My Business`, they execute the exact same `AddBusinessButton` and see the exact same blocking `AddCompanyCheck` modal.

---

## 2. The Ways Into the Wizard, Per Role

### Seller Wizard (`/my-startups/setup/$id`)
- **Route:** `/_authenticated/my-startups/setup/$id` (`src/routes/_authenticated/my-startups.setup.$id.tsx`)
- **Component:** `SellerWizard` in `src/components/startups/seller-wizard.tsx`

| Way In | Trigger / Location | Component & File | Control vs Non-Control |
| :--- | :--- | :--- | :--- |
| **Sign-up** | After registration and email confirmation, welcome banner on `/my-startups` | `SignupWelcome` (`src/components/my-business/signup-welcome.tsx`) | **Same.** Navigates to `/my-startups/setup/$id`. |
| **+ Add My Business** | Header / filter bar button on `/my-startups` | `AddBusinessButton` (`src/components/my-business/add-business-button.tsx`) | **Same.** Both open `AddCompanyCheck`. Profile created and wizard opened only on "Yes". |
| **Continue setup** | Banner / button on draft card on `/my-startups` | `DraftCompanyPanel` via `MyBusinessProfiles` (`src/components/my-business/my-business-profiles.tsx:502`) | **Same.** Navigates directly to `/my-startups/setup/$id`. |
| **Welcome Tour** | "Continue setup" / "Start setup" in tour banner | `WelcomeTour` (`src/components/welcome-tour/welcome-tour.tsx:483`) | **Same.** Navigates to `/my-startups/setup/$id`. |
| **Edit Information** | Edit information modal (`?edit=startup`) | `EditInfoPopup` (`src/components/common/edit-info-popup.tsx`) | **Does not open wizard.** Edits profile in-place via tabs; has no links to wizard. |

*Control with tenant and Control with View as:* Uses the exact same component and route. In "View as", `viewAsRole = "seller"` renders `/my-startups`, and all buttons follow the identical code paths.

---

### Buyer Wizard (`/buyer/company/$id/setup`)
- **Route:** `/buyer/company/$id/setup` (`src/routes/buyer.company.$id.setup.tsx`)
- **Component:** `BuyerSetupWizard` in `src/components/my-business/buyer-setup-wizard.tsx`

| Way In | Trigger / Location | Component & File | Control vs Non-Control |
| :--- | :--- | :--- | :--- |
| **Sign-up** | After registration, welcome banner on Buyer My Company | `SignupWelcome` (`src/components/my-business/signup-welcome.tsx`) | **Same.** Navigates to `/buyer/company/$id/setup`. |
| **+ Add Investor Profile** | Header button on Buyer My Company | `AddInvestorProfileButton` / `useAddInvestorProfile` (`src/components/my-business/admin-investor-profiles.tsx`) | **Different.** Only Admin/Control sees this button. Non-Control buyers have a 1-profile limit and cannot add profiles. |
| **Start / Continue setup** | Setup banner on Buyer My Company | `SetupBanner` (`src/components/my-business/buyer-my-company.tsx:620`) | **Same.** Navigates to `/buyer/company/$id/setup`. |
| **Admin Extra Profiles** | Draft cards rendered by `AdminInvestorProfiles` | `AdminInvestorProfiles` (`src/components/my-business/admin-investor-profiles.tsx`) | **Control only.** Extra profiles created by Admin can each be opened into the wizard. |

---

### Advisor Wizard (`/advisor/company/$id/setup`)
- **Route:** `/advisor/company/$id/setup` (`src/routes/advisor.company.$id.setup.tsx`)
- **Component:** `AdvisorSetupWizard` in `src/components/advisor/advisor-setup-wizard.tsx`

| Way In | Trigger / Location | Component & File | Control vs Non-Control |
| :--- | :--- | :--- | :--- |
| **Sign-up** | After registration, welcome banner on Advisor My Company | `SignupWelcome` (`src/components/my-business/signup-welcome.tsx`) | **Same.** Navigates to `/advisor/company/$id/setup`. |
| **+ Add Firm Profile** | Header button on Advisor My Company | `useAddFirm` (`src/components/advisor/advisor-my-company.tsx:96`) | **Same.** Both open `AddCompanyCheck kind="advisor"`. Firm created and wizard opened on "Yes". |
| **Continue setup →** | Setup banner on Advisor My Company | `advisor-my-company.tsx:618` | **Same.** Navigates to `/advisor/company/$id/setup`. |
| **Review & complete** | Inside `AdvisorSetupWizard`, button on final question or completed wizard | `AdvisorReviewPage` (`src/components/advisor/advisor-review-page.tsx`) / `FirmEditForm` | **Same.** This is step `review` inside the wizard route, not a separate page. |

---

## 3. The DBD Check, Per Role

### When It Starts
- **Inside the wizard:** The DBD check **never starts inside the wizard** on any step for any role.
- **Where it actually starts:**
  - **Sign-up:** In `SignupReg` (`src/routes/signup.tsx`), after email verification.
  - **+ Add:** In `AddCompanyCheck` (`src/components/setup/add-company-check.tsx`), immediately when the user inputs a name and 13-digit number and clicks "Continue" -> "Confirm".

### Background or Foreground
- **Foreground blocking modal:** The check runs in `VerifyingDialog` (`src/components/login/signup-reg-parts.tsx:54`) with a full-screen modal overlay, spinner, text `"Verifying {number}…"`, and a `"Cancel"` button.
- **Background check:** There is no background DBD check or top-bar chip anywhere in the app.

### The Pop-ups
- **Components:** `VerifyingDialog` and `FoundDialog` (`src/components/login/signup-reg-parts.tsx`).
- **Where they open:**
  - At `/signup` during onboarding.
  - As a modal over My Company when clicking `+ Add`.
  - They **never open at Review**.

### Yes, No, and Not Found
- **Yes:**
  - In `AddCompanyCheck`: Calls role creation function (`addDraftBusiness`, `addInvestorProfile`, or `createAdvisorDraft`), then calls `applyAddCheck` (`src/lib/add-company-check.functions.ts`).
  - `applyAddCheck` writes DBD-verified facts (Thai name, year founded, English/Thai split address) into the profile, sets `reg_locked_at = now()`, marks the attempt as `"yes"` in `registration_attempts`, and navigates to the wizard.
- **No:**
  - Calls `answerAddCheck(attemptId, "no")` (`src/lib/add-company-check.functions.ts:51`).
  - Returns user to step `q` with an amber warning: `"You told us this isn't your company."`
  - Allows **up to 2 changes** (3 numbers tried total).
  - When 2 changes are used, `blocked = true`, Continue button disables, and displays: `"You've used both changes. Please contact the PitchSnack team."`
- **Not Found:**
  - Displays `NotFoundDialog`.
  - User can click "Check the number and try again" (counts as 1 change) or "Contact PitchSnack" (submits a manual setup enquiry via `sendAddSetupRequest`).

### Storing
- **Sign-up:** Raw DBD payload is stored in `dbd_company_records` via `dbd_store_save_signup` (`src/lib/signup-reg.functions.ts:313`).
- **+ Add:** Facts are written directly to `startups`, `investors`, or `advisor_firms`, and the attempt is logged in `registration_attempts`. **It is NOT stored in `dbd_company_records`.**
- **Inside the wizard:** The wizard never calls `dbd_store_save`. Only user answers and website enrichment are saved to the profile table.

### Limits
- **Sign-up:** 3 attempts per signup session/email, 5 checks per device/IP per 24 hours (`signup_reg_checks`).
- **+ Add:** 1 initial number + 2 changes (3 numbers max) per session key in `registration_attempts`.
- **Does Control count against limits?** **YES.** `runAddCheck` does not check for Control or Admin roles. Control users have the exact same 3-attempt limit.

### Anywhere Else a DBD Check Runs
1. **Sign-up page** (`/signup`): `SignupReg` -> `lookupCheck`.
2. **Admin DBD Store** (`/admin/financials/dbd-store`): `lookupDbdFinancials` -> `dbd_store_save` (`src/lib/dbd-store.functions.ts:62`).
3. **Financials "+ Add financials"** (`src/lib/financials-edit.functions.ts:125`): Extracts financial statements from DBD.
4. **Admin Advisor Verification** (`src/lib/advisor-admin.functions.ts:249`): Verifies firm registration against DBD.
5. **Admin Registration Number Change** (`src/lib/reg-admin.functions.ts:79`): Validates replacement registration number.

---

## 4. Copies and Branches

### Separate Copies
- **Wizards:** **Zero** Control-only copies. `SellerWizard`, `BuyerSetupWizard`, and `AdvisorSetupWizard` are single shared components.
- **Dialogs & Checks:** **Zero** Control-only copies. `AddCompanyCheck`, `VerifyingDialog`, `FoundDialog`, and `runAddCheck` are single shared implementations.

### Control Branches
| File | Function | Condition | What It Changes |
| :--- | :--- | :--- | :--- |
| `src/lib/seller-setup.functions.ts:133` | `saveSellerSetup` | `is_control` | Writes listing name to `code_name` if Control; writes to `suggested_listing_name` if non-Control. |
| `src/lib/seller-setup.functions.ts:20` | `getSellerIdentityReadiness` | `is_control` | Determines whether the seller identity tour is shown. |
| `src/lib/seller-setup.functions.ts:384` | `addDraftBusiness` | `tenantId === CONTROL` | Resolves primary workspace if tenant is omitted or Control. |
| `src/lib/buyer-investor.functions.ts:88` | `resolveBuyer` | `role === "admin" && can_manage_investor` | Allows Admin to edit any Directory investor profile; blocks non-Control from editing other profiles. |
| `src/lib/advisor-firm.functions.ts:20` | `requireAdvisor` | `is_control` | Bypasses `users.advisor_view` check for Control users. |
| `src/lib/advisor-firm.functions.ts:279` | `saveAdvisorFirm` | `is_control` | Protects `setup_done_at` when Control edits someone else's firm; keeps `verified_snapshot` in sync with Admin edits. |

### Steps and Step Order
- **Seller Steps:** Role -> Name & Reg -> Founded & Size -> Sector -> Licences -> Website -> Address -> Listing Questions -> Review. (**100% identical** for Control and non-Control).
- **Buyer Steps:** Role -> Classification -> Details (Name, Country, Reg, Founded, Size, Web) -> Address -> Mandate -> Team -> About -> Review. (**100% identical** for Control and non-Control).
- **Advisor Steps:** Firm Type -> Details (Name, Country, Reg, Founded, Address, Web) -> Services & Fees -> Deal Size & Team -> Sectors -> Contact Person -> Logo & Description -> Review. (**100% identical** for Control and non-Control).

---

## 5. Differences (Summary Tables)

### Seller

| What | Non-Control | Control | Same or Different | File |
| :--- | :--- | :--- | :--- | :--- |
| **Ways in** | Sign-up, + Add My Business, Continue setup, Welcome Tour | Identical ways in | **Same** | `my-startups.index.tsx` |
| **Wizard component** | `SellerWizard` | `SellerWizard` | **Same** | `seller-wizard.tsx` |
| **Steps & order** | 9 steps | 9 steps | **Same** | `seller-wizard.ts` |
| **When DBD check starts** | In `+ Add` modal or Sign-up | In `+ Add` modal or Sign-up | **Same** | `add-company-check.tsx` |
| **Background or pop-up** | Blocking pop-up modal | Blocking pop-up modal | **Same** | `signup-reg-parts.tsx` |
| **"Is this your company?"** | In `AddCompanyCheck` modal | In `AddCompanyCheck` modal | **Same** | `signup-reg-parts.tsx` |
| **Yes / No / Not found** | Yes creates draft; No allows 2 changes | Identical behavior | **Same** | `add-company-check.functions.ts` |
| **Storing** | Profile table + `registration_attempts` | Identical | **Same** | `add-company-check.functions.ts` |
| **Limits** | 3 numbers per session | 3 numbers per session (no bypass) | **Same** | `add-company-check.functions.ts` |
| **Identity Lock** | Locks year, name, reg once confirmed | Identical | **Same** | `identity-lock.tsx` |
| **Saves** | Updates `suggested_listing_name` | Updates `code_name` | **Different** | `seller-setup.functions.ts:135` |

---

### Buyer

| What | Non-Control | Control | Same or Different | File |
| :--- | :--- | :--- | :--- | :--- |
| **Ways in** | Sign-up, Start/Continue setup | Sign-up, + Add Investor Profile, Continue setup | **Different** | `buyer-my-company.tsx`, `admin-investor-profiles.tsx` |
| **Wizard component** | `BuyerSetupWizard` | `BuyerSetupWizard` | **Same** | `buyer-setup-wizard.tsx` |
| **Steps & order** | 8 steps | 8 steps | **Same** | `buyer-wizard.ts` |
| **When DBD check starts** | In `+ Add` modal or Sign-up | In `+ Add` modal or Sign-up | **Same** | `add-company-check.tsx` |
| **Background or pop-up** | Blocking pop-up modal | Blocking pop-up modal | **Same** | `signup-reg-parts.tsx` |
| **"Is this your company?"** | In `AddCompanyCheck` modal | In `AddCompanyCheck` modal | **Same** | `signup-reg-parts.tsx` |
| **Yes / No / Not found** | Yes creates profile; No allows 2 changes | Identical behavior | **Same** | `add-company-check.functions.ts` |
| **Storing** | Profile table + `registration_attempts` | Identical | **Same** | `add-company-check.functions.ts` |
| **Limits** | 3 numbers per session | 3 numbers per session (no bypass) | **Same** | `add-company-check.functions.ts` |
| **Identity Lock** | Locks year, name, reg once confirmed | Identical | **Same** | `identity-lock.tsx` |
| **Saves** | Saves to linked profile | Can save to extra / directory profiles | **Different (Auth)** | `buyer-investor.functions.ts:91` |

---

### Advisor

| What | Non-Control | Control | Same or Different | File |
| :--- | :--- | :--- | :--- | :--- |
| **Ways in** | Sign-up, + Add Firm Profile, Continue setup | Identical ways in | **Same** | `advisor-my-company.tsx` |
| **Wizard component** | `AdvisorSetupWizard` | `AdvisorSetupWizard` | **Same** | `advisor-setup-wizard.tsx` |
| **Steps & order** | 8 steps | 8 steps | **Same** | `advisor-firm.ts` |
| **When DBD check starts** | In `+ Add` modal or Sign-up | In `+ Add` modal or Sign-up | **Same** | `add-company-check.tsx` |
| **Background or pop-up** | Blocking pop-up modal | Blocking pop-up modal | **Same** | `signup-reg-parts.tsx` |
| **"Is this your company?"** | In `AddCompanyCheck` modal | In `AddCompanyCheck` modal | **Same** | `signup-reg-parts.tsx` |
| **Yes / No / Not found** | Yes creates firm; No allows 2 changes | Identical behavior | **Same** | `add-company-check.functions.ts` |
| **Storing** | Profile table + `registration_attempts` | Identical | **Same** | `add-company-check.functions.ts` |
| **Limits** | 3 numbers per session | 3 numbers per session (no bypass) | **Same** | `add-company-check.functions.ts` |
| **Identity Lock** | Locks year, name, reg once confirmed | Identical | **Same** | `identity-lock.tsx` |
| **Saves** | Marks own firm setup complete | Cannot complete other owners' firms | **Different (Guard)** | `advisor-firm.functions.ts:278` |

---

## 6. Inconsistencies and Architectural Risks

1. **Design vs Implementation Mismatch:**
   - The team expected the DBD check to run in the background during the wizard with a top-bar status chip and confirmation modal at the Review step.
   - The actual implementation in commit `c74d81c2` is a synchronous modal pre-check (`AddCompanyCheck`) that runs before the wizard route is ever entered.
2. **Older Drafts are Permanently Unchecked:**
   - Any draft created prior to commit `c74d81c2` (such as the "test" draft Dan was looking at) has `reg_locked_at: NULL`.
   - Because `AddCompanyCheck` only executes upon clicking `+ Add`, opening or continuing setup on an existing draft **never runs a DBD check**. The user can edit the registration number freely unless someone manually runs a check.
3. **Storage Asymmetry:**
   - At Sign-up, verified DBD data is saved to `dbd_company_records` via `dbd_store_save_signup`.
   - At `+ Add`, verified data is written to the profile table and `registration_attempts`, but **never stored in `dbd_company_records`**.
4. **Control Lookup Limits:**
   - Control admins testing `+ Add` with incorrect test numbers burn through the 3-attempt limit because `runAddCheck` does not grant Admin exemption.
5. **Listing Name Split:**
   - In `saveSellerSetup`, saving as Control writes to `code_name`, while saving as non-Control writes to `suggested_listing_name`. If a Control user sets up a company via View as or tenant mode, it bypasses the review suggestion field and writes directly to the published listing code name.
