import { useState } from "react";
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordLogin, logSecurityEvent } from "@/lib/auth.functions";
import logoBlack from "@/assets/pitchsnack-black.png";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: search.redirect || "/" });
  },
  head: () => ({
    meta: [{ title: "Sign in — SnackPortal2" }],
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
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      try {
        await onFailed({ data: { eventType: "FAILED_LOGIN", details: { email } } });
      } catch {
        /* may be unauth — best effort */
      }
      toast.error(error.message);
      setBusy(false);
      return;
    }
    try {
      await onLogin();
    } catch {
      /* best effort */
    }
    await qc.invalidateQueries();
    toast.success("Welcome back");
    navigate({ to: search.redirect || "/" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="text-center">
          <img src={logoBlack} alt="PitchSnack" className="mx-auto h-10 w-auto" />
          <h1 className="mt-4 text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Platform access is invitation-only.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs uppercase tracking-wide">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs uppercase tracking-wide">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="text-center text-xs">
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
