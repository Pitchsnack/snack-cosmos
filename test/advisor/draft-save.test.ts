import { describe, expect, test } from "bun:test";
import { DraftFirmInput, CompleteFirmInput, advisorNeedsCompleteSave } from "../../src/lib/advisor-form-schema";
const draft = { id: null, name: "Name only", firmType: "", logoPath: null, logoSource: null, description: "", yearFounded: null, city: "", country: "Thailand", services: [], fees: {}, dealBand: null, teamSize: null, languages: [], sectors: [], legalName: "", website: "", email: "", phone: "", team: [], credentials: [], documents: [] };
describe("Advisor Draft saving", () => {
 test("name-only draft accepts empty required fields", () => { expect(DraftFirmInput.safeParse(draft).success).toBe(true); });
 test("a missing field never stops Draft Save", () => { expect(advisorNeedsCompleteSave("draft")).toBe(false); expect(DraftFirmInput.safeParse({...draft, name: ""}).success).toBe(true); });
 test("live firms keep required completeness checks", () => { expect(advisorNeedsCompleteSave("live")).toBe(true); expect(CompleteFirmInput.safeParse(draft).success).toBe(false); });
 test("structural limits still reject oversized draft names", () => { expect(DraftFirmInput.safeParse({...draft, name: "x".repeat(81)}).success).toBe(false); });
});
