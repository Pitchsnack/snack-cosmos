import { Check } from "lucide-react";
import { ALL_TYPES, sortActsFor } from "@/lib/investor-bands";
import { cn } from "@/lib/utils";

/** "Acts for": a representative's investor types (one or more, list order). Shared by the buyer's forms and Admin's Edit Investor. */
export function ActsForField({ value, onChange, error, id = "f-acts_for", label = "Acts for" }: {
  value: string[]; onChange: (v: string[]) => void; error?: string | null; id?: string; label?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}<span className="relative -top-0.5 ml-[3px] text-[12px] font-semibold text-[#B42318]">*</span>
        <span className="ml-2 text-[12px] font-normal text-muted-foreground">pick all that apply</span></div>
      <div id={id} role="group" aria-label="Acts for" tabIndex={-1} className="flex flex-wrap gap-1.5">
        {ALL_TYPES.map((t) => {
          const on = value.includes(t.value);
          return (
            <button key={t.value} type="button" role="checkbox" aria-checked={on}
              onClick={() => onChange(sortActsFor(on ? value.filter((x) => x !== t.value) : [...value, t.value]))}
              className={cn("inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13px]",
                on ? "border-primary bg-primary/10 font-semibold" : "border-border bg-background hover:border-foreground/30")}>
              <span className={cn("grid h-4 w-4 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>{on && <Check className="h-3 w-3" />}</span>
              {t.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[12.5px] text-[#B42318]">{error}</p>}
    </div>
  );
}
