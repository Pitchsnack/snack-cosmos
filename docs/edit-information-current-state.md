# Profile Editing Current State Report

This report documents the current architecture, entry points, forms, schemas, data persistence, shared/duplicated code, dead/legacy paths, and previous implementation history for profile editing across **Seller**, **Buyer**, **Advisor/Partner**, **Control**, and **Admin** roles in PitchSnack.

---

## 1. Every Way Into Editing a Profile

| Role / Flow | Route URL | How the user gets there | Component rendered | What it loads | Presentation type | Redirects / Forwarding |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Seller (My Business)** | `/my-startups` (with query `?edit=startup` or `?edit=startup&section=<id>`) | "Edit information" button, pencil icon, or section "Edit" / "+ Add" link in My Business (`my-business-profiles.tsx`) | `SellerEditPopup` (`seller-edit-popup.tsx`) embedding `StartupForm` | `getStartup({ id })`, `getHiddenProfile({ startupId })`, `listAssignableTenants` | **Pop-up over greyed page** (`EditInfoPopup` via Radix Dialog with dirty check blocker) | Opens as pop-up on `/my-startups`. Closing removes query parameter via `leaveEditUrl`. |
| **Seller (Direct Edit Route)** | `/my-startups/$id/edit` | Direct URL, bookmark, or fallback link | Route component `my-startups.$id.edit.tsx` | Route loader / TanStack Router | None (transitional) | **Immediate forward**: When `returnTo !== "valuation"`, it calls `navigate({ to: "/my-startups", search: { open: id, edit: "startup", section } })`. Only renders full-page form when `returnTo === "valuation"`. |
| **Seller (Admin Edit in Directory)** | `/startups/$id/edit` | Admin navigates to Startups Directory (`/startups`), clicks a startup row or menu action, then clicks "Edit" | Route component `startups.$id.edit.tsx` embedding `StartupForm` | `getStartup({ id })`, `getHiddenProfile({ startupId })`, `listAssignableTenants` | **Full page** (max-w-4xl container with back link to `/startups/$id`). **NOT a pop-up**. | None. Stays on full page. |
| **Seller (Admin Create)** | `/startups/new` | Admin clicks "+ New startup" button in `/startups` | Route component `startups.new.tsx` embedding `StartupForm` (create mode) | `listAssignableTenants` | **Full page**. | On success, redirects to `/startups/$id`. |
| **Seller (Setup Wizard)** | `/my-startups/setup/$id` | Newly registered seller or seller clicking "Continue setup" from banner | `my-startups.setup.$id.tsx` embedding `SellerWizard` | `getSellerSetup({ id })` | **Full page multi-step wizard** (progress bar, 1 question per screen, Review step, auto-fill). | On completion, redirects to `/my-startups/$id/edit` (which redirects to `/my-startups?edit=startup`). |
| **Buyer (My Company)** | `/marketplace/my-company` (with query `?edit=profile` or `?edit=profile&section=<id>`) | "Edit profile" button, pencil icon, or section "Edit" / "+ Add" link in Buyer My Company (`marketplace.my-company.index.tsx`) | `ProfileEditPopup` (`profile-edit-popup.tsx`) embedding `BuyerInvestorEdit` (`BuyerInvestorForm`) | `getBuyerProfile()`, `buyerInvestorKey` | **Pop-up over greyed page** (`EditInfoPopup` with Radix Dialog and dirty guard) | Opens as pop-up on `/marketplace/my-company`. Closing strips `?edit=`. |
| **Buyer (Direct Edit Route)** | `/marketplace/my-company/edit` | Direct URL or bookmark | Route component `marketplace.my-company.edit.tsx` | Route loader | None (transitional) | **Immediate forward**: Checks role. If buyer, navigates to `/marketplace/my-company?edit=profile`. If advisor, navigates to `/marketplace/my-company?edit=firm`. |
| **Buyer (Admin Edit in Directory)** | `/investors/$id/edit` | Admin navigates to Investors Directory (`/investors`), clicks row, clicks "Edit" | Route component `investors.$id.edit.tsx` embedding `InvestorForm` | `getInvestor({ id })` | **Full page** (max-w-4xl container with back link to `/investors/$id`). **NOT a pop-up**. | None. Stays on full page. |
| **Buyer (Admin Create)** | `/investors/new` | Admin clicks "+ Add Investor" in `/investors` | Route component `investors.new.tsx` embedding `InvestorForm` | `listAssignableTenants` | **Full page**. | On success, redirects to `/investors/$id`. |
| **Buyer (Setup Wizard)** | `/buyer/company/$id/setup` | New buyer sign-up or incomplete buyer profile banner | `buyer.company.$id.setup.tsx` embedding `BuyerSetupWizard` | `getBuyerProfile()` | **Full page multi-step wizard**. Last step is "Review & complete" which embeds `BuyerInvestorForm`. | On completion, navigates to `/marketplace/my-company`. |
| **Advisor / Partner (My Company)** | `/marketplace/my-company` (with query `?edit=firm` or `?edit=firm&section=<id>`) | "Edit profile" button or section "+ Add" / "Edit" link in Advisor My Company | `ProfileEditPopup` (`profile-edit-popup.tsx`) embedding `FirmEditForm` (`advisor-firm-edit.tsx`) | `getAdvisorFirm()`, `ADVISOR_FIRMS_KEY` | **Pop-up over greyed page** (`EditInfoPopup` with Radix Dialog and dirty guard) | Opens as pop-up on `/marketplace/my-company`. Closing strips `?edit=`. |
| **Advisor (Admin Edit in Directory)** | `/marketplace/advisors` (Advisors Directory) | Admin navigates to Advisors Directory, clicks row, clicks "Edit" | `src/components/advisor/advisors-directory.tsx` renders `EditDialog` | Cached or fetched `AdvisorFirm` record | **Radix Dialog modal** (custom `DialogContent max-w-4xl`), embeds `FirmEditForm`. | Dialog closes in place; does NOT use `EditInfoPopup`. |
| **Advisor (Setup Wizard)** | `/advisor/company/$id/setup` | New advisor sign-up or incomplete advisor profile banner | `advisor.company.$id.setup.tsx` embedding `AdvisorSetupWizard` | `getAdvisorFirm()` | **Full page multi-step wizard**. Last step renders `FirmEditForm` in setup mode. | On finish, navigates to `/marketplace/my-company`. |
| **Control / Admin Tenant Switch** | Any authenticated page | Admin switches active workspace or accesses Control tenant | Global state `sessionContext`, `WorkspaceScope` | Tenant profiles / memberships | Changes context across all routes. | None. |

