import { describe, expect, it } from "vitest";
import { isIdentityLocked, lockedIdentityChanges } from "@/lib/identity-lock";

describe("DBD identity lock", () => {
  it("stays editable before the DBD check", () => {
    expect(isIdentityLocked(null, "Acme Co., Ltd.")).toBe(false);
  });
  it("locks a filled field once confirmed", () => {
    expect(isIdentityLocked("2026-01-01T00:00:00Z", "0105551234567")).toBe(true);
  });
  it("keeps an empty field editable until filled", () => {
    expect(isIdentityLocked("2026-01-01T00:00:00Z", "")).toBe(false);
    expect(isIdentityLocked("2026-01-01T00:00:00Z", null)).toBe(false);
  });
  it("Admin editing keeps locked fields editable", () => {
    expect(isIdentityLocked("2026-01-01T00:00:00Z", 2014, true)).toBe(false);
  });
  it("finds changed locked columns, ignoring unchanged and other fields", () => {
    const stored = { reg_locked_at: "2026-01-01", startup_name: "Acme", registered_number: "0105551234567", year_founded: 2014, thai_name: "", english_name: null };
    expect(lockedIdentityChanges("startups", stored, { startup_name: "Other", year_founded: 2014, city: "Bangkok", thai_name: "เอ" })).toEqual(["startup_name"]);
  });
});
