## Goal

Implement a real website-screenshot backend behind `mediaCaptureAdapter.captureWebsiteScreenshot(...)` so the Screenshot button on `/startups/new` (and future entity forms) actually works — without changing the UI's contract with the adapter and without leaking tenant/database scope through the UI.

Also soften the user-facing messaging where the backend is disabled.

## Non-goals (explicit guardrails)

- No `supabase.functions.invoke` calls from `entity-media-editor.tsx`, `startup-form.tsx`, or any other media UI component.
- No new tables. No PitchSnack1-style `startup_files`, `startup-product-images`, or `startup_product_images`.
- Reuse the existing SnackPortal2 model only: `startup-media` bucket + `startup_media` table + `startups.logo_url`.
- No new `tenantId` / `databaseId` / `scope` / `includeAll` parameters on the adapter interface.
- No UI changes beyond the two messaging strings called out below.

## Architecture

Keep the boundary already in place:

```text
EntityMediaEditor (UI)
        │  only ever calls:
        ▼
mediaCaptureAdapter.captureWebsiteScreenshot({ websiteUrl, startupId, availableSlots })
        │
        ├── lovable branch   → TanStack server fn  captureStartupScreenshot   (this task)
        └── api_gateway branch → future HTTPS call to API Gateway              (unchanged stub)
```

The `MEDIA_CAPTURE_BACKEND` compile-time switch stays. Only the `lovableAdapter` branch gets a real implementation. Flipping to `api_gateway` later remains a single-file change with no UI edits.

## Backend design

### 1. Server function (new file — kept out of `src/server/*`)

`src/lib/media/media-capture.functions.ts`

- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
- Input (Zod-validated): `{ websiteUrl: string.url(), startupId: uuid, availableSlots: array of 1|2|3 (1..3 items, unique) }`.
- Handler:
  1. Load the startup row via the authenticated `context.supabase` (RLS enforces access; if it returns nothing → throw "Forbidden or not found"). This is how tenant/database scope is derived — never from the UI.
  2. Read `tenant_id` from that row; UI-supplied tenant is impossible by construction.
  3. Call an external screenshot HTTPS API (see "Screenshot provider" below). One call per slot in `availableSlots`, capped at the number of empty slots. Concurrency limit 3.
  4. For each returned PNG:
     - Path: `<tenant_id>/<startup_id>/screenshot-<timestamp>-<slot>.png`.
     - Upload via `context.supabase.storage.from("startup-media").upload(...)` (RLS-scoped).
     - Insert a `startup_media` row (`startup_id`, `tenant_id`, `slot`, `storage_path`, `file_size_bytes`, `source: "screenshot"`, `created_by = userId`). Fields will be matched to the existing `startup_media` schema during implementation — no new columns.
     - Return `{ slot, imagePath, imageUrl (signed, 1h), fileSizeBytes }`.
  5. On provider failure return a typed error the adapter can surface (`{ ok: false, error: "failed", message }`).

No use of `supabaseAdmin` — the handler runs as the authenticated user so RLS remains the source of truth for tenant scope.

### 2. Adapter wiring (existing file)

`src/lib/media/media-capture-adapter.ts` — update `lovableAdapter` only:

- `isScreenshotSupported()` → `true` when `MEDIA_CAPTURE_BACKEND === "lovable"` and the server fn module is present (compile-time true).
- `captureWebsiteScreenshot(args)` → `await captureStartupScreenshot({ data: args })`; map thrown errors to `{ ok: false, error: "failed", message }` and typed provider responses to `{ ok: true, results }`.
- `apiGatewayAdapter` stays a stub. `MEDIA_CAPTURE_BACKEND` default stays `"lovable"`.

### 3. Screenshot provider

External HTTPS screenshot API (Puppeteer/Chromium is not available in the Cloudflare Worker runtime). Provider selection is deferred — see Open questions. Whichever provider is chosen:

- API key read via `process.env.SCREENSHOT_API_KEY` **inside** the `.handler()` body (never at module scope).
- Added as a Lovable Cloud secret (`add_secret`) before switching the adapter on.
- Response normalized to PNG bytes + width/height; the handler owns storage/DB writes.

## UI changes (messaging only)

Two string updates in `src/components/media/entity-media-editor.tsx`:

1. Tooltip when disabled: replace `"Screenshot backend not configured"` with:
   > "Website screenshot capture is not enabled yet. You can upload an image or use Snip from screen."
2. Toast on `not_configured` error: replace `"Screenshot backend is not configured yet."` with the same string.

No other UI edits. Gating (`!supportsScreenshot`, `!websiteUrl`, `!entityId`, `capturing`) is unchanged.

## Files touched

- **new** `src/lib/media/media-capture.functions.ts` — server fn + Zod validator.
- **edit** `src/lib/media/media-capture-adapter.ts` — real `lovableAdapter` body.
- **edit** `src/components/media/entity-media-editor.tsx` — two message strings only.
- **secret** `SCREENSHOT_API_KEY` (added via `add_secret` at implementation time).
- **no migrations, no new buckets, no new tables.**

## Verification

- Typecheck passes.
- On `/startups/new`, before saving: Screenshot button stays disabled (no `entityId`), tooltip shows the new soft message.
- On `/startups/{id}/edit` with a website URL: click Screenshot → server fn runs as the signed-in user → RLS confirms access to `startupId` → 1–3 slots populate with signed URLs → `startup_media` rows appear scoped to the startup's `tenant_id`.
- Attempting the server fn with a `startupId` the caller cannot access returns "Forbidden or not found" (RLS-driven), not a tenant leak.
- Flipping `MEDIA_CAPTURE_BACKEND` to `"api_gateway"` compiles and produces the existing stub error — no UI changes needed.

## Open questions

1. **Screenshot provider** — options are e.g. urlbox.io, ApiFlash, ScreenshotOne, or a Browserless HTTPS endpoint. Do you have a preferred provider / existing account, or should I pick one (I'd default to ScreenshotOne for simplicity + generous free tier) and add `SCREENSHOT_API_KEY` as a secret?
2. **Slots per capture** — capture one screenshot per available slot (up to 3, e.g. homepage + `/about` + `/pricing` heuristics), or always exactly one homepage screenshot into the first empty slot? PitchSnack1 gating language suggests multi-slot; confirm which you want.
