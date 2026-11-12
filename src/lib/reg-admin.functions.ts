import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidThaiReg } from "@/lib/thai-reg";

/** Admin review (section 12): the locked registration number, its duplicates and Change registration number. Control only. */
type Ctx = { supabase: any; userId: string };
async function control(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Control Admin only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const Item = z.object({ kind: z.enum(["seller", "buyer", "advisor"]), id: z.string().uuid() });
type Target = { table: "startups" | "investors" | "advisor_firms"; id: string; col: "registered_number" | "registration_no" };

async function target(sb: any, kind: string, id: string): Promise<Target> {
  if (kind === "seller") {
    const { data } = await sb.from("hidden_profiles").select("startup_id").eq("id", id).maybeSingle();
    return { table: "startups", id: data?.startup_id ?? id, col: "registered_number" };
  }
  if (kind === "buyer") {
    const { data } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", id).maybeSingle();
    if (!data?.investor_id) throw new Error("Investor profile not found");
    return { table: "investors", id: data.investor_id, col: "registration_no" };
  }
  return { table: "advisor_firms", id, col: "registration_no" };
}

/** Other seller companies, buyer profiles or advisor firms using the same number. */
async function duplicates(sb: any, reg: string, self: Target) {
  const out: { kind: string; ref: string; id: string }[] = [];
  const [st, iv, af] = await Promise.all([
    sb.from("startups").select("id, startup_name, hidden_profiles(ref_no, id)").eq("registered_number", reg).limit(10),
    sb.from("investors").select("id, investor_name").eq("registration_no", reg).limit(10),
    sb.from("advisor_firms").select("id, name, ref_no").eq("registration_no", reg).limit(10),
  ]);
  for (const s of st.data ?? []) if (!(self.table === "startups" && s.id === self.id)) { const hp = Array.isArray(s.hidden_profiles) ? s.hidden_profiles[0] : s.hidden_profiles; out.push({ kind: "seller", ref: hp?.ref_no ?? s.startup_name ?? "Seller", id: s.id }); }
  for (const i of iv.data ?? []) if (!(self.table === "investors" && i.id === self.id)) out.push({ kind: "buyer", ref: i.investor_name ?? "Buyer", id: i.id });
  for (const f of af.data ?? []) if (!(self.table === "advisor_firms" && f.id === self.id)) out.push({ kind: "advisor", ref: f.ref_no ?? f.name ?? "Advisor", id: f.id });
  return out;
}

export const getRegReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Item.parse(d))
  .handler(async ({ data, context }) => {
    const sb = await control(context as Ctx);
    const t = await target(sb, data.kind, data.id);
    const { data: row } = await sb.from(t.table).select(`${t.col}, reg_locked_at`).eq("id", t.id).maybeSingle();
    const reg: string | null = row?.[t.col] ?? null;
    const dups = reg && /^\d{13}$/.test(reg) ? await duplicates(sb, reg, t) : [];
    return { reg, locked: !!row?.reg_locked_at, duplicates: dups };
  });

export const adminChangeRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Item.extend({ reg: z.string().regex(/^\d{13}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = await control(ctx);
    if (!isValidThaiReg(data.reg)) return { ok: false as const, error: "This registration number isn't valid. Check the 13 digits." };
    const t = await target(sb, data.kind, data.id);
    const { data: row } = await sb.from(t.table).select(t.table === "advisor_firms" ? t.col : `${t.col}, tenant_id`).eq("id", t.id).maybeSingle();
    if (!row) return { ok: false as const, error: "Record not found" };
    const old = row[t.col] ?? null;
    if (old === data.reg) return { ok: false as const, error: "That is the current number." };
    // Looked up and stored like the sign-up check (only when the store doesn't have it yet).
    const { data: rec } = await sb.from("dbd_company_records").select("registration_number").eq("registration_number", data.reg).maybeSingle();
    if (!rec) {
      const { lookupDbdFinancials } = await import("./financials/dbd-provider.server");
      const outcome: any = await lookupDbdFinancials({ registeredNumber: data.reg }).catch((e: any) => ({ status: "unavailable", detail: String(e?.message ?? e) }));
      if (outcome.status === "not_found") return { ok: false as const, error: "No company is registered under this number." };
      if (outcome.status !== "ok" && outcome.status !== "no_financials") return { ok: false as const, error: "The register didn't answer. Try again." };
      const { outcomeToData } = await import("./dbd-store.server");
      const { error } = await sb.rpc("dbd_store_save", { _actor: ctx.userId, _reg: data.reg, _action: "extract", _source: "dbd", _source_note: "Change registration number", _data: outcomeToData(outcome), _raw: outcome, _actor_name: "Admin" });
      if (error) return { ok: false as const, error: error.message };
    }
    const { error } = await sb.from(t.table).update({ [t.col]: data.reg, reg_locked_at: new Date().toISOString() }).eq("id", t.id);
    if (error) return { ok: false as const, error: error.message };
    await sb.from("audit_logs").insert({ tenant_id: row.tenant_id ?? null, entity_type: t.table, entity_id: t.id, action: "registration_number_changed", performed_by: ctx.userId, old_value: { registration_number: old }, new_value: { registration_number: data.reg } });
    return { ok: true as const };
  });
