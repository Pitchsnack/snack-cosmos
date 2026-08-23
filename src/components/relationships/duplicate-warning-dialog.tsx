import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { DuplicateCandidate } from "@/adapters/investor-startup-links-types";

interface Props {
  open: boolean;
  typedName: string;
  candidates: DuplicateCandidate[];
  onCancel: () => void;
  onLinkExisting: (candidate: DuplicateCandidate) => void;
  onCreatePendingAnyway: () => void;
  /** Label for picking an existing record (default: "Link"). */
  linkLabel?: string;
  /** Label for the proceed-anyway footer button (default: "Create Pending Anyway"). */
  createLabel?: string;
}

export function DuplicateWarningDialog({
  open,
  typedName,
  candidates,
  onCancel,
  onLinkExisting,
  onCreatePendingAnyway,
  linkLabel = "Link",
  createLabel = "Create Pending Anyway",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Possible duplicate</DialogTitle>
          <DialogDescription>
            &ldquo;{typedName}&rdquo; looks similar to {candidates.length === 1 ? "an existing record" : "existing records"}.
            Link an existing one, or create a pending entry anyway.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {candidates.map((c, idx) => (
            <button
              key={(c.id ?? "pending") + idx}
              type="button"
              onClick={() => onLinkExisting(c)}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card p-2 text-left hover:bg-accent hover:text-accent-foreground"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                {c.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">{c.subtitle}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {c.matchKind}
                </Badge>
                <Badge className="text-[10px]">{linkLabel}</Badge>
              </div>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">No similar records found.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onCreatePendingAnyway}>
            {createLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
