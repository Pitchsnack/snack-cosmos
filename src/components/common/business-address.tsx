import { setupText } from "@/i18n/language";
import { tr } from "@/i18n/language";
import { COUNTRIES as COUNTRY_LIST, THAI_PROVINCES_77 } from "@/lib/investor-bands";
import { cn } from "@/lib/utils";
const Req = () => <span aria-hidden className="ml-1 text-destructive">*</span>;
const Opt = () => <span className="ml-1.5 font-normal text-muted-foreground">{tr("optional")}</span>;
const Err = ({m}: {m: string | null | undefined}) => m ? <p className="mt-1.5 text-xs text-destructive">{m}</p> : null;
const bad = "!border-destructive";
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

export function AddressBox({ a, thai, city, onCity, onChange, show, onBlur, compact, note, need, title = tr("Business address"), stars = true, country, onCountry, countryErr, noteOutside = false }: {
  a: Addr; thai: boolean; city: string; onCity?: (v: string) => void; onChange: (p: Partial<Addr>) => void;
  show: (k: keyof Addr) => string | null; onBlur: (k: keyof Addr) => void; compact?: boolean; note: string;
  /** Setup wizards: mark fields still needed light blue (see common/need-fill). */
  need?: boolean; title?: string | null; stars?: boolean;
  /** Buyers and advisors: Country is the box's first field (sellers have none: Thailand, fixed). */
  country?: string; onCountry?: (c: string) => void; countryErr?: string | null; noteOutside?: boolean;
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
        <input id="addr-district" aria-required autoComplete="address-level2" maxLength={80} placeholder={setupText("e.g. Singapore")}
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
          {THAI_PROVINCES_77.map((p) => <option key={p} value={p}>{tr(p)}</option>)}
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
        placeholder={thai ? tr("5 digits") : undefined} className={cn(inp, nc("postal"), show("postal") && bad)} {...nd("postal")} value={a.postal} onBlur={() => onBlur("postal")}
        onChange={(e) => onChange({ postal: thai ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value.slice(0, 12) })} />
      <Err m={show("postal")} />
    </div>
  );
  return (
    <>
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
      {!noteOutside && <p className="mt-3 text-[12.5px] text-muted-foreground">{note}</p>}
    </div>
    {noteOutside && <p className="mt-2 text-[12.5px] text-muted-foreground">{note}</p>}
    </>
  );
}

