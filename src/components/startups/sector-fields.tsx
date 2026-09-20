/**
 * Sector + Business model — the financial-benchmarking pair.
 *
 * Sector uses a two-pane picker (groups left with counts, sectors right) with
 * a search field above both panes that matches across every sector and shows
 * the group of each match. Both fields are optional and never block a save.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BUSINESS_MODELS,
  SECTOR_GROUPS,
  SECTOR_HINTS,
  sectorGroupOf,
} from "@/lib/sectors";
import { cn } from "@/lib/utils";
import { usePeerAvailability } from "@/hooks/use-peer-availability";
import { modelAvailability, type AvailabilityBadge } from "@/lib/peer-comparables";

function norm(s: string) {
  return s.toLowerCase().replace(/[\s\-—–._&/]/g, "");
}

export function SectorPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  /** Inline 28px trigger, no pill beneath. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>(
    () => sectorGroupOf(value) ?? SECTOR_GROUPS[0]!.group,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const optionListRef = useRef<HTMLDivElement>(null);

  const typed = query.trim();
  const searchMatches = useMemo(() => {
    const q = norm(typed);
    if (!q) return null;
    const out: { sector: string; group: string }[] = [];
    for (const g of SECTOR_GROUPS) {
      for (const s of g.sectors) {
        if (norm(s).includes(q)) out.push({ sector: s, group: g.group });
      }
    }
    return out;
  }, [typed]);

  const activeGroup = SECTOR_GROUPS.find((g) => g.group === group) ?? SECTOR_GROUPS[0]!;
  const visibleSectors = searchMatches?.map((match) => match.sector) ?? activeGroup.sectors;

  useEffect(() => {
    if (!open) return;
    const selectedIndex = visibleSectors.indexOf(value ?? "");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [group, open, query, value]);

  useEffect(() => {
    if (!open) return;
    optionListRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
    setQuery("");
    setGroup(sectorGroupOf(s) ?? group);
  };

  const handleOptionKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleSectors.length === 0) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        (current + direction + visibleSectors.length) % visibleSectors.length,
      );
      return;
    }
    if (event.key === "Enter" && visibleSectors[activeIndex]) {
      event.preventDefault();
      pick(visibleSectors[activeIndex]);
    }
  };

  return (
    <div className={compact ? "inline-block" : undefined}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label="Choose sector"
            className={cn(
              "items-center gap-2 border text-left focus:outline-none",
              compact
                ? "inline-flex h-7 max-w-[240px] rounded-[6px] border-[#D3D9E2] bg-white px-[9px] text-[12.5px] font-medium text-[#0F1B33]"
                : "flex h-[42px] w-full rounded-[9px] border-[#D7DBE2] bg-background px-3 text-[13.5px] focus:border-[#2563EB] focus:shadow-[0_0_0_3px_#EFF4FE]",
              compact && !value && "border-[#E9D4B4] bg-[#FDF9F3] font-normal text-[#B45309]",
            )}
          >
            {!compact && <Search className="h-[15px] w-[15px] shrink-0 text-[#9AA3AF]" />}
            <span className={cn("truncate", !value && !compact && "text-muted-foreground")}>
              {value ?? (compact ? "Not set" : "Search or pick a sector…")}
            </span>
            <ChevronDown
              className={cn(
                "ml-auto shrink-0 text-muted-foreground",
                compact ? "h-3.5 w-3.5" : "h-4 w-4",
              )}
            />
          </button>
        </PopoverTrigger>


        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="w-[var(--radix-popover-trigger-width)] min-w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-[10px] border-[#D7DBE2] p-0 shadow-[0_10px_24px_rgba(15,23,42,.10)]"
        >
          <div className="flex items-center gap-2 border-b border-[#EFF1F4] px-3 py-2">
            <Search className="h-[14px] w-[14px] text-[#9AA3AF]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleOptionKeys}
              placeholder="Search sectors…"
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-[#9AA3AF]"
            />
          </div>

          {compact && value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center border-b border-[#EFF1F4] px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-[#F8FAFD]"
            >
              Not set
            </button>
          )}



          {searchMatches ? (
            <div
              ref={optionListRef}
              role="listbox"
              aria-label="Sectors"
              className="max-h-[min(330px,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto"
              onKeyDown={handleOptionKeys}
            >
              {searchMatches.length === 0 && (
                <div className="px-3 py-3 text-[13px] italic text-muted-foreground">
                  No sector matches “{typed}”
                </div>
              )}
              {searchMatches.map((m) => (
                <button
                  key={m.sector}
                  type="button"
                  role="option"
                  aria-selected={m.sector === value}
                  data-option-index={searchMatches.indexOf(m)}
                  onClick={() => pick(m.sector)}
                  onMouseMove={() => setActiveIndex(searchMatches.indexOf(m))}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] last:border-b-0 hover:bg-[#F8FAFD]",
                    searchMatches.indexOf(m) === activeIndex && "bg-[#F8FAFD]",
                  )}
                >
                  <span className="truncate">{m.sector}</span>
                  {SECTOR_HINTS[m.sector] && (
                    <span className="truncate text-[11.5px] text-[#9AA3AF]">
                      {SECTOR_HINTS[m.sector]}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-[#9AA3AF]">
                    {m.group}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1.15fr]">
              <div className="max-h-[min(330px,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto border-r border-[#EFF1F4] bg-muted/30">
                {SECTOR_GROUPS.map((g) => (
                  <button
                    key={g.group}
                    type="button"
                    onClick={() => setGroup(g.group)}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[11px] text-left text-[13px] hover:bg-[#F1F5FB]",
                      g.group === activeGroup.group &&
                        "bg-background font-semibold text-[#1D4ED8] shadow-[inset_3px_0_0_#2563EB]",
                    )}
                  >
                    <span className="truncate">{g.group}</span>
                    <span className="ml-auto text-[11px] text-[#9AA3AF]">{g.sectors.length}</span>
                  </button>
                ))}
              </div>
              <div
                ref={optionListRef}
                role="listbox"
                aria-label={`${activeGroup.group} sectors`}
                tabIndex={0}
                onKeyDown={handleOptionKeys}
                className="max-h-[min(330px,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto outline-none"
              >
                {activeGroup.sectors.map((s, index) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={s === value}
                    data-option-index={index}
                    onClick={() => pick(s)}
                    onMouseMove={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] last:border-b-0 hover:bg-[#F8FAFD]",
                      s === value && "bg-[#EFF4FE] font-semibold text-[#1D4ED8]",
                      index === activeIndex && s !== value && "bg-[#F8FAFD]",
                    )}
                  >
                    <span className="truncate">{s}</span>
                    {SECTOR_HINTS[s] && (
                      <span className="truncate text-[11.5px] text-[#9AA3AF]">
                        {SECTOR_HINTS[s]}
                      </span>
                    )}
                    {s === value && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-[#15803D]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {!compact && value && (
        <span className="mt-[10px] inline-flex items-center gap-[7px] rounded-full border border-[#D3E0FB] bg-[#EFF4FE] px-3 py-[5px] text-[12.5px] font-semibold text-[#1D4ED8]">
          {value}
          <button type="button" onClick={() => onChange(null)} aria-label="Remove sector">
            <X className="h-3 w-3 opacity-70" />
          </button>
        </span>
      )}
    </div>
  );
}

function AvailabilityBadgePill({ badge }: { badge: AvailabilityBadge }) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 whitespace-nowrap rounded-full border px-2 py-[2px] text-[10.5px] font-bold",
        badge.kind === "yes" && "border-[#CFE8D8] bg-[#EAF7EE] text-[#15803D]",
        badge.kind === "partial" && "border-[#F6DFB4] bg-[#FEF3E7] text-[#B45309]",
        badge.kind === "no" && "border-[#E5E7EB] bg-[#F3F4F6] text-[#9AA3AF]",
      )}
    >
      {badge.text}
    </span>
  );
}

/**
 * Business model picker. When a sector is given, each option carries a live
 * peer-set availability badge scoped to that sector — including the amber
 * "no sector-wide set" state on "Not set".
 */
