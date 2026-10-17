import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, CircleAlert, Globe, KeyRound, LoaderCircle, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accessEnter, accessStatus, enterShareInvitation, claimAccessSeat, type ClaimResult, type GateDetails } from "@/lib/access-gate.functions";
import { HatMark } from "@/components/ui/PitchSnackLoader";
import logoWhite from "@/assets/pitchsnack-white.png";
import hatWhite from "@/assets/pitchsnack-hat-white-icon.png";
import streetSvg from "@/components/login/street.svg?raw";
import { L } from "@/components/login/login-copy";
import { G } from "./access-copy";
import "@/styles/login-page.css";
import "@/styles/access-gate.css";

type Lang = "th" | "en";
const LANG_KEY = "ps-home-lang";
const PASS_KEY = "ps-access-pass";
const COOKIE = "ps_access_pass";
const DEVICE_KEY = "ps-device-id";
const FLASH_KEY = "ps-access-flash";
const FRESH = 30 * 60000;

/* ---------- browser storage: the pass, the device id ---------- */
type Stored = { pass: string; code: string; at?: number };
export function readPass(): Stored | null {
  try {
    const l = localStorage.getItem(PASS_KEY);
    if (l) return JSON.parse(l);
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
    if (m) { const s = JSON.parse(decodeURIComponent(m[1]!)); if (!s.at || Date.now() - s.at < 12 * 3600000) return s; }
  } catch { /* none */ }
  return null;
}
function writePass(pass: string, code: string, remember: boolean) {
  clearPass();
  const v: Stored = { pass, code, at: Date.now() };
  try {
    if (remember) localStorage.setItem(PASS_KEY, JSON.stringify(v));
    else document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(v))}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* noop */ }
}
function clearPass() {
  try { localStorage.removeItem(PASS_KEY); } catch { /* noop */ }
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}
function deviceId() {
  try {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d || !/^[A-Za-z0-9-]{8,64}$/.test(d)) { d = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, d); }
    return d;
  } catch { return crypto.randomUUID(); }
}
type Flash = { kind: "inactive" | "no_pass"; code?: string };
export function setFlash(f: Flash) { try { sessionStorage.setItem(FLASH_KEY, JSON.stringify(f)); } catch { /* noop */ } }
function takeFlash(): Flash | null {
  try { const r = sessionStorage.getItem(FLASH_KEY); sessionStorage.removeItem(FLASH_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

/* ---------- context ---------- */
type GateValue = { gateOn: boolean; details: GateDetails | null; signedIn: boolean; invitationEmail?: string };
const Ctx = createContext<GateValue>({ gateOn: false, details: null, signedIn: false });
export const useGate = () => useContext(Ctx);

let cache: { at: number; gateOn: boolean; details: GateDetails | null; invitationEmail?: string } | null = null;
let signedInKnown = false;

/** Runs the access claim; rejected passes sign out without deleting the account. */
export function useClaimSeat() {
  const claim = useServerFn(claimAccessSeat);
  return async (): Promise<{ result: ClaimResult; code?: string }> => {
    try {
      const r = await claim({ data: { pass: readPass()?.pass ?? null } });
      if (r.result !== "works") {
        await supabase.auth.signOut();
        if (r.result === "inactive") { clearPass(); cache = null; setFlash({ kind: "inactive", code: r.code }); }
        if (r.result === "no_pass") { cache = null; setFlash({ kind: "no_pass" }); }
      }
      return r;
    } catch { return { result: "no_pass" }; }
  };
}

/**
 * Stands in front of public pages and sign-up while the soft-launch gate is on.
 * Signed-in users and an open gate pass straight through.
 */
export function AccessGate({ children, claimInBackground = true, onLang }: { children: ReactNode; claimInBackground?: boolean; onLang?: (l: Lang) => void }) {
  const status = useServerFn(accessStatus);
  const enterInvitation = useServerFn(enterShareInvitation);
  const claim = useClaimSeat();
  // On in-app navigation the last answer is already known: start open, no loading frame.
  const known = signedInKnown || (cache && Date.now() - cache.at < FRESH && (!cache.gateOn || cache.details || cache.invitationEmail));
  const [state, setState] = useState<"loading" | "open" | "gate">(known ? "open" : "loading");
  const [val, setVal] = useState<GateValue>(
    signedInKnown ? { gateOn: false, details: null, signedIn: true }
      : known && cache ? { gateOn: cache.gateOn, details: cache.details, invitationEmail: cache.invitationEmail, signedIn: false }
      : { gateOn: false, details: null, signedIn: false });
  const [flash, setFl] = useState<Flash | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);

  const decide = async () => {
    const join = new URL(window.location.href).searchParams.get('join');
    let invitationEmail: string | undefined;
    if (join) {
      try {
        const invitation = await enterInvitation({ data: { token: join, deviceId: deviceId() } });
        if (invitation.works && invitation.pass && invitation.email) {
          writePass(invitation.pass, '', true); invitationEmail = invitation.email; cache = null;
        } else { clearPass(); cache = null; }
      } catch { clearPass(); cache = null; }
    }
    const { data } = await supabase.auth.getSession();
    signedInKnown = !!data.session;
    if (data.session) {
      setVal({ gateOn: false, details: null, signedIn: true }); setState("open");
      if (claimInBackground) {
        const k = `ps-claim-${data.session.user.id}`;
        if (join || !sessionStorage.getItem(k)) {
          const r = await claim();
          if (r.result === "works") sessionStorage.setItem(k, "1");
          else { setVal({ gateOn: true, details: null, signedIn: false }); setFl(takeFlash()); setState("gate"); }
        }
      }
      return;
    }
    const f = takeFlash();
    if (cache && Date.now() - cache.at < FRESH && !f) {
      setVal({ gateOn: cache.gateOn, details: cache.details, invitationEmail: cache.invitationEmail, signedIn: false });
      setState(!cache.gateOn || cache.details || cache.invitationEmail ? "open" : "gate"); return;
    }
    const stored = readPass();
    try {
      const r = await Promise.race([
        status({ data: { pass: stored?.pass ?? null, deviceId: stored ? deviceId() : null } }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
      ]);
      if (!r.gateOn) { cache = { at: Date.now(), gateOn: false, details: null, invitationEmail }; setVal({ gateOn: false, details: null, invitationEmail, signedIn: false }); setState("open"); return; }
      if (r.works && r.invitationEmail) { cache = { at: Date.now(), gateOn: true, details: null, invitationEmail: r.invitationEmail }; setVal({ gateOn: true, details: null, invitationEmail: r.invitationEmail, signedIn: false }); setState('open'); return; }
      if (r.works && r.details) { cache = { at: Date.now(), gateOn: true, details: r.details }; setVal({ gateOn: true, details: r.details, signedIn: false }); setState("open"); return; }
      if (r.inactive && stored) { clearPass(); setFl({ kind: "inactive", code: stored.code }); }
      else setFl(f);
      cache = { at: Date.now(), gateOn: true, details: null };
    } catch { setFl(f); }
    setVal({ gateOn: true, details: null, signedIn: false }); setState("gate");
  };

  useEffect(() => { void decide(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Search engines don't list the public pages while the gate is on.
  useEffect(() => {
    if (!val.gateOn) return;
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
    return () => { m.remove(); };
  }, [val.gateOn]);

  if (state === "loading") return <div className="ag-loading" aria-busy="true"><HatMark size="lg" /></div>;
  if (state === "gate") {
    return (
      <AccessPage flash={flash} onLang={onLang} onOpen={(d) => {
        cache = { at: Date.now(), gateOn: true, details: d };
        setVal({ gateOn: true, details: d, signedIn: false }); setWelcome(d.client); setState("open");
      }} />
    );
  }
  return (
    <Ctx.Provider value={val}>
      {children}
      {welcome && <WelcomeNote client={welcome} />}
    </Ctx.Provider>
  );
}

/* ---------- welcome note ---------- */
function WelcomeNote({ client }: { client: string }) {
  const [lang, setLang] = useState<Lang>("th");
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    try { const l = localStorage.getItem(LANG_KEY); if (l === "en" || l === "th") setLang(l); } catch { /* noop */ }
    const a = setTimeout(() => setOut(true), 6000); const b = setTimeout(() => setGone(true), 6400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (gone) return null;
  return (
    <div className={out ? "ag-welcome out" : "ag-welcome"} role="status">
      <span className="ag-wcheck"><Check size={15} strokeWidth={2.6} /></span>
      <span>{G.welcome[lang]}<b>{client}</b></span>
    </div>
  );
}

/* ---------- the ribbon (public top bar pages) ---------- */
export function SoftLaunchRibbon({ lang }: { lang: Lang }) {
  const { gateOn, details } = useGate();
  if (!gateOn || !details) return null;
  return (
    <div className="ag-ribbon">
      <div className="ag-ribbon-in">
        <span className="ag-rl"><KeyRound size={17} /><span className="ag-rtext"><b>{G.ribbonA[lang]}</b> · <span className="ag-rfor">{G.ribbonFor[lang]}</span>{details.client}</span></span>
        <a href="/contact?topic=feedback#enquiry" className="ag-fb" aria-label={G.feedback[lang]}><MessageSquare size={16} /><span>{G.feedback[lang]}</span></a>
      </div>
    </div>
  );
}

/* ---------- the access page ---------- */
const fmt = (raw: string) => {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("PS")) s = s.slice(2);
  s = s.slice(0, 8);
  if (!s) return "";
  return `PS-${s.slice(0, 4)}${s.length > 4 ? "-" + s.slice(4) : ""}`;
};
type Err = null | "empty" | "short" | "unknown" | "inactive" | "paused" | "fail" | "newAcct";
const ERR_TEXT: Record<Exclude<Err, null>, { th: string; en: string }> = {
  empty: G.eEmpty, short: G.eShort, unknown: G.eUnknown, inactive: G.eInactive, paused: G.ePaused, fail: G.eFail, newAcct: G.eNewAcct,
};

function AccessPage({ flash, onOpen, onLang }: { flash: Flash | null; onOpen: (d: GateDetails) => void; onLang?: (l: Lang) => void }) {
  const enter = useServerFn(accessEnter);
  const [lang, setLangState] = useState<Lang>("th");
  const t = (x: { th: string; en: string }) => x[lang];
  const [code, setCode] = useState(flash?.kind === "inactive" && flash.code ? flash.code : "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Err>(flash?.kind === "inactive" ? "inactive" : flash?.kind === "no_pass" ? "newAcct" : null);
  const [pausedUntil, setPausedUntil] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const l = localStorage.getItem(LANG_KEY); if (l === "en" || l === "th") setLangState(l); } catch { /* noop */ }
    // ?invite= fills the field, then leaves the address bar.
    const u = new URL(window.location.href);
    const inv = u.searchParams.get("invite");
    if (inv != null) {
      const f = fmt(inv);
      if (f.length === 12) setCode(f);
      u.searchParams.delete("invite");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    }
  }, []);
  useEffect(() => {
    const html = document.documentElement; const prev = { lang: html.lang, size: html.style.fontSize, title: document.title };
    html.lang = lang; html.style.fontSize = lang === "th" ? "17.5px" : "16px"; document.title = G.title[lang];
    return () => { html.lang = prev.lang || "en"; html.style.fontSize = prev.size; document.title = prev.title; };
  }, [lang]);
  useEffect(() => {
    if (!pausedUntil) return;
    const id = setTimeout(() => { setPausedUntil(0); setErr(null); }, Math.max(0, pausedUntil - Date.now()));
    return () => clearTimeout(id);
  }, [pausedUntil]);
  const setLang = (l: Lang) => { setLangState(l); onLang?.(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* noop */ } };

  const street = useMemo(() => { let i = 0; return streetSvg.replace(/(<text class="ps-sign"[^>]*>)[^<]*(<\/text>)/g, (_m: string, a: string, b: string) => a + L.signs[i++][lang] + b); }, [lang]);
  const paused = pausedUntil > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || paused) return;
    if (!code) { setErr("empty"); ref.current?.focus(); return; }
    if (code.length < 12) { setErr("short"); ref.current?.focus(); return; }
    setBusy(true);
    try {
      const r = await Promise.race([
        enter({ data: { code, remember, deviceId: deviceId() } }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
      ]);
      if (r.result === "works") { writePass(r.pass, code, remember); onOpen(r.details); return; }
      if (r.result === "paused") { setPausedUntil(Date.now() + r.minutes * 60000); setErr("paused"); }
      else setErr(r.result);
    } catch { setErr("fail"); }
    setBusy(false);
    requestAnimationFrame(() => ref.current?.focus());
  }

  const Switch = ({ navy }: { navy?: boolean }) => (
    <div role="group" aria-label="ภาษา / Language" className={navy ? "lg-sw navy" : "lg-sw"}>
      {!navy && <Globe size={16} />}
      <button type="button" aria-pressed={lang === "th"} onClick={() => setLang("th")}>ไทย</button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
    </div>
  );

  return (
    <div className="lg ag" data-lang={lang}>
      <aside className="lg-left">
        <div className="lg-ltop">
          <span className="lg-logo"><img src={logoWhite} alt="PitchSnack" /></span>
          <Switch navy />
        </div>
        <div className="lg-text">
          <span className="lg-chip"><KeyRound size={15} className="ag-amber" /><span>{t(G.chipA)}<b>{t(G.chipB)}</b></span></span>
          <p className="lg-head"><span>{t(L.h1)}</span><span className="am">{t(L.h2)}</span></p>
          <p className="lg-intro">{t(G.intro)}</p>
          <ul className="lg-points">
            <li><i><KeyRound size={18} strokeWidth={1.8} /></i>{t(G.p1)}</li>
            <li><i><ShieldCheck size={18} strokeWidth={1.8} /></i>{t(G.p2)}</li>
            <li><i><MessageSquare size={18} strokeWidth={1.8} /></i>{t(G.p3)}</li>
          </ul>
        </div>
        <div className="lg-street">
          <div dangerouslySetInnerHTML={{ __html: street }} />
          <span className="lg-foot">Powered by SnackPortal2</span>
        </div>
      </aside>
      <main className="lg-right">
        <div className="lg-rtop ag-rtop"><Switch /></div>
        <div className="lg-mid">
          <div className="lg-col">
            <div className="lg-card">
              <div className="lg-chead">
                <div className="lg-hat"><img src={hatWhite} alt="" /></div>
                <h1>{t(G.card)}</h1>
              </div>
              <p className="lg-cline">{t(G.cline)}</p>
              <form className="lg-form" onSubmit={submit} noValidate>
                <div className="lg-fg">
                  <label className="lg-label" htmlFor="ag-code">{t(G.label)}</label>
                  <div className={`lg-field ag-field${err ? " bad" : ""}${paused ? " off" : ""}`}>
                    <KeyRound size={18} />
                    <input ref={ref} id="ag-code" value={code} placeholder="PS-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                      disabled={paused} aria-invalid={!!err} aria-describedby="ag-err"
                      onChange={(e) => { setCode(fmt(e.target.value)); if (err !== "paused") setErr(null); }} />
                  </div>
                  <div id="ag-err" aria-live="polite">{err && <div className="lg-err"><CircleAlert size={15} />{t(ERR_TEXT[err])}</div>}</div>
                </div>
                <label className="lg-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t(G.remember)}
                </label>
                <button type="submit" className={`lg-btn${busy ? " ag-busy" : ""}`} disabled={busy || paused}>
                  {busy ? <>{t(G.busy)}<LoaderCircle size={18} className="lg-spin" /></> : <>{t(G.btn)}<ArrowRight size={18} /></>}
                </button>
              </form>
              <p className="ag-help"><Mail size={17} /><span>{t(G.helpA)}<a href="mailto:support@pitchsnack.com">support@pitchsnack.com</a></span></p>
            </div>
            <p className="lg-noacc">{t(G.have)}<Link to="/login">{t(G.signIn)}</Link></p>
            <p className="lg-fine">{t(G.fine)}<Link to="/privacy">{t(G.privacy)}</Link></p>
            <p className="lg-pw2">Powered by SnackPortal2</p>
          </div>
        </div>
      </main>
    </div>
  );
}
