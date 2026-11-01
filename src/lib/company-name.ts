import { z } from "zod";

/** Optional translations share the same limits across all authorised editors. */
export const optionalCompanyName = z.string().trim().max(200).nullable().optional()
  .transform((value) => value === undefined ? undefined : value || null);

export const companyNameHelp = (thai: boolean) => thai
  ? "ใช้ชื่อตามที่จดทะเบียนบริษัท แท็บที่อยู่จะแสดงชื่อเดียวกันนี้"
  : "As on your company registration. The Address tab shows the same name.";