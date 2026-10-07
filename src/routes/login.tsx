import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Building2, CircleAlert, Eye, EyeOff, Globe, LoaderCircle, Lock, LogIn, Mail, Scale, ShieldCheck, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recordLogin, logSecurityEvent } from "@/lib/auth.functions";
import { getSignupState } from "@/lib/signup.functions";
import logoWhite from "@/assets/pitchsnack-white.png";
import hatWhite from "@/assets/pitchsnack-hat-white-icon.png";
import streetSvg from "@/components/login/street.svg?raw";
import { L, type LoginLang } from "@/components/login/login-copy";
import "@/styles/login-page.css";

const searchSchema = z.object({ redirect: z.string().optional(), email: z.string().optional() });
const REMEMBER_KEY = "sp2.login.email";
const LANG_KEY = "ps-home-lang";
const FONT_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600;700&family=Noto+Serif+Thai:wght@600;700&display=swap";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: search.redirect || "/tenants" });
  },
  head: () => ({
    meta: [
      { title: "PitchSnack · เข้าสู่ระบบ" },
      { name: "description", content: "Sign in to PitchSnack to see your matches, contact requests and data room." },
      { property: "og:title", content: "PitchSnack · Sign in" },
      { property: "og:description", content: "Sign in to PitchSnack to see your matches, contact requests and data room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONT_URL },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const onLogin = useServerFn(recordLogin);
  const onFailed = useServerFn(logSecurityEvent);
  const getState = useServerFn(getSignupState);

  const [lang, setLangState] = useState<LoginLang>("th");
  const t = (x: { th: string; en: string }) => x[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailErr, setEmailErr] = useState(false);
  const [pwErr, setPwErr] = useState<null | "empty" | "wrong" | "other">(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY);
      if (l === "en" || l === "th") setLangState(l);
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setEmail(saved); setRemember(true); }
      if (search.email) setEmail(search.email);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const prev = { lang: html.lang, size: html.style.fontSize };
    html.lang = lang;
    html.style.fontSize = lang === "th" ? "17.5px" : "16px";
    document.title = L.title[lang];
    return () => { html.lang = prev.lang || "en"; html.style.fontSize = prev.size; };
  }, [lang]);

  const setLang = (l: LoginLang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* noop */ }
  };

  const street = useMemo(() => {
    let i = 0;
    return streetSvg.replace(/(<text class="ps-sign"[^>]*>)[^<]*(<\/text>)/g, (_m: string, a: string, b: string) => a + L.signs[i++][lang] + b);
  }, [lang]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const eBad = !EMAIL_RE.test(email.trim());
    const pBad = !password;
    setEmailErr(eBad);
    setPwErr(pBad ? "empty" : null);
    if (eBad) { emailRef.current?.focus(); return; }
    if (pBad) { pwRef.current?.focus(); return; }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        try { await onFailed({ data: { eventType: "FAILED_LOGIN", details: { email } } }); } catch { /* best effort */ }
        if (/not confirmed/i.test(error.message ?? "")) { navigate({ to: "/signup", search: { email: email.trim() } }); return; }
        const invalid = error.status === 400 || /invalid/i.test(error.message ?? "");
        setPwErr(invalid ? "wrong" : "other");
        pwRef.current?.focus();
        setBusy(false);
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* storage unavailable */ }
      try { await onLogin(); } catch { /* best effort */ }
      await qc.invalidateQueries();
      // Sign-up not finished (no Draft profile yet): reopen step 5.
      try { const st = await getState(); if (st.answers && !st.answers.done_at) { navigate({ to: "/signup" }); return; } } catch { /* normal landing */ }
      navigate({ to: search.redirect || "/tenants" });
    } catch {
      setPwErr("other");
      setBusy(false);
    }
  }

  async function oauthSignIn(provider: "google" | "azure") {
    if (busy) return;
    setPwErr(null);
    setBusy(true);
    try {
      if (provider === "google") {
        const { lovable } = await import("@/integrations/lovable/index");
        const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        if (r.error) { setPwErr("other"); setBusy(false); return; }
        if (r.redirected) return;
        navigate({ to: search.redirect || "/tenants" });
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
      if (error) { setPwErr("other"); setBusy(false); }
    } catch { setPwErr("other"); setBusy(false); }
  }

  const Switch = ({ navy }: { navy?: boolean }) => (
    <div role="group" aria-label="ภาษา / Language" className={navy ? "lg-sw navy" : "lg-sw"}>
      {!navy && <Globe size={16} />}
      <button type="button" aria-pressed={lang === "th"} onClick={() => setLang("th")}>ไทย</button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
    </div>
  );

  const ErrLine = ({ text, id }: { text: string; id: string }) => (
    <div className="lg-err" id={id}><CircleAlert size={15} />{text}</div>
  );

  const pwMsg = pwErr === "empty" ? L.pwErr : pwErr === "wrong" ? L.wrong : pwErr === "other" ? L.other : null;

  return (
    <div className="lg" data-lang={lang}>
      <aside className="lg-left">
        <div className="lg-ltop">
          <Link to="/" className="lg-logo" title={t(L.logo)} aria-label={t(L.logo)}><img src={logoWhite} alt="" /></Link>
          <Switch navy />
        </div>
        <div className="lg-text">
          <span className="lg-chip"><Store size={15} /><span>{t(L.chipA)}<b>{t(L.chipB)}</b></span></span>
          <p className="lg-head"><span>{t(L.h1)}</span><span className="am">{t(L.h2)}</span></p>
          <p className="lg-intro">{t(L.intro)}</p>
          <ul className="lg-points">
            <li><i><ShieldCheck size={18} strokeWidth={1.8} /></i>{t(L.p1)}</li>
            <li><i><Lock size={18} strokeWidth={1.8} /></i>{t(L.p2)}</li>
            <li><i><Scale size={18} strokeWidth={1.8} /></i>{t(L.p3)}</li>
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
          <div className="lg-col">
            <div className="lg-card">
              <div className="lg-chead">
                <div className="lg-hat"><img src={hatWhite} alt="" /></div>
                <h1>{t(L.card)}</h1>
              </div>
              <p className="lg-cline">{t(L.cline)}</p>
              <form className="lg-form" onSubmit={submit} noValidate>
                <div className="lg-fg">
                  <label className="lg-label" htmlFor="email">{t(L.email)}</label>
                  <div className={emailErr ? "lg-field bad" : "lg-field"}>
                    <Mail size={18} />
                    <input ref={emailRef} id="email" type="email" autoComplete="email" placeholder={t(L.emailPh)} value={email}
                      aria-invalid={emailErr} aria-describedby={emailErr ? "email-err" : undefined}
                      onChange={(e) => { setEmail(e.target.value); setEmailErr(false); }} />
                  </div>
                  {emailErr && <ErrLine id="email-err" text={t(L.emailErr)} />}
                </div>
                <div className="lg-fg">
                  <div className="lg-lrow">
                    <label className="lg-label" htmlFor="password">{t(L.pw)}</label>
                    <Link to="/forgot-password" className="lg-link">{t(L.forgot)}</Link>
                  </div>
                  <div className={pwMsg ? "lg-field pw bad" : "lg-field pw"}>
                    <Lock size={18} />
                    <input ref={pwRef} id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                      placeholder={t(L.pwPh)} value={password} aria-invalid={!!pwMsg} aria-describedby={pwMsg ? "pw-err" : undefined}
                      onChange={(e) => { setPassword(e.target.value); setPwErr(null); }} />
                    <button type="button" className="lg-eye" aria-pressed={showPassword}
                      aria-label={showPassword ? `${L.hide.th} / ${L.hide.en}` : `${L.show.th} / ${L.show.en}`}
                      onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  {pwMsg && <ErrLine id="pw-err" text={t(pwMsg)} />}
                </div>
                <label className="lg-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t(L.remember)}
                </label>
                <button type="submit" className="lg-btn" disabled={busy}>
                  {busy ? <>{t(L.busy)}<LoaderCircle size={18} className="lg-spin" /></> : <>{t(L.btn)}<LogIn size={18} /></>}
                </button>
              </form>
              <div className="lg-div">{t(L.divider)}</div>
              <div className="lg-prov">
                <button type="button" disabled={busy} onClick={() => void oauthSignIn("google")}><GoogleIcon />Google</button>
                <button type="button" disabled={busy} onClick={() => void oauthSignIn("azure")}><MicrosoftIcon />Microsoft</button>
                <button type="button" disabled={busy} onClick={() => toast.info(t(L.sso))}><Building2 size={16} />SSO</button>
              </div>
            </div>
            <p className="lg-noacc">{t(L.noAcc)}<Link to="/signup">{t(L.signUp)}</Link></p>
            <p className="lg-fine">{t(L.fineA)}<a href="#">{t(L.terms)}</a>{t(L.and)}<a href="#">{t(L.privacy)}</a>{t(L.fineB)}</p>
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
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}
