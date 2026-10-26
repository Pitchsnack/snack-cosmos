import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pipeline › Investor profile / Seller profile box: read-only facts about the
 * OTHER side of one deal. Private facts (person, firm/company, contacts,
 * website) leave the server only while the NDA is approved and valid; otherwise
 * only the public investor profile (as in Browse investors) is returned.
 */

export type ProfilePerson = {
  name: string; title: string | null; organisation: string | null; bio: string | null;
  email: string | null; phone: string | null; linkedin: string | null; avatarUrl: string | null; verified: boolean;
};
export type ProfileBox =
  | {
      kind: "private"; side: "seller" | "buyer"; person: ProfilePerson;
      org: { name: string; line: string | null; logoUrl: string | null; rows: { key: string; value: string; href?: string }[] };
      listingId: string | null;
    }
  | {
      kind: "public"; side: "seller"; pending: boolean;
      type: string; ref: string | null; country: string | null; range: string | null; sectors: string | null; dealTypes: string | null;
    };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const fullName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "—";
const list = (v: any) => (Array.isArray(v) ? v.filter(Boolean).join(" · ") : v ? String(v) : "") || null;
const url = (w: string) => (/^https?:/i.test(w) ? w : `https://${w}`);
const thb = (n: any) => {
  if (n == null || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v >= 1e6 ? `THB ${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M` : `THB ${v.toLocaleString("en-US")}`;
};

async function person(sb: any, userId: string | null, verified: boolean): Promise<ProfilePerson> {
  if (!userId) return { name: "—", title: null, organisation: null, bio: null, email: null, phone: null, linkedin: null, avatarUrl: null, verified };
  const [{ data: u }, { data: up }] = await Promise.all([
    sb.from("users").select("first_name, last_name, email").eq("id", userId).maybeSingle(),
    sb.from("user_profiles").select("title, organisation, bio, phone, linkedin").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    name: fullName(u), title: up?.title || null, organisation: up?.organisation || null, bio: up?.bio || null,
    email: u?.email || null, phone: up?.phone || null, linkedin: up?.linkedin || null, avatarUrl: null, verified,
  };
}

export const getProfileBox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ data, context: ctx }): Promise<ProfileBox> => {
    const sb = await admin();
    const { data: p } = await sb.from("deal_pipelines").select("*").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Deal not found");
    // The caller says which side they are viewing from; never guessed.
    const side: "seller" | "buyer" = data.as;
    if (side === "buyer") {
      // Same rule as the buyer's Pipeline list (listPipeline as buyer).
      if (p.buyer_user_id !== ctx.userId) throw new Error("Not your deal");
    } else {
      // Same rule as the seller's Pipeline list: own or member of the business, in the active workspace.
      const [{ data: own }, { data: su }] = await Promise.all([
        sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", ctx.userId).eq("startup_id", p.startup_id),
        sb.from("startup_users").select("startup_id").eq("user_id", ctx.userId).eq("startup_id", p.startup_id),
      ]);
      const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))];
      const scoped = await (await import("@/lib/workspace-scope.server")).scopeStartupIds(ctx.userId, ids);
      if (!scoped.includes(p.startup_id)) throw new Error("Not your deal");
    }
    const valid = !!p.nda_approved_at && !p.ended_at && (!p.nda_expires_at || new Date(p.nda_expires_at).getTime() > Date.now());

    const { data: bp } = await sb.from("buyer_profiles").select("investor_id, city, country, logo_url, sectors, deal_types, ticket_exact, ticket_min, ticket_max").eq("user_id", p.buyer_user_id).maybeSingle();

    if (!valid) {
      // Only the seller has a box before an approved NDA; buyers get "View listing" instead.
      if (side !== "seller") throw new Error("The seller's profile opens once your NDA is approved");
      const { loadPublicInvestors } = await import("./investor-browse.functions");
      const [pub] = bp?.investor_id ? await loadPublicInvestors(sb, [bp.investor_id]) : [];
      return {
        kind: "public", side: "seller", pending: !p.nda_approved_at && !p.ended_at,
        type: pub?.codeName ?? "Investor", ref: pub?.refNo ?? null, country: pub?.country ?? null,
        range: pub?.ticketBand ?? null, sectors: list(pub?.sectors), dealTypes: list(pub?.dealTypes),
      };
    }

    if (side === "seller") {
      // The buyer and their investor profile.
      const { data: inv } = bp?.investor_id
        ? await sb.from("investors").select("investor_name, firm_name, investor_type, website_url, logo_url, preferred_industries, min_ticket_size, max_ticket_size").eq("id", bp.investor_id).maybeSingle()
        : { data: null };
      const { data: vr } = bp?.investor_id ? await sb.rpc("investor_is_verified", { _ids: [bp.investor_id] }) : { data: [] };
      const verified = !!((vr ?? []) as any[]).find((v) => v.verified);
      const per = await person(sb, p.buyer_user_id, verified);
      const ticket = bp?.ticket_exact ? thb(bp.ticket_exact)
        : (bp?.ticket_min ?? inv?.min_ticket_size) != null || (bp?.ticket_max ?? inv?.max_ticket_size) != null
          ? [thb(bp?.ticket_min ?? inv?.min_ticket_size), thb(bp?.ticket_max ?? inv?.max_ticket_size)].filter(Boolean).join(" – ")
          : null;
      const web = inv?.website_url || null;
      const rows = [
        { key: "Ticket size", value: ticket },
        { key: "Sectors", value: list(bp?.sectors?.length ? bp.sectors : inv?.preferred_industries) },
        { key: "Deal types", value: list(bp?.deal_types) },
        { key: "Website", value: web ? web.replace(/^https?:\/\//, "").replace(/\/$/, "") : null, href: web ? url(web) : undefined },
      ].filter((r) => r.value) as { key: string; value: string; href?: string }[];
      return {
        kind: "private", side, person: per, listingId: null,
        org: {
          name: inv?.investor_name || inv?.firm_name || per.organisation || per.name,
          line: [inv?.investor_type, bp?.city].filter(Boolean).join(" · ") || null,
          logoUrl: bp?.logo_url || inv?.logo_url || null, rows,
        },
      };
    }

    // Buyer: the seller (the company's owning user), their company and listing.
    const [{ data: st }, { data: own }, { data: hp }] = await Promise.all([
      sb.from("startups").select("startup_name, industry, city, address_province_state, year_founded, company_size, website_url, logo_url").eq("id", p.startup_id).maybeSingle(),
      sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", p.startup_id).maybeSingle(),
      sb.from("hidden_profiles").select("code_name, ref_no, deal_type").eq("id", p.hidden_profile_id).maybeSingle(),
    ]);
    const per = await person(sb, own?.owning_agent_user_id ?? null, true);
    const founded = [st?.year_founded ? String(st.year_founded) : null, st?.company_size ? `{n}:${st.company_size}` : null].filter(Boolean).join(" · ") || null;
    const web = st?.website_url || null;
    const rows = [
      { key: "Listed as", value: [hp?.code_name, hp?.ref_no].filter(Boolean).join(" · ") || null },
      { key: "Founded", value: founded },
      { key: "Deal type", value: hp?.deal_type || null },
      { key: "Website", value: web ? web.replace(/^https?:\/\//, "").replace(/\/$/, "") : null, href: web ? url(web) : undefined },
    ].filter((r) => r.value) as { key: string; value: string; href?: string }[];
    return {
      kind: "private", side, person: per, listingId: p.startup_id,
      org: {
        name: st?.startup_name || hp?.code_name || hp?.ref_no || "Business",
        line: [list(st?.industry), st?.address_province_state || st?.city].filter(Boolean).join(" · ") || null,
        logoUrl: st?.logo_url || null, rows,
      },
    };
  });
