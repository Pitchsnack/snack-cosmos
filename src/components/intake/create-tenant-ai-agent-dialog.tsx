/**
 * Create a tenant-scoped AI Agent (domain-locked).
 *
 * Domain determines the role assignment:
 *   startup  → TENANT_STARTUP_AI
 *   investor → TENANT_INVESTOR_AI
 *
 * Calls the canonical adapter's `createTenantAiAgent`. In transitional
 * mode this provisions a real `public.users` AI row + `user_tenants`
 * membership + domain-specific `user_roles` row for the caller's active
 * tenant — no auth account is created.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultIntakeAdapter, type DefaultIntakeDomain } from "@/lib/default-intake";

export function CreateTenantAiAgentDialog({
  open,
  onOpenChange,
  domain,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: DefaultIntakeDomain;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState(
    domain === "startup" ? "Startup Intake AI" : "Investor Intake AI",
  );
  const m = useMutation({
    mutationFn: () =>
      defaultIntakeAdapter.createTenantAiAgent({ displayName: name.trim(), domain }),
    onSuccess: (agent) => {
      toast.success(`AI Agent "${agent.name}" created.`);
      onCreated(agent.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Create {domain === "startup" ? "Startup" : "Investor"} AI Agent
          </DialogTitle>
          <DialogDescription>
            Domain is locked to <strong>{domain === "startup" ? "Startup" : "Investor"}</strong>.
            The new Agent will receive the{" "}
            <code className="rounded bg-muted px-1 text-[10px]">
              {domain === "startup" ? "TENANT_STARTUP_AI" : "TENANT_INVESTOR_AI"}
            </code>{" "}
            role in your active tenant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-agent-name">Display name</Label>
            <Input
              id="ai-agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>
            {m.isPending ? "Creating…" : "Create AI Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
