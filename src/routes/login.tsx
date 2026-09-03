import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Users,
  Target,
  ShieldCheck,
  Building2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { recordLogin, logSecurityEvent } from "@/lib/auth.functions";
import logoAsset from "@/assets/pitchsnack-logo.png.asset.json";
import { ButtonLoading } from "@/components/ui/PitchSnackLoader";

const searchSchema = z.object({ redirect: z.string().optional() });

const REMEMBER_KEY = "sp2.login.email";

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: search.redirect || "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — SnackPortal2" },
      {
        name: "description",
        content:
          "Sign in to SnackPortal2 — the secure multi-tenant venture collaboration platform.",
      },
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!email.trim()) {
      setFormError("Enter your email address.");
      return;
    }
    if (!password) {
      setFormError("Enter your password.");
      return;
    }

    setFormError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        try {
          await onFailed({ data: { eventType: "FAILED_LOGIN", details: { email } } });
        } catch {
          /* may be unauth — best effort */
        }
        const invalid =
          error.status === 400 ||
          /invalid/i.test(error.message ?? "");
        setFormError(
          invalid
            ? "Email or password is incorrect. Please try again."
            : "Unable to sign in right now. Please try again.",
        );
        setBusy(false);
        return;
      }

      try {
        if (remember) window.localStorage.setItem(REMEMBER_KEY, email.trim());
        else window.localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage unavailable */
      }

      try {
        await onLogin();
      } catch {
        /* best effort */
      }
      await qc.invalidateQueries();
      navigate({ to: search.redirect || "/" });
    } catch {
      setFormError("Unable to sign in right now. Please try again.");
      setBusy(false);
    }
  }

  async function oauthSignIn(provider: "google" | "azure") {
    if (busy) return;
    setFormError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setFormError("Unable to sign in right now. Please try again.");
        setBusy(false);
      }
      // On success the browser redirects to the provider.
    } catch {
      setFormError("Unable to sign in right now. Please try again.");
      setBusy(false);
    }
  }

  function ssoSignIn() {
    toast.info(
      "SSO / SAML sign-in is not configured for this workspace yet. Contact your administrator.",
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] lg:grid lg:grid-cols-[42%_58%]">
      {/* -------- Left: Brand panel -------- */}
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0A1230_0%,#122456_48%,#1B3A8C_100%)] text-white lg:flex lg:flex-col">
        <div className="relative z-10 flex flex-1 flex-col px-10 py-12 xl:px-14">
          {/* Logo + product mark */}
          <div className="flex items-center gap-4">
            <img
              src={logoAsset.url}
              alt="PitchSnack"
              className="h-11 w-auto rounded-lg"
            />
            <div>
              <div className="font-heading text-lg font-semibold tracking-tight">
                Power by SnackPortal<span className="text-blue-400">2</span>
              </div>
              <div className="text-xs text-blue-200/70">
                Multi-Tenant Venture Collaboration
              </div>
            </div>
          </div>

          {/* Pill */}
          <div className="mt-10">
            <span className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-200">
              One Platform. Every Venture.
            </span>
          </div>

          {/* Headline */}
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight tracking-tight xl:text-[2.75rem]">
            Powering Connections.
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Accelerating Growth.
            </span>
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-blue-100/70">
            SnackPortal2 unifies startups, investors, and deals in a secure
            multi-tenant network designed for modern venture collaboration.
          </p>

          {/* Value propositions */}
          <div className="mt-10 max-w-md divide-y divide-white/10">
            <ValueProp
              icon={<Users className="h-5 w-5" />}
              tileClass="bg-gradient-to-br from-blue-500 to-blue-700"
              title="Multi-Tenant Architecture"
              description="Isolated workspaces with enterprise-grade security and control."
            />
            <ValueProp
              icon={<Target className="h-5 w-5" />}
              tileClass="bg-gradient-to-br from-violet-500 to-purple-700"
              title="Deal Intelligence"
              description="AI-powered insights to discover, evaluate, and track opportunities."
            />
            <ValueProp
              icon={<ShieldCheck className="h-5 w-5" />}
              tileClass="bg-gradient-to-br from-teal-500 to-teal-700"
              title="Secure & Compliant"
              description="Built with privacy, auditability, and compliance at the core."
            />
          </div>
        </div>

        {/* Network / globe artwork */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72"
        >
          <svg
            viewBox="0 0 700 300"
            className="absolute bottom-0 left-1/2 h-full w-[135%] -translate-x-1/2"
            fill="none"
          >
            <defs>
              <radialGradient id="globeGlow" cx="50%" cy="100%" r="75%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
                <stop offset="55%" stopColor="#1D4ED8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0A1230" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="arcStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.05" />
                <stop offset="50%" stopColor="#818CF8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <ellipse cx="350" cy="380" rx="380" ry="200" fill="url(#globeGlow)" />
            <path d="M 10 300 A 430 430 0 0 1 690 300" stroke="url(#arcStroke)" strokeWidth="1.5" />
            <path d="M 120 300 A 320 320 0 0 1 580 300" stroke="#3B82F6" strokeOpacity="0.18" strokeWidth="1" />
            <path d="M 230 300 A 210 210 0 0 1 470 300" stroke="#6366F1" strokeOpacity="0.15" strokeWidth="1" />
            {/* connectors */}
            <line x1="175" y1="150" x2="175" y2="235" stroke="#60A5FA" strokeOpacity="0.4" strokeDasharray="3 5" />
            <line x1="350" y1="105" x2="350" y2="180" stroke="#A78BFA" strokeOpacity="0.4" strokeDasharray="3 5" />
            <line x1="525" y1="150" x2="525" y2="235" stroke="#2DD4BF" strokeOpacity="0.35" strokeDasharray="3 5" />
            {/* node glows */}
            <circle cx="175" cy="150" r="26" fill="#3B82F6" fillOpacity="0.25" />
            <circle cx="350" cy="105" r="30" fill="#8B5CF6" fillOpacity="0.25" />
            <circle cx="525" cy="150" r="26" fill="#14B8A6" fillOpacity="0.22" />
            {/* arc points */}
            <circle cx="175" cy="237" r="3.5" fill="#93C5FD" />
            <circle cx="350" cy="182" r="3.5" fill="#C4B5FD" />
            <circle cx="525" cy="237" r="3.5" fill="#5EEAD4" />
            <circle cx="90" cy="265" r="2.5" fill="#60A5FA" fillOpacity="0.6" />
            <circle cx="610" cy="265" r="2.5" fill="#A78BFA" fillOpacity="0.6" />
          </svg>
          {/* icon nodes */}
          <div className="absolute left-1/2 top-0 h-full w-[135%] -translate-x-1/2">
            <div className="absolute left-[21.5%] top-[38%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-blue-500/90 shadow-[0_0_24px_rgba(59,130,246,0.55)]">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="absolute left-1/2 top-[22%] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-500/90 shadow-[0_0_28px_rgba(139,92,246,0.55)]">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div className="absolute left-[78.5%] top-[38%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-teal-500/90 shadow-[0_0_24px_rgba(20,184,166,0.5)]">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </aside>

      {/* -------- Right: Login area -------- */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        {/* Mobile brand header */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <img
            src={logoAsset.url}
            alt="PitchSnack"
            className="h-10 w-auto rounded-md"
          />
          <div>
            <div className="font-heading text-base font-semibold tracking-tight text-slate-900">
              SnackPortal<span className="text-blue-600">2</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Multi-Tenant Venture Collaboration
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to access your workspace
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border-slate-200 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-slate-200 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  className="border-slate-300 data-[state=checked]:border-blue-700 data-[state=checked]:bg-blue-700"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800"
            >
              {busy ? (
                <span className="ps-btn-loading">
                  <ButtonLoading label="Signing in…" />
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Alternative sign-in */}
          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or continue with</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => void oauthSignIn("google")}
              disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <GoogleIcon />
              Google
            </button>
            <button
              type="button"
              onClick={() => void oauthSignIn("azure")}
              disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <MicrosoftIcon />
              Microsoft
            </button>
            <button
              type="button"
              onClick={ssoSignIn}
              disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Building2 className="h-4 w-4 text-slate-500" />
              SSO / SAML
            </button>
          </div>
        </div>

        {/* Trust card */}
        <div className="mt-6 flex w-full max-w-md items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              Secure. Private. Trusted.
            </div>
            <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Enterprise-grade security with role-based access and audit logging.
            </div>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
        </div>

        {/* Footer */}
        <p className="mt-6 max-w-md text-center text-xs text-slate-500">
          By signing in, you agree to our{" "}
          <a href="#" className="font-medium text-blue-700 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="font-medium text-blue-700 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </main>
    </div>
  );
}

function ValueProp({
  icon,
  tileClass,
  title,
  description,
}: {
  icon: React.ReactNode;
  tileClass: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${tileClass}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-blue-100/60">
          {description}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
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
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}
