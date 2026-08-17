/** Client-safe types for Investor Auto Enrich. */
import type { EnrichDebugBase } from "./scrape.server-types";

export interface EnrichInvestorResult {
  investorName?: string;
  firmName?: string;
  investorType?: string;
  yearFounded?: number;
  email?: string;
  headquarters?: string;
  city?: string;
  businessAddress?: string;
  linkedinUrl?: string;
  bio?: string;
  keywords?: string[];
  preferredStages?: string[];
  preferredIndustries?: string[];
  investmentFocus?: string[];
  aum?: string;
  minTicketSize?: string;
  maxTicketSize?: string;
  _debug?: EnrichDebugBase;
}
