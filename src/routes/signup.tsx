import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Briefcase, Building, Building2, Calculator, Calendar, ChartColumn, Check, ChevronDown,
  Circle, CircleAlert, Eye, EyeOff, Factory, FilePenLine, FileText, Gauge, Globe, Handshake, House, Landmark, LoaderCircle,
  Info, Lock, LogIn, LogOut, Mail, MailCheck, Rocket, Ticket, Scale, Search, ShieldCheck, Sprout, Store, Tag, User, Users, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buyOrderInvite } from "@/lib/buy-orders.functions";
import { getSignupState, saveSignupAnswers, saveSignupSector } from "@/lib/signup.functions";
import { confirmRegCompany, getRegState, rejectRegCompany, runRegCheck, startRegPrecheck, savePendingSignup, sendSetupRequest, type RegCheck, type RegCompany } from "@/lib/signup-reg.functions";
import { digitsOnly, isValidThaiReg, normWebsite, REG_CHANGES, signupSteps, type SignupStepKey as StepKey } from "@/lib/thai-reg";
import { COUNTRIES } from "@/lib/investor-bands";
import { R, type SetupReason } from "@/components/login/signup-reg-copy";
import { CompanyRows, ConfirmRegDialog, FoundDialog, LogoPicker, NotFoundDialog, SetupRequest, SimpleDialog, VerifyingDialog, type HeldLogo } from "@/components/login/signup-reg-parts";
import { SellerTypeQuestion, ManyTypeQuestion, buyerWords, advisorWords, manyError } from "@/components/common/business-type-question";
import { EMPTY_PICKS, type SectorPick, type SectorPicks } from "@/lib/business-types";
import { useTranslation } from "@/i18n/language";
import logoWhite from "@/assets/pitchsnack-white.png";
import streetSvg from "@/components/login/street.svg?raw";
import { L } from "@/components/login/login-copy";
import { ADVISOR_OPTS, BUYER_OPTS, BUYER_REL_OPTS, S, SELLER_OPTS, type Role } from "@/components/login/signup-copy";
import "@/styles/login-page.css";
import "@/styles/signup-page.css";
import { DiscoveryWaiting, DiscoveryBack, DiscoveryLoginPrompt, useDiscoveryPending } from "@/components/public-site/discovery-auth";
import { readDiscoveryPending } from "@/lib/discovery";
import { AccessGate, useClaimSeat, useGate } from "@/components/access-gate/access-gate";
import { G, months as monthsText } from "@/components/access-gate/access-copy";
import { sc } from '@/i18n/sidebar-share';

const LANG_KEY = "ps-home-lang";
const PENDING_KEY = "ps-signup-pending";
const DEVICE_KEY = "ps-device-id";
const PRE_KEY = "ps-signup-pre";
/** The sign-up session id that holds the background company check (random, browser-only). */
const readPre = () => { try { return localStorage.getItem(PRE_KEY) ?? undefined; } catch { return undefined; } };
const clearPre = () => { try { localStorage.removeItem(PRE_KEY); } catch { /* noop */ } };
function newPre() { const id = crypto.randomUUID() + crypto.randomUUID().slice(0, 8); try { localStorage.setItem(PRE_KEY, id); } catch { /* noop */ } return id; }
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
  validateSearch: z.object({ role: z.string().optional(), email: z.string().optional(), join: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "PitchSnack · สมัครใช้งาน" },
      { name: "description", content: "Create your PitchSnack account as a seller, buyer or advisor in a few short steps." },
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

type Held = {
  company?: { name: string; size: string | null; website: string | null; country: string };
  reg?: string;
  sector?: { sector?: string | null; pick?: SectorPick | null; picks?: SectorPicks | null; agnostic?: boolean };
  logo?: HeldLogo | null;
};
type Pending = { role: Role; answer: string; types?: string[]; first?: string; last?: string; email?: string; terms: boolean; news: boolean; provider?: string } & Held;
const readPending = (): Pending | null => { try { const r = localStorage.getItem(PENDING_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const writePending = (p: Pending | null) => { try { if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p)); else localStorage.removeItem(PENDING_KEY); } catch { /* noop */ } };
/** A random id kept in this browser; with the IP address it is the "device" for the lookup limit. */
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return "no-storage-" + Math.random().toString(36).slice(2, 12); }
}

export function myCompanyPath(role: Role) { return role === "seller" ? "/my-startups" : "/marketplace/my-company"; }
function setPersona(userId: string, role: Role) {
  try {
    localStorage.setItem(`ps.persona.${userId}`, role);
    if (role !== "advisor") localStorage.setItem(`ps.persona.${userId}.base`, role);
  } catch { /* noop */ }
}

function SignupPage() {
  const [lang,setLang] = useState<Lang>('th');
  useEffect(()=>{const l=localStorage.getItem(LANG_KEY);if(l==='en'||l==='th')setLang(l);},[]);
  return <><AccessGate claimInBackground={false}><SignupInner /></AccessGate><DiscoveryLoginPrompt lang={lang}/></>;
}

type Dlg = null | "confirm" | "verifying" | "found" | "nf" | "limit" | "contact" | "unavailable";
type Fix = null | { why: "no" | "nf"; old: string; co?: RegCompany };