---

## 2. Each Form, Field by Field

### 2.1 Seller Form (`StartupForm` & `PublicViewFields`)
Rendered by `src/components/startups/startup-form.tsx` and `src/components/hidden-profile/public-view-fields.tsx`. Contains two main views: **Public view** (marketplace listing) and **Private view** (company facts unlocked under approved NDA).

| Tab / Section | Field Label | Saved Table & Column | Type & Validation Checks | Who Sees It | Auto Enrich? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Public: Identity** | Ref No | `startups.ref_no` | Auto-generated string (e.g. `PS-1028`), readonly | Public (all) | No |
| **Public: Identity** | Listing Name (Anonymous Code Name) | `startups.code_name` | Max 100 chars, Admin-only editable | Public (all) | No |
| **Public: Identity** | Sector (Primary Industry) | `startups.sector`, `hidden_profiles.sector` | Single select (`SECTORS` list), required | Public (all) | Yes (DBD / Web) |
| **Public: Identity** | Cover Image (Pick) | `hidden_profiles.picked_image_path` | Storage path or preset ID, optional | Public (all) | No |
| **Public: Identity** | Business Model | `startups.business_model` | String / select (`B2B`, `B2C`, `B2B2C`, etc.) | Public (all) | Yes |
| **Public: Listing Details** | Headline | `hidden_profiles.headline` | Max 120 chars, text | Public (all) | Yes (suggested) |
| **Public: Listing Details** | Confidential Summary (Description) | `hidden_profiles.confidential_summary` | Max 3000 chars, textarea | Public (all) | Yes (website AI) |
| **Public: Listing Details** | Highlights (Bulleted) | `hidden_profiles.highlights` | Array of strings (up to 5 bullets) | Public (all) | Yes |
| **Public: Listing Details** | Customer Profile (no names) | `hidden_profiles.customers_summary` | Textarea, optional | Public (all) | Yes |
| **Public: Deal Terms** | Deal Type | `hidden_profiles.deal_type` | Single select (`Full acquisition`, `Majority stake`, etc.) | Public (all) | No |
| **Public: Deal Terms** | Asking Price (THB) | `hidden_profiles.asking_price_thb` | Numeric (THB), stored exact, masked to band before NDA | Public: Band; Post-NDA: Exact | No |
| **Public: Deal Terms** | Management Transition Period | `hidden_profiles.transition_period_months` | Number (months) | Public (all) | No |
| **Public: Deal Terms** | Founder Stays Post-Sale? | `hidden_profiles.founder_retention` | Boolean / select | Public (all) | No |
| **Private: About** | Company Legal Name | `startups.startup_name`, `startups.registered_name` | Max 100 chars, required | Private (Post-NDA + Admin) | Yes (DBD sync) |
| **Private: About** | Thai Legal Name | `startups.registered_name_th` | Max 200 chars, optional | Private (Post-NDA + Admin) | Yes (DBD sync) |
| **Private: About** | Registration Number | `startups.registered_number` | 13-digit DBD number (checked with regex) | Private (Post-NDA + Admin) | Yes (DBD sync) |
| **Private: About** | Year Founded | `startups.year_founded` | Numeric (1800 - current year) | Private (Post-NDA + Admin) | Yes (DBD sync) |
| **Private: About** | Company Type | `startups.company_type` | Enum: `SME`, `Corporate Enterprise`, `Individual` | Private (Post-NDA + Admin) | Derived / Locked |
| **Private: About** | Registered Address Line 1 | `startups.address_line1` | Text, max 200 chars | Private (Post-NDA + Admin) | Yes (DBD) |
| **Private: About** | Registered Address Line 2 | `startups.address_line2` | Text, max 200 chars | Private (Post-NDA + Admin) | Yes (DBD) |
| **Private: About** | Subdistrict (Tambon) | `startups.address_subdistrict` | Text (Thailand only) | Private (Post-NDA + Admin) | Yes (DBD) |
| **Private: About** | District (Amphoe) | `startups.address_city_district` | Text (Thailand only) | Private (Post-NDA + Admin) | Yes (DBD) |
| **Private: About** | Province (Changwat) | `startups.address_province_state` | Text / select from 77 provinces | Private (Post-NDA + Admin) | Yes (DBD) |
| **Private: About** | Postal Code | `startups.address_postal_code` | 5 digits | Private (Post-NDA + Admin) | Yes (DBD) |
| **Private: About** | Website URL | `startups.website_url` | Valid URL, duplicate checked | Private (Post-NDA + Admin) | User input |
| **Private: About** | Founders / Key Officers | `startup_founders` table | Name, Title, Shareholding % | Private (Post-NDA + Admin) | Yes (DBD list) |
| **Private: Images** | Company Logo | `startups.logo_path`, `startups.media_assets` | Storage path (`startup-media` bucket) | Private (Post-NDA + Admin) | Yes (auto-scrape) |
| **Private: Images** | Office / Factory Photos | `startups.media_assets` | Array of up to 5 image paths | Private (Post-NDA + Admin) | Yes (auto-scrape) |
| **Private: Market** | Target Industries | `startups.target_industries` | Array of strings | Private (Post-NDA + Admin) | Yes |
| **Private: Market** | Competitors / Market Tags | `startups.market_tags` | Array of strings | Private (Post-NDA + Admin) | Yes |
| **Private: Licenses** | Regulatory Licenses | `startups.regulatory_licenses` | Text / array of strings | Private (Post-NDA + Admin) | User input |
| **Private: Licenses** | ISO & Quality Certifications | `startups.certifications` | Text / array of strings | Private (Post-NDA + Admin) | User input |
| **Admin Only: Internal** | Owning Tenant | `startups.tenant_id` | UUID, required | Admin / Control | No |
| **Admin Only: Internal** | Owning Agent User | `startups.owning_agent_user_id` | UUID, optional | Admin / Control | No |
| **Admin Only: Internal** | Listing Status | `startups.status` | `draft`, `submitted`, `approved`, etc. | Admin / Control | No |
| **Admin Only: Internal** | Visibility | `startups.visibility` | `public`, `stealth`, `unlisted` | Admin / Control | No |

