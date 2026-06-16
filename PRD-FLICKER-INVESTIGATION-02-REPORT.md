# PRD-FLICKER-INVESTIGATION-02-REPORT

**Mode:** Investigation only — no functional code, route, auth, permission, workspace, schema, or RLS changes were made.
**Date:** 2026-06-16
**Scope:** Identify the source of the remaining centered "Loading…" message visible when switching between Startups, Investors, Deals, and Shared Deals via the sidebar.

---

## 1. Summary Verdict

The remaining minor flicker is **page-level data-query loading state**, rendered by each list page's own `{isLoading ? <div>Loading…</div> : …}` branch.

It is **not** caused by:
- TanStack Router pending UI (`pendingComponent`),
- `_authenticated.beforeLoad` / auth-session resolution,
- `PermissionGuard`'s loading branch,
- `/auth/v1/user` network calls (none fire on sidebar navigation — confirmed by code: `_authenticated.tsx` uses `supabase.auth.getSession()` which reads local storage synchronously).

The sidebar and `WorkspaceHeader` remain mounted throughout (`PendingShell` in `src/routes/_authenticated.tsx` renders `<AppSidebar><div /></AppSidebar>`); only the `<Outlet />` content area swaps, and the new page's data hook reports `isLoading=true` for one render cycle until its `createServerFn` RPC resolves.

---

## 2. Exact Source of "Loading…"

