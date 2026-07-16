/**
 * Default Intake — bulk selection toolbar (preview).
 * Rendered above the queue table when the flag is ON.
 */
import { X, UserCog, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkReassignToolbarProps {
  selectedCount: number;
  startupCount: number;
  investorCount: number;
  onClear: () => void;
  onReassign: () => void;
  onExport: () => void;
  className?: string;
}

export function BulkReassignToolbar({
  selectedCount,
  startupCount,
  investorCount,
  onClear,
  onReassign,
  onExport,
  className,
}: BulkReassignToolbarProps) {
  if (selectedCount === 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm",
        className,
      )}
      data-keep-sidebar
    >
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <span className="font-semibold">
          {selectedCount} selected
        </span>
        <span className="text-xs text-muted-foreground">
          ({startupCount} Startup{startupCount === 1 ? "" : "s"} · {investorCount} Investor
          {investorCount === 1 ? "" : "s"})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Preview export
        </Button>
        <Button size="sm" onClick={onReassign}>
          <UserCog className="mr-1.5 h-3.5 w-3.5" /> Reassign selected
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1.5 h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}
