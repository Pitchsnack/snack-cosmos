import {describe,expect,test} from "bun:test";
import {canEditDirectoryInvestor} from "../../src/lib/profile-edit-access";
describe("Directory investor editing",()=>{
  test("only Admin can edit another investor",()=>{
    expect(canEditDirectoryInvestor("buyer",true)).toBe(false);
    expect(canEditDirectoryInvestor("seller",true)).toBe(false);
    expect(canEditDirectoryInvestor("advisor",true)).toBe(false);
  });
  test("Admin still needs the existing Edit Investor management scope",()=>{
    expect(canEditDirectoryInvestor("admin",false)).toBe(false);
    expect(canEditDirectoryInvestor("admin",true)).toBe(true);
  });
});