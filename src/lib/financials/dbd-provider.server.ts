/**
 * DBD Data Warehouse provider adapter (server-only).
 *
 * All access to https://datawarehouse.dbd.go.th happens behind this boundary so
 * that changes to DBD never leak into the financial domain model or the UI.
 *
 * The adapter is intentionally conservative:
 *  - it never invents, estimates or interpolates a financial value;
 *  - it returns a typed outcome instead of throwing for expected failures;
 *  - any transport/parse problem degrades to `unavailable`.
 *
 * Deployment note: DBD does not expose an open public JSON API. A deployment
 * supplies a reachable gateway through the `DBD_GATEWAY_URL` secret (optionally
 * `DBD_GATEWAY_TOKEN`). Without it the adapter reports `not_configured` and the
 * UI tells the user Auto Enrich is unavailable — existing data is untouched.
 */

export type DbdLookupKey = "registered_number" | "registered_name";

/** One normalised statement (single fiscal year) returned by the provider. */
export interface DbdStatement {
  fiscalYear: number;
  currency: string;
  /** item_code -> value. Missing concepts must simply be absent. */
  income: Record<string, number>;
  position: Record<string, number>;
  cashFlow: Record<string, number>;
  /** ratio_code -> value, only when DBD reports the ratio itself. */
  ratios: Record<string, number>;
}

export interface DbdCompany {
  registeredNumber: string | null;
  registeredName: string | null;
  sourceReference: string | null;
}

export type DbdOutcome =
  | { status: "not_configured" }
  | { status: "unavailable"; detail?: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: DbdCompany[] }
  | { status: "no_financials"; company: DbdCompany; matchedBy: DbdLookupKey }
  | {
      status: "ok";
      company: DbdCompany;
      matchedBy: DbdLookupKey;
      statements: DbdStatement[];
      warnings: string[];
    };

const TIMEOUT_MS = 20_000;

function normNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (!cleaned) return undefined;
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Keeps only finite numeric entries; empty source values stay absent. */
function normMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = normNumber(v);
      if (n !== undefined) out[k] = n;
    }
  }
  return out;
}

function normCompany(raw: unknown): DbdCompany {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    registeredNumber:
      typeof r.registered_number === "string" ? r.registered_number.trim() : null,
    registeredName: typeof r.registered_name === "string" ? r.registered_name.trim() : null,
    sourceReference: typeof r.source_reference === "string" ? r.source_reference : null,
  };
}

/**
 * Looks a company up in DBD. Registered number always wins; the registered name
 * is only used when the number is missing or produced no valid match. Ambiguous
 * name results are never resolved automatically.
 */
export async function lookupDbdFinancials(input: {
  registeredNumber?: string | null;
  registeredName?: string | null;
}): Promise<DbdOutcome> {
  // Provider mode: gateway (production default) | test_scraper | fixture.
  // Production never silently falls back to a non-gateway mode.
  const mode = (process.env.DBD_PROVIDER_MODE ?? "gateway").toLowerCase();
  if (mode === "fixture") {
    const { dbdFixtureOutcome, resolveFixtureCase } = await import("./dbd-fixtures.server");
    return dbdFixtureOutcome(resolveFixtureCase(input.registeredName), input);
  }
  if (mode === "test_scraper") {
    const { lookupDbdFinancialsViaTestScraper } = await import("./dbd-test-scraper.server");
    return lookupDbdFinancialsViaTestScraper(input);
  }

  const gateway = process.env.DBD_GATEWAY_URL;
  if (!gateway) return { status: "not_configured" };

  const token = process.env.DBD_GATEWAY_TOKEN;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(gateway.replace(/\/$/, "") + "/financials/lookup", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        registered_number: input.registeredNumber?.trim() || null,
        registered_name: input.registeredName?.trim() || null,
      }),
    });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable", detail: `HTTP ${res.status}` };

    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return { status: "unavailable", detail: "invalid payload" };

    const status = String(body.status ?? "ok");
    if (status === "not_found") return { status: "not_found" };
    if (status === "ambiguous") {
      const candidates = Array.isArray(body.candidates)
        ? body.candidates.slice(0, 20).map(normCompany)
        : [];
      return { status: "ambiguous", candidates };
    }

    const company = normCompany(body.company);
    const matchedBy: DbdLookupKey =
      body.matched_by === "registered_name" ? "registered_name" : "registered_number";

    const rawStatements = Array.isArray(body.statements) ? body.statements : [];
    const statements: DbdStatement[] = [];
    for (const raw of rawStatements) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const year = normNumber(r.fiscal_year);
      if (!year || year < 1900 || year > 2999) continue;
      statements.push({
        fiscalYear: Math.trunc(year),
        currency: typeof r.currency === "string" && r.currency ? r.currency : "THB",
        income: normMap(r.income),
        position: normMap(r.position),
        cashFlow: normMap(r.cash_flow),
        ratios: normMap(r.ratios),
      });
    }

    if (statements.length === 0) return { status: "no_financials", company, matchedBy };

    const warnings = Array.isArray(body.warnings)
      ? body.warnings.filter((w): w is string => typeof w === "string")
      : [];
    return { status: "ok", company, matchedBy, statements, warnings };
  } catch (e) {
    return { status: "unavailable", detail: e instanceof Error ? e.message : "network error" };
  } finally {
    clearTimeout(timer);
  }
}
