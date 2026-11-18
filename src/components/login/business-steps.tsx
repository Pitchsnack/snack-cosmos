/**
 * Sign-up's business questions (About, investor type, Your company, sector, logo), shared by
 * /signup and + Add. Sign-up wraps them with Role/Account/Confirm email; + Add shows them in a
 * pop-up over My Company. One copy of the screens, answers, checks and Thai.
 */
import { useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Briefcase, Building, Building2, Calculator, Check, Circle, CircleAlert, Eye, EyeOff, Factory, FilePenLine,
  FileText, Gauge, Globe, Handshake, House, Info, Landmark, LoaderCircle, Lock, Rocket, Scale, Search, Sprout, Store, User, Users, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUNTRIES } from "@/lib/investor-bands";
import { canRequestSignupSetup, digitsOnly, isValidThaiReg, normWebsite, signupSteps, type SignupStepKey } from "@/lib/thai-reg";
import { useRegCopy, type SetupReason } from "@/components/login/signup-reg-copy";
import { LogoPicker, RejectedCompany, SetupRequest, type HeldLogo, type SetupInit } from "@/components/login/signup-reg-parts";
import { SellerTypeQuestion, ManyTypeQuestion, buyerWords, advisorWords, manyError } from "@/components/common/business-type-question";
import { EMPTY_PICKS, type SectorPick, type SectorPicks } from "@/lib/business-types";
import type { RegCompany } from "@/lib/signup-reg.functions";
import { ADVISOR_OPTS, BUYER_OPTS, BUYER_REL_OPTS, S, SELLER_OPTS, type Role } from "@/components/login/signup-copy";

type Lang = "th" | "en";
type T = { th: string; en: string };
export type BizStep = "about" | "type" | "company" | "sector" | "logo";
export const BIZ_STEPS: BizStep[] = ["about", "type", "company", "sector", "logo"];
/** + Add: sign-up's order for this role and answer, without Role, Account and Confirm email. */
export function businessSteps(role: Role | null, answer: string | null): BizStep[] {
  return signupSteps(role, answer).filter((k): k is BizStep => (BIZ_STEPS as string[]).includes(k));
}

export const ICONS: Record<string, LucideIcon> = {
  store: Store, users: Users, "file-pen-line": FilePenLine, house: House, landmark: Landmark, rocket: Rocket,
  "building-2": Building2, factory: Factory, sprout: Sprout, user: User, handshake: Handshake, scale: Scale,
  calculator: Calculator, gauge: Gauge, briefcase: Briefcase, search: Search,
};
export const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const WEB_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export type Held = {
  company?: { name: string; size: string | null; website: string | null; country: string };
  reg?: string;
  sector?: { sector?: string | null; pick?: SectorPick | null; picks?: SectorPicks | null; agnostic?: boolean };
  logo?: HeldLogo | null;
};
export type Fix = null | { why: "no" | "nf" | "unavailable"; old: string; co?: RegCompany };

