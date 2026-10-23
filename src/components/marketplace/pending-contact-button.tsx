import { useEffect, useId, useRef, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTr } from "@/components/common/edit-info-popup";
import { cn } from "@/lib/utils";

/** Focusable presentation lock; existing request authorization remains unchanged. */
export function PendingContactButton({ children, className, iconClassName = "h-4 w-4" }: {
  children: React.ReactNode; className?: string; iconClassName?: string;
}) {
  const tr = useTr();
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const hide = () => { clear(); setOpen(false); };
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation(); hide();
    };
    document.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);
  useEffect(() => () => clear(), []);
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <Button variant="unstyled" size="unstyled" type="button" aria-disabled="true" aria-describedby={id}
            className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap", className, "pending-contact-button", open && "pending-contact-blink")}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") { clear(); timer.current = setTimeout(() => setOpen(true), 150); } }}
            onPointerLeave={hide} onFocus={() => { clear(); setOpen(true); }} onBlur={hide}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); clear(); setOpen(true); timer.current = setTimeout(hide, 4000); }}>
            <Lock className={iconClassName} />{children}
          </Button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content id={id} role="tooltip" side="bottom" align="end" sideOffset={10} collisionPadding={8}
            className="pending-contact-tooltip" onEscapeKeyDown={(event) => { event.preventDefault(); hide(); }}>
            <strong>{tr("Your account is pending verification.", "บัญชีของท่านอยู่ระหว่างรอการตรวจสอบ")}</strong>{" "}
            {tr("You can connect once an admin approves it.", "ท่านจะติดต่อได้เมื่อผู้ดูแลระบบอนุมัติแล้ว")}
            <TooltipPrimitive.Arrow width={12} height={6} className="pending-contact-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}