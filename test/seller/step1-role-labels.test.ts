/**
 * Step 1 of the seller wizard must offer its three role choices in the language
 * the seller is reading, not Thai-only text. The stored answer is the key
 * ("owner" | "family_owner" | "agent"), so wording can change freely.
 */
import { describe, expect, it } from "vitest";
import { SELLER_RELATIONS, type SellerRelation } from "@/lib/seller-wizard";

const THAI = /[\u0E00-\u0E7F]/;

describe("seller wizard Step 1 role choices", () => {
  it("keeps exactly the three stored relation keys", () => {
    expect(SELLER_RELATIONS.map((r) => r.value)).toEqual<SellerRelation[]>(["owner", "family_owner", "agent"]);
  });

  it("gives every choice English wording that the English UI can show", () => {
    for (const r of SELLER_RELATIONS) {
      expect(r.label[0].trim().length, `${r.value} English label`).toBeGreaterThan(0);
      expect(r.hint[0].trim().length, `${r.value} English hint`).toBeGreaterThan(0);
      expect(THAI.test(r.label[0]), `${r.value} English label has no Thai`).toBe(false);
      expect(THAI.test(r.hint[0]), `${r.value} English hint has no Thai`).toBe(false);
    }
  });

  it("keeps the Thai wording for the Thai UI", () => {
    for (const r of SELLER_RELATIONS) {
      expect(THAI.test(r.label[1]), `${r.value} Thai label`).toBe(true);
      expect(THAI.test(r.hint[1]), `${r.value} Thai hint`).toBe(true);
    }
  });
});
