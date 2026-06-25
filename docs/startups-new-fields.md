# `/startups/new` — Field Reference & UX/UI Spec

Route: `src/routes/_authenticated/startups.new.tsx`
Form: `src/components/startups/startup-form.tsx` (shared with edit mode)

Access is gated by `PermissionGuard` requiring `startups.write`. The page renders a back link to `/startups`, an `<h1>` "New startup" with a muted subtitle, then the `StartupForm` inside a centered `max-w-4xl` container.

---

## Page Layout

| Region | Purpose | UI |
| --- | --- | --- |
| Back link | Return to startups list | `ArrowLeft` icon + "Back to startups", muted, hover→foreground |
| Header | Title + intent | 3xl semibold title, muted helper text |
| Form card | All fields | Rounded card, border, `bg-card`, `p-6`, `shadow-card`, `text-sm`, vertical 4-unit spacing |

---

## Fields

### 1. Tenant *(create-only, required)*
- **Data**: `tenantId: string` — bound to `assignable-tenants` query.
- **Functionality**: Determines which workspace owns the new startup. Default pre-fills to `session.activeWorkspace.tenantId` (or the first assignable tenant). Drives the ownership lookups below.
- **UI**: shadcn `Select` with placeholder "Select tenant". Label carries a red `*`.

### 2. Logo *(visual-only, not persisted yet)*
- **Data**: `logoFile: File | null`.
- **Functionality**: Local preview only; `logoPath` is sent as `null`. Drag-and-drop or click to pick an image; X button clears.
- **UI**: 168×56 dashed drop zone, `Upload` icon, hover ring + accent fill on drag. Filled state shows preview with hover overlay (replace + remove).

### 3. Media *(visual-only, not persisted yet)*
- **Data**: `mediaFiles: (File | null)[]` — 3 fixed slots. Sent as `media: []`.
- **Functionality**: Three independent image slots with per-slot drag/drop, replace, remove. Counter `(filled/3)` in label.
- **UI**: Row of three 96×64 thumbnails. Empty slot = dashed border, upload icon, "Slot N". Filled = cover image with hover dark overlay containing Replace/Remove buttons.

### 4. Year Founded
- **Data**: `yearFounded: string` → coerced to `number | null`.
- **Functionality**: Numeric input, min 1900, max current year. Optional.
- **UI**: `Input type="number"`, narrow 120px column, placeholder "e.g. 2023".

### 5. Company Name *(required)*
- **Data**: `startupName: string`, max 100 chars.
- **Functionality**: Primary identifier. `required` attribute; controls submit-button enablement.
- **UI**: Text input, flex column, placeholder "e.g. Acme Corp". Label has red `*`.

### 6. Company Type
- **Data**: `companyType: string | null`. Options: `SME`, `Startup`, `Corporate Enterprise`.
- **Functionality**: Single-select taxonomy.
- **UI**: shadcn `Select`, fixed 160px column completing the 3-column grid `[120px_1fr_160px]`.

### 7. Email Address
- **Data**: `email: string | null`, max 255.
- **Functionality**: Public contact email.
- **UI**: `Input type="email"`, placeholder "contact@company.com". 3-col grid.

### 8. Headquarters
- **Data**: `headquarters: string | null`.
- **Functionality**: Free-text HQ location (city/country).
- **UI**: Text input, placeholder "Country".

### 9. Company URL
- **Data**: `websiteUrl: string | null`.
- **Functionality**: External marketing site.
- **UI**: `Input type="url"`, placeholder "https://example.com".

### 10. Legal Name
- **Data**: `legalName: string | null`.
- **Functionality**: Registered legal entity name (kept from existing schema).
- **UI**: Plain text input. 2-col row with Country.

### 11. Country
- **Data**: `country: string | null`.
- **Functionality**: Country of incorporation.
- **UI**: Plain text input.

### 12. Short Description
- **Data**: `shortDescription: string | null`, max 300.
- **Functionality**: 2-line summary used in cards/lists.
- **UI**: `Textarea`, `rows=2`, placeholder "One-line description".

### 13. Product Overview (Long Description)
- **Data**: `longDescription: string | null`, max 2000.
- **Functionality**: Full product write-up.
- **UI**: `Textarea`, `rows=3`, placeholder "Describe the product".

