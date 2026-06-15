
# Run PRD — Fix Sidebar Navigation Flicker

Scoped exactly as the PRD requires. Only 3 files touched, no schema/RLS/auth/architecture changes.

## Fix 1 — `src/routes/_authenticated.tsx`

- Swap `supabase.auth.getUser()` (network → `/auth/v1/user`) for `supabase.auth.getSession()` (local storage, sync).
- Guard becomes: `if (error || !data.session) redirect to /login`.
- Server-side `requireSupabaseAuth` middleware still validates JWTs on every server function call — no security loss.

## Fix 3 — same file: stable pending shell

- Add `pendingMs: 0`, `pendingMinMs: 0`, and a `pendingComponent` that renders `<AppSidebar><div /></AppSidebar>`, so the shell stays mounted during any route transition.

Resulting file:

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: PendingShell,
});

function AuthenticatedLayout() {
  return (<AppSidebar><Outlet /></AppSidebar>);
}
function PendingShell() {
  return (<AppSidebar><div /></AppSidebar>);
}
```

## Fix 2 — `src/components/app-sidebar.tsx`

In `SidebarBody`, use `isResolved` from `usePermissions()` and the cached `useSessionContext().data` to decide what to render:

- **Resolved (success or error)** → real permission-filtered nav (current behavior).
- **Unresolved but cached `data` exists** (refetch in flight) → keep the real filtered nav from the cached data — do not collapse.
- **Unresolved and no cached data** → render every `NAV_ITEMS` row as a muted, non-clickable skeleton (`<div>` with `opacity-50 pointer-events-none`, same icon + label), preserving sidebar height/spacing.

Implementation sketch:

```ts
const { has, isControl, isResolved } = usePermissions();
const { data: sessionData } = useSessionContext();
const showSkeleton = !isResolved && !sessionData;

const visibleItems = showSkeleton
  ? NAV_ITEMS                           // full list, rendered as skeleton below
  : NAV_ITEMS.filter((item) => {
      if (item.controlOnly) return isControl;
      if (!item.perm) return true;
      return has(item.perm);
    });
```

Skeleton rows reuse the existing `disabled`-style markup path (non-clickable `<div>`) so no unauthorized item ever becomes clickable. Once `isResolved` flips, the real filtered list replaces the skeleton without changing layout.

## Fix 4 — `src/router.tsx`

- `defaultPreloadStaleTime: 0` → `defaultPreloadStaleTime: 30_000`.

## Files changed (exactly 3)

- `src/routes/_authenticated.tsx`
- `src/components/app-sidebar.tsx`
- `src/router.tsx`

## What is NOT touched

Providers, route tree, DB, RLS, tenant/workspace logic, server auth, permission semantics, `placeholderData` on permission queries, `WorkspaceHeader`, `PermissionGuard`.

## Verification after build

1. Playwright: log in (using preset Supabase session env), navigate `/deals → /investors → /startups → /shared-deals`, capture network log and screenshots mid-transition. Assert:
   - No `/auth/v1/user` request fires during sidebar clicks.
   - Sidebar `<aside>` stays in the DOM across every transition.
   - Nav item count never drops below the role's full set; header badge never reads `— / — TENANT`.
2. Build passes (TS strict).
