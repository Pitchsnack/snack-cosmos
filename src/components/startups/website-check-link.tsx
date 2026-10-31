import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WebsiteCheckLink({ valid, url, label, hint }: { valid: boolean; url: string; label: string; hint: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };
  const show = (delay: number) => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <span className="seller-web-check" tabIndex={valid ? undefined : 0} aria-describedby={valid ? undefined : id}
      onMouseEnter={() => show(300)} onMouseLeave={hide} onFocus={() => show(0)} onBlur={hide}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); hide(); } }}>
      <Button variant="unstyled" size="unstyled" disabled={!valid} aria-describedby={id} className="seller-check-button"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
        <ExternalLink className="h-4 w-4" />{label}
      </Button>
      <span id={id} role="tooltip" className="seller-check-tooltip" data-open={open}>{hint}</span>
    </span>
  );
}