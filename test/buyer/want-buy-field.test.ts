import { describe, expect, it } from "vitest";
import { buyerListingEditorValues, buyerListingPreviewText, WANT_BUY_MAX, wantBuyLen } from "@/components/my-business/buyer-description-editor";
import { singleLineDescription } from "@/lib/buyer-description";

// What you want to buy: 80 characters per language, one saved line, the pop-up only right after the wizard.
describe("What you want to buy", () => {
  it("counts 80 characters per language, Thai included", () => {
    expect(WANT_BUY_MAX).toBe(80);
    expect(wantBuyLen("a".repeat(80))).toBe(80);
    expect(wantBuyLen("a".repeat(81))).toBe(81);
    expect(wantBuyLen("ก".repeat(81))).toBe(81); // Thai codepoints count as characters
  });

  it("saves one line: pasted line breaks become spaces", () => {
    expect(singleLineDescription("logistics firm\nwith its own\r\nchannel")).toBe("logistics firm with its own channel");
  });

  it("shows the Listing card preview in the app's language with other-language fallback", () => {
    expect(buyerListingPreviewText("English description", "คำอธิบายไทย", "", "", "th")).toBe("คำอธิบายไทย");
    expect(buyerListingPreviewText("English description", "คำอธิบายไทย", "", "", "en")).toBe("English description");
    expect(buyerListingPreviewText("", "", "English fallback", "คำอธิบายสำรอง", "th")).toBe("คำอธิบายสำรอง");
    expect(buyerListingPreviewText("", "", "English fallback", "", "th")).toBe("English fallback");
  });

  it("shows only the selected Listing language and keeps the other-language fallback for buyers", () => {
    const english = { description: "English description", headline: "English target" };
    const thai = { description: "คำอธิบายไทย", headline: "เป้าหมายไทย" };
    expect(buyerListingEditorValues(english, thai, "en", false)).toEqual(english);
    expect(buyerListingEditorValues(english, thai, "th", false)).toEqual(thai);
    expect(buyerListingEditorValues(english, { description: "", headline: "" }, "th", false)).toEqual(english);
  });

  it("lets Control and Admin inspect an empty selected language without overwriting it with the other", () => {
    const english = { description: "English description", headline: "English target" };
    const emptyThai = { description: "", headline: "" };
    expect(buyerListingEditorValues(english, emptyThai, "th", true)).toEqual(emptyThai);
  });

  it("the after-wizard pop-up needs both languages empty", () => {
    const wantEmpty = (en: string, th: string) => !en.trim() && !th.trim();
    expect(wantEmpty("", " ")).toBe(true);
    expect(wantEmpty("Logistics firms", "")).toBe(false);
    expect(wantEmpty("", "บริษัทโลจิสติกส์")).toBe(false);
  });
});
