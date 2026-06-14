## Goal

Bring the PitchSnack1 "Startup Intelligence" and "Investor Intelligence" UX (Grid + Split views, with view toggle) to SnackPortal2's `/startups` and `/investors`, while keeping all data access on tenant-scoped server functions (Physical Multi-Database).

Reference: PitchSnack1 `src/pages/StartupDirectory.tsx` (1540 lines) and `src/pages/InvestorDirectory.tsx` (1323 lines). We replicate the patterns, not line-for-line — PitchSnack-only features (pitch invites, swipe gestures, hover graphs, AI nodes, i18n) are out of scope.

## Scope

### In scope (this PRD)
1. `/startups`: Grid + Split view, view toggle, replicated `SnapshotCard`, replicated right-panel detail (header, media slots, description, product overview, tags, industry, stage, investors, founders), search/filter/sort row.
2. `/investors`: Grid + Split view, view toggle, replicated investor card, replicated right-panel detail (header, focus, stages, market/industry tags, portfolio startups).
3. View-mode persistence in URL (`?view=grid|split`) — survives refresh, tenant-safe, no cross-route leak.
4. All data still flows through existing `listStartups` / `getStartup` / `listInvestors` / `getInvestor` server functions. No new schema, no new bucket.
5. Investor-side reverse link (portfolio startups) — derived in server function from existing `startup_investors` join, no schema change.

### Out of scope
- Pitch invites, swipe gestures, framer-motion modals, AI graph panel, i18n, "PitchSnack verified" hats, save/bookmark, deck extraction.
- Any new DB columns, new tables, new buckets, new permissions.
- Investor media slots (PitchSnack uses `investor_product_images` — SnackPortal2 has no equivalent table; would need a new PRD).
- Founders/team UI on investor side beyond what's already there.

## Implementation

### 1. View-toggle primitive
- New `src/components/shared/view-toggle.tsx`: two-button segmented control `Grid | Split` using `Grid3X3` / `Columns2` icons, matches existing button styling.
- View mode read/written through TanStack Router search param (`view: 'grid' | 'split'`, default `grid`).

### 2. `/startups` rebuild — `src/routes/_authenticated/startups.index.tsx`
- Add `view` to `searchSchema` (default `'grid'`).
- Keep existing search/filter/sort row, append `<ViewToggle />` at the right.
- Grid mode: existing `StartupCard` grid (already replicated last turn — tighten styling to match PitchSnack `SnapshotCard`: product-image banner at top when media[0] exists, logo+name row, badges row, short_description, product chips, divider, industry row, market chips, investors row).
- Split mode: two-pane CSS grid `lg:grid-cols-[minmax(360px,28rem)_1fr]`, left = scrollable list of `StartupListItem` (compact card variant), right = `StartupDetailPanel` for `selectedId` (mirrors current `/startups/$id` content but inline). Empty state on right when nothing selected.
- Below `lg`: split collapses to grid only.

### 3. `StartupDetailPanel` component (new, inline-detail extraction)
- Extract the body of `src/routes/_authenticated/startups.$id.tsx` Overview tab into `src/components/startups/startup-detail-panel.tsx` taking `startupId`.
- Reuses `useStartup(id)`. Shows: header (logo + name + type + website/email/HQ/year), media row (slot 1/2/3 with lightbox), short description, product overview, product tags, market tags, industry+stage badges, investors list (logo + name, clickable to `/investors/$id`), founders list.
- Existing `/startups/$id` page continues to render this panel inside its tab.

### 4. `/investors` rebuild
- Replace current table-only `investors.index.tsx` with the same Grid/Split scaffold.
- New components: `src/components/investors/investor-card.tsx`, `src/components/investors/investor-list-item.tsx`, `src/components/investors/investor-detail-panel.tsx`.
- Card fields (from existing `investors` schema): logo, name, investor_type, country, website, short description (if present), investment-stage focus, market/industry focus tags (if columns exist — fall back gracefully).
- Filter bar: `Type`, `Country` (free-text), search.
- Detail panel: header + description + focus chips + linked startups (from `startup_investors`).

### 5. Server function additions
- `getInvestor` extended to return `linked_startups: { id, name, logo_signed_url }[]` via `startup_investors` join, same tenant.
- `listInvestors` already returns enough; add optional `type` / `country` filter params if not present.
- No schema migration.

### 6. URL state
- `/startups?view=split&selected=<id>` — clicking a card in split mode sets `selected`; refresh restores selection.
- `/investors?view=split&selected=<id>` — same.

## Out-of-the-box guardrails preserved
- All reads via server functions; no direct Supabase from UI.
- Tenant scoping unchanged (server functions already enforce).
- No new env vars, secrets, or buckets.

## Files

Created:
- `src/components/shared/view-toggle.tsx`
- `src/components/startups/startup-list-item.tsx`
- `src/components/startups/startup-detail-panel.tsx`
- `src/components/investors/investor-card.tsx`
- `src/components/investors/investor-list-item.tsx`
- `src/components/investors/investor-detail-panel.tsx`

Edited:
- `src/routes/_authenticated/startups.index.tsx` (add view+selected param, split layout)
- `src/routes/_authenticated/startups.$id.tsx` (delegate Overview tab to `StartupDetailPanel`)
- `src/routes/_authenticated/investors.index.tsx` (full rebuild: grid/split)
- `src/components/startups/startup-card.tsx` (banner image + tighter typography to match PitchSnack)
- `src/lib/investors.functions.ts` (add `linked_startups` to `getInvestor`, optional filters to `listInvestors`)
- `src/hooks/use-investors.ts` (pass through filter params)

## Acceptance check (post-build)
- `/startups?view=grid` shows PitchSnack-style cards with banner+logo+chips.
- `/startups?view=split` shows list-left, detail-right, selection survives refresh, empty state visible until selection.
- `/investors?view=grid|split` mirrors the same pattern.
- View toggle visible and active state correct; filters/search/sort unchanged in behavior.
- No regressions to `/startups/$id` (still uses extracted detail panel).