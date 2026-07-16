/**
 * Default Intake — Agent deactivation impact preview.
 *
 * Domain-specific fixture impact for Human or AI agents. PRESENTATION ONLY —
 * never calls `updateUserStatus` or any ownership-transfer mutation.
 */
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";
import type {
  DefaultIntakeActorType,
  DefaultIntakeDomain,
} from "@/lib/preview/default-intake-preview-adapter";

const HUMAN_STARTUP_REPLACEMENTS = ["Aliyah Ross", "Marco Bianchi"];
const HUMAN_INVESTOR_REPLACEMENTS = ["Priya Nair", "Jonas Weber"];
const AI_STARTUP_REPLACEMENTS = ["Startup Enrichment AI (beta)"];
const AI_INVESTOR_REPLACEMENTS = ["Investor Portfolio AI (beta)"];

export interface DeactivateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
  /** Preview counts — fixture data only. */
  ownedRecords?: number;
  awaitingReassignment?: number;
}

export function DeactivateAgentDialog({
  open,
  onOpenChange,
  agentName,
  actorType,
  domain,
  ownedRecords = domain === "startup" ? 14 : 12,
  awaitingReassignment = 6,
}: DeactivateAgentDialogProps) {
  const [replacement, setReplacement] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setReplacement("");
      setTransferTo("");
      setConfirmed(false);
    }
  }, [open]);

  const replacementOptions =
    actorType === "ai"
      ? domain === "startup"
        ? AI_STARTUP_REPLACEMENTS
        : AI_INVESTOR_REPLACEMENTS
      : domain === "startup"
        ? HUMAN_STARTUP_REPLACEMENTS
        : HUMAN_INVESTOR_REPLACEMENTS;

  const domainLabel = domain === "startup" ? "Startup" : "Investor";
  const roleLabel =
    actorType === "ai"
      ? `Default ${domainLabel} Intake AI Agent`
      : `Default ${domainLabel} Intake Agent`;

  const canConfirm = !!replacement && (actorType === "ai" || !!transferTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {agentName} cannot be deactivated yet
          </DialogTitle>
          <DialogDescription>
            Preview only — no Agent status or ownership will be changed.
          </DialogDescription>
        </DialogHeader>

        <DefaultIntakePreviewNotice variant="compact" className="w-fit" />

        <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current responsibilities
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{roleLabel}</li>
            {actorType === "ai" ? (
              <li>
                Assigned to {ownedRecords} {domainLabel} record{ownedRecords === 1 ? "" : "s"}
              </li>
            ) : (
              <>
                <li>
                  Owner of {ownedRecords} {domainLabel}
                  {ownedRecords === 1 ? "" : "s"}
                </li>
                <li>{awaitingReassignment} records awaiting reassignment</li>
              </>
            )}
          </ul>
        </section>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Replacement {roleLabel}</Label>
            <Select value={replacement} onValueChange={setReplacement}>
              <SelectTrigger>
                <SelectValue placeholder="Select replacement" />
              </SelectTrigger>
              <SelectContent>
                {replacementOptions.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {actorType === "human" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Transfer existing {domainLabel} ownership to</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination owner" />
                </SelectTrigger>
                <SelectContent>
                  {replacementOptions.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!replacement && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              This Agent cannot be deactivated until a valid replacement is selected.
            </p>
          )}

          {confirmed && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-200"
            >
              Preview only — no Agent status or ownership was changed.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {confirmed ? "Close" : "Cancel"}
          </Button>
          {!confirmed && (
            <Button
              disabled={!canConfirm}
              onClick={() => setConfirmed(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm (preview)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
