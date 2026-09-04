/**
 * Shared (client-safe) shapes for the Thai Company Info tab.
 * Values are stored and displayed exactly as DBD publishes them — Thai text is
 * never translated and missing values stay `null` rather than becoming 0/"".
 */

export interface CompanyDirectorTh {
  id?: string;
  displayOrder: number;
  nameTh: string;
}

export interface CompanyBusinessTh {
  code: string | null;
  descriptionTh: string | null;
  objectiveTh: string | null;
}

export interface CompanyInfoTh {
  exists: boolean;
  legalNameTh: string | null;
  registrationNumber: string | null;
  legalEntityTypeTh: string | null;
  legalEntityStatusTh: string | null;
  registrationDateThRaw: string | null;
  registeredCapitalThRaw: string | null;
  previousRegistrationNumber: string | null;
  businessGroupTh: string | null;
  businessSize: string | null;
  headOfficeAddressTh: string | null;
  website: string | null;
  authorizedSignatoryTh: string | null;
  submissionYearsBe: number[];
  directors: CompanyDirectorTh[];
  registeredBusiness: CompanyBusinessTh;
  latestBusiness: CompanyBusinessTh & { financialYearBe: number | null };
  sourceName: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  manuallyEditedAt: string | null;
}

export const EMPTY_COMPANY_INFO: CompanyInfoTh = {
  exists: false,
  legalNameTh: null,
  registrationNumber: null,
  legalEntityTypeTh: null,
  legalEntityStatusTh: null,
  registrationDateThRaw: null,
  registeredCapitalThRaw: null,
  previousRegistrationNumber: null,
  businessGroupTh: null,
  businessSize: null,
  headOfficeAddressTh: null,
  website: null,
  authorizedSignatoryTh: null,
  submissionYearsBe: [],
  directors: [],
  registeredBusiness: { code: null, descriptionTh: null, objectiveTh: null },
  latestBusiness: { code: null, descriptionTh: null, objectiveTh: null, financialYearBe: null },
  sourceName: null,
  sourceUrl: null,
  retrievedAt: null,
  manuallyEditedAt: null,
};

/** Thai/Buddhist year for display; 2025 → 2568. */
export const toBe = (ce: number) => (ce > 2400 ? ce : ce + 543);

/** Formats an ISO timestamp as a short Thai date-time, e.g. "2 ก.ย. 2569 22:45". */
export function formatThaiDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
