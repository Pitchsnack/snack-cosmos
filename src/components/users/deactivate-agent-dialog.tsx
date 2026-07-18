/**
 * Deactivate a Default Intake Agent (impact confirmation).
 *
 * Presentational. The actual deactivation server function will land with
 * the Default Intake reassignment backend (PRD §15). Until then this
 * dialog explains the impact and asks the user to reassign via Settings.
 */
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DefaultIntakeActorType, DefaultIntakeDomain } from "@/lib/default-intake";

export interface DeactivateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
}

export function DeactivateAgentDialog({
  open,
  onOpenChange,
  agentName,
  actorType,
  domain,
}: DeactivateAgentDialogProps) {
  const domainLabel = domain === "startup" ? "Startup" : "Investor";
  const roleLabel =
    actorType === "ai"
      ? `Default ${domainLabel} Intake AI Agent`
      : `Default ${domainLabel} Intake Agent`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {agentName} is currently the {roleLabel}
          </DialogTitle>
          <DialogDescription>
            Deactivating a Default Intake owner is blocked by the tenant configuration trigger
            until you assign a replacement in{" "}
            <a href="/settings/default-intake" className="underline underline-offset-2">
              Settings → Default Intake Assignment
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
