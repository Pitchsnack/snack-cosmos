/**
 * PRD P-17 V4 — Global Startups Registry server functions.
 *
 * This is the ONLY file allowed to directly query `global_startups` and
 * `global_startup_imports`. Anything else must go through
 * `src/lib/api-gateway/global-startups.ts`.
 *
 * Real role / real active-tenant checks via the authenticated supabase
 * client (RLS) + `auth.uid()` inside the SECURITY DEFINER import RPC.
 * View Switcher preview state never reaches this module.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GlobalStartupStatus = "draft" | "available" | "recommended" | "archived";

export interface GlobalStartup {
  id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  description: string | null;
  website: string | null;
  tags: string[];
  status: GlobalStartupStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalStartupImportSummary {
  id: string;
  global_id: string;
  tenant_id: string;
  tenant_startup_id: string;
  imported_by: string;
  imported_at: string;
}

const STATUSES: GlobalStartupStatus[] = ["draft", "available", "recommended", "archived"];

const SELECT_COLS =
  "id, name, sector, stage, description, website, tags, status, created_by, created_at, updated_at";

function normalize(row: Record<string, unknown>): GlobalStartup {
  return {
    id: row.id as string,
    name: row.name as string,
    sector: (row.sector as string | null) ?? null,
    stage: (row.stage as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    status: row.status as GlobalStartupStatus,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
const ListInput = z
  .object({
    search: z.string().optional(),
    sector: z.string().optional(),
    stage: z.string().optional(),
    status: z.enum(["draft", "available", "recommended", "archived"]).optional(),
    tag: z.string().optional(),
    publishedOnly: z.boolean().optional(),
    sort: z.enum(["updated_desc", "created_desc", "name_asc"]).default("updated_desc"),
  })
  .partial()
  .extend({
    sort: z.enum(["updated_desc", "created_desc", "name_asc"]).default("updated_desc"),
  });

export const listGlobalStartupsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListInput.parse(input ?? {}))
  .handler(async ({ context, data }): Promise<GlobalStartup[]> => {
    const { supabase } = context;
    let q = supabase.from("global_startups").select(SELECT_COLS);

    if (data.publishedOnly) q = q.in("status", ["available", "recommended"]);
    else if (data.status) q = q.eq("status", data.status);

    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%_]/g, (m) => "\\" + m);
      q = q.ilike("name", `%${s}%`);
    }
    if (data.sector) q = q.eq("sector", data.sector);
    if (data.stage) q = q.eq("stage", data.stage);
    if (data.tag) q = q.contains("tags", [data.tag]);

    switch (data.sort) {
      case "created_desc":
        q = q.order("created_at", { ascending: false });
        break;
      case "name_asc":
        q = q.order("name", { ascending: true });
        break;
      default:
        q = q.order("updated_at", { ascending: false });
    }

    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(normalize);
  });

// ---------------------------------------------------------------------------
// Get one
// ---------------------------------------------------------------------------
export const getGlobalStartupFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ globalId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<GlobalStartup> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("global_startups")
      .select(SELECT_COLS)
      .eq("id", data.globalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return normalize(row);
  });

// ---------------------------------------------------------------------------
// Create / update / status
// ---------------------------------------------------------------------------
const WriteFields = {
  name: z.string().min(1).max(255),
  sector: z.string().max(255).nullable().optional(),
  stage: z.string().max(255).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  website: z.string().max(2048).nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  status: z.enum(["draft", "available", "recommended", "archived"]).optional(),
};

export const createGlobalStartupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object(WriteFields).parse(input))
  .handler(async ({ context, data }): Promise<GlobalStartup> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("global_startups")
      .insert({
        name: data.name,
        sector: data.sector ?? null,
        stage: data.stage ?? null,
        description: data.description ?? null,
        website: data.website ?? null,
        tags: data.tags ?? [],
        status: data.status ?? "draft",
        created_by: userId,
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return normalize(row);
  });

const UpdateInput = z.object({
  globalId: z.string().uuid(),
  name: WriteFields.name.optional(),
  sector: WriteFields.sector,
  stage: WriteFields.stage,
  description: WriteFields.description,
  website: WriteFields.website,
  tags: WriteFields.tags,
  status: WriteFields.status,
});

export const updateGlobalStartupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ context, data }): Promise<GlobalStartup> => {
    const { supabase } = context;
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.sector !== undefined) update.sector = data.sector;
    if (data.stage !== undefined) update.stage = data.stage;
    if (data.description !== undefined) update.description = data.description;
    if (data.website !== undefined) update.website = data.website;
    if (data.tags !== undefined) update.tags = data.tags;
    if (data.status !== undefined) update.status = data.status;
    const { data: row, error } = await supabase
      .from("global_startups")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("id", data.globalId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return normalize(row);
  });

export const setGlobalStartupStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        globalId: z.string().uuid(),
        status: z.enum(["draft", "available", "recommended", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<GlobalStartup> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("global_startups")
      .update({ status: data.status })
      .eq("id", data.globalId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return normalize(row);
  });

// ---------------------------------------------------------------------------
// Import history (ledger ONLY — never joined to tenant startups)
// ---------------------------------------------------------------------------
export const listImportsOfGlobalStartupFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ globalId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<GlobalStartupImportSummary[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("global_startup_imports")
      .select("id, global_id, tenant_id, tenant_startup_id, imported_by, imported_at")
      .eq("global_id", data.globalId)
      .order("imported_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as GlobalStartupImportSummary[];
  });

// ---------------------------------------------------------------------------
// Import — atomic via SECURITY DEFINER RPC. Real session context is used
// to resolve the active tenant; preview/view-switcher state never reaches
// this handler.
// ---------------------------------------------------------------------------
export const importGlobalStartupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        globalId: z.string().uuid(),
        owningAgentUserId: z.string().uuid(),
        owningAiAgentId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ tenantStartupId: string }> => {
    const { supabase, userId } = context;

    const { data: ctxRow, error: ctxErr } = await supabase
      .from("workspace_context")
      .select("active_tenant_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (ctxErr) throw new Error(ctxErr.message);
    const tenantId = ctxRow?.active_tenant_id as string | null;
    if (!tenantId) {
      throw new Error("No active tenant. Switch to a tenant workspace before importing.");
    }

    const { data: newId, error } = await supabase.rpc("fn_import_global_startup", {
      _global_id: data.globalId,
      _tenant_id: tenantId,
      _owning_agent: data.owningAgentUserId,
      _owning_ai_agent: data.owningAiAgentId,
      _imported_by: userId,
    });
    if (error) throw new Error(error.message);
    if (!newId || typeof newId !== "string") throw new Error("Import failed");
    return { tenantStartupId: newId };
  });

export type { GlobalStartup as GlobalStartupDTO };
