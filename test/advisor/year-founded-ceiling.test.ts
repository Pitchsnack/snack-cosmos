import { describe, expect, setSystemTime, test } from "bun:test";

// The advisor save path runs in a server bundle whose module-level code can be
// evaluated with the clock at the Unix epoch. A ceiling baked in at load time
// then rejects every real founding year, so the year limits must be computed
// when the data is parsed, not when the schema module loads.
const FIRM = {
  id: null, name: "ABC Advisory Co., Ltd.", firmType: "M&A Advisor", logoPath: null, logoSource: null,
  description: "An advisory firm supporting business transactions.", city: "Bangkok",
  country: "Thailand", registrationNo: "0105548098615", services: ["M&A"], fees: {}, dealBand: null,
  teamSize: 8, languages: ["English"], sectors: [], legalName: "ABC Advisory Co., Ltd.",
  website: "https://example.com", email: "test@example.com", phone: "+6621234567",
  team: [], credentials: [], documents: [],
  longDescription: "A longer description of the advisory firm.", contactName: "Somchai Test",
};

describe("Advisor year founded", () => {
  test("a past year still saves after the module loads at the epoch", async () => {
    setSystemTime(new Date("1970-01-01T00:00:00.000Z"));
    let mod: typeof import("../../src/lib/advisor-form-schema");
    try {
      // A fresh module instance, evaluated while the clock sits at 1970.
      mod = await import(`../../src/lib/advisor-form-schema.ts?epoch=${Date.now()}`);
    } finally {
      setSystemTime();
    }
    expect(mod.CompleteFirmInput.safeParse({ ...FIRM, yearFounded: 2014 }).success).toBe(true);
    expect(mod.DraftFirmInput.safeParse({ ...FIRM, yearFounded: 2014, legalName: "" }).success).toBe(true);
  });

  test("a year after the current one is rejected", async () => {
    const { CompleteFirmInput } = await import("../../src/lib/advisor-form-schema");
    const res = CompleteFirmInput.safeParse({ ...FIRM, yearFounded: new Date().getFullYear() + 1 });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues.some((i) => i.message === "Year cannot be in the future")).toBe(true);
  });
});
