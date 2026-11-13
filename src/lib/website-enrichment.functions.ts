import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { capWords, enrichmentDto, shortDescriptionFrom, shouldReuseEnrichment, websiteDomain, websiteKey, type WebsiteEnrichmentDTO } from "./website-enrichment";

const Input = z.object({ role: z.enum(["seller", "buyer", "advisor"]), id: z.string().uuid(), website: z.string().trim().max(500).optional(), retry: z.boolean().optional() });
type Input = z.infer<typeof Input>;
type Owned = { sb: any; table: "startups" | "investors" | "advisor_firms"; row: any; buyer?: any };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function owned(data: Input, context: { userId: string; supabase: any }): Promise<Owned> {
  const sb = await admin();
  if (data.role === "buyer") {
    const { resolveBuyer } = await import("./buyer-investor.functions");
    const buyer = await resolveBuyer(context.userId, data.id);
    const { data: row } = await sb.from("investors").select("*").eq("id", data.id).single();
    return { sb, table: "investors", row, buyer };
  }
  if (data.role === "seller") {
    const { assertCanSetup } = await import("./seller-setup.server");
    await assertCanSetup(sb, context.supabase, context.userId, data.id);
    const { data: row } = await sb.from("startups").select("*").eq("id", data.id).single();
    return { sb, table: "startups", row };
  }
  // RLS proves ownership before any privileged write; Control's separate read path is not a background-start path.
  const { data: allowed } = await context.supabase.from("advisor_firms").select("id").eq("id", data.id).eq("owner_user_id", context.userId).maybeSingle();
  if (!allowed) throw new Error("This firm profile isn't yours.");
  const { data: row } = await sb.from("advisor_firms").select("*").eq("id", data.id).single();
  if (!row) throw new Error("Firm profile not found.");
  return { sb, table: "advisor_firms", row };
}

function currentWebsite(data: Input, o: Owned): string {
  return data.website || (data.role === "seller" ? o.row.website_url : data.role === "buyer" ? o.row.website_url : o.row.website) || "";
}
function normalizedWebsite(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Enter a valid website address.");
  return u.toString().replace(/\/+$/, "");
}
function cleanResult(result: Record<string, unknown>): Record<string, unknown> {
  const { _debug, ...safe } = result;
  return safe;
}

async function saveSuggestions(data: Input, o: Owned, result: Record<string, unknown>): Promise<string[]> {
  const filled: string[] = [];
  const bio = typeof result.bio === "string" ? result.bio.trim() : "";
  if (data.role === "advisor") {
    const patch: Record<string, unknown> = {};
    if (bio && !o.row.description?.trim()) { patch.description = shortDescriptionFrom(bio); filled.push("desc"); }
    if (bio && !o.row.long_description?.trim()) { patch.long_description = capWords(bio, 500).slice(0, 4000); filled.push("long"); }
    if (Object.keys(patch).length) await o.sb.from("advisor_firms").update(patch).eq("id", data.id);
    return filled;
  }
  if (data.role === "buyer") {
    const short = bio ? shortDescriptionFrom(bio) : "";
    const long = bio ? capWords(bio, 80) : "";
    if (bio && !o.row.short_description?.trim()) {
      await o.sb.from("investors").update({ short_description: long, updated_at: new Date().toISOString() }).eq("id", data.id);
      filled.push("about");
    }
    const buyer = o.buyer;
    if (bio && !String(buyer.p.description ?? "").trim()) {
      if (buyer.extra) {
        const { data: cur } = await o.sb.from("investors").select("wizard").eq("id", data.id).single();
        const w = cur?.wizard ?? {};
        await o.sb.from("investors").update({ wizard: { ...w, bp: { ...(w.bp ?? {}), description: short } } }).eq("id", data.id);
      } else await o.sb.from("buyer_profiles").update({ description: short }).eq("user_id", buyer.bpUser ?? buyer.p.user_id);
      filled.push("desc");
    }
    return filled;
  }

  const { data: hp } = await o.sb.from("hidden_profiles").select("highlights").eq("startup_id", data.id).maybeSingle();
  const { mergeWebsiteEnrich } = await import("./seller-website-enrich");
  const draft = {
    shortDescription: o.row.short_description ?? "", longDescription: o.row.long_description ?? "",
    productTags: o.row.product_tags ?? [], marketTags: o.row.market_tags ?? [], highlights: hp?.highlights ?? [],
  };
  const merged = mergeWebsiteEnrich(draft as never, result, {}, false);
  const columns: Record<string, string> = { shortDescription: "short_description", longDescription: "long_description", productTags: "product_tags", marketTags: "market_tags" };
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(columns)) {
    const value = (merged.patch as Record<string, unknown>)[key];
    if (value !== undefined) { patch[column] = value; filled.push(key); }
  }
  if (Object.keys(patch).length) { patch.updated_at = new Date().toISOString(); await o.sb.from("startups").update(patch).eq("id", data.id); }
  if (merged.patch.highlights) {
    await o.sb.from("hidden_profiles").update({ highlights: merged.patch.highlights }).eq("startup_id", data.id);
    filled.push("highlights");
  }
  return filled;
}

