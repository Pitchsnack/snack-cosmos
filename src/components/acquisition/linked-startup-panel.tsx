import { useState } from "react";
import { X } from "lucide-react";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { cn } from "@/lib/utils";

/**
 * Startup Information Panel opened as a temporary overlay from the
 * Acquisition Strategy page. Closing (X, Esc, backdrop, or the panel's own
 * back affordances) returns to the same Acquisition Strategy page and tab —
 * it never navigates to the Startup Directory, the My Startups list, or the
 * startup profile route.
 */
export function LinkedStartupPanel({
  startupId,
  onClose,
  backLabel = "Back to Acquisition Strategy",
}: {
  startupId: string | null;
  onClose: () => void;
  /** Accessible label for the close button — names the surface it returns to. */
  backLabel?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = hovered || focused;

  return (
    <Dialog open={!!startupId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "[&>button]:hidden",
          "p-0 gap-0 flex flex-col overflow-hidden",
          "sm:max-w-2xl sm:max-h-[85vh] sm:rounded-2xl",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none",
        )}
      >
        <DialogTitle className="sr-only">Linked startup information</DialogTitle>
        <div
          className="relative flex flex-1 flex-col overflow-hidden"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="relative h-10 shrink-0">
            <DialogClose
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Back to Acquisition Strategy"
              title="Back to Acquisition Strategy"
              className={cn(
                "absolute right-3 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-opacity duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                visible ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
            {startupId && (
              <StartupDetailPanel
                id={startupId}
                compact
                workspace="my-startups"
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
