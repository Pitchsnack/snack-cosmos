import { Check } from "lucide-react";

const STEPS = [
  { label: "Quick Info", hint: "Enter essential details" },
  { label: "Auto Enrich", hint: "Find and populate info" },
  { label: "Review & Complete", hint: "Review, edit and save" },
];

/** Compact 3-step progress indicator for the Add Startup flow. */
export function StartupStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-start justify-center gap-2">
      {STEPS.map((s, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <div key={s.label} className="flex flex-1 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  active || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span
                className={`mt-1.5 truncate text-xs font-medium ${
                  active || done ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{s.hint}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mt-3.5 h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
