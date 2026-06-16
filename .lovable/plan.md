# Plan — PRD-FLICKER-INVESTIGATION-02 (Investigation Only)

## Scope
Investigation only. No functional code, routes, auth, permissions, workspace, schema, or RLS changes. Single deliverable: `PRD-FLICKER-INVESTIGATION-02-REPORT.md` at project root.

## Findings (already gathered from code read)

### Verdict
The remaining centered "Loading…" message is **page-level data-query loading**, not route pending UI, not `_authenticated.beforeLoad`, not `PermissionGuard`, and not an `/auth/v1/user` call.

### Exact source per page

| Page | File | Line | Branch | Trigger |
|---|---|---|---|---|
| Startups | `src/routes/_authenticated/startups.index.tsx` | 138–139 | `{isLoading ? <div…>Loading…</div> : …}` | `useStartups(...).isLoading` |
| Investors | `src/routes/_authenticated/investors.index.tsx` | 128–129 | same | `useInvestors(...).isLoading` |
| Deals | `src/routes/_authenticated/deals.index.tsx` | 90–91 | same | `useDeals().isLoading` |
| Shared Deals | `src/routes/_authenticated/shared-deals.index.tsx` | 67 | inside `<SharedDealTable isLoading>` | `useSharedDeals().isLoading` |

Root cause: each list hook (`use-startups.ts`, `use-investors.ts`, `use-deals.ts`, `use-shared-deals.ts`) calls `useQuery` with **no `staleTime`** (React Query default = 0) and a **per-page queryKey** with no cache priming. On first navigation to each list, there is no cached data, so `isLoading` is `true` for one render cycle → centered "Loading…" appears for ~200–600 ms while the `createServerFn` RPC resolves.

### What was ruled out
- **Route pending UI**: `_authenticated.tsx` already sets `pendingMs: 0, pendingMinMs: 0` and `PendingShell` renders `<AppSidebar><div/></AppSidebar>` — no centered spinner.
- **`_authenticated.beforeLoad`**: uses `supabase.auth.getSession()` (local-storage, sync), no network, no spinner.
- **`PermissionGuard`** (shows its own `Loader2 + "Loading…"`): governed by `usePermissions().isResolved`, backed by `useSessionContext` with `staleTime: 60_000`. After first sign-in the session-context query is `isSuccess` from cache → guard skips the Loading branch on subsequent navigations. (It would re-appear only on a cold reload or after 60 s of inactivity.)
- **`/auth/v1/user`**: not called on navigation (replaced with `getSession()` in PRD-01 fix).

### State timeline (Investors → Startups, typical)
1. t=0 ms — click Startups link.
2. t≈0 ms — router transitions; `_authenticated` layout stays mounted; `pendingComponent` invisible.
3. t≈5 ms — `StartupsIndex` mounts → `PermissionGuard` resolves from cached session-context → renders children immediately.
4. t≈5 ms — `useStartups({...})` mounts with empty cache → `isLoading=true` → renders centered "Loading…".
5. t≈250–600 ms — server fn returns → `isLoading=false` → list renders.

Investors → Deals: identical pattern, `useDeals()` is the trigger.

### Recommended fix (NOT to be implemented under this PRD)
Eliminate the gap by one of:
1. **Skeleton table rows** in place of the centered text (keep table chrome mounted; show shimmer rows when `isLoading`).
2. **Prefetch on link hover/intent** via `queryClient.prefetchQuery` so cache is warm on navigation.
3. **`placeholderData: keepPreviousData`** + initial empty-array placeholder to keep `isLoading=false`.
4. **Route loader priming** with `ensureQueryData(queryOptions)` (TanStack Query + Router canonical pattern) so the page only mounts once data is ready; combine with router `pendingMs: 0` already in place.
Preferred: option 1 (visual continuity) + option 2 (latency hiding). Avoid option 4 alone because it shifts the latency into the route transition, which the user can still perceive without an in-shell skeleton.

### Risk assessment
- Current behavior is cosmetic only; no data correctness, auth, or permission risk.
- Any fix must preserve `_authenticated` shell mount, `PermissionGuard` semantics, and per-tenant cache scoping (queryKey already encodes search params; do not collapse keys).

### Confirmation
No implementation changes. No temporary logging needed — source identified purely from code inspection cross-checked against runtime behavior described in the PRD.

## Deliverable
Write `PRD-FLICKER-INVESTIGATION-02-REPORT.md` at repo root containing the sections above, formatted per the PRD's required structure (Summary verdict, Exact source, File/component/branch/trigger, State timeline, Network evidence, Component rendering evidence, Recommended fix plan, Risk assessment, Confirmation no implementation performed).

No other files changed.
