import type { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Two information sections side by side with a vertical divider, collapsing to
 * a stacked pair with horizontal rules below 700px.
 *
 * Shared by the Investor and Startup information panels — one implementation
 * so the two panels can never drift apart visually.
 */
export function PairedSection({
  left,
  right,
  className,
}: {
  left: { icon: typeof Calendar; title: string; content: React.ReactNode };
  right: { icon: typeof Calendar; title: string; content: React.ReactNode };
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid border-t border-b border-border/50 py-[11.2px]",
        "max-[700px]:grid-cols-1 max-[700px]:divide-y max-[700px]:divide-border/50 max-[700px]:gap-0",
        "min-[700px]:grid-cols-[1fr_1px_1fr] min-[700px]:gap-[11.5px]",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <left.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {left.title}
        </h3>
        <div className="min-w-0">{left.content}</div>
      </div>
      <div className="hidden w-px bg-[#EEEEEE] self-stretch min-[700px]:block" aria-hidden />
      <div className="min-w-0 max-[700px]:pt-[11.2px]">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <right.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {right.title}
        </h3>
        <div className="min-w-0">{right.content}</div>
      </div>
    </section>
  );
}
