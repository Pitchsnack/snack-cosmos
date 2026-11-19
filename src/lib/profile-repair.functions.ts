import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SellerListingTextRepairReport = {
  profilesChanged: number;
  listingNamesFilled: number;
  headlineEnFilled: number;
  headlineThFilled: number;
  descriptionEnFilled: number;
  descriptionThFilled: number;
  descriptionsReplaced: number;
  descriptionsKept: number;
  alreadySentences: number;
  replacedRefs: string[];
  keptRefs: string[];
  unresolved: string[];
};

/** One authorised Control-run repair for automatic bilingual seller listing texts. */
export const repairSellerListingTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerListingTextRepairReport> => {
    const { data: control, error: controlError } = await context.supabase.rpc("is_control", { _user_id: context.userId });
    if (controlError) throw new Error(controlError.message);
    if (!control) throw new Error("Control access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { ensureAutomaticSellerListing } = await import("./seller-listing-text.server");
    const { data: listings, error } = await sb.from("hidden_profiles")
      .select("startup_id,ref_no,created_by,code_name,suggested_listing_name,headline,headline_th,description,description_th,description_story,description_story_th")
      .order("ref_no");
    if (error) throw new Error(error.message);
    const report: SellerListingTextRepairReport = {
      profilesChanged: 0, listingNamesFilled: 0, headlineEnFilled: 0, headlineThFilled: 0,
      descriptionEnFilled: 0, descriptionThFilled: 0,
      descriptionsReplaced: 0, descriptionsKept: 0, alreadySentences: 0,
      replacedRefs: [], keptRefs: [], unresolved: [],
    };
    const controlByUser = new Map<string, boolean>();
    for (const row of listings ?? []) {
      const ref = row.ref_no || row.startup_id;
      try {
        const creator = row.created_by ?? "";
        let creatorControl = false;
        if (creator) {
          if (!controlByUser.has(creator)) {
            const { data: value, error: roleError } = await sb.rpc("is_control", { _user_id: creator });
            if (roleError) throw new Error(roleError.message);
            controlByUser.set(creator, !!value);
          }
          creatorControl = controlByUser.get(creator) ?? false;
        }
        const beforeEn = row.description?.trim() ?? "";
        const beforeTh = row.description_th?.trim() ?? "";
        const alreadySentences = row.description_story?.mode === "lines" && row.description_story_th?.mode === "lines";
        const result = await ensureAutomaticSellerListing(sb, row.startup_id, creatorControl, context.userId);
        if (!result) continue;
        if (alreadySentences) report.alreadySentences += 1;
        else if (result.legacyAutomaticDescription && (result.description !== beforeEn || result.descriptionTh !== beforeTh)) {
          report.descriptionsReplaced += 1;
          report.replacedRefs.push(ref);
        } else {
          report.descriptionsKept += 1;
          report.keptRefs.push(ref);
        }
        if (!result.filled.length) continue;
        report.profilesChanged += 1;
        if (result.filled.includes("code_name") || result.filled.includes("suggested_listing_name")) report.listingNamesFilled += 1;
        if (result.filled.includes("headline")) report.headlineEnFilled += 1;
        if (result.filled.includes("headline_th")) report.headlineThFilled += 1;
        if (result.filled.includes("description")) report.descriptionEnFilled += 1;
        if (result.filled.includes("description_th")) report.descriptionThFilled += 1;
      } catch (cause) {
        console.error("Seller listing text repair", ref, cause instanceof Error ? cause.message : "failed");
        report.unresolved.push(ref);
      }
    }
    return report;
  });

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
