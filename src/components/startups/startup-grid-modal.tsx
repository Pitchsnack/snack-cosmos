import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { useStartup } from "@/hooks/use-startup";
import { cn } from "@/lib/utils";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export interface StartupGridModalProps {
  id: string | null;
  onClose: () => void;
  /** Element to return focus to when the modal closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function StartupGridModal({ id, onClose, returnFocusRef }: StartupGridModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const open = !!id;

  // ESC to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    // Focus close button once mounted
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      // Return focus to the tile that opened us
      const target = returnFocusRef?.current;
      if (target && typeof target.focus === "function") {
        try { target.focus(); } catch { /* noop */ }
      }
    };
  }, [open, onClose, returnFocusRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <ModalContents
      id={id!}
      titleId={titleId}
      closeBtnRef={closeBtnRef}
      onClose={onClose}
    />,
    document.body,
  );
}

function ModalContents({
  id,
  titleId,
  closeBtnRef,
  onClose,
}: {
  id: string;
  titleId: string;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { data } = useStartup(id);
  const name = data?.startup_name ?? "Startup";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Only close on backdrop click (not on modal content)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px] animate-fade-in"
        onMouseDown={onClose}
      />

      {/* Modal container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-card shadow-elevated",
          // Mobile: bottom sheet
          "max-h-[92vh] rounded-t-2xl animate-fade-in",
          // Desktop/tablet: centered
          "sm:max-h-[85vh] sm:w-[min(92vw,48rem)] sm:max-w-3xl sm:rounded-2xl sm:animate-scale-in",
        )}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
            {data?.logo_signed_url ? (
              <img src={data.logo_signed_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">{monogram(name)}</span>
            )}
          </div>
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold">
            {name}
          </h2>
          <Button
            ref={closeBtnRef}
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain p-4">
          <StartupDetailPanel id={id} compact />
        </div>
      </div>
    </div>,
  );
}
