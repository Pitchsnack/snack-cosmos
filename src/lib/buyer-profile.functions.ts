import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aumRange, ticketRange, type BuyerOrg, type BuyerProfile, type PublicBuyer } from "@/lib/buyer-profile";

/**
 * Buyer investor profile (My Company in the Buyer view). Private data lives in
 * buyer_profiles (+ buyer_verifications for the firm); the public record is
 * derived here and is the only shape ever sent to sellers.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const BIRDS = ["Heron", "Kestrel", "Falcon", "Osprey", "Egret", "Ibis", "Harrier", "Merlin", "Swift", "Crane", "Tern", "Condor"];
function codeFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `Investor ${BIRDS[h % BIRDS.length]}`;
}

async function ensure(userId: string): Promise<BuyerProfile> {
  const sb = await admin();
  const { data } = await sb.from("buyer_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: made, error } = await sb.from("buyer_profiles").insert({ user_id: userId, code_name: "" }).select("*").single();
  if (error) throw new Error(error.message);
  return made;
}

export const getMyBuyerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const profile = await ensure(context.userId);
    const [{ data: bv }, { data: deals }] = await Promise.all([
      sb.from("buyer_verifications").select("company_name, buyer_type, website, registration_no, status, work_email").eq("user_id", context.userId).maybeSingle(),
      sb.from("deal_pipelines").select("nda_approved_at, loi_sent_at").eq("buyer_user_id", context.userId),
    ]);
    const org: BuyerOrg = {
      name: bv?.company_name ?? null,
      type: bv?.buyer_type ?? null,
      website: bv?.website ?? null,
      registrationNo: bv?.registration_no ?? null,
      verified: bv?.status === "approved",
      ndas: (deals ?? []).filter((d: any) => d.nda_approved_at).length,
      lois: (deals ?? []).filter((d: any) => d.loi_sent_at).length,
    };
    return { profile, org };
  });

const Person = z.object({ name: z.string().max(120), role: z.string().max(120).default(""), email: z.string().max(200).default(""), phone: z.string().max(60).default("") });
const Holding = z.object({ name: z.string().max(160), note: z.string().max(200).default("") });
const txt = (n: number) => z.string().max(n).nullable().optional();
const Patch = z.object({
  headline: txt(140), description: txt(600), legal_name: txt(200), address: txt(1000), city: txt(120), country: txt(120),
  logo_url: txt(1000), private_description: txt(1000), aum_exact: txt(120), ticket_exact: txt(120),
  ticket_min: z.number().min(0).nullable().optional(), ticket_max: z.number().min(0).nullable().optional(), aum_value: z.number().min(0).nullable().optional(),
  track_record: txt(1000), decision_process: txt(1000), target_size: txt(200), geography: txt(300),
  sectors: z.array(z.string().max(60)).max(20).optional(), stages: z.array(z.string().max(60)).max(12).optional(),
  deal_types: z.array(z.string().max(60)).max(12).optional(),
  people: z.array(Person).max(20).optional(), portfolio: z.array(Holding).max(50).optional(),
  show_name: z.boolean().optional(),
});

export const saveMyBuyerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Patch.parse(d))
  .handler(async ({ data, context }) => {
    await ensure(context.userId);
    const sb = await admin();
    const { error } = await sb.from("buyer_profiles").update({ ...data, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBuyerListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["live", "paused"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await ensure(context.userId);
    if (data.status === "live") {
      const missing = [
        p.ticket_min == null && p.ticket_max == null && "ticket size",
        !p.sectors.length && "sectors", !p.stages.length && "stages", !p.deal_types.length && "deal types",
        !p.headline?.trim() && "public headline",
      ].filter(Boolean);
      if (missing.length) throw new Error(`Add ${missing.join(", ")} before publishing.`);
    }
    const sb = await admin();
    const patch: Record<string, unknown> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "live" && !p.live_since) patch.live_since = new Date().toISOString();
    const { error } = await sb.from("buyer_profiles").update(patch).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public record only — what sellers may see before approving the buyer's NDA. */
export function toPublic(p: BuyerProfile, bv: { company_name?: string | null; buyer_type?: string | null; status?: string | null } | null): PublicBuyer {
  return {
    id: p.user_id,
    refNo: p.ref_no,
    codeName: bv?.buyer_type || "Investor",
    name: p.show_name ? bv?.company_name ?? null : null,
    type: bv?.buyer_type ?? null,
    city: p.city, country: p.country,
    headline: p.headline, description: p.description,
    ticket: ticketRange(p.ticket_min, p.ticket_max),
    aum: aumRange(p.aum_value),
    sectors: p.sectors, stages: p.stages, dealTypes: p.deal_types,
    verified: bv?.status === "approved",
    proofOfFunds: !!p.pof_verified_at,
    status: p.status, liveSince: p.live_since,
  };
}

export const listPublicBuyers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = await admin();
    const { data: rows } = await sb.from("buyer_profiles").select("*").eq("status", "live").order("live_since", { ascending: false }).limit(200);
    const ids = (rows ?? []).map((r: any) => r.user_id);
    const { data: bvs } = ids.length
      ? await sb.from("buyer_verifications").select("user_id, company_name, buyer_type, status").in("user_id", ids)
      : { data: [] };
    const byId = new Map((bvs ?? []).map((b: any) => [b.user_id, b]));
    return (rows ?? []).map((r: BuyerProfile) => toPublic(r, (byId.get(r.user_id) as any) ?? null));
  });
