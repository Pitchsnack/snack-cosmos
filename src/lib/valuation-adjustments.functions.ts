import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_VALUATION_SETTINGS,
  type Adjustment,
  type AdjustmentType,
  type FilingLine,
  isRevenueType,
  revenueFilingLine,
  type Recurs,
  type Stake,
  type ValuationSettings,
} from "@/lib/valuation-adjustments";

type Ctx = { supabase: any; userId: string };

const typeEnum = z.enum([
  "booked_expense",
  "one_off_expense",
  "missing_cost",
  "unrecorded_income",
  "below_market_related_party",
  "revenue_elsewhere",
  "one_off_income",
]);
const lineEnum = z.enum([
  "cost_of_goods_sold",
  "selling_admin",
  "other_expenses",
  "revenue",
  "other_income",
]);
const recursEnum = z.enum(["yearly", "one_off"]);

async function startupScope(ctx: Ctx, startupId: string) {
  const { data, error } = await ctx.supabase
    .from("startups")
    .select("id, tenant_id")
    .eq("id", startupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Startup not found");
  return { tenantId: (data.tenant_id as string | null) ?? null };
}

async function audit(
  ctx: Ctx,
  tenantId: string | null,
  entityId: string,
  entityType: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
) {
  await ctx.supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    old_value: (oldValue ?? null) as never,
    new_value: (newValue ?? null) as never,
  });
}

function rowToAdjustment(r: any): Adjustment {
  return {
    id: r.id,
    description: r.description,
    type: r.type as AdjustmentType,
    filingLine: (r.filing_line as FilingLine | null) ?? null,
    amount: Number(r.amount),
    discountPct: r.discount_pct === null || r.discount_pct === undefined ? null : Number(r.discount_pct),
    costsAmount: r.costs_amount === null || r.costs_amount === undefined ? null : Number(r.costs_amount),
    recurs: r.recurs as Recurs,
  };
}

export interface ValuationAdjustmentsPayload {
  settings: ValuationSettings;
  adjustments: Adjustment[];
}

export const getValuationAdjustments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ startupId: z.string().uuid(), fiscalYear: z.number().int() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ValuationAdjustmentsPayload> => {
    const ctx = context as unknown as Ctx;
    const [rows, settings] = await Promise.all([
      ctx.supabase
        .from("valuation_adjustments")
        .select(
          "id, description, type, filing_line, amount, discount_pct, costs_amount, recurs, created_at",
        )
        .eq("startup_id", data.startupId)
        .eq("fiscal_year", data.fiscalYear)
        .order("created_at"),
      ctx.supabase
        .from("valuation_settings")
        .select("stake, tax_rate")
        .eq("startup_id", data.startupId)
        .eq("fiscal_year", data.fiscalYear)
        .maybeSingle(),
    ]);
    if (rows.error) throw new Error(rows.error.message);

    const s = settings.data as { stake: string; tax_rate: number } | null;
    return {
      settings: s
        ? { stake: s.stake as Stake, taxRate: Number(s.tax_rate) }
        : DEFAULT_VALUATION_SETTINGS,
      adjustments: (rows.data ?? []).map(rowToAdjustment),
    };
  });

export const saveValuationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupId: z.string().uuid(),
        fiscalYear: z.number().int(),
        stake: z.enum(["minority", "controlling"]).optional(),
        taxRate: z.number().min(0).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const { tenantId } = await startupScope(ctx, data.startupId);

    const { data: before } = await ctx.supabase
      .from("valuation_settings")
      .select("id, stake, tax_rate")
      .eq("startup_id", data.startupId)
      .eq("fiscal_year", data.fiscalYear)
      .maybeSingle();

    const next = {
      startup_id: data.startupId,
      tenant_id: tenantId,
      fiscal_year: data.fiscalYear,
      stake: data.stake ?? before?.stake ?? DEFAULT_VALUATION_SETTINGS.stake,
      tax_rate:
        data.taxRate ?? (before ? Number(before.tax_rate) : DEFAULT_VALUATION_SETTINGS.taxRate),
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await ctx.supabase
      .from("valuation_settings")
      .upsert(next as never, { onConflict: "startup_id,fiscal_year" })
      .select("id, stake, tax_rate")
      .single();
    if (error) throw new Error(error.message);

    await audit(
      ctx,
      tenantId,
      data.startupId,
      "valuation_settings",
      before ? "UPDATE" : "CREATE",
      before
        ? { fiscalYear: data.fiscalYear, stake: before.stake, taxRate: Number(before.tax_rate) }
        : null,
      { fiscalYear: data.fiscalYear, stake: row.stake, taxRate: Number(row.tax_rate) },
    );

    return { stake: row.stake as Stake, taxRate: Number(row.tax_rate) };
  });

