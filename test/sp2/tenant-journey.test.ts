/**
 * Pins for the TA-1 no-Startup boundary (START-GATE §7 + §8.2): the pure
 * decision helper is the only authority for whether the journey route may
 * construct a tenant Startup request. The real TA-1 posture keeps the
 * reference empty, so no Startup request decision can ever be produced.
 */
import { describe, expect, it } from "bun:test";
import { decideTenantJourney } from "../../src/lib/sp2/tenant-journey";

describe("decideTenantJourney — TA-1 no-Startup boundary", () => {
  it("undefined → ready / no load", () => {
    expect(decideTenantJourney(undefined)).toEqual({ kind: "ready", loadStartup: false });
    expect(decideTenantJourney()).toEqual({ kind: "ready", loadStartup: false });
  });

  it("null → ready / no load", () => {
    expect(decideTenantJourney(null)).toEqual({ kind: "ready", loadStartup: false });
  });

  it('"" → ready / no load', () => {
    expect(decideTenantJourney("")).toEqual({ kind: "ready", loadStartup: false });
  });

  it("whitespace-only → ready / no load", () => {
    for (const ref of [" ", "   ", "\t", "\n", " \t\r\n "]) {
      expect(decideTenantJourney(ref)).toEqual({ kind: "ready", loadStartup: false });
    }
  });

  it("configured synthetic ref → load_startup preserving the exact supplied ref", () => {
    const decision = decideTenantJourney("stp_test_ref_001");
    expect(decision).toEqual({
      kind: "load_startup",
      loadStartup: true,
      startupRef: "stp_test_ref_001",
    });
    // The reference is preserved verbatim — no trimming or rewriting.
    const padded = decideTenantJourney(" stp_test_ref_001 ");
    expect(padded.kind).toBe("load_startup");
    if (padded.kind === "load_startup") {
      expect(padded.startupRef).toBe(" stp_test_ref_001 ");
    }
  });

  it("the real-posture empty reference can never produce a Startup request decision", () => {
    // TA-1 real posture: demoStartupRef remains "" — the decision is ready,
    // carries loadStartup=false, and has NO startupRef member at all, so a
    // /tenant/startups request cannot even be described, let alone made.
    const decision = decideTenantJourney("");
    expect(decision.kind).toBe("ready");
    expect(decision.loadStartup).toBe(false);
    expect("startupRef" in decision).toBe(false);
  });
});
