import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["Prospect","Active","Engaged","Investing","Inactive","Archived"] as const;
const VISIBILITIES = ["Private","Tenant","Shared","Archived"] as const;

export type InvestorStatus = (typeof STATUSES)[number];
export type InvestorVisibility = (typeof VISIBILITIES)[number];

const BUCKET = "startup-media";
const SIGN_TTL = 3600;

interface InvestorMediaEntry { slot: 1 | 2 | 3; image_path: string; }
export interface InvestorMediaItem extends InvestorMediaEntry {
  image_signed_url: string | null;
}

async function signMany(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL);
  const map: Record<string, string> = {};
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

async function removeStorageObjects(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  paths: (string | null | undefined)[],
) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  await supabase.storage.from(BUCKET).remove(list).catch(() => {});
}

function normalizeMedia(raw: unknown): InvestorMediaEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: InvestorMediaEntry[] = [];
  for (const v of raw as unknown[]) {
    if (!v || typeof v !== "object") continue;
    const slot = (v as Record<string, unknown>).slot;
    const image_path = (v as Record<string, unknown>).image_path;
    if ((slot === 1 || slot === 2 || slot === 3) && typeof image_path === "string" && image_path) {
      out.push({ slot, image_path });
    }
  }
  return out.sort((a, b) => a.slot - b.slot);
}

export interface InvestorRow {
  id: string;
  tenant_id: string;
  investor_name: string;
  legal_name: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  country: string | null;
  investor_type: string | null;
  aum: string | null;
  ticket_size: string | null;
  short_description: string | null;
  long_description: string | null;
  status: InvestorStatus;
  visibility: InvestorVisibility;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
}

export interface InvestorListItem extends InvestorRow {
  tenant_name: string | null;
  logo_signed_url: string | null;
  owning_agent: { id: string; email: string; name: string | null } | null;
  owning_ai_agent: { id: string; email: string; name: string | null } | null;
  related_startups: Array<{ id: string; name: string }>;
}

async function logActivity(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  investorId: string,
  tenantId: string,
  userId: string,
  type: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("investor_activity").insert({
    investor_id: investorId,
    tenant_id: tenantId,
    activity_type: type,
    activity_details: details,
    created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: "investor",
    entity_id: investorId,
    action: type,
    performed_by: userId,
    new_value: details,
  });
}

const ListInput = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  country: z.string().optional(),
}).partial();

export const listInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListInput.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("investors")
      .select(`
        id, tenant_id, investor_name, legal_name, website_url, linkedin_url, country, investor_type,
        aum, ticket_size, short_description, long_description, status, visibility,
        created_at, updated_at, logo_url,
        tenants!inner(tenant_name),
        investor_ownership(owning_agent_user_id, users:owning_agent_user_id(id,email,first_name,last_name)),
        investor_ai_ownership(owning_ai_agent_id, users:owning_ai_agent_id(id,email,first_name,last_name)),
        startup_investors(id, startups:startup_id(id, startup_name))
      `);

    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%_\\]/g, (m) => "\\" + m).replace(/"/g, '\\"');
      const p = `"%${s}%"`;
      q = q.or(
        `investor_name.ilike.${p},short_description.ilike.${p},investor_type.ilike.${p},country.ilike.${p}`,
      );
    }
    if (data.type) q = q.eq("investor_type", data.type);
    if (data.country) q = q.eq("country", data.country);

    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as unknown as Array<
      InvestorRow & {
        tenants: { tenant_name: string } | null;
        investor_ownership: Array<{
          owning_agent_user_id: string;
          users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
        }>;
        investor_ai_ownership: Array<{
          owning_ai_agent_id: string;
          users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
        }>;
        startup_investors: Array<{
          id: string;
          startups: { id: string; startup_name: string } | null;
        }>;
      }
    >;
    const logoPaths = list.map((r) => r.logo_url).filter((p): p is string => !!p);
    const signed = await signMany(supabase, logoPaths);

    return list.map((r): InvestorListItem => {
      const own = r.investor_ownership?.[0]?.users ?? null;
      const aiOwn = r.investor_ai_ownership?.[0]?.users ?? null;
      const related_startups = (r.startup_investors ?? [])
        .map((l) => l.startups)
        .filter((v): v is { id: string; startup_name: string } => !!v)
        .map((v) => ({ id: v.id, name: v.startup_name }));
      return {
        ...r,
        tenant_name: r.tenants?.tenant_name ?? null,
        logo_signed_url: r.logo_url ? (signed[r.logo_url] ?? null) : null,
        owning_agent: own ? { id: own.id, email: own.email, name: [own.first_name, own.last_name].filter(Boolean).join(" ") || null } : null,
        owning_ai_agent: aiOwn ? { id: aiOwn.id, email: aiOwn.email, name: [aiOwn.first_name, aiOwn.last_name].filter(Boolean).join(" ") || null } : null,
        related_startups,
      };
    });
  });

