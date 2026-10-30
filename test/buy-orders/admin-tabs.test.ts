import { describe, expect, it } from "vitest";
import { canShareOrder, managedApplyState, sealedOnly } from "../../src/lib/buy-orders";

describe("Businesses Wanted Admin personas", () => {
  it("restricts only the Admin Buyer tab to sealed orders", () => {
    expect(sealedOnly("admin", "buyer")).toBe(true);
    expect(sealedOnly("admin", "seller")).toBe(false);
    expect(sealedOnly("admin", "advisor")).toBe(false);
    expect(sealedOnly("buyer", "buyer")).toBe(false);
  });
  it("keeps Apply available while any eligible company has not applied", () => {
    expect(managedApplyState(["PS-1001", "PS-1002"], ["PS-1001"])).toBe("available");
  });
  it("marks Applied only when every eligible company applied", () => {
    expect(managedApplyState(["PS-1001", "PS-1002"], ["PS-1001", "PS-1002"])).toBe("applied");
  });
  it("offers no Apply with no eligible companies", () => {
    expect(managedApplyState([], ["PS-1001"])).toBe("none");
  });
  it("lets Admins share any posted order but not buyers their own advertisement", () => {
    expect(canShareOrder("admin", true)).toBe(true);
    expect(canShareOrder("buyer", true)).toBe(false);
    expect(canShareOrder("seller", false)).toBe(true);
    expect(canShareOrder(null, false)).toBe(false);
  });
});