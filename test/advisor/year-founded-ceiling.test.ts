import { describe, expect, setSystemTime, test } from "bun:test";

// The advisor save path runs in a server bundle where module-level code can be
// evaluated with the clock at the Unix epoch. A ceiling baked in at load time
// would then reject every real founding year, so the "not in the future" check
// must happen when the data is parsed, not when the schema module loads.
describe("Advisor year founded under an epoch clock", () => {
  test("a past year still saves when the module loads at 1970", async () => {
    setSystemTime(new Date("1970-01-01T00:00:00.000Z"));
    try {
      const { CompleteFirmInput, DraftFirmInput } = await import("../../src/lib/advisor-form-schema");
      const firm = {
        id: null, name: "ABC Advisory Co., Ltd.", firmType: "M&A Advisor", logoPath: null, logoSource: null,
        description: "An advisory firm supporting business transactions.", yearFounded: 2014, city: "Bangkok",
        country: "Thailand", registrationNo: "0105548098615", services: ["M&A"], fees: {}, dealBand: null,
        teamSize: 8, languages: ["English"], sectors: [], legalName: "ABC Advisory Co., Ltd.",
        website: "https://example.com", email: "test@example.com", phone: "+6621234567",
        team: [], credentials: [], documents: [],
      };
      expect(CompleteFirmInput.safeParse(firm).success).toBe(true);
      expect(DraftFirmInput.safeParse({ ...firm, legalName: "" }).success).toBe(true);
    } finally {
      setSystemTime();
    }
  });

  test("a year after the current one is rejected", async () => {
    setSystemTime(new Date("2026-11-02T00:00:00.000Z"));
    try {
      const { CompleteFirmInput } = await import("../../src/lib/advisor-form-schema");
      const future = {
        id: null, name: "ABC Advisory Co., Ltd.", firmType: "M&A Advisor", logoPath: null, logoSource: null,
        description: "An advisory firm supporting business transactions.", yearFounded: 2027, city: "Bangkok",
        country: "Thailand", registrationNo: "0105548098615", services: ["M&A"], fees: {}, dealBand: null,
        teamSize: 8, languages: ["English"], sectors: [], legalName: "ABC Advisory Co., Ltd.",
        website: "https://example.com", email: "test@example.com", phone: "+6621234567",
        team: [], credentials: [], documents: [],
      };
      const res = CompleteFirmInput.safeParse(future);
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error.issues.some((i) => i.message === "Year cannot be in the future")).toBe(true);
    } finally {
      setSystemTime();
    }
  });
});
