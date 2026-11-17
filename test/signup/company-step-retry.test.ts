import { describe, expect, it } from "vitest";
import { cachedSignupRetry, planAddCheck } from "@/lib/registration-retry";
import { R, R_ADD } from "@/components/login/signup-reg-copy";
import { companySetupReason } from "@/components/login/business-steps";
import type { RegCompany } from "@/lib/signup-reg.functions";

const company: RegCompany = {
  nameTh: "บริษัท ทดสอบ จำกัด", nameEn: "Test Co., Ltd.", regDate: "2020-01-01", regDateTh: null,
  addressTh: "1 ถนนทดสอบ", addressEn: "1 Test Road", translated: false, statusTh: "ยังดำเนินกิจการอยู่", active: true,
};

describe("standard company-step copy", () => {
  it("uses one exact bilingual no-registration link in sign-up and + Add", () => {
    const en = "I don't have a company registration number, or my company is registered outside Thailand.";
    const th = "ฉันไม่มีเลขทะเบียนนิติบุคคล หรือบริษัทของฉันจดทะเบียนในต่างประเทศ";
    expect(R.noReg).toEqual({ en, th });
    expect(R_ADD.noReg).toEqual({ en, th });
  });

  it("uses the requested Thai sign-up line without changing English or + Add", () => {
    expect(R.coLine.company.th).toBe("เราจะตรวจสอบข้อมูลบริษัทของท่านก่อนเปิดใช้งานบัญชี");
    expect(R.coLine.company.en).toBe("We verify your company before creating your account.");
    expect(R_ADD.coLine.company.th).toBe("เราจะยืนยันบริษัทของท่านก่อนเพิ่มเข้าในบัญชี");
  });

  it("uses the exact additional-details label and response notes", () => {
    expect(R.anything.en).toBe("Share any additional details or requests that may help us assist you.");
    expect(R.anything.th).toBe("แจ้งข้อมูลหรือความต้องการเพิ่มเติม");
    expect(R.sNote.en).toBe("Our team replies within 1 business day. No account is created yet.");
    expect(R_ADD.sNote.en).toBe("Our team replies within 1 business day. Nothing has been added yet.");
    expect(R.sNote.th).toBe("ทีมของเราจะติดต่อท่านภายใน 1 วันทำการ ขณะนี้ยังไม่มีการสร้างบัญชี");
    expect(R_ADD.sNote.th).toBe("ทีมของเราจะติดต่อท่านภายใน 1 วันทำการ ยังไม่มีการเพิ่มบริษัท");
  });

  it("keeps role-specific assisted-setup reasons in the shared company step", () => {
    expect(companySetupReason("seller", "owner", "Thailand", true)).toBe("no_number");
    expect(companySetupReason("buyer", "individual", "Thailand", true)).toBe("individual");
    expect(companySetupReason("buyer", "corporate", "Singapore", false)).toBe("outside_buyer");
    expect(companySetupReason("advisor", "Law firm", "Singapore", false)).toBe("outside_advisor");
    expect(companySetupReason("seller", "owner", "Thailand", false)).toBeNull();
  });
});

describe("sign-up cached correction", () => {
  it("reopens a rejected company as change 1 of 2 without another lookup", () => {
    expect(cachedSignupRetry({ status: "rejected", reg: "0575569006490", company, raw: { cached: true } }, "0575569006490", 0)).toEqual({
      status: "found", reg: "0575569006490", changes: 1, company, raw: { cached: true },
    });
  });

  it("counts a second retry of the same rejected number as change 2", () => {
    expect(cachedSignupRetry({ status: "rejected", reg: "0575569006490", company }, "0575569006490", 1)?.changes).toBe(2);
  });

  it("reuses not-found and refuses a third correction", () => {
    expect(cachedSignupRetry({ status: "not_found", reg: "0575569006490" }, "0575569006490", 1)).toMatchObject({ status: "not_found", changes: 2 });
    expect(cachedSignupRetry({ status: "rejected", reg: "0575569006490", company }, "0575569006490", 2)).toBeNull();
  });
});

describe("+ Add cached correction", () => {
  it("uses one change when the same rejected number is submitted again", () => {
    const plan = planAddCheck([{ reg_no: "0575569006490", result: "no", held: { company, raw: null } }], "0575569006490");
    expect(plan).toMatchObject({ status: "cached_found", changesLeft: 1, company });
  });

  it("uses the second change on a second No and permits no third correction", () => {
    const attempts = [
      { reg_no: "0575569006490", result: "no", held: { company, raw: null } },
      { reg_no: "0575569006490", result: "no", held: { company, raw: null } },
    ];
    expect(planAddCheck(attempts, "0575569006490")).toMatchObject({ status: "cached_found", changesLeft: 0 });
    expect(planAddCheck([...attempts, attempts[1]!], "0575569006490")).toEqual({ status: "limit", why: "changes" });
  });

  it("reuses a not-found outcome and only looks up an uncached number", () => {
    expect(planAddCheck([{ reg_no: "0575569006490", result: "not_found" }], "0575569006490")).toEqual({ status: "cached_not_found", changesLeft: 1 });
    expect(planAddCheck([{ reg_no: "0575569006490", result: "not_found" }], "0105559108340")).toEqual({ status: "lookup", changesLeft: 1 });
  });
});
