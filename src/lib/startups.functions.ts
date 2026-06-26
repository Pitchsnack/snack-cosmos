import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = [
  "Draft","Active","Fundraising","Due Diligence","Portfolio","Exited",
] as const;
const VISIBILITIES = ["Private","Tenant","Shared","Archived"] as const;
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Other","Inactive"] as const;


export type StartupStatus = (typeof STATUSES)[number];
export type StartupVisibility = (typeof VISIBILITIES)[number];
export type InvestmentStage = (typeof STAGES)[number];

const BUCKET = "startup-media";
const SIGN_TTL = 3600;

async function signPath(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
  return data?.signedUrl ?? null;
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

export interface StartupRow {
  id: string;
  tenant_id: string;
  startup_name: string;
  
  website_url: string | null;
  linkedin_url: string | null;
  city: string | null;
  industry: string[];
  short_description: string | null;
  long_description: string | null;
  status: StartupStatus;
  visibility: StartupVisibility;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
  company_type: string | null;
  year_founded: number | null;
  email: string | null;
  headquarters: string | null;
  investment_stage: InvestmentStage | null;
  product_tags: string[];
  market_tags: string[];
  url_key: string | null;
  source_global_id: string | null;
  imported_at: string | null;
}

export interface StartupListItem extends StartupRow {
  tenant_name: string | null;
  logo_signed_url: string | null;
  owning_agent: { id: string; email: string; name: string | null } | null;
  owning_ai_agent: { id: string; email: string; name: string | null } | null;
}

export interface StartupFounder {
  id: string;
  full_name: string;
  position: string | null;
  linkedin_url: string | null;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
}
export interface StartupMediaItem {
  id: string;
  slot: 1 | 2 | 3;
  image_path: string;
  image_signed_url: string | null;
  caption: string | null;
}
export interface StartupInvestorLink {
  id: string;
  investor_id: string;
  investor_name: string;
  logo_url: string | null;
  logo_signed_url: string | null;
}

export interface StartupDetail extends StartupRow {
  tenant_name: string | null;
  logo_signed_url: string | null;
  media: StartupMediaItem[];
  founders: StartupFounder[];
  investors: StartupInvestorLink[];
}

async function logActivity(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  startupId: string,
  tenantId: string,
  userId: string,
  type: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("startup_activity").insert({
    startup_id: startupId,
    tenant_id: tenantId,
    activity_type: type,
    activity_details: details,
    created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: "startup",
    entity_id: startupId,
    action: type,
    performed_by: userId,
    new_value: details,
  });
}

const SELECT_LIST = `
  id, tenant_id, startup_name, website_url, city, industry,
  short_description, long_description, status, visibility, created_at, updated_at,
  logo_url, company_type, year_founded, email, headquarters, investment_stage,
  product_tags, market_tags, url_key, source_global_id, imported_at,
  tenants!inner(tenant_name),
  startup_ownership(owning_agent_user_id, users:owning_agent_user_id(id,email,first_name,last_name)),
  startup_ai_ownership(owning_ai_agent_id, users:owning_ai_agent_id(id,email,first_name,last_name))
`;

const ListInput = z.object({
  search: z.string().optional(),
  stage: z.string().optional(),
  industry: z.string().optional(),
  headquarters: z.string().optional(),
  companyType: z.string().optional(),
  productTag: z.string().optional(),
  marketTag: z.string().optional(),
  sort: z.enum(["updated_desc","created_desc","name_asc","name_desc"]).default("updated_desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(24),
}).partial().extend({
  sort: z.enum(["updated_desc","created_desc","name_asc","name_desc"]).default("updated_desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(24),
});

export const listStartups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListInput.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase.from("startups").select(SELECT_LIST, { count: "exact" });

    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%_]/g, (m) => "\\" + m);
      q = q.or(
        `startup_name.ilike.%${s}%,short_description.ilike.%${s}%,headquarters.ilike.%${s}%`,
      );
    }
    if (data.stage) q = q.eq("investment_stage", data.stage);
    if (data.industry) q = q.contains("industry", [data.industry]);
    if (data.headquarters) q = q.eq("headquarters", data.headquarters);
    if (data.companyType) q = q.eq("company_type", data.companyType);
    if (data.productTag) q = q.contains("product_tags", [data.productTag]);
    if (data.marketTag) q = q.contains("market_tags", [data.marketTag]);

    switch (data.sort) {
      case "created_desc": q = q.order("created_at", { ascending: false }); break;
      case "name_asc": q = q.order("startup_name", { ascending: true }); break;
      case "name_desc": q = q.order("startup_name", { ascending: false }); break;
      default: q = q.order("updated_at", { ascending: false });
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as unknown as Array<
      StartupRow & {
        tenants: { tenant_name: string } | null;
        startup_ownership: Array<{
          owning_agent_user_id: string;
          users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
        }>;
        startup_ai_ownership: Array<{
          owning_ai_agent_id: string;
          users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
        }>;
      }
    >;

    const logoPaths = list.map((r) => r.logo_url).filter((p): p is string => !!p);
    const signed = await signMany(supabase, logoPaths);

    const items: StartupListItem[] = list.map((r) => {
      const own = r.startup_ownership?.[0]?.users ?? null;
      const aiOwn = r.startup_ai_ownership?.[0]?.users ?? null;
      return {
        ...r,
        product_tags: r.product_tags ?? [],
        market_tags: r.market_tags ?? [],
        tenant_name: r.tenants?.tenant_name ?? null,
        logo_signed_url: r.logo_url ? (signed[r.logo_url] ?? null) : null,
        owning_agent: own ? { id: own.id, email: own.email, name: [own.first_name, own.last_name].filter(Boolean).join(" ") || null } : null,
        owning_ai_agent: aiOwn ? { id: aiOwn.id, email: aiOwn.email, name: [aiOwn.first_name, aiOwn.last_name].filter(Boolean).join(" ") || null } : null,
      };
    });

    return { items, total: count ?? items.length, page: data.page, pageSize: data.pageSize };
  });

