import { setupText, tr, useTranslation } from "@/i18n/language";
import { useTextLang } from "@/components/common/text-lang";
import { useRef } from "react";
import { Check, CircleAlert, FileText, Mail, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressBox, FeeControl, addrErrors, type Addr } from "@/components/advisor/advisor-firm-fields";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import {
  DEAL_BANDS, FIRM_TYPES, LANGUAGES, cityError, dealBandLabels, descError, feeError, feeWords, nameError, newFee,
  nowrapPct, fullAddress, teamSizeError, webError, phoneError,
} from "@/lib/advisor-firm";
import { COUNTRIES, THAI_PROVINCES_77, yearError } from "@/lib/investor-bands";
import { cn } from "@/lib/utils";
import type { FirmForm } from "@/components/advisor/advisor-firm-edit";

/**
 * The advisor setup wizard's Review & complete: one page of label and value
 * rows in six sections. Edit opens a section's fields in place; Done closes
 * it. Required answers that are missing show in red. Setup mode only — Edit
 * profile from My Company keeps the tabbed form.
 */

export type ReviewSec = "firm" | "services" | "contact" | "team" | "licences" | "documents";
export type MissingItem = { sec: ReviewSec; label: string; fieldId?: string };

/** Every required answer still empty, in page order (drives the red rows, counts, top line and Save profile). */
export function setupMissing(f: FirmForm, thai: boolean): MissingItem[] {
  const out: MissingItem[] = [];
  if (nameError(f.name)) out.push({ sec: "firm", label: tr("Company name"), fieldId: "fe-name" });
  if (!f.firmType) out.push({ sec: "firm", label: tr("Firm type"), fieldId: "fe-type" });
  if (yearError(f.yearFounded)) out.push({ sec: "firm", label: tr("Year founded"), fieldId: "fe-year" });
  if (teamSizeError(f.teamSize)) out.push({ sec: "firm", label: tr("Team size"), fieldId: "fe-teamSize" });
  if (!f.languages.length) out.push({ sec: "firm", label: tr("Languages"), fieldId: "fe-langs" });
  if (descError(f.description || f.descriptionTh)) out.push({ sec: "firm", label: tr("Description"), fieldId: "fe-desc" });
  if (!f.services.length) out.push({ sec: "services", label: tr("Services") });
  for (const s of f.services) {
    if (feeError(s, f.fees[s] ?? newFee())) out.push({ sec: "services", label: tr("Fee for {service}").replace("{service}", tr(s)), fieldId: `fee-box-${s}` });
  }
  if (webError(f.website)) out.push({ sec: "contact", label: tr("Website"), fieldId: "fe-web" });
  if (phoneError(f.phone)) out.push({ sec: "contact", label: tr("Phone"), fieldId: "fe-phone" });
  if (!f.country) out.push({ sec: "contact", label: tr("Country"), fieldId: "fe-country" });
  else if (cityError(thai ? f.addr.province : f.city, f.country)) out.push({ sec: "contact", label: tr("City / province"), fieldId: "fe-city" });
  if (thai && !/^\d{13}$/.test(f.registrationNo)) out.push({ sec: "contact", label: tr("Registration no."), fieldId: "fe-reg" });
  const ae = addrErrors(f.addr, thai, f.city) as Record<keyof Addr, string | null>;
  const addrNames: [keyof Addr, string][] = thai
    ? [["street", tr("No. and street")], ["district", tr("City/District")], ["province", tr("Province/State")], ["postal", tr("Postal code")]]
    : [["street", tr("Street and number")], ["district", tr("City/District")]];
  for (const [k, n] of addrNames) if (ae[k]) out.push({ sec: "contact", label: n, fieldId: `addr-${k}` });
  return out;
}

/** Focus a field in an open section (by id, or the section's first control). */
export function focusReviewField(fieldId: string | undefined, sec: ReviewSec) {
  const el = (fieldId && document.getElementById(fieldId))
    || document.querySelector<HTMLElement>(`[data-sec="${sec}"] input, [data-sec="${sec}"] select, [data-sec="${sec}"] textarea`);
  el?.focus();
}

const inpC = "h-[38px] text-[14px]";
const needCls = "border-[#E39A92] ring-[3px] ring-[rgba(180,35,24,.10)] dark:border-[#B42318]";
const selC = "flex h-[38px] w-full rounded-md border border-input bg-background px-3 pr-8 text-[14px] outline-none focus:border-[#1E2A4A]";

