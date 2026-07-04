## Add Snip From Screen (and Preview) to Logo

Bring the Logo slot up to parity with the media slots for capture UX. Scope is strictly the `LogoSlot` sub-component inside `src/components/media/entity-media-editor.tsx` — no backend, no adapter, no state-model changes.

### Changes

**File:** `src/components/media/entity-media-editor.tsx` — `LogoSlot` only

1. Detect snip support the same way `MediaSlots` does:
   `typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia`.
2. Local state in `LogoSlot`: `snipOpen: boolean`, `previewUrl: string | null`.
3. Hover overlay on the existing logo preview (replaces the single Upload icon):
   - Preview (ZoomIn) → opens `MediaPreviewDialog`
   - Replace (Upload) → triggers the existing file input
   - Snip (Crop) → opens `SnippingCapture` (only rendered when supported)
   - Remove (X) — keep existing corner button OR fold into overlay; keep existing corner X for consistency with current behavior.
4. Empty state: add a small Snip affordance next to "Drop or click" when supported, so the user can snip without uploading first. Clicking it opens `SnippingCapture`; clicking the tile itself still opens the file picker.
5. Render `<SnippingCapture>` with `outputName="logo"` and, on capture, run the file through the existing `pick(file)` (which already calls `validateImageFile` and sets `pendingFile`).
6. Render `<MediaPreviewDialog url={previewUrl} onClose={...} />`.

### Out of scope

- No changes to `SnippingCapture`, `MediaPreviewDialog`, `mediaCaptureAdapter`, `EntityMediaState`, or any parent form.
- No Screenshot button on Logo — Screenshot is website-wide and stays slot-only.
- No lock toggle on Logo.
- No changes to persistence, upload flow, validation rules, or file naming conventions.

### Verification

- Preview at `/startups/new`: Logo empty state shows an extra Snip affordance when the browser supports `getDisplayMedia`; hovering an uploaded logo reveals Preview / Replace / Snip.
- Snip flow produces a WebP `File`, gets validated, and shows as pending logo preview.
- Investor form (which also uses `EntityMediaEditor`) still compiles and renders — Logo overlay behaves identically there (Snip visible when supported; no Screenshot).
- Typecheck passes; no new imports beyond icons already used.