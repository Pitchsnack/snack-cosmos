/**
 * Publication adapter selection.
 *
 * Modes: "disabled" (default) | "preview" | "gateway".
 *
 * - disabled: production-safe default. No publication capability.
 * - preview:  explicit opt-in, non-persistent demonstration only, and it is
 *             force-disabled in production builds so a production deployment
 *             can never silently fall back to preview behaviour.
 * - gateway:  fails closed until the approved backend contract exists.
 */
import { disabledPublicationAdapter } from "./disabled-adapter";
import { previewPublicationAdapter } from "./preview-adapter";
import { gatewayPublicationAdapter } from "./gateway-adapter";
import type { PublicationAdapter, PublicationMode } from "./types";

function resolveMode(): PublicationMode {
  const raw = (import.meta.env.VITE_PUBLICATION_MODE as string | undefined)?.trim();
  if (raw === "gateway") return "gateway";
  if (raw === "preview") {
    // Never allow preview behaviour in a production build.
    return import.meta.env.PROD ? "disabled" : "preview";
  }
  return "disabled";
}

export const PUBLICATION_MODE: PublicationMode = resolveMode();

export const publicationAdapter: PublicationAdapter =
  PUBLICATION_MODE === "preview"
    ? previewPublicationAdapter
    : PUBLICATION_MODE === "gateway"
      ? gatewayPublicationAdapter
      : disabledPublicationAdapter;

export const isPublicationPreview = PUBLICATION_MODE === "preview";

export * from "./types";
export { toDirectoryProjection, DIRECTORY_PROJECTION_ALLOWLIST } from "./projection";
export {
  subscribePreviewPublications,
  readPreviewPublication,
  listPreviewPublishedRefs,
  PREVIEW_DISCLAIMER,
} from "./preview-adapter";
export { PUBLICATION_CAPABILITY_UNAVAILABLE } from "./gateway-adapter";