/** Compact field: 13.5px label, red * or "optional", and "Fill this in." while empty. */
function CF({ label, req, opt, need, htmlFor, className, children }: {
  label: React.ReactNode; req?: boolean; opt?: boolean; need?: boolean; htmlFor?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-[5px] block text-[13.5px] font-medium text-[#434A5C] dark:text-muted-foreground">
        {label}
        {req && <span aria-hidden className="ml-[3px] text-[12px] font-semibold text-[#B42318]">*</span>}
        {opt && <span className="ml-1.5 text-[12.5px] font-normal text-[#9CA3AF]">{tr("optional")}</span>}
      </label>
      {children}
      {need && <p className="mt-[5px] text-[12.5px] font-medium text-[#B42318] dark:text-[#FDA29B]">{tr("Fill this in.")}</p>}
    </div>
  );
}

function Row({ label, value, missingText, onAdd, strong, addName }: {
  label: React.ReactNode; value?: React.ReactNode; missingText?: React.ReactNode;
  onAdd?: () => void; strong?: boolean; addName?: string;
}) {
  const red = missingText != null;
  return (
    <div className={cn(
      "grid grid-cols-1 gap-[1px] py-2 sm:grid-cols-[180px_1fr] sm:gap-4",
      red ? "mx-[-10px] my-[2px] rounded-[9px] bg-[#FEF3F2] px-[10px] py-[7px] dark:bg-[#3A1D1D]" : "border-b border-[#F1F2F5] last:border-0 dark:border-border",
    )}>
      <dt className={cn("text-[12.5px] sm:text-[13.5px]", red ? "font-semibold text-[#B42318] dark:text-[#FDA29B]" : strong ? "font-semibold text-[#151A28] dark:text-foreground" : "font-medium text-[#6A7181] dark:text-muted-foreground")}>{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-[14px] leading-[1.5] text-[#151A28] dark:text-foreground">
        {red ? (
          <>
            <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#DC2626]" aria-hidden />
            <span className="min-w-0 font-semibold text-[#B42318] dark:text-[#FDA29B]">{missingText}</span>
            {onAdd && (
              <button type="button" onClick={onAdd} aria-label={`${tr("Add")} ${addName ?? ""}`.trim()}
                className="ml-auto h-[30px] flex-none cursor-pointer rounded-[7px] border border-[#F1B5AE] bg-white px-[13px] text-[13px] font-semibold text-[#B42318] hover:border-[#E3958C] hover:bg-[#FFF5F4] dark:bg-transparent">
                {tr("Add")}
              </button>
            )}
          </>
        ) : <span className="min-w-0 break-words">{value}</span>}
      </dd>
    </div>
  );
}

function Sec({ id, name, miss, open, onEdit, onDone, headerExtra, rows, children }: {
  id: ReviewSec; name: string; miss: number; open: boolean; onEdit: () => void; onDone: () => void;
  headerExtra?: React.ReactNode; rows: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section data-sec={id} className="mt-3 border-t border-[#EEF0F3] pt-3.5 first:mt-0 first:border-0 first:pt-0 dark:border-border">
      <div className="flex min-h-[36px] items-center gap-2.5">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[.07em] text-[#6B7280] dark:text-muted-foreground">{name}</h2>
        {miss > 0 && (
          <span className="inline-flex h-[22px] items-center gap-[5px] rounded-full bg-[#FEE4E2] px-[9px] text-[12px] font-semibold text-[#B42318] dark:bg-[#3A1D1D] dark:text-[#FDA29B]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#DC2626]" aria-hidden />
            {tr("{n} missing").replace("{n}", String(miss))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-4">
          {open && headerExtra}
          {open ? (
            <button type="button" onClick={onDone} aria-label={`${tr("Done with")} ${name}`}
              className="h-[34px] cursor-pointer rounded-[8px] bg-[#1E2A4A] px-4 text-[13.5px] font-semibold text-white">
              {tr("Done")}
            </button>
          ) : (
            <button type="button" id={`edit-${id}`} onClick={onEdit} aria-label={`${tr("Edit")} ${name}`}
              className="-mr-2 h-9 cursor-pointer rounded-[8px] px-2 text-[14px] font-semibold text-[#2563EB] hover:bg-[#EEF4FF] dark:hover:bg-muted">
              {tr("Edit")}
            </button>
          )}
        </span>
      </div>
      {open ? (
        <div className="mx-[-12px] mt-2.5 rounded-[14px] border border-[#CBD5E6] bg-[#F8FAFD] p-3 pb-4 max-sm:mx-[-6px] max-sm:px-2 dark:border-border dark:bg-muted/30">
          {children}
        </div>
      ) : (
        <dl className="mt-[2px]">{rows}</dl>
      )}
    </section>
  );
}

export function SetupReview({ f, set, setF, thai, openSec, setOpenSec, onChangeServices, onLogo, logoErr, uploading, onDoc, docInput, changeCountry }: {
  f: FirmForm;
  set: <K extends keyof FirmForm>(k: K, v: FirmForm[K]) => void;
  setF: React.Dispatch<React.SetStateAction<FirmForm>>;
  thai: boolean;
  openSec: ReviewSec | null;
  setOpenSec: (s: ReviewSec | null) => void;
  onChangeServices: () => void;
  onLogo: (file: File) => void;
  logoErr: string | null;
  uploading: boolean;
  onDoc: (file: File | undefined) => void;
  docInput: React.RefObject<HTMLInputElement | null>;
  changeCountry: (c: string) => void;
}) {
  const { language } = useTranslation();
  const { lang: tl, switchable: tlSw } = useTextLang();
  const pick = (en: string | undefined, th: string | undefined) => (tl === "th" ? th || (tlSw ? "" : en || "") : en || (tlSw ? "" : th || ""));
  const descV = pick(f.description, f.descriptionTh);
  const setDesc = (v: string) => set(tl === "th" ? "descriptionTh" : "description", v);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoSlot = useRef(0);
  const logoInput = useRef<HTMLInputElement>(null);

  const missing = setupMissing(f, thai);
  const missIn = (sec: ReviewSec) => missing.filter((m) => m.sec === sec);
  const isMiss = (fieldId: string) => missing.some((m) => m.fieldId === fieldId);
  const open = (sec: ReviewSec, fieldId?: string) => { setOpenSec(sec); window.setTimeout(() => focusReviewField(fieldId, sec), 60); };
  const done = (sec: ReviewSec) => {
    if (sec === "team") set("team", f.team.filter((t) => t.name.trim() || t.role.trim() || (t.roleTh ?? "").trim() || t.email.trim()));
    if (sec === "licences") set("credentials", f.credentials.filter((c) => c.name.trim() || (c.nameTh ?? "").trim() || c.note.trim() || (c.noteTh ?? "").trim()));
    setOpenSec(null);
    window.setTimeout(() => document.getElementById(`edit-${sec}`)?.focus(), 60);
  };

  const addrErr = addrErrors(f.addr, thai, f.city) as Record<keyof Addr, string | null>;
  const addrLine = fullAddress({ addrStreet: f.addr.street, addrUnit: f.addr.unit, addrDistrict: thai ? f.addr.district : f.city, addrProvince: f.addr.province, addrPostal: f.addr.postal, country: f.country, city: f.city });
  const deal = dealBandLabels(f.dealBand);
  const basedIn = [thai ? f.addr.province : f.city, f.country].filter(Boolean).join(", ");
  const basedInMiss = missIn("contact").filter((m) => m.label === tr("Country") || m.label === tr("City / province"));
  const addrMiss = missIn("contact").filter((m) => m.fieldId?.startsWith("addr-"));
  const photos = f.media.slots.filter((s) => s.pendingFile || s.signedUrl || s.persistedPath);
  const notSet = <span className="text-[#9CA3AF]">{tr("Not set")}</span>;
  const altIsThai = language !== "th"; // English app: Thai Name; Thai app: English Name
  const altName = altIsThai ? f.thaiName : f.englishName ?? "";
  const setAltName = (v: string) => set(altIsThai ? "thaiName" : "englishName", v);

  const names = missing.map((m) => m.label).join(" · ");
  const dot = language === "th" || names.endsWith(".") ? "" : ".";
  const topLine = missing.length === 1
    ? `${tr("1 required answer is missing")}: ${names}${dot} ${tr("Add it before you save.")}`
    : `${tr("{n} required answers are missing").replace("{n}", String(missing.length))}: ${names}${dot} ${tr("Add them before you save.")}`;

  const setSlot = (i: number, patch: Partial<FirmForm["media"]["slots"][number]>) =>
    set("media", { ...f.media, slots: f.media.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const grid = "grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4";

  return (
    <div>
      {missing.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-[10px] border border-[#FBD0CB] bg-[#FEF3F2] px-3 py-2.5 dark:border-[#7A271A] dark:bg-[#3A1D1D]">
          <CircleAlert className="mt-px h-[17px] w-[17px] flex-none text-[#B42318] dark:text-[#FDA29B]" aria-hidden />
          <p className="text-[13.5px] font-medium leading-[1.45] text-[#B42318] dark:text-[#FDA29B]">{topLine}</p>
        </div>
      )}

      {/* ---------------------------------------------------------- Firm */}
      <Sec id="firm" name={tr("Firm")} miss={missIn("firm").length} open={openSec === "firm"}
        onEdit={() => open("firm")} onDone={() => done("firm")}
        rows={<>
          <Row label={tr("Company name")} value={f.name} missingText={nameError(f.name) ? tr("Missing") : undefined} onAdd={() => open("firm", "fe-name")} addName={tr("Company name")} />
          <Row label={altIsThai ? tr("Thai Name") : "English Name"} value={altName.trim() || notSet} />
          <Row label={tr("Firm type")} value={f.firmType ? tr(f.firmType) : undefined} missingText={!f.firmType ? tr("Missing") : undefined} onAdd={() => open("firm", "fe-type")} addName={tr("Firm type")} />
          <Row label={tr("Year founded")} value={f.yearFounded} missingText={yearError(f.yearFounded) ? tr("Missing") : undefined} onAdd={() => open("firm", "fe-year")} addName={tr("Year founded")} />
          <Row label={tr("Team size")} value={f.teamSize ? `${f.teamSize} ${tr("people")}` : undefined} missingText={teamSizeError(f.teamSize) ? tr("Missing") : undefined} onAdd={() => open("firm", "fe-teamSize")} addName={tr("Team size")} />
          <Row label={tr("Typical deal size")} value={deal ? `${deal.usd} (${deal.thb})` : notSet} />
          <Row label={tr("Languages")} value={f.languages.length ? f.languages.map(tr).join(", ") : undefined} missingText={!f.languages.length ? tr("Missing") : undefined} onAdd={() => open("firm", "fe-langs")} addName={tr("Languages")} />
          <Row label={tr("Description")} value={descV.trim() || undefined} missingText={descError(f.description || f.descriptionTh) ? tr("Missing") : undefined} onAdd={() => open("firm", "fe-desc")} addName={tr("Description")} />
          <Row label={tr("Logo and photos")} value={f.logo.url || photos.length ? (
            <span className="flex flex-wrap items-center gap-2">
              {f.logo.url && <img src={f.logo.url} alt="" className="h-[44px] w-[44px] rounded-[8px] border border-[#E3E6EB] bg-white object-contain dark:border-border" />}
              {photos.map((p, i) => <img key={i} src={p.signedUrl ?? (p.pendingFile ? URL.createObjectURL(p.pendingFile) : "")} alt="" className="h-[44px] w-[66px] rounded-[8px] object-cover" />)}
              <span className="text-[13px] text-[#6A7181] dark:text-muted-foreground">{tr("{n} of 3 photos").replace("{n}", String(photos.length))}</span>
            </span>
          ) : notSet} />
          <Row label={tr("Sectors")} value={f.sectorAgnostic ? tr("Sector agnostic") : f.sectors.length ? f.sectors.join(", ") : notSet} />
        </>}>
        <div className="space-y-3">
          <div className={grid}>
            <CF label={tr("Company name")} req need={isMiss("fe-name")} htmlFor="fe-name">
              <Input id="fe-name" aria-required aria-invalid={isMiss("fe-name")} className={cn(inpC, isMiss("fe-name") && needCls)} maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} />
            </CF>
            <CF label={altIsThai ? tr("Thai Name") : "English Name"} opt htmlFor="fe-altname">
              <Input id="fe-altname" className={inpC} maxLength={200} placeholder={altIsThai ? "บริษัท … จำกัด" : undefined} value={altName} onChange={(e) => setAltName(e.target.value)} />
            </CF>
            <CF label={tr("Firm type")} req need={isMiss("fe-type")} htmlFor="fe-type">
              <select id="fe-type" aria-required aria-invalid={isMiss("fe-type")} className={cn(selC, isMiss("fe-type") && needCls)} value={f.firmType} onChange={(e) => set("firmType", e.target.value)}>
                <option value="" disabled>{setupText("Select type")}</option>
                {FIRM_TYPES.map((t) => <option key={t} value={t}>{setupText(t)}</option>)}
              </select>
            </CF>
          </div>
          <div className={grid}>
            <CF label={tr("Year founded")} req need={isMiss("fe-year")} htmlFor="fe-year">
              <Input id="fe-year" aria-required aria-invalid={isMiss("fe-year")} className={cn(inpC, isMiss("fe-year") && needCls)} inputMode="numeric" maxLength={4} placeholder={setupText("e.g. 2014")} value={f.yearFounded} onChange={(e) => set("yearFounded", e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </CF>
            <CF label={tr("Team size")} req need={isMiss("fe-teamSize")} htmlFor="fe-teamSize">
              <Input id="fe-teamSize" aria-required aria-invalid={isMiss("fe-teamSize")} className={cn(inpC, isMiss("fe-teamSize") && needCls)} inputMode="numeric" maxLength={5} placeholder={setupText("e.g. 8")} value={f.teamSize} onChange={(e) => set("teamSize", e.target.value.replace(/\D/g, "").slice(0, 5))} />
            </CF>
            <CF label={tr("Typical deal size")} opt htmlFor="fe-deal">
              <select id="fe-deal" className={selC} value={f.dealBand} onChange={(e) => set("dealBand", e.target.value)}>
                <option value="">{setupText("Choose a range")}</option>
                {DEAL_BANDS.map((b) => <option key={b.key} value={b.key}>{dealBandLabels(b.key)?.full ?? b.key}</option>)}
              </select>
            </CF>
          </div>
          <CF label={tr("Languages you work in")} req need={!f.languages.length}>
            <div id="fe-langs" className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => {
                const on = f.languages.includes(l);
                return (
                  <button key={l} type="button" aria-pressed={on} onClick={() => set("languages", on ? f.languages.filter((x) => x !== l) : [...f.languages, l])}
                    className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px]", on ? "border-[#1E2A4A] bg-[#F4F6FA] font-semibold text-[#1E2A4A] dark:bg-muted dark:text-foreground" : "border-border hover:bg-muted")}>
                    {on && <Check className="h-3.5 w-3.5" />}{setupText(l)}
                  </button>
                );
              })}
            </div>
            {!f.languages.length && <p className="mt-[5px] text-[12.5px] font-medium text-[#B42318] dark:text-[#FDA29B]">{tr("Pick at least one language.")}</p>}
          </CF>
          <CF label={<span className="flex w-full items-baseline justify-between gap-2">{tr("Description")}<span className="text-[12.5px] font-normal text-[#9CA3AF]">{descV.length} / 300 · {tr("your card shows 3 lines")}</span></span>} req need={isMiss("fe-desc")} htmlFor="fe-desc">
            <Textarea id="fe-desc" aria-required aria-invalid={isMiss("fe-desc")} className={cn("h-[64px] text-[14px]", isMiss("fe-desc") && needCls)} maxLength={300} lang={tl} value={descV} onChange={(e) => setDesc(e.target.value)} />
          </CF>
          <CF label={tr("Logo and photos")} opt>
            <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-[#E6E8EC] bg-white px-3 py-2.5 dark:border-border dark:bg-card">
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogo(file); e.target.value = ""; }} />
              <button type="button" onClick={() => logoInput.current?.click()} aria-label={f.logo.url ? tr("Replace logo") : tr("Upload logo")}
                className={cn("grid h-[60px] w-[60px] flex-none cursor-pointer place-items-center overflow-hidden rounded-[10px]", f.logo.url ? "border border-[#E3E6EB] bg-white" : "border-[1.5px] border-dashed border-[#C9CED8] text-[#9CA3AF]")}>
                {f.logo.url ? <img src={f.logo.url} alt="" className="h-full w-full object-contain" /> : <Plus className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{f.name || tr("Your firm")}</div>
                <div className="truncate text-[13px] text-[#4B5563] dark:text-muted-foreground">{[f.firmType ? tr(f.firmType) : "", [thai ? f.addr.province : f.city, f.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div>
              </div>
              <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) setSlot(photoSlot.current, { pendingFile: file }); e.target.value = ""; }} />
              <div className="flex gap-2 max-sm:w-full">
                {f.media.slots.map((s, i) => {
                  const url = s.pendingFile ? URL.createObjectURL(s.pendingFile) : s.signedUrl;
                  return url ? (
                    <span key={i} className="relative h-[60px] w-[96px] flex-none overflow-hidden rounded-[9px] max-sm:flex-1">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button type="button" aria-label={tr("Remove photo")} onClick={() => setSlot(i, { persistedPath: null, signedUrl: null, pendingFile: null })}
                        className="absolute right-1 top-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-black/55 text-white"><X className="h-3 w-3" /></button>
                    </span>
                  ) : (
                    <button key={i} type="button" disabled={uploading} onClick={() => { photoSlot.current = i; photoInput.current?.click(); }}
                      className="grid h-[60px] w-[96px] flex-none cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-dashed border-[#C9CED8] text-[12px] font-semibold text-[#6B7280] hover:border-[#1E2A4A] max-sm:flex-1">
                      {tr("Add photo")}
                    </button>
                  );
                })}
              </div>
            </div>
            {logoErr && <p className="mt-[5px] text-[12.5px] font-medium text-[#B42318]">{setupText(logoErr)}</p>}
          </CF>
          <CF label={tr("Sectors")} opt>
            <SetSectorPicker mode="multi" value={f.sectors} onChange={(v) => set("sectors", v)}
              limitMsg="Pick up to 5 sectors, or Sector agnostic."
              agnostic={{ on: f.sectorAgnostic, onToggle: (on) => set("sectorAgnostic", on), line: "I work with companies in every industry",
                summary: <>{setupText("Sellers and buyers see")} <b className="text-foreground">{setupText("Sector agnostic")}</b>{setupText("on your card.")}</> }} />
          </CF>
        </div>
      </Sec>

      {/* -------------------------------------------------- Services & fees */}
      <Sec id="services" name={tr("Services and fees")} miss={missIn("services").length} open={openSec === "services"}
        onEdit={() => open("services")} onDone={() => done("services")}
        headerExtra={<button type="button" onClick={onChangeServices} className="cursor-pointer text-[13px] font-semibold text-[#1E2A4A] hover:underline dark:text-foreground">{setupText("Change services")}</button>}
        rows={<>
          {f.services.length === 0 && <Row label={tr("Services")} missingText={tr("Missing")} onAdd={() => open("services")} addName={tr("Services")} />}
          {f.services.map((s) => {
            const w = feeWords(f.fees[s] ?? newFee());
            return <Row key={s} label={tr(s)} strong value={w ? nowrapPct(w === "Request a Price Quote" ? tr(w) : w) : undefined}
              missingText={!w ? tr("Missing") : undefined} onAdd={() => open("services", `fee-box-${s}`)} addName={tr("Fee for {service}").replace("{service}", tr(s))} />;
          })}
        </>}>
        <div className="space-y-2">
          {f.services.length === 0 && <p className="text-[13px] font-semibold text-[#B42318]">{setupText("Pick at least one service.")}</p>}
          {f.services.map((s) => {
            const bad = !!feeError(s, f.fees[s] ?? newFee());
            return (
              <div key={s} id={`fee-box-${s}`} className="rounded-[10px] border border-[#E6E8EC] bg-white px-2.5 py-2 dark:border-border dark:bg-card">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.15fr_2.85fr]">
                  <div className="flex items-center gap-2 text-[14px] font-semibold">{tr(s)}</div>
                  <FeeControl service={s} value={f.fees[s] ?? newFee()} showErr={bad} onBlurAll={() => {}}
                    onChange={(v) => set("fees", { ...f.fees, [s]: v })} />
                </div>
                {bad && <p className="mt-1 text-[12.5px] font-medium text-[#B42318] dark:text-[#FDA29B]">{tr("Fill in the fee for {service}.").replace("{service}", tr(s))}</p>}
              </div>
            );
          })}
        </div>
      </Sec>

      {/* ---------------------------------------------- Contact and address */}
      <Sec id="contact" name={tr("Contact and address")} miss={missIn("contact").length} open={openSec === "contact"}
        onEdit={() => open("contact")} onDone={() => done("contact")}
        rows={<>
          <Row label={tr("Website")} value={f.website ? <span className="break-all text-[#2563EB]">{f.website}</span> : undefined} missingText={webError(f.website) ? tr("Missing") : undefined} onAdd={() => open("contact", "fe-web")} addName={tr("Website")} />
          <Row label={tr("Email")} value={<span className="break-all">{f.email}</span>} />
          <Row label={tr("Phone")} value={f.phone} missingText={phoneError(f.phone) ? tr("Missing") : undefined} onAdd={() => open("contact", "fe-phone")} addName={tr("Phone")} />
          <Row label={tr("Based in")} value={basedIn || undefined}
            missingText={basedInMiss.length ? (basedIn ? tr("Missing: {names}").replace("{names}", basedInMiss.map((m) => m.label).join(", ")) : tr("Missing")) : undefined}
            onAdd={() => open("contact", basedInMiss[0]?.fieldId ?? "fe-country")} addName={tr("Based in")} />
          <Row label={tr("Registration no.")} value={f.registrationNo || undefined}
            missingText={thai && !/^\d{13}$/.test(f.registrationNo) ? tr("Missing") : undefined}
            onAdd={() => open("contact", "fe-reg")} addName={tr("Registration no.")} />
          {!thai && !f.registrationNo && null}
          <Row label={tr("Business address")} value={addrLine || undefined}
            missingText={addrMiss.length ? (addrLine ? tr("Missing: {names}").replace("{names}", addrMiss.map((m) => m.label).join(", ")) : tr("Missing")) : undefined}
            onAdd={() => open("contact", addrMiss[0]?.fieldId ?? "addr-street")} addName={tr("Business address")} />
        </>}>
        <div className="space-y-3">
          <div className={grid}>
            <CF label={tr("Website")} req need={isMiss("fe-web")} htmlFor="fe-web">
              <Input id="fe-web" aria-required aria-invalid={isMiss("fe-web")} className={cn(inpC, isMiss("fe-web") && needCls)} maxLength={200} placeholder="https://www.yourfirm.com" value={f.website} onChange={(e) => set("website", e.target.value)} />
            </CF>
            <CF label={tr("Email")} htmlFor="fe-email">
              <div role="text" aria-label={`${tr("Email")}, ${f.email}, ${tr("From your account")}`}
                className="flex h-[38px] items-center gap-2 rounded-[8px] border border-[#E9EBF0] bg-[#F7F8FA] px-3 dark:border-border dark:bg-muted/40">
                <Mail className="h-4 w-4 flex-none text-[#6B7280]" aria-hidden />
                <span className="truncate text-[14px]">{f.email}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-[#6B7280] dark:text-muted-foreground">{tr("From your account")}</p>
            </CF>
            <CF label={tr("Phone")} req need={isMiss("fe-phone")} htmlFor="fe-phone">
              <Input id="fe-phone" aria-required aria-invalid={isMiss("fe-phone")} className={cn(inpC, isMiss("fe-phone") && needCls)} maxLength={30} placeholder="+66 2 123 4567" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </CF>
          </div>
          <div className={grid}>
            <CF label={tr("Country")} req need={isMiss("fe-country")} htmlFor="fe-country">
              <select id="fe-country" aria-required aria-invalid={isMiss("fe-country")} className={cn(selC, isMiss("fe-country") && needCls)} value={f.country} onChange={(e) => changeCountry(e.target.value)}>
                <option value="">{tr("Choose a country")}</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{tr(c)}</option>)}
              </select>
            </CF>
            <CF label={tr("City / province")} req need={isMiss("fe-city")} htmlFor="fe-city">
              {thai ? (
                <select id="fe-city" aria-required aria-invalid={isMiss("fe-city")} className={cn(selC, isMiss("fe-city") && needCls)} value={f.addr.province} onChange={(e) => set("addr", { ...f.addr, province: e.target.value })}>
                  <option value="">{tr("Choose a province")}</option>
                  {THAI_PROVINCES_77.map((p) => <option key={p} value={p}>{tr(p)}</option>)}
                </select>
              ) : (
                <Input id="fe-city" aria-required aria-invalid={isMiss("fe-city")} className={cn(inpC, isMiss("fe-city") && needCls)} value={f.city} onChange={(e) => set("city", e.target.value)} />
              )}
            </CF>
            <CF label={thai ? "Registration no. (เลขทะเบียนนิติบุคคล)" : "Registration no."} req={thai} opt={!thai} need={isMiss("fe-reg")} htmlFor="fe-reg">
              <Input id="fe-reg" aria-required={thai} aria-invalid={isMiss("fe-reg")} inputMode={thai ? "numeric" : undefined} maxLength={thai ? 13 : 50} placeholder={thai ? setupText("13 digits") : undefined}
                className={cn(inpC, thai && "border-[#93C5FD] bg-[#EFF6FF] dark:border-[#1E40AF] dark:bg-[#172554]", isMiss("fe-reg") && needCls)}
                value={f.registrationNo} onChange={(e) => set("registrationNo", thai ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value.slice(0, 50))} />
            </CF>
          </div>
          <AddressBox compact a={f.addr} thai={thai} city={f.city} onCity={(v) => set("city", v)} note={tr("The business address: sellers and buyers see it as a link that opens a map.")}
            onChange={(p) => set("addr", { ...f.addr, ...p })} show={(k) => addrErr[k] ?? null} onBlur={() => {}} />
        </div>
      </Sec>

      {/* ----------------------------------------------------------- Team */}
      <Sec id="team" name={tr("Team")} miss={0} open={openSec === "team"} onEdit={() => open("team")} onDone={() => done("team")}
        rows={<>
          {f.team.length === 0 && <p className="py-2 text-[14px] text-[#9CA3AF]">{tr("No one added yet.")}</p>}
          {f.team.map((t, i) => <Row key={i} label={t.name || tr("Team member")} strong value={[pick(t.role, t.roleTh), t.email].filter(Boolean).join(" · ") || notSet} />)}
        </>}>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3 text-[12px] font-semibold text-[#6B7280] max-sm:hidden">
            <span>{tr("Name")}</span><span>{tr("Role")}</span><span>{tr("Work email")}</span>
          </div>
          {f.team.map((t, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <CF label={<span className="sm:hidden">{tr("Name")}</span>}><Input className={inpC} aria-label={tr("Name")} value={t.name} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></CF>
              <CF label={<span className="sm:hidden">{tr("Role")}</span>}><Input className={inpC} aria-label={tr("Role")} lang={tl} value={pick(t.role, t.roleTh)} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, [tl === "th" ? "roleTh" : "role"]: e.target.value } : x)))} /></CF>
              <CF label={<span className="sm:hidden">{tr("Work email")}</span>}><Input className={inpC} aria-label={tr("Work email")} value={t.email} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /></CF>
              <Button type="button" variant="ghost" size="icon" aria-label={setupText("Remove person")} onClick={() => set("team", f.team.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <button type="button" onClick={() => set("team", [...f.team, { name: "", role: "", email: "" }])}
            className="inline-flex cursor-pointer items-center gap-1 text-[13.5px] font-semibold text-[#2563EB]">
            <Plus className="h-[15px] w-[15px]" />{tr("Add person")}
          </button>
        </div>
      </Sec>

      {/* -------------------------------------- Licences and credentials */}
      <Sec id="licences" name={tr("Licences and credentials")} miss={0} open={openSec === "licences"} onEdit={() => open("licences")} onDone={() => done("licences")}
        rows={<>
          {f.credentials.length === 0 && <p className="py-2 text-[14px] text-[#9CA3AF]">{setupText("No licences or credentials yet. Add the ones your firm holds; Admin checks each one before it shows as Verified.")}</p>}
          {f.credentials.map((c, i) => (
            <Row key={i} label={pick(c.name, c.nameTh) || tr("Licence or credential")} strong value={
              <span className="flex flex-wrap items-center gap-2">
                {pick(c.note, c.noteTh)}
                <span className={cn("rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", c.status === "verified" ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]" : "border-[#F3D9A6] bg-[#FFF4E0] text-[#8A5A06]")}>
                  {c.status === "verified" ? "✓ Verified" : tr("Pending check")}
                </span>
              </span>
            } />
          ))}
        </>}>
        <div className="space-y-2">
          {f.credentials.map((c, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto]">
              <CF label={tr("Licence or credential")} req><Input className={inpC} lang={tl} value={tl === "th" ? pick(c.name, c.nameTh) : c.name} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, [tl === "th" ? "nameTh" : "name"]: e.target.value, ...(tl === "th" && !x.name ? { name: e.target.value } : {}), status: "pending" } : x)))} /></CF>
              <CF label={tr("Note")}><Input className={inpC} lang={tl} value={pick(c.note, c.noteTh)} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, [tl === "th" ? "noteTh" : "note"]: e.target.value, status: "pending" } : x)))} /></CF>
              <span className={cn("mb-2 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", c.status === "verified" ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]" : "border-[#F3D9A6] bg-[#FFF4E0] text-[#8A5A06]")}>
                {c.status === "verified" ? "✓ Verified" : tr("Pending check")}
              </span>
              <Button type="button" variant="ghost" size="icon" aria-label={setupText("Remove credential")} onClick={() => set("credentials", f.credentials.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <button type="button" onClick={() => set("credentials", [...f.credentials, { name: "", note: "", status: "pending" }])}
            className="inline-flex cursor-pointer items-center gap-1 text-[13.5px] font-semibold text-[#2563EB]">
            <Plus className="h-[15px] w-[15px]" />{tr("Add licence or credential")}
          </button>
        </div>
      </Sec>

      {/* ------------------------------------------------------ Documents */}
      <Sec id="documents" name={tr("Documents")} miss={0} open={openSec === "documents"} onEdit={() => open("documents")} onDone={() => done("documents")}
        rows={<>
          {f.documents.length === 0 && <p className="py-2 text-[14px] text-[#9CA3AF]">{setupText("No documents yet. Upload your company certificate and licences: PDF, DOCX or an image.")}</p>}
          {f.documents.map((d) => <Row key={d.id ?? d.path} label={d.name} strong value={d.type || "File"} />)}
        </>}>
        <div className="space-y-2">
          {f.documents.map((d, i) => (
            <div key={d.id ?? d.path} className="flex min-h-[38px] items-center gap-2.5 rounded-[9px] border border-[#E6E8EC] bg-white px-2.5 py-1.5 dark:border-border dark:bg-card">
              <FileText className="h-4 w-4 flex-none text-[#6B7280]" aria-hidden />
              <Input className={cn(inpC, "h-[32px] flex-1 border-0 bg-transparent px-1")} value={d.name} onChange={(e) => set("documents", f.documents.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <span className="flex-none text-[12px] text-[#6B7280]">{d.type || "File"}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={setupText("Remove document")} onClick={() => set("documents", f.documents.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <input ref={docInput} type="file" accept=".pdf,.docx,.doc,image/*" className="hidden" onChange={(e) => { onDoc(e.target.files?.[0]); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => docInput.current?.click()}>{setupText("Upload a document")}</Button>
        </div>
      </Sec>
    </div>
  );
}
