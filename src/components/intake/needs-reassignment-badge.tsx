/**
 * Default Intake — "Needs reassignment" badge.
 *
 * Presentational. Renders based on caller-supplied `needsReassignment`
 * data — no feature-flag branching, no adapter reads. Card / list-item
 * hosts pass `false` today because the Intake Queue backend is not yet
 * available (see PRD §15); when it lands the same badge lights up
 * without a UI change.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DefaultIntakeDomain } from "@/lib/default-intake";

export function NeedsReassignmentBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 border-amber-500/50 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-300",
        size === "xs" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
        className,
      )}
      title="Needs reassignment"
    >
      <AlertTriangle className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
      Needs reassignment
    </Badge>
  );
}

/**
 * Prop-driven wrapper used from Startup / Investor cards + list items.
 * Renders only when `needsReassignment === true`. `name` + `domain` are
 * accepted for backwards compatibility with existing call sites; they are
 * ignored today because the Queue backend hasn't landed.
 */
export function PreviewNeedsReassignmentBadge({
  needsReassignment,
  className,
  size = "sm",
}: {
  needsReassignment?: boolean;
  name?: string | null | undefined;
  domain?: DefaultIntakeDomain;
  className?: string;
  size?: "xs" | "sm";
}) {
  if (!needsReassignment) return null;
  return <NeedsReassignmentBadge className={className} size={size} />;
}
