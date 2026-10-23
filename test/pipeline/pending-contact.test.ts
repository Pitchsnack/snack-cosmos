import { describe, expect, test } from "bun:test";
import { advisorContactPending, buyerContactPending, sellerContactPending } from "../../src/lib/pending-contact";

describe("pending contact presentation", () => {
  test("seller submitted business awaiting Admin is pending", () => {
    expect(sellerContactPending([{ approval_status: "in_review", live: null }])).toBe(true);
  });
  test("seller with any live business is not pending, including edits awaiting review", () => {
    expect(sellerContactPending([{ approval_status: "in_review", live: null }, { approval_status: "live", live: {} }])).toBe(false);
    expect(sellerContactPending([{ approval_status: "in_review", live: {} }])).toBe(false);
  });
  test("seller with no submitted business retains Add your business first", () => {
    expect(sellerContactPending([])).toBe(false);
    expect(sellerContactPending([{ approval_status: "draft", live: null }])).toBe(false);
    expect(sellerContactPending([{ approval_status: "changes_requested", live: null }])).toBe(false);
  });
  test("buyer first pending check locks the action", () => {
    expect(buyerContactPending("pending", false)).toBe(true);
  });
  test("verified buyer awaiting recheck stays normal", () => {
    expect(buyerContactPending("pending", true)).toBe(false);
    expect(buyerContactPending("re_check", true)).toBe(false);
    expect(buyerContactPending("verified", true)).toBe(false);
  });
  test("advisor first pending check locks the action", () => {
    expect(advisorContactPending({ advisor_verification: "pending", verification_reason: "first_check", verified_at: null })).toBe(true);
  });
  test("advisor with a prior check or recheck stays normal", () => {
    expect(advisorContactPending({ advisor_verification: "pending", verification_reason: "re_check", verified_at: "2026-10-01" })).toBe(false);
    expect(advisorContactPending({ advisor_verification: "pending", verification_reason: "first_check", verified_at: "2026-10-01" })).toBe(false);
    expect(advisorContactPending({ advisor_verification: "verified" })).toBe(false);
  });
});