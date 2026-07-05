/**
 * Media Capture Adapter — the ONLY boundary the UI is allowed to cross for
 * backend-driven media capture (e.g. website screenshots). Keeps UI code free
 * of Supabase / edge-function / provider coupling so the backend can swap
 * without rewriting the media components.
 *
 * IMPORTANT — access scope:
 *   The adapter interface deliberately does NOT accept startupId, tenantId,
 *   databaseId, scope, includeAll, or global. The backend derives all scope
 *   from the authenticated session. Widening scope from the UI would violate
 *   the physical multi-database boundary.
 *
 * IMPORTANT — persistence:
 *   captureWebsiteScreenshot returns a File only. The UI stages it as a
 *   pendingFile in EntityMediaEditor exactly like file upload and Snip. No
 *   storage write and no startup_media row exist until the user clicks Save.
 */

import { captureWebsiteScreenshot as captureWebsiteScreenshotFn } from "./media-capture.functions";

export type MediaCaptureBackend = "lovable" | "api_gateway";

/**
 * Compile-time backend switch. Kept as a const so tree-shaking can drop the
 * unused implementation once we commit to one backend at build time.
 */
export const MEDIA_CAPTURE_BACKEND: MediaCaptureBackend = "lovable";

/** Slot number in the 3-slot media grid. */
export type SlotNumber = 1 | 2 | 3;

/** Result the UI knows how to consume — a staged File targeted at one slot. */
export interface CapturedMediaResult {
  slot: SlotNumber;
  file: File;
  fileSizeBytes: number;
}

export type CaptureScreenshotArgs = {
  websiteUrl: string;
  availableSlots: SlotNumber[];
};

export type CaptureScreenshotResult =
  | { ok: true; results: CapturedMediaResult[] }
  | {
      ok: false;
      error: "not_configured" | "no_url" | "no_slots" | "invalid_url" | "too_large" | "timeout" | "failed";
      message?: string;
    };

export interface MediaCaptureAdapter {
  /** True if a real backend screenshot capture is wired for this build. */
  isScreenshotSupported(): boolean;
  captureWebsiteScreenshot(args: CaptureScreenshotArgs): Promise<CaptureScreenshotResult>;
}

/* -------------------------------------------------------------------------- */
/*  Lovable adapter — calls the internal createServerFn.                      */
/* -------------------------------------------------------------------------- */

const lovableAdapter: MediaCaptureAdapter = {
  isScreenshotSupported() {
    return true;
  },
  async captureWebsiteScreenshot({ websiteUrl, availableSlots }) {
    if (!websiteUrl?.trim()) {
      return { ok: false, error: "no_url" };
    }
    if (!availableSlots.length) {
      return { ok: false, error: "no_slots" };
    }

    let res: Awaited<ReturnType<typeof captureWebsiteScreenshotFn>>;
    try {
      res = await captureWebsiteScreenshotFn({ data: { websiteUrl } });
    } catch (err) {
      return {
        ok: false,
        error: "failed",
        message: err instanceof Error ? err.message : "Screenshot request failed",
      };
    }

    if (!res.ok) {
      return { ok: false, error: res.error, message: res.message };
    }

    const targetSlot = availableSlots[0];
    const file = base64ToFile(res.imageBase64, res.contentType, `screenshot-${Date.now()}.png`);
    return {
      ok: true,
      results: [{ slot: targetSlot, file, fileSizeBytes: res.fileSizeBytes }],
    };
  },
};

/* -------------------------------------------------------------------------- */
/*  API Gateway adapter — placeholder. Kept so the compile-time switch is     */
/*  real and future backend wiring is a single-file change.                   */
/* -------------------------------------------------------------------------- */

const apiGatewayAdapter: MediaCaptureAdapter = {
  isScreenshotSupported() {
    return false;
  },
  async captureWebsiteScreenshot(_args) {
    return {
      ok: false,
      error: "not_configured",
      message: "API Gateway screenshot backend not implemented.",
    };
  },
};

export const mediaCaptureAdapter: MediaCaptureAdapter =
  (MEDIA_CAPTURE_BACKEND as MediaCaptureBackend) === "api_gateway" ? apiGatewayAdapter : lovableAdapter;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function base64ToFile(base64: string, contentType: string, name: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: contentType });
}
