import { useFocusNeeded } from "@/components/common/need-fill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Info, Loader2, Lock, ShieldCheck, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import logoBlack from "@/assets/pitchsnack-black.png";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { PublicInvestorCard, TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { typeTone } from "@/lib/buyer-profile";
import { normalizeUrl, isValidUrl } from "@/lib/seller-wizard";
import { saveBuyerWizard } from "@/lib/buyer-investor.functions";
import { investorEnrichAdapter, type EnrichInvestorResult } from "@/lib/auto-enrich/investor-enrich-adapter";
import { BUYER_INVESTOR_KEY, BuyerInvestorForm, type Data, type SourceTag } from "@/components/my-business/buyer-investor-edit";
import {
  AUM_BANDS, COUNTRIES, DEAL_TYPES, GEOGRAPHY, INDIVIDUAL_TYPE, REV_BANDS, SECTOR_AGNOSTIC, STAGE_OPTIONS, THAI_PROVINCES_77,
  TICKET_BANDS, WIZARD_TYPES, ALL_TYPES, sortActsFor, typeLabel, bandText, descriptionError, descriptionLeaks, regError, showsStages, typeName, yearError,
  type Band,
} from "@/lib/investor-bands";
import { isCorporateBuyer } from "@/lib/investor-browse";
import { stepsFor, buyerSkips, buyerHiddenFields, buyerProgress, type BuyerRelation, type QId } from "@/lib/buyer-wizard";

type A = {
  role: BuyerRelation | null; type: string; country: string; city: string; name: string; year: string; reg: string; web: string;
  aum: string; ticket: string; rev: string; deals: string[]; stages: string[]; geo: string[]; sectors: string[]; desc: string;
  /** A representative's investor types (list order; the first is Investor Classification). */
  acts: string[];
};

const ROLES: { value: BuyerRelation; label: string; hint: string }[] = [
  { value: "individual", label: "Individual Investor", hint: "I am a sophisticated investor. I invest my own money." },
  { value: "corporate", label: "Corporate Enterprise", hint: "My company invests in or buys businesses." },
  { value: "agent", label: "Authorised representative / adviser", hint: "I am acting on behalf of the buyer." },
];

const inp = "h-[50px] w-full rounded-[12px] border border-[#DCDFE5] bg-white px-4 text-[16px] text-[#151A28] outline-none focus:border-[#1E2A4A] focus:shadow-[0_0_0_3px_rgba(30,42,74,.12)] dark:border-border dark:bg-background dark:text-foreground";
const errCls = "!border-[#B42318]";
const lbl = "mb-[7px] block text-[13.5px] font-semibold text-[#434A5C] dark:text-muted-foreground";
const Req = () => <span aria-hidden className="relative -top-0.5 ml-[3px] text-[12px] font-semibold text-[#B42318]">*</span>;
const Opt = () => <span className="ml-1.5 font-normal text-[#9CA3AF]">optional</span>;
const Err = ({ m }: { m: string | null | false | undefined }) => (m ? <p className="mt-1.5 text-[13px] text-[#B42318]">{m}</p> : null);

function fromData(d: Data): A {
  const inv = d.investor;
  return {
    role: d.buyer.relation, type: inv.investor_type ?? "", country: inv.country ?? "Thailand", city: inv.city ?? "",
    name: inv.investor_name ?? "", year: inv.year_founded?.toString() ?? "", reg: inv.registration_no ?? "", web: inv.website_url ?? "",
    aum: inv.aum_band ?? "", ticket: inv.ticket_band ?? "", rev: inv.revenue_min_band ?? "",
    deals: d.buyer.deal_types, stages: inv.preferred_stages, geo: inv.investment_focus_raw, sectors: inv.preferred_industries, desc: d.buyer.description,
    acts: d.buyer.relation === "agent" ? sortActsFor(inv.acts_for_types?.length ? inv.acts_for_types : inv.investor_type ? [inv.investor_type] : []) : [],
  };
}

