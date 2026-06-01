import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — SnackPortal2" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Reset password</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            We'll email you a link valid for 30 minutes.
          </p>
        </div>
        {sent ? (
          <p className="rounded-md bg-success/10 px-3 py-2 text-center text-sm text-success">
            If an account exists, a reset link has been sent.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wide">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="text-center text-xs">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
