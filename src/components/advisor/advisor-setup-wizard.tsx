import { tr, useTranslation } from "@/i18n/language";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle, ExternalLink, Globe, Info, Landmark, Loader2, Newspaper, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import logoBlack from "@/assets/pitchsnack-black.png";
import { FirmCard } from "@/components/advisor/advisor-firm-card";
import { ADVISOR_FIRMS_KEY } from "@/components/advisor/advisor-my-company";
import { useFocusNeeded } from "@/components/common/need-fill";
import { AddressBox, Err, FeeControl, LogoDrop, Opt, Req, addrErrors, logoFileError, nowrapPct, useLogoUpload, type Addr, type LogoState } from "@/components/advisor/advisor-firm-fields";
import { FirmEditForm, type FirmForm, type SourceTag } from "@/components/advisor/advisor-firm-edit";
import { enrichAdvisorFirm, saveAdvisorWizard, type AdvisorEnrichResult } from "@/lib/advisor-firm.functions";
import {
  ADVISOR_SERVICES, DEAL_BANDS, FIRM_TYPE_OPTIONS, LANGUAGES, WIZARD_QS, cityError, dealBandLabels, descError, emailError, feeWords,
  fullAddress, nameError, newFee, phoneError, teamSizeError, webError, type AdvisorFirm, type FeeDetail, type WizardQ,
  advisorSkips, advisorHidden,
} from "@/lib/advisor-firm";
import { COUNTRIES, THAI_PROVINCES_77, yearError } from "@/lib/investor-bands";
import { isValidUrl, normalizeUrl } from "@/lib/seller-wizard";
import { cn } from "@/lib/utils";

type A = {
  type: string; country: string; city: string; name: string; year: string; reg: string; addr: Addr; web: string;
  services: string[]; fees: Record<string, FeeDetail>; deal: string; team: string; langs: string[]; sectors: string[]; agnostic: boolean; email: string; phone: string;
  logo: LogoState; desc: string;
};
const SECTION: Record<WizardQ, string> = {
  type: "About the firm", loc: "About the firm", name: "About the firm", web: "About the firm", services: "Services and fees",
  deal: "Your work", team: "Your work", sectors: "Your work", contact: "Contact", logo: "Your card", desc: "Your card", review: "Review",
};
const STEPS: WizardQ[] = [...WIZARD_QS, "review"];

function fromFirm(f: AdvisorFirm): A {
  const thai = (f.country ?? "Thailand") === "Thailand";
  return {
    type: f.firmType ?? "", country: f.country ?? "Thailand", city: f.city ?? "", name: f.name ?? "",
    year: f.yearFounded ? String(f.yearFounded) : "", reg: f.registrationNo ?? "",
    addr: { street: f.addrStreet ?? "", unit: f.addrUnit ?? "", district: thai ? f.addrDistrict ?? "" : "", province: f.addrProvince ?? (thai ? f.city ?? "" : ""), postal: f.addrPostal ?? "" },
    web: f.website ?? "", services: f.services, fees: { ...f.feeDetails }, deal: f.dealBand ?? "",
    team: f.teamSize ? String(f.teamSize) : "", langs: f.languages, sectors: f.sectors, agnostic: !!f.sectorAgnostic, email: f.email ?? "", phone: f.phone ?? "",
    logo: { path: f.logoPath, url: f.logoUrl, name: null, sizeKb: null, source: f.logoSource }, desc: f.description ?? "",
  };
}
const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");

