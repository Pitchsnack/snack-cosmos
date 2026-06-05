# Fix: "+ New Startup" does nothing

## Root cause

`src/routes/_authenticated/startups.tsx` is simultaneously:
- the **page** for `/startups` (renders the list), AND
- the **parent** of `startups.new.tsx` and `startups.$id.tsx` (whose URLs `/startups/new` and `/startups/$id` are nested under it).

TanStack Router treats it as the parent layout for those children. A parent layout MUST render `<Outlet />` for child routes to appear on screen. Because `StartupsPage` renders the list UI instead of `<Outlet />`, navigating to `/startups/new` successfully matches the route — but the visible UI stays on the list, so the click looks like "nothing happened".

The same structural bug exists for `investors.tsx` (has `investors.new.tsx` + `investors.$id.tsx`), `deals.tsx` (has `deals.new.tsx` + `deals.$id.tsx`), and `shared-deals.tsx` (has `shared-deals.$id.tsx`).

## Fix (presentation/route layer only — no business logic changes)

For each affected entity, convert the existing `<entity>.tsx` into a thin layout that renders `<Outlet />`, and move its current page body into a new `<entity>.index.tsx` leaf that handles the `/entity` URL.

### Changes

1. **`src/routes/_authenticated/startups.tsx`** — replace contents with a layout:
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/_authenticated/startups")({
     component: () => <Outlet />,
   });
   ```

2. **`src/routes/_authenticated/startups.index.tsx`** (new) — move the existing `StartupsPage` + `StartupsPageInner` body here, registered at `/_authenticated/startups/` with the existing `head()` title.

3. Repeat the same split for:
   - `investors.tsx` → layout + new `investors.index.tsx`
   - `deals.tsx` → layout + new `deals.index.tsx`
   - `shared-deals.tsx` → layout + new `shared-deals.index.tsx`

4. The TanStack Router Vite plugin regenerates `src/routeTree.gen.ts` automatically — no manual edits there.

### Out of scope

- No changes to server functions, permissions, ownership, forms, or data hooks.
- No schema or migration changes.
- No styling changes.

## Verification

- Click **+ New startup** on `/startups` → navigates to `/startups/new` and renders the form.
- Click a row → `/startups/$id` renders the detail page.
- `/startups` still renders the list unchanged.
- Same checks for Investors, Deals, Shared Deals.