export const getInvestor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("investors")
      .select(`
        id, tenant_id, investor_name, legal_name, website_url, linkedin_url, country, investor_type,
        aum, ticket_size, short_description, long_description, status, visibility,
        created_at, updated_at, logo_url, media,
        firm_name, email, business_address, year_founded,
        min_ticket_size, max_ticket_size, bio,
        keywords, preferred_stages, preferred_industries, investment_focus,
        tenants!inner(tenant_name),
        investor_ownership(owning_agent_user_id, assigned_at, users:owning_agent_user_id(id,email,first_name,last_name)),
        investor_ai_ownership(owning_ai_agent_id, assigned_at, users:owning_ai_agent_id(id,email,first_name,last_name)),
        investor_users(id, user_id, role, created_at, users:user_id(id,email,first_name,last_name))
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");

    const r = row as unknown as InvestorRow & { media: unknown };
    const mediaEntries = normalizeMedia(r.media);

    // Linked startups (reverse of startup_investors). Same-tenant enforced by trigger.
    const { data: linkRows } = await supabase
      .from("startup_investors")
      .select("startups:startup_id(id, startup_name, logo_url)")
      .eq("investor_id", data.id);

    const links = ((linkRows ?? []) as unknown as Array<{
      startups: { id: string; startup_name: string; logo_url: string | null } | null;
    }>)
      .map((l) => l.startups)
      .filter((s): s is { id: string; startup_name: string; logo_url: string | null } => !!s);

    const allPaths = [
      r.logo_url,
      ...mediaEntries.map((m) => m.image_path),
      ...links.map((s) => s.logo_url),
    ].filter((p): p is string => !!p);
    const signed = await signMany(supabase, allPaths);

    const linked_startups = links.map((s) => ({
      id: s.id,
      startup_name: s.startup_name,
      logo_signed_url: s.logo_url ? (signed[s.logo_url] ?? null) : null,
    }));

    const media: InvestorMediaItem[] = mediaEntries.map((m) => ({
      ...m,
      image_signed_url: signed[m.image_path] ?? null,
    }));

    return {
      ...row,
      logo_signed_url: r.logo_url ? (signed[r.logo_url] ?? null) : null,
      media,
      linked_startups,
    };
  });

export const getInvestorActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ investorId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("investor_activity")
      .select("id, activity_type, activity_details, created_at, created_by, users:created_by(email)")
      .eq("investor_id", data.investorId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvestorAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ investorId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("id, action, new_value, old_value, created_at, performed_by")
      .eq("entity_type", "investor")
      .eq("entity_id", data.investorId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const MediaInput = z.object({
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  image_path: z.string().min(1).max(1024),
});

const ProfileFields = {
  logoPath: z.string().max(1024).nullable().optional(),
  media: z.array(MediaInput).max(3).optional(),
  firmName: z.string().max(255).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  businessAddress: z.string().max(500).nullable().optional(),
  yearFounded: z.number().int().min(1800).max(2100).nullable().optional(),
  aum: z.string().max(255).nullable().optional(),
  ticketSize: z.string().max(255).nullable().optional(),
  minTicketSize: z.string().max(50).nullable().optional(),
  maxTicketSize: z.string().max(50).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  keywords: z.array(z.string()).max(20).optional(),
  
  preferredStages: z.array(z.string()).max(20).optional(),
  preferredIndustries: z.array(z.string()).max(50).optional(),
  investmentFocus: z.array(z.string()).max(50).optional(),
};

const CreateInput = z.object({
  tenantId: z.string().uuid(),
  investorName: z.string().min(1).max(255),
  legalName: z.string().max(255).optional().nullable(),
  websiteUrl: z.string().url().max(2048).optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url().max(2048).optional().nullable().or(z.literal("")),
  country: z.string().max(100).optional().nullable(),
  investorType: z.string().max(100).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  longDescription: z.string().max(5000).optional().nullable(),
  status: z.enum(STATUSES).default("Prospect"),
  visibility: z.enum(VISIBILITIES).default("Tenant"),
  owningAgentUserId: z.string().uuid(),
  owningAiAgentId: z.string().uuid(),
  ...ProfileFields,
});

export const createInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const mediaJson = (data.media ?? []).map((m) => ({ slot: m.slot, image_path: m.image_path }));
    const { data: ins, error } = await supabase
      .from("investors")
      .insert({
        tenant_id: data.tenantId,
        investor_name: data.investorName,
        legal_name: data.legalName || null,
        firm_name: data.firmName || null,
        email: data.email || null,
        business_address: data.businessAddress || null,
        year_founded: data.yearFounded ?? null,
        website_url: data.websiteUrl || null,
        linkedin_url: data.linkedinUrl || null,
        country: data.country || null,
        investor_type: data.investorType || null,
        aum: data.aum || null,
        ticket_size: data.ticketSize || null,
        min_ticket_size: data.minTicketSize || null,
        max_ticket_size: data.maxTicketSize || null,
        short_description: data.shortDescription || null,
        long_description: data.longDescription || null,
        bio: data.bio || null,
        keywords: data.keywords ?? [],
        
        preferred_stages: data.preferredStages ?? [],
        preferred_industries: data.preferredIndustries ?? [],
        investment_focus: data.investmentFocus ?? [],
        status: data.status,
        visibility: data.visibility,
        logo_url: data.logoPath ?? null,
        media: mediaJson,
        created_by: userId,
        updated_by: userId,
      } as never)
      .select("id, tenant_id")
      .single();
    if (error) throw new Error(error.message);

    const { error: oErr } = await supabase.from("investor_ownership").insert({
      investor_id: ins.id,
      tenant_id: ins.tenant_id,
      owning_agent_user_id: data.owningAgentUserId,
    });
    if (oErr) {
      await supabase.from("investors").delete().eq("id", ins.id);
      throw new Error("Owner assignment failed: " + oErr.message);
    }

    const { error: aErr } = await supabase.from("investor_ai_ownership").insert({
      investor_id: ins.id,
      tenant_id: ins.tenant_id,
      owning_ai_agent_id: data.owningAiAgentId,
    });
    if (aErr) {
      await supabase.from("investors").delete().eq("id", ins.id);
      throw new Error("AI owner assignment failed: " + aErr.message);
    }

    await logActivity(supabase, ins.id, ins.tenant_id, userId, "INVESTOR_CREATED", {
      name: data.investorName, owner: data.owningAgentUserId, ai_owner: data.owningAiAgentId,
    });

    return { id: ins.id };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  investorName: z.string().min(1).max(255).optional(),
  legalName: z.string().max(255).nullable().optional(),
  websiteUrl: z.string().max(2048).nullable().optional(),
  linkedinUrl: z.string().max(2048).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  investorType: z.string().max(100).nullable().optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  longDescription: z.string().max(5000).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  ...ProfileFields,
});

export const updateInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("investors")
      .select("tenant_id, status, visibility, logo_url, media")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Not found");

    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.investorName !== undefined) patch.investor_name = data.investorName;
    if (data.legalName !== undefined) patch.legal_name = data.legalName;
    if (data.websiteUrl !== undefined) patch.website_url = data.websiteUrl;
    if (data.linkedinUrl !== undefined) patch.linkedin_url = data.linkedinUrl;
    if (data.country !== undefined) patch.country = data.country;
    if (data.investorType !== undefined) patch.investor_type = data.investorType;
    if (data.shortDescription !== undefined) patch.short_description = data.shortDescription;
    if (data.longDescription !== undefined) patch.long_description = data.longDescription;
    if (data.status !== undefined) patch.status = data.status;
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.logoPath !== undefined) patch.logo_url = data.logoPath;
    if (data.firmName !== undefined) patch.firm_name = data.firmName;
    if (data.email !== undefined) patch.email = data.email;
    if (data.businessAddress !== undefined) patch.business_address = data.businessAddress;
    if (data.yearFounded !== undefined) patch.year_founded = data.yearFounded;
    if (data.aum !== undefined) patch.aum = data.aum;
    if (data.ticketSize !== undefined) patch.ticket_size = data.ticketSize;
    if (data.minTicketSize !== undefined) patch.min_ticket_size = data.minTicketSize;
    if (data.maxTicketSize !== undefined) patch.max_ticket_size = data.maxTicketSize;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.keywords !== undefined) patch.keywords = data.keywords;
    
    if (data.preferredStages !== undefined) patch.preferred_stages = data.preferredStages;
    if (data.preferredIndustries !== undefined) patch.preferred_industries = data.preferredIndustries;
    if (data.investmentFocus !== undefined) patch.investment_focus = data.investmentFocus;
    if (data.media !== undefined) {
      patch.media = data.media.map((m) => ({ slot: m.slot, image_path: m.image_path }));
    }

    const { error } = await supabase.from("investors").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Storage cleanup (best-effort): orphan old logo + removed/replaced media.
    const orphans: string[] = [];
    if (
      data.logoPath !== undefined &&
      existing.logo_url &&
      existing.logo_url !== data.logoPath
    ) {
      orphans.push(existing.logo_url);
    }
    if (data.media !== undefined) {
      const oldMedia = normalizeMedia(existing.media);
      const newBySlot = new Map<number, string>(
        data.media.map((m) => [m.slot, m.image_path]),
      );
      for (const m of oldMedia) {
        const incoming = newBySlot.get(m.slot);
        if (!incoming || incoming !== m.image_path) orphans.push(m.image_path);
      }
    }
    await removeStorageObjects(supabase, orphans);

    if (data.status && data.status !== existing.status) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "STATUS_CHANGED", {
        from: existing.status, to: data.status,
      });
    }
    if (data.visibility && data.visibility !== existing.visibility) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "VISIBILITY_CHANGED", {
        from: existing.visibility, to: data.visibility,
      });
    }
    await logActivity(supabase, data.id, existing.tenant_id, userId, "INVESTOR_UPDATED", patch);
    return { ok: true };
  });

export const archiveInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("investors").select("tenant_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const { error } = await supabase
      .from("investors")
      .update({ status: "Archived", visibility: "Archived", updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, data.id, row.tenant_id, userId, "STATUS_CHANGED", { to: "Archived" });
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────
// Media upload helpers (signed upload URL + signed read URL)
//
// Path convention (forward-compatible — the Global Startups/Investors
// registry can reuse the same bucket later by using the global registry
// tenant id as the first segment, or by adding a separate `global` policy
// pair on the same bucket): `<tenantId>/<entityId>/<kind>-<ts>.<ext>`.
//
// Storage RLS on `startup-media` already authorizes on first folder
// (tenantId) for INSERT/UPDATE/DELETE and on second folder (entityId) for
// SELECT, using either `can_manage_startup`/`can_access_startup` or the
// parallel `can_manage_investor`/`can_access_investor` policies. Uploading
// to a freshly created investor/startup id is the supported flow — we do
// NOT upload to draft-uuids because the SELECT policy can't authorize
// reads against a non-existent entity id.
// ─────────────────────────────────────────────────────────────────────────

export const createInvestorMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenantId: z.string().uuid(),
      investorId: z.string().uuid(),
      kind: z.enum(["logo", "slot-1", "slot-2", "slot-3"]),
      ext: z.string().regex(/^[a-z0-9]{2,5}$/i),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const filename = `${data.kind}-${Date.now()}.${data.ext.toLowerCase()}`;
    const path = `${data.tenantId}/${data.investorId}/${filename}`;
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const getInvestorSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: signed } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, SIGN_TTL);
    return { url: signed?.signedUrl ?? null };
  });