### 14. Product & Service Tags
- **Data**: `productTags: string[]` — capped at 5, each ≤50 chars, dedupe enforced.
- **Functionality**: Add tag via Enter key or "Add" button; click a chip to remove. Input disables at 5 tags.
- **UI**: Filled pill chips (primary bg, X icon). Input + outline "Add" button below.

### 15. Market Tags
- **Data**: `marketTags: string[]` — capped at 5, ≤50 chars each.
- **Functionality**: Same behavior as product tags.
- **UI**: Same pill + input pattern. Placeholder "User, System, Species, Role, Vertical".

### 16. Industry *(multi-select + custom)*
- **Data**: `industries: string[]` joined with `", "` into `industry: string | null`.
- **Functionality**: Toggle from preset list (`FinTech`, `eCommerce & Marketplace`, `MarTech`, `HealthTech`, `Sustainability`, `Mobility & Logistics`, `DeepTech`, `Defense`, `EdTech`, `Gaming`, `PropTech`, `AgriTech`, `FMCG`, `Others`). Custom entries appendable via input + Add.
- **UI**: Pill row — inactive pills muted, active pills primary. Custom values render as removable primary pills with X.

### 17. Investment Stage
- **Data**: `investmentStage: string | null`. Options: `Pre-Seed`, `Seed`, `Series A`, `Series B`, `Series C+`, `Growth`, `IPO`, `Inactive`, `Acquired`.
- **Functionality**: Single-select taxonomy.
- **UI**: shadcn `Select`, full-width.

### 18. Investors
- **Data**: `investorIds: string[]`.
- **Functionality**: Multi-select scoped to the chosen tenant. Delegated to `InvestorPicker`.
- **UI**: Popover with command/search, selected investors rendered as removable tags.

### 19. Founding & Leadership Team
- **Data**: `founders: FounderDraft[]` (`full_name`, `position`, `linkedin_url`, `bio`). Blank-name rows stripped on submit.
- **Functionality**: Add/remove/edit founder rows via `FounderEditor`.
- **UI**: Stacked editor card per founder with inline fields.

### 20. Status *(create-only)*
- **Data**: `status: string`, default `"Draft"`. Options: `Draft`, `Active`, `Fundraising`, `Due Diligence`, `Portfolio`, `Exited`, `Inactive`, `Archived`.
- **Functionality**: Initial lifecycle stage.
- **UI**: shadcn `Select`, paired with Visibility in a 2-col grid.

### 21. Visibility *(create-only)*
- **Data**: `visibility: string`, default `"Tenant"`. Options: `Private`, `Tenant`, `Shared`, `Archived`.
- **Functionality**: Controls who can see the record (per existing access rules).
- **UI**: shadcn `Select`.

### 22. Owning Agent *(create-only, required)*
- **Data**: `owningAgentUserId: string`. Source: `listAssignableUsers({ tenantId, userType: "Human" })`.
- **Functionality**: Required human owner. Disabled until a tenant is picked. Shows "Loading…" while query is pending.
- **UI**: shadcn `Select`. Lives under an "Ownership (required)" section with helper text "Every startup must have one human Owning Agent and one Owning AI Agent." Red `*`.

### 23. Owning AI Agent *(create-only, required)*
- **Data**: `owningAiAgentId: string`. Source: `listAssignableUsers({ tenantId, userType: "AI" })`.
- **Functionality**: Required AI owner. If the tenant has zero AI users (`noAi`), the select is disabled and a destructive helper line tells the admin to invite an AI user first.
- **UI**: shadcn `Select`, red `*`, destructive helper text on empty.

---

## Submit & Validation

- **Submit button enabled when**: `startupName` is set AND (edit mode) OR (`tenantId` + both owning IDs set).
- **Mutations**: `createStartup` server function on submit → toast success → invalidate `["startups"]` → navigate to `/startups/$id`. Errors surface via `toast.error`.
- **Buttons**: Outline "Cancel" (navigates back) and accent-filled primary submit ("Create startup" / "Saving…").

## Visual Conventions

- Card: `rounded-lg border border-border bg-card p-6 shadow-card`.
- Field spacing: `space-y-1.5` inside a field, `space-y-4` between fields.
- Required markers: inline red asterisk inside the `<Label>`.
- Pills: `px-3 py-1 rounded-full text-xs` — muted when inactive, primary when active.
- Drop zones: dashed border, muted bg, primary-tinted accent on drag-over.
- Grid rhythm: opener row `[120px_1fr_160px]`, then 3-col, then 2-col rows.
