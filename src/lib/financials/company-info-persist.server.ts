/**
 * Writes Thai Company Info rows (server-only).
 *
 * Shared by the DBD Auto Enrich flow and the manual Company Info editor so
 * both paths produce identical rows. Provenance columns (`source_name`,
 * `source_url`, `retrieved_at`) are only ever set by the enrichment path and
 * are never cleared by a manual edit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyInfoTh } from "@/lib/company-info";

type Client = SupabaseClient<never, never, never>;

export interface CompanyInfoWriteInput {
  startupId: string;
  tenantId: string;
  info: Omit<CompanyInfoTh, "exists" | "sourceName" | "sourceUrl" | "retrievedAt" | "manuallyEditedAt">;
  /** Set on the Auto Enrich path only. */
  retrievedAt?: string | null;
  /** Set on the manual-edit path only. */
  manualEdit?: { at: string; by: string | null };
  /** Keeps an existing stored value when the incoming one is empty. */
  preferExisting?: boolean;
}

const trim = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

export async function writeCompanyInfoTh(
  supabase: Client,
  input: CompanyInfoWriteInput,
): Promise<void> {
  const { startupId, tenantId, info } = input;
  const db = supabase as unknown as {
    from: (t: string) => any;
  };

  const existing = (
    await db.from("company_info_th").select("*").eq("startup_id", startupId).maybeSingle()
  ).data as Record<string, unknown> | null;

  const keep = (incoming: string | null, current: unknown) =>
    input.preferExisting && !incoming ? ((current as string | null) ?? null) : incoming;

  const capitalRaw = trim(info.registeredCapitalThRaw);
  const capitalNumber = capitalRaw
    ? (() => {
        const m = capitalRaw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
        return m ? Number(m[0]) : null;
      })()
    : null;

  const payload: Record<string, unknown> = {
    startup_id: startupId,
    tenant_id: tenantId,
    legal_name_th: keep(trim(info.legalNameTh), existing?.legal_name_th),
    registration_number: keep(trim(info.registrationNumber), existing?.registration_number),
    legal_entity_type_th: keep(trim(info.legalEntityTypeTh), existing?.legal_entity_type_th),
    legal_entity_status_th: keep(trim(info.legalEntityStatusTh), existing?.legal_entity_status_th),
    registration_date_th_raw: keep(
      trim(info.registrationDateThRaw),
      existing?.registration_date_th_raw,
    ),
    registered_capital_th_raw: keep(capitalRaw, existing?.registered_capital_th_raw),
    registered_capital_thb: capitalNumber ?? (input.preferExisting ? (existing?.registered_capital_thb ?? null) : null),
    previous_registration_number: keep(
      trim(info.previousRegistrationNumber),
      existing?.previous_registration_number,
    ),
    business_group_th: keep(trim(info.businessGroupTh), existing?.business_group_th),
    business_size: keep(trim(info.businessSize), existing?.business_size),
    head_office_address_th: keep(trim(info.headOfficeAddressTh), existing?.head_office_address_th),
    website: keep(trim(info.website), existing?.website),
    authorized_signatory_th: keep(
      trim(info.authorizedSignatoryTh),
      existing?.authorized_signatory_th,
    ),
  };

  if (input.retrievedAt !== undefined) {
    payload.source_name = "DBD Data Warehouse";
    payload.source_url = "https://datawarehouse.dbd.go.th";
    payload.retrieved_at = input.retrievedAt;
  }
  if (input.manualEdit) {
    payload.manually_edited_at = input.manualEdit.at;
    payload.manually_edited_by = input.manualEdit.by;
  }

  let companyInfoId = existing?.id as string | undefined;
  if (companyInfoId) {
    const upd = await db.from("company_info_th").update(payload).eq("id", companyInfoId);
    if (upd.error) throw new Error(upd.error.message);
  } else {
    const ins = await db.from("company_info_th").insert(payload).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    companyInfoId = ins.data.id as string;
  }

  const base = { company_info_id: companyInfoId, startup_id: startupId, tenant_id: tenantId };

  // Directors — full replace so ordering and removals are exact.
  const directors = info.directors
    .map((d, i) => ({ ...base, display_order: i + 1, director_name_th: trim(d.nameTh) }))
    .filter((d) => d.director_name_th);
  if (directors.length || !input.preferExisting) {
    await db.from("company_director_th").delete().eq("company_info_id", companyInfoId);
    if (directors.length) {
      const r = await db.from("company_director_th").insert(directors);
      if (r.error) throw new Error(r.error.message);
    }
  }

  // Submission years.
  const years = [...new Set(info.submissionYearsBe.filter((y) => y > 2400 && y < 2700))].sort(
    (a, b) => b - a,
  );
  if (years.length || !input.preferExisting) {
    await db
      .from("company_financial_submission_year_th")
      .delete()
      .eq("company_info_id", companyInfoId);
    if (years.length) {
      const r = await db.from("company_financial_submission_year_th").insert(
        years.map((be, i) => ({
          ...base,
          financial_year_be: be,
          financial_year_ce: be - 543,
          is_latest: i === 0,
        })),
      );
      if (r.error) throw new Error(r.error.message);
    }
  }

  const upsertBusiness = async (
    table: "company_registered_business_th" | "company_latest_business_th",
    row: Record<string, unknown>,
  ) => {
    const hasValue = Object.entries(row).some(([k, v]) => k !== "financial_year_be" && v);
    if (!hasValue && input.preferExisting) return;
    await db.from(table).delete().eq("company_info_id", companyInfoId);
    if (!hasValue) return;
    const r = await db.from(table).insert({ ...base, ...row });
    if (r.error) throw new Error(r.error.message);
  };

  await upsertBusiness("company_registered_business_th", {
    business_code: trim(info.registeredBusiness.code),
    business_description_th: trim(info.registeredBusiness.descriptionTh),
    business_objective_th: trim(info.registeredBusiness.objectiveTh),
  });
  await upsertBusiness("company_latest_business_th", {
    financial_year_be: info.latestBusiness.financialYearBe ?? years[0] ?? null,
    business_code: trim(info.latestBusiness.code),
    business_description_th: trim(info.latestBusiness.descriptionTh),
    business_objective_th: trim(info.latestBusiness.objectiveTh),
  });
}