export function AdvisorSetupWizard({ firm }: { firm: AdvisorFirm }) {
  useTranslation(); // re-render on language change
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveAdvisorWizard);
  const uploadLogo = useLogoUpload();
  const setupDone = !!firm.setupDoneAt;
  const [a, setA] = useState<A>(() => fromFirm(firm));
  const [answered, setAnswered] = useState<string[]>(firm.setupAnswered);
  const [feeNote, setFeeNote] = useState<string[] | null>(null);
  const feeVisited = useRef(!!(firm.wizard as { feeVisited?: boolean }).feeVisited);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [forced, setForced] = useState<Record<string, boolean>>({});
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [phase, setPhase] = useState<"q" | "enrich" | "complete">("q");
  const [fromReview, setFromReview] = useState(false);
  const [fromProfile, setFromProfile] = useState(false);
  // A question opened from Review shows all its fields under its full title.
  const [full, setFull] = useState<WizardQ | null>(null);
  const fromSignup = (firm.wizard as { fromSignup?: string[] } | null)?.fromSignup;
  const [webOpened, setWebOpened] = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [enrich, setEnrich] = useState<AdvisorEnrichResult | null>(null);
  const [dirtyForm, setDirtyForm] = useState<FirmForm | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [focusFee, setFocusFee] = useState<string | null>(null);
  const pending = useRef<{ patch: Record<string, unknown>; fees: Record<string, FeeDetail> }>({ patch: {}, fees: {} });
  const timer = useRef<number | null>(null);
  const advTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const qRef = useRef<HTMLDivElement>(null);

  // ---- validation ----
  const thai = a.country === "Thailand";
  const addrErr = addrErrors(a.addr, thai, a.city);
  const errors: Record<string, string | null> = {
    type: a.type ? null : tr("Choose one to continue."),
    country: a.country ? null : tr("Choose your country."),
    city: cityError(a.city, a.country),
    name: nameError(a.name),
    year: yearError(a.year),
    reg: thai && !/^\d{13}$/.test(a.reg) ? "The registration number has 13 digits." : null,
    "a-street": addrErr.street, "a-district": addrErr.district, "a-province": addrErr.province, "a-postal": addrErr.postal,
    web: webError(a.web),
    services: a.services.length ? (a.services.every((s) => feeWords(a.fees[s] ?? newFee())) ? null : "fee") : tr("Pick at least one service."),
    deal: a.deal ? null : "hint",
    team: teamSizeError(a.team),
    langs: a.langs.length ? null : tr("Pick at least one language."),
    sectors: a.agnostic || a.sectors.length ? null : tr("Pick at least one sector, or Sector agnostic."),
    email: emailError(a.email),
    phone: phoneError(a.phone),
    logo: a.logo.path ? null : "hint",
    desc: descError(a.desc),
  };
  const fieldsOf: Record<WizardQ, string[]> = {
    type: ["type"], loc: ["country", "city"], name: ["name", "year", "reg", "a-street", "a-district", "a-province", "a-postal"], web: ["web"],
    services: ["services"], deal: ["deal"], team: ["team", "langs"], sectors: ["sectors"], contact: ["email", "phone"], logo: ["logo"], desc: ["desc"], review: [],
  };
  const qValid = (id: WizardQ) => fieldsOf[id].every((k) => !errors[k]);
  const show = (k: string) => ((touched[k] || forced[k]) && errors[k] && errors[k] !== "fee" && errors[k] !== "hint" ? errors[k] : null);
  const isAnswered = useCallback((id: string) => answered.includes(id) && (id === "deal" || id === "logo" || qValid(id as WizardQ)), [answered, a]); // eslint-disable-line react-hooks/exhaustive-deps
  const requiredOk = WIZARD_QS.filter((q) => q !== "deal" && q !== "logo").every((q) => qValid(q));

  const skipOf = (x: A) => advisorSkips(fromSignup, { type: x.type, web: x.web, year: x.year, team: x.team });
  const skipSet = skipOf(a);
  const [cur, setCur] = useState<WizardQ>(() => {
    const sk = skipOf(fromFirm(firm));
    return (WIZARD_QS.find((q) => !sk.has(q) && !firm.setupAnswered.includes(q)) ?? "review") as WizardQ;
  });
  const hiddenF = advisorHidden(fromSignup, { type: a.type, web: a.web, year: a.year, team: a.team });
  const hid = (k: string, q: WizardQ) => full !== q && hiddenF.has(k);
  const nameShort = !!fromSignup?.includes("name") && full !== "name";
  const shown = STEPS.filter((q) => q === "review" || !skipSet.has(q) || q === full || q === cur);
  // After the first render, resume at the first question that's unanswered or no longer valid.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const first = WIZARD_QS.find((q) => !skipSet.has(q) && !isAnswered(q));
    setCur((first ?? "review") as WizardQ);
  }, [isAnswered]);

  // ---- autosave ----
  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const { patch, fees } = pending.current;
    pending.current = { patch: {}, fees: {} };
    if (!Object.keys(patch).length && !Object.keys(fees).length) return true;
    setSaving("saving");
    try { await saveFn({ data: { id: firm.id, patch: patch as never, fees } }); setSaving("saved"); return true; }
    catch { setSaving("failed"); Object.assign(pending.current.patch, patch); Object.assign(pending.current.fees, fees); return false; }
  }, [saveFn, firm.id]);
  const queue = useCallback((patch: Record<string, unknown>, fees?: Record<string, FeeDetail>) => {
    Object.assign(pending.current.patch, patch);
    if (fees) Object.assign(pending.current.fees, fees);
    setSaving("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 450);
  }, [flush]);
  useEffect(() => () => { if (advTimer.current) window.clearTimeout(advTimer.current); }, []);

  // Files dropped outside the logo box are ignored.
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => { window.removeEventListener("dragover", stop); window.removeEventListener("drop", stop); };
  }, []);

  const set = (patch: Partial<A>, server: Record<string, unknown>, fees?: Record<string, FeeDetail>) => {
    setA((p) => ({ ...p, ...patch }));
    queue(server, fees);
  };
  const setAddr = (p: Partial<Addr>) => {
    const addr = { ...a.addr, ...p };
    const server: Record<string, unknown> = {};
    if ("street" in p) server.addr_street = addr.street || null;
    if ("unit" in p) server.addr_unit = addr.unit || null;
    if ("district" in p) server.addr_district = addr.district || null;
    if ("province" in p) server.addr_province = addr.province || null;
    if ("postal" in p) server.addr_postal = addr.postal || null;
    set({ addr }, server);
  };
  const changeCountry = (c: string) =>
    set({ country: c, city: "", reg: "", addr: { street: "", unit: "", district: "", province: "", postal: "" } },
      { country: c, city: null, registration_no: null, addr_street: null, addr_unit: null, addr_district: null, addr_province: null, addr_postal: null });

  const markAnswered = (id: WizardQ) => {
    if (id === "review" || answered.includes(id)) return;
    const n = [...answered, id];
    setAnswered(n);
    queue({ setup_answered: n });
  };
  const goTo = (id: WizardQ) => {
    setForced({}); setHint(null);
    // First visit to services: tick the usual ones for the firm type, each on Request a Price Quote.
    if (id === "services" && !feeVisited.current) {
      feeVisited.current = true;
      const def = FIRM_TYPE_OPTIONS.find((t) => t.value === a.type)?.services ?? [];
      const wiz = { ...(firm.wizard ?? {}), feeVisited: true };
      if (!a.services.length && def.length) {
        const fees = Object.fromEntries(def.map((s) => [s, a.fees[s] ?? newFee()]));
        setA((p) => ({ ...p, services: def, fees: { ...p.fees, ...fees } }));
        setFeeNote(def);
        queue({ services: def, wizard_state: wiz }, fees);
      } else queue({ wizard_state: wiz });
    }
    setCur(id);
  };
  const next = (from: WizardQ): WizardQ => STEPS.slice(STEPS.indexOf(from) + 1).find((q) => q === "review" || !skipSet.has(q)) ?? "review";
  const advance = (from: WizardQ) => {
    markAnswered(from);
    if (from === "services") setFeeNote(null);
    if (fromProfile && from === "services") { setFromProfile(false); void flush().then(() => setPhase("complete")); return; }
    if (fromReview) { setFromReview(false); setFull(null); goTo("review"); return; }
    goTo(next(from));
  };
  const focusFirstBad = (id: WizardQ) => {
    const k = fieldsOf[id].find((x) => errors[x]);
    if (!k) return;
    setTimeout(() => {
      const el = cardRef.current?.querySelector<HTMLElement>(`[data-f="${k}"], [aria-invalid="true"], input[aria-required]:placeholder-shown, select[aria-required]`);
      el?.focus();
    }, 0);
  };
  const tryContinue = () => {
    if (cur === "review") { if (requiredOk) void flush().then(() => setPhase("enrich")); return; }
    if (cur === "deal" && !a.deal) { setHint(tr("Choose a range to continue, or Skip this question.")); return; }
    if (cur === "logo" && !a.logo.path) { setHint(tr("Choose a file to continue, or Skip this question.")); return; }
    if (!qValid(cur)) {
      setForced(Object.fromEntries(fieldsOf[cur].map((k) => [k, true])));
      if (cur === "services") setTouched((t) => ({ ...t, ...Object.fromEntries(a.services.map((s) => [`fee-${s}`, true])) }));
      focusFirstBad(cur);
      return;
    }
    advance(cur);
  };
  const skip = () => {
    if (cur === "deal") set({ deal: "" }, { deal_size_band: null });
    if (cur === "logo") set({ logo: { path: null, url: null, name: null, sizeKb: null, source: null } }, { logo_path: null, logo_source: null });
    markAnswered(cur);
    if (fromReview) { setFromReview(false); setFull(null); goTo("review"); return; }
    goTo(next(cur));
  };
  const pickType = (v: string) => {
    set({ type: v }, { firm_type: v });
    if (advTimer.current) window.clearTimeout(advTimer.current);
    advTimer.current = window.setTimeout(() => advance("type"), 250);
  };
  const idx = Math.max(0, shown.indexOf(cur));
  const back = () => { if (idx > 0) goTo(shown[idx - 1]!); };

  const [exiting, setExiting] = useState(false);
  const leave = async (withSave: boolean) => {
    if (exiting) return;
    setExiting(true);
    let ok = true;
    if (withSave) {
      const cap = <T,>(p: Promise<T>) => Promise.race([p, new Promise<"slow">((r) => window.setTimeout(() => r("slow"), 1500))]);
      try { const r = await cap(flush()); ok = r !== false; } catch { ok = false; }
      if (ok) toast.success(setupDone ? "Your changes are saved." : tr("Saved as a draft. Continue setup any time from My Company."));
      else toast.error(tr("Your last answer wasn't saved. Open the setup again to check it."));
    }
    void qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
    const to = `/marketplace/my-company?open=${firm.id}`;
    const fallback = window.setTimeout(() => { window.location.href = to; }, 1800);
    try { await navigate({ to: "/marketplace/my-company", search: { open: firm.id } as never }); window.clearTimeout(fallback); }
    catch { window.location.href = to; }
  };
  const exit = () => {
    if (phase === "complete") { if (dirtyForm) setLeaveOpen(true); else void leave(false); return; }
    void leave(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== tr("Enter") || phase !== "q") return;
    const t = e.target as HTMLElement;
    if (t.closest("button, a")) return;
    if (t.tagName === "TEXTAREA") { if (e.shiftKey) return; }
    e.preventDefault();
    tryContinue();
  };

  async function onLogo(file: File) {
    const e = logoFileError(file);
    setLogoErr(e);
    if (e) return;
    setLogoBusy(true);
    try {
      const r = await uploadLogo(file);
      set({ logo: { path: r.path, url: r.url, name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)), source: "upload" } }, { logo_path: r.path, logo_source: "upload" });
      setHint(null);
    } catch (er) { toast.error((er as Error).message); } finally { setLogoBusy(false); }
  }

  const toggleService = (s: string) => {
    const on = a.services.includes(s);
    const services = on ? a.services.filter((x) => x !== s) : [...a.services, s];
    const fee = a.fees[s] ?? newFee();
    set({ services, fees: { ...a.fees, [s]: fee } }, { services }, on ? undefined : { [s]: fee });
    if (!on) setFocusFee(s);
  };
  const setFee = (s: string, v: FeeDetail) => set({ fees: { ...a.fees, [s]: v } }, {}, { [s]: v });

  // The card preview: the firm card as it stands.
  const preview: AdvisorFirm = useMemo(() => ({
    ...firm, name: a.name, firmType: a.type, city: a.city || null, country: a.country, yearFounded: a.year ? Number(a.year) : null,
    description: a.desc, services: a.services, dealBand: a.deal || null, teamSize: a.team ? Number(a.team) : null, languages: a.langs,
    logoUrl: a.logo.url, logoPath: a.logo.path, sectors: a.sectors, sectorAgnostic: a.agnostic, status: firm.status,
  }), [firm, a]);
  const previewBox = (
    <div className="mt-[18px] rounded-[12px] border border-[#E9EBF0] bg-[#EEF0F4] p-4 dark:border-border dark:bg-muted/40">
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]">{tr("Your card in Browse advisors")}</div>
      <div className="mx-auto max-w-[340px]"><FirmCard f={preview} preview /></div>
    </div>
  );

  // ---------------- styles ----------------
  const lbl = "mb-1.5 block text-[14px] font-semibold";
  const inp = "h-[50px] w-full rounded-[12px] border border-[#DCDFE5] bg-white px-3.5 text-[16px] outline-none focus:border-[#1E2A4A] dark:border-border dark:bg-background max-[380px]:pl-3 max-[380px]:pr-[30px]";
  const errCls = "!border-[#B42318]";
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const tile = (on: boolean) => cn("cursor-pointer rounded-[12px] border bg-white text-left transition-colors dark:bg-card",
    on ? "border-[#1E2A4A] bg-[#F4F6FA] shadow-[inset_0_0_0_1px_#1E2A4A] dark:bg-muted" : "border-[#DCDFE5] hover:bg-[#FAFBFC] dark:border-border");
  const tick = (on: boolean) => (
    <span className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border", on ? "border-[#1E2A4A] bg-[#1E2A4A] text-white" : "border-[#C9CED8] bg-white")}>{on && <Check className="h-3 w-3" />}</span>
  );
  const domain = normalizeUrl(a.web).replace(/^https?:\/\//, "").split("/")[0];
  const yearShown = (touched.name_row || forced.year || touched.year) ? errors.year : null;

  // ---------------- questions ----------------
  const Q: Record<WizardQ, { t: string; h: string; body: React.ReactNode; req: boolean }> = {
    type: { req: true, t: tr("Which type of firm best describes your business?"), h: tr("Sellers and buyers see it on your card, under your firm's name."),
      body: (
        <div role="radiogroup" aria-label={tr("Firm type")} className="grid gap-2.5 sm:grid-cols-2"
          onKeyDown={(e) => {
            const i = FIRM_TYPE_OPTIONS.findIndex((t) => t.value === (document.activeElement as HTMLElement)?.dataset.v);
            if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
              e.preventDefault();
              const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
              const n = (i + d + FIRM_TYPE_OPTIONS.length) % FIRM_TYPE_OPTIONS.length;
              (e.currentTarget.querySelector(`[data-v="${FIRM_TYPE_OPTIONS[n]!.value}"]`) as HTMLElement)?.focus();
            }
          }}>
          {FIRM_TYPE_OPTIONS.map((t, i) => {
            const on = a.type === t.value;
            return (
              <button key={t.value} type="button" role="radio" aria-checked={on} data-v={t.value} tabIndex={on || (!a.type && i === 0) ? 0 : -1}
                onClick={() => pickType(t.value)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); pickType(t.value); } }}
                className={cn(tile(on), "flex items-center gap-3 p-3.5")}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#E0F5F2] text-[#0F766E]"><t.icon className="h-5 w-5" /></span>
                <span className="min-w-0"><b className="block text-[15px] font-semibold">{t.value}</b><span className="block text-[13px] text-[#6B7280]">{t.line}</span></span>
              </button>
            );
          })}
          {forced.type && errors.type && <p className="text-[13px] text-[#B42318] sm:col-span-2">{errors.type}</p>}
        </div>
      ) },
    loc: { req: true, t: tr("Where is your firm based?"), h: tr("Sellers and buyers see your city on your card."),
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="w-country">{tr("Country")}<Req /></label>
            <select id="w-country" aria-required className={cn(inp, "pr-8")} value={COUNTRIES.includes(a.country) ? a.country : "Other"} onChange={(e) => changeCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="w-city">{thai ? "City / province" : tr("City")}<Req /></label>
            {thai ? (
              <select id="w-city" aria-required {...(errors.city ? { "data-need": "1" } : {})} className={cn(inp, "pr-8", errors.city && "need-fill", show("city") && errCls)} value={a.city} onBlur={blur("city")}
                onChange={(e) => {
                  const v = e.target.value;
                  const prov = !a.addr.province || a.addr.province === a.city ? v : a.addr.province;
                  set({ city: v, addr: { ...a.addr, province: prov } }, { city: v, addr_province: prov || null });
                }}>
                <option value="">{tr("Choose a province")}</option>
                {THAI_PROVINCES_77.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input id="w-city" aria-required {...(errors.city ? { "data-need": "1" } : {})} maxLength={80} placeholder="e.g. Singapore" className={cn(inp, errors.city && "need-fill", show("city") && errCls)} value={a.city} onBlur={blur("city")}
                onChange={(e) => set({ city: e.target.value }, { city: e.target.value || null, addr_district: e.target.value || null })} />
            )}
            <Err m={show("city")} />
          </div>
        </div>
      ) },
    name: { req: true, t: nameShort ? "What is your firm's name, registration number and business address?" : tr("What is the name of your firm?"),
      h: nameShort ? "Check that the name matches your firm's registration. Sellers and buyers see the address on your profile." : tr("Sellers and buyers see this name on your card. Use the name your clients know."),
      body: (
        <div>
          <div className={cn("grid gap-4", !hid("year", "name") && "sm:grid-cols-[1fr_150px]")}>
            <div>
              <label className={lbl} htmlFor="w-name">{tr("Firm name")}<Req /></label>
              <input id="w-name" data-f="name" aria-required maxLength={80} placeholder="e.g. Acme Advisory" className={cn(inp, errors.name && "need-fill", show("name") && errCls)} {...(errors.name ? { "data-need": "1" } : {})} value={a.name} onBlur={blur("name")}
                onChange={(e) => set({ name: e.target.value }, { name: e.target.value })} />
              <Err m={show("name")} />
            </div>
            {!hid("year", "name") && <div>
              <label className={lbl} htmlFor="w-year">{tr("Year founded")}<Req /></label>
              <input id="w-year" data-f="year" aria-required inputMode="numeric" maxLength={4} placeholder="e.g. 2014" className={cn(inp, yearShown && errCls)} value={a.year} onBlur={blur("year")}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); set({ year: v }, { year_founded: /^\d{4}$/.test(v) && !yearError(v) ? Number(v) : null }); }} />
            </div>}
          </div>
          <Err m={yearShown} />
          <div className="mt-4">
            <label className={lbl} htmlFor="w-reg">{thai ? <>{tr("Company Registration Number (เลขทะเบียนนิติบุคคล)")}<Req /></> : <>{tr("Company registration number")}<Opt /></>}</label>
            <input id="w-reg" data-f="reg" aria-required={thai} inputMode={thai ? "numeric" : undefined} maxLength={thai ? 13 : 50} placeholder={thai ? "13 digits" : undefined}
              className={cn(inp, errors.reg && "need-fill", show("reg") && errCls)} {...(errors.reg ? { "data-need": "1" } : {})}
              value={a.reg} onBlur={blur("reg")}
              onChange={(e) => { const v = thai ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value.slice(0, 50); set({ reg: v }, { registration_no: v || null }); }} />
            <Err m={show("reg")} />
            <p className="mt-2 flex gap-1.5 text-[13px] text-[#B42318]">
              <ShieldCheck className="mt-[1px] h-[15px] w-[15px] shrink-0" />
              <span><b className="font-semibold">{tr("Sellers and buyers look for advisers they can trust.")}</b>{" "}
                {thai ? "We verify your firm with this number, then show a Verified advisor badge on your card." : `Adding your registration number in ${a.country === "Other" ? "your country" : a.country} helps us verify your firm.`}</span>
            </p>
          </div>
          <div className="mt-6">
            <AddressBox need a={a.addr} thai={thai} city={a.city} note={tr("Sellers and buyers see it on your profile as a link that opens a map.")}
              onCity={(v) => set({ city: v }, { city: v || null, addr_district: v || null })} onChange={setAddr}
              show={(k) => show(`a-${k}`)} onBlur={(k) => setTouched((t) => ({ ...t, [`a-${k}`]: true }))} />
          </div>
        </div>
      ) },
    web: { req: true, t: tr("What is your firm's website?"), h: tr("We use it to fill in your profile. Sellers and buyers can open it from your profile."),
      body: (
        <div>
          <label className={lbl} htmlFor="w-web">{tr("Website URL")}<Req /></label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input id="w-web" aria-required maxLength={200} placeholder="https://www.yourfirm.com" className={cn(inp, "flex-1", (touched.webTyped || forced.web) && errors.web && errCls)} value={a.web}
              onChange={(e) => { setTouched((t) => ({ ...t, webTyped: true })); setWebOpened(null); set({ web: e.target.value }, { website: e.target.value || null }); }} />
            <button type="button" disabled={!isValidUrl(a.web)} onClick={() => { window.open(normalizeUrl(a.web), "_blank", "noopener"); setWebOpened(domain); }}
              className="inline-flex h-[50px] items-center justify-center gap-1.5 rounded-[12px] border border-[#DCDFE5] bg-white px-4 text-[15px] font-semibold text-[#434A5C] disabled:opacity-40 dark:border-border dark:bg-background dark:text-foreground">
              <ExternalLink className="h-4 w-4" /> Check website
            </button>
          </div>
          {(touched.webTyped && a.web.trim() || forced.web) && errors.web ? <p className="mt-1.5 text-[13px] text-[#B42318]">{errors.web}</p>
            : webOpened ? <p className="mt-1.5 flex items-center gap-1 text-[13px] text-[#15803D]"><Check className="h-3.5 w-3.5" />Opened {webOpened} in a new tab. Make sure it is your firm.</p>
            : <p className="mt-1.5 text-[13px] text-[#6B7280]">{tr("Click Check website to open it in a new tab and make sure it is your firm.")}</p>}
        </div>
      ) },
    services: { req: true, t: tr("Which professional services does your firm provide?"), h: tr("Pick all that apply, and say how you charge for each. Sellers and buyers filter Browse advisors by these, and see every fee on your profile."),
      body: (
        <div>
          {feeNote && feeNote.length > 0 && (
            <p className="mb-3 flex gap-2 rounded-[10px] bg-[#F3F4F6] px-3.5 py-2.5 text-[13px] text-[#434A5C] dark:bg-muted dark:text-muted-foreground">
              <Info className="mt-[1px] h-4 w-4 shrink-0" />
              We've ticked the usual service{feeNote.length > 1 ? "s" : ""} for {article(a.type)} {a.type.toLowerCase()}: {feeNote.join(" and ")}. Add the others you offer.
            </p>
          )}
          <div className="grid items-start gap-2.5 sm:grid-cols-2">
            {ADVISOR_SERVICES.map((s) => {
              const on = a.services.includes(s.name);
              return (
                <div key={s.name} className={cn(tile(on), "p-3.5")}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleService(s.name)} />
                    <span className="mt-2.5">{tick(on)}</span>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#E0F5F2] text-[#0F766E]"><s.icon className="h-5 w-5" /></span>
                    <span className="min-w-0"><b className="block text-[15px] font-semibold">{s.name}</b><span className="block text-[13px] text-[#6B7280]">{s.line}</span></span>
                  </label>
                  {on && (
                    <div className="mt-3 border-t border-[#D5DAE6] pt-3 dark:border-border" onClick={(e) => e.stopPropagation()}>
                      <FeeControl service={s.name} value={a.fees[s.name] ?? newFee()} autoFocus={focusFee === s.name} showErr={!!touched[`fee-${s.name}`]}
                        onBlurAll={blur(`fee-${s.name}`)} onChange={(v) => setFee(s.name, v)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-[#6B7280]"><b className="text-[#151A28] dark:text-foreground">{a.services.length}</b> selected</p>
          {forced.services && errors.services === "Pick at least one service." && <Err m={errors.services} />}
          <p className="mt-3 flex gap-2 rounded-[10px] bg-[#F3F4F6] px-3.5 py-2.5 text-[13px] text-[#434A5C] dark:bg-muted dark:text-muted-foreground">
            <Info className="mt-[1px] h-4 w-4 shrink-0" />
            Each service you tick starts on Request a Price Quote. To show a price, pick how you charge and type only the number. If none of the types fits, choose Other and write it in up to 80 characters.
          </p>
        </div>
      ) },
    deal: { req: false, t: tr("What deal values do you typically advise on, in $USD?"), h: tr("The value of the companies you usually help sell, buy or value. Sellers and buyers see this range on your card."),
      body: (
        <div className="sm:w-1/2">
          <label className={lbl} htmlFor="w-deal">{tr("Typical deal size")}<Opt /></label>
          <select id="w-deal" className={cn(inp, "pr-8")} value={a.deal} onChange={(e) => { setHint(null); set({ deal: e.target.value }, { deal_size_band: e.target.value || null }); }}>
            <option value="">{tr("Choose a range")}</option>
            {DEAL_BANDS.map((b) => <option key={b.key} value={b.key}>{dealBandLabels(b.key)!.full}</option>)}
          </select>
          {a.deal && <p className="mt-2 text-[13.5px] text-[#6B7280]">{tr("Your card shows")} <b className="text-[#151A28] dark:text-foreground">{dealBandLabels(a.deal)!.usd}</b> ({dealBandLabels(a.deal)!.thb}).</p>}
          {hint && <p className="mt-2 text-[13px] text-[#6B7280]">{hint}</p>}
        </div>
      ) },
    sectors: { req: true, t: tr("Which sectors do you know best?"), h: tr("Pick up to 5, or Sector agnostic if you work across every industry. Sellers and buyers see them on your card."),
      body: (
        <SetSectorPicker mode="multi" value={a.sectors} onChange={(v) => set({ sectors: v }, { sectors: v })}
          limitMsg={tr("Pick up to 5 sectors, or Sector agnostic.")}
          agnostic={{ on: a.agnostic, onToggle: (on) => set({ agnostic: on }, { sector_agnostic: on }), line: tr("I work with companies in every industry"),
            summary: <>{tr("Sellers and buyers see")} <b className="text-[#151A28] dark:text-foreground">{tr("Sector agnostic")}</b> on your card.</> }}
          error={forced.sectors ? errors.sectors : null} />
      ) },
    team: { req: true, t: hid("team", "team") ? "Which languages do you work in?" : tr("What is your company size?"),
      h: hid("team", "team") ? "Sellers and buyers see them on your card." : tr("Sellers and buyers see your team size on your card, and the languages you work in."),
      body: (
        <div>
          {!hid("team", "team") && <>
          <label className={lbl} htmlFor="w-team">{tr("Team size")}<Req /></label>
          <div className="flex items-center gap-2.5">
            <input id="w-team" aria-required inputMode="numeric" maxLength={5} placeholder="e.g. 8" className={cn(inp, "w-[150px]", show("team") && errCls)} value={a.team} onBlur={blur("team")}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 5); set({ team: v }, { team_size: Number(v) >= 1 ? Number(v) : null }); }} />
            <span className="text-[15px] text-[#434A5C] dark:text-muted-foreground">people</span>
          </div>
          <Err m={show("team")} />
          </>}
          <div className={hid("team", "team") ? "" : "mt-5"}>
            <div className={lbl}>{tr("Languages you work in")}<Req /><span className="ml-1.5 font-normal text-[#9CA3AF]">pick at least one</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LANGUAGES.map((l) => {
                const on = a.langs.includes(l);
                return (
                  <label key={l} className={cn(tile(on), "flex h-[50px] items-center gap-2.5 px-3.5 text-[15px]")}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => { const v = on ? a.langs.filter((x) => x !== l) : [...a.langs, l]; set({ langs: v }, { languages: v }); }} />
                    {tick(on)}{l}
                  </label>
                );
              })}
            </div>
            {forced.langs && <Err m={errors.langs} />}
          </div>
        </div>
      ) },
    contact: { req: true, t: tr("How can sellers and buyers reach you?"), h: tr("Your email and phone show on your profile, so sellers and buyers can contact you directly."),
      body: (
        <div className="space-y-4">
          <div>
            <label className={lbl} htmlFor="w-email">{tr("Email")}<Req /></label>
            <input id="w-email" aria-required type="email" maxLength={120} placeholder="hello@yourfirm.com" className={cn(inp, show("email") && errCls)} value={a.email} onBlur={blur("email")}
              onChange={(e) => set({ email: e.target.value }, { email: e.target.value || null })} />
            {show("email") ? <Err m={show("email")} /> : <p className="mt-1.5 text-[13px] text-[#6B7280]">{tr("Use a shared inbox, such as hello@ or deals@, so every enquiry reaches your team.")}</p>}
          </div>
          <div>
            <label className={lbl} htmlFor="w-phone">{tr("Phone")}<Req /></label>
            <input id="w-phone" aria-required maxLength={30} placeholder="+66 2 123 4567" className={cn(inp, show("phone") && errCls)} value={a.phone} onBlur={blur("phone")}
              onChange={(e) => set({ phone: e.target.value }, { phone: e.target.value || null })} />
            <Err m={show("phone")} />
          </div>
        </div>
      ) },
    logo: { req: false, t: tr("Attach your company's logo"), h: tr("Sellers and buyers see it on your card. A square PNG, JPG or SVG works best, up to 2 MB."),
      body: (
        <div>
          <LogoDrop logo={a.logo} busy={logoBusy} error={logoErr} onFile={onLogo}
            onRemove={() => set({ logo: { path: null, url: null, name: null, sizeKb: null, source: null } }, { logo_path: null, logo_source: null })} />
          {hint && <p className="mt-2 text-[13px] text-[#6B7280]">{hint}</p>}
          {previewBox}
        </div>
      ) },
    desc: { req: true, t: tr("How would you describe your firm?"), h: tr("Sellers and buyers read it on your card, which shows the first 3 lines."),
      body: (
        <div>
          <label className={lbl} htmlFor="w-desc">{tr("Description")}<Req /><span className="ml-1.5 font-normal text-[#9CA3AF]">30 to 300 characters</span></label>
          <textarea id="w-desc" aria-required rows={4} maxLength={300} placeholder="e.g. Corporate law firm helping Thai founders sell their companies, from due diligence to signing."
            className={cn(inp, "h-auto py-3", forced.desc && errors.desc && errCls)} value={tr(a.desc)}
            onChange={(e) => set({ desc: e.target.value }, { description: e.target.value || null })} />
          <div className="mt-1 flex justify-between text-[12.5px]">
            <span className="text-[#B42318]">{(forced.desc || (touched.desc && a.desc.trim())) && errors.desc}</span>
            <span className="text-[#6B7280]">{a.desc.length} / 300</span>
          </div>
          {previewBox}
        </div>
      ) },
    review: { req: false, t: tr("Review your answers"), h: tr("Check them, then we'll fill in the rest of your profile."),
      body: <Review a={a} errors={errors} onEdit={(id) => { setFromReview(true); setFull(id); goTo(id); }} /> },
  };
  const q = Q[cur];
  const continueLabel = cur === "review" ? "Continue to auto-fill" : fromProfile && cur === "services" ? "Back to your profile" : fromReview ? "Back to review" : tr("Continue");
  const continueOk = cur === "review" ? requiredOk : qValid(cur);
  const optional = cur === "deal" || cur === "logo";

  // ---------------- layout ----------------
  const topBar = (
    <div className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-[#E9EBF0] bg-white px-5 dark:border-border dark:bg-card">
      <button type="button" onClick={exit} aria-label={tr("Save & exit")} className="cursor-pointer"><img src={logoBlack} alt="PitchSnack" className="h-6 w-auto dark:invert" /></button>
      <span className="h-5 w-px bg-[#E9EBF0] dark:bg-border" />
      <span className="text-[13.5px] font-semibold text-[#434A5C] dark:text-muted-foreground"><span className="hidden sm:inline">{tr("Firm Profile")} </span>{tr("Setup Wizard")}</span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
        {saving === "saving" ? <><span className="h-2 w-2 rounded-full bg-[#F6A823]" />{tr("Saving…")}</>
          : saving === "saved" ? <><Check className="h-3.5 w-3.5 text-[#15803D]" />{tr("Draft saved")}</>
          : saving === "failed" ? <><span className="text-[#B42318]">{tr("Not saved")}</span><button type="button" className="font-semibold text-[#1E2A4A] underline dark:text-foreground" onClick={() => void flush()}>{tr("Retry")}</button></> : null}
      </span>
      <div className="relative">
        <button type="button" onClick={exit} disabled={exiting} aria-label={tr("Save & exit")} title={tr("Save & exit")}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-[#DCDFE5] bg-white text-[#434A5C] hover:bg-[#F6F7F9] disabled:cursor-wait disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground">
          {exiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
        {leaveOpen && <LeavePopover onKeep={() => setLeaveOpen(false)} onLeave={() => { setLeaveOpen(false); setDirtyForm(null); void leave(false); }} />}
      </div>
    </div>
  );
  const header = (sec: string, right: string, pct: number) => (
    <>
      <div className="flex items-baseline justify-between text-[15px]"><b className="font-semibold text-[#151A28] dark:text-foreground">{sec}</b><span className="text-[#6B7280]">{right}</span></div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-muted"><i className="block h-full bg-[#1E2A4A] transition-[width] duration-300 dark:bg-[#818CF8]" style={{ width: `${pct}%` }} /></div>
    </>
  );
  const card = "mt-[22px] rounded-[14px] border border-[#E9EBF0] bg-white px-[18px] pb-5 pt-6 sm:mt-[34px] sm:rounded-[16px] sm:p-10 max-[380px]:px-[14px] dark:border-border dark:bg-card";
  const btnO = "cursor-pointer h-[50px] rounded-[12px] border border-[#DCDFE5] bg-white px-5 text-[16px] font-semibold text-[#434A5C] disabled:opacity-40 dark:border-border dark:bg-background dark:text-foreground";
  const btnP = "cursor-pointer h-[50px] rounded-[12px] bg-[#1E2A4A] px-6 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#CACED8]";

  useFocusNeeded(qRef, `${phase}:${cur}`);
  const sources: Partial<Record<keyof FirmForm | "addr", SourceTag>> = {
    name: "Your answer", firmType: "Your answer", country: "Your answer", city: "Your answer", yearFounded: "Your answer", description: "Your answer",
    fees: "Your answer", dealBand: "Your answer", teamSize: "Your answer", languages: "Your answer", registrationNo: "Your answer",
    website: "Your answer", email: "Your answer", phone: "Your answer", addr: "Your answer", logo: "Your answer",
    ...(enrich?.legalName ? { legalName: tr("Company registry") as SourceTag } : {}), ...(enrich?.thaiName ? { thaiName: tr("Company registry") as SourceTag } : {}),
  };
  const liveFirm = qc.getQueryData<AdvisorFirm[]>(ADVISOR_FIRMS_KEY)?.find((x) => x.id === firm.id) ?? firm;

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#151A28] dark:bg-background dark:text-foreground" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }} onKeyDown={onKeyDown}>
      {topBar}
      {phase === "q" && (
        <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
          {header(tr(SECTION[cur]), `Step ${idx + 1} of ${shown.length}`, ((idx + 1) / shown.length) * 100)}
          <div className={card} ref={cardRef}>
            <div key={cur} ref={qRef} className="animate-in fade-in duration-200">
              <h1 className="text-[21px] font-bold leading-snug sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>
                {tr(q.t)}{q.req && <>{"\u00a0"}<span className="text-[#B42318]" aria-hidden>*</span><span className="sr-only">, required</span></>}
              </h1>
              <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">{tr(q.h)}</p>
              {q.body}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <button type="button" className={btnO} disabled={idx === 0} onClick={back}>{tr("Back")}</button>
              {optional && <button type="button" className="px-2 text-[15px] font-medium text-[#434A5C] hover:underline dark:text-muted-foreground" onClick={skip}>{tr("Skip")}</button>}
              <div className="flex w-full gap-2.5 sm:ml-auto sm:w-auto">
                <button type="button" className={`${btnO} flex-1 hover:bg-[#F6F7F9] sm:flex-none`} disabled={exiting} onClick={() => void leave(true)}>{tr("Save &amp; exit")}</button>
                <button type="button" className={`${btnP} flex-1 sm:flex-none`} disabled={!continueOk && !optional} onClick={tryContinue}>{continueLabel}</button>
              </div>
            </div>
          </div>
          <p className="mt-[18px] text-center text-[14px] text-[#6B7280]">{tr("Everything you add here is open to sellers and buyers on PitchSnack, so they can compare firms and choose one.")}</p>
        </div>
      )}
      {phase === "enrich" && (
        <Enrich firm={firm} a={a} header={header} card={card} btnO={btnO} btnP={btnP}
          onBack={() => { setPhase("q"); goTo("review"); }} onExit={() => void leave(true)}
          onDone={(r) => { setEnrich(r); void qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY }).then(() => setPhase("complete")); }} />
      )}
      {phase === "complete" && (
        <div className="mx-auto max-w-[880px] px-4 pb-16 pt-8 sm:pt-10">
          {header(tr("Review & complete"), tr("Last step"), 100)}
          <div className="mt-[22px] sm:mt-[34px]">
            <h1 className="text-[21px] font-bold sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>{tr("Check your profile and save it")}</h1>
            <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">{tr("Your answers and what Auto Enrich found are filled in. Change anything you need, and add your team, licences and documents.")}</p>
            <FirmEditForm firm={liveFirm} initial={dirtyForm ? { ...dirtyForm, services: a.services, fees: Object.fromEntries(a.services.map((s) => [s, a.fees[s] ?? newFee()])) } : null}
              setup={{
                sources,
                onBack: () => { setPhase("q"); goTo("review"); },
                onChangeServices: () => { setFromProfile(true); setPhase("q"); goTo("services"); },
                onDirty: setDirtyForm,
                onSaved: (msg) => { toast.success(msg); void navigate({ to: "/marketplace/my-company", search: { open: firm.id } as never }); },
              }} />
          </div>
        </div>
      )}
    </div>
  );
}

function LeavePopover({ onKeep, onLeave }: { onKeep: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onKeep(); };
    const c = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onKeep(); };
    window.addEventListener("keydown", k);
    const t = window.setTimeout(() => window.addEventListener("mousedown", c), 0);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("mousedown", c); window.clearTimeout(t); };
  }, [onKeep]);
  return (
    <div ref={ref} role="dialog" aria-label={tr("Leave without saving this page?")} className="absolute right-0 top-11 z-30 w-[300px] rounded-[14px] border border-[#E9EBF0] bg-white p-4 shadow-xl dark:border-border dark:bg-card">
      <div className="text-[15px] font-semibold">{tr("Leave without saving this page?")}</div>
      <p className="mt-1 text-[13px] text-[#6B7280]">{tr("Your answers are saved. Changes on this page aren't.")}</p>
      <div className="mt-3.5 flex justify-end gap-2">
        <button type="button" autoFocus onClick={onKeep} className="h-9 rounded-[10px] border border-[#DCDFE5] bg-white px-3.5 text-[13.5px] font-semibold text-[#434A5C] dark:border-border dark:bg-background dark:text-foreground">{tr("Keep editing")}</button>
        <button type="button" onClick={onLeave} className="h-9 rounded-[10px] bg-[#1E2A4A] px-3.5 text-[13.5px] font-semibold text-white">{tr("Leave")}</button>
      </div>
    </div>
  );
}

