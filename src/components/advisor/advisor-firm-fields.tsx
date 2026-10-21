import { tr } from "@/i18n/language";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, Plus, Upload } from "lucide-react";
import { createAdvisorUploadUrl, signAdvisorFile } from "@/lib/advisor-firm.functions";
import { toWebp } from "@/lib/media/to-webp";
import { COUNTRIES as COUNTRY_LIST, THAI_PROVINCES_77 } from "@/lib/investor-bands";
import {
  FEE_TYPES, feeError, feeWords, fmtAmount, serviceOf, type FeeDetail, type FeeType,
} from "@/lib/advisor-firm";
import { cn } from "@/lib/utils";

/** Fields shared by the firm setup wizard and Edit profile, so both keep one set of rules. */

export const Req = () => <span aria-hidden className="relative -top-0.5 ml-[3px] text-[12px] font-semibold text-[#B42318]">*</span>;
export const Opt = () => <span className="ml-1.5 font-normal text-[#9CA3AF]">{tr("optional")}</span>;
export const Err = ({ m }: { m: string | null | false | undefined }) => (m ? <p className="mt-1.5 text-[13px] text-[#B42318]">{m}</p> : null);
const sub = "block text-[12px] font-medium text-[#6B7280] mb-1";
const small = "h-10 w-full rounded-[10px] border border-[#DCDFE5] bg-white px-3 text-[14px] outline-none focus:border-[#1E2A4A] dark:border-border dark:bg-background";
const bad = "!border-[#B42318]";

/* --------------------------------- Fees --------------------------------- */

export function FeeControl({ service, value, onChange, showErr, autoFocus, onBlurAll, proposal }: {
  service: string; value: FeeDetail; onChange: (v: FeeDetail) => void; showErr: boolean; autoFocus?: boolean; onBlurAll?: () => void;
  /** Proposal mode: no Request a Price Quote, "Fixed fee ฿{amount}", "On the proposal". */
  proposal?: { words: (f: FeeDetail) => string | null };
}) {
  const ex = serviceOf(service);
  const err = showErr ? feeError(service, value) : null;
  const words = proposal ? proposal.words(value) : feeWords(value);
  const set = (p: Partial<FeeDetail>) => onChange({ ...value, ...p });
  const amountField = (label: string, ph: string) => (
    <div className="min-w-0">
      <span className={sub}>{tr(label)}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6B7280]">฿</span>
        <input inputMode="numeric" aria-required aria-label={`${service} ${label}`} placeholder={ph} onBlur={onBlurAll}
          className={cn(small, "pl-7", err?.amount && bad)} value={fmtAmount(value.amount)}
          onChange={(e) => set({ amount: e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12) })} />
      </div>
    </div>
  );
  const pctField = (label: string) => (
    <div className="min-w-0">
      <span className={sub}>{tr(label)}</span>
      <div className="relative">
        <input inputMode="decimal" aria-required aria-label={`${service} ${label}`} placeholder={ex.pct} onBlur={onBlurAll}
          className={cn(small, "pr-8", err?.pct && bad)} value={value.pct}
          onChange={(e) => set({ pct: e.target.value.replace(/,/g, ".").replace(/-/g, "–").replace(/[^\d.–]/g, "").slice(0, 11) })} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6B7280]">%</span>
      </div>
    </div>
  );
  return (
    <div className="space-y-2.5">
      <div>
        <span className={sub}>{tr("How you charge")}<Req /></span>
        <select autoFocus={autoFocus} aria-required aria-label={`How you charge for ${service}`} className={cn(small, "pr-8")} value={value.type}
          onChange={(e) => set({ type: e.target.value as FeeType })}>
          {FEE_TYPES.filter((t) => !proposal || t.value !== "quote").map((t) => <option key={t.value} value={t.value}>{tr(t.label)}</option>)}
        </select>
      </div>
      {value.type === "fixed" && amountField(proposal ? "Amount" : "From", ex.fixed)}
      {value.type === "hourly" && amountField("Per hour", "5,500")}
      {value.type === "retainer" && amountField("Per month", "120,000")}
      {value.type === "success" && pctField("Of the deal")}
      {value.type === "retainer_success" && (
        <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">{amountField("Retainer per month", "120,000")}{pctField("Success fee")}</div>
      )}
      {value.type === "other" && (
        <div>
          <span className={sub}>{tr("In your own words")}</span>
          <textarea rows={2} maxLength={80} aria-required placeholder={ex.own} onBlur={onBlurAll}
            className={cn(small, "h-auto py-2", err?.words && bad)} value={value.words}
            onChange={(e) => set({ words: e.target.value })} />
        </div>
      )}
      {words && <p className="text-[12.5px] text-[#6B7280]">{tr(proposal ? "On the proposal" : "On your profile")}: <b className="font-semibold text-[#151A28] dark:text-foreground">{nowrapPct(words)}</b></p>}
      {err && <p className="text-[13px] text-[#B42318]">{err.msg}</p>}
    </div>
  );
}

