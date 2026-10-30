import { describe, expect, it } from "vitest";
import { rowState, setupLanguageOf, trCounts } from "@/lib/review-translation";

describe("Admin review translation rules", () => {
  it("a row with both languages is In both", () => expect(rowState({ en: "Hello", th: "สวัสดี" })).toBe("both"));
  it("a row without Thai counts as without Thai", () => expect(rowState({ en: "Hello", th: " " })).toBe("no_th"));
  it("a row without English counts as without English", () => expect(rowState({ en: "", th: "สวัสดี" })).toBe("no_en"));
  it("a list with fewer Thai lines than English counts as without Thai", () => expect(rowState({ en: "a\nb\nc", th: "ก\nข", list: true })).toBe("no_th"));
  it("the tab count is the rows that aren't In both", () => expect(trCounts([{ en: "a", th: "ก" }, { en: "a", th: "" }, { en: "", th: "ก" }, { en: "", th: "" }]).open).toBe(2));
  it("a stored setup language wins", () => expect(setupLanguageOf("en", [{ en: "บริษัท" }])).toBe("en"));
  it("without one, mostly Thai English fields mean ไทย", () => expect(setupLanguageOf(null, [{ en: "บริษัท" }, { en: "ที่อยู่" }, { en: "Bangkok" }])).toBe("th"));
  it("without one, a tie means English", () => expect(setupLanguageOf(null, [{ en: "บริษัท" }, { en: "Bangkok" }])).toBe("en"));
});
