import { thbOf } from "@/lib/asking-price";
import { handoverLine } from "@/lib/hidden-profile";

export type PartyDirection = "buyer_on_seller" | "seller_on_buyer";
type Fields = Record<string, string | null>;

const fullName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || null;
const money = (n: any) => {
  if (n == null) return null;
  const v = Number(n);
  return v >= 1e6 ? `THB ${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M` : `THB ${v.toLocaleString("en-US")}`;
};
function sizeLabel(type: string | null) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("family")) return "Assets under management";
  if (t.includes("corporate") || t.includes("strategic")) return "Group revenue";
  return "Fund size";
}

/** Profile facts of the other party for the advisor profile view (read-only; nothing stored). */
export async function buildPartyProfile(sb: any, p: any, direction: PartyDirection) {
  const { data: hp } = await sb.from("hidden_profiles").select("code_name, asking_price, asking_price_thb, deal_type, reason, owner_stays, handover_months").eq("id", p.hidden_profile_id).maybeSingle();
  const deal = {
    askingPrice: money(thbOf(hp)),
    handover: handoverLine(hp?.owner_stays, hp?.handover_months),
    dealType: hp?.deal_type ?? null,
    reason: hp?.reason ?? null,
  };
  if (direction === "buyer_on_seller") {
    const [{ data: st }, { data: own }] = await Promise.all([
      sb.from("startups").select("startup_name, industry, city, headquarters, year_founded, company_size, website_url, short_description, logo_url").eq("id", p.startup_id).maybeSingle(),
      sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", p.startup_id).maybeSingle(),
    ]);
    let contact: string | null = null;
    if (own?.owning_agent_user_id) {
      const [{ data: u }, { data: up }] = await Promise.all([
        sb.from("users").select("first_name, last_name, email").eq("id", own.owning_agent_user_id).maybeSingle(),
        sb.from("user_profiles").select("title").eq("user_id", own.owning_agent_user_id).maybeSingle(),
      ]);
      contact = [fullName(u), up?.title ?? "Owner"].filter(Boolean).join(" · ") || null;
    }
    return {
      subject: String(p.startup_id),
      name: st?.startup_name || hp?.code_name || hp?.ref_no || "Business",
      sub: [st?.industry, st?.city].filter(Boolean).join(" · ") || null,
      logoUrl: st?.logo_url ?? null, verified: true,
      codeName: hp?.code_name ?? null, sizeLabel: null, contact,
      generated: {
        summary: st?.short_description ?? null,
        founded: st?.year_founded ? String(st.year_founded) : null,
        employees: st?.company_size ?? null,
        website: st?.website_url ?? null,
        address: st?.headquarters || st?.city || null,
        ...deal,
      } as Fields,
    };
  }
  const [{ data: bv }, { data: up }, { data: u }] = await Promise.all([
    (await import("./profile-verification.server")).verificationByUser(sb, p.buyer_user_id, "company_name, buyer_type, status, website").then((data: any) => ({ data })),
    sb.from("user_profiles").select("title, organisation, bio, city, country, industry_focus, buyer_type, experience, website").eq("user_id", p.buyer_user_id).maybeSingle(),
    sb.from("users").select("first_name, last_name, email").eq("id", p.buyer_user_id).maybeSingle(),
  ]);
  const type = bv?.buyer_type || up?.buyer_type || null;
  const sectors = Array.isArray(up?.industry_focus) ? up.industry_focus.join(", ") : up?.industry_focus ?? null;
  return {
    subject: String(p.buyer_user_id),
    name: bv?.company_name || up?.organisation || fullName(u) || "Buyer",
    sub: [type, up?.city].filter(Boolean).join(" · ") || null,
    logoUrl: null, verified: bv?.status === "verified",
    codeName: null, sizeLabel: sizeLabel(type),
    contact: [fullName(u), up?.title].filter(Boolean).join(" · ") || null,
    generated: {
      about: up?.bio ?? null,
      size: null,
      trackRecord: up?.experience ?? null,
      website: bv?.website || up?.website || null,
      address: [up?.city, up?.country].filter(Boolean).join(", ") || null,
      ticket: null,
      sectors: sectors || null,
      mandateDealType: null,
      ...deal,
    } as Fields,
  };
}