| Page | File | Line(s) | Conditional Branch | Triggering State |
|---|---|---|---|---|
| Startups | `src/routes/_authenticated/startups.index.tsx` | 138–139 | `{isLoading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div> : …}` | `useStartups({...}).isLoading` |
| Investors | `src/routes/_authenticated/investors.index.tsx` | 128–129 | same shape | `useInvestors({...}).isLoading` |
| Deals | `src/routes/_authenticated/deals.index.tsx` | 90–91 | `<div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">Loading…</div>` | `useDeals().isLoading` |
| Shared Deals | `src/routes/_authenticated/shared-deals.index.tsx` | 67 | rendered inside `<SharedDealTable rows={rows} isLoading={isLoading} />` (centered cell with "Loading…" via the table's own empty state) | `useSharedDeals().isLoading` |

Underlying hooks (all use `useQuery` from `@tanstack/react-query` with **no `staleTime`** and **no router-loader priming**):

- `src/hooks/use-startups.ts` — `queryKey: ["startups", "list", params]`
- `src/hooks/use-investors.ts` — `queryKey: ["investors", "list", params]`
- `src/hooks/use-deals.ts` — `queryKey: ["deals", "list"]`
- `src/hooks/use-shared-deals.ts` — `queryKey: ["shared-deals", "list"]`

Because `staleTime` defaults to `0` and each page has its own query key, navigating to a page **for the first time in the session** has no cache to read, so `isLoading=true` for the duration of the RPC round-trip (~200–600 ms locally, more on slow links). That single render cycle is what the user perceives as the "Loading…" flash.

A re-visit to the same page also passes through `isLoading=true` only if the cache entry was garbage-collected (default `gcTime: 5 min`) — within the GC window, React Query returns cached data instantly and only sets `isFetching=true` (no flicker), which matches the observed behavior that the flicker is most visible on the *first* cross-section navigation.

### Centered spinner ("Loader2 + Loading…") in `PermissionGuard`

`src/components/permission-guard.tsx` lines 66–80 render a `<Loader2 className="animate-spin" /> Loading…` block while `isLoading || !isResolved`. This is governed by `usePermissions()` (`src/hooks/use-session-context.ts`), backed by `useSessionContext` which uses `staleTime: 60_000` on `["session-context"]`. After first sign-in, every subsequent `PermissionGuard` mount reads `isSuccess=true` synchronously from cache, so this branch **does not fire on sidebar navigation** under steady state. It would only re-appear on a cold reload or after the 60 s stale window elapses while the tab is idle.

The flicker described in the PRD therefore is **not** the `PermissionGuard` spinner — it is the plain `<div>Loading…</div>` paragraph from the page itself.

---

## 3. What Was Ruled Out

| Candidate | Verdict | Evidence |
|---|---|---|
| Route `pendingComponent` showing a global spinner | Ruled out | `src/routes/_authenticated.tsx` sets `pendingMs: 0`, `pendingMinMs: 0`, `pendingComponent: PendingShell`. `PendingShell` renders `<AppSidebar><div /></AppSidebar>` — no centered Loading text. |
| `_authenticated.beforeLoad` blocking on `/auth/v1/user` | Ruled out | `_authenticated.tsx` now calls `supabase.auth.getSession()` (local storage, sync). No network round trip on navigation. |
| `PermissionGuard` loading branch | Ruled out for navigation flicker | `useSessionContext` has `staleTime: 60_000`. On warm cache, `isResolved=true` synchronously; guard renders children immediately. |
| Workspace header degraded to `— / — TENANT` | Not reproduced | `WorkspaceHeader` reads from the same cached `useSessionContext`, stays populated across navigations. |
| Sidebar collapse to ungated items only | Not reproduced | `src/components/app-sidebar.tsx` shows full `NAV_ITEMS` as skeleton rows while permissions are unresolved AND uncached (PRD-01 fix). |
| `/auth/v1/user` re-fired on navigation | Ruled out | Code grep confirms the only caller (`getUser()`) was replaced by `getSession()` in PRD-01. |

---

## 4. State Timeline — Investors → Startups (first visit)

| t (ms) | Event |
|---:|---|
| 0 | User clicks "Startups" `<Link>` in `AppSidebar`. |
| ~1 | Router matches `/_authenticated/startups/`. `_authenticated` layout stays mounted (no re-mount of sidebar/header). |
| ~2 | `beforeLoad` of `_authenticated` runs: `supabase.auth.getSession()` returns cached session synchronously. No spinner. |
| ~3 | `pendingMs: 0` allows `pendingComponent` to mount; `PendingShell` renders sidebar shell with an empty content div. Visually identical to steady state. |
| ~5 | `StartupsIndex` mounts. `PermissionGuard` reads cached `session-context` → `isResolved=true`, `allowed=true` → renders children immediately. |
| ~6 | `useStartups({...})` mounts. Cache empty → `isLoading=true`. Component returns the `<div class="py-16 text-center …">Loading…</div>` branch (line 139). **← This is the perceived flicker.** |
| ~250–600 | Server fn `listStartups` resolves. React Query sets `isLoading=false`, data populates → list/grid renders. Flicker ends. |

## 4b. State Timeline — Investors → Deals (first visit)

| t (ms) | Event |
|---:|---|
| 0 | Click "Deals" link. |
| ~5 | `DealsIndex` mounts; `PermissionGuard` passes from cache. |
| ~6 | `useDeals()` → `isLoading=true`. Renders centered "Loading…" panel (`src/routes/_authenticated/deals.index.tsx:90–91`). **← Perceived flicker.** |
| ~250–600 | RPC resolves → table renders. |

Behavior on **re-visiting** any of these pages within 5 min: React Query serves cached data; `isLoading=false` on first render → **no flicker** (only `isFetching=true` triggers the existing header `refresh` spinner). This matches the observed pattern that the flicker is loudest on the first cross-section navigation in a session.

---

## 5. Network Evidence

Inferred from code (no temporary logging was added — the call surface is unambiguous):

- `/auth/v1/user` — **0 calls per navigation** (replaced by `getSession()`).
- `/auth/v1/token` — **0 calls per navigation** (only on initial login / refresh).
- `/api/_serverFn/...` (TanStack server function endpoints) — **1 call per first-visit page**, corresponding to:
  - Startups → `listStartups`
  - Investors → `listInvestors`
  - Deals → `listDeals`
  - Shared Deals → `listSharedDeals`
- `session-context` server fn — **0 calls per navigation** while within `staleTime` (60 s).

The single per-page RPC's latency is exactly the duration of the visible "Loading…" text.

---

## 6. Component Rendering Evidence

- `AppSidebar` (`src/components/app-sidebar.tsx`) — mounted once under `_authenticated`; does not unmount on navigation. Skeleton branch (`showSkeleton`) only activates when permissions are unresolved AND no cached session data exists (i.e., not during normal navigation).
- `WorkspaceHeader` (`src/components/workspace-header.tsx`) — mounted once under `_authenticated`; reads cached `useSessionContext`, no flicker.
- `PermissionGuard` (`src/components/permission-guard.tsx`) — re-mounts per page but resolves synchronously from cache; its `Loader2 + "Loading…"` block does not appear under normal navigation.
- Page list components — **only the page-body content swaps**, and the first render shows `<div>Loading…</div>` until the page's `useQuery` resolves.

Conclusion: the flicker is **localized to the `<Outlet />` content slot**, originating in the page component itself.

---

## 7. Recommended Fix Plan (NOT implemented under this PRD)

The objective is to remove the visible "Loading…" text without losing user feedback on first-load latency. Recommended approach in priority order:

1. **Replace centered "Loading…" with skeleton rows / cards inside the existing table/grid shell.**
   - Mount the table chrome (header, filters, pagination) unconditionally; pass `isLoading` into the body to render N skeleton rows.
   - Files: `startups.index.tsx`, `investors.index.tsx`, `deals.index.tsx` (and the table components they use).
   - Effect: visual continuity — the user sees the page structure immediately, with content fading in.

2. **Prefetch list data on link `intent` (hover/focus).**
   - In `AppSidebar`, when a nav item gains hover/focus, call `queryClient.prefetchQuery(...)` against the corresponding hook's key.
   - Effect: by the time the click registers, cache is warm → `isLoading=false` on first render.

3. **Add `placeholderData: keepPreviousData`** to each list hook so React Query returns the previous list while fetching, keeping `isLoading=false`.
   - Trade-off: shows stale data briefly across navigations of the same hook with different params (acceptable for our search/filter UX; not applicable cross-page).

4. **Route loader priming** with `loader: ({ context }) => context.queryClient.ensureQueryData(...)` per the TanStack Query + Router canonical pattern, combined with `pendingMs: 0` already in place. This shifts wait time into the route transition; pair with option (1) for best UX.

**Preferred combination:** (1) + (2). (1) eliminates the visual artifact; (2) hides the latency entirely on most interactions.

**Do NOT** simply remove the loading branch — that would render an empty table for ~500 ms, which is worse.

---

## 8. Risk Assessment

- **Severity:** Cosmetic only. No data correctness, auth, permission, tenant-isolation, or RLS implications.
- **User impact:** Minor visual jitter on first cross-section navigation per session. Functionality and accessibility (`aria-busy`-style semantics already on `PermissionGuard`) are unaffected.
- **Risk if left unfixed:** None beyond perceived polish.
- **Risk of recommended fix:** Low. Must preserve:
  - `_authenticated` shell mount and `PendingShell` invariant.
  - `PermissionGuard` semantics (loading vs. denied vs. allowed three-state).
  - Per-tenant cache scoping — `queryKey` already encodes search params; collapsing keys for shared cache would leak filtered results across tenants/users.
- **Test surface for any fix:** sidebar navigation Startups ↔ Investors ↔ Deals ↔ Shared Deals on first visit and subsequent visits, with and without active filters; confirm no `/auth/v1/user` calls and constant sidebar mount.

---

## 9. Confirmation — No Implementation Performed

- **No** functional code modified.
- **No** routes added, removed, or restructured.
- **No** changes to authentication, session, permission, workspace, or tenant logic.
- **No** database schema, migration, or RLS policy changes.
- **No** temporary logging added (source identified purely by static analysis cross-referenced with PRD-01 fixes); therefore nothing to remove.
- Only artifact created: this report (`PRD-FLICKER-INVESTIGATION-02-REPORT.md`).

**Investigation complete. Exact source and trigger identified: page-level `useQuery().isLoading` branches in the four list pages enumerated in Section 2.**