export function BusinessModelPicker({
  value,
  onChange,
  sector = null,
  compact = false,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  /** Scopes availability badges. No sector → no badges. */
  sector?: string | null;
  /** Inline 28px trigger, no caution block beneath. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const optionListRef = useRef<HTMLDivElement>(null);
  const selected = BUSINESS_MODELS.find((b) => b.value === value) ?? null;
  const { data: availability } = usePeerAvailability(!!sector);
  const options = [null, ...BUSINESS_MODELS.map((model) => model.value)] as const;

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((option) => option === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    optionListRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const badgeFor = (model: string | null) => modelAvailability(availability, sector, model);
  const notSetBadge = badgeFor(null);

  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };

  const handleOptionKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + options.length) % options.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      pick(options[activeIndex] ?? null);
    }
  };

  return (
    <div className={compact ? "inline-block" : undefined}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label="Choose business model"
            className={cn(
              "items-center gap-2 border text-left focus:outline-none",
              compact
                ? "inline-flex h-7 rounded-[6px] border-[#D3D9E2] bg-white px-[9px] text-[12.5px] font-medium text-[#0F1B33]"
                : "flex h-[42px] w-full rounded-[9px] border-[#D7DBE2] bg-background px-3 text-[13.5px] focus:border-[#2563EB] focus:shadow-[0_0_0_3px_#EFF4FE]",
              compact && !selected && "border-[#E9D4B4] bg-[#FDF9F3] font-normal text-[#B45309]",
            )}
          >
            <span className={cn("truncate", !selected && !compact && "text-muted-foreground")}>
              {selected?.label ?? (compact ? "Not set" : "Choose a business model…")}
            </span>
            {selected && !compact && (
              <span className="truncate text-[11.5px] text-[#9AA3AF]">{selected.hint}</span>
            )}
            <ChevronDown
              className={cn(
                "ml-auto shrink-0 text-muted-foreground",
                compact ? "h-3.5 w-3.5" : "h-4 w-4",
              )}
            />
          </button>
        </PopoverTrigger>


        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            optionListRef.current?.focus();
          }}
          className={cn(
            "overflow-hidden rounded-[10px] border-[#D7DBE2] p-0 shadow-[0_10px_24px_rgba(15,23,42,.10)]",
            compact
              ? "w-[430px] max-w-[calc(100vw-32px)]"
              : "w-[var(--radix-popover-trigger-width)]",
          )}
        >
          <div
            ref={optionListRef}
            role="listbox"
            aria-label="Business models"
            tabIndex={0}
            onKeyDown={handleOptionKeys}
            className="max-h-[min(280px,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto outline-none"
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              data-option-index={0}
              onClick={() => pick(null)}
              onMouseMove={() => setActiveIndex(0)}
              className={cn(
                "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] hover:bg-[#F8FAFD]",
                !value && "bg-[#EFF4FE] font-semibold text-[#1D4ED8]",
                activeIndex === 0 && value && "bg-[#F8FAFD]",
              )}
            >
              <span className="shrink-0">Not set</span>
              {notSetBadge && <AvailabilityBadgePill badge={notSetBadge} />}
            </button>
            {BUSINESS_MODELS.map((b, index) => {
              const badge = badgeFor(b.value);
              return (
                <button
                  key={b.value}
                  type="button"
                  role="option"
                  aria-selected={b.value === value}
                  data-option-index={index + 1}
                  onClick={() => pick(b.value === value ? null : b.value)}
                  onMouseMove={() => setActiveIndex(index + 1)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] last:border-b-0 hover:bg-[#F8FAFD]",
                    b.value === value && "bg-[#EFF4FE] font-semibold text-[#1D4ED8]",
                    activeIndex === index + 1 && b.value !== value && "bg-[#F8FAFD]",
                  )}
                >
                  <span className="shrink-0">{b.label}</span>
                  <span className="truncate text-[11.5px] text-[#9AA3AF]">{b.hint}</span>
                  {badge ? (
                    <AvailabilityBadgePill badge={badge} />
                  ) : (
                    b.value === value && (
                      <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-[#15803D]" />
                    )
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {!compact && sector && (
        <div className="mt-[10px] rounded-[10px] border border-[#F6DFB4] bg-[#FEF3E7] px-[15px] py-[11px] text-[12.5px] text-[#7C4A0B]">
          ⚠ <b className="font-bold">Availability is information, not a recommendation.</b> Pick
          the model that describes the company. If the only set with data does not fit, the right
          fix is to build the set that does — not to re-tag the startup.
        </div>
      )}
    </div>
  );
}

/**
 * Sector and Business model shown together, visually separated from Industry
 * so they read as a related pair.
 */
export function SectorBusinessModelFields({
  sector,
  onSectorChange,
  businessModel,
  onBusinessModelChange,
}: {
  sector: string | null;
  onSectorChange: (v: string | null) => void;
  businessModel: string | null;
  onBusinessModelChange: (v: string | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wanted = new URLSearchParams(window.location.search).get("focus") === "sector";
    if (!wanted) return;
    const t = window.setTimeout(() => {
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 2400);
    }, 250);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      ref={boxRef}
      id="sector-fields"
      className={cn(
        "space-y-4 rounded-lg border border-border bg-muted/20 p-4 transition-shadow",
        highlight && "border-warning ring-2 ring-warning/40",
      )}
    >
      <div className="space-y-1.5">
        <div className="text-[13px] font-medium text-foreground">
          Sector <span className="text-muted-foreground">(optional)</span>
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          SET classification, used for financial benchmarking
        </p>
        <SectorPicker value={sector} onChange={onSectorChange} />
      </div>
      <div className="space-y-1.5">
        <div className="text-[13px] font-medium text-foreground">
          Business model <span className="text-muted-foreground">(optional)</span>
        </div>
        <BusinessModelPicker
          value={businessModel}
          onChange={onBusinessModelChange}
          sector={sector}
        />
      </div>
    </div>
  );
}