interface AssignmentRow {
  users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
  assigned_at: string;
}
interface UserAssignmentRow {
  id: string;
  user_id: string;
  role: string | null;
  created_at: string;
  users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
}

export const getStartup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("startups")
      .select(`
        id, tenant_id, startup_name, website_url, linkedin_url, city, industry,
        short_description, long_description, status, visibility, created_at, updated_at,
        logo_url, company_type, year_founded, email, headquarters, investment_stage,
        product_tags, market_tags, source_global_id, imported_at,
        tenants!inner(tenant_name),
        startup_ownership(owning_agent_user_id, assigned_at, users:owning_agent_user_id(id,email,first_name,last_name)),
        startup_ai_ownership(owning_ai_agent_id, assigned_at, users:owning_ai_agent_id(id,email,first_name,last_name)),
        startup_users(id, user_id, role, created_at, users:user_id(id,email,first_name,last_name)),
        startup_media(id, slot, image_url, caption),
        startup_founders(id, full_name, position, linkedin_url, bio, photo_url, display_order),
        startup_investors(id, investor_id, investors:investor_id(id, investor_name, website_url))
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");

    const r = row as unknown as StartupRow & {
      tenants: { tenant_name: string };
      startup_media: Array<{ id: string; slot: number; image_url: string; caption: string | null }>;
      startup_founders: StartupFounder[];
      startup_investors: Array<{ id: string; investor_id: string; investors: { id: string; investor_name: string; website_url: string | null } | null }>;
    };

    const mediaPaths = (r.startup_media ?? []).map((m) => m.image_url).filter(Boolean);
    const allPaths = [r.logo_url, ...mediaPaths].filter((p): p is string => !!p);
    const signed = await signMany(supabase, allPaths);

    const media: StartupMediaItem[] = (r.startup_media ?? [])
      .sort((a, b) => a.slot - b.slot)
      .map((m) => ({
        id: m.id,
        slot: m.slot as 1 | 2 | 3,
        image_path: m.image_url,
        image_signed_url: signed[m.image_url] ?? null,
        caption: m.caption,
      }));

    const founders: StartupFounder[] = (r.startup_founders ?? []).sort(
      (a, b) => a.display_order - b.display_order,
    );

    const investors: StartupInvestorLink[] = (r.startup_investors ?? []).map((l) => ({
      id: l.id,
      investor_id: l.investor_id,
      investor_name: l.investors?.investor_name ?? "(unknown)",
      logo_url: null,
      logo_signed_url: null,
    }));

    return {
      ...r,
      product_tags: r.product_tags ?? [],
      market_tags: r.market_tags ?? [],
      tenant_name: r.tenants.tenant_name,
      logo_signed_url: r.logo_url ? (signed[r.logo_url] ?? null) : null,
      media,
      founders,
      investors,
      // pass-throughs used by existing ownership/users components
      startup_ownership: ((row as Record<string, unknown>).startup_ownership ?? []) as AssignmentRow[],
      startup_ai_ownership: ((row as Record<string, unknown>).startup_ai_ownership ?? []) as AssignmentRow[],
      startup_users: ((row as Record<string, unknown>).startup_users ?? []) as UserAssignmentRow[],
    };
  });

export const getStartupActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("startup_activity")
      .select("id, activity_type, activity_details, created_at, created_by, users:created_by(email)")
      .eq("startup_id", data.startupId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getStartupAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("id, action, new_value, old_value, created_at, performed_by")
      .eq("entity_type", "startup")
      .eq("entity_id", data.startupId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const TagArray = z.array(z.string().min(1).max(50)).max(5).default([]);
const FounderInput = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().min(1).max(255),
  position: z.string().max(255).nullable().optional(),
  linkedin_url: z.string().max(2048).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  photo_url: z.string().max(2048).nullable().optional(),
  display_order: z.number().int().default(0),
});
const MediaInput = z.object({
  slot: z.number().int().min(1).max(3),
  image_path: z.string().min(1).max(1024),
  caption: z.string().max(500).nullable().optional(),
});

const ProfileFields = {
  logoPath: z.string().max(1024).nullable().optional(),
  companyType: z.string().max(100).nullable().optional(),
  yearFounded: z.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal("")),
  headquarters: z.string().max(255).nullable().optional(),
  linkedinUrl: z.string().max(2048).nullable().optional().or(z.literal("")),
  investmentStage: z.enum(STAGES).nullable().optional(),
  productTags: TagArray.optional(),
  marketTags: TagArray.optional(),
  founders: z.array(FounderInput).max(20).optional(),
  investorIds: z.array(z.string().uuid()).max(50).optional(),
  media: z.array(MediaInput).max(3).optional(),
};

const CreateInput = z.object({
  tenantId: z.string().uuid(),
  startupName: z.string().min(1).max(255),
  
  websiteUrl: z.string().max(2048).optional().nullable().or(z.literal("")),
  city: z.string().max(100).optional().nullable(),
  industry: z.string().max(255).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  longDescription: z.string().max(5000).optional().nullable(),
  status: z.enum(STATUSES).default("Draft"),
  visibility: z.enum(VISIBILITIES).default("Tenant"),
  owningAgentUserId: z.string().uuid(),
  owningAiAgentId: z.string().uuid(),
  ...ProfileFields,
});

function emptyToNull<T>(v: T | "" | null | undefined): T | null {
  if (v === "" || v === undefined) return null;
  return v as T | null;
}

async function syncFounders(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  startupId: string,
  tenantId: string,
  founders: z.infer<typeof FounderInput>[],
) {
  await supabase.from("startup_founders").delete().eq("startup_id", startupId);
  if (founders.length === 0) return;
  const rows = founders.map((f, i) => ({
    startup_id: startupId,
    tenant_id: tenantId,
    full_name: f.full_name,
    position: f.position ?? null,
    linkedin_url: f.linkedin_url ?? null,
    bio: f.bio ?? null,
    photo_url: f.photo_url ?? null,
    display_order: f.display_order ?? i,
  }));
  const { error } = await supabase.from("startup_founders").insert(rows);
  if (error) throw new Error("Founders: " + error.message);
}

async function syncInvestors(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  startupId: string,
  tenantId: string,
  investorIds: string[],
) {
  await supabase.from("startup_investors").delete().eq("startup_id", startupId);
  if (investorIds.length === 0) return;
  const unique = Array.from(new Set(investorIds));
  const rows = unique.map((id) => ({ startup_id: startupId, tenant_id: tenantId, investor_id: id }));
  const { error } = await supabase.from("startup_investors").insert(rows);
  if (error) throw new Error("Investors: " + error.message);
}

async function syncMedia(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  startupId: string,
  tenantId: string,
  media: z.infer<typeof MediaInput>[],
) {
  // Read existing slots so we can delete orphaned storage objects for
  // removed-or-replaced slots (no rows = no orphans).
  const { data: existing } = await supabase
    .from("startup_media")
    .select("slot, image_url")
    .eq("startup_id", startupId);
  const existingBySlot = new Map<number, string>(
    ((existing ?? []) as Array<{ slot: number; image_url: string }>).map((r) => [r.slot, r.image_url]),
  );
  const incomingBySlot = new Map<number, string>(media.map((m) => [m.slot, m.image_path]));

  const orphanPaths: string[] = [];
  for (const [slot, oldPath] of existingBySlot) {
    const newPath = incomingBySlot.get(slot);
    if (!newPath || newPath !== oldPath) orphanPaths.push(oldPath);
  }

  // Delete DB rows not in incoming list.
  const keepSlots = media.map((m) => m.slot);
  const delQ = supabase.from("startup_media").delete().eq("startup_id", startupId);
  if (keepSlots.length > 0) {
    await delQ.not("slot", "in", `(${keepSlots.join(",")})`);
  } else {
    await delQ;
  }
  for (const m of media) {
    const { error } = await supabase
      .from("startup_media")
      .upsert(
        {
          startup_id: startupId,
          tenant_id: tenantId,
          slot: m.slot,
          image_url: m.image_path,
          caption: m.caption ?? null,
        },
        { onConflict: "startup_id,slot" },
      );
    if (error) throw new Error("Media slot " + m.slot + ": " + error.message);
  }

  // Best-effort storage cleanup. Don't fail the save if storage delete fails.
  if (orphanPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(orphanPaths).catch(() => {});
  }
}

async function removeStorageObjects(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  paths: (string | null | undefined)[],
) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  await supabase.storage.from(BUCKET).remove(list).catch(() => {});
}

export const createStartup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ins, error } = await supabase
      .from("startups")
      .insert({
        tenant_id: data.tenantId,
        startup_name: data.startupName,
        
        website_url: emptyToNull(data.websiteUrl),
        city: emptyToNull(data.city),
        industry: emptyToNull(data.industry),
        short_description: emptyToNull(data.shortDescription),
        long_description: emptyToNull(data.longDescription),
        status: data.status,
        visibility: data.visibility,
        logo_url: emptyToNull(data.logoPath),
        company_type: emptyToNull(data.companyType),
        year_founded: data.yearFounded ?? null,
        email: emptyToNull(data.email),
        headquarters: emptyToNull(data.headquarters),
        linkedin_url: emptyToNull(data.linkedinUrl),
        investment_stage: data.investmentStage ?? null,
        product_tags: data.productTags ?? [],
        market_tags: data.marketTags ?? [],
        created_by: userId,
        updated_by: userId,
      })
      .select("id, tenant_id")
      .single();
    if (error) throw new Error(error.message);

    const { error: oErr } = await supabase.from("startup_ownership").insert({
      startup_id: ins.id, tenant_id: ins.tenant_id, owning_agent_user_id: data.owningAgentUserId,
    });
    if (oErr) { await supabase.from("startups").delete().eq("id", ins.id); throw new Error("Owner assignment failed: " + oErr.message); }

    const { error: aErr } = await supabase.from("startup_ai_ownership").insert({
      startup_id: ins.id, tenant_id: ins.tenant_id, owning_ai_agent_id: data.owningAiAgentId,
    });
    if (aErr) { await supabase.from("startups").delete().eq("id", ins.id); throw new Error("AI owner assignment failed: " + aErr.message); }

    if (data.founders) await syncFounders(supabase, ins.id, ins.tenant_id, data.founders);
    if (data.investorIds) await syncInvestors(supabase, ins.id, ins.tenant_id, data.investorIds);
    if (data.media) await syncMedia(supabase, ins.id, ins.tenant_id, data.media);

    await logActivity(supabase, ins.id, ins.tenant_id, userId, "STARTUP_CREATED", { name: data.startupName });
    return { id: ins.id };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  startupName: z.string().min(1).max(255).optional(),
  
  websiteUrl: z.string().max(2048).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  industry: z.string().max(255).nullable().optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  longDescription: z.string().max(5000).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  ...ProfileFields,
});

export const updateStartup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("startups").select("tenant_id, status, visibility, logo_url").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Not found");

    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.startupName !== undefined) patch.startup_name = data.startupName;
    
    if (data.websiteUrl !== undefined) patch.website_url = data.websiteUrl;
    if (data.city !== undefined) patch.city = data.city;
    if (data.industry !== undefined) patch.industry = data.industry;
    if (data.shortDescription !== undefined) patch.short_description = data.shortDescription;
    if (data.longDescription !== undefined) patch.long_description = data.longDescription;
    if (data.status !== undefined) patch.status = data.status;
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.logoPath !== undefined) patch.logo_url = data.logoPath;
    if (data.companyType !== undefined) patch.company_type = data.companyType;
    if (data.yearFounded !== undefined) patch.year_founded = data.yearFounded;
    if (data.email !== undefined) patch.email = data.email;
    if (data.headquarters !== undefined) patch.headquarters = data.headquarters;
    if (data.linkedinUrl !== undefined) patch.linkedin_url = emptyToNull(data.linkedinUrl);
    if (data.investmentStage !== undefined) patch.investment_stage = data.investmentStage;
    if (data.productTags !== undefined) patch.product_tags = data.productTags;
    if (data.marketTags !== undefined) patch.market_tags = data.marketTags;

    const { error } = await supabase.from("startups").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Clean up replaced/removed logo from storage (best-effort).
    if (
      data.logoPath !== undefined &&
      existing.logo_url &&
      existing.logo_url !== data.logoPath
    ) {
      await removeStorageObjects(supabase, [existing.logo_url]);
    }

    if (data.founders !== undefined) await syncFounders(supabase, data.id, existing.tenant_id, data.founders);
    if (data.investorIds !== undefined) await syncInvestors(supabase, data.id, existing.tenant_id, data.investorIds);
    if (data.media !== undefined) await syncMedia(supabase, data.id, existing.tenant_id, data.media);

    if (data.status && data.status !== existing.status) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "STATUS_CHANGED", { from: existing.status, to: data.status });
    }
    if (data.visibility && data.visibility !== existing.visibility) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "VISIBILITY_CHANGED", { from: existing.visibility, to: data.visibility });
    }
    await logActivity(supabase, data.id, existing.tenant_id, userId, "STARTUP_UPDATED", patch);
    return { ok: true };
  });

export const archiveStartup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("startups").select("tenant_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const { error } = await supabase
      .from("startups")
      .update({ status: "Archived", visibility: "Archived", updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, data.id, row.tenant_id, userId, "STATUS_CHANGED", { to: "Archived" });
    return { ok: true };
  });

// --- Helpers for the form ---

export const listTenantInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("investors")
      .select("id, investor_name, website_url")
      .eq("tenant_id", data.tenantId)
      .order("investor_name");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      name: r.investor_name as string,
      website: r.website_url as string | null,
    }));
  });

export const createStartupMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenantId: z.string().uuid(),
      startupId: z.string().uuid().optional(),
      kind: z.enum(["logo", "slot-1", "slot-2", "slot-3"]),
      ext: z.string().regex(/^[a-z0-9]{2,5}$/i),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const startupSegment = data.startupId ?? "draft-" + crypto.randomUUID();
    const filename = `${data.kind}-${Date.now()}.${data.ext.toLowerCase()}`;
    const path = `${data.tenantId}/${startupSegment}/${filename}`;
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const getStartupSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const url = await signPath(context.supabase, data.path);
    return { url };
  });
