import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSchema, PASSWORD_POLICY_TEXT } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — SnackPortal2" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Establish a recovery session. Supabase may deliver the token in three shapes:
  //   1. URL hash  (#access_token=...&type=recovery)           — implicit flow
  //   2. ?code=... query param                                  — PKCE flow
  //   3. ?token_hash=...&type=recovery query param              — OTP/token_hash flow
  // Also surfaces ?error=...&error_code=... when the token was consumed by an
  // email link scanner (the real reason for "invalid or expired").
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

        // 0) Error returned from /auth/v1/verify (expired / already used).
        const errCode = url.searchParams.get("error_code") || hash.get("error_code");
        const errDesc = url.searchParams.get("error_description") || hash.get("error_description");
        if (errCode) {
          if (!mounted) return;
          setErrorMsg(errDesc?.replace(/\+/g, " ") || "Reset link is invalid or has expired.");
          setChecking(false);
          return;
        }

        // 1) PKCE: ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (error) {
            setErrorMsg(error.message);
            setChecking(false);
            return;
          }
          window.history.replaceState({}, "", url.pathname);
          setReady(true);
          setChecking(false);
          return;
        }

        // 2) token_hash flow: ?token_hash=...&type=recovery
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as "recovery",
            token_hash: tokenHash,
          });
          if (!mounted) return;
          if (error) {
            setErrorMsg(error.message);
            setChecking(false);
            return;
          }
          window.history.replaceState({}, "", url.pathname);
          setReady(true);
          setChecking(false);
          return;
        }

        // 3) Hash flow / already-restored session.
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session) setReady(true);
        setChecking(false);
      } catch (e) {
        if (!mounted) return;
        setErrorMsg(e instanceof Error ? e.message : "Failed to verify reset link.");
        setChecking(false);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="mt-1 text-xs text-muted-foreground">{PASSWORD_POLICY_TEXT}</p>
        </div>
        {checking ? (
          <p className="text-center text-sm text-muted-foreground">Verifying reset link…</p>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">
            This reset link is invalid or has expired. Request a new one from the
            forgot password page.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs uppercase tracking-wide">New password</Label>
              <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-wide">Confirm</Label>
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
