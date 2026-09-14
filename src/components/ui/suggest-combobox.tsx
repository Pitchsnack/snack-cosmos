/**
 * Shared searchable combobox used by both the ISO standards field and the
 * Licence name field in Edit Startup. Filters live, substring + punctuation
 * insensitive, bolds matches, dims already-added values, and always offers
 * "+ Add …" for a value that is not on the list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  /** Value added when picked. */
  value: string;
  /** Muted text on the right — subject area or usage count. */
  meta?: string;
  /** Already added: dimmed, shows ✓ added, not selectable. */
  added?: boolean;
}

/** Case-insensitive, ignores spaces, hyphens, dashes and dots. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\-—–._]/g, "");
}

/** Bolds the run of characters in `label` that produced the normalised match. */
function highlight(label: string, query: string) {
  const q = norm(query);
  if (!q) return label;
  // Map each label char to its normalised index.
  const idx: number[] = [];
  let n = "";
  for (let i = 0; i < label.length; i++) {
    const c = norm(label[i]!);
    if (c) {
      n += c;
      idx.push(i);
    }
  }
  const at = n.indexOf(q);
  if (at < 0) return label;
  const start = idx[at]!;
  const end = idx[at + q.length - 1]!;
  return (
    <>
      {label.slice(0, start)}
      <b className="font-bold text-[#1D4ED8]">{label.slice(start, end + 1)}</b>
      {label.slice(end + 1)}
    </>
  );
}

export function SuggestCombobox({
  options,
  placeholder,
  noun,
  onSelect,
  className,
  id,
}: {
  options: ComboOption[];
  placeholder: string;
  /** e.g. "standard" → `+ Add "x" as a new standard`. */
  noun: string;
  onSelect: (value: string, isNew: boolean) => void;
  className?: string;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = `${id ?? "combo"}-listbox`;

  const typed = query.trim().replace(/\s{2,}/g, " ");

  const matches = useMemo(() => {
    const q = norm(typed);
    if (!q) return options;
    return options.filter((o) => norm(o.value).includes(q));
  }, [options, typed]);

  const exact = matches.some((o) => norm(o.value) === norm(typed));
  const showAddNew = typed.length > 0 && !exact;
  const rows = matches.length + (showAddNew ? 1 : 0);

  useEffect(() => setActive(0), [typed, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (i: number) => {
    if (i < matches.length) {
      const o = matches[i];
      if (!o || o.added) return;
      onSelect(o.value, false);
    } else if (showAddNew) {
      onSelect(typed, true);
    } else return;
    setQuery("");
    setActive(0);
  };

  const step = (dir: 1 | -1) => {
    if (!rows) return;
    let next = active;
    for (let k = 0; k < rows; k++) {
      next = (next + dir + rows) % rows;
      if (next >= matches.length || !matches[next]?.added) break;
    }
    setActive(next);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="flex h-[42px] items-center gap-2 rounded-[9px] border border-[#D7DBE2] bg-white px-3 focus-within:border-[#2563EB] focus-within:shadow-[0_0_0_3px_#EFF4FE]">
        <Search className="h-[15px] w-[15px] shrink-0 text-[#9AA3AF]" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows ? `${listId}-${active}` : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) setOpen(true);
              else step(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              step(-1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open) pick(active);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className="w-full bg-transparent text-[13.5px] text-[#0F1B33] outline-none placeholder:text-[#9AA3AF]"
        />
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-[6px] max-h-[280px] w-full overflow-auto rounded-[9px] border border-[#D7DBE2] bg-white shadow-[0_8px_20px_rgba(15,23,42,.10)]"
        >
          {matches.length === 0 && typed.length > 0 && (
            <div className="border-b border-[#EFF1F4] px-3 py-[9px] text-[13px] italic text-muted-foreground">
              No {noun} matches “{typed}”
            </div>
          )}
          {matches.map((o, i) => (
            <div
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={o.added || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => !o.added && setActive(i)}
              onClick={() => pick(i)}
              className={cn(
                "flex items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-[13px] last:border-b-0",
                o.added ? "cursor-default text-[#9AA3AF]" : "cursor-pointer text-[#0F1B33]",
                i === active && !o.added && "bg-[#EFF4FE]",
              )}
            >
              <span>{o.added ? o.value : highlight(o.value, typed)}</span>
              <span className="ml-auto text-[11.5px] text-[#9AA3AF]">
                {o.added ? "✓ added" : o.meta}
              </span>
            </div>
          ))}
          {showAddNew && (
            <div
              id={`${listId}-${matches.length}`}
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(matches.length)}
              onClick={() => pick(matches.length)}
              className={cn(
                "cursor-pointer px-3 py-[9px] text-[13px] font-medium text-[#15803D]",
                active === matches.length && "bg-[#EFF4FE]",
              )}
            >
              + Add “{typed}” as a new {noun}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
