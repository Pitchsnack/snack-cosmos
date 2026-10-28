import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Control Admin actions on the shared DBD store: Extract / Try again, Refresh,
 * Delete, Save data by hand, and analyst line edits. Each checks Control here,
 * and the database functions check it again before writing.
 */
type Ctx = { supabase: any; userId: string };
async function control(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Control Admin only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const Reg = z.string().transform((s) => s.replace(/\D/g, "")).refine((s) => /^\d{13}$/.test(s), "A 13-digit registration number is required");

async function actorName(sb: any, id: string) {
  const { data: u } = await sb.from("users").select("first_name, last_name, email").eq("id", id).maybeSingle();
  return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "Admin";
}

export const getDbdStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reg: z.string().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await control(context as Ctx);
    const { storeState } = await import("./dbd-store.server");
    const { state, data: stored } = await storeState(sb, data.reg);
    return { state, data: stored as any };
  });

const FAIL: Record<string, string> = {
  not_configured: "DBD is not set up to answer at the moment",
  unavailable: "DBD did not answer",
  not_found: "DBD has no company with this registration number",
  ambiguous: "DBD matched more than one company",
};

/** Extract data (first fetch / Try again) and Refresh from DBD. A failure keeps what is stored. */
export const extractDbd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reg: Reg, refresh: z.boolean().default(false), replaceManual: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = await control(ctx);
    const { data: cur } = await sb.from("dbd_company_records").select("source").eq("registration_number", data.reg).maybeSingle();
    if (cur && !data.refresh) return { ok: false as const, error: "Data is already stored. Use Refresh from DBD to fetch it again." };
    if (cur?.source === "manual" && !data.replaceManual) return { ok: false as const, error: "This company has data entered by hand. Confirm to replace it with DBD data." };
    const action = data.refresh ? "refresh" : "extract";
    const { lookupDbdFinancials } = await import("./financials/dbd-provider.server");
    let outcome: any;
    try { outcome = await lookupDbdFinancials({ registeredNumber: data.reg }); }
    catch (e: any) { outcome = { status: "unavailable", detail: String(e?.message ?? e) }; }
    if (outcome.status !== "ok" && outcome.status !== "no_financials") {
      const error = FAIL[outcome.status] ?? "DBD did not answer";
      await sb.from("dbd_fetch_logs").insert({ registration_number: data.reg, action, result: outcome.status === "not_found" ? "not_found" : "failed", error, actor_id: ctx.userId, source: "dbd" });
      return { ok: false as const, error, kept: !!cur };
    }
    const { outcomeToData, produceSellerReports } = await import("./dbd-store.server");
    const { data: res, error } = await sb.rpc("dbd_store_save", {
      _actor: ctx.userId, _reg: data.reg, _action: action, _source: "dbd", _source_note: "DBD Data Warehouse",
      _data: outcomeToData(outcome), _raw: outcome, _actor_name: await actorName(sb, ctx.userId),
    });
    if (error) throw new Error(error.message);
    await produceSellerReports(context, sb, (res?.startup_ids ?? []) as string[], ctx.userId);
    return { ok: true as const, retrievedAt: res?.retrieved_at as string, years: (outcome.statements ?? []).length };
  });

const num = z.number().finite().nullable().optional();
const Manual = z.object({
  reg: Reg,
  replaceDbd: z.boolean().default(false),
  form: z.object({
    source: z.string().trim().min(2, "Say where the figures come from").max(300),
    company: z.object({
      nameTh: z.string().max(300).nullable().optional(), nameEn: z.string().max(300).nullable().optional(),
      registeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
      status: z.string().max(120).nullable().optional(), capital: num, address: z.string().max(600).nullable().optional(),
      directors: z.array(z.string().max(200)).max(30).optional(),
    }),
    years: z.array(z.object({
      year: z.number().int().min(1990).max(2100), revenue: num, costOfSales: num, grossProfit: num, operatingExpenses: num, ebitda: num, netProfit: num,
      totalAssets: num, currentAssets: num, totalLiabilities: num, currentLiabilities: num, equity: num, cash: num,
    })).max(10),
  }),
});

/** Save data (entered by hand, section 2.2). Replacing DBD data needs the confirm flag. */
export const saveManualDbd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Manual.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = await control(ctx);
    const { data: cur } = await sb.from("dbd_company_records").select("source").eq("registration_number", data.reg).maybeSingle();
    if (cur?.source === "dbd" && !data.replaceDbd) return { ok: false as const, error: "This company has DBD data. Confirm to replace it with data entered by hand." };
    if (!data.form.company.nameTh?.trim() && !data.form.company.nameEn?.trim()) return { ok: false as const, error: "Add the company name." };
    const { manualToData, produceSellerReports } = await import("./dbd-store.server");
    const name = await actorName(sb, ctx.userId);
    const { data: res, error } = await sb.rpc("dbd_store_save", {
      _actor: ctx.userId, _reg: data.reg, _action: "manual_save", _source: "manual", _source_note: data.form.source,
      _data: manualToData({ ...data.form, company: { ...data.form.company, registeredOn: data.form.company.registeredOn || null } }), _raw: null, _actor_name: name,
    });
    if (error) throw new Error(error.message);
    await produceSellerReports(context, sb, (res?.startup_ids ?? []) as string[], ctx.userId);
    return { ok: true as const, retrievedAt: res?.retrieved_at as string };
  });

export const deleteDbd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reg: Reg }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = await control(ctx);
    const { data: res, error } = await sb.rpc("dbd_store_delete", { _actor: ctx.userId, _reg: data.reg });
    if (error) throw new Error(error.message);
    return { ok: !!res?.ok };
  });

/** Analyst edit to one statement line; kept apart from the DBD figures and re-applied after every Refresh. */
export const saveAnalystEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reg: Reg, year: z.number().int(), statement: z.enum(["income", "position", "cash_flow", "ratio"]), code: z.string().min(1).max(80), amount: z.number().finite().nullable(), note: z.string().max(300).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = await control(ctx);
    const { error } = await sb.rpc("dbd_apply_edit", { _actor: ctx.userId, _reg: data.reg, _year: data.year, _statement: data.statement, _code: data.code, _amount: data.amount, _note: data.note ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
