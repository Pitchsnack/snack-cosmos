/**
 * Media Capture Adapter — the ONLY boundary the UI is allowed to cross for
 * backend-driven media capture (e.g. website screenshots). Keeps UI code free
 * of Supabase/API-Gateway/edge-function coupling so we can swap backends
 * without rewriting the media components.
 *
 * IMPORTANT — access scope:
 *   The adapter interface deliberately does NOT accept tenantId, databaseId,
 *   scope, includeAll, global, or any other access-widening parameter. The
 *   authenticated session + startupId is enough for the backend to resolve
 *   the tenant/database. Widening scope from the UI would violate the
 *   physical multi-database boundary.
 */

export type MediaCaptureBackend = "lovable" | "api_gateway";

/**
 * Compile-time backend switch. Kept as a const so tree-shaking can drop the
 * unused implementation once we commit to one backend at build time.
 */
export const MEDIA_CAPTURE_BACKEND: MediaCaptureBackend = "lovable";

/** Slot number in the 3-slot media grid. */
export type SlotNumber = 1 | 2 | 3;

/**
 * Result the UI knows how to consume.
 *   - `file`      → staged as a pending upload; saved via existing
 *                    startup-media signed-URL flow on form submit.
 *   - `imagePath` → already persisted by the backend into startup-media;
 *                    merged directly into slot state.
 */
export interface CapturedMediaResult {
  slot: SlotNumber;
  file?: File;
  imagePath?: string;
  imageUrl?: string;
  fileSizeBytes?: number;
}

export type CaptureScreenshotArgs = {
  websiteUrl: string;
  startupId: string;
  availableSlots: SlotNumber[];
};

export type CaptureScreenshotResult =
  | { ok: true; results: CapturedMediaResult[] }
  | { ok: false; error: "not_configured" | "no_url" | "no_slots" | "failed"; message?: string };

export interface MediaCaptureAdapter {
  /** True if a real backend screenshot capture is wired. */
  isScreenshotSupported(): boolean;
  captureWebsiteScreenshot(args: CaptureScreenshotArgs): Promise<CaptureScreenshotResult>;
}

/**
 * Lovable adapter — SnackPortal2 has no `capture-screenshot` edge function
 * today, so screenshot capture is intentionally reported as unsupported.
 * The adapter boundary is what this task delivers; a real capture backend
 * will be wired here (or the switch will flip to `api_gateway`) later,
 * without any UI changes.
 */
const lovableAdapter: MediaCaptureAdapter = {
  isScreenshotSupported() {
    return false;
  },
  async captureWebsiteScreenshot(_args) {
    return { ok: false, error: "not_configured", message: "Screenshot backend is not configured." };
  },
};

/**
 * API Gateway adapter — placeholder. Kept so the compile-time switch is
 * real and future backend wiring is a single-file change.
 */
const apiGatewayAdapter: MediaCaptureAdapter = {
  isScreenshotSupported() {
    return false;
  },
  async captureWebsiteScreenshot(_args) {
    return { ok: false, error: "not_configured", message: "API Gateway screenshot backend not implemented." };
  },
};

export const mediaCaptureAdapter: MediaCaptureAdapter =
  MEDIA_CAPTURE_BACKEND === "api_gateway" ? apiGatewayAdapter : lovableAdapter;
