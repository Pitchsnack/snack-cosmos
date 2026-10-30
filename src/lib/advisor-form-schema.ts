import { z } from "zod";
import { DEAL_BANDS } from "@/lib/advisor-firm";
const BAND_KEYS = DEAL_BANDS.map((b) => b.key) as [string, ...string[]];
const FEE_TYPES = ["fixed", "hourly", "retainer", "success", "retainer_success", "quote", "other"] as const;
const FeeIn = z.object({ type: z.enum(FEE_TYPES), amount: z.string().max(12).regex(/^\d*$/), pct: z.string().max(12), words: z.string().max(80), wordsTh: z.string().max(80).optional() });
const s = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
export const CompleteFirmInput = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(80),
  firmType: z.string().trim().min(1).max(60),
  logoPath: s(300),
  logoSource: z.enum(["upload", "enrich"]).nullable(),
  media: z.array(z.object({ slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), image_path: z.string().min(1).max(300) })).max(3).optional(),
  description: z.string().trim().min(30).max(300),
  descriptionTh: z.string().trim().max(300).nullable().optional(),
  yearFounded: z.number().int().min(1800).max(new Date().getFullYear()),
  city: z.string().trim().min(2).max(100),
  country: z.string().trim().min(1).max(100),
  services: z.array(z.string().max(60)).min(1).max(10),
  fees: z.record(z.string(), FeeIn),
  dealBand: z.enum(BAND_KEYS).nullable(),
  teamSize: z.number().int().min(1).max(99999),
  languages: z.array(z.string().max(40)).max(20),
  sectors: z.array(z.string().max(80)).max(60),
  sectorAgnostic: z.boolean().optional(),
  legalName: z.string().trim().min(1).max(200),
  thaiName: s(200),
  registrationNo: s(50),
  addrStreet: s(120), addrUnit: s(120), addrDistrict: s(80), addrProvince: s(80), addrPostal: s(12),
  website: z.string().trim().min(3).max(200), email: z.string().trim().email().max(120), phone: z.string().trim().min(9).max(30),
  team: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), role: s(120), roleTh: s(120).optional(), email: s(255) })).max(100),
  credentials: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(160), nameTh: s(160).optional(), note: s(300), noteTh: s(300).optional() })).max(100),
  documents: z.array(z.object({ id: z.string().uuid().optional(), path: z.string().max(300), name: z.string().trim().min(1).max(160), type: s(40) })).max(100),
}).refine((d) => d.country !== "Thailand" || /^\d{13}$/.test(d.registrationNo ?? ""), { message: "The registration number has 13 digits." });


/** Structural limits always apply; required completeness is only checked outside Draft. */
export const DraftFirmInput = CompleteFirmInput.innerType().extend({
  name: z.string().trim().max(80), firmType: z.string().trim().max(60),
  description: z.string().trim().max(300), yearFounded: z.number().int().min(1800).max(new Date().getFullYear()).nullable(),
  city: z.string().trim().max(100), country: z.string().trim().max(100),
  services: z.array(z.string().max(60)).max(10), teamSize: z.number().int().min(1).max(99999).nullable(),
  legalName: z.string().trim().max(200), website: z.string().trim().max(200),
  email: z.string().trim().max(120), phone: z.string().trim().max(30),
});
export function advisorNeedsCompleteSave(status: string | null | undefined) { return status !== "draft"; }