function Choice({ list, value, onPick, cols, icon }: {
  list: { value: string; label: string; hint?: string; extra?: string }[]; value: string; onPick: (v: string) => void; cols?: boolean; icon?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (d) { e.preventDefault(); refs.current[(i + d + list.length) % list.length]?.focus(); }
  };
  return (
    <div role="radiogroup" className={cols ? "grid gap-2.5 sm:grid-cols-2" : "grid gap-2.5"}>
      {list.map((o, i) => {
        const sel = value === o.value;
        const tone = icon ? typeTone(o.value) : null;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={sel}
            onClick={() => onPick(o.value)} onKeyDown={(e) => onKey(e, i)}
            className={`flex min-h-[50px] items-center gap-3.5 rounded-[12px] border px-4 py-3 text-left transition-colors ${sel ? "border-[#1E2A4A] bg-[#EEF1F7] dark:bg-[#1B2140]" : "border-[#DCDFE5] bg-white hover:border-[#C3C8D2] dark:border-border dark:bg-background"}`}>
            {icon && tone ? (
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-[10px] ${tone.bg} ${tone.fg}`}><TypeIcon type={o.value} className="h-5 w-5" /></span>
            ) : (
              <span className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] ${sel ? "border-[#1E2A4A]" : "border-[#C3C8D2]"}`}>
                {sel && <span className="h-2 w-2 rounded-full bg-[#1E2A4A]" />}
              </span>
            )}
            <span>
              <b className="block text-[15px] font-semibold">{o.label}{o.extra && <span className="ml-1.5 font-normal text-[#6B7280]">({o.extra})</span>}</b>
              {o.hint && <small className="mt-0.5 block text-[13px] text-[#6B7280]">{o.hint}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Checks({ title, note, req, items, value, onChange }: { title: string; note: string; req?: boolean; items: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div className="mb-2.5 text-[14px] font-semibold">{title}{req && <Req />} <span className="ml-1 text-[12.5px] font-normal text-[#9CA3AF]">{note}</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((it) => {
          const on = value.includes(it);
          const m = it.match(/^(.*?)( \(.*\))$/);
          return (
            <button key={it} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(on ? value.filter((x) => x !== it) : [...value, it])}
              className={`flex min-h-[46px] items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-[13.5px] ${on ? "border-[#1E2A4A] bg-[#EEF1F7] dark:bg-[#1B2140]" : "border-[#DCDFE5] bg-white hover:border-[#C3C8D2] dark:border-border dark:bg-background"}`}>
              <span className={`grid h-4 w-4 flex-none place-items-center rounded border-[1.5px] text-white ${on ? "border-[#1E2A4A] bg-[#1E2A4A]" : "border-[#C3C8D2]"}`}>{on && <Check className="h-3 w-3" />}</span>
              <span>{m ? <>{m[1]}<span className="text-[#9CA3AF]">{m[2]}</span></> : it}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tick-box type cards (a representative's question 2): all seven types, two columns, nothing moves on by itself. */
function TypeTicks({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div role="group" aria-label="Investor types" className="grid gap-2.5 sm:grid-cols-2">
      {ALL_TYPES.map((o) => {
        const on = value.includes(o.value);
        const tone = typeTone(o.value);
        return (
          <button key={o.value} type="button" role="checkbox" aria-checked={on}
            onClick={() => onChange(sortActsFor(on ? value.filter((x) => x !== o.value) : [...value, o.value]))}
            className={`flex min-h-[50px] items-center gap-3.5 rounded-[12px] border px-4 py-3 text-left transition-colors ${on ? "border-[#1E2A4A] bg-[#EEF1F7] dark:bg-[#1B2140]" : "border-[#DCDFE5] bg-white hover:border-[#C3C8D2] dark:border-border dark:bg-background"}`}>
            <span className={`grid h-10 w-10 flex-none place-items-center rounded-[10px] ${tone.bg} ${tone.fg}`}><TypeIcon type={o.value} className="h-5 w-5" /></span>
            <span className="flex-1"><b className="block text-[15px] font-semibold">{o.label}</b><small className="mt-0.5 block text-[13px] text-[#6B7280]">{o.hint}</small></span>
            <span className={`grid h-5 w-5 flex-none place-items-center rounded-[6px] border-2 ${on ? "border-[#1E2A4A] bg-[#1E2A4A] text-white" : "border-[#C3C8D2]"}`}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
          </button>
        );
      })}
    </div>
  );
}

const bandList = (bands: Band[]) => bands.map((b) => ({ value: b.key, label: b.label, extra: b.baht }));

export function BuyerSetupWizard({ data, startAt }: { data: Data; startAt?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveBuyerWizard);
  const live = data.buyer.status === "live";
  const setupDone = !!data.investor.setup_done_at;
  const [a, setA] = useState<A>(() => fromData(data));
  const [answered, setAnswered] = useState<string[]>(data.investor.wizard?.answered ?? []);
  const [peTicked, setPeTicked] = useState(!!data.investor.wizard?.pe_ticked);
  const fromSignup = data.investor.wizard?.from_signup;
  const skipOf = (x: A) => buyerSkips(fromSignup, { role: x.role, type: x.type, web: x.web, year: x.year, name: x.name, actsFor: x.acts });
  const skipSet = skipOf(a);
  // A question opened from Review shows all its fields under its full title.
  const [full, setFull] = useState<QId | null>(null);
  const stepsAll = useMemo(() => stepsFor(a.role), [a.role]);
  const [cur, setCur] = useState<QId>(() => {
    if (startAt === "deal") return "rev";
    if (startAt && stepsAll.some((s) => s.id === startAt)) return startAt as QId;
    return buyerProgress(data.buyer.relation, data.investor.wizard?.answered, skipOf(fromData(data))).first as QId;
  });
  const steps = stepsAll.filter((s) => !skipSet.has(s.id) || s.id === full || s.id === cur);
  const hiddenF = full === "name" ? new Set<string>() : buyerHiddenFields(fromSignup, { role: a.role, type: a.type, web: a.web, year: a.year, name: a.name });
  const nameShort = !!fromSignup?.includes("name") && full !== "name";
  const nextAfter = (x: A, from: QId): QId => {
    const all = stepsFor(x.role); const sk = skipOf(x);
    const i = all.findIndex((s) => s.id === from);
    return all.slice(i + 1).find((s) => !sk.has(s.id))?.id ?? "review";
  };
  const [fromReview, setFromReview] = useState(false);
  const [fromProfile] = useState(startAt === "desc" && setupDone);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [forced, setForced] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [phase, setPhase] = useState<"q" | "enrich" | "complete">("q");
  const [webOpened, setWebOpened] = useState(false);
  const [enrichRes, setEnrichRes] = useState<EnrichInvestorResult | null>(null);
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<number | null>(null);
  const advTimer = useRef<number | null>(null);

  // ---- autosave ----
  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setSaving("saving");
    try { await saveFn({ data: { investor_id: data.investor.id, ...patch } as never }); setSaving("saved"); }
    catch (e) { setSaving("idle"); toast.error((e as Error).message); }
  }, [saveFn, data.investor.id]);
  const queue = useCallback((patch: Record<string, unknown>) => {
    Object.assign(pending.current, patch);
    setSaving("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 500);
  }, [flush]);
  useEffect(() => () => { if (advTimer.current) window.clearTimeout(advTimer.current); }, []);

  // ---- validation ----
  const thai = a.country === "Thailand";
  const individual = a.role === "individual";
  const leaks = descriptionLeaks(a.desc, a.name, a.web);
  const descErr = a.desc.trim() ? descriptionError(a.desc) : null;
  const agent = a.role === "agent";
  const stagesShown = showsStages(a.type, agent ? a.acts : null);
  const errors: Record<string, string | null> = {
    role: a.role ? null : "Choose one to continue.",
    type: agent ? (a.acts.length ? null : "Choose at least one to continue.") : a.type && a.type !== INDIVIDUAL_TYPE ? null : "Choose one to continue.",
    country: a.country ? null : "Choose your country.",
    city: a.city.trim() ? null : thai ? "Choose your province." : "Add your city.",
    name: a.name.trim().length >= 2 ? null : "Add your firm's name.",
    year: individual ? null : yearError(a.year),
    reg: individual ? null : regError(a.reg, a.country),
    web: isValidUrl(a.web) ? null : "Enter a valid website address, e.g. www.yourfirm.com",
    aum: a.aum ? null : "Choose one to continue.",
    ticket: a.ticket ? null : "Choose one to continue.",
    rev: a.rev ? null : "Choose one, or click Skip.",
    deals: a.deals.some((d) => DEAL_TYPES.includes(d)) || a.deals.length ? null : "Pick at least one deal type.",
    stages: !stagesShown || a.stages.length ? null : "Pick at least one stage.",
    sectors: a.sectors.length ? null : "Pick at least one industry, or Sector agnostic.",
    desc: descErr || (leaks.length ? "leak" : null),
  };  const qRef = useRef<HTMLDivElement>(null);
  useFocusNeeded(qRef, `${phase}:${cur}`);

  const fieldsOf: Record<QId, string[]> = {
    role: ["role"], type: ["type"], loc: ["country", "city"], name: ["name", "year", "reg"], web: ["web"], aum: ["aum"], ticket: ["ticket"],
    rev: ["rev"], deals: ["deals", "stages"], sectors: ["sectors"], desc: ["desc"], review: [],
  };
  const qValid = (id: QId) => fieldsOf[id].every((k) => !errors[k]);
  const show = (k: string) => (touched[k] || forced[k]) && errors[k] && errors[k] !== "leak" ? errors[k] : null;

  const idx = steps.findIndex((s) => s.id === cur);
  const step = steps[idx] ?? steps[0]!;
  const optional = cur === "rev" || cur === "desc";

  // ---- answer setters (each saves straight away) ----
  const set = (patch: Partial<A>, server: Record<string, unknown>) => {
    setA((p) => ({ ...p, ...patch }));
    const next = { ...a, ...patch };
    // On a Live profile only valid descriptions reach sellers.
    if ("description" in server && live) {
      const bad = (next.desc.trim() && descriptionError(next.desc)) || descriptionLeaks(next.desc, next.name, next.web).length;
      if (bad) return;
    }
    queue(server);
  };

  const markAnswered = (id: QId) => {
    if (id === "review" || answered.includes(id)) return answered;
    const n = [...answered, id];
    setAnswered(n);
    queue({ answered: n });
    return n;
  };

  const goTo = (id: QId) => { setForced({}); setCur(id); };
  const advance = (from: QId) => {
    markAnswered(from);
    if (fromProfile && from === "desc") { void flush().then(() => setPhase("complete")); return; }
    if (fromReview) { setFromReview(false); setFull(null); goTo("review"); return; }
    const nxt = nextAfter(a, from);
    // Private equity pre-ticks, the first time it reaches deals.
    // A representative gets them only when Private equity is their only type.
    if (nxt === "deals" && !peTicked && a.type.toLowerCase().includes("private equity") && (!agent || a.acts.length === 1)) {
      const patch: Partial<A> = {};
      if (!a.deals.length) patch.deals = ["Majority stake (above 51%)"];
      if (!a.stages.length) patch.stages = ["Buyout"];
      if (!a.geo.length) patch.geo = ["Thailand"];
      setA((p) => ({ ...p, ...patch }));
      setPeTicked(true);
      queue({ pe_ticked: true, ...(patch.deals ? { deal_types: patch.deals } : {}), ...(patch.stages ? { preferred_stages: patch.stages } : {}), ...(patch.geo ? { geography: patch.geo } : {}) });
    }
    goTo(nxt);
  };
  const tryContinue = () => {
    if (cur === "review") { if (allValid) void flush().then(() => setPhase("enrich")); return; }
    if (!qValid(cur)) { setForced(Object.fromEntries(fieldsOf[cur].map((k) => [k, true]))); return; }
    advance(cur);
  };
  const autoPick = (id: QId, patch: Partial<A>, server: Record<string, unknown>) => {
    set(patch, server);
    if (advTimer.current) window.clearTimeout(advTimer.current);
    advTimer.current = window.setTimeout(() => {
      markAnswered(id);
      if (fromReview) { setFromReview(false); setFull(null); goTo("review"); return; }
      goTo(nextAfter({ ...a, ...patch }, id));
    }, 250);
  };
  const skip = () => {
    if (cur === "rev") set({ rev: "" }, { revenue_min_band: null });
    if (cur === "desc") set({ desc: "" }, { description: "" });
    advance(cur);
  };
  const back = () => { if (idx > 0) goTo(steps[idx - 1]!.id); };
  const [exiting, setExiting] = useState(false);
  const saveExit = async () => {
    if (exiting) return;
    setExiting(true);
    // Never let a slow or failed save trap the user on this screen.
    const cap = <T,>(p: Promise<T>) => Promise.race([p, new Promise<void>((r) => window.setTimeout(r, 2500))]);
    try { await cap(flush()); } catch { /* flush already toasts */ }
    void qc.invalidateQueries({ queryKey: BUYER_INVESTOR_KEY });
    void qc.invalidateQueries({ queryKey: ["buyer-profile", "me"] });
    toast.success(live ? "Your changes are saved." : "Saved as a draft. Continue setup any time from My Company.");
    const fallback = window.setTimeout(() => { window.location.href = "/marketplace/my-company"; }, 1500);
    try { await navigate({ to: "/marketplace/my-company" }); window.clearTimeout(fallback); }
    catch { window.location.href = "/marketplace/my-company"; }
  };

  const requiredQs = stepsAll.filter((s) => s.id !== "review" && s.id !== "rev" && s.id !== "desc");
  const allValid = requiredQs.every((s) => qValid(s.id)) && !errors.desc;

  // Enter = Continue (not on buttons/links/textarea).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || phase !== "q") return;
    const t = e.target as HTMLElement;
    if (t.closest("button, a, textarea, [role=combobox], [role=listbox]")) return;
    e.preventDefault();
    tryContinue();
  };

  const tName = typeName(individual ? INDIVIDUAL_TYPE : a.type, agent ? a.acts : null);
  const corp = isCorporateBuyer(a.type);

  // ---------------- questions ----------------
  const Q: Record<QId, { t: React.ReactNode; h: React.ReactNode; body: React.ReactNode; req: boolean }> = {
    role: { req: true, t: "Which best describes you?", h: "We use it to verify your firm and to know who can act for it.",
      body: <Choice list={ROLES} value={a.role ?? ""} onPick={(v) => {
        const r = v as BuyerRelation;
        const patch: Partial<A> = { role: r };
        const server: Record<string, unknown> = { buyer_relation: r };
        patch.acts = [];
        if (r === "individual") { patch.type = INDIVIDUAL_TYPE; server.investor_type = INDIVIDUAL_TYPE; }
        else if (r === "corporate" && !WIZARD_TYPES.some((t) => t.value === a.type)) { patch.type = ""; server.investor_type = null; }
        else if (r === "agent") {
          // Starts as [Investor Classification]; question 2 shows with it ticked so more can be added.
          patch.acts = a.role === "agent" ? a.acts : a.type ? [a.type] : [];
          server.acts_for_types = patch.acts;
          if (a.role !== "agent") {
            // Question 2 shows next, even if sign-up answered it.
            setA((p) => ({ ...p, ...patch }));
            queue(server);
            if (advTimer.current) window.clearTimeout(advTimer.current);
            advTimer.current = window.setTimeout(() => { markAnswered("role"); setFull("type"); goTo("type"); }, 250);
            return;
          }
        }
        autoPick("role", patch, server);
      }} /> },
    type: agent
      ? { req: true, t: "Which types of investor do you act for?", h: "Pick all that apply. Sellers see them on your card.",
        body: <><TypeTicks value={a.acts} onChange={(v) => set({ acts: v, type: v[0] ?? "" }, { acts_for_types: v })} /><Err m={forced.type && errors.type} /></> }
      : { req: true, t: "What type of investor is your firm?", h: "Sellers see this, and it sets the artwork on your card.",
        body: <Choice cols icon list={WIZARD_TYPES} value={a.type} onPick={(v) => autoPick("type", { type: v }, { investor_type: v })} /> },
    loc: { req: true, t: "Where is your firm based?", h: "Sellers see your country and city.",
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="w-country">Country<Req /></label>
            <select id="w-country" aria-required className={inp} value={a.country}
              onChange={(e) => set({ country: e.target.value, city: "", reg: "" }, { country: e.target.value, city: null, registration_no: null })}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="w-city">{thai ? "City / province" : "City"}<Req /></label>
            {thai ? (
              <select id="w-city" aria-required {...(errors.city ? { "data-need": "1" } : {})} className={`${inp} ${errors.city ? "need-fill" : ""} ${show("city") ? errCls : ""}`} value={a.city}
                onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                onChange={(e) => set({ city: e.target.value }, { city: e.target.value })}>
                <option value="">Choose a province</option>
                {THAI_PROVINCES_77.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input id="w-city" aria-required {...(errors.city ? { "data-need": "1" } : {})} className={`${inp} ${errors.city ? "need-fill" : ""} ${show("city") ? errCls : ""}`} value={a.city} maxLength={120} placeholder="e.g. Singapore"
                onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                onChange={(e) => set({ city: e.target.value }, { city: e.target.value })} />
            )}
            <Err m={show("city")} />
          </div>
        </div>
      ) },
    name: { req: true, t: nameShort && !individual ? "What is your firm's name and registration number?" : "What is the name of your firm?",
      h: nameShort && !individual ? "Check that the name matches your firm's registration. Sellers don't see either before an NDA." : `Sellers see "${tName}" instead of your name until they approve your NDA.`,
      body: (
        <div className="space-y-4">
          <div>
            <div className="flex flex-col gap-[14px] sm:flex-row">
              <div className="flex-1">
                <label className={lbl} htmlFor="w-name">Firm name<Req /></label>
                <input id="w-name" aria-required autoFocus {...(errors.name ? { "data-need": "1" } : {})} className={`${inp} ${errors.name ? "need-fill" : ""} ${show("name") ? errCls : ""}`} value={a.name} maxLength={120} placeholder="e.g. Acme Ventures"
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  onChange={(e) => set({ name: e.target.value }, e.target.value.trim() ? { investor_name: e.target.value } : {})} />
              </div>
              {!individual && !hiddenF.has("year") && (
                <div className="sm:w-[150px]">
                  <label className={lbl} htmlFor="w-year">Year founded<Req /></label>
                  <input id="w-year" aria-required inputMode="numeric" maxLength={4} className={`${inp} ${show("year") ? errCls : ""}`} value={a.year} placeholder="e.g. 2014"
                    onBlur={() => setTouched((t) => ({ ...t, year: true }))}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); set({ year: v }, !yearError(v) ? { year_founded: Number(v) } : {}); }} />
                </div>
              )}
            </div>
            <Err m={show("name")} />
            <Err m={show("year")} />
          </div>
          {!individual && (
            <div>
              <label className={lbl} htmlFor="w-reg">{thai ? <>Company Registration Number (เลขทะเบียนนิติบุคคล)<Req /></> : <>Company registration number<Opt /></>}</label>
              <input id="w-reg" aria-required={thai} {...(errors.reg ? { "data-need": "1" } : {})} className={`${inp} ${errors.reg ? "need-fill" : ""} ${show("reg") ? errCls : ""}`} value={a.reg} inputMode={thai ? "numeric" : undefined}
                maxLength={thai ? 13 : 50} placeholder={thai ? "13 digits" : ""}
                onBlur={() => setTouched((t) => ({ ...t, reg: true }))}
                onChange={(e) => { const v = thai ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value; set({ reg: v }, { registration_no: v }); }} />
              <Err m={show("reg")} />
              <p className="mt-2.5 flex items-start gap-2 text-[13px] text-[#434A5C] dark:text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-[15px] w-[15px] flex-none text-[#15803D]" />
                <span><b className="font-semibold text-[#151A28] dark:text-foreground">Sellers want genuine buyers, not window shoppers.</b>{" "}
                  {thai ? "We verify your firm with this number, then show sellers a Verified investor badge on your card." : `Adding your registration number in ${a.country} helps us verify your firm.`}</span>
              </p>
            </div>
          )}
          <p className="flex items-start gap-2 text-[13px] font-medium text-[#B42318]"><Lock className="mt-0.5 h-[15px] w-[15px] flex-none" />Your firm's identity stays confidential until a seller approves your NDA.</p>
        </div>
      ) },
    web: { req: true, t: "What is your firm's website?", h: "We use it to auto-fill your profile.",
      body: (
        <div>
          <label className={lbl} htmlFor="w-web">Website URL<Req /></label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="w-web" aria-required autoFocus className={`${inp} ${(a.web.trim() || forced.web) && errors.web ? errCls : ""}`} value={a.web} maxLength={500} placeholder="https://www.yourfirm.com"
              onChange={(e) => { setWebOpened(false); set({ web: e.target.value }, isValidUrl(e.target.value) ? { website_url: normalizeUrl(e.target.value) } : {}); }} />
            <button type="button" disabled={!!errors.web}
              onClick={() => { window.open(normalizeUrl(a.web), "_blank", "noopener,noreferrer"); setWebOpened(true); }}
              className="inline-flex h-[50px] flex-none items-center justify-center gap-1.5 rounded-[12px] border border-[#DCDFE5] bg-white px-4 text-[15px] font-semibold text-[#1E2A4A] hover:border-[#1E2A4A] disabled:cursor-not-allowed disabled:text-[#C7CBD6] dark:border-border dark:bg-background dark:text-foreground">
              <ExternalLink className="h-4 w-4" />Check website
            </button>
          </div>
          {(a.web.trim() || forced.web) && errors.web ? <Err m={errors.web} />
            : webOpened ? <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#15803D]"><Check className="h-4 w-4" />Opened {normalizeUrl(a.web).replace(/^https?:\/\//, "").split("/")[0]} in a new tab. Make sure it is your firm.</p>
            : <p className="mt-1.5 text-[13px] text-[#6B7280]">Click Check website to open it in a new tab and make sure it is your firm.</p>}
        </div>
      ) },
    aum: { req: true, t: corp ? "What is your group's annual revenue in $USD?" : "How much does your firm manage (AUM) in $USD?", h: "Sellers see this band, never an exact figure.",
      body: <><Choice list={bandList(AUM_BANDS)} value={a.aum} onPick={(v) => autoPick("aum", { aum: v }, { aum_band: v })} /><Err m={forced.aum && errors.aum} /></> },
    ticket: { req: true, t: "What is your average investment per deal in $USD?", h: "Sellers see this range on your card and filter Browse investors by it.",
      body: <><Choice list={bandList(TICKET_BANDS)} value={a.ticket} onPick={(v) => autoPick("ticket", { ticket: v }, { ticket_band: v })} /><Err m={forced.ticket && errors.ticket} /></> },
    rev: { req: false, t: <>Minimum target company <i>revenue</i> (USD)</>, h: "Enter the minimum annual revenue a company must generate for you to consider it as an acquisition target.",
      body: <><Choice list={bandList(REV_BANDS)} value={a.rev} onPick={(v) => autoPick("rev", { rev: v }, { revenue_min_band: v })} /><Err m={forced.rev && errors.rev} /></> },
    deals: { req: true, t: "What kind of deals do you do?", h: "Pick all that apply. Sellers see these on your card.",
      body: (
        <div className="space-y-6">
          {peTicked && a.type.toLowerCase().includes("private equity") && (
            <p className="flex items-start gap-2 rounded-[10px] bg-[#F3F4F6] px-3.5 py-2.5 text-[13px] text-[#434A5C] dark:bg-muted dark:text-muted-foreground"><Info className="mt-0.5 h-4 w-4 flex-none" />We've ticked the usual choices for private equity: Majority stake, Buyout and Thailand. Change them if they don't fit.</p>
          )}
          <div><Checks title="Deal types" note="pick at least one" req items={Array.from(new Set([...DEAL_TYPES, ...a.deals]))} value={a.deals}
            onChange={(v) => set({ deals: v }, { deal_types: v })} /><Err m={forced.deals && errors.deals} /></div>
          {stagesShown && <div><Checks title="Preferred stages" note="pick at least one" req items={Array.from(new Set([...STAGE_OPTIONS, ...a.stages]))} value={a.stages}
            onChange={(v) => set({ stages: v }, { preferred_stages: v })} /><Err m={forced.deals && errors.stages} /></div>}
          <Checks title="Geography" note="optional" items={Array.from(new Set([...GEOGRAPHY, ...a.geo]))} value={a.geo} onChange={(v) => set({ geo: v }, { geography: v })} />
        </div>
      ) },
    sectors: { req: true, t: "Which industries do you invest in?", h: "Pick up to 5, or Sector agnostic if you look at every industry.",
      body: (() => {
        const ag = a.sectors.includes(SECTOR_AGNOSTIC);
        const picks = a.sectors.filter((s) => s !== SECTOR_AGNOSTIC);
        const setS = (v: string[]) => set({ sectors: v }, { preferred_industries: v });
        return (
          <SetSectorPicker mode="multi" value={picks} onChange={(v) => setS([...(ag ? [SECTOR_AGNOSTIC] : []), ...v])}
            limitMsg="Pick up to 5 industries, or Sector agnostic."
            agnostic={{ on: ag, onToggle: (on) => setS(on ? [SECTOR_AGNOSTIC, ...picks] : picks), line: "I look at companies in every industry",
              note: "Sellers may avoid sector-agnostic investors because there's no clear focus. Picking up to 5 industries helps the right sellers find you.",
              summary: <>Sellers see <b className="text-[#151A28] dark:text-foreground">Sector agnostic</b> on your card.</> }}
            error={forced.sectors ? errors.sectors : null} />
        );
      })() },
    desc: { req: false, t: "How would you describe your firm to sellers?", h: "In one line. Sellers read it before any NDA, so leave out names, websites and contact details.",
      body: (
        <div>
          <label className={lbl} htmlFor="w-desc">Description <span className="font-normal text-[#9CA3AF]">10 to 140 characters</span></label>
          <textarea id="w-desc" rows={3} maxLength={140} autoFocus value={a.desc} placeholder="e.g. Family office backing profitable Thai companies with succession or growth plans"
            onBlur={() => setTouched((t) => ({ ...t, desc: true }))}
            onChange={(e) => set({ desc: e.target.value }, { description: e.target.value })}
            className={`w-full rounded-[12px] border border-[#DCDFE5] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#1E2A4A] focus:shadow-[0_0_0_3px_rgba(30,42,74,.12)] dark:border-border dark:bg-background ${(touched.desc || forced.desc) && descErr ? errCls : ""}`} />
          <div className="mt-1 flex justify-between text-[12.5px]">
            <span className="text-[#B42318]">{(touched.desc || forced.desc) && descErr}</span>
            <span className="text-[#6B7280]">{a.desc.length} / 140</span>
          </div>
          {leaks.length > 0 && <p className="mt-2 rounded-[10px] border border-[#F3D9A6] bg-[#FFF4E0] px-3.5 py-2.5 text-[13px] text-[#8A5A06]">Your description mentions <b>{leaks.join(", ")}</b>. Sellers read it before an NDA, so leave out names, websites and contact details.</p>}
          <div className="mt-5 rounded-[12px] border border-[#E9EBF0] bg-[#FBFBFD] p-4 dark:border-border dark:bg-muted/30">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">How sellers see you</div>
            <PublicInvestorCard empty="Not added" i={{
              refNo: data.buyer.ref_no, codeName: tName, name: null, type: tName, city: a.city || null, country: a.country || null,
              description: a.desc.trim() || "Your description appears here.", sectors: a.sectors, stages: a.stages, dealTypes: a.deals,
              geography: a.geo.join(", ") || null, verified: false, proofOfFunds: false, ticketLabel: null, aumLabel: null, revLabel: null,
              aumBand: a.aum || null, ticketBand: a.ticket || null, revBand: a.rev || null, relation: a.role, actsFor: agent ? a.acts : [],
            }} />
          </div>
        </div>
      ) },
    review: { req: false, t: "Review your answers", h: "Check them, then we'll fill in the rest of your profile.",
      body: <Review a={a} steps={stepsAll} errors={errors} individual={individual} thai={thai} stagesShown={stagesShown} corp={corp}
        onEdit={(id) => { setFromReview(true); setFull(id); goTo(id); }} /> },
  };
  const q = Q[step.id];
  const continueLabel = cur === "review" ? "Continue to auto-fill" : fromProfile && cur === "desc" ? "Back to your profile" : fromReview ? "Back to review" : "Continue";
  const continueOk = cur === "review" ? allValid : qValid(cur);

  // ---------------- layout ----------------
  const topBar = (
    <div className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-[#E9EBF0] bg-white px-5 dark:border-border dark:bg-card">
      <img src={logoBlack} alt="PitchSnack" className="h-6 w-auto dark:invert" />
      <span className="h-5 w-px bg-[#E9EBF0] dark:bg-border" />
      <span className="text-[13.5px] font-semibold text-[#434A5C] dark:text-muted-foreground"><span className="hidden sm:inline">Investor Profile </span>Setup Wizard</span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
        {saving === "saving" ? <><span className="h-2 w-2 rounded-full bg-[#F6A823]" />Saving…</> : saving === "saved" ? <><Check className="h-3.5 w-3.5 text-[#15803D]" />Draft saved</> : null}
      </span>
      <button type="button" onClick={saveExit} disabled={exiting} aria-label="Save and exit setup"
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#DCDFE5] bg-white px-3 text-[13px] font-semibold text-[#434A5C] transition-colors hover:bg-[#F6F7F9] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground">
        {exiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        <span className="hidden sm:inline">{exiting ? "Exiting…" : "Save & exit"}</span>
      </button>
    </div>
  );
  const header = (sec: string, right: string, pct: number) => (
    <>
      <div className="flex items-baseline justify-between text-[15px]"><b className="font-semibold text-[#151A28] dark:text-foreground">{sec}</b><span className="text-[#6B7280]">{right}</span></div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-muted"><i className="block h-full bg-[#1E2A4A] transition-[width] duration-300 dark:bg-[#818CF8]" style={{ width: `${pct}%` }} /></div>
    </>
  );
  const card = "mt-[22px] rounded-[14px] border border-[#E9EBF0] bg-white px-[18px] pb-5 pt-6 sm:mt-[34px] sm:rounded-[16px] sm:p-10 dark:border-border dark:bg-card";
  const btnO = "cursor-pointer h-[50px] rounded-[12px] border border-[#DCDFE5] bg-white px-5 text-[16px] font-semibold text-[#434A5C] disabled:opacity-40 dark:border-border dark:bg-background dark:text-foreground";
  const btnP = "cursor-pointer h-[50px] rounded-[12px] bg-[#1E2A4A] px-6 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#CACED8]";

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#151A28] dark:bg-background dark:text-foreground" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }} onKeyDown={onKeyDown}>
      {topBar}
      {phase === "q" && (
        <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
          {header(step.sec, `Step ${idx + 1} of ${steps.length}`, ((idx + 1) / steps.length) * 100)}
          <div className={card}>
            <div key={step.id} ref={qRef} className="animate-in fade-in duration-200">
              <h1 className="text-[21px] font-bold leading-snug sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>
                {q.t}{q.req && <>{"\u00a0"}<span className="text-[#B42318]" aria-hidden>*</span><span className="sr-only">, required</span></>}
              </h1>
              <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">{q.h}</p>
              {q.body}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <button type="button" className={btnO} disabled={idx === 0} onClick={back}>Back</button>
              {optional && <button type="button" className="px-2 text-[15px] font-semibold text-[#6B7280]" onClick={skip}>Skip</button>}
              <div className="flex w-full gap-2.5 sm:ml-auto sm:w-auto">
                <button type="button" className={`${btnO} flex-1 cursor-pointer hover:bg-[#F6F7F9] active:scale-[0.98] disabled:cursor-wait sm:flex-none`} disabled={exiting} onClick={saveExit}>{exiting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : <>Save &amp; exit</>}</button>
                <button type="button" className={`${btnP} flex-1 sm:flex-none`} disabled={!continueOk} onClick={tryContinue}>{continueLabel}</button>
              </div>
            </div>
          </div>
          <p className="mt-[18px] text-center text-[14px] text-[#6B7280]">Your firm's name, website and exact figures stay private until a seller approves your NDA.</p>
        </div>
      )}
      {phase === "enrich" && (
        <Enrich a={a} header={header} card={card} btnO={btnO} btnP={btnP} onBack={() => { setPhase("q"); goTo("review"); }} onExit={saveExit}
          onDone={(r) => { setEnrichRes(r); void qc.invalidateQueries({ queryKey: BUYER_INVESTOR_KEY }).then(() => setPhase("complete")); }} />
      )}
      {phase === "complete" && (
        <Complete header={header} enrich={enrichRes} answered={a}
          onBack={() => { setPhase("q"); goTo(fromProfile ? "desc" : "review"); }}
          onSaved={(msg) => { toast.success(msg); void qc.invalidateQueries({ queryKey: ["buyer-profile", "me"] }); void navigate({ to: "/marketplace/my-company" }); }} />
      )}
    </div>
  );
}

function Review({ a, steps, errors, individual, thai, stagesShown, corp, onEdit }: {
  a: A; steps: { id: QId }[]; errors: Record<string, string | null>; individual: boolean; thai: boolean; stagesShown: boolean; corp: boolean; onEdit: (id: QId) => void;
}) {
  const shown = new Set(steps.map((s) => s.id));
  type Row = [string, React.ReactNode, QId, "req" | "opt", string | null, string?];
  const groups: [string, Row[]][] = [
    ["About you", [["Your role", ROLES.find((r) => r.value === a.role)?.label, "role", "req", errors.role]]],
    ["About the firm", [
      ...(shown.has("type") ? [a.role === "agent"
        ? ["Acts for", a.acts.map(typeLabel).join(", "), "type", "req", errors.type] as Row
        : ["Investor type", WIZARD_TYPES.find((t) => t.value === a.type)?.label ?? a.type, "type", "req", errors.type] as Row] : []),
      ["Based in", a.city ? `${a.city}, ${a.country}` : "", "loc", "req", errors.city],
      ["Firm name", a.name, "name", "req", errors.name, "🔒 After NDA"],
      ...(!individual ? [
        ["Year founded", a.year, "name", "req", errors.year, "🔒 After NDA"] as Row,
        ["Registration number", a.reg, "name", thai ? "req" : "opt", errors.reg, "🔒 After NDA"] as Row,
      ] : []),
      ["Website", a.web, "web", "req", errors.web, "🔒 After NDA"],
    ]],
    ["Fund & ticket", [
      ...(shown.has("aum") ? [[corp ? "Group revenue" : "AUM", bandText(a.aum), "aum", "req", errors.aum, "Range"] as Row] : []),
      ["Average investment", bandText(a.ticket), "ticket", "req", errors.ticket, "Range"],
    ]],
    ["Buying Requirement", [
      ["Min. target revenue", bandText(a.rev), "rev", "opt", null],
      ["Deal types", a.deals.join(", "), "deals", "req", errors.deals],
      ...(stagesShown ? [["Preferred stages", a.stages.join(", "), "deals", "req", errors.stages] as Row] : []),
      ["Geography", a.geo.join(", "), "deals", "opt", null],
      ["Industries", a.sectors.includes(SECTOR_AGNOSTIC) ? "Sector agnostic" : a.sectors.join(", "), "sectors", "req", errors.sectors],
    ]],
    ["Public profile", [["Description", a.desc.trim(), "desc", "opt", errors.desc ? "fix" : null]]],
  ];
  return (
    <div className="space-y-5">
      {groups.map(([g, rows]) => (
        <div key={g}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">{g}</div>
          <div className="rounded-[12px] border border-[#E9EBF0] dark:border-border">
            {rows.map(([k, v, id, kind, err, tag], i) => {
              const empty = !v;
              const status = kind === "req" && (empty || err) ? <b className="font-semibold text-[#B42318]">Missing</b>
                : id === "desc" && err ? <b className="font-semibold text-[#B42318]">Needs a fix</b>
                : empty ? <span className="text-[#9CA3AF]">Not set</span> : null;
              return (
                <div key={k + i} className="flex items-start gap-3 border-b border-[#F0F1F4] px-4 py-3 text-[14px] last:border-0 dark:border-border">
                  <span className="w-[150px] flex-none text-[#6B7280]">{k}</span>
                  <span className="min-w-0 flex-1 font-semibold">
                    {status ?? v}
                    {!status && tag && <span className={`ml-2 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${tag === "Range" ? "bg-[#EEF0FF] text-[#4338CA]" : "bg-muted text-muted-foreground"}`}>{tag}</span>}
                  </span>
                  <button type="button" className="text-[13px] font-semibold text-[#2563EB] hover:underline" onClick={() => onEdit(id)}>Edit</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type HeaderFn = (sec: string, right: string, pct: number) => React.ReactNode;

function Enrich({ a, header, card, btnO, btnP, onBack, onExit, onDone }: {
  a: A; header: HeaderFn; card: string; btnO: string; btnP: string; onBack: () => void; onExit: () => void; onDone: (r: EnrichInvestorResult | null) => void;
}) {
  const domain = normalizeUrl(a.web).replace(/^https?:\/\//, "").split("/")[0];
  const thaiReg = a.country === "Thailand" && /^\d{13}$/.test(a.reg);
  const [res, setRes] = useState<EnrichInvestorResult | null>(null);
  const [state, setState] = useState<"running" | "done">("running");
  useEffect(() => {
    let off = false;
    investorEnrichAdapter.enrichInvestor({ websiteUrl: normalizeUrl(a.web) })
      .then((r) => { if (!off) { setRes(r); setState("done"); } })
      .catch(() => { if (!off) setState("done"); });
    return () => { off = true; };
  }, [a.web]);
  const found = (r: EnrichInvestorResult | null) => {
    const site = [r?.bio && "description", r?.yearFounded && a.role === "individual" && !a.year && "year founded"].filter(Boolean) as string[];
    return {
      site: site.length ? `Found ${site.join(" and ")}` : "Nothing new found",
      linkedin: r?.linkedinUrl ? "Found LinkedIn URL" : "No company page found",
      registry: r?.businessAddress ? "Found address" : "Nothing new found",
      news: "No recent deals found",
    };
  };
  const f = found(res);
  const sources: [string, string, string, boolean][] = [
    ["Your website", domain, f.site, true],
    ["LinkedIn", "Company page", f.linkedin, true],
    ["Company registry", `Registration ${a.reg}`, f.registry, thaiReg],
    ["News", "Recent deals and press", f.news, true],
  ];
  const n = res ? Object.entries(res).filter(([k, v]) => k !== "_debug" && v != null && (Array.isArray(v) ? v.length : String(v).trim())).length : 0;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" && state === "done" && !(e.target as HTMLElement).closest("button")) onDone(res); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [state, res, onDone]);
  return (
    <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
      {header("Auto Enrich", "Almost done", 100)}
      <div className={card}>
        <h1 className="text-[21px] font-bold sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>{state === "done" ? "Your profile is filled in" : "Filling in your profile"}</h1>
        <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">{state === "done" ? `We found ${n} details. Check them in the next step.` : `We're reading ${domain} and public records. This takes a few seconds.`}</p>
        <div className="rounded-[12px] border border-[#E9EBF0] dark:border-border">
          {sources.filter((s) => s[3]).map(([t, sub, what]) => (
            <div key={t} className="flex items-center gap-3 border-b border-[#F0F1F4] px-4 py-3 last:border-0 dark:border-border">
              {state === "done" ? <Check className="h-5 w-5 text-[#15803D]" /> : <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />}
              <div className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold">{t}</b><span className="text-[12.5px] text-[#6B7280]">{sub}</span></div>
              {state === "done" && <span className="text-[13px] text-[#434A5C] dark:text-muted-foreground">{what}</span>}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          <button type="button" className={btnO} onClick={onBack}>Back to answers</button>
          <div className="flex w-full gap-2.5 sm:ml-auto sm:w-auto">
            <button type="button" className={`${btnO} flex-1 sm:flex-none`} onClick={onExit}>Save &amp; exit</button>
            <button type="button" className={`${btnP} flex-1 sm:flex-none`} disabled={state !== "done"} onClick={() => onDone(res)}>Review &amp; complete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Complete({ header, enrich, answered, onBack, onSaved }: {
  header: HeaderFn; enrich: EnrichInvestorResult | null; answered: A; onBack: () => void; onSaved: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const data = qc.getQueryData<Data>(BUYER_INVESTOR_KEY);
  if (!data) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" /></div>;
  const ans: SourceTag = "Your answer";
  const sources: Record<string, SourceTag> = {
    investor_name: ans, investor_type: ans, year_founded: ans, registration_no: ans, aum_band: ans, ticket_band: ans,
    revenue_min_band: ans, deal_types: ans, geography: ans, preferred_industries: ans, description: ans,
  };
  if (!answered.rev) delete sources.revenue_min_band;
  if (!answered.desc.trim()) delete sources.description;
  return (
    <div className="mx-auto max-w-[880px] px-4 pb-16 pt-8 sm:pt-10">
      {header("Review & complete", "Last step", 100)}
      <div className="mt-[22px] sm:mt-[34px]">
        <h1 className="text-[21px] font-bold sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>Check your profile and save it</h1>
        <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">Your answers and what Auto Enrich found are filled in. Change anything you need.</p>
        <BuyerInvestorForm data={data} setup={{ onBack, sources, onSaved, enrich }} />
      </div>
    </div>
  );
}

