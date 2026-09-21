import { useMemo, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Selected values per column (empty / missing = no filter). */
export type ValueFilters = Record<string, string[]>;
/** Numeric min/max per column (both optional). */
export type RangeFilters = Record<string, { min: number | null; max: number | null }>;

export const EMPTY_LABEL = "(blank)";

function HeaderShell({
  label,
  align = "left",
  active,
  children,
}: {
  label: string;
  align?: "left" | "right" | "center";
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 hover:text-white",
            align === "right" && "justify-end",
            align === "center" && "justify-center",
            active && "text-white",
          )}
        >
          <span>{label}</span>
          <Filter
            className={cn(
              "h-3 w-3 shrink-0",
              active ? "fill-white text-white" : "text-white/50",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

export function ValueColumnFilter({
  label,
  align,
  options,
  selected,
  onChange,
}: {
  label: string;
  align?: "left" | "right" | "center";
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [term, setTerm] = useState("");
  const shown = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(term.trim().toLowerCase())),
    [options, term],
  );

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <HeaderShell label={label} align={align} active={selected.length > 0}>
      {() => (
        <div className="space-y-2">
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}…`}
            className="h-8 text-sm"
          />
          <div className="max-h-56 overflow-y-auto overscroll-contain pr-1">
            {shown.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">No values.</p>
            )}
            {shown.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
              >
                <Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} />
                <span className="truncate" title={o}>
                  {o}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(shown)}
            >
              Select all
            </Button>
          </div>
        </div>
      )}
    </HeaderShell>
  );
}

export function RangeColumnFilter({
  label,
  align = "right",
  value,
  onChange,
}: {
  label: string;
  align?: "left" | "right" | "center";
  value: { min: number | null; max: number | null };
  onChange: (next: { min: number | null; max: number | null }) => void;
}) {
  const active = value.min !== null || value.max !== null;
  const num = (raw: string) => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  return (
    <HeaderShell label={label} align={align} active={active}>
      {() => (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Show rows between</p>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              inputMode="decimal"
              className="h-8 text-sm"
              placeholder="Min"
              defaultValue={value.min ?? ""}
              onChange={(e) => onChange({ ...value, min: num(e.target.value) })}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              inputMode="decimal"
              className="h-8 text-sm"
              placeholder="Max"
              defaultValue={value.max ?? ""}
              onChange={(e) => onChange({ ...value, max: num(e.target.value) })}
            />
          </div>
          <div className="border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!active}
              onClick={() => onChange({ min: null, max: null })}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </HeaderShell>
  );
}

export function matchesValueFilter(selected: string[] | undefined, raw: string | null) {
  if (!selected || selected.length === 0) return true;
  return selected.includes(raw && raw.trim() ? raw : EMPTY_LABEL);
}

export function matchesRangeFilter(
  range: { min: number | null; max: number | null } | undefined,
  v: number | null,
) {
  if (!range || (range.min === null && range.max === null)) return true;
  if (v === null) return false;
  if (range.min !== null && v < range.min) return false;
  if (range.max !== null && v > range.max) return false;
  return true;
}
