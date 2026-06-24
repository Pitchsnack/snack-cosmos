# PRD P-17 V4 — Global Startups Registry (Lovable prototype)

Platform-owned global startup catalogue that Control curates, tenants browse, and tenants import as independent tenant-owned copies. Built behind a strict adapter seam so the future API Gateway / multi-DB backend can replace storage without UI changes.

## Blocking confirmations — resolved

**C-1 — Control role string:** `CONTROL` (verified in `src/lib/permissions.ts` `AppRole` union and used by `has_role` + `is_control`). Tenant roles in scope: `MASTER_AGENT`, `TENANT_ADMIN`, `TENANT_AGENT`.

**C-2 — Default owner resolution at import:** `tenant_settings` has no default-owner columns today and the PRD forbids schema sprawl. Rule:
1. The import dialog **always** requires the caller to pick `owning Agent` (defaults to the caller if they are a `MASTER_AGENT`/`TENANT_ADMIN`/`TENANT_AGENT` of the active tenant) and `owning AI Agent` (selected from active-tenant `MASTER_AGENT_AI` users).
2. If the tenant has no AI agent user available, the dialog shows the PRD's failure message and the Import button is disabled — no row is written.
3. Server function re-validates both ids belong to the active tenant and have the correct role before any insert.

## What gets built

### 1. Migration (additive only)

`public.global_startups` — no `tenant_id`, no tenant fields:
- `id`, `name not null`, `sector`, `stage`, `description`, `website`, `tags text[]`
- `status text check in ('draft','available','recommended','archived') default 'draft'`
- `created_by uuid`, `created_at`, `updated_at` (+ `tg_set_updated_at` trigger)
- Grants: `SELECT, INSERT, UPDATE` to `authenticated`; `ALL` to `service_role`. No DELETE.
- RLS:
  - SELECT: `is_control(auth.uid())` OR `status in ('available','recommended')`
  - INSERT/UPDATE: `is_control(auth.uid())`

`public.startups` additive columns:
- `source_global_id uuid null` (no FK — reference-only)
- `imported_at timestamptz null`
- `CREATE UNIQUE INDEX ux_startups_tenant_source_global ON public.startups (tenant_id, source_global_id) WHERE source_global_id IS NOT NULL;`

`public.global_startup_imports` — Control-side ledger:
- `id`, `global_id uuid not null`, `tenant_id uuid not null`, `tenant_startup_id uuid not null`, `imported_by uuid not null`, `imported_at timestamptz not null default now()`
- Grants: `SELECT` to `authenticated`; `ALL` to `service_role`. No INSERT/UPDATE/DELETE for authenticated (writes via service_role inside server function).
- RLS SELECT: `is_control(auth.uid())` OR `user_in_tenant(auth.uid(), tenant_id)`.

No triggers syncing tables. No cascades. No RLS rewrite on `startups`.

### 2. Permissions (`src/lib/permissions.ts`)

Add to `Permission` union and `ROLE_PERMISSIONS`:
- `global_startups.read` → CONTROL, MASTER_AGENT, TENANT_ADMIN, TENANT_AGENT (and MASTER_AGENT_AI inherits from TENANT_ADMIN list)
- `global_startups.write` → CONTROL only
- `global_startups.import` → MASTER_AGENT, TENANT_ADMIN, TENANT_AGENT

`STARTUP_USER` / `INVESTOR_USER` excluded. `usePermissions`, `useEffectivePermissions`, `PermissionGuard` not modified.

### 3. Server functions (`src/lib/global-startups.functions.ts`)

All `requireSupabaseAuth`. Real role + real active-tenant checks via `getSessionContext` — never view-switcher state.

- `listGlobalStartupsFn(filters)` — name/sector/stage/status/tags, role-gated visibility via RLS.
- `getGlobalStartupFn(globalId)`
- `createGlobalStartupFn(data)` — Control only.
- `updateGlobalStartupFn(globalId, data)` — Control only.
- `setGlobalStartupStatusFn(globalId, status)` — Control only.
- `listImportsOfGlobalStartupFn(globalId)` — reads `global_startup_imports` ONLY. Never joins to `startups`.
- `importGlobalStartupFn({ globalId, owningAgentUserId, owningAiAgentId })` — atomic via a Postgres function `public.fn_import_global_startup(...)` (created in the same migration) that runs in one transaction:
  1. Verify global exists and status in ('available','recommended').
  2. Re-check duplicate by `(tenant_id, source_global_id)` (partial unique index also enforces).
  3. Verify owningAgent + owningAiAgent belong to active tenant with allowed roles.
  4. Insert tenant `startups` row (copy name/sector/stage/description/website/tags), set `tenant_id`, `source_global_id`, `imported_at = now()`.
  5. Insert `startup_ownership` + `startup_ai_ownership`.
  6. Insert `global_startup_imports` ledger row.
  7. Return new tenant startup id. Any failure aborts everything.

Server function calls the RPC via `supabaseAdmin` (loaded inside handler) after verifying caller has `global_startups.import` and resolving the active tenant — the RPC body re-asserts role + tenant for defense in depth.

### 4. Adapter seam (`src/lib/api-gateway/global-startups.ts`)

