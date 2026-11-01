import { describe, expect, it } from "vitest";
import { buyerApprovalTextMissing, buyerListingName, buyerRegistrationMissing } from "../../src/lib/buyer-listing-identity";

describe("buyer without listing name or headline inputs", () => {
  it("registers complete buyer details with no name or headline suggestions", () => {
    expect(buyerRegistrationMissing({setup_done_at:"2026-11-01",investor_name:"Test buyer",ticket_band:"tkt_below_5",investor_type:"Private Equity",preferred_stages:["Growth"],preferred_industries:["FinTech"]}, {deal_types:["Full acquisition"]})).toEqual([]);
  });
  it("still requires missing buyer company details", () => {
    expect(buyerRegistrationMissing(null, {})).toEqual(["finish setup","company name","average investment","deal types","industries"]);
  });
  it("allows buyer approval without either removed field", () => {
    expect(buyerApprovalTextMissing(undefined, undefined, "buyer")).toBeNull();
  });
  it("retains seller name and headline requirements", () => {
    expect(buyerApprovalTextMissing(undefined, undefined, "seller")).toBe("Write a listing name.");
    expect(buyerApprovalTextMissing("Seller name", undefined, "seller")).toBe("Write a headline.");
  });
  it("falls back to investor type and reference without private identity", () => {
    expect(buyerListingName("Private Equity", "INV-1001")).toBe("Private Equity · INV-1001");
    expect(buyerListingName(null, "INV-1001")).toBe("Investor · INV-1001");
  });
  it("preserves existing published names", () => {
    expect(buyerListingName("Private Equity", "INV-1001", "Existing name")).toBe("Existing name");
  });
});