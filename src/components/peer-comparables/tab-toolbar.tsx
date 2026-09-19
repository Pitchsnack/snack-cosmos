import type { ReactNode } from "react";
import { Menu, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ALL_SECTORS = "__all_sectors__";

/** Case-insensitive substring match — "thai" finds "Thai Union", "tu" finds "TU". */
export function matchesTerm(term: string, ...fields: (string | null | undefined)[]) {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(t));
}

/** Highlights the matched run inside a value. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t) return <>{text}</>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-warning/25 px-0.5 text-foreground">
        {text.slice(i, i + t.length)}
      </mark>
      {text.slice(i + t.length)}
    </>
  );
}

export function TabToolbar({
  search,
  onSearch,
  placeholder,
  sector,
  onSector,
  sectors,
  menu,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  sector: string;
  onSector: (v: string) => void;
  sectors: string[];
  menu: ReactNode;
}) {
  const filterActive = sector !== ALL_SECTORS;
  return (
    <div className="ml-auto flex items-center gap-2 pb-1.5">
      <div
        className={cn(
          "flex h-8 min-w-[230px] items-center gap-2 rounded-lg border border-input bg-background px-2.5",
          "focus-within:border-info focus-within:ring-2 focus-within:ring-info/15",
        )}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearch("")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Select value={sector} onValueChange={onSector}>
        <SelectTrigger
          className={cn(
            "h-8 w-[168px] text-[12.5px]",
            filterActive && "border-info/40 bg-info/10 font-semibold text-info",
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SECTORS}>All sectors</SelectItem>
          {sectors.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Actions"
            className="h-8 w-[34px] data-[state=open]:bg-muted"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[196px]">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ResultCount({
  shown,
  total,
  noun,
  term,
  sector,
  onClear,
}: {
  shown: number;
  total: number;
  noun: string;
  term: string;
  sector: string;
  onClear: () => void;
}) {
  const narrowings: string[] = [];
  if (term.trim()) narrowings.push(`matching “${term.trim()}”`);
  if (sector !== ALL_SECTORS) narrowings.push(`in ${sector}`);
  if (narrowings.length === 0) return null;
  return (
    <p className="px-4 pt-3 text-[11.5px] text-muted-foreground">
      <b className="text-foreground">{shown}</b> of {total} {noun} · {narrowings.join(" ")} ·{" "}
      <button type="button" onClick={onClear} className="font-medium text-info hover:underline">
        clear all
      </button>
    </p>
  );
}
