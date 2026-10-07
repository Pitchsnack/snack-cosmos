import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Briefcase, Building, Building2, Calculator, Calendar, ChartColumn, Check, ChevronDown,
  Circle, CircleAlert, Eye, EyeOff, Factory, FilePenLine, FileText, Gauge, Globe, Handshake, House, Landmark, LoaderCircle,
  Lock, LogOut, Mail, Rocket, Scale, Search, ShieldCheck, Sprout, Store, Tag, User, Users, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { finishSignup, getSignupState, saveSignupAnswers } from "@/lib/signup.functions";
import logoWhite from "@/assets/pitchsnack-white.png";
import streetSvg from "@/components/login/street.svg?raw";
import { L } from "@/components/login/login-copy";
import { ADVISOR_OPTS, BUYER_OPTS, S, SELLER_OPTS, type Role } from "@/components/login/signup-copy";
import "@/styles/login-page.css";
import "@/styles/signup-page.css";

const LANG_KEY = "ps-home-lang";
const PENDING_KEY = "ps-signup-pending";
const FONT_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600;700&family=Noto+Serif+Thai:wght@600;700&display=swap";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
type Lang = "th" | "en";
type T = { th: string; en: string };

const ICONS: Record<string, LucideIcon> = {
  store: Store, users: Users, "file-pen-line": FilePenLine, house: House, landmark: Landmark, rocket: Rocket,
  "building-2": Building2, factory: Factory, sprout: Sprout, user: User, handshake: Handshake, scale: Scale,
  calculator: Calculator, gauge: Gauge, briefcase: Briefcase, search: Search,
};
const POINT_ICONS: Record<Role | "none", LucideIcon[]> = {
  none: [Lock, ShieldCheck, Scale], seller: [EyeOff, LogOut, Tag], buyer: [ShieldCheck, FileText, Scale], advisor: [BadgeCheck, ChartColumn, EyeOff],
};
const ROLE_OF: Record<string, Role> = { seller: "seller", buyer: "buyer", partner: "advisor", advisor: "advisor" };
const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

export const Route = createFileRoute("/signup")({
  ssr: false,
  validateSearch: z.object({ role: z.string().optional(), email: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "PitchSnack · สมัครใช้งาน" },
      { name: "description", content: "Create your PitchSnack account as a seller, buyer or advisor in five short steps." },
      { property: "og:title", content: "PitchSnack · Sign up" },
      { property: "og:description", content: "Create your PitchSnack account as a seller, buyer or advisor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONT_URL },
    ],
  }),
  component: SignupPage,
});

