import { afterEach, describe, expect, it, vi } from "vitest";

const oldKey = process.env.FIRECRAWL_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (oldKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = oldKey;
});

describe("sign-up company-only register lookup", () => {
  it("reads one profile without financial actions and never poisons the full-lookup cache", async () => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    const html = `
      <div>ชื่อนิติบุคคล : บริษัท ทดสอบ จำกัด (มหาชน) เลขทะเบียนนิติบุคคล : 0107568000248</div>
      <table>
        <tr><td>ชื่อนิติบุคคลภาษาอังกฤษ</td><td>TEST PUBLIC COMPANY LIMITED</td></tr>
        <tr><td>สถานะนิติบุคคล</td><td>ยังดำเนินกิจการอยู่</td></tr>
        <tr><td>วันที่จดทะเบียนจัดตั้ง</td><td>10 ตุลาคม 2568</td></tr>
        <tr><td>ที่ตั้งสำนักงานใหญ่</td><td>1 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพมหานคร 10000</td></tr>
      </table>`;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { rawHtml: html } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { lookupDbdFinancialsViaFirecrawl } = await import("@/lib/financials/dbd-firecrawl.server");

    const company = await lookupDbdFinancialsViaFirecrawl({ registeredNumber: "0107568000248", companyOnly: true });
    expect(company.status).toBe("no_financials");
    if (company.status !== "no_financials") throw new Error("Expected company-only outcome");
    expect(company.company.companyInfo?.legalNameTh).toBe("บริษัท ทดสอบ จำกัด (มหาชน)");
    expect(company.company.companyInfo?.registrationDate).toBe("2025-10-10");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { actions: { type: string }[]; waitFor: number };
    expect(firstBody.actions).toEqual([]);
    expect(firstBody.waitFor).toBe(8000);

    // A later Admin/report extraction must not reuse the identity-only cached result.
    const full = await lookupDbdFinancialsViaFirecrawl({ registeredNumber: "0107568000248" });
    expect(full.status).toBe("no_financials");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
