import { describe, it, expect } from "vitest";
import { continueBlockedLine } from "@/components/setup/continue-blocked";
describe("continueBlockedLine", () => {
  it("one field", () => expect(continueBlockedLine(["Phone"], "en")).toBe("To continue, fill in Phone."));
  it("several fields", () => expect(continueBlockedLine(["A", "B", "C"], "en")).toBe("To continue, fill in A, B and C."));
  it("Thai", () => expect(continueBlockedLine(["อีเมล"], "th")).toBe("กรอก อีเมล เพื่อดำเนินการต่อ"));
  it("photos", () => expect(continueBlockedLine([], "en", true)).toBe("To continue, add at least 1 photo."));
  it("nothing missing", () => expect(continueBlockedLine([], "en")).toBeNull());
});