---

### 2.2 Buyer Form (`BuyerInvestorEdit` & `InvestorForm`)
Rendered by `src/components/my-business/buyer-investor-edit.tsx` (for buyers in My Company) and `src/components/investors/investor-form.tsx` (for Admin in `/investors`).

| Tab / Section | Field Label | Saved Table & Column | Type & Validation Checks | Who Sees It | Auto Enrich? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Public: Identity** | Investor Ref No | `investors.ref_no` | System generated (e.g. `INV-1001`), readonly | Public (all) | No |
| **Public: Identity** | Public Name / Classification | `investors.investor_name` (or anonymized code name) | String, max 100 chars | Public before NDA | No |
| **Public: Identity** | Buyer Type (Relation) | `buyer_profiles.buyer_relation`, `investors.investor_type` | `Corporate`, `Private Equity`, `Family Office`, `Individual / Angel`, `Search Fund` | Public (all) | No |
| **Public: Criteria** | Target Industries | `buyer_profiles.preferred_industries`, `investors.sectors` | Up to 5 sectors or "Sector Agnostic" | Public (all) | No |
| **Public: Criteria** | Target Revenue Range | `buyer_profiles.min_revenue_thb`, `max_revenue_thb` | Numeric band (THB) | Public (all) | No |
| **Public: Criteria** | Target Deal Size Range | `investors.ticket_size_min`, `ticket_size_max` | Numeric band (THB) | Public (all) | No |
| **Public: Criteria** | Target Geographies | `investors.target_geographies` | Array of provinces or country | Public (all) | No |
| **Public: Profile** | Investment Philosophy & Mandate | `buyer_profiles.mandate_summary`, `investors.description` | Textarea, max 2000 chars | Public (all) | No |
| **Private: Corporate** | Company / Organization Legal Name | `buyer_profiles.company_name`, `investors.legal_name` | Max 120 chars, required | Private (Seller under NDA + Admin) | Yes (DBD) |
| **Private: Corporate** | Registration Number | `buyer_profiles.registration_number`, `investors.registration_number` | 13-digit DBD number | Private (Seller under NDA + Admin) | Yes (DBD) |
| **Private: Corporate** | Website URL | `buyer_profiles.website`, `investors.website_url` | Valid URL | Private (Seller under NDA + Admin) | No |
| **Private: Corporate** | Year Founded | `investors.year_founded` | Numeric (1800 - current year) | Private (Seller under NDA + Admin) | Yes (DBD) |
| **Private: Corporate** | Registered Address | `investors.address_line1`, `district`, `province`, `postal_code` | Street, subdistrict, district, province, postal code | Private (Seller under NDA + Admin) | Yes (DBD) |
| **Private: Contact** | Contact Person Full Name | `buyer_profiles.contact_name`, `investors.contact_name` | Max 100 chars, required | Private (Seller under NDA + Admin) | No |
| **Private: Contact** | Business Email | `buyer_profiles.contact_email`, `investors.contact_email` | Valid email format, required | Private (Seller under NDA + Admin) | No |
| **Private: Contact** | Phone Number | `buyer_profiles.contact_phone`, `investors.contact_phone` | Valid phone format | Private (Seller under NDA + Admin) | No |
| **Private: Contact** | LinkedIn Profile | `investors.linkedin_url` | Valid LinkedIn URL | Private (Seller under NDA + Admin) | No |
| **Admin Only** | Verification Status | `buyer_profiles.approval_status`, `investor_profile_verifications` | `pending`, `approved`, `rejected` | Admin / Control | No |
| **Admin Only** | Internal Notes | `investors.notes` | Textarea | Admin only | No |

