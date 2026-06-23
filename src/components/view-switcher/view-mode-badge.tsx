import { Badge } from "@/components/ui/badge";
import { useViewMode } from "@/hooks/use-view-mode";
import { VIEW_ROLE_LABELS } from "@/context/view-mode-context";

/**
 * PRD 7.1 — amber badge shown only when previewing as a non-Control role.
 * Self-gates on isPreviewMode (Control-only + non-Control selection).
 */
export function ViewModeBadge() {
  const { isPreviewMode, effectiveRenderRole } = useViewMode();
  if (!isPreviewMode || !effectiveRenderRole) return null;

  return (
    <Badge
      variant="outline"
      className="hidden h-6 items-center gap-1 border-amber-500/40 bg-amber-500/10 px-2 text-[11px] font-medium text-amber-600 dark:text-amber-400 md:inline-flex"
      data-keep-sidebar
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      Previewing as {VIEW_ROLE_LABELS[effectiveRenderRole]} — presentation only
    </Badge>
  );
}
