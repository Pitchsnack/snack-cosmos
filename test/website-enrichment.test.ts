import { describe, expect, it } from "vitest";
import { shouldReuseEnrichment } from "@/lib/website-enrichment";

describe("one background website read", () => {
  const key = "https://example.com";
  it("reuses a completed result on reopen and Create", () => {
    expect(shouldReuseEnrichment({ status: "done", website_key: key }, key)).toBe(true);
  });
  it("does not repeat a failed read on reopen", () => {
    expect(shouldReuseEnrichment({ status: "failed", website_key: key }, key)).toBe(true);
  });
  it("allows only an explicit retry to read the same website again", () => {
    expect(shouldReuseEnrichment({ status: "failed", website_key: key }, key, true)).toBe(false);
    expect(shouldReuseEnrichment({ status: "done", website_key: key }, key, true)).toBe(false);
  });
  it("shares a recent running read but recovers one stuck for ten minutes", () => {
    const now = Date.parse("2026-01-01T00:10:00Z");
    expect(shouldReuseEnrichment({ status: "running", website_key: key, updated_at: "2026-01-01T00:05:00Z" }, key, false, now)).toBe(true);
    expect(shouldReuseEnrichment({ status: "running", website_key: key, updated_at: "2025-12-31T23:59:00Z" }, key, false, now)).toBe(false);
  });
});
