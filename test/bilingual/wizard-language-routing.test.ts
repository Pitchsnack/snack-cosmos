import { describe, expect, it } from "vitest";
import { preferredLanguageText, routeWizardTags, routeWizardText } from "@/lib/bilingual-fields";

 describe("wizard text language routing", () => {
  it("stores English typed in the Thai field as English and preserves Thai", () => {
    expect(routeWizardText({ en: null, th: "ข้อความเดิม" }, { th: "English answer" })).toEqual({ en: "English answer" });
  });
  it("stores Thai typed in the English field as Thai and preserves English", () => {
    expect(routeWizardText({ en: "Previous English", th: null }, { en: "คำตอบภาษาไทย" })).toEqual({ th: "คำตอบภาษาไทย" });
  });
  it("does not rewrite an unchanged twin", () => {
    expect(routeWizardText({ en: "English", th: "ไทย" }, { en: "English", th: "ไทย" })).toEqual({});
  });
  it("clears only the edited side", () => {
    expect(routeWizardText({ en: "English", th: "ไทย" }, { en: "" })).toEqual({ en: "" });
  });
  it("sorts mixed tags individually and keeps existing tags in the other language", () => {
    expect(routeWizardTags({ en: ["Cloud services"], th: ["ตลาดไทย"] }, { en: ["Cloud services", "การขนส่ง", "Freight"] })).toEqual({
      en: ["Cloud services", "Freight"], th: ["ตลาดไทย", "การขนส่ง"],
    });
  });
  it("uses the reader language and falls back to the other language", () => {
    expect(preferredLanguageText("", "คำอธิบาย", "en")).toBe("คำอธิบาย");
    expect(preferredLanguageText("Description", "", "th")).toBe("Description");
    expect(preferredLanguageText("Description", "คำอธิบาย", "th")).toBe("คำอธิบาย");
    expect(preferredLanguageText("", "", "en")).toBe("");
  });
});
