import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMPTY_COMPANY_INFO, type CompanyInfoTh } from "@/lib/company-info";

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export const getCompanyInfoTh = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CompanyInfoTh> => {
    const db = context.supabase as unknown as { from: (t: string) => any };

    const { data: row, error } = await db
      .from("company_info_th")
      .select("*")
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ...EMPTY_COMPANY_INFO };

    const [directors, years, registered, latest] = await Promise.all([
      db
        .from("company_director_th")
        .select("id, display_order, director_name_th")
        .eq("company_info_id", row.id)
        .order("display_order"),
      db
        .from("company_financial_submission_year_th")
        .select("financial_year_be")
        .eq("company_info_id", row.id),
      db
        .from("company_registered_business_th")
        .select("business_code, business_description_th, business_objective_th")
        .eq("company_info_id", row.id)
        .maybeSingle(),
      db
        .from("company_latest_business_th")
        .select("financial_year_be, business_code, business_description_th, business_objective_th")
        .eq("company_info_id", row.id)
        .maybeSingle(),
    ]);

    return {
      exists: true,
      legalNameTh: row.legal_name_th ?? null,
      registrationNumber: row.registration_number ?? null,
      legalEntityTypeTh: row.legal_entity_type_th ?? null,
      legalEntityStatusTh: row.legal_entity_status_th ?? null,
      registrationDateThRaw: row.registration_date_th_raw ?? null,
      registeredCapitalThRaw: row.registered_capital_th_raw ?? null,
      previousRegistrationNumber: row.previous_registration_number ?? null,
      businessGroupTh: row.business_group_th ?? null,
      businessSize: row.business_size ?? null,
      headOfficeAddressTh: row.head_office_address_th ?? null,
      website: row.website ?? null,
      authorizedSignatoryTh: row.authorized_signatory_th ?? null,
      submissionYearsBe: ((years.data ?? []) as { financial_year_be: number }[])
        .map((y) => y.financial_year_be)
        .sort((a, b) => b - a),
      directors: ((directors.data ?? []) as {
        id: string;
        display_order: number;
        director_name_th: string;
      }[]).map((d) => ({ id: d.id, displayOrder: d.display_order, nameTh: d.director_name_th })),
      registeredBusiness: {
        code: registered.data?.business_code ?? null,
        descriptionTh: registered.data?.business_description_th ?? null,
        objectiveTh: registered.data?.business_objective_th ?? null,
      },
      latestBusiness: {
        financialYearBe: latest.data?.financial_year_be ?? null,
        code: latest.data?.business_code ?? null,
        descriptionTh: latest.data?.business_description_th ?? null,
        objectiveTh: latest.data?.business_objective_th ?? null,
      },
      sourceName: row.source_name ?? null,
      sourceUrl: row.source_url ?? null,
      retrievedAt: row.retrieved_at ?? null,
      manuallyEditedAt: row.manually_edited_at ?? null,
    };
  });

/* ------------------------------------------------------------------ */
/* Manual save — provenance columns are never touched here.            */
/* ------------------------------------------------------------------ */

const nullableText = z.string().max(4000).nullable().optional();

export const saveCompanyInfoTh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupId: z.string().uuid(),
        info: z.object({
          legalNameTh: nullableText,
          registrationNumber: z.string().max(20).nullable().optional(),
          legalEntityTypeTh: nullableText,
          legalEntityStatusTh: nullableText,
          registrationDateThRaw: nullableText,
          registeredCapitalThRaw: nullableText,
          previousRegistrationNumber: z.string().max(50).nullable().optional(),
          businessGroupTh: nullableText,
          businessSize: z.string().max(20).nullable().optional(),
          headOfficeAddressTh: nullableText,
          website: z.string().max(500).nullable().optional(),
          authorizedSignatoryTh: nullableText,
          submissionYearsBe: z.array(z.number().int().min(2400).max(2699)).max(40),
          directors: z
            .array(z.object({ nameTh: z.string().min(1).max(255) }))
            .max(200),
          registeredBusiness: z.object({
            code: z.string().max(20).nullable().optional(),
            descriptionTh: nullableText,
            objectiveTh: nullableText,
          }),
          latestBusiness: z.object({
            financialYearBe: z.number().int().min(2400).max(2699).nullable().optional(),
            code: z.string().max(20).nullable().optional(),
            descriptionTh: nullableText,
            objectiveTh: nullableText,
          }),
        }),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: startup, error } = await supabase
      .from("startups")
      .select("id, tenant_id")
      .eq("id", data.startupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!startup) throw new Error("Startup not found");

    const { writeCompanyInfoTh } = await import("@/lib/financials/company-info-persist.server");
    await writeCompanyInfoTh(supabase as never, {
      startupId: data.startupId,
      tenantId: startup.tenant_id as string,
      info: {
        legalNameTh: data.info.legalNameTh ?? null,
        registrationNumber: data.info.registrationNumber ?? null,
        legalEntityTypeTh: data.info.legalEntityTypeTh ?? null,
        legalEntityStatusTh: data.info.legalEntityStatusTh ?? null,
        registrationDateThRaw: data.info.registrationDateThRaw ?? null,
        registeredCapitalThRaw: data.info.registeredCapitalThRaw ?? null,
        previousRegistrationNumber: data.info.previousRegistrationNumber ?? null,
        businessGroupTh: data.info.businessGroupTh ?? null,
        businessSize: data.info.businessSize ?? null,
        headOfficeAddressTh: data.info.headOfficeAddressTh ?? null,
        website: data.info.website ?? null,
        authorizedSignatoryTh: data.info.authorizedSignatoryTh ?? null,
        submissionYearsBe: data.info.submissionYearsBe,
        directors: data.info.directors.map((d, i) => ({ displayOrder: i + 1, nameTh: d.nameTh })),
        registeredBusiness: {
          code: data.info.registeredBusiness.code ?? null,
          descriptionTh: data.info.registeredBusiness.descriptionTh ?? null,
          objectiveTh: data.info.registeredBusiness.objectiveTh ?? null,
        },
        latestBusiness: {
          financialYearBe: data.info.latestBusiness.financialYearBe ?? null,
          code: data.info.latestBusiness.code ?? null,
          descriptionTh: data.info.latestBusiness.descriptionTh ?? null,
          objectiveTh: data.info.latestBusiness.objectiveTh ?? null,
        },
      },
      manualEdit: { at: new Date().toISOString(), by: userId ?? null },
    });

    return { ok: true };
  });
