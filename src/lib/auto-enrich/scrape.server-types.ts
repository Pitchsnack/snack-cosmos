/** Client-safe diagnostic types shared with the server scrape pipeline. */
export type HeadquartersDiagnostic =
  | "direct"
  | "inferred_from_phone"
  | "not_found"
  | "conflicting_signals";

export interface EnrichDebugBase {
  origin: string;
  pagesTried: { path: string; status: number | "error"; bytes: number }[];
  pagesUsed: number;
  corpusChars: number;
  modelOutputChars: number;
  headquartersDiagnostic?: HeadquartersDiagnostic;
  headquartersPhoneCc?: string;
}