async function run(data: Input, context: { userId: string; supabase: any }): Promise<WebsiteEnrichmentDTO> {
  const o = await owned(data, context);
  const raw = currentWebsite(data, o);
  const website = normalizedWebsite(raw);
  if (!website) return { status: "idle", websiteKey: null, domain: null };
  const key = websiteKey(website);
  const old = (o.row.website_enrichment ?? null) as { status?: string; website_key?: string; updated_at?: string } | null;
  if (shouldReuseEnrichment(old, key, data.retry)) return enrichmentDto({ website_enrichment: o.row.website_enrichment });
  const running = { status: "running", website_key: key, updated_at: new Date().toISOString() };
  const websiteColumn = data.role === "advisor" ? "website" : "website_url";
  let claim = o.sb.from(o.table).update({ website_enrichment: running, [websiteColumn]: website }).eq("id", data.id);
  if (old?.updated_at) claim = claim.eq("website_enrichment->>updated_at", old.updated_at);
  else claim = claim.is("website_enrichment", null);
  const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
  if (claimError) throw new Error("Could not start website reading.");
  if (!claimed) {
    const { data: latest } = await o.sb.from(o.table).select("website_enrichment").eq("id", data.id).single();
    return enrichmentDto(latest);
  }

  try {
    let result: Record<string, unknown>;
    if (data.role === "seller") {
      const { readStartupWebsite } = await import("./auto-enrich/auto-enrich.functions");
      result = await readStartupWebsite(website, context) as Record<string, unknown>;
    } else {
      const { readInvestorWebsite } = await import("./auto-enrich/investor-enrich.functions");
      result = await readInvestorWebsite(website) as Record<string, unknown>;
    }
    const safe = cleanResult(result);
    const filled = await saveSuggestions(data, o, safe);
    const done = { status: "done", website_key: key, updated_at: new Date().toISOString(), result: safe, filled };
    await o.sb.from(o.table).update({ website_enrichment: done }).eq("id", data.id).eq("website_enrichment->>updated_at", running.updated_at);
    return { status: "done", websiteKey: key, domain: websiteDomain(key), result: safe, filled };
  } catch (error) {
    console.error("profile website enrichment", data.role, data.id, error instanceof Error ? error.message : "failed");
    const failed = { status: "failed", website_key: key, updated_at: new Date().toISOString() };
    await o.sb.from(o.table).update({ website_enrichment: failed }).eq("id", data.id).eq("website_enrichment->>updated_at", running.updated_at);
    return { status: "failed", websiteKey: key, domain: websiteDomain(key) };
  }
}

export const startProfileEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }): Promise<WebsiteEnrichmentDTO> => run(data, context));

export const getProfileEnrichment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.omit({ website: true }).parse(d))
  .handler(async ({ data, context }): Promise<WebsiteEnrichmentDTO> => enrichmentDto((await owned(data, context)).row));
