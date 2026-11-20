import { describe, expect, it } from "vitest";
import { buyerAddWizardState, buyerSkips, buyerSignupWizardState, shownSteps, type BuyerRelation } from "@/lib/buyer-wizard";

const types = ["Private Equity"];
const baseInput = { types, web: "www.example.co.th", year: 2024, size: "11-50", sectors: ["Automotive"], logoPath: "tenant/profile/logo.webp" };

function addState(rel: BuyerRelation, extra = true) {
  return buyerAddWizardState(
    { admin_profile: true, answered: [], bp: { ref_no: "INV-9999", status: "draft" } },
    { ...baseInput, rel, extra },
  );
}

function visibleAfterAdd(rel: BuyerRelation) {
  const wizard = addState(rel);
  const skip = buyerSkips(wizard.from_signup, {
    role: rel,
    type: rel === "individual" ? "Individual Investor" : types[0],
    web: baseInput.web,
    year: "2024",
    name: "Test buyer",
    actsFor: rel === "agent" ? types : [],
    sectors: baseInput.sectors,
    nameDone: true,
  });
  return shownSteps(rel, skip).map((step) => step.id);
}

describe("+ Add Investor Profile finishes with sign-up's wizard state", () => {
  it("Corporate Enterprise opens on Website, step 1 of 8", () => {
    expect(visibleAfterAdd("corporate")).toEqual(["web", "aum", "ticket", "rev", "deals", "photos", "team", "review"]);
  });

  it("Authorised representative / adviser opens on Website, step 1 of 7", () => {
    expect(visibleAfterAdd("agent")).toEqual(["web", "ticket", "rev", "deals", "photos", "team", "review"]);
  });

  it("Individual Investor opens on Website, step 1 of 6 without saving a founding year", () => {
    const wizard = addState("individual");
    expect(visibleAfterAdd("individual")).toEqual(["web", "ticket", "rev", "deals", "team", "review"]);
    expect(buyerSignupWizardState("individual", [], baseInput.web, null, null).from_signup).not.toContain("year");
  });

  it("Control's extra profile keeps its reference and stores relation, sectors and logo per profile", () => {
    const wizard = addState("agent");
    expect(wizard.admin_profile).toBe(true);
    expect(wizard.bp).toMatchObject({ ref_no: "INV-9999", status: "draft", buyer_relation: "agent", sectors: ["Automotive"], logo_url: baseInput.logoPath });
  });

  it("a linked buyer profile does not move account answers into the extra-profile store", () => {
    const wizard = addState("corporate", false);
    expect(wizard.bp).toEqual({ ref_no: "INV-9999", status: "draft" });
  });

  it("sign-up and + Add use the same initial type and answer markers", () => {
    const signup = buyerSignupWizardState("corporate", types, baseInput.web, 2024, "11-50");
    const add = addState("corporate");
    expect(add.answered).toEqual(expect.arrayContaining(signup.answered));
    expect(add.from_signup).toEqual(expect.arrayContaining(signup.from_signup));
    expect(add.from_signup).toEqual(expect.arrayContaining(["sectors", "reg", "year", "address", "logo"]));
  });
});
