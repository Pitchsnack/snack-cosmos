import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProfileRepairReport = {
  highlightsFilled: number;
  highlightRowsFilled: number;
  highlightUnresolved: string[];
  postalFilled: number;
  postalUnresolved: string[];
};

/** One authorised Control-run repair for the November 19 bilingual Highlights/postcode brief. */
export const repairHighlightsAndPostalCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileRepairReport> => {
    const { data: control, error: controlError } = await context.supabase.rpc("is_control", { _user_id: context.userId });
    if (controlError) throw new Error(controlError.message);
    if (!control) throw new Error("Control access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { planHighlightSave } = await import("./highlight-translations");
    const { resolveHighlightPlan } = await import("./highlight-translations.server");
    const { inferThaiPostalCode } = await import("./thai-postal.server");
    const { splitThaiAddress } = await import("./thai-address");

    const report: ProfileRepairReport = { highlightsFilled: 0, highlightRowsFilled: 0, highlightUnresolved: [], postalFilled: 0, postalUnresolved: [] };
    const { data: listings, error: listingError } = await sb.from("hidden_profiles")
      .select("startup_id,ref_no,highlights,highlights_th,highlight_translations").order("ref_no");
    if (listingError) throw new Error(listingError.message);

    for (const row of listings ?? []) {
      const ref = row.ref_no || row.startup_id;
      try {
        const plan = planHighlightSave(
          { en: row.highlights, th: row.highlights_th, translations: row.highlight_translations },
          {},
        );
        if (!plan.changed) continue;
        const resolved = await resolveHighlightPlan(plan);
        const { error } = await sb.from("hidden_profiles").update({
          highlights: resolved.en,
          highlights_th: resolved.th,
          highlight_translations: resolved.translations,
        }).eq("startup_id", row.startup_id);
        if (error) throw new Error(error.message);
        report.highlightsFilled += 1;
        report.highlightRowsFilled += plan.jobs.length;
      } catch (error) {
        console.error("Highlight repair", ref, error instanceof Error ? error.message : "failed");
        report.highlightUnresolved.push(ref);
      }
    }

    const [{ data: sellers, error: sellerError }, { data: buyers, error: buyerError }, { data: advisors, error: advisorError }] = await Promise.all([
      sb.from("startups").select("id,registered_number,postal_code,address_line1,address_line2,address_city_district,address_province_state,business_address_th,headquarters,hidden_profiles(ref_no)")
        .or("postal_code.is.null,postal_code.eq.''").or("headquarters.eq.Thailand,registered_number.not.is.null"),
      sb.from("investors").select("id,registration_no,postal_code,address_line1,address_line2,address_city_district,address_province_state,address_th,country")
        .or("postal_code.is.null,postal_code.eq.''").eq("country", "Thailand"),
      sb.from("advisor_firms").select("id,ref_no,registration_no,addr_postal,addr_street,addr_unit,addr_subdistrict,addr_district,addr_province,address_th,country")
        .or("addr_postal.is.null,addr_postal.eq.''").eq("country", "Thailand"),
    ]);
    if (sellerError) throw new Error(sellerError.message);
    if (buyerError) throw new Error(buyerError.message);
    if (advisorError) throw new Error(advisorError.message);

    const candidates: { role: string; id: string; ref: string; table: string; column: string; subdistrict: string; district: string; province: string; raw: string | null }[] = [];
    for (const row of sellers ?? []) {
      const linked = Array.isArray(row.hidden_profiles) ? row.hidden_profiles[0] : row.hidden_profiles;
      const rawParts = splitThaiAddress(row.business_address_th);
      candidates.push({
        role: "Seller", id: row.id, ref: linked?.ref_no || row.registered_number || row.id, table: "startups", column: "postal_code",
        subdistrict: row.address_line2 || rawParts.unit, district: row.address_city_district || rawParts.district,
        province: row.address_province_state || rawParts.province, raw: row.business_address_th,
      });
    }
    for (const row of buyers ?? []) {
      const rawParts = splitThaiAddress(row.address_th);
      candidates.push({
        role: "Buyer", id: row.id, ref: row.registration_no || row.id, table: "investors", column: "postal_code",
        subdistrict: row.address_line2 || rawParts.unit, district: row.address_city_district || rawParts.district,
        province: row.address_province_state || rawParts.province, raw: row.address_th,
      });
    }
    for (const row of advisors ?? []) {
      const rawParts = splitThaiAddress(row.address_th);
      candidates.push({
        role: "Advisor", id: row.id, ref: row.ref_no || row.registration_no || row.id, table: "advisor_firms", column: "addr_postal",
        subdistrict: row.addr_subdistrict || row.addr_unit || rawParts.unit, district: row.addr_district || rawParts.district,
        province: row.addr_province || rawParts.province, raw: row.address_th,
      });
    }

    for (const candidate of candidates) {
      const postal = inferThaiPostalCode(candidate);
      const label = `${candidate.role} ${candidate.ref}`;
      if (!postal) {
        report.postalUnresolved.push(label);
        continue;
      }
      const { error } = await sb.from(candidate.table).update({ [candidate.column]: postal }).eq("id", candidate.id);
      if (error) {
        console.error("Postal repair", label, error.message);
        report.postalUnresolved.push(label);
      } else report.postalFilled += 1;
    }
    return report;
  });