---

### 2.3 Partner / Advisor Form (`AdvisorFirmEdit`)
Rendered by `src/components/advisor/advisor-firm-edit.tsx`.

| Section | Field Label | Saved Table & Column | Type & Validation Checks | Who Sees It | Auto Enrich? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Firm** | Firm Name | `advisor_firms.firm_name` | Max 80 chars, required | Public (all) | Yes (Web) |
| **Firm** | Firm Type | `advisor_firms.firm_type` | `M&A Advisory`, `Investment Banking`, `Law Firm`, `Accounting / Audit`, `Consulting`, `Broker` | Public (all) | No |
| **Firm** | Country & City / Province | `advisor_firms.country`, `city` | Country select; Thai province or global city | Public (all) | No |
| **Firm** | Year Founded | `advisor_firms.year_founded` | Numeric (1800 - current year), required | Public (all) | Yes (Web) |
| **Firm** | Team Size | `advisor_firms.team_size` | Positive integer, required | Public (all) | No |
| **Firm** | Logo & Office Photos | `advisor_firms.logo_path`, `media` | Storage paths (`startup-media` bucket) | Public (all) | Yes (Web) |
| **Firm** | Firm Description | `advisor_firms.description` | Textarea, min 50 chars, max 2500 chars | Public (all) | Yes (AI) |
| **Services & Fees** | Services Offered | `advisor_firms.services` | Array of service keys (e.g. `sell_side`, `buy_side`, `valuation`, `due_diligence`) | Public (all) | No |
| **Services & Fees** | Fee Structure per Service | `advisor_fees` table (`fee_type`, `amount`, `percentage`, `note`) | Structured fee object, formatted string generated on save | Public (all) | No |
| **Work & Criteria** | Typical Deal Size Band | `advisor_firms.deal_size_band` | Deal band key (maps to THB values in `display-rates.json`) | Public (all) | No |
| **Work & Criteria** | Target Sectors | `advisor_firms.sectors`, `sector_agnostic` | Array of sectors or boolean agnostic flag | Public (all) | No |
| **Work & Criteria** | Languages Supported | `advisor_firms.languages` | Array of strings (`Thai`, `English`, `Japanese`, `Mandarin`, etc.) | Public (all) | No |
| **Legal & Address** | Legal Name | `advisor_firms.legal_name` | Max 120 chars, required | Public / Admin | Yes (DBD) |
| **Legal & Address** | Thai Registered Name | `advisor_firms.thai_name` | Max 200 chars | Public / Admin | Yes (DBD) |
| **Legal & Address** | Registration Number | `advisor_firms.registration_no` | 13 digits (for Thai entities) | Public / Admin | Yes (DBD) |
| **Legal & Address** | Street Address, Unit, District, Province, Postal | `advisor_firms.addr_street`, `unit`, `district`, `province`, `postal` | Address fields | Public / Admin | Yes (DBD) |
| **Legal & Address** | Website, Email, Phone | `advisor_firms.website`, `email`, `phone` | Valid URL, email, and phone | Public (all) | Yes (Web) |
| **Team Members** | Team Member Name, Role, Email | `advisor_team_members` table | Array of team member objects | Public (all) | No |
| **Credentials** | Accreditations, Licenses, Awards | `advisor_credentials` table | Array of credentials / certifications | Public (all) | No |
| **Documents** | Firm Brochure / Proof of License | `advisor_documents` table | Uploaded PDFs / DOCX via signed URLs | Admin / Public | No |
| **Admin Only** | Advisor Verification Status | `advisor_firms.advisor_verification` | `unverified`, `pending`, `verified`, `declined` (DB trigger protected) | Admin / Public badge | No |

