import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const buyer = readFileSync("src/components/my-business/buyer-investor-edit.tsx", "utf8");
const advisor = readFileSync("src/components/advisor/advisor-firm-edit.tsx", "utf8");
const sellerForm = readFileSync("src/components/startups/startup-form.tsx", "utf8");
const sellerWizard = readFileSync("src/components/startups/seller-wizard.tsx", "utf8");

describe("profile field source tags", () => {
  it("never draws Your answer in the shared buyer tag renderer", () => {
    expect(buyer).toContain('if (!s || s === "Your answer") return null;');
    expect(buyer).not.toContain("reviewTag(");
  });

  it("never draws Your answer in the shared advisor tag renderer", () => {
    expect(advisor).toContain('if (!t || t === "Your answer") return null;');
  });

  it("keeps Auto Enrich and Company registry as supported visible sources", () => {
    for (const source of [buyer, advisor]) {
      expect(source).toContain('"Auto Enrich"');
      expect(source).toContain('"Company registry"');
    }
  });

  it("has no seller Your answer tag renderer to remove", () => {
    expect(sellerForm).not.toContain('"Your answer"');
    expect(sellerWizard).not.toContain('"Your answer"');
  });
});
