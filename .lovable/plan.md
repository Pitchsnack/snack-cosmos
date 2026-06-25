## Root cause (step 1)

Grep of every URL builder for `/startups/$id` and `/startups/$id/edit` shows all of them use the UUID `startup.id`. There is no UI code that constructs the URL from `startup.name`.

Confirmed call sites (all pass `id: <uuid>`):
- `src/components/startups/startup-table.tsx:54` — `<Link to="/startups/$id" params={{ id: s.id }}>`
- `src/components/startups/startup-detail-panel.tsx:78` — `<Link to="/startups/$id/edit" params={{ id }}>` (id is the row UUID)
- `src/components/startups/startup-form.tsx:375,399,733` — `navigate({ to: "/startups/$id", params: { id: <uuid> } })`
- `src/routes/_authenticated/startups.$id.tsx:111` — edit button navigates with `{ id }` (UUID from `Route.useParams()`)
- `src/routes/_authenticated/startups.$id.edit.tsx:20` — back link uses `{ id }` (route param passthrough)
- `src/routes/_authenticated/deals.$id.tsx:77` — `params={{ id: d.startups.id }}`
- `src/components/investors/investor-detail-panel.tsx:113` — uses startup `id`

**Conclusion:** No UI path produces `/startups/<name>/edit`. The reported URL `/startups/Startup name test/edit` was hand-typed/pasted. The remaining issue is purely a missing route-boundary guard — currently the page fires `useStartup("Startup name test")`, the server function rejects/returns nothing, and the user sees a blank/`Loading…`/error string with no recovery.

## Fix (step 2) — add guards at both route boundaries

Add a tiny shared helper and a friendly "not found" UI block, then short-circuit before calling `useStartup` when the param isn't a UUID.

### 1. New helper: `src/lib/uuid.ts`

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | undefined | null): v is string =>
  !!v && UUID_RE.test(v);
```

### 2. New component: `src/components/startups/startup-not-found.tsx`

Presentational only. Renders an `ArrowLeft` back link to `/startups` and a card with:
- Title: "Invalid link" (when `reason="invalid"`) or "Startup not found" (when `reason="missing"`)
- Body copy explaining the URL doesn't point to a valid startup / the startup may have been removed or isn't accessible in this tenant.
- A "Back to startups" button (`<Link to="/startups">`).

Props: `{ reason: "invalid" | "missing" }`.

### 3. `src/routes/_authenticated/startups.$id.edit.tsx`

- Read `id` from `Route.useParams()`.
- If `!isUuid(id)` → render `<StartupNotFound reason="invalid" />` inside the existing `PermissionGuard`, and **return early before calling `useStartup`**.
- Otherwise call `useStartup(id)` as today. When the query resolves with no data (or returns the standard not-found error), render `<StartupNotFound reason="missing" />` instead of the current red error text.
- Keep `isLoading` skeleton/text as-is.

### 4. `src/routes/_authenticated/startups.$id.tsx`

Same guard at the top of `StartupDetailPage`:
- If `!isUuid(id)` → return `<StartupNotFound reason="invalid" />` and skip `useStartup` and all mutation hooks setup that depends on the id being valid (mutation hook declarations are fine to keep above the guard since they don't fire on mount; we just `return` early before rendering).
- Replace the current `if (error || !data) return <div className="text-sm text-destructive">Failed to load…</div>` with `<StartupNotFound reason="missing" />`.

### What we do NOT do (step 3)
- No name-based lookup fallback. Names aren't unique across tenants, aren't stable, and would create ambiguous/cross-tenant resolution. Records remain UUID-addressed. A future human-readable URL would be a separate deliberate `slug` column feature.
- No changes to `useStartup`, server functions, RLS, permissions, or any data layer.
- No new route, no redirect logic, no router-level `parseParams` (kept inside the component to avoid touching the route tree).

## Acceptance mapping
- ✅ Grep proof above shows every URL builder uses `startup.id`.
- ✅ Non-UUID param → `StartupNotFound reason="invalid"` rendered; `useStartup` is never called (guarded with early return before the hook).
- ✅ Valid UUID that doesn't resolve → `StartupNotFound reason="missing"` with "Back to startups" link.
- ✅ Both `/startups/$id` and `/startups/$id/edit` covered.
- ✅ No name-based lookup added.

## Files touched
- `src/lib/uuid.ts` (new)
- `src/components/startups/startup-not-found.tsx` (new)
- `src/routes/_authenticated/startups.$id.tsx` (guard + replace error block)
- `src/routes/_authenticated/startups.$id.edit.tsx` (guard + replace error block)

## Verification
After edits: typecheck passes, then load `/startups/Startup%20name%20test/edit` and `/startups/Startup%20name%20test` in the preview — both render the "Invalid link" card with a back link, and network panel shows no `getStartup` server-function call. Then load a valid UUID URL to confirm the normal edit form still renders.
