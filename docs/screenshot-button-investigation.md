# Screenshot Button — Setting & Functionality Investigation

Route: `/startups/new`
Location in UI: Media section of `StartupForm`, below the 3 media slots — a small outline button labeled **Screenshot** with a camera icon.

## Where it lives in code

- `src/components/startups/startup-form.tsx` (~line 388) passes the opt-in prop:
  ```tsx
  <EntityMediaEditor
    value={mediaSlots}
    onChange={setMediaSlots}
    screenshot={{ websiteUrl, entityId: startup?.id ?? null }}
  />
  ```
- `src/components/media/entity-media-editor.tsx` renders the button inside `MediaSlots` (lines ~392–427), gated by `screenshotEnabled = !!screenshot`.
- `src/lib/media/media-capture-adapter.ts` provides the backend boundary
  (`mediaCaptureAdapter.isScreenshotSupported()` /
  `captureWebsiteScreenshot({ websiteUrl, startupId, availableSlots })`).

## Intended functionality

1. User enters a company `websiteUrl` in the form.
2. After the startup is **saved once** (needs a persisted `entityId`), the Screenshot button becomes clickable.
3. On click, `handleCaptureScreenshot` (entity-media-editor.tsx ~line 301):
   - Confirms `websiteUrl` is present, else toasts "Add a website URL first".
   - Confirms `entityId` is present, else toasts "Save the record first, then capture screenshots." (mirrors PitchSnack1 gating).
   - Computes `availableSlots` = the slots that are empty AND not locked (locked slots are protected from being overwritten).
   - Calls `mediaCaptureAdapter.captureWebsiteScreenshot({ websiteUrl, startupId: entityId, availableSlots })`.
   - On success, merges returned `file`/`imagePath` results into the corresponding slots and toasts e.g. "2 screenshots captured".
   - On failure, surfaces `"Screenshot backend is not configured yet."` or the adapter's error message.

## Gating / disabled conditions

The button is `disabled` when any of these are true:

| Condition | Reason |
|---|---|
| `capturing` | Request in flight (shows spinner). |
| `!supportsScreenshot` | `mediaCaptureAdapter.isScreenshotSupported()` returned `false`. |
| `!screenshot.websiteUrl` | No website URL entered on the form. |
| `!screenshot.entityId` | Startup not yet persisted (new-record flow). |

Tooltip text reflects state:
- Supported → "Capture website screenshot into empty slot"
- Not supported → **"Screenshot backend not configured"**

Design constraint (per the media-edit plan): the button never accepts `tenantId`, `databaseId`, `scope`, `includeAll`, or `global`. Only `websiteUrl`, `startupId`, and `availableSlots` cross the adapter boundary — tenant/database scope is resolved server-side from the authenticated session.

## Why the backend is "not configured"

The adapter's Lovable implementation (`src/lib/media/media-capture-adapter.ts`, lines 57–71) is intentionally a stub:

```ts
const lovableAdapter: MediaCaptureAdapter = {
  isScreenshotSupported() {
    return false;
  },
  async captureWebsiteScreenshot(_args) {
    return {
      ok: false,
      error: "not_configured",
      message: "Screenshot backend is not configured.",
    };
  },
};
```

Reasons this is off today:

1. **No `capture-screenshot` edge function exists in SnackPortal2.** The file comment states plainly: *"SnackPortal2 has no `capture-screenshot` edge function today, so screenshot capture is intentionally reported as unsupported."*
2. **Compile-time backend switch defaults to `lovable`.** `MEDIA_CAPTURE_BACKEND` is set to `"lovable"`, so the `lovableAdapter` (stub) is exported as `mediaCaptureAdapter`. The alternative `apiGatewayAdapter` is also a stub (`"API Gateway screenshot backend not implemented."`).
3. **Cloudflare Worker runtime constraints.** Real screenshotting typically needs Puppeteer/Chromium or `sharp` — neither is available in the Lovable Cloud Worker runtime. A future implementation must call an external screenshot API over HTTPS (e.g. a screenshot service or a dedicated worker) rather than spawning a browser locally.
4. **Adapter boundary is the deliverable, wiring is later.** The current task shipped only the *interface* + UI plumbing so the button, gating, slot merging, and toasts already work. Flipping the switch to `api_gateway` — or wiring a real implementation into `lovableAdapter` — is a single-file change with **no UI changes required**.
5. **Runtime side-effect of the stub:** `isScreenshotSupported()` returns `false`, so the button renders in a **permanently disabled** state with the tooltip "Screenshot backend not configured", even when a valid `websiteUrl` and saved `entityId` are present.

## What would need to change to enable it

- Implement a real backend (external screenshot API called from a `createServerFn`, or a new edge function) that accepts `{ websiteUrl, startupId, availableSlots }`, resolves tenant/database from the authenticated session, uploads captures to `startup-media` storage, and returns `CapturedMediaResult[]`.
- In `lovableAdapter` (or `apiGatewayAdapter`), replace the stub bodies so `isScreenshotSupported()` returns `true` and `captureWebsiteScreenshot` calls the new backend.
- No changes required in `EntityMediaEditor`, `StartupForm`, `SnippingCapture`, or `MediaPreviewDialog`.

## Not in scope (deliberately)

- Snip From Screen is unrelated — it uses `navigator.mediaDevices.getDisplayMedia` in the browser and is fully working; it is not gated by the screenshot adapter.
- No `supabase.functions.invoke` is called from any UI component for this flow.
