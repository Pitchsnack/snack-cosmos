import { describe, expect, it } from "vitest";
import { sellerOwnerPrivate } from "@/components/my-business/seller-owner-card";
import type { StartupListItem } from "@/lib/startups.functions";

describe("seller Exclusive view uses the owner's real identity", () => {
  const s = { startup_name: "Acme", registered_name: "Acme Co., Ltd.", short_description: "We make widgets", short_description_th: "ไทย", last_year_revenue: "1200000", tile_image_signed_url: null, logo_url: "a/logo.png", city: "Bangkok", year_founded: 2010, website_url: null } as unknown as StartupListItem;
  it("shows the real name, own description and exact revenue", () => {
    const p = sellerOwnerPrivate(s, "en");
    expect(p.companyName).toBe("Acme Co., Ltd.");
    expect(p.description).toBe("We make widgets");
    expect(p.revenue).toBe(1200000);
  });
  it("follows Thai", () => expect(sellerOwnerPrivate(s, "th").description).toBe("ไทย"));
});