---

### 2.4 Special Field Groups Analysis

1. **Admin-only fields:**
   - **Seller:** `code_name` (Anonymous listing name), `tenant_id`, `owning_agent_user_id`, `status`, `visibility`.
   - **Buyer:** `investors.notes`, `investor_profile_verifications` review status, manual `investor_type` override.
   - **Advisor:** `advisor_verification`, `verified_at`, `decline_reason`, `more_info_notes`.
2. **User-only fields (or User-initiated):**
   - **Seller:** `picked_image_path` (sector art or uploaded slot), `companyTypeReset` (request to restore account type).
   - **Buyer:** `preferred_industries` (agnostic choice), `mandate_summary`.
   - **Advisor:** Services selection and customized fee notes.
3. **Fields appearing in more than one tab/form:**
   - **Company Name / Legal Name:** Appears in Public Identity, Private About Company, and Setup Wizard.
   - **Company Type:** Appears in Public Identity (locked with badge) and Private About Company.
   - **Sector / Industry:** Appears in Public Listing Identity, Private Market classification, and Setup Wizard.
   - **Website URL:** Appears in Setup Wizard Review step, Private About Company, and Auto-Fill trigger.

---

## 3. Where It Saves: Data Persistence & Architecture

### 3.1 Database Tables Written
- **Seller Profile:**
  - `public.startups`: Core legal and operational data (`startup_name`, `registered_name`, `registered_number`, `year_founded`, `company_type`, `address_line1`, `address_city_district`, `address_province_state`, `address_postal_code`, `website_url`, `sector`, `business_model`, `status`, `visibility`, `tenant_id`, `owning_agent_user_id`).
  - `public.hidden_profiles`: Confidential marketplace listing data (`headline`, `confidential_summary`, `highlights`, `customers_summary`, `deal_type`, `asking_price_thb`, `transition_period_months`, `founder_retention`, `picked_image_path`).
  - `public.startup_founders`: Founder names, titles, shareholding percentages.
  - `public.startup_documents`: Uploaded pitch decks, financial PDFs, legal documents.
- **Buyer Profile:**
  - `public.buyer_profiles`: Current user buyer record (`buyer_relation`, `company_name`, `contact_name`, `contact_email`, `contact_phone`, `preferred_industries`, `min_revenue_thb`, `max_revenue_thb`, `approval_status`, `investor_id`).
  - `public.investors`: Linked public/directory record (`investor_name`, `legal_name`, `investor_type`, `description`, `sectors`, `ticket_size_min`, `ticket_size_max`, `website_url`, `year_founded`, `address_line1`, `district`, `province`, `postal_code`).
  - `public.investor_profile_verifications`: Verification metadata.
- **Advisor Profile:**
  - `public.advisor_firms`: Firm master record (`firm_name`, `firm_type`, `legal_name`, `registration_no`, `country`, `city`, `addr_street`, `addr_district`, `addr_province`, `addr_postal`, `website`, `email`, `phone`, `services`, `deal_size_band`, `team_size`, `sectors`, `sector_agnostic`, `languages`, `description`, `logo_path`, `media`, `advisor_verification`).
  - `public.advisor_fees`: Structured fee entries keyed by `firm_id` and `service`.
  - `public.advisor_team_members`: Array of member rows (`name`, `role`, `email`).
  - `public.advisor_credentials`: Array of accreditation items (`name`, `note`).
  - `public.advisor_documents`: Uploaded firm credentials and documents (`path`, `name`, `type`).

### 3.2 Server Functions & API Calls
- `src/lib/startups.functions.ts`:
  - `createStartup({ data })`: Creates new startup, assigns tenant, enforces permissions.
  - `updateStartup({ data })`: Updates `startups` row; checks `is_startup_member` or `is_control`.
  - `getStartup({ data: { id } })`: Reads complete startup record.
- `src/lib/hidden-profiles.functions.ts`:
  - `saveHiddenProfile({ data })`: Upserts `hidden_profiles` row linked to `startup_id`.
  - `setMyListingImage({ data: { startupId, imagePath } })`: Updates picked sector cover image.
- `src/lib/buyer-investor.functions.ts`:
  - `getBuyerProfile()`: Fetches current user profile and linked `investors` row.
  - `saveBuyerInvestor({ data })`: Updates both `buyer_profiles` and linked `investors` row in a coordinated transaction.
  - `setBuyerListing({ data: { live } })`: Requests buyer profile publication, resets status to `under_review`.
