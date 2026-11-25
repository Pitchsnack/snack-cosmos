import { describe, expect, it } from "vitest";
import { buyerApprovalTextMissing, buyerRegistrationMissing, buyerWantFilled } from "@/lib/buyer-listing-identity";

const inv = { setup_done_at: "2026-11-01", investor_name: "Test Co", ticket_band: "t1", investor_type: "Corporate", preferred_stages: ["Growth"], preferred_industries: ["Tech"] };

describe("Wants to buy is required", () => {
  it("blocks registration when empty in both languages", () => {
    expect(buyerRegistrationMissing(inv, { deal_types: ["Acquisition"] })).toContain("what you want to buy");
  });
  it("allows registration with Thai only", () => {
    expect(buyerRegistrationMissing(inv, { deal_types: ["Acquisition"], suggested_headline_th: "บริษัทโลจิสติกส์" })).not.toContain("what you want to buy");
  });
  it("blocks Admin publishing a buyer without published text", () => {
    expect(buyerApprovalTextMissing("", "  ", "buyer", "")).not.toBeNull();
    expect(buyerApprovalTextMissing("", "", "buyer", "ต้องการซื้อ")).toBeNull();
  });
  it("leaves advisors unchanged", () => {
    expect(buyerApprovalTextMissing("", "", "advisor")).toBeNull();
    expect(buyerWantFilled(null, " ")).toBe(false);
  });
});
