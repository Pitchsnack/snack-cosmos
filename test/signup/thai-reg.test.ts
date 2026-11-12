import { describe, expect, it } from "vitest";
import { isValidThaiReg, signupSteps, normWebsite } from "@/lib/thai-reg";

describe("Thai registration number", () => {
  it("accepts the brief's sample numbers", () => {
    for (const n of ["0105559108340", "0105555123450", "0105557031188", "0105562017457", "0105557123457"]) expect(isValidThaiReg(n)).toBe(true);
  });
  it("refuses a wrong check digit", () => expect(isValidThaiReg("0105559108341")).toBe(false));
  it("refuses fewer than 13 digits", () => expect(isValidThaiReg("010555910834")).toBe(false));
});
describe("Sign-up steps", () => {
  it("seller has 7", () => expect(signupSteps("seller", "owner")).toHaveLength(7));
  it("corporate buyer has 8", () => expect(signupSteps("buyer", "corporate")).toHaveLength(8));
  it("individual buyer has 6 and no logo", () => { const s = signupSteps("buyer", "individual"); expect(s).toHaveLength(6); expect(s).not.toContain("logo"); });
  it("advisor has 7", () => expect(signupSteps("advisor", "Law firm")).toHaveLength(7));
});
it("website is saved bare", () => expect(normWebsite("https://www.acme.co.th/")).toBe("www.acme.co.th"));
