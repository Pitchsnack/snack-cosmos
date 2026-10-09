import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Seller setup wizard on a real Draft business (read/write scoped to the caller's own business). */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type SellerSetup = {
  id: string; name: string; reg: string; web: string; year: string; city: string; rev: string | null; size: string | null;
  sector: string | null; licences: { category: string; name: string; number?: string | null }[]; iso: string[];
  role: "owner" | "family_owner" | "agent" | null; fromSignup: string[]; setupDoneAt: string | null;
  addr: { street: string; unit: string; district: string; province: string; postal: string };
};

const AddrInput = z.object({
  street: z.string().max(120), unit: z.string().max(120), district: z.string().max(80), province: z.string().max(80), postal: z.string().max(5),
});
type AddrT = z.infer<typeof AddrInput>;
function addrPatch(a: AddrT) {
  const tail = [a.province.trim(), a.postal.trim()].filter(Boolean).join(" ");
  const line = [a.unit.trim(), a.street.trim(), a.district.trim(), tail].filter(Boolean).join(", ");
  return {
    address_line1: a.street.trim() || null, address_line2: a.unit.trim() || null, address_city_district: a.district.trim() || null,
    address_province_state: a.province || null, postal_code: a.postal || null, business_address: line || null,
  };
}

export const getSellerSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SellerSetup> => {
    const { assertCanSetup } = await import("./seller-setup.server");
    const sb = await admin();
    await assertCanSetup(sb, context.supabase, context.userId, data.id);
    const [{ data: s }, { data: o }] = await Promise.all([
      sb.from("startups").select("*").eq("id", data.id).single(),
      sb.from("startup_ownership").select("seller_relation").eq("startup_id", data.id).maybeSingle(),
    ]);
    return {
      id: s.id, name: s.startup_name ?? "", reg: s.registered_number ?? "", web: s.website_url ?? "",
      year: s.year_founded ? String(s.year_founded) : "", city: s.city ?? "", rev: s.last_year_revenue ?? null,
      size: s.company_size ?? null, sector: s.sector ?? null, licences: s.regulatory_licenses ?? [], iso: s.iso_standards ?? [],
      addr: { street: s.address_line1 ?? "", unit: s.address_line2 ?? "", district: s.address_city_district ?? "", province: s.address_province_state ?? s.city ?? "", postal: s.postal_code ?? "" },
      role: o?.seller_relation ?? null, fromSignup: s.setup_from_signup ?? [], setupDoneAt: s.setup_done_at ?? null,
    };
  });

export const saveSellerSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    role: z.enum(["owner", "family_owner", "agent"]).nullable(),
    name: z.string().max(255), reg: z.string().max(13), web: z.string().max(2048), year: z.string().max(4),
    city: z.string().max(100), rev: z.string().max(60).nullable(), size: z.string().max(30).nullable(), sector: z.string().max(100).nullable(),
    licences: z.array(z.object({ category: z.string().max(40), name: z.string().max(160), number: z.string().max(120).nullable().optional() })).max(50),
    iso: z.array(z.string().max(80)).max(20),
    addr: AddrInput.optional(),
    done: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCanSetup } = await import("./seller-setup.server");
    const sb = await admin();
    await assertCanSetup(sb, context.supabase, context.userId, data.id);
    const y = /^\d{4}$/.test(data.year) ? Number(data.year) : null;
    const patch: Record<string, unknown> = {
      registered_number: data.reg || null, website_url: data.web.trim() || null, year_founded: y,
      city: data.city || null, headquarters: "Thailand", last_year_revenue: data.rev, company_size: data.size, sector: data.sector,
      regulatory_licenses: data.licences, iso_standards: data.iso, updated_by: context.userId, updated_at: new Date().toISOString(),
    };
    if (data.addr) { Object.assign(patch, addrPatch(data.addr)); if (data.addr.province) patch.city = data.addr.province; }
    if (data.name.trim()) patch.startup_name = data.name.trim();
    if (data.done) patch.setup_done_at = new Date().toISOString();
    const { error } = await sb.from("startups").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.role) await sb.from("startup_ownership").update({ seller_relation: data.role }).eq("startup_id", data.id);
    return { ok: true };
  });

/** + Add My Business for a seller account: makes the business from the wizard's answers. */
export const createMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(["owner", "family_owner", "agent"]).nullable(),
    name: z.string().trim().min(1).max(255), reg: z.string().max(13), web: z.string().max(2048), year: z.string().max(4),
    city: z.string().max(100), rev: z.string().max(60).nullable(), size: z.string().max(30).nullable(), sector: z.string().max(100).nullable(),
    licences: z.array(z.object({ category: z.string().max(40), name: z.string().max(160), number: z.string().max(120).nullable().optional() })).max(50),
    iso: z.array(z.string().max(80)).max(20),
    addr: AddrInput.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { createSellerBusiness, sellerTenant } = await import("./seller-setup.server");
    const sb = await admin();
    if (!(await sellerTenant(sb, context.userId))) throw new Error("Only seller accounts can add a business here.");
    const id = await createSellerBusiness(sb, context.userId, {
      name: data.name, relation: data.role, website: data.web.trim() || null, year: /^\d{4}$/.test(data.year) ? Number(data.year) : null,
      size: data.size, regNo: data.reg || null, city: data.city || null, revenue: data.rev, sector: data.sector,
      licences: data.licences, iso: data.iso, setupDone: true,
    });
    if (data.addr) await sb.from("startups").update({ ...addrPatch(data.addr), ...(data.addr.province ? { city: data.addr.province } : {}) }).eq("id", id);
    return { id };
  });

/** Sellers who signed up before Drafts were made at sign-up: make it now from their answers. */
export const ensureMySellerDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureSellerDraftFromSignup } = await import("./seller-setup.server");
    const sb = await admin();
    const { data: a } = await sb.from("signup_answers").select("*").eq("user_id", context.userId).maybeSingle();
    if (!a || a.role !== "seller" || !a.done_at) return { id: null as string | null };
    return { id: await ensureSellerDraftFromSignup(sb, context.userId, a) };
  });
