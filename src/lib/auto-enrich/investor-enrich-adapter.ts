/**
 * Investor Auto Enrich Adapter
 * ----------------------------
 * The UI only ever calls `investorEnrichAdapter.enrichInvestor(...)`.
 * Backend selection (lovable | api_gateway) lives here, never in the form.
 */
import { enrichInvestorFromUrl } from "./investor-enrich.functions";
import type { EnrichInvestorResult } from "./investor-enrich-types";

export type AutoEnrichBackend = "lovable" | "api_gateway";

export const INVESTOR_ENRICH_BACKEND: AutoEnrichBackend = "lovable";

export interface EnrichInvestorInput {
  websiteUrl: string;
}

export type { EnrichInvestorResult };

interface Impl {
  enrichInvestor(input: EnrichInvestorInput): Promise<EnrichInvestorResult>;
}

const lovableBackend: Impl = {
  async enrichInvestor({ websiteUrl }) {
    return await enrichInvestorFromUrl({ data: { websiteUrl } });
  },
};

const apiGatewayBackend: Impl = {
  async enrichInvestor() {
    throw new Error(
      "Investor Auto Enrich api_gateway backend not yet implemented. " +
        "Set INVESTOR_ENRICH_BACKEND='lovable' or wire the API Gateway call here.",
    );
  },
};

const BACKENDS: Record<AutoEnrichBackend, Impl> = {
  lovable: lovableBackend,
  api_gateway: apiGatewayBackend,
};

export const investorEnrichAdapter: Impl = {
  enrichInvestor: (input) => BACKENDS[INVESTOR_ENRICH_BACKEND].enrichInvestor(input),
};