function SignupInner() {
  const navigate = useNavigate();
  const gate = useGate();
  const claimSeat = useClaimSeat();
  const [full, setFull] = useState(false);
  const search = Route.useSearch();
  const discoveryPending = useDiscoveryPending();
  const qc = useQueryClient();
  const fetchState = useServerFn(getSignupState);
  const saveAnswers = useServerFn(saveSignupAnswers);
  const saveSector = useServerFn(saveSignupSector);
  const fetchReg = useServerFn(getRegState);
  const savePending = useServerFn(savePendingSignup);
  const runCheck = useServerFn(runRegCheck);
  const startPre = useServerFn(startRegPrecheck);
  const rejectCo = useServerFn(rejectRegCompany);
  const confirmCo = useServerFn(confirmRegCompany);
  const sendSetup = useServerFn(sendSetupRequest);
  const { setLanguage: setAppLang } = useTranslation();

  const [lang, setLangState] = useState<Lang>("th");
  const t = (x: T) => x[lang];
  const fill = (x: T, vars: Record<string, string | number>) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), t(x));
  const preRole = search.role ? ROLE_OF[search.role] : undefined;
  const [step, setStep] = useState<StepKey>(preRole ? "about" : "role");
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(preRole ?? null);
  const [answers, setAnswers] = useState<Record<Role, string | null>>({ seller: null, buyer: null, advisor: null });
  const [pickErr, setPickErr] = useState(false);
  const [corpType, setCorpType] = useState<string | null>(null);
  const [agentTypes, setAgentTypes] = useState<string[]>([]);
  // Account
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [email, setEmail] = useState(search.email ?? ""); const [pw, setPw] = useState("");
  useEffect(() => { if (gate.invitationEmail) setEmail(gate.invitationEmail); }, [gate.invitationEmail]);
  const [showPw, setShowPw] = useState(false); const [terms, setTerms] = useState(false); const [news, setNews] = useState(false);
  const [err3, setErr3] = useState<Record<string, boolean>>({}); const [taken, setTaken] = useState(false); const [fail, setFail] = useState(false);
  const [busy, setBusy] = useState(false);
  const boInviteFn = useServerFn(buyOrderInvite);
  const [boInv, setBoInv] = useState<{ email: string; sender: string; name: string; ref: string } | null>(null);
  useEffect(() => { if (search.join) boInviteFn({ data: { token: search.join } }).then(setBoInv, () => {}); }, [search.join]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (boInv) setEmail(boInv.email); }, [boInv]);
  const boPath = boInv ? `/marketplace/businesses-wanted?bo=${encodeURIComponent(boInv.ref)}` : null;
  // Confirm email
  const [code, setCode] = useState(["", "", "", "", "", ""]); const [codeErr, setCodeErr] = useState<null | "short" | "bad">(null);
  const [wait, setWait] = useState(30); const [sentNote, setSentNote] = useState(false);
  // Your company
  const [country, setCountry] = useState("Thailand");
  const [coName, setCoName] = useState(""); const [size, setSize] = useState(""); const [web, setWeb] = useState("");
  const [reg, setReg] = useState(""); const [regLocked, setRegLocked] = useState(false);
  const [err5, setErr5] = useState<Record<string, boolean>>({});
  const [sameErr, setSameErr] = useState(false);
  const [noNumber, setNoNumber] = useState(false);
  const [fix, setFix] = useState<Fix>(null);
  const regRef = useRef<HTMLInputElement>(null);
  // Sector
  const [sPick, setSPick] = useState<SectorPick | null>(null); const [sSector, setSSector] = useState<string | null>(null);
  const [picks, setPicks] = useState<SectorPicks>(EMPTY_PICKS); const [agnostic, setAgnostic] = useState(false);
  const [err7, setErr7] = useState(false);
  const [legacy, setLegacy] = useState(false);
  // Logo
  const [logo, setLogo] = useState<HeldLogo | null>(null); const [logoErr, setLogoErr] = useState(false);
  // The check
  const [dlg, setDlg] = useState<Dlg>(null);
  const [found, setFound] = useState<RegCompany | null>(null);
  const [changes, setChanges] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [setupCard, setSetupCard] = useState<null | "check_failed" | "too_many">(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { const l = localStorage.getItem(LANG_KEY); if (l === "en" || l === "th") setLangState(l); } catch { /* noop */ } }, []);
  useEffect(() => {
    const html = document.documentElement; const prev = { lang: html.lang, size: html.style.fontSize };
    html.lang = lang; html.style.fontSize = lang === "th" ? "17.5px" : "16px"; document.title = S.title[lang];
    return () => { html.lang = prev.lang || "en"; html.style.fontSize = prev.size; };
  }, [lang]);
  useEffect(() => { setAppLang(lang); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* noop */ } };

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

  /** The check: runs on the server only once the email is confirmed. */
  async function startCheck(newReg?: string) {
    setCheckBusy(true);
    // A finished background check opens at once; "Verifying…" shows only while one is still running.
    const pre = newReg ? undefined : readPre();
    if (newReg || !pre) setDlg("verifying");
    const slow = pre && !newReg ? setTimeout(() => setDlg((d) => d ?? "verifying"), 700) : undefined;
    let r: RegCheck;
    for (;;) {
      try { r = await runCheck({ data: { deviceId: deviceId(), ...(newReg ? { newReg } : {}), ...(pre ? { pre } : {}) } }); }
      catch { r = { status: "unavailable" }; }
      if (r.status !== "running") break;
      setDlg("verifying");
      await new Promise((res) => setTimeout(res, 3000));
    }
    if (slow) clearTimeout(slow);
    if (!newReg) clearPre();
    setCheckBusy(false);
    if (newReg && (r.status === "found" || r.status === "not_found")) { setChanges((c) => c + 1); setReg(newReg); setFix(null); setRegLocked(true); }
    if (r.status === "found" || r.status === "not_found") setTried((l) => Array.from(new Set([...l, r.reg])));
    if (r.status === "found") { setFound(r.company); setDlg("found"); }
    else if (r.status === "not_found") setDlg((newReg ? changes + 1 : changes) < REG_CHANGES ? "nf" : "contact");
    else if (r.status === "rejected") { setFix({ why: "no", old: r.reg }); setDlg(null); setStep("company"); }
    else setDlg(r.status === "limit" ? "limit" : "unavailable");
  }

  /** Answers move from the browser to the pending sign-up once the sign-in user exists. */
  async function persist(p: Pending | null) {
    const src = p ?? { role: role!, answer: answer!, types, first, last, terms, news, ...held() };
    await saveAnswers({ data: { role: src.role, firstAnswer: src.answer, investorTypes: src.types, firstName: src.first, lastName: src.last, terms: src.terms, news: src.news, provider: src.provider } });
    if (src.company && src.reg) {
      await savePending({ data: { company: src.company, reg: src.reg, sector: (src.sector ?? {}) as never, logo: src.logo ?? null, lang } });
    }
    writePending(null);
  }

  // Resume: a signed-in visitor lands where they stopped.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const p = readPending();
        if (p) {
          setRole(p.role); setAnswers((a) => ({ ...a, [p.role]: p.answer })); restoreTypes(p.answer, p.types); restoreHeld(p);
          setFirst(p.first ?? ""); setLast(p.last ?? ""); setTerms(p.terms); setNews(p.news);
          if (p.email && search.email && p.email === search.email) { setEmail(p.email); setStep("code"); void supabase.auth.resend({ type: "signup", email: p.email }); }
        }
        setReady(true); return;
      }
      const uid = data.session.user.id;
      try {
        let s = await fetchState();
        const p = readPending();
        if (!s.answers && p) { await persist(p); s = await fetchState(); }
        else if (p?.reg) { try { await persist(p); } catch { /* kept */ } }
        if (!s.answers?.done_at && !(await claimOk())) return;
        if (!s.answers) { navigate({ to: readDiscoveryPending() ? "/discovery" : "/tenants" }); return; }
        if (s.answers.done_at && s.signupDone) { setPersona(uid, s.answers.role); goHome(s.answers.role); return; }
        setRole(s.answers.role); setAnswers((a) => ({ ...a, [s.answers!.role]: s.answers!.first_answer })); restoreTypes(s.answers.first_answer, s.answers.investor_types); setEmail(s.email);
        if (s.answers.done_at) { setLegacy(true); setStep("sector"); setReady(true); return; }
        const rs = await fetchReg();
        if (rs.pending) restoreHeld(rs.pending as Held);
        setChanges(rs.changes); setTried(rs.tried);
        if (rs.reg) { setReg(rs.reg); setRegLocked(true); }
        if (!rs.pending) { setStep("company"); setReady(true); return; }
        setStep("code"); setReady(true);
        if (!s.confirmed) { void supabase.auth.resend({ type: "signup", email: s.email }); return; }
        void startCheck();
        return;
      } catch { /* show the first step */ }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const r = gate.details?.role;
    if (!preRole && r && r !== "any") setRole((cur) => cur ?? r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.details]);
  async function claimOk(): Promise<boolean> {
    const r = await claimSeat();
    if (r.result === "works") return true;
    setBusy(false);
    if (r.result === "full") { setFull(true); setStep("role"); setReady(true); return false; }
    window.location.reload();
    return false;
  }

  useEffect(() => { if (ready && !dlg) { titleRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); } }, [step, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step !== "code" || wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(id);
  }, [step, wait]);

  const goHome = (r: Role) => { if (readDiscoveryPending()) navigate({to:"/discovery"}); else if (boPath) navigate({ to: "/marketplace/businesses-wanted", search: { bo: boInv!.ref } as never }); else navigate({ to: myCompanyPath(r) }); };
  const street = useMemo(() => { let i = 0; return streetSvg.replace(/(<text class="ps-sign"[^>]*>)[^<]*(<\/text>)/g, (_m: string, a: string, b: string) => a + L.signs[i++][lang] + b); }, [lang]);
  const opts = role === "seller" ? SELLER_OPTS : role === "buyer" ? BUYER_REL_OPTS : ADVISOR_OPTS;
  const typeOpt = (v: string) => BUYER_OPTS.find((o) => o.v === v);
  const answerLabel = buyer
    ? (individual ? S.chipRel.individual : agent ? S.chipRel.agent : corpType ? typeOpt(corpType)?.t : undefined)
    : opts.find((o) => o.v === answer)?.t;
  const order = legacy ? (["sector"] as StepKey[]) : signupSteps(role, answer);
  const NAMES: Record<StepKey, T> = {
    role: S.stepRole, about: role ? S.step2[role] : S.step2.seller, type: S.stepType, company: R.stepCo[role ?? "seller"],
    sector: S.stepSec[role ?? "seller"], logo: R.stepLogo, account: S.stepAcc, code: S.stepCode,
  };
  const Lx = (en: string, th: string) => (lang === "th" ? th : en);
  const err7Text = !err7 || !role ? null : role === "seller" ? (sSector ? null : t(S.eSeller)) : manyError(picks, agnostic, Lx);
  const shownN = Math.max(1, order.indexOf(step) + 1);
  const prevOf = (k: StepKey): StepKey => order[Math.max(0, order.indexOf(k) - 1)]!;
  const nextOf = (k: StepKey): StepKey => order[Math.min(order.length - 1, order.indexOf(k) + 1)]!;
  const inv = gate.details;
  const sellerFree = role === "seller" && inv?.plans?.seller ? inv.plans.seller : null;
  const pts = sellerFree && inv
    ? [...S.points.seller.slice(0, 2), { th: G.sellerPt.th.replace("{plan}", sellerFree).replace("{n}", monthsText(inv.months, "th")), en: G.sellerPt.en.replace("{plan}", sellerFree).replace("{n}", monthsText(inv.months, "en")) }]
    : S.points[role ?? "none"];
  const ptIcons = sellerFree ? [...POINT_ICONS.seller.slice(0, 2), Ticket] : POINT_ICONS[role ?? "none"];
  const noneLeft = !!inv && (full || inv.left <= 0);
  const early = step === "role" || step === "about" || step === "type";

  const rules = [pw.length >= 8, /[A-Za-z\u0E00-\u0E7F]/.test(pw), /\d/.test(pw)];
  const go = (n: StepKey) => { setPickErr(false); setStep(n); };
  const afterAboutFor = (v: string): StepKey => signupSteps(role, v)[2]!;

  function pick(v: string, auto: boolean) {
    if (!role) return;
    setAnswers((a) => ({ ...a, [role]: v })); setPickErr(false);
    if (auto) setTimeout(() => setStep(afterAboutFor(v)), 250);
  }
  const typesOk = () => !buyer || individual || types.length > 0;
  const outside = role !== "seller" && country !== "Thailand";
  const setupReasonInline: SetupReason | null = outside ? (role === "advisor" ? "outside_advisor" : "outside_buyer") : noNumber ? (individual ? "individual" : "no_number") : null;

  // ----- Your company -----
  const sizeBad = () => !individual && (role === "advisor" ? !/^[1-9]\d{0,4}$/.test(size) : !SIZES.includes(size));
  const webRequired = role === "advisor" || (buyer && !individual);
  const webBad = () => (webRequired && !web.trim()) || (!!web.trim() && !WEB_RE.test(web.trim()));
  const fixSame = !!fix && reg === fix.old;

  function companyContinue(e: React.FormEvent) {
    e.preventDefault(); if (busy || !role) return;
    if (fix) {
      if (fixSame) { setSameErr(true); regRef.current?.focus(); return; }
      if (!isValidThaiReg(reg)) { setErr5((x) => ({ ...x, reg: true })); regRef.current?.focus(); return; }
      setDlg("confirm"); return;
    }
    const errs = { name: coName.trim().length < 2, reg: !isValidThaiReg(reg), size: sizeBad(), web: webBad() };
    setErr5(errs);
    const firstBad = (["name", "reg", "size", "web"] as const).find((k) => errs[k]);
    if (firstBad) { document.getElementById(`su-${firstBad}`)?.focus(); return; }
    if (regLocked) { go(nextOf("company")); return; }
    setDlg("confirm");
  }
  function confirmNumber() {
    setDlg(null); setRegLocked(true);
    if (fix) { void startCheck(reg); return; }
    // The first check starts on the server now; the next steps never wait for it.
    void startPre({ data: { token: newPre(), deviceId: deviceId(), reg } }).catch(() => { /* retried at Confirm email */ });
    go(nextOf("company"));
  }

  // ----- Sector, Logo -----
  function sectorContinue() {
    if (busy || !role) return;
    const bad = role === "seller" ? !sSector : !!manyError(picks, agnostic, Lx);
    if (bad) {
      setErr7(true);
      setTimeout(() => document.querySelector<HTMLElement>(".su-sector [role=radio], .su-sector button")?.focus(), 0);
      return;
    }
    if (legacy) { void finishLegacy(); return; }
    go(nextOf("sector"));
  }
  async function finishLegacy() {
    setBusy(true); setFail(false);
    try {
      const res = await saveSector({ data: role === "seller" ? { sector: sSector, pick: sPick as never } : { picks: agnostic ? null : (picks as never), agnostic } });
      const { data } = await supabase.auth.getSession();
      if (data.session) setPersona(data.session.user.id, res.role);
      await qc.invalidateQueries();
      goHome(res.role);
    } catch { setBusy(false); setFail(true); }
  }
  function logoContinue() { if (!logo) { setLogoErr(true); return; } go("account"); }

  // ----- Account, Confirm email -----
  const pendingNow = (extra: Partial<Pending>): Pending => ({ role: role!, answer: answer!, types, first: first.trim(), last: last.trim(), email: email.trim(), terms, news, ...held(), ...extra });
  async function createAccount(e: React.FormEvent) {
    e.preventDefault(); if (busy || !role || !answer) return;
    if (!typesOk()) { go("type"); return; }
    const errs = { first: !first.trim(), last: !last.trim(), email: !EMAIL_RE.test(email.trim()), pw: !rules.every(Boolean), terms: !terms };
    setErr3(errs); setTaken(false); setFail(false);
    const firstBad = (["first", "last", "email", "pw", "terms"] as const).find((k) => errs[k]);
    if (firstBad) { document.getElementById(`su-${firstBad}`)?.focus(); return; }
    setBusy(true);
    const pend = pendingNow({});
    writePending(pend);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: pw,
      options: { emailRedirectTo: `${window.location.origin}/signup${search.join ? `?join=${encodeURIComponent(search.join)}` : ''}`, data: { first_name: first.trim(), last_name: last.trim() } },
    });
    setBusy(false);
    if (error) {
      if (/registered|exists/i.test(error.message)) { setTaken(true); emailRef.current?.focus(); } else setFail(true);
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) { setTaken(true); emailRef.current?.focus(); return; }
    if (data.session) {
      setBusy(true);
      try { await persist(pend); } catch { /* retried from the browser copy on next load */ }
      if (!(await claimOk())) return;
      setBusy(false); go("code"); void startCheck();
      return;
    }
    setCode(["", "", "", "", "", ""]); setCodeErr(null); setWait(30); go("code");
  }

  async function oauth(p: "google" | "azure") {
    if (busy || !role || !answer) { setPickErr(true); return; }
    if (!typesOk()) { go("type"); return; }
    setBusy(true);
    writePending(pendingNow({ terms: true, provider: p, email: undefined }));
    if (p === "google") {
      const { lovable } = await import("@/integrations/lovable/index");
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/signup${search.join ? `?join=${encodeURIComponent(search.join)}` : ''}` });
      if (r.error) { setBusy(false); setFail(true); return; }
      if (r.redirected) return;
      window.location.reload();
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: `${window.location.origin}/signup${search.join ? `?join=${encodeURIComponent(search.join)}` : ''}` } });
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
    try { await persist(readPending()); } catch { /* retried on resume */ }
    if (!(await claimOk())) return;
    setBusy(false);
    void startCheck();
  }

  async function resend() {
    await supabase.auth.resend({ type: "signup", email: email.trim() });
    setCode(["", "", "", "", "", ""]); setCodeErr(null); setWait(30); setSentNote(true); setTimeout(() => setSentNote(false), 3000);
    codeRefs.current[0]?.focus();
  }
  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (d.length > 1) {
      const next = d.slice(0, 6).split(""); while (next.length < 6) next.push("");
      setCode(next); setCodeErr(null);
      if (d.length >= 6) void confirmCode(next); else codeRefs.current[d.length]?.focus();
      return;
    }
    const next = [...code]; next[i] = d; setCode(next); setCodeErr(null);
    if (d && i < 5) codeRefs.current[i + 1]?.focus();
    if (d && next.every(Boolean)) void confirmCode(next);
  }

  // ----- Pop-up answers -----
  const changesLeft = REG_CHANGES - changes;
  function openFix(why: "no" | "nf", co?: RegCompany) {
    setFix({ why, old: reg, co }); setRegLocked(false); setSameErr(false); setErr5({}); setDlg(null); setStep("company");
    setTimeout(() => { regRef.current?.focus(); regRef.current?.select(); }, 60);
  }
  async function answerNo() {
    const co = found;
    try { await rejectCo(); } catch { /* the held answer stays */ }
    setFound(null);
    if (changesLeft <= 0) { setDlg("contact"); return; }
    openFix("no", co ?? undefined);
  }
  async function answerYes() {
    setCheckBusy(true);
    try {
      if (!(await claimOk())) return;
      const res = await confirmCo();
      const { data } = await supabase.auth.getSession();
      if (data.session) setPersona(data.session.user.id, res.role);
      writePending(null); clearPre();
      await qc.invalidateQueries();
      goHome(res.role);
    } catch { setCheckBusy(false); setDlg("unavailable"); }
  }
  async function sendRequest(reason: SetupReason, v: { name: string; email: string; phone: string; company: string | null; country: string; note: string | null }) {
    await sendSetup({ data: { reason, role: role ?? "seller", lang, ...v } });
    if (reason === "check_failed" || reason === "too_many") { writePending(null); await supabase.auth.signOut().catch(() => {}); }
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
  const Req = () => <span className="sr-req" aria-hidden>*</span>;

  const Choice = ({ o, name, big, tone }: { o: { v: string; icon: string; t: T; l: T; k?: string }; name: string; big?: boolean; tone: string }) => {
    const Icon = ICONS[o.icon] ?? Circle;
    const checked = big ? role === o.v : answer === o.v;
    return (
      <label className={`su-choice ${big ? "big" : "small"} ${checked ? "on" : ""}`}
        onClick={(e) => { if (!big && e.detail > 0) pick(o.v, true); }}>
        <input type="radio" name={name} value={o.v} checked={checked}
          onChange={() => (big ? (setRole(o.v as Role), setPickErr(false)) : pick(o.v, false))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); big ? go("about") : (pick(o.v, false), go(afterAboutFor(o.v))); } }} />
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
  const BackBtn = ({ to }: { to: StepKey }) => (
    <button type="button" className="su-back" disabled={busy} onClick={() => go(to)}><ArrowLeft size={17} />{t(S.back)}</button>
  );
  const setupInit = { name: [first, last].filter(Boolean).join(" "), email, company: coName, country: role === "seller" ? "Thailand" : country };
  const fixHint = fix && fixSame;

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
          {discoveryPending ? <DiscoveryBack lang={lang}/> : <Link to="/" className="lg-back"><ArrowLeft size={17} />{t(L.back)}</Link>}
          <Switch />
        </div>
        <div className="lg-mid">
          <div className={`lg-col su-col${step === "sector" ? " su-wide" : ""}`}>
            <div className="lg-card su-card">
              {setupCard ? (
                <div className="su-step">
                  <h1 ref={titleRef} tabIndex={-1} className="sr-only">{t(R.sTitle)}</h1>
                  <SetupRequest card lang={lang} reason={setupCard} init={setupInit} tried={tried} onSend={(v) => sendRequest(setupCard, v)} />
                </div>
              ) : <>
              <DiscoveryWaiting lang={lang} signup role={step === "role" ? role : null}/>
              {boInv && step === "role" && (
                <div className="su-boinv">
                  <Mail size={18} />
                  <div>
                    <div className="su-boinv-1">{lang === "th" ? `${boInv.sender} แชร์โอกาสซื้อกิจการให้ท่าน` : `${boInv.sender} shared an acquisition opportunity with you`}</div>
                    <div><b>{boInv.name} · {boInv.ref}</b> {lang === "th" ? "จะเปิดขึ้นทันทีเมื่อบัญชีของท่านพร้อม หากต้องการสมัคร โปรดสมัครเป็นผู้ขาย" : "opens as soon as your account is ready. To apply to it, sign up as a seller."}</div>
                    <div className="su-boinv-3">{lang === "th" ? `คำเชิญสำหรับ ${boInv.email} · ไม่ต้องใช้รหัสเข้าใช้งานในช่วงเปิดตัว` : `Invitation for ${boInv.email} · no access code needed during the soft launch`}</div>
                  </div>
                </div>
              )}
              {inv && early && (() => {
                const plan = role ? inv.plans?.[role] : null;
                const freeLine = noneLeft || !inv.plans ? null
                  : role && plan ? t(G.free).replace("{plan}", plan).replace("{n}", monthsText(inv.months, lang))
                  : !role ? t(G.freeAny).replace("{n}", monthsText(inv.months, lang)) : null;
                const line2 = noneLeft ? (inv.max === 1 ? t(G.invNone1) : t(G.invNone)) : t(G.invLeft);
                const [a, b] = line2.split("{code}");
                return (
                  <div className="su-inv">
                    <MailCheck size={20} />
                    <div className="su-inv-b">
                      <div className="su-inv-1">{t(G.invFor).replace("{client}", inv.client)}</div>
                      <div className="su-inv-2">{a}<code>{inv.code}</code>{b!.replace("{n}", String(inv.left)).replace("{max}", String(inv.max))}</div>
                      {freeLine && <div className="su-inv-3"><Ticket size={15} /><span>{freeLine}</span></div>}
                    </div>
                  </div>
                );
              })()}
              {inv && noneLeft && step === "role" ? (
                <div className="su-step">
                  <h1 ref={titleRef} tabIndex={-1}>{t(S.s1Title)}</h1>
                  <div className="su-full">
                    <div className="su-full-h"><Users size={20} />{t(G.fullT)}</div>
                    <p>{t(G.fullP).replace("{client}", inv.client).replace("{max}", String(inv.max))}</p>
                  </div>
                  <Link to="/login" className="lg-btn" style={{ marginTop: 18 }}>{t(G.signIn)}<LogIn size={18} /></Link>
                </div>
              ) : <>
              <div className="su-prog">
                <div className="su-prow"><b>{t(NAMES[step])}</b><span>{t(S.progress).replace("{n}", String(shownN)).replace("{N}", String(order.length))}</span></div>
                <div className="su-bars" style={{ gridTemplateColumns: `repeat(${order.length},1fr)` }}>{order.map((n, k) => <i key={n} className={k < shownN ? "on" : ""} />)}</div>
              </div>
              {!ready ? <div className="su-load"><LoaderCircle className="lg-spin" /></div> : (
                <div className="su-step" key={step}>
                  {step === "role" && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s1Title)}</h1>
                    <p className="lg-cline su-line">{t(S.s1Line)}</p>
                    <fieldset className="su-cards big">
                      <legend className="sr-only">{t(S.s1Legend)}</legend>
                      {(["seller", "buyer", "advisor"] as Role[]).map((r) => (
                        <Choice key={r} name="role" big tone={r} o={{ v: r, icon: r === "seller" ? "store" : r === "buyer" ? "search" : "briefcase", t: S.roles[r][0], l: S.roles[r][1] }} />
                      ))}
                    </fieldset>
                    {inv && inv.role !== "any" && role === inv.role && <p className="su-rnote"><Info size={15} />{t(G.roleNote)}</p>}
                    {pickErr && <Err text={S.pickOne} />}
                    <div className="su-actions">
                      <Primary label={S.next} onClick={() => { if (!role) { setPickErr(true); document.querySelector<HTMLInputElement>(".su-cards input")?.focus(); } else go("about"); }} />
                    </div>
                  </>}

                  {step === "about" && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s2[role][0])}</h1>
                    <p className="lg-cline su-line">{t(S.s2[role][1])}</p>
                    <fieldset className="su-cards small">
                      <legend className="sr-only">{t(S.s2[role][0])}</legend>
                      {opts.map((o) => <Choice key={o.v} o={o} name={`a-${role}`} tone={role} />)}
                    </fieldset>
                    {individual && <div className="su-info"><Info size={16} /><span>{t(R.indNote)}</span></div>}
                    {pickErr && <Err text={S.pickOne} />}
                    <div className="su-actions">
                      <BackBtn to="role" />
                      <Primary label={S.next} onClick={() => { if (!answer) { setPickErr(true); document.querySelector<HTMLInputElement>(".su-cards input")?.focus(); } else go(afterAboutFor(answer)); }} />
                    </div>
                  </>}

                  {step === "type" && buyer && (corp || agent) && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t((agent ? S.s3Agent : S.s3Corp)[0])}</h1>
                    <p className="lg-cline su-line">{t((agent ? S.s3Agent : S.s3Corp)[1])}</p>
                    <fieldset className="su-cards small">
                      <legend className="sr-only">{t((agent ? S.s3Agent : S.s3Corp)[0])}</legend>
                      {BUYER_OPTS.filter((o) => agent || o.v !== "Individual Investor").map((o) => {
                        const Icon = ICONS[o.icon] ?? Circle;
                        const on = agent ? agentTypes.includes(o.v) : corpType === o.v;
                        return (
                          <label key={o.v} className={`su-choice small ${on ? "on" : ""}`}
                            onClick={(e) => { if (!agent && e.detail > 0) { setCorpType(o.v); setPickErr(false); setTimeout(() => setStep("company"), 250); } }}>
                            {agent ? (
                              <input type="checkbox" value={o.v} checked={on}
                                onChange={() => { setAgentTypes((l) => BUYER_OPTS.map((x) => x.v).filter((v) => (v === o.v ? !on : l.includes(v)))); setPickErr(false); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!agentTypes.length) setPickErr(true); else go("company"); } }} />
                            ) : (
                              <input type="radio" name="b-type" value={o.v} checked={on}
                                onChange={() => { setCorpType(o.v); setPickErr(false); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCorpType(o.v); go("company"); } }} />
                            )}
                            <span className={`su-tile t-b-${o.k}`}><Icon size={19} /></span>
                            <span className="su-ct"><b>{t(o.t)}</b><small>{t(o.l)}</small></span>
                            <span className={agent ? "su-tick" : "su-radio"} aria-hidden>{agent && on && <Check size={13} strokeWidth={3} />}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                    {pickErr && <Err text={agent ? S.pickMany : S.pickOne} />}
                    <div className="su-actions">
                      <BackBtn to="about" />
                      <Primary label={S.next} onClick={() => { if (!types.length) { setPickErr(true); document.querySelector<HTMLInputElement>(".su-cards input")?.focus(); } else go("company"); }} />
                    </div>
                  </>}

                  {step === "company" && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(role === "seller" ? R.coTitle.seller : R.coTitle.firm)}</h1>
                    <p className="lg-cline su-line">{t(individual ? R.coLine.ind : R.coLine[word])}</p>
                    <form className="su-form sr" onSubmit={companyContinue} noValidate>
                      {role !== "seller" && !fix && (
                        <div className="lg-fg">
                          <label className="lg-label" htmlFor="su-country">{t(R.country)}<Req /></label>
                          <div className="lg-field su-f"><Globe size={18} />
                            <select id="su-country" aria-required value={country} disabled={regLocked} onChange={(e) => setCountry(e.target.value)} className="w-full bg-transparent outline-none">
                              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select></div>
                        </div>
                      )}
                      {setupReasonInline ? (
                        <SetupRequest lang={lang} reason={setupReasonInline} init={setupInit} tried={[]}
                          onBackToFields={() => { setNoNumber(false); setCountry("Thailand"); }} onSend={(v) => sendRequest(setupReasonInline, v)} />
                      ) : <>
                      {!fix && (
                        <div className="lg-fg">
                          <label className="lg-label" htmlFor="su-name">{individual ? t(R.indName) : t(S.nameL[role])}<Req /></label>
                          <div className={`lg-field su-f ${err5.name ? "bad" : ""}`}><Building size={18} />
                            <input id="su-name" aria-required maxLength={120} placeholder={t(S.namePh[role])} value={coName}
                              onChange={(e) => { setCoName(e.target.value); if (e.target.value.trim().length >= 2) setErr5((x) => ({ ...x, name: false })); }} /></div>
                          {role === "buyer" ? (agent ? <p className="su-fhint">{t(S.nameHintAgent)}</p> : null)
                            : S.nameHint[role] && <p className="su-fhint">{t(S.nameHint[role]!)}</p>}
                          {err5.name && <Err text={S.nameErr[role]} />}
                        </div>
                      )}
                      <div className="lg-fg">
                        <label className={`lg-label${fix ? " sr-lbl-bad" : ""}`} htmlFor="su-reg">{t(R.regLabel)}<Req /></label>
                        <div className={`lg-field su-f ${err5.reg || sameErr || fixHint ? "bad" : ""} ${regLocked ? "sr-locked" : ""}`}><FileText size={18} />
                          <input id="su-reg" ref={regRef} aria-required inputMode="numeric" maxLength={13} placeholder={t(R.regPh)} value={reg} readOnly={regLocked}
                            aria-invalid={err5.reg || sameErr || undefined}
                            onChange={(e) => { setReg(digitsOnly(e.target.value)); setErr5((x) => ({ ...x, reg: false })); setSameErr(false); }} />
                          {regLocked && <Lock size={16} aria-hidden />}</div>
                        {regLocked ? <p className="sr-hint">{t(R.regLocked)}</p>
                          : fixHint ? <p className="sr-hint bad"><b>{t(R.fixA)}</b> {t(fix!.why === "no" ? R.fixNo[word] : R.fixNf[word])}</p>
                          : <p className="sr-hint">{fill(R.regHint[word], { n: reg.length })}</p>}
                        {err5.reg && <Err text={R.regBad} />}
                        {sameErr && <Err text={fix?.why === "no" ? R.sameNo : R.sameNf} />}
                        {fix && (
                          <div className="sr-warn">
                            {fix.why === "no" ? <>
                              <span>{fill(R.boxNo, { number: "\u0000" }).split("\u0000").map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <b>{fix.old}</b>}</span>)}</span>
                              {fix.co && <div className="sr-warn-in"><CompanyRows lang={lang} co={fix.co} /></div>}
                            </> : <p style={{ margin: 0 }}>{fill(R.boxNf, { number: "\u0000" }).split("\u0000").map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <b>{fix.old}</b>}</span>)}</p>}
                            <p style={{ margin: "6px 0 0" }}>{t(R.boxLeft)} <b>{changesLeft === 1 ? t(R.left1) : fill(R.left, { k: changesLeft })}</b></p>
                          </div>
                        )}
                        {!regLocked && !fix && <button type="button" className="sr-link" onClick={() => setNoNumber(true)}>{t(R.noReg)}</button>}
                      </div>
                      {!fix && !individual && (
                        <div className="lg-fg">
                          <label className="lg-label" htmlFor="su-size">{t(role === "advisor" ? S.sizeAdv : S.size)}<Req /></label>
                          {role === "advisor" ? (
                            <div className={`lg-field su-f ${err5.size ? "bad" : ""}`}><Users size={18} />
                              <input id="su-size" aria-required inputMode="numeric" placeholder={t(S.sizeAdvPh)} value={size}
                                onChange={(e) => { setSize(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 5)); setErr5((x) => ({ ...x, size: false })); }} />
                              <span className="su-unit">{t(S.people)}</span></div>
                          ) : (
                            <div className={`lg-field su-f ${err5.size ? "bad" : ""}`}><Users size={18} />
                              <select id="su-size" aria-required value={size} onChange={(e) => { setSize(e.target.value); setErr5((x) => ({ ...x, size: false })); }}
                                className={`w-full bg-transparent outline-none ${size ? "" : "text-muted-foreground"}`}>
                                <option value="" disabled>{t(S.sizePick)}</option>
                                {SIZES.map((s) => <option key={s} value={s}>{s === "500+" ? t(S.sizeMore) : s.replace("-", "–")}</option>)}
                              </select></div>
                          )}
                          {err5.size && <Err text={role === "advisor" ? S.eSizeAdv : S.eSize} />}
                        </div>
                      )}
                      {!fix && (
                        <div className="lg-fg">
                          <label className="lg-label" htmlFor="su-web">{t(S.web)}{webRequired ? <Req /> : <> <span className="su-opt">{t(S.optional)}</span></>}</label>
                          <div className={`lg-field su-f ${err5.web ? "bad" : ""}`}><Globe size={18} />
                            <input id="su-web" aria-required={webRequired} inputMode="url" placeholder={role === "seller" ? "www.yourcompany.com" : "www.yourfirm.com"} value={web}
                              onChange={(e) => { setWeb(e.target.value); setErr5((x) => ({ ...x, web: false })); }} /></div>
                          {!webRequired && <p className="su-fhint">{t(S.webHint[role])}</p>}
                          {err5.web && <Err text={webRequired && !web.trim() ? R.webReq : S.eWeb} />}
                        </div>
                      )}
                      {!fix && <div className="su-info">{role === "seller" ? <Lock size={16} /> : role === "buyer" ? <EyeOff size={16} /> : <Eye size={16} />}<span>{t(agent ? S.privacyAgent : S.privacy5[role])}</span></div>}
                      <div className="su-actions">{!fix && <BackBtn to={prevOf("company")} />}<Primary type="submit" label={fix ? R.iConfirm : S.next} /></div>
                      </>}
                    </form>
                  </>}

                  {step === "sector" && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s7[role][0])}</h1>
                    <p className="lg-cline su-line">{t(S.s7[role][1])}</p>
                    <div className="su-sector">
                      {role === "seller" ? (
                        <SellerTypeQuestion pick={sPick} sector={sSector} onChange={(p, sec) => { setSPick(p); setSSector(sec); if (sec) setErr7(false); }} />
                      ) : (
                        <ManyTypeQuestion picks={picks} agnostic={agnostic} words={role === "buyer" ? buyerWords(Lx) : advisorWords(Lx)}
                          onChange={(p, ag) => { setPicks(p); setAgnostic(ag); if (!manyError(p, ag, Lx)) setErr7(false); }} />
                      )}
                    </div>
                    {err7Text && <div role="alert"><Err text={err7Text} /></div>}
                    {fail && <Err text={S.other} />}
                    <div className="su-actions">{!legacy && <BackBtn to="company" />}<Primary label={legacy ? S.go : S.next} busyLabel={S.going} onClick={sectorContinue} /></div>
                  </>}

                  {step === "logo" && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(R.logoTitle)}</h1>
                    <p className="lg-cline su-line">{t(R.logoHelp[role])}</p>
                    <LogoPicker lang={lang} role={role} logo={logo} onChange={(l) => { setLogo(l); if (l) setLogoErr(false); }} showRequiredError={logoErr} />
                    <div className="su-actions"><BackBtn to="sector" /><Primary label={S.next} onClick={logoContinue} /></div>
                  </>}

                  {step === "account" && role && <>
                    <h1 ref={titleRef} tabIndex={-1}>{t(S.s3Title)}</h1>
                    <p className="lg-cline su-line">{t(S.s3Line)}</p>
                    <div className="sr"><div className="sr-info">{fill(R.accFor, { role: `${t(S.chipRole[role])}${answerLabel ? ` · ${t(answerLabel)}` : ""}`, company: coName, number: reg })} <Lock size={13} className="inline" aria-hidden /></div></div>
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
                            readOnly={(gate.gateOn && !!gate.invitationEmail) || !!boInv}
                            onChange={(e) => { setEmail(e.target.value); setTaken(false); if (EMAIL_RE.test(e.target.value.trim())) setErr3((x) => ({ ...x, email: false })); }} /></div>
                        {err3.email && <Err text={S.eEmail} />}
                        {((gate.gateOn && gate.invitationEmail) || boInv) && <p className="su-hint">{sc('invitation', lang)}</p>}
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
                      <div className="su-actions"><BackBtn to={prevOf("account")} /><Primary type="submit" label={S.create} busyLabel={S.creating} /></div>
                    </form>
                    <div className="lg-div">{t(S.divider)}</div>
                    <div className="lg-prov su-prov">
                      <button type="button" disabled={busy} onClick={() => void oauth("google")}><GoogleIcon />Google</button>
                      <button type="button" disabled={busy} onClick={() => void oauth("azure")}><MicrosoftIcon />Microsoft</button>
                    </div>
                  </>}

                  {step === "code" && <>
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
                      <div className="su-actions"><Primary type="submit" label={S.confirm} busyLabel={S.confirming} onClick={found && !dlg ? () => setDlg("found") : undefined} /></div>
                    </form>
                    <p className="su-resend">
                      {wait > 0 ? <>{t(S.wait)}0:{String(wait).padStart(2, "0")}</> : <>{t(S.resendA)}<button type="button" className="su-tl" onClick={() => void resend()}>{t(S.resend)}</button></>}
                    </p>
                    {sentNote && <p className="su-sent">{t(S.sent)}</p>}
                    <p className="su-hint">{t(S.hint)}<button type="button" className="su-tl" onClick={() => { go("account"); setTimeout(() => emailRef.current?.select(), 50); }}>{t(S.other_email)}</button></p>
                  </>}
                </div>
              )}
              </>}
              </>}
            </div>
            {early && !(noneLeft && step === "role") && !setupCard && <p className="lg-noacc">{t(S.haveAcc)} <Link to="/login" search={(boPath ? { redirect: boPath } : {}) as never}>{t(S.signIn)}</Link></p>}
            <p className="lg-pw2">Powered by SnackPortal2</p>
          </div>
        </div>
      </main>

      <ConfirmRegDialog open={dlg === "confirm"} lang={lang} reg={reg} change={fix ? changes + 1 : 0} onCancel={() => setDlg(null)} onConfirm={confirmNumber} />
      <VerifyingDialog open={dlg === "verifying"} lang={lang} reg={reg} />
      {found && <FoundDialog open={dlg === "found"} lang={lang} reg={reg} co={found} noChangeLeft={changesLeft <= 0} busy={checkBusy}
        onClose={() => setDlg(null)} onNo={() => void answerNo()} onYes={() => void answerYes()} />}
      <NotFoundDialog open={dlg === "nf"} lang={lang} reg={reg} onEdit={() => openFix("nf")} onContact={() => { setDlg(null); setSetupCard("check_failed"); }} />
      <SimpleDialog open={dlg === "limit"} lang={lang} kind="limit" onMain={() => { setDlg(null); setSetupCard("too_many"); }} />
      <SimpleDialog open={dlg === "contact"} lang={lang} kind="contact" count={tried.length} onMain={() => { setDlg(null); setSetupCard("check_failed"); }} />
      <SimpleDialog open={dlg === "unavailable"} lang={lang} kind="unavailable" busy={checkBusy} onMain={() => void startCheck()} />
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
