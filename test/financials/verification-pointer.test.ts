import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "../../src/components/financials/financials-page.tsx"), "utf8");
const pointer = readFileSync(join(__dirname, "../../src/components/company-verification/page.tsx"), "utf8");

describe("VerificationPointer on financials", () => {
  it("renders only in the seller's own workspace (my-startups)", () => {
    const line = page.split("\n").find((l) => l.includes("<VerificationPointer"));
    expect(line).toBeDefined();
    expect(line).toContain("workspace === 'my-startups'");
  });

  it("links to /my-verification, which only resolves the caller's own companies", () => {
    expect(pointer).toContain('to="/my-verification"');
  });
});
