import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marketplace contacts: only counterparties with an approved NDA in
 * deal_pipelines. Contact fields are read with the service client after the
 * pairing is established server-side, so nothing leaks without an NDA.
 */

export type ContactPerson = {
  id: string;
  group: "counterparty" | "advisor";
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  bestTime: string | null;
  companyType: string | null;
  location: string | null;
  website: string | null;
  connectedAt: string | null;
  pipelineStep: string | null;
};

export type MyCard = { name: string; role: string | null; company: string | null; email: string | null; phone: string | null; linkedin: string | null };

const STEPS = ["NDA", "Financial & Valuation", "Letter of intent", "Contact M&A", "Legal", "Offer & SPA", "Payment"];
function step(r: any) {
  const marks = [r.nda_approved_at, r.report_shared_at, r.loi_accepted_at, r.contact_at, r.legal_at, r.spa_at, r.payment_at];
  const i = marks.findIndex((m) => !m);
  return i === -1 ? "Completed" : STEPS[i];
}

async function people(sb: any, ids: string[]) {
  if (!ids.length) return { users: {} as Record<string, any>, profs: {} as Record<string, any> };
  const [{ data: us }, { data: ps }] = await Promise.all([
    sb.from("users").select("id, first_name, last_name, email").in("id", ids),
    sb.from("user_profiles").select("*").in("user_id", ids),
  ]);
  return {
    users: Object.fromEntries((us ?? []).map((u: any) => [u.id, u])),
    profs: Object.fromEntries((ps ?? []).map((p: any) => [p.user_id, p])),
  };
}
const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : null);

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    let rows: any[] = [];
    if (data.as === "buyer") {
      const r = await sb.from("deal_pipelines").select("*").eq("buyer_user_id", context.userId).not("nda_approved_at", "is", null).neq("status", "declined");
      rows = r.data ?? [];
    } else {
      const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", context.userId);
      const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", context.userId);
      const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id))];
      if (ids.length) {
        const r = await sb.from("deal_pipelines").select("*").in("startup_id", ids).not("nda_approved_at", "is", null).neq("status", "declined");
        rows = r.data ?? [];
      }
    }

    const stIds = [...new Set(rows.map((r) => r.startup_id))];
    const { data: stsRaw } = stIds.length
      ? await sb.from("startups").select("id, startup_name, industry, website_url, region, city").in("id", stIds)
      : { data: [] };
    const sts = (stsRaw ?? []).map((s: any) => ({ ...s, website: s.website_url, country: s.region }));
    const stMap = Object.fromEntries((sts ?? []).map((s: any) => [s.id, s]));
    const { data: owners } = stIds.length
      ? await sb.from("startup_ownership").select("startup_id, owning_agent_user_id").in("startup_id", stIds)
      : { data: [] };
    const ownerOf = Object.fromEntries((owners ?? []).map((o: any) => [o.startup_id, o.owning_agent_user_id]));

    const personIds = rows.map((r) => (data.as === "seller" ? r.buyer_user_id : ownerOf[r.startup_id])).filter(Boolean);
    const { users, profs } = await people(sb, [...new Set([...personIds, context.userId])]);
    const { data: bvs } = data.as === "seller" && personIds.length
      ? await sb.from("buyer_verifications").select("user_id, company_name, buyer_type").in("user_id", personIds)
      : { data: [] };
    const bvMap = Object.fromEntries((bvs ?? []).map((b: any) => [b.user_id, b]));

    const seen = new Set<string>();
    const contacts: ContactPerson[] = [];
    for (const r of rows) {
      const pid = data.as === "seller" ? r.buyer_user_id : ownerOf[r.startup_id];
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      const u = users[pid];
      const p = profs[pid] ?? {};
      const st = stMap[r.startup_id] ?? {};
      const bv = bvMap[pid] ?? {};
      const company = p.organisation || (data.as === "seller" ? bv.company_name : st.startup_name);
      contacts.push({
        id: r.id,
        group: "counterparty",
        name: fullName(u) ?? "Contact",
        role: p.title ?? (data.as === "seller" ? "Buyer" : "Owner"),
        company: company ?? null,
        email: u?.email ?? null,
        phone: p.phone ?? null,
        linkedin: p.linkedin ?? null,
        bestTime: null,
        companyType: data.as === "seller" ? bv.buyer_type || p.buyer_type || null : st.industry ?? null,
        location: [p.city || st.city, p.country || st.country].filter(Boolean).join(", ") || null,
        website: (data.as === "seller" ? p.website : st.website) ?? null,
        connectedAt: r.nda_approved_at,
        pipelineStep: step(r),
      });
    }

    const me = users[context.userId];
    const mp = profs[context.userId] ?? {};
    const myCompany = mp.organisation || (data.as === "seller" ? stMap[stIds[0]]?.startup_name : null);
    const my: MyCard = {
      name: fullName(me) ?? "Me",
      role: mp.title ?? null,
      company: myCompany ?? null,
      email: me?.email ?? null,
      phone: mp.phone ?? null,
      linkedin: mp.linkedin ?? null,
    };
    return { my, contacts, visibleTo: contacts.length };
  });
