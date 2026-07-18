/**
 * Default Intake — reusable individual reassignment dialog (preview).
 *
 * PRESENTATION ONLY. Does not call any existing server function
 * (`reassignOwner`, `reassignAiOwner`, `reassignInvestorOwner`, etc.).
 * Domain-specific: Startup records show only Startup-AI replacements;
 * Investor records show only Investor-AI replacements.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";
import {
  defaultIntakeAdapter,
  type DefaultIntakeDomain,
  type DefaultIntakeQueueRecord,
} from "@/lib/default-intake";

const HUMAN_STARTUP = ["Aliyah Ross", "Marco Bianchi", "Sarah Chen"];
const HUMAN_INVESTOR = ["Priya Nair", "Jonas Weber", "David Lim"];
const AI_STARTUP = ["Startup Analysis AI", "Startup Enrichment AI (beta)"];
const AI_INVESTOR = ["Investor Mandate AI", "Investor Portfolio AI (beta)"];

export interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DefaultIntakeQueueRecord | null;
}

export function ReassignDialog({ open, onOpenChange, record }: ReassignDialogProps) {
  const [newHuman, setNewHuman] = useState<string>("");
  const [newAi, setNewAi] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setNewHuman("");
      setNewAi("");
      setReason("");
      setConfirmed(false);
      setSaving(false);
    }
  }, [open]);

  if (!record) return null;

  const domain: DefaultIntakeDomain = record.domain;
  const humanOptions = domain === "startup" ? HUMAN_STARTUP : HUMAN_INVESTOR;
  const aiOptions = domain === "startup" ? AI_STARTUP : AI_INVESTOR;

  const canConfirm = !!newHuman && !!newAi && !saving;

  const handleConfirm = () => {
    // Guard: fixture IDs must never reach any server function.
    assertNoDefaultIntakePreviewIds([record.id, record.humanOwner.id, record.aiOwner.id]);
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setConfirmed(true);
    }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign ownership</DialogTitle>
          <DialogDescription>
            {domain === "startup" ? "Startup" : "Investor"} record — preview only, no ownership
            record will be changed.
          </DialogDescription>
        </DialogHeader>

        <DefaultIntakePreviewNotice variant="compact" className="w-fit" />

        <div className="space-y-3">
          <ReadOnlyRow label="Record" value={record.name} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyRow label="Current human owner" value={record.humanOwner.name} />
            <div className="space-y-1.5">
              <Label className="text-xs">New human owner</Label>
              <Select value={newHuman} onValueChange={setNewHuman}>
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement" />
                </SelectTrigger>
                <SelectContent>
                  {humanOptions.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ReadOnlyRow label="Current AI owner" value={record.aiOwner.name} />
            <div className="space-y-1.5">
              <Label className="text-xs">
                New {domain === "startup" ? "Startup" : "Investor"} AI owner
              </Label>
              <Select value={newAi} onValueChange={setNewAi}>
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement" />
                </SelectTrigger>
                <SelectContent>
                  {aiOptions.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reassign-reason" className="text-xs">
              Reason (optional)
            </Label>
            <Textarea
              id="reassign-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add context for the reassignment…"
            />
          </div>

          {confirmed && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-200"
            >
              Preview only — no ownership record was changed.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {confirmed ? "Close" : "Cancel"}
          </Button>
          {!confirmed && (
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Applying preview…
                </>
              ) : (
                "Confirm (preview)"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-sm">{value}</div>
    </div>
  );
}
