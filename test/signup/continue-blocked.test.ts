import { describe, it, expect } from "vitest";
import { continueBlockedLine } from "@/components/setup/continue-blocked";
describe("continueBlockedLine", () => {
  it("one field", () => expect(continueBlockedLine(["Phone"], "en")).toBe("To continue, fill in Phone."));
  it("several fields", () => expect(continueBlockedLine(["A", "B", "C"], "en")).toBe("To continue, fill in A, B and C."));
  it("Thai", () => expect(continueBlockedLine(["อีเมล"], "th")).toBe("กรอก อีเมล เพื่อดำเนินการต่อ"));
  it("photos", () => expect(continueBlockedLine([], "en", true)).toBe("To continue, add at least 1 photo."));
  it("nothing missing", () => expect(continueBlockedLine([], "en")).toBeNull());
  it("invalid text", () => expect(continueBlockedLine([], "en", false, ["Short description"])).toBe("To continue, check Short description."));
  it("empty and invalid fields", () => expect(continueBlockedLine(["Website"], "en", false, ["Short description"])).toBe("To continue, fill in Website and check Short description."));
  it("Thai invalid text", () => expect(continueBlockedLine([], "th", false, ["คำอธิบายสั้น"])).toBe("ตรวจสอบ คำอธิบายสั้น เพื่อดำเนินการต่อ"));
  it("Thai empty and invalid fields", () => expect(continueBlockedLine(["เว็บไซต์"], "th", false, ["คำอธิบายสั้น"])).toBe("กรอก เว็บไซต์ และตรวจสอบ คำอธิบายสั้น เพื่อดำเนินการต่อ"));
});
