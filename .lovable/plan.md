## Decision recorded
- **Backend:** Option A — separate PRD will extend `switchWorkspace` for MASTER_AGENT authorization and physical-tenant-database readiness. Out of scope here.
- **This task:** frontend UX/UI preview only. Production cutover blocked until Option A merges and is independently verified.
- **Activation:** `VITE_WORKSPACE_ENFORCEMENT=true` in the Lovable **preview** `.env` only. Production `.env` MUST keep it OFF (or omit it) — flipping ON in production requires env change + rebuild + redeploy AND Option A merged.
- **Preview fixtures:** when the enforcement flag is ON and both the session tenant list AND `listAssignableTenants` come back empty, each of the 4 authorized files renders an inline, non-persistent fixture tenant list (id prefix `fixture-preview-`) so CONTROL principals can exercise the mismatch/switch/disabled UX. Fixtures never call `switchWorkspace`, never write session or `localStorage`, never select a physical database, never persist, never submit a create mutation (existing `tenantMatchesActive` gate already blocks). Inline switch button is disabled with a "Preview fixture — activation disabled (no backend call)" notice. Fixtures are visually tagged `PREVIEW FIXTURE` in both switcher and form dropdowns.
- **Activation:** `VITE_WORKSPACE_ENFORCEMENT` env flag stays OFF in production. Flipping ON requires env change + rebuild + redeploy.

## Scope — 4 authorized files only
1. `src/components/workspace-switcher.tsx`
2. `src/components/investors/investor-form.tsx`
3. `src/components/startups/startup-form.tsx`
4. `src/components/deals/deal-form.tsx`

No 5th file. No shared helper module. Flag read independently in each file:
```ts
const WORKSPACE_ENFORCEMENT_ENABLED =
  import.meta.env.VITE_WORKSPACE_ENFORCEMENT === "true";
```

## Flag-OFF behavior (preserved exactly)
- **Switcher:** current `session.tenants`-only list; no `listAssignableTenants` query fires.
- **Investor:** existing `tenantMatchesActive` gate and banner remain unchanged — safeguards not weakened, no inline switch button rendered.
- **Startup / Deal:** current behavior identical to today — existing query keys, no gate, no banner, no ownership-clear effect.

## Flag-ON behavior

### Shared standardized rule (all 3 create forms)
- `tenantMatchesActive = Boolean(activeTenantId) && Boolean(selectedTenantId) && activeTenantId === selectedTenantId`
- Tenant dropdown source = merged (`session.tenants` ∪ `listAssignableTenants`), de-duplicated by tenant id, sorted by `tenantName` case-insensitive. Authorized-choice list only — not authorization, membership, routing, or physical-DB selection.
- Preselect in create mode only, only when `activeTenantId` is in the merged list, only when no deliberate selection. Never silently pick `tenants[0]`. Never overwrite a deliberate selection on refetch.
- On mismatch: amber banner + inline **Switch to this tenant** button; disable tenant-dependent queries; hide stale options; clear tenant-dependent selections in create mode only (edit mode preserved); `canSubmit = false`; block mutation.
- `mutationFn` accepts explicit `{ selectedTenantId, activeTenantId }` and re-checks equality defensively before create.

### Inline **Switch to this tenant**
- Calls only existing `switchWorkspace` server fn with `{ tenantId: selectedTenantId, workspaceType: "TENANT" }`.
- Pending label: `Switching workspace…`. Save stays disabled during and after.
- On success: invalidate exactly `["session-context"]` and `["assignable-tenants", session.user.id]`; await refetch. No local session mutation. Save re-enables only after refreshed session confirms `tenantMatchesActive === true`.
- On failure: banner remains, Save stays disabled, mapped error shown.

### Error mapping (no raw server errors)
```
lower.includes("forbidden") || lower.includes("not a member") || lower.includes("access")
  → "You do not have access to this tenant workspace."
lower.includes("not ready") || lower.includes("provision") || lower.includes("readiness")
  → "This tenant workspace is still being prepared."
otherwise
  → "Unable to switch workspace. Please try again."
```

### Workspace Switcher (flag ON)
Adds principal-scoped `["assignable-tenants", session.user.id]` query calling existing `listAssignableTenants`; merges with `session.tenants`; renders one "Workspaces" group so CONTROL / MASTER-AGENT principals without `user_tenants` rows see selectable tenants. `pick()` unchanged — still calls existing `switchWorkspace`.

## Per-file changes
- **`workspace-switcher.tsx`** — full rewrite with flag, `useHasSession`, `useQuery`, `useServerFn(listAssignableTenants)`, conditional merged list. `pick()` unchanged.
- **`investor-form.tsx`** — surgical. Add flag constant, `useState` for switch pending/error, `useServerFn(switchWorkspace)`. Existing OFF-path banner preserved verbatim; extend banner block to render inline switch + mapped error only when flag ON.
- **`startup-form.tsx`** — surgical. Add flag, switch pending/error state, `switchWorkspace`. Query key becomes `WORKSPACE_ENFORCEMENT_ENABLED ? ["assignable-tenants", session?.user?.id ?? null] : ["assignable-tenants"]`. Compute `mergedTenants`, `activeTenantId`, `tenantMatchesActive`. Gate `humansQ`/`aisQ` enabled + hide stale options + add ownership-clear effect + banner + inline switch — all only when flag ON. `canSubmit` gains `(!WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive)` clause. `createM.mutationFn` accepts `{ selectedTenantId, activeTenantId }` and re-checks equality when flag ON.
- **`deal-form.tsx`** — surgical. Same pattern applied to `deal-startups`, `deal-investors`, `assignable-humans`, `assignable-ai`. Add `listAssignableTenants` query (flag-gated), merged list, active/match state, banner + inline switch (flag ON), ownership + startup + investor clear effect (flag ON, create mode), `canSubmit` gains match clause when flag ON, `mutationFn` accepts explicit ids + defensive re-check when flag ON.

## Known preview-only limitations
- **MASTER_AGENT-only principal:** current `switchWorkspace` rejects. UI shows mapped "You do not have access to this tenant workspace." Save stays disabled. Resolved by Option A.
- **Non-ready tenant physical DB:** current backend does not verify readiness. Switch appears to succeed; downstream ops may fail. Classified as **known preview-only backend contract gap**, not a fail-closed production result. Not a PASS. Flag must not flip in production until backend readiness contract is implemented and verified.

## Architecture safeguards preserved
Physical Control DB + independent Physical Tenant DBs untouched. One Request → One Active Tenant → One Database untouched. No migrations, schema, RLS, membership rows, direct Supabase calls, auth listeners, API Gateway, or Database Router changes. No frontend role authorization. No frontend readiness assumption. No physical-database selection. No routing hints derived from dropdown state.

## Verification (preview, evidence to `/mnt/documents/`)
1. `rg` output confirming no new `supabase.*` imports, no new server fns, no new migration files.
2. Investor / Startup / Deal — CONTROL, MASTER_AGENT, normal tenant-member scenarios with flag ON.
3. Inline switch — loading, success, mapped-failure evidence.
4. Edit-mode value preservation on all three entities.
5. Flag-OFF re-run confirming all three forms and switcher behave exactly as before.
6. Explicit note: MASTER_AGENT-only and non-ready-tenant paths are known contract gaps.

## Completion classification
Only acceptable success verdict:
```
UX/UI STANDARDIZATION COMPLETE
PREVIEW FLAG VERIFIED
PRODUCTION CUTOVER BLOCKED PENDING OPTION A
```
