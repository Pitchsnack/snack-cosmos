# PRD-SP2-STARTUP-001 — Implementation Plan

Replicate the PitchSnack `/startups` experience in SnackPortal2 with the Physical Multi-DB constraints intact. Phase 1 ships schema, storage, API, and the full UI in one pass (no placeholders for media, founders, or investors).

## 1. Database migration (single migration)

Extend `public.startups` (additive, nullable so existing rows keep working):

- `logo_url text`
- `company_type varchar(100)` (SaaS, FinTech, Marketplace, AI, …)
- `year_founded int` (1800–current year, validated by trigger)
- `email varchar(255)`
- `headquarters varchar(255)`
- `investment_stage varchar(50)` (Pre-Seed, Seed, Series A/B/C, Growth, Other) — CHECK constraint
- `product_tags text[] default '{}'` — trigger enforces `array_length ≤ 5`
- `market_tags text[] default '{}'` — same rule

New tables (each gets `tenant_id`, FK to `startups`, GRANTs, RLS using `can_access_startup` / `can_manage_startup`, `updated_at` trigger, and `tg_enforce_startup_tenant_match`):

- `startup_media` — `startup_id`, `slot smallint CHECK (slot BETWEEN 1 AND 3)`, `image_url text`, `storage_path text`, `caption text`, UNIQUE `(startup_id, slot)`
- `startup_founders` — `startup_id`, `full_name`, `position`, `linkedin_url`, `bio`, `photo_url`, `display_order int`
- `startup_investors` — `startup_id`, `investor_id` FK, UNIQUE `(startup_id, investor_id)`, trigger asserts both rows share the same `tenant_id`

Helpful indexes: GIN on `product_tags`, `market_tags`; btree on `industry`, `investment_stage`, `headquarters`, `company_type`.

## 2. Storage

Create private bucket `startup-media` (tool call, not SQL). Path convention `{tenant_id}/{startup_id}/logo.{ext}` and `{tenant_id}/{startup_id}/slot-{1|2|3}.{ext}`. RLS policies on `storage.objects` for that bucket:

- SELECT/INSERT/UPDATE/DELETE allowed when `(storage.foldername(name))[1]::uuid` matches a tenant the caller can manage the corresponding startup in. We resolve via `can_manage_startup(auth.uid(), tenant_id)` for writes and `can_access_startup` for reads, parsed from the path.

## 3. Server layer (TanStack server functions, RLS-as-user)

All under `src/lib/startups/*.functions.ts`, gated by `requireSupabaseAuth`:

- `listStartups({ search, filters, sort, page, pageSize })` — filters: stage, industry, hq, company_type, product_tags, market_tags. Search across name, short_description, industry, headquarters, tags. Sort: updated desc, created desc, name asc/desc.
- `getStartup(id)` — returns startup + media (3 slots) + founders + linked investors (with logo_url, name).
- `createStartup(payload)` / `updateStartup(id, payload)` — validates tag arrays (max 5), upserts founders, upserts media slots, syncs `startup_investors` (same-tenant enforced server-side too).
- `deleteStartup(id)` (Control only — RLS already enforces).
- `listTenantInvestors(tenantId)` — for the investor multi-select.
- `uploadStartupMedia({ startupId, slot|"logo", file })` — signs upload, returns public-ish path; client calls Supabase storage with returned signed URL OR we proxy via server fn.

Return plain DTOs only.

## 4. UI rebuild — `/startups`

Routes (already exist): `_authenticated/startups.index.tsx`, `.new.tsx`, `.$id.tsx`. Rewrite contents; keep `_authenticated/startups.tsx` as the layout outlet.

New components under `src/components/startups/`:

- `startup-card.tsx` — logo (top-left, fixed 64×64 rounded box, placeholder = monogram), bold name, company type subtitle, HQ + year metadata row, stage + industry badges, two chip rows (product / market, max 5 each, overflow `+N`), 2-line description clamp.
- `startup-grid.tsx` — responsive grid (1/2/3 cols).
- `startup-filters.tsx` — search input (debounced, URL-synced via `validateSearch`), filter popovers for stage/industry/HQ/type/tags, sort dropdown, pagination.
- `startup-detail.tsx` — header (logo, name, type, website, email, hq, year), media gallery (3 slots, lightbox on click), product overview, product & market chips, investors strip, founders cards.
- `startup-form.tsx` — full rewrite. Sections: Company Profile, Company Information, Tags, Classification (industry/stage), Investors multi-select (from `listTenantInvestors`), Founders repeater, Media uploader (logo + 3 slots). Used by both `/startups/new` and `/startups/$id/edit` (single shared form).
- `chip-input.tsx` — free-text tag entry, Enter to add, max 5 enforced.
- `media-uploader.tsx` — drag/drop + preview + remove, posts to `startup-media` bucket via signed URL.
- `founder-editor.tsx` — add/remove rows.
- `investor-picker.tsx` — combobox multi-select sourced from tenant investors.

URL-synced search state via TanStack Router `validateSearch` + `loaderDeps`. Loader primes `ensureQueryData`; component uses `useSuspenseQuery`.

## 5. Edit entry point

Add `_authenticated/startups.$id.edit.tsx` reusing `startup-form` in edit mode (or render edit inline on detail — pick route for clean URLs). Linked from detail page "Edit" button when `can_manage_startup`.

## 6. Multi-DB / vendor-neutral guardrails

- All UI talks to server functions, never Supabase client directly.
- `source_global_id` already exists on `startups` — keep it untouched. No Phase 1 UI for global import, but server payloads preserve the column.
- No Supabase-typed imports leak into components; server fns return DTOs typed in `src/lib/startups/types.ts`.

## 7. Acceptance check

- Card matches PitchSnack layout (logo box, chip styling, 2-line clamp).
- Detail page renders logo + 3 media slots + founders + investors + tags.
- Create + edit round-trip works including media upload/replace/delete and investor link sync.
- Tag arrays hard-capped at 5 (UI + DB trigger).
- Search, 6 filters, 4 sorts, pagination all URL-synced.
- RLS verified: cross-tenant investor link rejected; cross-tenant media access denied.

## 8. Out of scope (Phase 2+)

Global → Tenant import UI, AI recommendations / intelligence panel, rich text product overview, founder photos/bios beyond fields above, investor profile pages, deck extract.

## Open follow-ups (will assume defaults unless you say otherwise)

- Edit route: separate `/startups/$id/edit` page (assumed) vs inline on detail.
- Existing rows missing `company_type` / `headquarters` etc. render with `—` fallbacks; no backfill.
- `investment_stage` enum values listed above — confirm if PitchSnack uses a different list.
