import { describe, expect, it } from "vitest";
import {
  detectDbdUnit,
  mapDbdLabel,
  normalizeRegisteredName,
  normalizeRegisteredNumber,
  parseDbdNumber,
  parseFiscalYear,
  toBaht,
} from "@/lib/financials/dbd-parse";
import {
  extractTables,
  parseSearchResults,
  parseStatementTables,
} from "@/lib/financials/dbd-test-scraper.server";

describe("DBD number parsing", () => {
  it("parses grouped numbers and decimals", () => {
    expect(parseDbdNumber("1,234,567.89")).toBe(1234567.89);
  });
  it("treats parentheses as negative", () => {
    expect(parseDbdNumber("(250,000)")).toBe(-250000);
  });
  it("keeps blanks and dashes null, never 0", () => {
    expect(parseDbdNumber("")).toBeNull();
    expect(parseDbdNumber("-")).toBeNull();
    expect(parseDbdNumber(null)).toBeNull();
  });
});

describe("identity normalisation", () => {
  it("preserves leading zeroes as string", () => {
    expect(normalizeRegisteredNumber(" 0105555078063 ")).toBe("0105555078063");
  });
  it("collapses spaces and lowercases names", () => {
    expect(normalizeRegisteredName("  Example   Company  LIMITED ")).toBe(
      "example company limited",
    );
  });
});

describe("units and years", () => {
  it("detects and converts units explicitly", () => {
    expect(detectDbdUnit("หน่วย : พันบาท")).toBe("thousand_baht");
    expect(toBaht(5, "thousand_baht")).toBe(5000);
    expect(toBaht(5, null)).toBe(5);
  });
  it("converts Buddhist-era years", () => {
    expect(parseFiscalYear("ปี 2568")).toBe(2025);
    expect(parseFiscalYear("2024")).toBe(2024);
  });
});

describe("table parsing", () => {
  const html = `
  <table>
    <tr><th>รายการ</th><th>2567</th><th>2568</th></tr>
    <tr><td>รายได้รวม</td><td>1,000,000</td><td>1,200,000</td></tr>
    <tr><td>กำไรสุทธิ</td><td>(50,000)</td><td>-</td></tr>
    <tr><td>สินทรัพย์รวม</td><td>2,000,000</td><td>2,500,000</td></tr>
    <tr><td>บรรทัดไม่รู้จัก</td><td>1</td><td>2</td></tr>
  </table>`;

  it("keeps fiscal years separate and maps labels by row", () => {
    const { statements, unmapped } = parseStatementTables(extractTables(html), null);
    expect(statements.map((s) => s.fiscalYear)).toEqual([2024, 2025]);
    expect(statements[0].income.total_revenue).toBe(1000000);
    expect(statements[0].income.net_profit_loss).toBe(-50000);
    expect(statements[1].income.net_profit_loss).toBeUndefined();
    expect(statements[1].position.total_assets).toBe(2500000);
    expect(unmapped).toContain("บรรทัดไม่รู้จัก");
  });

  it("has a centralised label map", () => {
    expect(mapDbdLabel("สินทรัพย์รวม")?.code).toBe("total_assets");
    expect(mapDbdLabel("unknown row")).toBeNull();
  });

  it("reads company candidates from search results", () => {
    const results = parseSearchResults(
      `<a href="/company/profile/0105555078063">EXAMPLE COMPANY LIMITED</a>
       <a href="/company/profile/0105548111222">EXAMPLE COMPANY (THAILAND) LIMITED</a>`,
    );
    expect(results.map((r) => r.registeredNumber)).toEqual(["0105555078063", "0105548111222"]);
  });
});
