/**
 * Auto Enrich Adapter
 * --------------------
 * Single entry point the UI uses to enrich a Startup from a website URL.
 *
 * The form must NOT call backend-specific code directly. It only calls
 * `autoEnrichAdapter.enrichStartup({ websiteUrl })`. Switching backends
 * (e.g. to a future API Gateway) happens here, not in the form.
 */
import { enrichStartupFromUrl, type EnrichResult } from "./auto-enrich.functions";

export type AutoEnrichBackend = "lovable" | "api_gateway";

/** Central switch. Change here only — do not branch in the UI. */
export const AUTO_ENRICH_BACKEND: AutoEnrichBackend = "lovable";

export interface EnrichStartupInput {
  /** Source URL (from the Startup `website_url` field). */
  websiteUrl: string;
}

export type EnrichStartupResult = EnrichResult;

interface AutoEnrichBackendImpl {
  enrichStartup(input: EnrichStartupInput): Promise<EnrichStartupResult>;
}

/** Lovable backend — calls a TanStack server fn that uses Lovable AI Gateway. */
const lovableBackend: AutoEnrichBackendImpl = {
  async enrichStartup({ websiteUrl }) {
    return await enrichStartupFromUrl({ data: { websiteUrl } });
  },
};

/** Placeholder — future SnackPortal API Gateway backend. Same interface. */
const apiGatewayBackend: AutoEnrichBackendImpl = {
  async enrichStartup(_input) {
    throw new Error(
      "Auto Enrich api_gateway backend not yet implemented. " +
        "Set AUTO_ENRICH_BACKEND='lovable' or wire the API Gateway call here.",
    );
  },
};

const BACKENDS: Record<AutoEnrichBackend, AutoEnrichBackendImpl> = {
  lovable: lovableBackend,
  api_gateway: apiGatewayBackend,
};

export const autoEnrichAdapter: AutoEnrichBackendImpl = {
  enrichStartup: (input) => BACKENDS[AUTO_ENRICH_BACKEND].enrichStartup(input),
};
