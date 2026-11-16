import { describe, expect, it } from "vitest";
import { canCorrectRegistrationCheck, canRequestSignupSetup, isValidThaiReg, signupSteps, normWebsite } from "@/lib/thai-reg";

describe("Thai registration number", () => {
  it("accepts the brief's sample numbers", () => {
    for (const n of ["0105559108340", "0105555123450", "0105557031188", "0105562017457", "0105557123457", "0107568000248"]) expect(isValidThaiReg(n)).toBe(true);
  });
  it("refuses a wrong check digit", () => expect(isValidThaiReg("0105559108341")).toBe(false));
  it("refuses fewer than 13 digits", () => expect(isValidThaiReg("010555910834")).toBe(false));
});
describe("Registration-number correction", () => {
  it("allows a correction when the register was unavailable and no result was held", () => {
    expect(canCorrectRegistrationCheck(null)).toBe(true);
    expect(canCorrectRegistrationCheck({ status: "unavailable" })).toBe(true);
  });
  it("keeps the existing not-found and rejected correction paths", () => {
    expect(canCorrectRegistrationCheck({ status: "not_found" })).toBe(true);
    expect(canCorrectRegistrationCheck({ status: "rejected" })).toBe(true);
  });
  it("allows correction after cancelling a running check, but never after a company was found", () => {
    expect(canCorrectRegistrationCheck({ status: "running" })).toBe(true);
    expect(canCorrectRegistrationCheck({ status: "found" })).toBe(false);
  });
});
describe("Sign-up steps", () => {
  it("seller has 7", () => expect(signupSteps("seller", "owner")).toHaveLength(7));
  it("corporate buyer has 8", () => expect(signupSteps("buyer", "corporate")).toHaveLength(8));
  it("individual buyer has 6 and no logo", () => { const s = signupSteps("buyer", "individual"); expect(s).toHaveLength(6); expect(s).not.toContain("logo"); });
  it("advisor has 7", () => expect(signupSteps("advisor", "Law firm")).toHaveLength(7));
});
describe("No-registration-number recovery", () => {
  it("allows an individual investor to request setup during rejected-number correction", () => {
    expect(canRequestSignupSetup(false, true)).toBe(true);
    expect(canRequestSignupSetup(true, true)).toBe(true);
  });
  it("keeps the original no-number option before number confirmation", () => {
    expect(canRequestSignupSetup(false, false)).toBe(true);
  });
  it("does not unlock an already confirmed number outside correction", () => {
    expect(canRequestSignupSetup(true, false)).toBe(false);
  });
});
it("website is saved bare", () => expect(normWebsite("https://www.acme.co.th/")).toBe("www.acme.co.th"));
