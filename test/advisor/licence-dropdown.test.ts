import { describe, expect, test } from "bun:test";
import { CredentialInput, DraftFirmInput } from "../../src/lib/advisor-form-schema";
import { LICENCES, LICENCE_GROUPS, licenceError, licenceTaken, licenceName } from "../../src/lib/advisor-licences";

const credential = (licenceKey: string, name = "Custom") => ({ licenceKey, name, note: null });
describe("advisor licence rules", () => {
  test("catalogue contains the supplied seven groups and 22 keys", () => {
    expect(LICENCE_GROUPS.length).toBe(7);
    expect(LICENCES.map(x => x[1])).toEqual(["cpa", "ca", "ta", "sec_auditor", "bookkeeper", "cfa", "cfp", "investment_consultant", "investment_planner", "investment_analyst", "fund_manager", "sec_financial_advisor", "fa_supervisor", "investment_advisory", "lawyer", "notarial_attorney", "thai_barrister", "patent_agent", "sec_valuation_company", "sec_chief_valuer", "tgo_verifier", "other"]);
  });
  test("unknown and empty choices cannot save", () => {
    expect(CredentialInput.safeParse(credential("unknown")).success).toBe(false);
    expect(licenceError(credential(""))).toBe("choice");
  });
  test("Other needs a trimmed name of at most 120 characters", () => {
    expect(CredentialInput.safeParse(credential("other", "   ")).success).toBe(false);
    expect(CredentialInput.safeParse(credential("other", "x".repeat(121))).success).toBe(false);
    expect(CredentialInput.parse(credential("other", " ACCA ")).name).toBe("ACCA");
    expect(CredentialInput.safeParse(credential("other", "x".repeat(120))).success).toBe(true);
  });
  test("listed names save canonical English while old Other names stay unchanged", () => {
    expect(CredentialInput.parse(credential("cpa", "anything")).name).toBe("CPA · Certified Public Accountant");
    expect(CredentialInput.parse(credential("other", "accoutning")).name).toBe("accoutning");
  });
  test("only listed choices are disabled on other rows", () => {
    const rows = [credential("cpa"), credential("other")];
    expect(licenceTaken(rows, 1, "cpa")).toBe(true);
    expect(licenceTaken(rows, 0, "cpa")).toBe(false);
    expect(licenceTaken(rows, 0, "other")).toBe(false);
    const schema = DraftFirmInput.shape.credentials;
    expect(schema.safeParse([credential("cpa"), credential("cpa")]).success).toBe(false);
    expect(schema.safeParse([credential("other"), credential("other")]).success).toBe(true);
  });
});