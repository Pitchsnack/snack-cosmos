import { describe, expect, it } from "vitest";
import { advisorRegistrationMissing } from "../../src/lib/advisor-firm";
import { buyerApprovalTextMissing } from "../../src/lib/buyer-listing-identity";

describe("Advisor registration and publishing without legacy listing text", () => {
  it("completed setup can register without a listing name or headline", () => {
    expect(advisorRegistrationMissing({ setup_done_at: "2026-11-03T00:00:00Z" })).toEqual([]);
  });
  it("unfinished setup still cannot register", () => {
    expect(advisorRegistrationMissing({ setup_done_at: null })).toEqual(["finish setup"]);
  });
  it("advisors can be approved without published listing text", () => {
    expect(buyerApprovalTextMissing(undefined, undefined, "advisor")).toBeNull();
  });
  it("seller listing-name requirement remains", () => {
    expect(buyerApprovalTextMissing("", "Headline", "seller")).toBe("Write a listing name.");
  });
  it("seller headline requirement remains", () => {
    expect(buyerApprovalTextMissing("Listing", "", "seller")).toBe("Write a headline.");
  });
});