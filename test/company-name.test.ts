import { describe, expect, test } from "bun:test";
import { optionalCompanyName } from "../src/lib/company-name";

describe("Optional profile names", () => {
  test("allows exactly 200 characters, rejects 201", () => {
    expect(optionalCompanyName.parse("ก".repeat(200))).toHaveLength(200);
    expect(optionalCompanyName.safeParse("ก".repeat(201)).success).toBe(false);
  });
  test("trims surrounding spaces", () => {
    expect(optionalCompanyName.parse("  ABC Trading Co., Ltd.  ")).toBe("ABC Trading Co., Ltd.");
  });
  test("empty is allowed and omitted values remain omitted", () => {
    expect(optionalCompanyName.parse("   ")).toBeNull();
    expect(optionalCompanyName.parse(undefined)).toBeUndefined();
  });
});