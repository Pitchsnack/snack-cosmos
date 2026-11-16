import { describe, expect, it } from "vitest";
import { SECTOR_GROUPS, sectorPickerGroup } from "@/lib/sectors";
import { TH } from "@/i18n/th";
import { EDIT_INFO_TH } from "@/i18n/th-edit-info";

describe("seller two-pane sector picker", () => {
  it("opens Automotive in Industrials and keeps one saved sector value", () => {
    expect(sectorPickerGroup("Automotive")).toBe("Industrials");
    expect(SECTOR_GROUPS.find((group) => group.group === "Industrials")?.sectors).toContain("Automotive");
  });

  it("opens Services when no sector has been picked", () => {
    expect(sectorPickerGroup(null)).toBe("Services");
    expect(sectorPickerGroup("")).toBe("Services");
  });

  it("uses the app's Thai for every group and sector", () => {
    for (const group of SECTOR_GROUPS) {
      expect(TH[group.group], group.group).toBeTruthy();
      for (const sector of group.sectors) expect(TH[sector], sector).toBeTruthy();
    }
  });

  it("uses the requested Thai selected and required-empty wording", () => {
    expect(TH["Selected:"]).toBe("เลือกแล้ว:");
    expect(TH["No sector picked yet"]).toBe("ยังไม่ได้เลือกกลุ่มอุตสาหกรรม");
    expect(EDIT_INFO_TH["Choose a business model…"]).toBe("เลือกรูปแบบธุรกิจ…");
  });
});