/** All the business answers, for one role at a time. */
export function useBusinessAnswers(role: Role | null) {
  const [answers, setAnswers] = useState<Record<Role, string | null>>({ seller: null, buyer: null, advisor: null });
  const [pickErr, setPickErr] = useState(false);
  const [corpType, setCorpType] = useState<string | null>(null);
  const [agentTypes, setAgentTypes] = useState<string[]>([]);
  const [country, setCountry] = useState("Thailand");
  const [coName, setCoName] = useState(""); const [size, setSize] = useState(""); const [web, setWeb] = useState("");
  const [reg, setReg] = useState(""); const [regLocked, setRegLocked] = useState(false);
  const [err5, setErr5] = useState<Record<string, boolean>>({});
  const [noNumber, setNoNumber] = useState(false);
  const [fix, setFix] = useState<Fix>(null);
  const regRef = useRef<HTMLInputElement>(null);
  const [sPick, setSPick] = useState<SectorPick | null>(null); const [sSector, setSSector] = useState<string | null>(null);
  const [picks, setPicks] = useState<SectorPicks>(EMPTY_PICKS); const [agnostic, setAgnostic] = useState(false);
  const [err7, setErr7] = useState(false);
  const [logo, setLogo] = useState<HeldLogo | null>(null); const [logoErr, setLogoErr] = useState(false);

  const answer = role ? answers[role] : null;
  const buyer = role === "buyer";
  const individual = buyer && answer === "individual";
  const agent = buyer && answer === "agent";
  const corp = buyer && answer === "corporate";
  const types = corp ? (corpType ? [corpType] : []) : agent ? agentTypes : individual ? ["Individual Investor"] : [];
  const word: "company" | "firm" = role === "seller" ? "company" : "firm";

  function restoreHeld(h: Held) {
    if (h.company) { setCoName(h.company.name ?? ""); setSize(h.company.size ?? ""); setWeb(h.company.website ?? ""); setCountry(h.company.country || "Thailand"); }
    if (h.reg) { setReg(h.reg); setRegLocked(true); }
    if (h.sector) { setSSector(h.sector.sector ?? null); setSPick(h.sector.pick ?? null); if (h.sector.picks) setPicks(h.sector.picks); setAgnostic(!!h.sector.agnostic); }
    if (h.logo) setLogo(h.logo);
  }
  function restoreTypes(ans: string, list?: string[] | null) {
    if (!list?.length) return;
    if (ans === "corporate") setCorpType(list[0]!); else if (ans === "agent") setAgentTypes(list);
  }
  const held = (): Held => ({
    company: { name: coName.trim(), size: individual ? null : size || null, website: web.trim() ? normWebsite(web) : null, country: role === "seller" ? "Thailand" : country },
    reg, logo: individual ? null : logo,
    sector: role === "seller" ? { sector: sSector, pick: sPick } : { picks: agnostic ? null : picks, agnostic },
  });
  const setAnswer = (v: string) => { if (role) setAnswers((a) => ({ ...a, [role]: v })); };
  return {
    answers, setAnswers, answer, setAnswer, pickErr, setPickErr, corpType, setCorpType, agentTypes, setAgentTypes,
    country, setCountry, coName, setCoName, size, setSize, web, setWeb, reg, setReg, regLocked, setRegLocked,
    err5, setErr5, noNumber, setNoNumber, fix, setFix, regRef,
    sPick, setSPick, sSector, setSSector, picks, setPicks, agnostic, setAgnostic, err7, setErr7, logo, setLogo, logoErr, setLogoErr,
    buyer, individual, agent, corp, types, word, restoreHeld, restoreTypes, held,
  };
}
export type BusinessAnswers = ReturnType<typeof useBusinessAnswers>;

/** The assisted request replaces the company step; wrappers use this to hide step chrome too. */
export function companySetupReason(role: Role, answer: string | null, country: string, noNumber: boolean): SetupReason | null {
  const individual = role === "buyer" && answer === "individual";
  if (role !== "seller" && country !== "Thailand") return role === "advisor" ? "outside_advisor" : "outside_buyer";
  return noNumber ? (individual ? "individual" : "no_number") : null;
}

/** Your company: field checks shared by sign-up and + Add. Returns the first bad field, if any. */
export function companyErrors(b: BusinessAnswers, role: Role) {
  const sizeBad = !b.individual && (role === "advisor" ? !/^[1-9]\d{0,4}$/.test(b.size) : !SIZES.includes(b.size));
  const webRequired = role === "advisor" || (b.buyer && !b.individual);
  const webBad = (webRequired && !b.web.trim()) || (!!b.web.trim() && !WEB_RE.test(b.web.trim()));
  return { name: b.coName.trim().length < 2, reg: !isValidThaiReg(b.reg), size: sizeBad, web: webBad };
}

const fillT = (lang: Lang, x: T, vars: Record<string, string | number>) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), x[lang]);

export function Err({ text, lang, id }: { text: T | string; lang: Lang; id?: string }) {
  return <div className="lg-err" id={id}><CircleAlert size={15} />{typeof text === "string" ? text : text[lang]}</div>;
}
const Req = () => <span className="sr-req" aria-hidden>*</span>;