function Review({ a, errors, onEdit }: { a: A; errors: Record<string, string | null>; onEdit: (id: WizardQ) => void }) {
  const thai = a.country === "Thailand";
  const miss = <b className="font-semibold text-[#B42318]">{tr("Missing")}</b>;
  const notSet = <span className="text-[#9CA3AF]">{tr("Not set")}</span>;
  const addrOk = !errors["a-street"] && !errors["a-district"] && !errors["a-province"] && !errors["a-postal"];
  const addrLine = fullAddress({ addrStreet: a.addr.street, addrUnit: a.addr.unit, addrDistrict: thai ? a.addr.district : a.city, addrProvince: a.addr.province, addrPostal: a.addr.postal, country: a.country, city: a.city });
  const deal = dealBandLabels(a.deal);
  type Row = [string, React.ReactNode, WizardQ];
  const groups: [string, Row[]][] = [
    [tr("About the firm"), [
      [tr("Firm type"), a.type || miss, "type"],
      [tr("Based in"), a.city ? `${a.city}, ${a.country}` : miss, "loc"],
      [tr("Firm name"), errors.name ? miss : a.name, "name"],
      [tr("Year founded"), errors.year ? miss : a.year, "name"],
      [tr("Registration number"), a.reg || (thai ? miss : notSet), "name"],
      [tr("Business address"), addrOk && addrLine ? addrLine : miss, "name"],
      [tr("Website"), errors.web ? miss : a.web, "web"],
    ]],
    [tr("Services and fees"), [
      [tr("Services"), a.services.length ? a.services.join(", ") : miss, "services"],
      ...a.services.map((s): Row => [s, feeWords(a.fees[s] ?? newFee()) ? <span>{nowrapPct(feeWords(a.fees[s]!)!)}</span> : miss, "services"]),
    ]],
    [tr("Your work"), [
      [tr("Typical deal size"), deal ? deal.full : notSet, "deal"],
      [tr("Team size"), errors.team ? miss : `${a.team} people`, "team"],
      [tr("Languages"), a.langs.length ? a.langs.join(", ") : miss, "team"],
      [tr("Sectors"), a.agnostic ? "Sector agnostic" : a.sectors.length ? a.sectors.join(", ") : miss, "sectors"],
    ]],
    [tr("Contact"), [[tr("Email"), errors.email ? miss : a.email, "contact"], [tr("Phone"), errors.phone ? miss : a.phone, "contact"]]],
    [tr("Your card"), [
      [tr("Logo"), a.logo.url ? <span className="inline-flex items-center gap-2"><img src={a.logo.url} alt="" className="h-7 w-7 rounded border border-[#E3E6EB] bg-white object-contain" />{a.logo.source === "enrich" ? "Found on your website" : a.logo.name ?? tr("Your logo")}</span> : notSet, "logo"],
      [tr("Description"), !a.desc.trim() ? miss : errors.desc ? <b className="font-semibold text-[#B42318]">{tr("Needs a fix")}</b> : <span className="line-clamp-3">{tr(a.desc)}</span>, "desc"],
    ]],
  ];
  return (
    <div className="space-y-5">
      {groups.map(([g, rows]) => (
        <div key={g}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.07em] text-[#151A28] dark:text-foreground">{g}</div>
          <div className="rounded-[12px] border border-[#E9EBF0] dark:border-border">
            {rows.map(([l, v, id], i) => (
              <div key={`${l}-${i}`} className="flex items-start gap-3 border-b border-[#F0F1F4] px-4 py-2.5 text-[14px] last:border-0 dark:border-border">
                <span className="w-[170px] shrink-0 text-[#6B7280] max-sm:w-[110px]">{l}</span>
                <span className="min-w-0 flex-1 break-words">{v}</span>
                <button type="button" onClick={() => onEdit(id)} className="shrink-0 font-semibold text-[#1E2A4A] hover:underline dark:text-foreground">{tr("Edit")}</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type HeaderFn = (sec: string, right: string, pct: number) => React.ReactNode;
function Enrich({ firm, a, header, card, btnO, btnP, onBack, onExit, onDone }: {
  firm: AdvisorFirm; a: A; header: HeaderFn; card: string; btnO: string; btnP: string; onBack: () => void; onExit: () => void; onDone: (r: AdvisorEnrichResult | null) => void;
}) {
  const run = useServerFn(enrichAdvisorFirm);
  const domain = normalizeUrl(a.web).replace(/^https?:\/\//, "").split("/")[0];
  const thaiReg = a.country === "Thailand" && /^\d{13}$/.test(a.reg);
  const sig = `${normalizeUrl(a.web)}|${a.reg}|${a.name}`;
  const cached = (firm.wizard as { enrichSig?: string; enrich?: AdvisorEnrichResult });
  const reuse = cached.enrichSig && cached.enrich && cached.enrichSig === `${a.web}|${a.reg}|${a.name}` ? cached.enrich : null;
  const [res, setRes] = useState<AdvisorEnrichResult | null>(reuse);
  const [step, setStep] = useState(reuse ? 9 : 0); // which source row is reading
  const done = step >= 9;
  useEffect(() => {
    if (reuse) return;
    let off = false;
    const t1 = window.setTimeout(() => !off && setStep((s) => Math.max(s, 1)), 900);
    run({ data: { id: firm.id } })
      .then((r) => { if (!off) { setRes(r); setStep(9); } })
      .catch(() => { if (!off) setStep(9); });
    return () => { off = true; window.clearTimeout(t1); };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows: { icon: React.ReactNode; t: string; sub: string; found: string | null; show: boolean }[] = [
    { icon: <Globe className="h-4 w-4" />, t: tr("Your website"), sub: domain, found: res?.logo ? "Logo" : null, show: true },
    { icon: <Landmark className="h-4 w-4" />, t: tr("Company registry"), sub: `Registration ${a.reg}`, found: [res?.legalName && tr("Legal name"), res?.thaiName && tr("Thai name")].filter(Boolean).join(" and ") || null, show: thaiReg },
    { icon: <Newspaper className="h-4 w-4" />, t: tr("News"), sub: tr("Recent deals and press"), found: null, show: true },
  ].filter((r) => r.show);
  const n = res?.found ?? 0;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" && done && !(e.target as HTMLElement).closest("button")) onDone(res); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [done, res, onDone]);
  return (
    <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
      {header(tr("Auto Enrich"), tr("Almost done"), 100)}
      <div className={card}>
        <h1 className="text-[21px] font-bold sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>{done ? "Your profile is filled in" : tr("Filling in your profile")}</h1>
        <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">
          {!done ? `We're reading ${domain} and public records. This takes a few seconds.` : n ? `We found ${n} detail${n === 1 ? "" : "s"}. Check them in the next step.` : tr("Nothing new to add. Check your profile in the next step.")}
        </p>
        <div className="rounded-[12px] border border-[#E9EBF0] dark:border-border">
          {rows.map((r, i) => (
            <div key={tr(r.t)} className="flex items-center gap-3 border-b border-[#F0F1F4] px-4 py-3 last:border-0 dark:border-border">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#F3F4F6] text-[#6B7280] dark:bg-muted">{r.icon}</span>
              <div className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold">{tr(r.t)}</b><span className="text-[12.5px] text-[#6B7280]">{tr(r.sub)}</span></div>
              {done ? (r.found ? <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15803D]"><Check className="h-4 w-4" />{r.found}</span>
                : <span className="inline-flex items-center gap-1 text-[13px] text-[#6B7280]"><X className="h-4 w-4" />{tr("Nothing new found")}</span>)
                : i <= step ? <span className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280]"><Loader2 className="h-4 w-4 animate-spin" />{tr("Reading…")}</span>
                : <span className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF]"><Circle className="h-4 w-4 [stroke-dasharray:3_3]" />{tr("Waiting")}</span>}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          <button type="button" className={btnO} onClick={onBack}>{tr("Back to answers")}</button>
          <div className="flex w-full gap-2.5 sm:ml-auto sm:w-auto">
            <button type="button" className={`${btnO} flex-1 sm:flex-none`} onClick={onExit}>{tr("Save &amp; exit")}</button>
            <button type="button" className={`${btnP} flex-1 sm:flex-none`} disabled={!done} onClick={() => onDone(res)}>{tr("Review &amp; complete")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
