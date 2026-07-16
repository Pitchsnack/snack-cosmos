/**
 * Default Intake preview — "Needs reassignment" badge.
 *
 * Renders ONLY when VITE_DEFAULT_INTAKE_PREVIEW === "true". Presentational
 * only; no data reads, no persistence. Used on Startup / Investor cards,
 * list items, detail panels, and ownership cards.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  listDefaultIntakePreviewQueue,
} from "@/lib/preview/default-intake-preview-adapter";

/** True when preview flag is ON and the record name matches a queue fixture. */
export function isPreviewNeedsReassignmentName(
  name: string | null | undefined,
  domain: "startup" | "investor",
): boolean {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return false;
  if (!name) return false;
  const trimmed = name.trim().toLowerCase();
  return listDefaultIntakePreviewQueue().some(
    (r) => r.domain === domain && r.name.trim().toLowerCase() === trimmed,
  );
}

export function NeedsReassignmentBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm";
}) {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 border-amber-500/50 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-300",
        size === "xs" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
        className,
      )}
      title="Preview fixture — needs reassignment"
    >
      <AlertTriangle className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
      Needs reassignment
    </Badge>
  );
}

/**
 * Conditional convenience wrapper: renders the badge only when the record
 * matches the preview fixture queue for its domain. Safe to drop into any
 * card / list item — no-op when the flag is OFF.
 */
export function PreviewNeedsReassignmentBadge({
  name,
  domain,
  className,
  size = "sm",
}: {
  name: string | null | undefined;
  domain: "startup" | "investor";
  className?: string;
  size?: "xs" | "sm";
}) {
  if (!isPreviewNeedsReassignmentName(name, domain)) return null;
  return <NeedsReassignmentBadge className={className} size={size} />;
}