export function Choice({ o, name, big, tone, checked, lang, onPick, onEnter }: {
  o: { v: string; icon: string; t: T; l: T; k?: string }; name: string; big?: boolean; tone: string; checked: boolean; lang: Lang;
  onPick: (auto: boolean) => void; onEnter: () => void;
}) {
  const Icon = ICONS[o.icon] ?? Circle;
  return (
    <label className={`su-choice ${big ? "big" : "small"} ${checked ? "on" : ""}`}
      onClick={(e) => { if (!big && e.detail > 0) onPick(true); }}>
      <input type="radio" name={name} value={o.v} checked={checked} onChange={() => onPick(false)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} />
      <span className={`su-tile t-${tone}`}><Icon size={big ? 22 : 19} /></span>
      <span className="su-ct"><b>{o.t[lang]}</b><small>{o.l[lang]}</small></span>
      <span className="su-radio" aria-hidden />
    </label>
  );
}
export function Primary({ label, busyLabel, onClick, type = "button", busy, lang }: { label: T; busyLabel?: T; onClick?: () => void; type?: "button" | "submit"; busy: boolean; lang: Lang }) {
  return (
    <button type={type} className="lg-btn su-grow" disabled={busy} onClick={onClick}>
      {busy && busyLabel ? <>{busyLabel[lang]}<LoaderCircle size={18} className="lg-spin" /></> : <>{label[lang]}<ArrowRight size={18} /></>}
    </button>
  );
}
export function BackBtn({ onClick, busy, lang }: { onClick: () => void; busy: boolean; lang: Lang }) {
  return <Button type="button" variant="ghost" className="su-back" disabled={busy} onClick={onClick}><ArrowLeft size={17} />{S.back[lang]}</Button>;
}

/** The step names shown above the progress bar. */
export function bizStepName(k: BizStep, role: Role, R: ReturnType<typeof useRegCopy>): T {
  return k === "about" ? S.step2[role] : k === "type" ? S.stepType : k === "company" ? R.stepCo[role] : k === "sector" ? S.stepSec[role] : R.stepLogo;
}

/**
 * One business step. The wrapper decides where Back/Next go (`go`, `back`), what Confirm
 * does (`onConfirmNeeded`) and how a set-up request is sent (`setup`).
 */
