import { describe, expect, it } from "vitest";
import { applyIdentityFinding, buyerIdentityValues, fixedIdentityFindings, publicIdentityValues, scanIdentityReview, sellerIdentityFacts, sellerIdentityValues } from "../../src/lib/identity-review";

const startup = {
  startup_name: "Falcon Co., Ltd.", registered_name: "Falcon Company Limited", website_url: "https://www.falcon.co.th",
  address_city_district: "Mueang Nonthaburi", address_line1: "99/9 Example Road", address_province_state: "Nonthaburi", city: "Nonthaburi",
};
const facts = sellerIdentityFacts(startup, [{ full_name: "Somchai Example" }], {});

describe("Admin identity review", () => {
  it("does not flag a province, region or country on its own", () => {
    const values = { short_description: "Serving Nonthaburi, Central Thailand and Thailand" };
    expect(scanIdentityReview(values, { companyNames: [], districts: [], streets: [] })).toEqual([]);
  });

  it("finds a company name with its before and after position", () => {
    const [finding] = scanIdentityReview({ short_description: "We acquire Falcon Company Limited for growth" }, facts);
    expect(finding).toMatchObject({ reason: "Company name", term: "Falcon Company Limited", start: 11, end: 33, replacement: "the company" });
  });

  it("uses sentence-case and possessive company replacements", () => {
    const [plain] = scanIdentityReview({ short_description: "Falcon Company Limited acquires firms" }, facts);
    const [possessive] = scanIdentityReview({ short_description: "Falcon Company Limited's team acquires firms" }, facts);
    expect(plain.replacement).toBe("The company");
    expect(possessive.replacement).toBe("the company's");
    expect(possessive.term).toBe("Falcon Company Limited's");
  });

  it("changes only the flagged field with the one-click fix", () => {
    const values = { short_description: "Falcon Co., Ltd. buys firms", short_description_th: "Falcon Co., Ltd. ซื้อธุรกิจ" };
    const [finding] = scanIdentityReview(values, facts);
    const next = applyIdentityFinding(values, finding);
    expect(next.short_description).toBe("The company buys firms");
    expect(next.short_description_th).toBe(values.short_description_th);
  });

  it("checks tags as individual public fields", () => {
    const values = sellerIdentityValues({}, { product_tags: ["Logistics", "Falcon Company Limited"] });
    const findings = scanIdentityReview(values, facts);
    expect(findings.some(f => f.field === "product_tags.1" && f.label === "Product & Service Tags · 2")).toBe(true);
  });

  it("never checks Long description, About the founder or post-NDA values", () => {
    const values = sellerIdentityValues({ named_customers: ["Secret Customer"], website_url: "https://private.example" }, { long_description: "Falcon Company Limited", long_description_th: "Falcon Company Limited" });
    expect(Object.keys(values).some(k => k.startsWith("long_description") || k.startsWith("named_customers") || k.startsWith("website_url"))).toBe(false);
    expect(publicIdentityValues(values)).toEqual({ code_name: "", suggested_listing_name: "", headline: "", headline_th: "", short_description: "", short_description_th: "", customers_summary: "", customers_summary_th: "" });
  });

  it("changes a district to its province unless the province is adjacent", () => {
    const districtFacts = { districts: ["Bang Bua Thong"], provinces: ["Nonthaburi"] };
    const [alone] = scanIdentityReview({ short_description: "maker in Bang Bua Thong." }, districtFacts);
    const [adjacent] = scanIdentityReview({ short_description: "maker in Bang Bua Thong, Nonthaburi." }, districtFacts);
    expect(alone).toMatchObject({ replacement: "Nonthaburi", suggestion: 'Change to "Nonthaburi"' });
    expect(adjacent).toMatchObject({ replacement: "", suggestion: "Remove it" });
  });

  it("removes a district tag when the province tag is already there", () => {
    const values = { "market_tags.0": "Nonthaburi", "market_tags.1": "Bang Bua Thong" };
    const [finding] = scanIdentityReview(values, { districts: ["Bang Bua Thong"], provinces: ["Nonthaburi"] });
    expect(finding).toMatchObject({ field: "market_tags.1", replacement: "", suggestion: "Remove it" });
  });

  it("checks only the buyer public description twins", () => {
    const values = buyerIdentityValues({ description: "Lakeshore Capital is buying", description_th: "", legal_name: "Lakeshore Capital" });
    expect(publicIdentityValues(values)).toEqual({ description: "Lakeshore Capital is buying", description_th: "" });
    expect(scanIdentityReview(values, { companyNames: ["Lakeshore Capital"] })[0]?.reason).toBe("Company name");
  });

  it("keeps fixed findings separate from words still to check", () => {
    const original = scanIdentityReview({ short_description: "Falcon Company Limited and Somchai Example" }, facts);
    const current = scanIdentityReview({ short_description: "the company and Somchai Example" }, facts);
    const fixed = fixedIdentityFindings(original, current);
    expect(fixed.map(f => f.reason)).toEqual(["Company name"]);
    expect(current.map(f => f.reason)).toEqual(["Owner or director name"]);
  });

  it("rejects a stale fix instead of overwriting newer wording", () => {
    const values = { short_description: "Falcon Company Limited" };
    const [finding] = scanIdentityReview(values, facts);
    expect(() => applyIdentityFinding({ short_description: "Falcon Changed Limited" }, finding)).toThrow("wording changed");
  });
});