type Pending = { role: Role; answer: string; first?: string; last?: string; email?: string; terms: boolean; news: boolean; provider?: string };
const readPending = (): Pending | null => { try { const r = localStorage.getItem(PENDING_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const writePending = (p: Pending | null) => { try { if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p)); else localStorage.removeItem(PENDING_KEY); } catch { /* noop */ } };

export function myCompanyPath(role: Role) { return role === "seller" ? "/my-startups" : "/marketplace/my-company"; }
function setPersona(userId: string, role: Role) {
  try {
    localStorage.setItem(`ps.persona.${userId}`, role);
    if (role !== "advisor") localStorage.setItem(`ps.persona.${userId}.base`, role);
  } catch { /* noop */ }
}

function SignupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const fetchState = useServerFn(getSignupState);
  const saveAnswers = useServerFn(saveSignupAnswers);
  const finish = useServerFn(finishSignup);

  const [lang, setLangState] = useState<Lang>("th");
  const t = (x: T) => x[lang];
  const fill = (x: T, k: string, v: string | number) => t(x).replace(`{${k}}`, String(v));
  const preRole = search.role ? ROLE_OF[search.role] : undefined;
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(preRole ? 2 : 1);
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(preRole ?? null);
  const [answers, setAnswers] = useState<Record<Role, string | null>>({ seller: null, buyer: null, advisor: null });
  const [pickErr, setPickErr] = useState(false);
  // step 3
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [email, setEmail] = useState(search.email ?? ""); const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false); const [terms, setTerms] = useState(false); const [news, setNews] = useState(false);
  const [err3, setErr3] = useState<Record<string, boolean>>({}); const [taken, setTaken] = useState(false); const [fail, setFail] = useState(false);
  const [busy, setBusy] = useState(false);
  // step 4
  const [code, setCode] = useState(["", "", "", "", "", ""]); const [codeErr, setCodeErr] = useState<null | "short" | "bad">(null);
  const [wait, setWait] = useState(30); const [sentNote, setSentNote] = useState(false);
  // step 5
  const [provider, setProvider] = useState<string | null>(null);
  const [coName, setCoName] = useState(""); const [year, setYear] = useState(""); const [size, setSize] = useState(""); const [web, setWeb] = useState("");
  const [err5, setErr5] = useState<Record<string, boolean>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { const l = localStorage.getItem(LANG_KEY); if (l === "en" || l === "th") setLangState(l); } catch { /* noop */ } }, []);
  useEffect(() => {
    const html = document.documentElement; const prev = { lang: html.lang, size: html.style.fontSize };
    html.lang = lang; html.style.fontSize = lang === "th" ? "17.5px" : "16px"; document.title = S.title[lang];
    return () => { html.lang = prev.lang || "en"; html.style.fontSize = prev.size; };
  }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* noop */ } };

  // Resume: a signed-in visitor lands on the right step, or where they land today.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const p = readPending();
        if (p && search.email && p.email === search.email) {
          setRole(p.role); setAnswers((a) => ({ ...a, [p.role]: p.answer })); setEmail(p.email); setFirst(p.first ?? ""); setLast(p.last ?? "");
          setTerms(p.terms); setNews(p.news); setStep(4); void supabase.auth.resend({ type: "signup", email: p.email });
        }
        setReady(true); return;
      }
      const uid = data.session.user.id;
      try {
        let s = await fetchState();
        const p = readPending();
        if (!s.answers && p) {
          await saveAnswers({ data: { role: p.role, firstAnswer: p.answer, firstName: p.first, lastName: p.last, terms: p.terms, news: p.news, provider: p.provider } });
          s = await fetchState();
        }
        writePending(null);
        if (!s.answers) { navigate({ to: "/tenants" }); return; }
        if (s.answers.done_at) { setPersona(uid, s.answers.role); navigate({ to: myCompanyPath(s.answers.role) }); return; }
        setRole(s.answers.role); setAnswers((a) => ({ ...a, [s.answers!.role]: s.answers!.first_answer })); setEmail(s.email);
        setProvider(s.provider && s.provider !== "email" ? s.provider : null);
        setStep(s.confirmed ? 5 : 4);
      } catch { /* show step 1 */ }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready) { titleRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); } }, [step, ready]);
  useEffect(() => {
    if (step !== 4 || wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(id);
  }, [step, wait]);

  const street = useMemo(() => { let i = 0; return streetSvg.replace(/(<text class="ps-sign"[^>]*>)[^<]*(<\/text>)/g, (_m: string, a: string, b: string) => a + L.signs[i++][lang] + b); }, [lang]);
  const answer = role ? answers[role] : null;
  const opts = role === "seller" ? SELLER_OPTS : role === "buyer" ? BUYER_OPTS : ADVISOR_OPTS;
  const answerLabel = opts.find((o) => o.v === answer)?.t;
  const individual = role === "buyer" && answer === "Individual Investor";
  const stepNames = [S.stepRole, role ? S.step2[role] : S.step2.seller, S.stepAcc, S.stepCode, S.stepCo];
  const pts = S.points[role ?? "none"];
  const ptIcons = POINT_ICONS[role ?? "none"];

  const rules = [pw.length >= 8, /[A-Za-z\u0E00-\u0E7F]/.test(pw), /\d/.test(pw)];
  const go = (n: 1 | 2 | 3 | 4 | 5) => { setPickErr(false); setStep(n); };

  function pick(v: string, auto: boolean) {
    if (!role) return;
    setAnswers((a) => ({ ...a, [role]: v })); setPickErr(false);
    if (auto) setTimeout(() => setStep(3), 250);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault(); if (busy || !role || !answer) return;
    const errs = { first: !first.trim(), last: !last.trim(), email: !EMAIL_RE.test(email.trim()), pw: !rules.every(Boolean), terms: !terms };
    setErr3(errs); setTaken(false); setFail(false);
    const firstBad = (["first", "last", "email", "pw", "terms"] as const).find((k) => errs[k]);
    if (firstBad) { document.getElementById(`su-${firstBad}`)?.focus(); return; }
    setBusy(true);
    const pend: Pending = { role, answer, first: first.trim(), last: last.trim(), email: email.trim(), terms, news };
    writePending(pend);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: pw,
      options: { emailRedirectTo: `${window.location.origin}/signup`, data: { first_name: first.trim(), last_name: last.trim() } },
    });
    setBusy(false);
    if (error) {
      if (/registered|exists/i.test(error.message)) { setTaken(true); emailRef.current?.focus(); } else setFail(true);
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) { setTaken(true); emailRef.current?.focus(); return; }
    if (data.session) {
      // Auto-confirm is on: account is already verified and signed in, so skip the code step.
      setBusy(true);
      try {
        await saveAnswers({ data: { role: pend.role, firstAnswer: pend.answer, firstName: pend.first, lastName: pend.last, terms: pend.terms, news: pend.news } });
        writePending(null);
      } catch { /* answers are retried from pending on next load */ }
      setBusy(false);
      go(5);
      return;
    }
    setCode(["", "", "", "", "", ""]); setCodeErr(null); setWait(30); go(4);
  }

  async function oauth(p: "google" | "azure") {
    if (busy || !role || !answer) { setPickErr(true); return; }
    setBusy(true);
    writePending({ role, answer, terms: true, news, provider: p });
    if (p === "google") {
      const { lovable } = await import("@/integrations/lovable/index");
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/signup` });
      if (r.error) { setBusy(false); setFail(true); return; }
      if (r.redirected) return;
      window.location.reload();
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: `${window.location.origin}/signup` } });
    if (error) { setBusy(false); setFail(true); }
  }

  async function confirmCode(digits = code) {
    const token = digits.join("");
    if (token.length < 6) { setCodeErr("short"); codeRefs.current[digits.findIndex((d) => !d)]?.focus(); return; }
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "signup" });
    if (error || !data.session) {
      setBusy(false); setCodeErr("bad"); setCode(["", "", "", "", "", ""]); codeRefs.current[0]?.focus(); return;
    }
    const p = readPending();
    try {
      await saveAnswers({ data: { role: role!, firstAnswer: answer!, firstName: p?.first ?? first, lastName: p?.last ?? last, terms: p?.terms ?? terms, news: p?.news ?? news } });
      writePending(null);
    } catch { /* retried on resume */ }
    setBusy(false); go(5);
  }

  async function resend() {
    await supabase.auth.resend({ type: "signup", email: email.trim() });
    setCode(["", "", "", "", "", ""]); setCodeErr(null); setWait(30); setSentNote(true); setTimeout(() => setSentNote(false), 3000);
    codeRefs.current[0]?.focus();
  }

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (d.length > 1) { // paste
      const next = d.slice(0, 6).split(""); while (next.length < 6) next.push("");
      setCode(next); setCodeErr(null);
      if (d.length >= 6) void confirmCode(next); else codeRefs.current[d.length]?.focus();
      return;
    }
    const next = [...code]; next[i] = d; setCode(next); setCodeErr(null);
    if (d && i < 5) codeRefs.current[i + 1]?.focus();
    if (d && next.every(Boolean)) void confirmCode(next);
  }

  const yearMsg = (): T | string | null => {
    if (individual) return null;
    const y = year; const now = new Date().getFullYear();
    if (!y) return S.eYear[role!];
    if (!/^\d{4}$/.test(y)) return S.eYear4;
    const n = Number(y);
    if (n > now && n - 543 >= 1800 && n - 543 <= now) return fill(S.eYearBE, "y", n - 543);
    if (n < 1800 || n > now) return fill(S.eYearRange, "y", now);
    return null;
  };
  const sizeBad = () => !individual && (role === "advisor" ? !/^[1-9]\d{0,4}$/.test(size) : !SIZES.includes(size));
  const webBad = () => !!web.trim() && !WEB_RE.test(web.trim());

  async function goMyCompany(e: React.FormEvent) {
    e.preventDefault(); if (busy || !role) return;
    const errs = { name: coName.trim().length < 2, year: !!yearMsg(), size: sizeBad(), web: webBad() };
    setErr5(errs);
    const firstBad = (["name", "year", "size", "web"] as const).find((k) => errs[k]);
    if (firstBad) { document.getElementById(`su-${firstBad}`)?.focus(); return; }
    setBusy(true);
    try {
      const res = await finish({ data: {
        name: coName.trim(), year: individual ? null : year, size: individual ? null : size,
        website: web.trim() ? web.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "") : null,
      } });
      const { data } = await supabase.auth.getSession();
      if (data.session) setPersona(data.session.user.id, res.role);
      await qc.invalidateQueries();
      navigate({ to: myCompanyPath(res.role) });
    } catch { setBusy(false); setFail(true); }
  }

  const Switch = ({ navy }: { navy?: boolean }) => (
    <div role="group" aria-label="ภาษา / Language" className={navy ? "lg-sw navy" : "lg-sw"}>
      {!navy && <Globe size={16} />}
      <button type="button" aria-pressed={lang === "th"} onClick={() => setLang("th")}>ไทย</button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
    </div>
  );
  const Err = ({ text, id }: { text: T | string; id?: string }) => (
    <div className="lg-err" id={id}><CircleAlert size={15} />{typeof text === "string" ? text : t(text)}</div>
  );
  const msgYear = err5.year ? yearMsg() : null;

  const Choice = ({ o, name, big, tone }: { o: { v: string; icon: string; t: T; l: T; k?: string }; name: string; big?: boolean; tone: string }) => {
    const Icon = ICONS[o.icon] ?? Circle;
    const checked = big ? role === o.v : answer === o.v;
    return (
      <label className={`su-choice ${big ? "big" : "small"} ${checked ? "on" : ""}`}
        onClick={(e) => { if (!big && e.detail > 0) pick(o.v, true); }}>
        <input type="radio" name={name} value={o.v} checked={checked}
          onChange={() => (big ? (setRole(o.v as Role), setPickErr(false)) : pick(o.v, false))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); big ? go(2) : (pick(o.v, false), go(3)); } }} />
        <span className={`su-tile t-${tone}`}><Icon size={big ? 22 : 19} /></span>
        <span className="su-ct"><b>{t(o.t)}</b><small>{t(o.l)}</small></span>
        <span className="su-radio" aria-hidden />
      </label>
    );
  };

  const Primary = ({ label, busyLabel, onClick, type = "button" }: { label: T; busyLabel?: T; onClick?: () => void; type?: "button" | "submit" }) => (
    <button type={type} className="lg-btn su-grow" disabled={busy} onClick={onClick}>
      {busy && busyLabel ? <>{t(busyLabel)}<LoaderCircle size={18} className="lg-spin" /></> : <>{t(label)}<ArrowRight size={18} /></>}
    </button>
  );
  const BackBtn = ({ to }: { to: 1 | 2 }) => (
    <button type="button" className="su-back" disabled={busy} onClick={() => go(to)}><ArrowLeft size={17} />{t(S.back)}</button>
  );

  return (
    <div className="lg su" data-lang={lang}>
      <aside className="lg-left">
        <div className="lg-ltop">
          <Link to="/" className="lg-logo" title={t(L.logo)} aria-label={t(L.logo)}><img src={logoWhite} alt="" /></Link>
          <Switch navy />
        </div>
        <div className="lg-text">
          <span className="lg-chip"><Store size={15} /><span>{t(L.chipA)}<b>{t(L.chipB)}</b></span></span>
          <p className="lg-head"><span>{t(L.h1)}</span><span className="am">{t(L.h2)}</span></p>
          <p className="lg-intro">{t(S.intro)}</p>
          <ul className="lg-points su-fade" key={`${role}-${lang}`}>
            {pts.map((p, i) => { const I = ptIcons[i]; return <li key={i}><i><I size={18} strokeWidth={1.8} /></i>{t(p)}</li>; })}
          </ul>
        </div>
        <div className="lg-street">
          <div dangerouslySetInnerHTML={{ __html: street }} />
          <span className="lg-foot">Powered by SnackPortal2</span>
        </div>
      </aside>

      <main className="lg-right">
        <div className="lg-rtop">
          <Link to="/" className="lg-back"><ArrowLeft size={17} />{t(L.back)}</Link>
          <Switch />
        </div>
        <div className="lg-mid">
          <div className="lg-col su-col">
            <div className="lg-card su-card">
              <div className="su-prog">
                <div className="su-prow"><b>{t(stepNames[step - 1])}</b><span>{fill(S.progress, "n", step)}</span></div>
                <div className="su-bars">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= step ? "on" : ""} />)}</div>
              </div>
              {!ready ? <div className="su-load"><LoaderCircle className="lg-spin" /></div> : (
                <div className="su-step" key={step}>
                  {step === 1 && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s1Title)}</h1>
                    <p className="lg-cline su-line">{t(S.s1Line)}</p>
                    <fieldset className="su-cards big">
                      <legend className="sr-only">{t(S.s1Legend)}</legend>
                      {(["seller", "buyer", "advisor"] as Role[]).map((r) => (
                        <Choice key={r} name="role" big tone={r} o={{ v: r, icon: r === "seller" ? "store" : r === "buyer" ? "search" : "briefcase", t: S.roles[r][0], l: S.roles[r][1] }} />
                      ))}
                    </fieldset>
                    {pickErr && <Err text={S.pickOne} />}
                    <div className="su-actions">
                      <Primary label={S.next} onClick={() => { if (!role) { setPickErr(true); document.querySelector<HTMLInputElement>(".su-cards input")?.focus(); } else go(2); }} />
                    </div>
                  </>}

                  {step === 2 && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s2[role][0])}</h1>
                    <p className="lg-cline su-line">{t(S.s2[role][1])}</p>
                    <fieldset className="su-cards small">
                      <legend className="sr-only">{t(S.s2[role][0])}</legend>
                      {opts.map((o) => <Choice key={o.v} o={o} name={`a-${role}`} tone={role === "buyer" ? `b-${(o as { k?: string }).k}` : role} />)}
                    </fieldset>
                    {pickErr && <Err text={S.pickOne} />}
                    <div className="su-actions">
                      <BackBtn to={1} />
                      <Primary label={S.next} onClick={() => { if (!answer) { setPickErr(true); document.querySelector<HTMLInputElement>(".su-cards input")?.focus(); } else go(3); }} />
                    </div>
                  </>}

                  {step === 3 && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s3Title)}</h1>
                    <p className="lg-cline su-line">{t(S.s3Line)}</p>
                    <span className={`su-chip t-${role}`}>
                      {t(S.chipFor)} {t(S.chipRole[role])}{answerLabel ? ` · ${t(answerLabel)}` : ""}
                      <button type="button" onClick={() => go(1)}>{t(S.change)}</button>
                    </span>
                    <form className="su-form" onSubmit={createAccount} noValidate>
                      <div className="su-row2">
                        <div className="lg-fg">
                          <label className="lg-label" htmlFor="su-first">{t(S.first)}</label>
                          <div className={`lg-field su-f ${err3.first ? "bad" : ""}`}><User size={18} />
                            <input id="su-first" autoComplete="given-name" value={first} onChange={(e) => { setFirst(e.target.value); if (e.target.value.trim()) setErr3((x) => ({ ...x, first: false })); }} /></div>
                          {err3.first && <Err text={S.eFirst} />}
                        </div>
                        <div className="lg-fg">
                          <label className="lg-label" htmlFor="su-last">{t(S.last)}</label>
                          <div className={`lg-field su-f ${err3.last ? "bad" : ""}`}>
                            <input id="su-last" autoComplete="family-name" value={last} onChange={(e) => { setLast(e.target.value); if (e.target.value.trim()) setErr3((x) => ({ ...x, last: false })); }} /></div>
                          {err3.last && <Err text={S.eLast} />}
                        </div>
                      </div>
                      <div className="lg-fg">
                        <label className="lg-label" htmlFor="su-email">{t(S.email)}</label>
                        <div className={`lg-field su-f ${err3.email || taken ? "bad" : ""}`}><Mail size={18} />
                          <input ref={emailRef} id="su-email" type="email" autoComplete="email" placeholder={t(S.emailPh)} value={email}
                            onChange={(e) => { setEmail(e.target.value); setTaken(false); if (EMAIL_RE.test(e.target.value.trim())) setErr3((x) => ({ ...x, email: false })); }} /></div>
                        {err3.email && <Err text={S.eEmail} />}
                        {taken && <div className="lg-err"><CircleAlert size={15} />{t(S.taken)} <Link to="/login" search={{ email: email.trim() } as never} className="lg-link">{t(S.signIn)}</Link></div>}
                      </div>
                      <div className="lg-fg">
                        <label className="lg-label" htmlFor="su-pw">{t(S.pw)}</label>
                        <div className={`lg-field pw su-f ${err3.pw ? "bad" : ""}`}><Lock size={18} />
                          <input id="su-pw" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t(S.pwPh)} value={pw}
                            onChange={(e) => { setPw(e.target.value); setErr3((x) => ({ ...x, pw: false })); }} />
                          <button type="button" className="lg-eye" aria-pressed={showPw} aria-label={t(showPw ? S.hide : S.show)} onClick={() => setShowPw((v) => !v)}>
                            {showPw ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                        </div>
                        <ul className="su-rules">
                          {S.rules.map((r, i) => <li key={i} className={rules[i] ? "ok" : err3.pw ? "bad" : ""}>{rules[i] ? <Check size={14} /> : <Circle size={14} />}{t(r)}</li>)}
                        </ul>
                        {err3.pw && <Err text={S.ePw} />}
                      </div>
                      <div className="su-checks">
                        <label className="lg-check"><input id="su-terms" type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErr3((x) => ({ ...x, terms: false })); }} />
                          <span>{t(S.termsA)}<a href="#" className="lg-link">{t(S.terms)}</a>{t(S.and)}<a href="#" className="lg-link">{t(S.privacy)}</a></span></label>
                        {err3.terms && <Err text={S.eTerms} />}
                        <label className="lg-check"><input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} /><span>{t(S.news)}</span></label>
                      </div>
                      {fail && <Err text={S.other} />}
                      <div className="su-actions"><BackBtn to={2} /><Primary type="submit" label={S.create} busyLabel={S.creating} /></div>
                    </form>
                    <div className="lg-div">{t(S.divider)}</div>
                    <div className="lg-prov su-prov">
                      <button type="button" disabled={busy} onClick={() => void oauth("google")}><GoogleIcon />Google</button>
                      <button type="button" disabled={busy} onClick={() => void oauth("azure")}><MicrosoftIcon />Microsoft</button>
                    </div>
                  </>}

                  {step === 4 && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s4Title)}</h1>
                    <p className="lg-cline su-line">{t(S.s4A)}<b>{email}</b>{t(S.s4B)}</p>
                    <form onSubmit={(e) => { e.preventDefault(); void confirmCode(); }} noValidate>
                      <fieldset className="su-code">
                        <legend className="sr-only">{t(S.codeLegend)}</legend>
                        {code.map((d, i) => (
                          <input key={i} ref={(el) => { codeRefs.current[i] = el; }} className={codeErr ? "bad" : ""} inputMode="numeric"
                            autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`${i + 1}`} maxLength={i === 0 ? 6 : 1} value={d}
                            onChange={(e) => setDigit(i, e.target.value)}
                            onPaste={(e) => { e.preventDefault(); setDigit(0, e.clipboardData.getData("text")); }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !d && i > 0) { e.preventDefault(); const n = [...code]; n[i - 1] = ""; setCode(n); codeRefs.current[i - 1]?.focus(); }
                              if (e.key === "ArrowLeft" && i > 0) codeRefs.current[i - 1]?.focus();
                              if (e.key === "ArrowRight" && i < 5) codeRefs.current[i + 1]?.focus();
                            }} />
                        ))}
                      </fieldset>
                      {codeErr && <Err text={codeErr === "short" ? S.eCode6 : S.eCode} />}
                      <div className="su-actions"><Primary type="submit" label={S.confirm} busyLabel={S.confirming} /></div>
                    </form>
                    <p className="su-resend">
                      {wait > 0 ? <>{t(S.wait)}0:{String(wait).padStart(2, "0")}</> : <>{t(S.resendA)}<button type="button" className="su-tl" onClick={() => void resend()}>{t(S.resend)}</button></>}
                    </p>
                    {sentNote && <p className="su-sent">{t(S.sent)}</p>}
                    <p className="su-hint">{t(S.hint)}<button type="button" className="su-tl" onClick={() => { go(3); setTimeout(() => emailRef.current?.select(), 50); }}>{t(S.other_email)}</button></p>
                  </>}

                  {step === 5 && role && <>
                    <span className="su-ok"><Check size={15} />{provider ? fill(S.okProv, "p", provider === "azure" ? "Microsoft" : "Google") : t(S.okEmail)}</span>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s5Title[role])}</h1>
                    <p className="lg-cline su-line">{t(S.s5Line[role])}</p>
                    <form className="su-form" onSubmit={goMyCompany} noValidate>
                      <div className="lg-fg">
                        <label className="lg-label" htmlFor="su-name">{t(S.nameL[role])}</label>
                        <div className={`lg-field su-f ${err5.name ? "bad" : ""}`}><Building size={18} />
                          <input id="su-name" maxLength={120} placeholder={t(S.namePh[role])} value={coName}
                            onChange={(e) => { setCoName(e.target.value); if (e.target.value.trim().length >= 2) setErr5((x) => ({ ...x, name: false })); }} /></div>
                        {S.nameHint[role] && <p className="su-fhint">{t(S.nameHint[role]!)}</p>}
                        {err5.name && <Err text={S.nameErr[role]} />}
                      </div>
                      {!individual && <div>
                        <div className="su-row23">
                          <div className="lg-fg">
                            <label className="lg-label" htmlFor="su-year">{t(S.year)}</label>
                            <div className={`lg-field su-f ${err5.year ? "bad" : ""}`}><Calendar size={18} />
                              <input id="su-year" inputMode="numeric" maxLength={4} placeholder={t(S.yearPh)} value={year}
                                onChange={(e) => { setYear(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr5((x) => ({ ...x, year: false })); }} /></div>
                          </div>
                          <div className="lg-fg">
                            <label className="lg-label" htmlFor="su-size">{t(role === "advisor" ? S.sizeAdv : S.size)}</label>
                            {role === "advisor" ? (
                              <div className={`lg-field su-f ${err5.size ? "bad" : ""}`}><Users size={18} />
                                <input id="su-size" inputMode="numeric" placeholder={t(S.sizeAdvPh)} value={size}
                                  onChange={(e) => { setSize(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 5)); setErr5((x) => ({ ...x, size: false })); }} />
                                <span className="su-unit">{t(S.people)}</span></div>
                            ) : (
                              <div className={`lg-field su-f su-sel ${err5.size ? "bad" : ""} ${size ? "" : "ph"}`}><Users size={18} />
                                <select id="su-size" value={size} onChange={(e) => { setSize(e.target.value); setErr5((x) => ({ ...x, size: false })); }}>
                                  <option value="" disabled>{t(S.sizePick)}</option>
                                  {SIZES.map((s) => <option key={s} value={s}>{s === "500+" ? t(S.sizeMore) : s.replace("-", "–")}</option>)}
                                </select><ChevronDown size={16} /></div>
                            )}
                          </div>
                        </div>
                        {msgYear && <Err text={msgYear} />}
                        {err5.size && <Err text={role === "advisor" ? S.eSizeAdv : S.eSize} />}
                      </div>}
                      <div className="lg-fg">
                        <label className="lg-label" htmlFor="su-web">{t(S.web)} <span className="su-opt">{t(S.optional)}</span></label>
                        <div className={`lg-field su-f ${err5.web ? "bad" : ""}`}><Globe size={18} />
                          <input id="su-web" inputMode="url" placeholder={role === "seller" ? "www.yourcompany.com" : "www.yourfirm.com"} value={web}
                            onChange={(e) => { setWeb(e.target.value); setErr5((x) => ({ ...x, web: false })); }} /></div>
                        <p className="su-fhint">{t(S.webHint[role])}</p>
                        {err5.web && <Err text={S.eWeb} />}
                      </div>
                      <div className="su-info">{role === "seller" ? <Lock size={16} /> : role === "buyer" ? <EyeOff size={16} /> : <Eye size={16} />}<span>{t(S.privacy5[role])}</span></div>
                      {fail && <Err text={S.other} />}
                      <div className="su-actions"><Primary type="submit" label={S.go} busyLabel={S.going} /></div>
                    </form>
                  </>}
                </div>
              )}
            </div>
            {step <= 3 && <p className="lg-noacc">{t(S.haveAcc)} <Link to="/login">{t(S.signIn)}</Link></p>}
            <p className="lg-pw2">Powered by SnackPortal2</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}
function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" /><rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" /><rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}
