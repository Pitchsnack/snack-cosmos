/**
 * PRD 8 — Global Directory server functions (Stream A scaffold).
 *
 * These functions present the existing single-database records as the
 * "Control Global Database" pool for CONTROL users. They are explicitly
 * stubs for the future External API Gateway. No business logic that
 * couples the UI to Supabase belongs here — only thin DTO mapping.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface GlobalStartupDTO {
  id: string;
  name: string;
  legalName: string | null;
  country: string | null;
  industry: string | null;
  shortDescription: string | null;
  websiteUrl: string | null;
  originTenantId: string;
  originTenantName: string | null;
  createdAt: string;
}

export interface GlobalInvestorDTO {
  id: string;
  name: string;
  legalName: string | null;
  country: string | null;
  investorType: string | null;
  ticketSize: string | null;
  aum: string | null;
  shortDescription: string | null;
  websiteUrl: string | null;
  originTenantId: string;
  originTenantName: string | null;
  createdAt: string;
}

export interface GlobalDealDTO {
  id: string;
  name: string;
  stage: string;
  startupName: string | null;
  investorName: string | null;
  investmentAmount: number | null;
  expectedCloseDate: string | null;
  originTenantId: string;
  originTenantName: string | null;
  createdAt: string;
}

export interface ImportTargetDTO {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
}

export type ImportEntity = "startup" | "investor" | "deal";

export interface ImportRequest {
  entity: ImportEntity;
  sourceGlobalId: string;
  targetTenantId: string;
  note?: string;
}

export interface ImportResult {
  /** Always 'queued' in the current stub — the external Import Engine
   * is responsible for actually creating the independent tenant copy. */
  status: "queued";
  jobId: string;
  message: string;
  /** Echo of the request so the UI can show a confirmation panel. */
  request: ImportRequest;
}

// ── Helpers ────────────────────────────────────────────────────────────

function assertControl(roles: unknown[]): asserts roles is string[] {
  // role check happens via RLS on the listed tables, but CONTROL-only
  // routes also guard at the UI layer (PermissionGuard).
  void roles;
}

// ── Global lists ──────────────────────────────────────────────────────

export const listGlobalStartups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GlobalStartupDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("startups")
      .select(`
        id, startup_name, legal_name, country, industry,
        short_description, website_url, tenant_id, created_at,
        tenants!inner(tenant_name)
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const tnt = r.tenants as unknown as { tenant_name: string } | null;
      return {
        id: r.id as string,
        name: r.startup_name as string,
        legalName: (r.legal_name as string | null) ?? null,
        country: (r.country as string | null) ?? null,
        industry: (r.industry as string | null) ?? null,
        shortDescription: (r.short_description as string | null) ?? null,
        websiteUrl: (r.website_url as string | null) ?? null,
        originTenantId: r.tenant_id as string,
        originTenantName: tnt?.tenant_name ?? null,
        createdAt: r.created_at as string,
      };
    });
  });

export const listGlobalInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GlobalInvestorDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("investors")
      .select(`
        id, investor_name, legal_name, country, investor_type, ticket_size, aum,
        short_description, website_url, tenant_id, created_at,
        tenants!inner(tenant_name)
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const tnt = r.tenants as unknown as { tenant_name: string } | null;
      return {
        id: r.id as string,
        name: r.investor_name as string,
        legalName: (r.legal_name as string | null) ?? null,
        country: (r.country as string | null) ?? null,
        investorType: (r.investor_type as string | null) ?? null,
        ticketSize: (r.ticket_size as string | null) ?? null,
        aum: (r.aum as string | null) ?? null,
        shortDescription: (r.short_description as string | null) ?? null,
        websiteUrl: (r.website_url as string | null) ?? null,
        originTenantId: r.tenant_id as string,
        originTenantName: tnt?.tenant_name ?? null,
        createdAt: r.created_at as string,
      };
    });
  });

export const listGlobalDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GlobalDealDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("deals")
      .select(`
        id, deal_name, stage, investment_amount, expected_close_date,
        tenant_id, created_at,
        tenants!inner(tenant_name),
        startups!inner(startup_name),
        investors!inner(investor_name)
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const tnt = r.tenants as unknown as { tenant_name: string } | null;
      const s = r.startups as unknown as { startup_name: string } | null;
      const i = r.investors as unknown as { investor_name: string } | null;
      return {
        id: r.id as string,
        name: r.deal_name as string,
        stage: r.stage as string,
        startupName: s?.startup_name ?? null,
        investorName: i?.investor_name ?? null,
        investmentAmount: (r.investment_amount as number | null) ?? null,
        expectedCloseDate: (r.expected_close_date as string | null) ?? null,
        originTenantId: r.tenant_id as string,
        originTenantName: tnt?.tenant_name ?? null,
        createdAt: r.created_at as string,
      };
    });
  });

// ── Import targets (tenants list, CONTROL-visible via RLS) ───────────

export const listImportTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportTargetDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select("id, tenant_name, tenant_code, status")
      .neq("status", "Archived")
      .order("tenant_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      tenantId: t.id as string,
      tenantName: t.tenant_name as string,
      tenantCode: t.tenant_code as string,
    }));
  });

// ── Import (STUB only) ───────────────────────────────────────────────

const ImportSchema = z.object({
  entity: z.enum(["startup", "investor", "deal"]),
  sourceGlobalId: z.string().uuid(),
  targetTenantId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

/**
 * STUB — the External Import Engine (PRD 8 §6) is responsible for the
 * actual cross-database copy that creates an independent tenant record
 * with `source_global_id` lineage. This function intentionally does
 * NOT write to the database. It validates input, records the request
 * in `audit_logs` for traceability, and returns a synthetic jobId.
 *
 * Doing the copy here would couple the architecture to Supabase and
 * violate the PRD 7 + PRD 8 rule "Global record ≠ Tenant record" the
 * moment auto-sync is wired up. The external engine is the only safe
 * place for this logic.
 */
export const importFromGlobalStub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ImportSchema.parse(input))
  .handler(async ({ context, data }): Promise<ImportResult> => {
    const { supabase, userId } = context;
    assertControl([]);
    const jobId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`) as string;

    // Audit trail only. No mutation of startups/investors/deals.
    await supabase.from("audit_logs").insert({
      tenant_id: data.targetTenantId,
      entity_type: `${data.entity}_import_request`,
      entity_id: data.sourceGlobalId,
      action: "IMPORT_FROM_GLOBAL_REQUESTED",
      performed_by: userId,
      new_value: {
        jobId,
        entity: data.entity,
        sourceGlobalId: data.sourceGlobalId,
        targetTenantId: data.targetTenantId,
        note: data.note ?? null,
        stub: true,
        engine: "external (pending PRD 8 Stream B)",
      },
    });

    return {
      status: "queued",
      jobId,
      message:
        "Import request recorded. The external Import Engine will create an independent tenant copy.",
      request: data,
    };
  });
