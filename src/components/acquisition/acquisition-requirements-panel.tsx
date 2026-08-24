/**
 * Acquisition Requirements summary panel for My Startups.
 *
 * Opened by clicking a requirement chip on a My Startups card. Shows the
 * structured requirements in read-only form; the Edit action jumps to the
 * Acquisition Strategy → Acquisition Requirements tab. Closing returns the
 * user to the same My Startups page, view and scroll position.
 */

import { Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AcquisitionRequirements } from "@/lib/acquisition/strategy-store";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function RequirementRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex gap-3 border-t border-border/50 py-2.5">
      <div className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {items.length ? (
        <div className="flex min-w-0 flex-wrap gap-1">
          {items.map((k) => (
            <span
              key={k}
              className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
            >
              {k}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </div>
  );
}

export function AcquisitionRequirementsPanel({
  open,
  requirements,
  updatedAt,
  onClose,
  onEdit,
}: {
  open: boolean;
  requirements: AcquisitionRequirements;
  updatedAt: string | null;
  onClose: () => void;
  /** Jump to Acquisition Strategy → Acquisition Requirements tab. */
  onEdit?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "[&>button]:hidden",
          "p-0 gap-0 flex flex-col overflow-hidden",
          "sm:max-w-xl sm:max-h-[85vh] sm:rounded-2xl",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none",
        )}
      >
        <DialogTitle className="sr-only">Acquisition requirements summary</DialogTitle>
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="relative h-10 shrink-0">
            <DialogClose
              aria-label="Back to My Startups"
              title="Back to My Startups"
              className="absolute right-3 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">Acquisition Requirements</h3>
                {updatedAt && formatDate(updatedAt) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Updated {formatDate(updatedAt)}
                  </p>
                )}
              </div>
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={onEdit}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
              )}
            </div>

            <div className="mt-4">
              <RequirementRow label="Industries" items={requirements.industries} />
              <RequirementRow label="Keywords" items={requirements.keywords} />
              <RequirementRow label="Product & Service Tags" items={requirements.productTags} />
              <RequirementRow label="Markets" items={requirements.markets} />
              <RequirementRow label="Company Stage" items={requirements.stages} />
              <RequirementRow
                label="Company Size"
                items={requirements.companySize ? [requirements.companySize] : []}
              />
              <div className="flex gap-3 border-y border-border/50 py-2.5">
                <div className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Strategic Reason
                </div>
                {requirements.strategicReason ? (
                  <p className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {requirements.strategicReason}
                  </p>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