- `src/lib/advisor-firm.functions.ts`:
  - `getAdvisorFirm()`: Loads firm record and related fee/team/credential tables.
  - `saveAdvisorFirm({ data })`: Saves firm profile and nested relational tables.
  - `createAdvisorUploadUrl({ data: { kind, ext } })`: Mints pre-signed URL for document/logo storage.

### 3.3 Authorization, RLS & DB Triggers
- **User vs Admin Writes:** Users and Admins write to the **same database rows**. However, security is enforced at both the server function boundary (`requireSupabaseAuth`, checking `isControl`) and through database triggers:
  - `trg_guard_startup_system_fields`: Blocks non-Admin callers from changing `code_name`, `tenant_id`, `status`, `visibility`, or `owning_agent_user_id`.
  - `trg_guard_advisor_firm_verification`: Blocks non-Admin callers from altering `advisor_verification`, `verified_at`, or `decline_reason`.
  - `trg_guard_buyer_approval_status`: Blocks non-Admin updates to `buyer_profiles.approval_status`.
- **Status Changes & Approvals:**
  - When a seller updates listing details, if already published, it may flag for re-review or preserve published state depending on trigger settings.
  - When an unapproved buyer updates their profile, it stays in `draft` or `under_review`.
  - Advisor profile edits save in `draft` until all checklist requirements pass and Admin approves.
- **Audit Logging:**
  - Administrative changes and sensitive status transitions log to audit tables (`audit_logs`, `email_alert_log`).

---

## 4. Shared and Duplicated Code

### 4.1 Reusable UI Pieces
- `src/components/common/edit-info-popup.tsx`:
  - Core modal container (`EditInfoPopup`) based on Radix Dialog.
  - History/URL integration (`markEditPushed`, `leaveEditUrl`).
  - Unsaved changes confirmation dialog (`AlertDialog` with "Discard" / "Keep editing").
  - TanStack Router navigation blocker (`useBlocker`).
  - Portaled footer slot (`EditInfoFooter`) allowing nested forms to project "Cancel" and "Save" buttons into the sticky modal footer.
  - Tab navigation components (`MainTabs`, `TabRow`, `TabHead`) with full WAI-ARIA keyboard support (Arrow keys, Home, End).
  - Missing count badge (`MissingCount`).
- `src/components/common/edit-section.tsx`:
  - Section anchor wrapper (`EditSec`) and auto-scroll hook (`useOpenAtSection`) supporting `?section=<id>` deep links.

### 4.2 Duplications to Consolidate
- **Address Management:**
  - `StartupForm`: Implements a 5-field address grid (Street, Unit, Subdistrict, District, Province, Postal Code) with 77 Thai provinces dropdown.
  - `BuyerInvestorEdit`: Uses a separate address block and province selector.
  - `AdvisorFirmEdit`: Uses its own `Addr` interface and independent Thai address validation logic (`addrErrors`).
  - *Recommendation:* Unify into one shared `<AddressFields />` component.
- **Company Type & Entity Selection:**
  - Implemented with different radio/select variants and custom lock badges across `StartupForm`, `BuyerInvestorEdit`, and `AdvisorFirmEdit`.
- **Sector Pickers:**
  - PitchSnack previously standardized `SetSectorPicker` (`src/components/common/set-sector-picker.tsx`), but `StartupForm` and `AdvisorFirmEdit` still contain legacy customized wrappers around sector selection.
- **Media & Attachment Uploads:**
  - `AttachmentCard` (`src/components/startups/attachment-card.tsx`) is used by `AdvisorFirmEdit` and `StartupForm`, but file handling, signed URL generation, and error handling are independently wired.

---

## 5. Old, Unused, or Transitional Code

1. **Superseded Routes:**
   - `src/routes/_authenticated/my-startups.$id.edit.tsx`: Completely bypassed during normal navigation; forwards to `/my-startups?edit=startup` unless `returnTo === "valuation"`.
   - `src/routes/_authenticated/marketplace.my-company.edit.tsx`: A pure forwarding route that redirects buyers to `?edit=profile` and advisors to `?edit=firm`.
2. **Dual Form Architectures:**
   - **Seller:** `StartupForm` is huge (1,660+ lines) and handles both create mode, Admin directory edit, and user popup edit. Inside `StartupForm`, legacy fields exist (e.g. `investorIds` legacy picker comment: *"The legacy investorIds submit path is preserved ONLY so today's..."*).
   - **Buyer:** Two completely separate forms exist: `InvestorForm` (`src/components/investors/investor-form.tsx`, 668 lines, used by Admin in `/investors/$id/edit`) and `BuyerInvestorEdit` (`src/components/my-business/buyer-investor-edit.tsx`, 784 lines, used by buyers in My Company). They save overlapping fields across `buyer_profiles` and `investors`.
