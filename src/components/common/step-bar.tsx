import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { thaiStepLabel } from "@/i18n/th-company-setup";

export type StepState = "done" | "here" | "missed" | "todo";
export type StepItem = { key: string; label: string; full: string; state: StepState; tip: string };

/**
 * Numbered step bar shared by setup wizards and banners: one column per step,
 * each a button that opens it. `lineTo` = index the navy line runs up to.
 */
export function StepBar({ steps, lineTo, onPick, variant = "wizard", label, stepWord, missedWord, className, missedIcon = false }: {
  steps: StepItem[]; lineTo: number; onPick: (key: string) => void; variant?: "wizard" | "banner";
  label: string; stepWord: (n: number) => string; missedWord: string; className?: string; missedIcon?: boolean;
}) {
  const b = variant === "banner";
  const many = steps.length > 6;
  const lots = steps.length > 10;
  // circle size (desktop) and its vertical centre
  const size = b ? 28 : 32;
  const half = size / 2;
  return (
    <nav aria-label={label} className={cn("w-full", b ? "[--sb-ring:#F4F9FF] dark:[--sb-ring:#16283A]" : "[--sb-ring:#F5F6F8] dark:[--sb-ring:hsl(var(--background))]", className)}>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const navy = i < lineTo;
          return (
            <li key={s.key} className="group relative flex min-w-0 flex-col items-center">
              {!last && (
                <span aria-hidden="true" className={cn("absolute left-1/2 h-[2px] w-full", navy ? "bg-[#1E2A4A] dark:bg-[#8CA3D8]" : "bg-[#DCDFE5] dark:bg-border")}
                  style={{ top: `calc(${half}px - 1px)` }} />
              )}
              <button type="button" onClick={() => onPick(s.key)} aria-current={s.state === "here" ? "step" : undefined}
                aria-label={`${stepWord(i + 1)} · ${s.full}, ${s.tip}`}
                className="relative z-[1] flex w-full min-w-0 flex-col items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-4 max-[599px]:h-11 max-[599px]:w-full max-[599px]:justify-center">
                <span aria-hidden="true"
                  className={cn("grid place-items-center rounded-full font-bold transition-transform duration-150 group-hover:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                    b ? "h-7 w-7 text-[13px]" : "h-8 w-8 text-[14px]", lots ? "max-[599px]:h-5 max-[599px]:w-5 max-[599px]:text-[11px]" : many ? "max-[599px]:h-6 max-[599px]:w-6" : "max-[599px]:h-7 max-[599px]:w-7",
                    s.state === "done" && "bg-[#1E2A4A] text-white shadow-[0_0_0_4px_var(--sb-ring)] dark:bg-[#8CA3D8] dark:text-[#11161F]",
                    s.state === "here" && "border-2 border-[#1E2A4A] bg-white text-[#1E2A4A] shadow-[0_0_0_5px_rgba(30,42,74,.14)] dark:border-[#8CA3D8] dark:bg-card dark:text-[#C9D5F0]",
                    s.state === "missed" && "bg-[#DC2626] text-white shadow-[0_0_0_5px_rgba(220,38,38,.16)]",
                    s.state === "todo" && "border-[1.5px] border-[#C9CED8] bg-white font-semibold text-[#6B7280] shadow-[0_0_0_4px_var(--sb-ring)] dark:border-border dark:bg-card dark:text-muted-foreground")}>
                  {s.state === "done" ? <Check className={b ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={3} /> : s.state === "missed" && missedIcon ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className="h-4 w-4 max-[599px]:h-3 max-[599px]:w-3"><path d="M12 5v9M12 19h.01" /></svg> : i + 1}
                </span>
                <span aria-hidden="true" lang={/[\u0E00-\u0E7F]/.test(s.label) ? "th" : "en"} className={cn("mt-2 w-[calc(100%-4px)] min-w-0 whitespace-normal hyphens-auto text-center [word-break:keep-all] [overflow-wrap:anywhere] group-hover:underline max-[599px]:hidden", lots ? "text-[11.5px] leading-[1.3]" : b ? "mt-1.5 text-[12px] leading-[1.35]" : "text-[12.5px] leading-[1.35]",
                  s.state === "done" && "font-medium text-[#374151] dark:text-foreground",
                  s.state === "here" && "font-bold text-[#151A28] dark:text-foreground",
                  s.state === "missed" && "font-semibold text-[#B91C1C] dark:text-red-400",
                  s.state === "todo" && "font-medium text-[#6B7280] dark:text-muted-foreground")}>
                  {thaiStepLabel(s.label)}
                  {s.state === "missed" && !missedIcon && <span className={cn("block font-medium", b ? "text-[11px]" : "text-[11.5px]")}>{missedWord}</span>}
                </span>
              </button>
              <span aria-hidden="true"
                className={cn("pointer-events-none absolute z-20 w-max max-w-[240px] rounded-[9px] bg-[#151A28] px-[11px] py-2 text-[12.5px] leading-[1.4] opacity-0 shadow-[0_10px_24px_rgba(16,24,40,.24)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-[599px]:hidden dark:bg-popover dark:ring-1 dark:ring-border",
                  "bottom-[calc(100%+12px)]", i === 0 ? "left-[calc(50%-24px)]" : last ? "right-[calc(50%-24px)]" : "left-1/2 -translate-x-1/2")}>
                <b className="block font-bold text-white">{stepWord(i + 1)} · {s.full}</b>
                <span className="text-[#D7DBE3]">{s.tip}</span>
                <span className="absolute top-full border-[5px] border-transparent border-t-[#151A28] dark:border-t-popover"
                  style={i === 0 ? { left: 19 } : last ? { right: 19 } : { left: "50%", marginLeft: -5 }} />
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Red line (desktop) / red box (phone) under the wizard's bar. */
export function MissedNote({ missed, desktop, row, answerNow, onPick }: {
  missed: { key: string; n: number; full: string }[]; desktop: string; row: (n: number, full: string) => string; answerNow: string; onPick: (k: string) => void;
}) {
  if (!missed.length) return null;
  return (
    <>
      <p className="mt-[18px] flex items-center justify-center gap-1.5 text-center text-[13.5px] text-[#B91C1C] max-[599px]:hidden dark:text-red-400">
        <CircleAlert className="h-4 w-4 shrink-0" />{desktop}
      </p>
      <div className="mt-2.5 hidden space-y-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 max-[599px]:block dark:border-red-900 dark:bg-red-950/40">
        {missed.map((m) => (
          <div key={m.key} className="flex items-start gap-2 text-[13.5px] text-[#B91C1C] dark:text-red-400">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{row(m.n, m.full)}</span>
            <button type="button" onClick={() => onPick(m.key)} className="shrink-0 font-bold underline">{answerNow}</button>
          </div>
        ))}
      </div>
    </>
  );
}
