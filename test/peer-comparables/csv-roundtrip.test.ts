import { describe, expect, it } from "vitest";
import {
  parsePeerCsv,
  peerSetCsvFilename,
  peersToCsv,
  type Peer,
} from "@/lib/peer-comparables";
import { listedCompaniesToCsv, parseListedCsv } from "@/lib/listed-companies";

const peers: Peer[] = [
  {
    companyName: "Thai Union Group",
    ticker: "TU",
    market: "SET",
    revenueThbM: 136000,
    ebitdaMarginPct: 8.4,
    evEbitda: 9.1,
    pe: 14.2,
    pbv: 1.1,
  },
  {
    companyName: "Zen Corporation Group",
    ticker: "ZEN",
    market: "mai",
    revenueThbM: 3100,
    ebitdaMarginPct: null,
    evEbitda: null,
    pe: null,
    pbv: 2.3,
  },
];

describe("peer set CSV", () => {
  it("round-trips through the import parser", () => {
    const csv = peersToCsv(peers);
    const { peers: back, errors } = parsePeerCsv(csv);
    expect(errors).toEqual([]);
    expect(back).toEqual(peers);
  });

  it("omits the median row and leaves empty metrics empty", () => {
    const csv = peersToCsv(peers);
    expect(csv).not.toMatch(/median/i);
    expect(csv.split("\n")[2]).toBe("Zen Corporation Group,ZEN,mai,3100,,,,2.3");
  });

  it("produces a header-only file for an empty set", () => {
    expect(peersToCsv([]).split("\n")).toHaveLength(1);
  });

  it("names the file by sector, model and date", () => {
    expect(peerSetCsvFilename("Food & Beverage", null, "2026-02-10")).toBe(
      "peer-set_food-beverage_all_2026-02-10.csv",
    );
    expect(peerSetCsvFilename("Commerce", "software_saas", "2026-02-10")).toBe(
      "peer-set_commerce_software-saas_2026-02-10.csv",
    );
  });
});

describe("listed companies CSV", () => {
  it("round-trips sector, period, tag and as-at", () => {
    const csv = listedCompaniesToCsv([
      {
        id: "1",
        ticker: "TU",
        name: "Thai Union Group",
        market: "SET",
        exchangeGroup: "Agro & Food",
        sector: "Food & Beverage",
        revenueThbM: 136000,
        ebitdaMarginPct: 8.4,
        evEbitda: null,
        pe: 14.2,
        pbv: 1.1,
        statementPeriod: "Dec-25",
        tag: "Seafood",
        asAt: "2026-01-31",
        usedIn: 2,
        usedInSets: ["a", "b"],
      },
    ]);
    expect(csv.split("\n")[0]).toBe(
      "company,ticker,market,SET_Group,sector,revenue_thb_m,ebitda_margin_pct,ev_ebitda,pe,pbv,Gross_Margin,Net_Margin,ROE,Debt_Equity,Revenue_growth,statement_period,tag,as_at",
    );
    const { rows, errors } = parseListedCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      ticker: "TU",
      name: "Thai Union Group",
      market: "SET",
      exchangeGroup: "Agro & Food",
      sector: "Food & Beverage",
      evEbitda: null,
      statementPeriod: "Dec-25",
      tag: "Seafood",
      asAt: "2026-01-31",
    });
  });

  it("imports a file without the new columns, leaving them null", () => {
    const { rows, errors } = parseListedCsv(
      "company,ticker,market,sector,revenue_thb_m,ebitda_margin_pct,ev_ebitda,pe,pbv,as_at\nPTT,PTT,SET,Energy,100,,,,,2026-01-01",
    );
    expect(errors).toEqual([]);
    expect(rows[0].statementPeriod).toBeNull();
    expect(rows[0].tag).toBeNull();
    expect(rows[0].exchangeGroup).toBeNull();
    expect(rows[0].ebitdaMarginPct).toBeNull();
  });

  it("accepts Dec-2025 and DD/MM/YYYY dates", () => {
    const { rows } = parseListedCsv(
      "company,ticker,statement_period,as_at\nADVANC,ADVANC,Dec-2025,20/09/2026",
    );
    expect(rows[0].statementPeriod).toBe("Dec-2025");
    expect(rows[0].asAt).toBe("2026-09-20");
  });

  it("reads Exchange_Industry by header, whatever the column order", () => {
    const { rows, errors } = parseListedCsv(
      "ticker,Exchange_Industry,company,market,sector\nPTT,Resources,PTT PUBLIC COMPANY LIMITED,SET,Energy & Utilities",
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      ticker: "PTT",
      exchangeGroup: "Resources",
      sector: "Energy & Utilities",
    });
  });

  it("warns about an unknown column instead of failing", () => {
    const { rows, errors } = parseListedCsv("company,ticker,wibble\nPTT,PTT,x");
    expect(rows).toHaveLength(1);
    expect(errors.join(" ")).toMatch(/wibble/);
  });
});

