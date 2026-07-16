/**
 * PRD 01 — Default Intake Preview Notice.
 *
 * Renders ONLY when VITE_DEFAULT_INTAKE_PREVIEW === "true". Presentational
 * only: no data reads, no server calls, no storage, no routing. Reusable on
 * settings, forms, cards, queues, and dialogs.
 */
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEFAULT_INTAKE_PREVIEW_ENABLED } from "@/lib/preview/default-intake-preview-adapter";

export interface DefaultIntakePreviewNoticeProps {
  variant?: "compact" | "full";
  className?: string;
}

export function DefaultIntakePreviewNotice({
  variant = "full",
  className,
}: DefaultIntakePreviewNoticeProps) {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return null;

  if (variant === "compact") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Default Intake preview fixture — not connected to backend"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400",
          className,
        )}
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        <span className="uppercase tracking-wide">Preview fixture</span>
        <span aria-hidden="true" className="text-amber-700/60 dark:text-amber-400/60">·</span>
        <span>No backend changes</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200",
        className,
      )}
    >
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold leading-none">
            Default Intake Preview
          </h3>
          <Badge
            variant="outline"
            className="h-5 border-amber-500/50 bg-transparent px-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300"
          >
            Preview fixture
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
          This screen uses preview fixture data and is not connected to backend
          ownership, audit, permission, or reassignment services.
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">
          Not connected to backend
        </p>
      </div>
    </div>
  );
}
