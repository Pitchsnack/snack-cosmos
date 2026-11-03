import { describe, expect, it } from "vitest";
import { WANT_BUY_MAX, wantBuyLen } from "@/components/my-business/buyer-description-editor";
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

  it("the after-wizard pop-up needs both languages empty", () => {
    const wantEmpty = (en: string, th: string) => !en.trim() && !th.trim();
    expect(wantEmpty("", " ")).toBe(true);
    expect(wantEmpty("Logistics firms", "")).toBe(false);
    expect(wantEmpty("", "บริษัทโลจิสติกส์")).toBe(false);
  });
});
