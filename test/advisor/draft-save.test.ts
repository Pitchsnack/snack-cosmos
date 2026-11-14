import { describe, expect, test } from "bun:test";
import { DraftFirmInput, CompleteFirmInput, EditCompleteFirmInput, advisorNeedsCompleteSave } from "../../src/lib/advisor-form-schema";
const draft = { id: null, name: "Name only", firmType: "", logoPath: null, logoSource: null, description: "", yearFounded: null, city: "", country: "Thailand", services: [], fees: {}, dealBand: null, teamSize: null, languages: [], sectors: [], legalName: "", website: "", email: "", phone: "", team: [], credentials: [], documents: [] };
describe("Advisor Draft saving", () => {
 test("name-only draft accepts empty required fields", () => { expect(DraftFirmInput.safeParse(draft).success).toBe(true); });
 test("a missing field never stops Draft Save", () => { expect(advisorNeedsCompleteSave("draft")).toBe(false); expect(DraftFirmInput.safeParse({...draft, name: ""}).success).toBe(true); });
 test("live firms keep required completeness checks", () => { expect(advisorNeedsCompleteSave("live")).toBe(true); expect(CompleteFirmInput.safeParse(draft).success).toBe(false); });
 test("structural limits still reject oversized draft names", () => { expect(DraftFirmInput.safeParse({...draft, name: "x".repeat(81)}).success).toBe(false); });
 test("Edit information requires company name but not the retired second name", () => {
  const complete = {...draft, legalName:undefined, name:"ABC Advisory Co., Ltd.", firmType:"M&A Advisor", description:"An advisory firm supporting business transactions.", yearFounded:2014, city:"Bangkok", services:["M&A"], teamSize:8, website:"https://example.com", email:"test@example.com", phone:"+6621234567", registrationNo:"0105548098615", longDescription:"A longer description of the advisory firm.", contactName:"Somchai Test"};
  expect(EditCompleteFirmInput.safeParse(complete).success).toBe(true);
  expect(EditCompleteFirmInput.safeParse({...complete,name:""}).success).toBe(false);
  expect(CompleteFirmInput.safeParse(complete).success).toBe(false);
 });
});