export const saveValuationAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        startupId: z.string().uuid(),
        fiscalYear: z.number().int(),
        description: z.string().trim().min(1).max(300),
        type: typeEnum,
        filingLine: lineEnum.nullable().optional(),
        amount: z.number().min(0),
        discountPct: z.number().min(0).max(99).nullable().optional(),
        costsAmount: z.number().min(0).nullable().optional(),
        recurs: recursEnum,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const { tenantId } = await startupScope(ctx, data.startupId);

    // The two revenue add-backs describe yearly earnings, so a one-off cannot
    // be added back; and revenue without its costs would overstate profit.
    if (
      (data.type === "below_market_related_party" || data.type === "revenue_elsewhere") &&
      data.recurs === "one_off"
    ) {
      throw new Error(
        "One-off revenue isn't added back — a valuation reflects yearly earnings. Record it as One-off income to deduct it, or mark it yearly if it recurs.",
      );
    }
    if (data.type === "revenue_elsewhere" && (data.costsAmount ?? null) === null) {
      throw new Error("Costs of those sales are required for revenue booked elsewhere.");
    }
    if (
      data.type === "below_market_related_party" &&
      !(data.discountPct && data.discountPct > 0)
    ) {
      throw new Error("A discount to market price is required.");
    }

    const values = {
      startup_id: data.startupId,
      tenant_id: tenantId,
      fiscal_year: data.fiscalYear,
      description: data.description,
      type: data.type,
      filing_line: isRevenueType(data.type)
        ? revenueFilingLine(data.type)
        : data.type === "unrecorded_income"
          ? null
          : (data.filingLine ?? null),
      amount: data.amount,
      discount_pct: data.type === "below_market_related_party" ? (data.discountPct ?? null) : null,
      costs_amount: data.type === "revenue_elsewhere" ? (data.costsAmount ?? null) : null,
      recurs: data.recurs,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: before } = await ctx.supabase
        .from("valuation_adjustments")
        .select("id, description, type, filing_line, amount, discount_pct, costs_amount, recurs")
        .eq("id", data.id)
        .maybeSingle();
      const { data: row, error } = await ctx.supabase
        .from("valuation_adjustments")
        .update(values as never)
        .eq("id", data.id)
        .select("id, description, type, filing_line, amount, discount_pct, costs_amount, recurs")
        .single();
      if (error) throw new Error(error.message);
      await audit(ctx, tenantId, row.id, "valuation_adjustment", "UPDATE", before, {
        ...row,
        fiscalYear: data.fiscalYear,
      });
      return rowToAdjustment(row);
    }

    const { data: row, error } = await ctx.supabase
      .from("valuation_adjustments")
      .insert({ ...values, created_by: ctx.userId } as never)
      .select("id, description, type, filing_line, amount, discount_pct, costs_amount, recurs")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, tenantId, row.id, "valuation_adjustment", "CREATE", null, {
      ...row,
      fiscalYear: data.fiscalYear,
    });
    return rowToAdjustment(row);
  });

export const deleteValuationAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const { data: before } = await ctx.supabase
      .from("valuation_adjustments")
      .select(
        "id, startup_id, tenant_id, fiscal_year, description, type, filing_line, amount, discount_pct, costs_amount, recurs",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!before) return { ok: true };

    const { error } = await ctx.supabase.from("valuation_adjustments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await audit(
      ctx,
      (before.tenant_id as string | null) ?? null,
      data.id,
      "valuation_adjustment",
      "DELETE",
      before,
      null,
    );
    return { ok: true };
  });
