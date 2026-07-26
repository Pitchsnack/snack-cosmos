/**
 * TA-1 no-Startup boundary (START-GATE §7): a small PURE decision helper
 * that is the ONLY authority for whether the journey route may construct a
 * tenant Startup request. The real TA-1 posture configures no Startup
 * reference (`demoStartupRef` stays `""`), so the decision is always
 * `ready` — an active-tenant-ready presentation with NO `/tenant/startups`
 * request and no fabricated Startup reference. Only the dev mock supplies a
 * configured synthetic reference and therefore reaches `load_startup`.
 */
export type TenantJourneyDecision =
  | { kind: "ready"; loadStartup: false }
  | { kind: "load_startup"; loadStartup: true; startupRef: string };

/**
 * Missing, empty, or whitespace-only reference → `ready` (no load).
 * Non-empty configured reference → `load_startup`, preserving the supplied
 * reference verbatim.
 */
export function decideTenantJourney(startupRef?: string | null): TenantJourneyDecision {
  if (typeof startupRef !== "string" || startupRef.trim().length === 0) {
    return { kind: "ready", loadStartup: false };
  }
  return { kind: "load_startup", loadStartup: true, startupRef };
}
