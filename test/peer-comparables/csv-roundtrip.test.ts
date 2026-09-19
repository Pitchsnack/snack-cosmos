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
  it("round-trips sector and as-at", () => {
    const csv = listedCompaniesToCsv([
      {
        id: "1",
        ticker: "TU",
        name: "Thai Union Group",
        market: "SET",
        sector: "Food & Beverage",
        revenueThbM: 136000,
        ebitdaMarginPct: 8.4,
        evEbitda: null,
        pe: 14.2,
        pbv: 1.1,
        asAt: "2026-01-31",
        usedIn: 2,
        usedInSets: ["a", "b"],
      },
    ]);
    const { rows, errors } = parseListedCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      ticker: "TU",
      name: "Thai Union Group",
      market: "SET",
      sector: "Food & Beverage",
      evEbitda: null,
      asAt: "2026-01-31",
    });
  });
});