/** Keeps a range like "2–3%" on one line. */
export function nowrapPct(words: string) {
  const parts = words.split(/(\d+(?:\.\d+)?(?:–\d+(?:\.\d+)?)?%)/);
  return parts.map((p, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{p}</span> : p));
}

/* -------------------------------- Address ------------------------------- */

export type Addr = { street: string; unit: string; district: string; province: string; postal: string };
export function addrErrors(a: Addr, thai: boolean, city: string) {
  return thai
    ? {
        street: a.street.trim() ? null : tr("Add the number and street."),
        district: a.district.trim() ? null : tr("Add the city or district."),
        province: a.province ? null : tr("Choose the province or state."),
        postal: !a.postal ? tr("Add the postal code.") : /^\d{5}$/.test(a.postal) ? null : tr("The postal code has 5 digits."),
      }
    : { street: a.street.trim() ? null : tr("Add the street and number."), district: city.trim() ? null : tr("Add the city or district."), province: null, postal: null };
}

export function AddressBox({ a, thai, city, onCity, onChange, show, onBlur, compact, note, need, title = tr("Business address"), stars = true, country, onCountry, countryErr }: {
  a: Addr; thai: boolean; city: string; onCity?: (v: string) => void; onChange: (p: Partial<Addr>) => void;
  show: (k: keyof Addr) => string | null; onBlur: (k: keyof Addr) => void; compact?: boolean; note: string;
  /** Setup wizards: mark fields still needed light blue (see common/need-fill). */
  need?: boolean; title?: string | null; stars?: boolean;
  /** Buyers and advisors: Country is the box's first field (sellers have none: Thailand, fixed). */
  country?: string; onCountry?: (c: string) => void; countryErr?: string | null;
}) {
  const errs = addrErrors(a, thai, city) as Record<keyof Addr, string | null | undefined>;
  const nd = (k: keyof Addr) => (need && errs[k] ? { "data-need": "1", "aria-invalid": show(k) ? true : undefined } : { "aria-invalid": show(k) ? true : undefined });
  const nc = (k: keyof Addr) => (need && errs[k] ? "need-fill" : "");
  const inp = cn(compact ? "h-[42px] text-[14px]" : "h-[50px] text-[16px]", "w-full rounded-[12px] border border-[#DCDFE5] bg-white px-3.5 outline-none focus:border-[#1E2A4A] dark:border-border dark:bg-background");
  const lbl = "mb-1.5 block text-[14px] font-semibold";
  const withCountry = country !== undefined;
  const countryList = withCountry && country && !COUNTRY_LIST.includes(country) ? [country, ...COUNTRY_LIST] : COUNTRY_LIST;
  const street = (
    <div>
      <label className={lbl} htmlFor="addr-street">{thai ? tr("No. and street") : tr("Street and number")}{stars && <Req />}</label>
      <input id="addr-street" aria-required autoComplete="address-line1" maxLength={120} placeholder={tr(thai ? "e.g. 191 Sukhumvit Road" : "e.g. 1 Raffles Place")}
        className={cn(inp, nc("street"), show("street") && bad)} {...nd("street")} value={a.street} onBlur={() => onBlur("street")} onChange={(e) => onChange({ street: e.target.value })} />
      <Err m={show("street")} />
    </div>
  );
  const unit = (
    <div>
      <label className={lbl} htmlFor="addr-unit">{thai ? tr("Floor / unit / soi") : tr("Floor / unit")}<Opt /></label>
      <input id="addr-unit" autoComplete="address-line2" maxLength={120} placeholder={tr(thai ? "e.g. Unit 1203, 12th Floor" : "e.g. #20-01")}
        className={inp} value={a.unit} onChange={(e) => onChange({ unit: e.target.value })} />
    </div>
  );
  const district = (
    <div className="flex flex-col justify-end">
      <label className={lbl} htmlFor="addr-district">{tr("City/District")}{stars && <Req />}</label>
      {thai ? (
        <input id="addr-district" aria-required autoComplete="address-level2" maxLength={80} placeholder={tr("e.g. Watthana")}
          className={cn(inp, nc("district"), show("district") && bad)} {...nd("district")} value={a.district} onBlur={() => onBlur("district")} onChange={(e) => onChange({ district: e.target.value })} />
      ) : (
        <input id="addr-district" aria-required autoComplete="address-level2" maxLength={80} placeholder="e.g. Singapore"
          className={cn(inp, nc("district"), show("district") && bad)} {...nd("district")} value={city} onBlur={() => onBlur("district")} onChange={(e) => onCity?.(e.target.value)} />
      )}
      <Err m={show("district")} />
    </div>
  );
  const province = (
    <div className="flex flex-col justify-end">
      <label className={lbl} htmlFor="addr-province">{tr("Province/State")}{thai ? (stars ? <Req /> : null) : <Opt />}</label>
      {thai ? (
        <select id="addr-province" aria-required autoComplete="address-level1" className={cn(inp, nc("province"), "pr-8", show("province") && bad)} {...nd("province")} value={a.province}
          onBlur={() => onBlur("province")} onChange={(e) => onChange({ province: e.target.value })}>
          <option value="">{tr("Choose a province")}</option>
          {THAI_PROVINCES_77.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      ) : (
        <input id="addr-province" autoComplete="address-level1" maxLength={80} className={inp} value={a.province} onChange={(e) => onChange({ province: e.target.value })} />
      )}
      <Err m={show("province")} />
    </div>
  );
  const postal = (
    <div className="flex flex-col justify-end">
      <label className={lbl} htmlFor="addr-postal">{tr("Postal code")}{thai ? (stars ? <Req /> : null) : <Opt />}</label>
      <input id="addr-postal" aria-required={thai} autoComplete="postal-code" inputMode={thai ? "numeric" : undefined} maxLength={thai ? 5 : 12}
        placeholder={thai ? "5 digits" : undefined} className={cn(inp, nc("postal"), show("postal") && bad)} {...nd("postal")} value={a.postal} onBlur={() => onBlur("postal")}
        onChange={(e) => onChange({ postal: thai ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value.slice(0, 12) })} />
      <Err m={show("postal")} />
    </div>
  );
  return (
    <div className="rounded-[14px] border border-[#DCDFE5] bg-[#FAFBFC] px-3.5 pb-3.5 pt-4 sm:px-5 sm:pb-[18px] sm:pt-5 dark:border-border dark:bg-muted/30">
      {title && <div className="mb-3 text-[16px] font-bold">{title}</div>}
      {withCountry ? (
        <div className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-col justify-end">
              <label className={lbl} htmlFor="addr-country">{tr("Country")}{stars && <Req />}</label>
              <select id="addr-country" aria-required className={cn(inp, "pr-8", countryErr && bad)} value={country}
                onChange={(e) => onCountry?.(e.target.value)}>
                {!country && <option value="">{tr("Choose a country")}</option>}
                {countryList.map((c) => <option key={c} value={c}>{tr(c)}</option>)}
              </select>
              <Err m={countryErr ?? null} />
            </div>
            {province}
          </div>
          {street}
          {unit}
          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">{district}{postal}</div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {street}
          {unit}
          <div className="grid gap-3.5 sm:grid-cols-2">{district}{province}</div>
          <div className="sm:w-1/2 sm:pr-[7px]">{postal}</div>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-[#6B7280]">{note}</p>
    </div>
  );
}

/* ---------------------------------- Logo --------------------------------- */

export const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
export function logoFileError(file: File): string | null {
  if (!LOGO_TYPES.includes(file.type)) return "Choose a PNG, JPG or SVG image.";
  if (file.size > 2 * 1024 * 1024) return "The logo must be 2 MB or smaller.";
  return null;
}
async function cleanSvg(file: File): Promise<Blob> {
  const txt = await file.text();
  const clean = txt
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
  return new Blob([clean], { type: "image/svg+xml" });
}
/** Upload a checked logo; returns the stored path and a URL to show it. */
export function useLogoUpload() {
  const upload = useServerFn(createAdvisorUploadUrl);
  const sign = useServerFn(signAdvisorFile);
  return async (file: File): Promise<{ path: string; url: string }> => {
    const conv = file.type === "image/svg+xml" ? file : await toWebp(file, "logo");
    const ext = conv.type === "image/svg+xml" ? "svg" : conv.type === "image/png" ? "png" : conv.type === "image/webp" ? "webp" : "jpg";
    const body = ext === "svg" ? await cleanSvg(conv) : conv;
    const { path, url } = await upload({ data: { kind: "logo", ext } });
    const res = await fetch(url, { method: "PUT", body, headers: { "Content-Type": conv.type, "x-upsert": "false" } });
    if (!res.ok) throw new Error("Upload failed.");
    const signed = await sign({ data: { path } });
    return { path, url: signed.url ?? URL.createObjectURL(body) };
  };
}

export type LogoState = { path: string | null; url: string | null; name: string | null; sizeKb: number | null; source: "upload" | "enrich" | null };

export function LogoDrop({ logo, onFile, onRemove, error, busy }: {
  logo: LogoState; onFile: (f: File) => void; onRemove: () => void; error: string | null; busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const has = !!logo.url;
  const pick = (
    <input ref={input} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
  );
  const btn = "inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#DCDFE5] bg-white px-3.5 text-[14px] font-semibold text-[#434A5C] hover:bg-[#F6F7F9] disabled:opacity-50 dark:border-border dark:bg-background dark:text-foreground";
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        className={cn("flex flex-wrap items-center gap-4 rounded-[14px] p-[18px] transition-colors",
          has ? "border-[1.5px] border-solid border-[#E3E6EB] bg-white dark:border-border dark:bg-card" : "border-[1.5px] border-dashed border-[#C9CED8] bg-[#FAFBFC] dark:border-border dark:bg-muted/30",
          over && "!border-[#1E2A4A] !bg-[#F1F4F9] dark:!bg-muted")}
      >
        {pick}
        <div className={cn("grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-[18px]", has ? "border border-[#E3E6EB] bg-white" : "bg-[#EEF0F4] dark:bg-muted")}>
          {has ? <img src={logo.url!} alt={tr("Your logo")} className="h-full w-full object-contain" /> : <ImageIcon className="h-7 w-7 text-[#9CA3AF]" />}
        </div>
        <div className="min-w-0 flex-1">
          {has ? (
            <>
              <div className="truncate text-[15px] font-semibold">{logo.source === "enrich" ? "Found on your website" : logo.name ?? tr("Your logo")}</div>
              <div className="text-[13px] text-[#6B7280]">{logo.source === "enrich" ? "Replace it with your own file if you like." : `${logo.sizeKb != null ? `${logo.sizeKb} KB · ` : ""}sellers and buyers see it on your card`}</div>
              <div className="mt-2.5 flex items-center gap-3">
                <button type="button" className={btn} disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" /> Replace</button>
                <button type="button" className="text-[14px] font-medium text-[#434A5C] hover:underline dark:text-muted-foreground" onClick={onRemove}>Remove</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold">Drag your logo here, or choose a file</div>
              <div className="text-[13px] text-[#6B7280]">PNG, JPG or SVG, up to 2 MB</div>
              <button type="button" className={cn(btn, "mt-2.5")} disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" /> Choose a file</button>
            </>
          )}
        </div>
      </div>
      <Err m={error} />
    </div>
  );
}

/** Compact logo row for Review & complete and Edit profile. */
export function LogoRow({ logo, onFile, onRemove, error, busy }: { logo: LogoState; onFile: (f: File) => void; onRemove: () => void; error: string | null; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const has = !!logo.url;
  const link = "font-semibold text-[#1E2A4A] hover:underline disabled:opacity-50 dark:text-foreground";
  return (
    <div>
      <div className="flex items-center gap-3">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <button type="button" onClick={() => input.current?.click()} aria-label={has ? "Replace logo" : "Upload logo"}
          className={cn("grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-[12px]", has ? "border border-[#E3E6EB] bg-white" : "border-[1.5px] border-dashed border-[#C9CED8] text-[#9CA3AF]")}>
          {has ? <img src={logo.url!} alt="" className="h-full w-full object-contain" /> : <Plus className="h-5 w-5" />}
        </button>
        <div className="min-w-0 text-[13px]">
          <div className="text-[#434A5C] dark:text-muted-foreground">
            {has ? (logo.source === "enrich" ? "Found on your website. Sellers and buyers see it on your card." : `${logo.name ?? tr("Your logo")}. Sellers and buyers see it on your card.`)
              : "Sellers and buyers see it on your card. PNG, JPG or SVG, up to 2 MB."}
          </div>
          <div className="mt-0.5 flex gap-2">
            {has ? (
              <>
                <button type="button" className={link} disabled={busy} onClick={() => input.current?.click()}>Replace logo</button>
                <span className="text-[#9CA3AF]">·</span>
                <button type="button" className={link} onClick={onRemove}>Remove</button>
              </>
            ) : <button type="button" className={link} disabled={busy} onClick={() => input.current?.click()}>Upload logo</button>}
          </div>
        </div>
      </div>
      <Err m={error} />
    </div>
  );
}
