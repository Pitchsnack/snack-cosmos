import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Private notes on My Pipeline: the buyer's note about the seller and the
 * seller's note about the buyer. Generated from the other party's data once
 * the NDA is approved; the owner's overrides win per field. Only the owning
 * side can read or write (checked here; the table has no client policies).
 */

export type NoteDirection = "buyer_on_seller" | "seller_on_buyer";
export type NoteFields = Record<string, string | null>;
export type PrivateNote = {
  direction: NoteDirection;
  name: string;
  sub: string | null;
  logoUrl: string | null;
  verified: boolean;
  codeName: string | null;
  sizeLabel: string | null;
  contact: string | null;
  generated: NoteFields;
  overrides: NoteFields;
  myNotes: string;
  generatedAt: string;
  editedAt: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
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

async function context(pipelineId: string, userId: string, sbUser: any) {
  const sb = await admin();
  const { data: p } = await sb.from("deal_pipelines").select("*").eq("id", pipelineId).single();
  if (!p) throw new Error("Pipeline not found");
  if (!p.nda_approved_at) throw new Error("The note opens once the NDA is approved");
  if (p.buyer_user_id === userId) return { sb, p, direction: "buyer_on_seller" as const };
  const { data: ok } = await sbUser.rpc("can_access_startup", { _user_id: userId, _startup_id: p.startup_id });
  if (!ok) throw new Error("Not your pipeline");
  return { sb, p, direction: "seller_on_buyer" as const };
}

async function build(sb: any, p: any, direction: NoteDirection) {
  const { data: hp } = await sb.from("hidden_profiles").select("code_name, asking_price, stake_pct, deal_type, reason").eq("id", p.hidden_profile_id).maybeSingle();
  const deal = {
    askingPrice: money(hp?.asking_price),
    stake: hp?.stake_pct != null ? `${Number(hp.stake_pct)}%` : null,
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
      name: st?.startup_name || hp?.code_name || "Business",
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
      } as NoteFields,
    };
  }
  const [{ data: bv }, { data: up }, { data: u }] = await Promise.all([
    sb.from("buyer_verifications").select("company_name, buyer_type, status, website").eq("user_id", p.buyer_user_id).maybeSingle(),
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
    } as NoteFields,
  };
}

const Id = z.object({ id: z.string().uuid() });

export const getPrivateNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context: ctx }): Promise<PrivateNote> => {
    const { sb, p, direction } = await context(data.id, ctx.userId, ctx.supabase);
    const b = await build(sb, p, direction);
    const owner = direction === "buyer_on_seller" ? String(p.buyer_user_id) : String(p.startup_id);
    const { data: row } = await sb.from("private_notes").select("*").eq("pipeline_id", p.id).eq("direction", direction).maybeSingle();
    let saved = row;
    if (!row) {
      const { data: ins } = await sb.from("private_notes").insert({
        pipeline_id: p.id, owner_org_id: owner, subject_org_id: b.subject, listing_id: p.hidden_profile_id,
        direction, generated: b.generated, generated_at: p.nda_approved_at, updated_by: ctx.userId,
      }).select("*").single();
      saved = ins;
    } else if (JSON.stringify(row.generated) !== JSON.stringify(b.generated)) {
      // Refresh generated values; overrides stay on top per field.
      await sb.from("private_notes").update({ generated: b.generated }).eq("id", row.id);
    }
    return {
      direction, name: b.name, sub: b.sub, logoUrl: b.logoUrl, verified: b.verified,
      codeName: b.codeName, sizeLabel: b.sizeLabel, contact: b.contact,
      generated: b.generated, overrides: (saved?.overrides ?? {}) as NoteFields,
      myNotes: saved?.my_notes ?? "", generatedAt: saved?.generated_at ?? p.nda_approved_at,
      editedAt: saved?.edited_at ?? null,
    };
  });

export const savePrivateNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    overrides: z.record(z.string().max(60), z.string().max(4000).nullable()),
    myNotes: z.string().max(20000),
  }).parse(d))
  .handler(async ({ data, context: ctx }) => {
    const { sb, p, direction } = await context(data.id, ctx.userId, ctx.supabase);
    const b = await build(sb, p, direction);
    const keys = Object.keys(b.generated);
    const overrides: NoteFields = {};
    for (const k of keys) {
      if (!(k in data.overrides)) continue;
      const v = (data.overrides[k] ?? "").trim();
      if (v !== (b.generated[k] ?? "")) overrides[k] = v || null;
    }
    const now = new Date().toISOString();
    const { error } = await sb.from("private_notes").update({
      overrides, my_notes: data.myNotes.trim() || null, updated_at: now, updated_by: ctx.userId,
      edited_at: Object.keys(overrides).length || data.myNotes.trim() ? now : null,
    }).eq("pipeline_id", p.id).eq("direction", direction);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
