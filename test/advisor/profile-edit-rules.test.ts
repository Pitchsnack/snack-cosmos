import {describe, expect, test} from "bun:test";
import {missingCreationFields, preservePortfolioEntries} from "../../src/lib/profile-edit-rules";
describe("Shared profile creation", () => {
  test("startup creation needs company name and tenant plus existing owners", () => {
    expect(missingCreationFields("startup", "", "", "owner", "ai")).toEqual(["Company Name", "Tenant"]);
    expect(missingCreationFields("startup", "Company", "tenant", "owner", "ai")).toEqual([]);
  });
  test("investor creation retains required ownership", () => {
    expect(missingCreationFields("investor", "Company", "tenant")).toEqual(["Owning Agent", "Owning AI Agent"]);
  });
  test("advisor creation needs only a firm name", () => {
    expect(missingCreationFields("advisor", "")).toEqual(["Firm name"]);
    expect(missingCreationFields("advisor", "Draft firm")).toEqual([]);
  });
  test("unchanged portfolio entries keep their notes", () => {
    expect(preservePortfolioEntries(["Company", "New"], [{name:"Company",note:"Existing note"}])).toEqual([{name:"Company",note:"Existing note"},{name:"New",note:""}]);
  });
});