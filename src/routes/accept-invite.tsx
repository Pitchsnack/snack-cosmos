import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSchema, PASSWORD_POLICY_TEXT } from "@/lib/password-policy";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Accept invitation — SnackPortal2" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const logEvent = useServerFn(logSecurityEvent);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordSchema.safeParse(password).success) {
      toast.error("Password must be 12+ chars with upper, lower, number, symbol");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("users").update({ status: "Active" }).eq("id", userData.user.id);
    }
    try {
      await logEvent({ data: { eventType: "INVITE_ACCEPTED" } });
    } catch {
      /* noop */
    }
    setBusy(false);
    toast.success("Welcome to SnackPortal2");
    navigate({ to: "/" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Accept your invitation</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Set a password to activate your account.
          </p>
        </div>
        {!ready ? (
          <p className="text-center text-sm text-muted-foreground">
            Open this page from your invitation email to continue.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs uppercase tracking-wide">Password</Label>
              <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-wide">Confirm</Label>
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {busy ? "Activating…" : "Activate account"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