export function BusinessStep({ step, role, b, lang, busy, titleRef, go, back, next, onConfirmNeeded, setup, changesLeft, sectorAction, fail }: {
  step: BizStep; role: Role; b: BusinessAnswers; lang: Lang; busy: boolean; titleRef: React.RefObject<HTMLHeadingElement | null>;
  /** Moves to a step (answer-dependent next steps). */
  go: (k: BizStep) => void;
  /** Back from this step; omitted hides Back. */
  back?: () => void;
  /** After this step (company: only when the number is already confirmed). */
  next: (from: BizStep) => void;
  onConfirmNeeded: () => void;
  setup: { init: SetupInit; onSend: (reason: SetupReason, v: Parameters<React.ComponentProps<typeof SetupRequest>["onSend"]>[0]) => Promise<void> };
  changesLeft: number;
  /** Sign-up's legacy sector-only step replaces Next. */
  sectorAction?: { label: T; busyLabel: T; onClick: () => void };
  fail?: boolean;
}) {
  const R = useRegCopy();
  const t = (x: T) => x[lang];
  const fill = (x: T, v: Record<string, string | number>) => fillT(lang, x, v);
  const Lx = (en: string, th: string) => (lang === "th" ? th : en);
  const { answer, buyer, individual, agent, corp, types, word, fix } = b;
  const opts = role === "seller" ? SELLER_OPTS : role === "buyer" ? BUYER_REL_OPTS : ADVISOR_OPTS;
  const afterAboutFor = (v: string): BizStep => businessSteps(role, v)[1] ?? "company";
  const outside = role !== "seller" && b.country !== "Thailand";
  const setupReasonInline = companySetupReason(role, answer, b.country, b.noNumber);
  const webRequired = role === "advisor" || (buyer && !individual);
  const fixNoText = fix?.why === "no" ? fill(R.boxNo, { number: "\u0000" }) : "";
  const fixHasName = !!(fix?.co?.nameTh || fix?.co?.nameEn);
  const pickFirst = () => document.querySelector<HTMLInputElement>(".su-cards input")?.focus();

  function companyContinue(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    if (fix) {
      if (changesLeft <= 0) return;
      if (!isValidThaiReg(b.reg)) { b.setErr5((x) => ({ ...x, reg: true })); b.regRef.current?.focus(); return; }
      onConfirmNeeded(); return;
    }
    const errs = companyErrors(b, role);
    b.setErr5(errs);
    const firstBad = (["name", "reg", "size", "web"] as const).find((k) => errs[k]);
    if (firstBad) { document.getElementById(`su-${firstBad}`)?.focus(); return; }
    if (b.regLocked) { next("company"); return; }
    onConfirmNeeded();
  }
  function sectorContinue() {
    if (busy) return;
    const bad = role === "seller" ? !b.sSector : !!manyError(b.picks, b.agnostic, Lx);
    if (bad) {
      b.setErr7(true);
      setTimeout(() => document.querySelector<HTMLElement>(".su-sector [role=radio], .su-sector button")?.focus(), 0);
      return;
    }
    if (sectorAction) { sectorAction.onClick(); return; }
    next("sector");
  }
  const err7Text = !b.err7 ? null : role === "seller" ? (b.sSector ? null : t(S.eSeller)) : manyError(b.picks, b.agnostic, Lx);
  const Back = () => (back ? <BackBtn onClick={back} busy={busy} lang={lang} /> : null);

  if (step === "about") return <>
    <h1 ref={titleRef} tabIndex={-1}>{t(S.s2[role][0])}</h1>
    <p className="lg-cline su-line">{t(S.s2[role][1])}</p>
    <fieldset className="su-cards small">
      <legend className="sr-only">{t(S.s2[role][0])}</legend>
      {opts.map((o) => <Choice key={o.v} o={o} name={`a-${role}`} tone={role} lang={lang} checked={answer === o.v}
        onPick={(auto) => { b.setAnswer(o.v); b.setPickErr(false); if (auto) setTimeout(() => go(afterAboutFor(o.v)), 250); }}
        onEnter={() => { b.setAnswer(o.v); go(afterAboutFor(o.v)); }} />)}
    </fieldset>
    {individual && <div className="su-info"><Info size={16} /><span>{t(R.indNote)}</span></div>}
    {b.pickErr && <Err lang={lang} text={S.pickOne} />}
    <div className="su-actions">
      <Back />
      <Primary busy={busy} lang={lang} label={S.next} onClick={() => { if (!answer) { b.setPickErr(true); pickFirst(); } else go(afterAboutFor(answer)); }} />
    </div>
  </>;

  if (step === "type" && buyer && (corp || agent)) return <>
    <h1 ref={titleRef} tabIndex={-1}>{t((agent ? S.s3Agent : S.s3Corp)[0])}</h1>
    <p className="lg-cline su-line">{t((agent ? S.s3Agent : S.s3Corp)[1])}</p>
    <fieldset className="su-cards small">
      <legend className="sr-only">{t((agent ? S.s3Agent : S.s3Corp)[0])}</legend>
      {BUYER_OPTS.filter((o) => agent || o.v !== "Individual Investor").map((o) => {
        const Icon = ICONS[o.icon] ?? Circle;
        const on = agent ? b.agentTypes.includes(o.v) : b.corpType === o.v;
        return (
          <label key={o.v} className={`su-choice small ${on ? "on" : ""}`}
            onClick={(e) => { if (!agent && e.detail > 0) { b.setCorpType(o.v); b.setPickErr(false); setTimeout(() => go("company"), 250); } }}>
            {agent ? (
              <input type="checkbox" value={o.v} checked={on}
                onChange={() => { b.setAgentTypes((l) => BUYER_OPTS.map((x) => x.v).filter((v) => (v === o.v ? !on : l.includes(v)))); b.setPickErr(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!b.agentTypes.length) b.setPickErr(true); else go("company"); } }} />
            ) : (
              <input type="radio" name="b-type" value={o.v} checked={on}
                onChange={() => { b.setCorpType(o.v); b.setPickErr(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); b.setCorpType(o.v); go("company"); } }} />
            )}
            <span className={`su-tile t-b-${o.k}`}><Icon size={19} /></span>
            <span className="su-ct"><b>{t(o.t)}</b><small>{t(o.l)}</small></span>
            <span className={agent ? "su-tick" : "su-radio"} aria-hidden>{agent && on && <Check size={13} strokeWidth={3} />}</span>
          </label>
        );
      })}
    </fieldset>
    {b.pickErr && <Err lang={lang} text={agent ? S.pickMany : S.pickOne} />}
    <div className="su-actions">
      <Back />
      <Primary busy={busy} lang={lang} label={S.next} onClick={() => { if (!types.length) { b.setPickErr(true); pickFirst(); } else go("company"); }} />
    </div>
  </>;

  if (step === "company" && setupReasonInline) return (
    <SetupRequest key={setupReasonInline} lang={lang} reason={setupReasonInline} init={setup.init} tried={[]} titleRef={titleRef}
      onBackToFields={() => { b.setNoNumber(false); if (outside) b.setCountry("Thailand"); }}
      onSend={(v) => setup.onSend(setupReasonInline, v)} />
  );

  if (step === "company") return <>
    <h1 ref={titleRef} tabIndex={-1}>{t(role === "seller" ? R.coTitle.seller : R.coTitle.firm)}</h1>
    <p className="lg-cline su-line">{t(individual ? R.coLine.ind : R.coLine[word])}</p>
    <form className="su-form sr" onSubmit={companyContinue} noValidate>
      {role !== "seller" && !fix && (
        <div className="lg-fg">
          <label className="lg-label" htmlFor="su-country">{t(R.country)}<Req /></label>
          <div className="lg-field su-f"><Globe size={18} />
            <select id="su-country" aria-required value={b.country} disabled={b.regLocked} onChange={(e) => b.setCountry(e.target.value)} className="w-full bg-transparent outline-none">
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
        </div>
      )}
      {!fix && (
        <div className="lg-fg">
          <label className="lg-label" htmlFor="su-name">{individual ? t(R.indName) : t(S.nameL[role])}<Req /></label>
          <div className={`lg-field su-f ${b.err5.name ? "bad" : ""}`}><Building size={18} />
            <input id="su-name" aria-required maxLength={120} placeholder={t(S.namePh[role])} value={b.coName}
              onChange={(e) => { b.setCoName(e.target.value); if (e.target.value.trim().length >= 2) b.setErr5((x) => ({ ...x, name: false })); }} /></div>
          {role === "buyer" ? (agent ? <p className="su-fhint">{t(S.nameHintAgent)}</p> : null)
            : S.nameHint[role] && <p className="su-fhint">{t(S.nameHint[role]!)}</p>}
          {b.err5.name && <Err lang={lang} text={S.nameErr[role]} />}
        </div>
      )}
      <div className="lg-fg">
        <label className={`lg-label${fix ? " sr-lbl-bad" : ""}`} htmlFor="su-reg">{t(R.regLabel)}<Req /></label>
        <div className={`lg-field su-f ${b.err5.reg || fix ? "bad" : ""} ${b.regLocked ? "sr-locked" : ""}`}><FileText size={18} />
          <input id="su-reg" ref={b.regRef} aria-required inputMode="numeric" maxLength={13} placeholder={t(R.regPh)} value={b.reg} readOnly={b.regLocked}
            aria-invalid={b.err5.reg || !!fix || undefined}
            onChange={(e) => { b.setReg(digitsOnly(e.target.value)); b.setErr5((x) => ({ ...x, reg: false })); }} />
          {b.regLocked && <Lock size={16} aria-hidden />}</div>
        {!fix && (b.regLocked ? <p className="sr-hint">{t(R.regLocked)}</p>
          : <p className="sr-hint">{fill(R.regHint[word], { n: b.reg.length })}</p>)}
        {!fix && b.err5.reg && <Err lang={lang} text={R.regBad} />}
        {fix && (
          <div className="sr-warn">
            {fix.why === "no" ? <>
              <span>{(fixHasName ? fixNoText : fixNoText.replace(/:$/, ".")).split("\u0000").map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <b>{fix.old}</b>}</span>)}</span>
              {fix.co && fixHasName && <div className="sr-warn-in"><RejectedCompany co={fix.co} /></div>}
            </> : fix.why === "nf" ? <p style={{ margin: 0 }}>{fill(R.boxNf, { number: "\u0000" }).split("\u0000").map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <b>{fix.old}</b>}</span>)}</p>
              : <p style={{ margin: 0 }}>{t(R.fixUnavailable)}</p>}
            <p style={{ margin: "6px 0 0" }}>{changesLeft > 0 ? <>{t(R.boxLeft)} <b>{changesLeft === 1 ? t(R.left1) : fill(R.left, { k: changesLeft })}</b></> : t(R.usedBoth)}</p>
          </div>
        )}
        {canRequestSignupSetup(b.regLocked, !!fix) && <Button type="button" variant="link" className="sr-link" onClick={() => b.setNoNumber(true)}>{t(R.noReg)}</Button>}
      </div>
      {!fix && !individual && (
        <div className="lg-fg">
          <label className="lg-label" htmlFor="su-size">{t(role === "advisor" ? S.sizeAdv : S.size)}<Req /></label>
          {role === "advisor" ? (
            <div className={`lg-field su-f ${b.err5.size ? "bad" : ""}`}><Users size={18} />
              <input id="su-size" aria-required inputMode="numeric" placeholder={t(S.sizeAdvPh)} value={b.size}
                onChange={(e) => { b.setSize(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 5)); b.setErr5((x) => ({ ...x, size: false })); }} />
              <span className="su-unit">{t(S.people)}</span></div>
          ) : (
            <div className={`lg-field su-f ${b.err5.size ? "bad" : ""}`}><Users size={18} />
              <select id="su-size" aria-required value={b.size} onChange={(e) => { b.setSize(e.target.value); b.setErr5((x) => ({ ...x, size: false })); }}
                className={`w-full bg-transparent outline-none ${b.size ? "" : "text-muted-foreground"}`}>
                <option value="" disabled>{t(S.sizePick)}</option>
                {SIZES.map((s) => <option key={s} value={s}>{s === "500+" ? t(S.sizeMore) : s.replace("-", "–")}</option>)}
              </select></div>
          )}
          {b.err5.size && <Err lang={lang} text={role === "advisor" ? S.eSizeAdv : S.eSize} />}
        </div>
      )}
      {!fix && (
        <div className="lg-fg">
          <label className="lg-label" htmlFor="su-web">{t(S.web)}{webRequired ? <Req /> : <> <span className="su-opt">{t(S.optional)}</span></>}</label>
          <div className={`lg-field su-f ${b.err5.web ? "bad" : ""}`}><Globe size={18} />
            <input id="su-web" aria-required={webRequired} inputMode="url" placeholder={role === "seller" ? "www.yourcompany.com" : "www.yourfirm.com"} value={b.web}
              onChange={(e) => { b.setWeb(e.target.value); b.setErr5((x) => ({ ...x, web: false })); }} /></div>
          {!webRequired && <p className="su-fhint">{t(S.webHint[role])}</p>}
          {b.err5.web && <Err lang={lang} text={webRequired && !b.web.trim() ? R.webReq : S.eWeb} />}
        </div>
      )}
      {!fix && <div className="su-info">{role === "seller" ? <Lock size={16} /> : role === "buyer" ? <EyeOff size={16} /> : <Eye size={16} />}<span>{t(agent ? S.privacyAgent : S.privacy5[role])}</span></div>}
      <div className="su-actions"><Back /><Primary busy={busy || (!!fix && (changesLeft <= 0 || !/^\d{13}$/.test(b.reg)))} lang={lang} type="submit" label={fix ? R.iConfirm : S.next} /></div>
    </form>
  </>;

  if (step === "sector") return <>
    <h1 ref={titleRef} tabIndex={-1}>{t(S.s7[role][0])}</h1>
    <p className="lg-cline su-line">{t(S.s7[role][1])}</p>
    <div className="su-sector">
      {role === "seller" ? (
        <SellerTypeQuestion pick={b.sPick} sector={b.sSector} onChange={(p, sec) => { b.setSPick(p); b.setSSector(sec); if (sec) b.setErr7(false); }} />
      ) : (
        <ManyTypeQuestion picks={b.picks} agnostic={b.agnostic} words={role === "buyer" ? buyerWords(Lx) : advisorWords(Lx)}
          onChange={(p, ag) => { b.setPicks(p); b.setAgnostic(ag); if (!manyError(p, ag, Lx)) b.setErr7(false); }} />
      )}
    </div>
    {err7Text && <div role="alert"><Err lang={lang} text={err7Text} /></div>}
    {fail && <Err lang={lang} text={S.other} />}
    <div className="su-actions"><Back /><Primary busy={busy} lang={lang} label={sectorAction?.label ?? S.next} busyLabel={sectorAction?.busyLabel ?? S.going} onClick={sectorContinue} /></div>
  </>;

  if (step === "logo") return <>
    <h1 ref={titleRef} tabIndex={-1}>{t(R.logoTitle)}</h1>
    <p className="lg-cline su-line">{t(R.logoHelp[role])}</p>
    <LogoPicker lang={lang} logo={b.logo} onChange={(l) => { b.setLogo(l); if (l) b.setLogoErr(false); }} showRequiredError={b.logoErr} />
    {fail && <Err lang={lang} text={S.other} />}
    <div className="su-actions"><Back /><Primary busy={busy} lang={lang} label={S.next} onClick={() => { if (!b.logo) { b.setLogoErr(true); return; } next("logo"); }} /></div>
  </>;
  return null;
}
export type { SignupStepKey };
