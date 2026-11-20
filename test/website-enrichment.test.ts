import { describe, expect, it } from "vitest";
import { canStartWebsiteEnrich, shouldReuseEnrichment } from "@/lib/website-enrichment";

describe("Website step first read", () => {
  const empty = { websiteValid: true, status: "idle", shortDescription: "", longDescription: "" } as const;
  it("allows Continue to start the reader with a valid website and both descriptions empty", () => {
    expect(canStartWebsiteEnrich(empty)).toBe(true);
  });
  it("does not start without a valid website", () => {
    expect(canStartWebsiteEnrich({ ...empty, websiteValid: false })).toBe(false);
  });
  it("keeps descriptions required when either one already has text", () => {
    expect(canStartWebsiteEnrich({ ...empty, shortDescription: "Short answer" })).toBe(false);
    expect(canStartWebsiteEnrich({ ...empty, longDescription: "Long answer" })).toBe(false);
  });
  it("waits while reading and never repeats a completed or failed read from Continue", () => {
    for (const status of ["running", "done", "failed"] as const) {
      expect(canStartWebsiteEnrich({ ...empty, status })).toBe(false);
    }
  });
});

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