3. **Dead / Transitional Code & Comments:**
   - `startup-form.tsx:1620`: `/* Investor Relationships (V3) — replaces the legacy InvestorPicker */`
   - `startup-form.tsx:423`: Legacy submission references.
   - `public-view-fields.tsx`: Contains inline form sections originally separated from `StartupForm` but now partly co-dependent.
4. **Links Pointing to Old Routes:**
   - Several directory cards and action dropdowns still link to `/startups/$id/edit` and `/investors/$id/edit` (full-page routes) instead of triggering a pop-up.

---

## 6. What Has Been Built from the "Edit Information" Brief

Comparison against the six specific items in the brief:

| # | Item from Brief | Status | Files Involved | What Is Built vs What Is Missing |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **The pop-up over a greyed page, Admin's Edit included** | **Partly Built** | `src/components/common/edit-info-popup.tsx`, `seller-edit-popup.tsx`, `profile-edit-popup.tsx`, `startups.$id.edit.tsx`, `investors.$id.edit.tsx` | **Built:** Built for Seller (`SellerEditPopup`), Buyer (`ProfileEditPopup`), and Advisor in My Company.<br>**Missing:** Admin's Edit startup (`/startups/$id/edit`) and Admin's Edit investor (`/investors/$id/edit`) are still **full-page routes**, NOT the shared pop-up over a greyed page. Admin Advisors uses an inline Radix dialog, not `EditInfoPopup`. |
| **2** | **The seller's Address tab and the About Company rows** | **Partly Built** | `src/components/startups/startup-form.tsx` | **Built:** Address fields exist in database and inside the "About Company" tab.<br>**Missing:** There is **NO separate "Address" tab**. Address is mixed into the general About Company tab. The exact compact multi-column row layout specified in the brief is not fully implemented. |
| **3** | **The buyer's layout (Public view and Private view, the seven tabs)** | **Not Built** | `src/components/my-business/buyer-investor-edit.tsx` | **Built:** Field inputs exist in a single vertical scrolling form.<br>**Missing:** `BuyerInvestorEdit` does **NOT** use `MainTabs` (Public view vs Private view) or `TabRow` (the seven tabs). It is a monolithic single-column form with section dividers. |
| **4** | **The partner's layout (the teal label, the six tabs)** | **Not Built** | `src/components/advisor/advisor-firm-edit.tsx` | **Built:** Fields exist in stacked `<Section>` cards.<br>**Missing:** Does **NOT** render the six tabs or the teal tab bar specified. It uses continuous vertical scrolling. |
| **5** | **The one row (Company Type · Company size · Region, and Firm type · Team size · Typical deal size)** | **Not Built** | `startup-form.tsx`, `advisor-firm-edit.tsx` | **Built:** Individual fields exist across forms.<br>**Missing:** The unified, compact single-row design (`Company Type · Company size · Region` and `Firm type · Team size · Typical deal size`) is not implemented; fields remain in separate form rows or 2-column grids. |
| **6** | **Users, Control and Admin (Company Type locked for users, Admin's extra fields, section Edit links)** | **Built** | `startup-form.tsx`, `edit-section.tsx`, `seller-edit-popup.tsx` | **Built:** Company Type is locked for non-Admin users with a lock icon and "Set from your account type" or "Set by PitchSnack"; Admins get full dropdown with "Restore" option. Admin extra fields render conditionally. Section edit deep links (`?section=...`) scroll directly to target fields via `useOpenAtSection`. |

---

## 7. What Happened to These Files (History of Changes)

Based on git log and architecture changes:
- **October 6–9, 2026:**
  - `edit-info-popup.tsx` was created (`commit 05ae2139`, `8be2c768`) to provide a unified modal shell with dirty-checking, router navigation blockers, and portaled headers/footers.
  - `edit-section.tsx` was created to support `?section=<id>` deep links from My Company workspace cards.
- **October 9–12, 2026:**
  - `SellerEditPopup` and `ProfileEditPopup` were introduced to wrap `StartupForm` and `BuyerInvestorEdit` / `FirmEditForm` inside `marketplace.my-company` and `my-startups`.
  - Added company type locking logic in `StartupForm`: non-admins see a read-only lock badge; admins see an editable dropdown with reset capability.
  - Setup wizards for Seller, Buyer, and Advisor were updated to share form models and prefill logic with the edit forms.
- **October 14–16, 2026:**
  - Direct routes (`/my-startups/$id/edit` and `/marketplace/my-company/edit`) were updated to immediately forward into the query-driven popups (`?edit=startup`, `?edit=profile`, `?edit=firm`) to eliminate duplicate editing screens for regular users.
  - Fixed portal slot rendering for header tabs in `EditInfoPopup`.
- **October 21, 2026:**
  - Refinements to PublicListingCard highlights and customer profile displays.
  - Adjustments to website duplicate checking and DBD data extraction hooks.

---

## 8. What the Rebuild Has to Watch Out For

1. **Setup Wizards Depend on These Form Components:**
   - `SellerWizard` relies on `StartupForm` data structures and `saveSellerSetup`.
   - `BuyerSetupWizard` directly renders `<BuyerInvestorForm />` at its "Review & complete" step.
   - `AdvisorSetupWizard` directly renders `<FirmEditForm setup={setupMode} />` at its final step.
   - *Any refactoring of these forms must preserve the props and submission contracts expected by the setup wizards.*
2. **Dual-Role Buyers (Buyer Profile + Directory Investor):**
   - In PitchSnack, buyers have a private `buyer_profiles` record AND a linked `investors` record in the public directory. Changes must update both atomically (as `saveBuyerInvestor` currently does).
3. **Database Guard Triggers:**
   - Any save payload submitted without an Admin session that touches protected columns (`code_name`, `status`, `visibility`, `advisor_verification`) will be rejected by database triggers. The frontend must never attempt to send modified values for these fields when invoked by non-admin users.
4. **DBD Scraping & Auto-Fill Invalidation:**
   - When a user changes `registered_number` or company name, existing auto-fill caches and DBD company verification pointers may be invalidated.
5. **Route Blocker & Portal Timing:**
   - `EditInfoPopup` uses TanStack Router's `useBlocker` to trap back-button presses while dirty. Forms using portal roots (`EditInfoFooter`, `EditInfoTabsSlot`) must mount cleanly without race conditions during route transitions.

---

## 9. A Clean-Up Plan (To Discuss, Not to Do Yet)

### 9.1 What to Delete
- Delete the legacy `investorIds` submit logic in `StartupForm`.
- Remove dead forwarding routes once all links and bookmarks point to query-based popups, or keep them strictly as lightweight router-level redirects without rendering heavy components.
- Delete unused custom CSS classes once Tailwind v4 utility tokens are standardized across all three edit forms.

### 9.2 What to Merge
- **Unify Buyer Editing:** Merge `InvestorForm` (`src/components/investors/investor-form.tsx`) and `BuyerInvestorEdit` (`src/components/my-business/buyer-investor-edit.tsx`) into a single canonical `BuyerForm` component that accepts an `isAdmin` prop, matching the pattern used by `StartupForm` and `FirmEditForm`.
- **Unify Address Fields:** Extract a single shared `<AddressFields />` component used across Seller, Buyer, and Advisor forms, handling Thai subdistrict/district/province/postal code auto-selection and foreign address inputs identically.
- **Unify Media / Photo Uploader:** Standardize logo and office photo uploads into a single `<ProfileMediaUploader />` component.

### 9.3 What to Keep
- Keep `EditInfoPopup` (`edit-info-popup.tsx`) as the single modal shell for all roles.
- Keep `EditSec` and `useOpenAtSection` for section-level deep linking (`?section=...`).
- Keep the server-side authorization architecture and database triggers (`trg_guard_startup_system_fields`, etc.).
- Keep TanStack Start server functions (`startups.functions.ts`, `buyer-investor.functions.ts`, `advisor-firm.functions.ts`).

### 9.4 Recommended Order of Execution
1. **Phase 1: Component Extraction:** Extract shared sub-components (`<AddressFields />`, `<CompactMetaRow />`, `<SetSectorPicker />`).
2. **Phase 2: Buyer & Advisor Tab Standardization:** Rebuild `BuyerInvestorEdit` and `FirmEditForm` to use `MainTabs` and `TabRow` from `edit-info-popup.tsx`, implementing the requested tabs and compact rows.
3. **Phase 3: Seller Form Streamlining:** Add the dedicated "Address" tab to `StartupForm` and restructure the About Company rows into the requested compact format.
4. **Phase 4: Admin Integration:** Replace the full-page edit screens (`/startups/$id/edit`, `/investors/$id/edit`, and the advisor directory dialog) with the shared `EditInfoPopup`.
5. **Phase 5: Verification & Tests:** Run full test suite, verify wizard compatibility, and test dirty-state blockers on mobile and desktop.

---

## 10. Open Questions for Discussion Before Rebuilding

1. **Admin Editing Experience:** Should clicking "Edit" in the Admin Startups Directory and Investors Directory open the exact same `EditInfoPopup` modal over the directory page (maintaining directory scroll position and filters), or is there any requirement for Admin to retain a standalone full-page editing route?
2. **Buyer Form Consolidation:** Can we fully decommission `src/components/investors/investor-form.tsx` and migrate Admin to the unified `BuyerInvestorForm`, ensuring Admins and Buyers edit the identical schema?
3. **Seller Address Tab:** If Address becomes its own tab in Seller Edit, should the "About Company" tab retain any summary of the address (e.g. Province/City badge), or should address fields move entirely to the new Address tab?
4. **Draft vs Live Approval on Edit:** When an already approved/live seller or buyer edits non-confidential details (e.g. description, website, team size), should the profile remain published, or should it automatically trigger an Admin re-approval notice?
