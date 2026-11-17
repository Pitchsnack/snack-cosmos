import { describe, expect, it } from "vitest";
import { businessSteps } from "@/components/login/business-steps";
import { R, R_ADD } from "@/components/login/signup-reg-copy";
import { REG_CHANGES } from "@/lib/thai-reg";

describe("+ Add uses sign-up's steps without Role, Account and Confirm email", () => {
  it("seller: about, company, sector, logo", () => {
    expect(businessSteps("seller", "owner")).toEqual(["about", "company", "sector", "logo"]);
  });
  it("corporate buyer adds the investor type", () => {
    expect(businessSteps("buyer", "corporate")).toEqual(["about", "type", "company", "sector", "logo"]);
  });
  it("individual buyer skips type and logo", () => {
    expect(businessSteps("buyer", "individual")).toEqual(["about", "company", "sector"]);
  });
  it("advisor: about, company, sector, logo", () => {
    expect(businessSteps("advisor", "Tax and accounting firm")).toEqual(["about", "company", "sector", "logo"]);
  });
  it("one number plus two changes per + Add", () => {
    expect(1 + REG_CHANGES).toBe(3);
  });
});

describe("+ Add texts say add, not account", () => {
  it("company line", () => {
    expect(R_ADD.coLine.company.en).toBe("We verify your company before adding it.");
    expect(R_ADD.coLine.company.th).toBe("เราจะยืนยันบริษัทของท่านก่อนเพิ่มเข้าในบัญชี");
    expect(R.coLine.company.en).toBe("We verify your company before creating your account.");
  });
  it("set-up request title and thanks", () => {
    expect(R_ADD.sTitle.en).toBe("Let PitchSnack add your company");
    expect(R_ADD.sTitle.th).toBe("ให้ PitchSnack เพิ่มบริษัทของท่าน");
    expect(R_ADD.thanksB.en).toContain("Nothing has been added yet.");
    expect(R_ADD.thanksB.th).toContain("ยังไม่มีการเพิ่มบริษัท");
  });
  it("not found", () => {
    expect(R_ADD.nfA.en).toBe("We couldn't find a company with this registration number, so we can't add it yet.");
    expect(R_ADD.pcA.en).toBe("We couldn't find your company with the {count} registration numbers you tried, so we can't add it.");
  });
});