The ONLY frontend-facing module for global/import operations. Today wraps the server functions; tomorrow re-points at API Gateway. Exports the seven signatures listed in PRD §10.1.

### 5. Hooks (call adapter only — no Supabase imports)

- `src/hooks/use-global-startups.ts` (list + filters)
- `src/hooks/use-global-startup.ts` (detail + imports)
- `src/hooks/use-import-global-startup.ts` (mutation + cache invalidation)

### 6. Routes & components

Routes:
- `src/routes/_authenticated/global-startups.index.tsx` — Control list, search/filter, create, status change. `PermissionGuard global_startups.write`.
- `src/routes/_authenticated/global-startups.$id.tsx` — Control detail/edit + import ledger view. `PermissionGuard global_startups.write`.
- `src/routes/_authenticated/global-startups.browse.tsx` — Tenant browse (status `available`/`recommended` only) + Import action. `PermissionGuard global_startups.read`.

Components in `src/components/global-startups/`:
- `global-startup-table.tsx`
- `global-startup-form.tsx`
- `import-global-startup-dialog.tsx` — target tenant (read-only from session), owning Agent picker, owning AI Agent picker, "already imported" state, ownership-missing error, no-sync confirmation.
- `global-startup-lineage-badge.tsx` — renders on tenant startup detail when `source_global_id != null`. Links to `/global-startups/$id` only if `usePermissions().has('global_startups.read')`.

### 7. Sidebar (`src/components/app-sidebar.tsx`)

Add `NAV_ITEMS` entries (filtered by `useEffectivePermissions` — already the hook in use):
- CONTROL → "Global Startups" → `/global-startups`
- MASTER_AGENT / TENANT_ADMIN / TENANT_AGENT → "Browse Global Catalogue" → `/global-startups/browse`

Existing "Startups" entry unchanged.

### 8. Minimal edits to existing files

- `src/lib/permissions.ts` — add 3 permission strings to maps.
- `src/components/app-sidebar.tsx` — add 2 nav entries + permission gating.
- `src/components/startups/startup-detail-panel.tsx` — render lineage badge.
- `src/routes/_authenticated/startups.$id.tsx` — ensure `source_global_id` + `imported_at` reach the detail panel (already returned by row select).

### 9. Files NOT changed

`usePermissions`, `useEffectivePermissions`, `PermissionGuard`, `ViewModeProvider`, route-loader pattern, RLS on existing `startups`, workspace switcher, tenant routing, `getSessionContext`, auth files, `client.ts`, `client.server.ts`.

## Technical details

### Adapter / data-flow

```text
UI route / component
   ↓
src/hooks/use-*.ts
   ↓
src/lib/api-gateway/global-startups.ts   ← only allowed entry
   ↓
src/lib/global-startups.functions.ts     ← only allowed file with from("global_startups")
   ↓
Supabase (today)  →  API Gateway (tomorrow — adapter re-point only)
```

### Atomic import boundary

The Postgres function `public.fn_import_global_startup(global_id uuid, tenant_id uuid, owning_agent uuid, owning_ai_agent uuid, imported_by uuid)` is the transaction boundary; the server function is a thin authorization + RPC wrapper. The business contract is "atomic import", not the RPC name — the adapter can swap to a Gateway HTTP call without UI change.

### Guardrails enforced (and grep-provable)

- `rg "from\\(\"global_startups"` returns only `src/lib/global-startups.functions.ts`.
- `rg "from\\(\"global_startup_imports"` same.
- No `select(...startups!...global_startups...)` joins anywhere.
- No `supabase` import in `src/hooks/use-global-*.ts`, routes, or components.
- View Switcher: server functions read role via `getSessionContext` / `requireSupabaseAuth`. The `requestedViewRole` from `ViewModeProvider` never reaches `.functions.ts` files — it only feeds `useEffectivePermissions` for sidebar rendering.
- `listImportsOfGlobalStartupFn` reads only `global_startup_imports`.

### Files created

```
supabase/migrations/<ts>_global_startups.sql
src/lib/global-startups.functions.ts
src/lib/api-gateway/global-startups.ts
src/hooks/use-global-startups.ts
src/hooks/use-global-startup.ts
src/hooks/use-import-global-startup.ts
src/routes/_authenticated/global-startups.index.tsx
src/routes/_authenticated/global-startups.$id.tsx
src/routes/_authenticated/global-startups.browse.tsx
src/components/global-startups/global-startup-table.tsx
src/components/global-startups/global-startup-form.tsx
src/components/global-startups/import-global-startup-dialog.tsx
src/components/global-startups/global-startup-lineage-badge.tsx
```

### Files edited (minimal)

```
src/lib/permissions.ts
src/components/app-sidebar.tsx
src/components/startups/startup-detail-panel.tsx
src/routes/_authenticated/startups.$id.tsx
```

## Out of scope (per PRD)

Global Investors mirror (P-17b), physical DB separation, API Gateway, Database Router, AI orchestration, auto-sync, PermissionGuard or auth changes.

## Confirm before I build

The C-2 resolution above (dialog always requires explicit Agent + AI Agent selection; default agent prefilled to the caller when eligible). If you want me to instead add `tenant_settings.default_owning_agent_user_id` / `default_owning_ai_agent_id` columns and auto-resolve from there, say so — it's a small additive schema change.
