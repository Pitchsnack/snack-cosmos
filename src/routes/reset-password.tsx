import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — SnackPortal2" }] }),
  component: ResetPasswordPage,
});

const passwordSchema = z
  .string()
  .min(12, "Min 12 characters")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[0-9]/, "Needs a number")
  .regex(/[^A-Za-z0-9]/, "Needs a special character");

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

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
          <p className="mt-1 text-xs text-muted-foreground">
            Min 12 characters, with upper, lower, number, and symbol.
          </p>
        </div>
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
      </div>
    </div>
  );
}
