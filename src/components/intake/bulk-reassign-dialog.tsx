/**
 * Default Intake — bulk reassignment dialog (preview).
 *
 * When the selection contains mixed domains, ALWAYS split the picker into
 * Startup records and Investor records; NEVER offer a single generic AI
 * selector for mixed selections.
 */
import { useEffect, useMemo, useState } from "react";
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
  type DefaultIntakeQueueRecord,
} from "@/lib/default-intake";

const HUMAN_STARTUP = ["Aliyah Ross", "Marco Bianchi", "Sarah Chen"];
const HUMAN_INVESTOR = ["Priya Nair", "Jonas Weber", "David Lim"];
const AI_STARTUP = ["Startup Analysis AI", "Startup Enrichment AI (beta)"];
const AI_INVESTOR = ["Investor Mandate AI", "Investor Portfolio AI (beta)"];

export interface BulkReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: DefaultIntakeQueueRecord[];
}

export function BulkReassignDialog({ open, onOpenChange, selected }: BulkReassignDialogProps) {
  const startupRecords = useMemo(() => selected.filter((r) => r.domain === "startup"), [selected]);
  const investorRecords = useMemo(
    () => selected.filter((r) => r.domain === "investor"),
    [selected],
  );

  const [startupHuman, setStartupHuman] = useState("");
  const [startupAi, setStartupAi] = useState("");
  const [investorHuman, setInvestorHuman] = useState("");
  const [investorAi, setInvestorAi] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setStartupHuman("");
      setStartupAi("");
      setInvestorHuman("");
      setInvestorAi("");
      setSaving(false);
      setConfirmed(false);
    }
  }, [open]);

  const startupReady = startupRecords.length === 0 || (!!startupHuman && !!startupAi);
  const investorReady = investorRecords.length === 0 || (!!investorHuman && !!investorAi);
  const canConfirm = selected.length > 0 && startupReady && investorReady && !saving;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await defaultIntakeAdapter.bulkReassign({
        items: selected.map((r) => ({ recordId: r.id, domain: r.domain })),
        startup:
          startupRecords.length > 0
            ? { newHumanOwnerName: startupHuman, newAiOwnerName: startupAi }
            : undefined,
        investor:
          investorRecords.length > 0
            ? { newHumanOwnerName: investorHuman, newAiOwnerName: investorAi }
            : undefined,
      });
      setConfirmed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk reassign ownership</DialogTitle>
          <DialogDescription>
            {startupRecords.length} Startup{startupRecords.length === 1 ? "" : "s"} ·{" "}
            {investorRecords.length} Investor{investorRecords.length === 1 ? "" : "s"} — preview
            only, no ownership records will be changed.
          </DialogDescription>
        </DialogHeader>

        <DefaultIntakePreviewNotice variant="compact" className="w-fit" />

        <div className="space-y-4">
          {startupRecords.length > 0 && (
            <DomainBlock
              title="Startup records"
              count={startupRecords.length}
              humanLabel="Human owner"
              aiLabel="Startup AI owner"
              humanValue={startupHuman}
              aiValue={startupAi}
              humanOptions={HUMAN_STARTUP}
              aiOptions={AI_STARTUP}
              onHuman={setStartupHuman}
              onAi={setStartupAi}
            />
          )}
          {investorRecords.length > 0 && (
            <DomainBlock
              title="Investor records"
              count={investorRecords.length}
              humanLabel="Human owner"
              aiLabel="Investor AI owner"
              humanValue={investorHuman}
              aiValue={investorAi}
              humanOptions={HUMAN_INVESTOR}
              aiOptions={AI_INVESTOR}
              onHuman={setInvestorHuman}
              onAi={setInvestorAi}
            />
          )}
          {selected.length === 0 && (
            <p className="text-sm text-muted-foreground">No records selected.</p>
          )}

          {confirmed && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-200"
            >
              Preview only — no ownership records were changed.
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

function DomainBlock({
  title,
  count,
  humanLabel,
  aiLabel,
  humanValue,
  aiValue,
  humanOptions,
  aiOptions,
  onHuman,
  onAi,
}: {
  title: string;
  count: number;
  humanLabel: string;
  aiLabel: string;
  humanValue: string;
  aiValue: string;
  humanOptions: string[];
  aiOptions: string[];
  onHuman: (v: string) => void;
  onAi: (v: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border p-3">
      <header className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="text-xs text-muted-foreground">
          {count} record{count === 1 ? "" : "s"}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{humanLabel}</Label>
          <Select value={humanValue} onValueChange={onHuman}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
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
        <div className="space-y-1.5">
          <Label className="text-xs">{aiLabel}</Label>
          <Select value={aiValue} onValueChange={onAi}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
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
    </section>
  );
}
