/**
 * Sector + Business model — the financial-benchmarking pair.
 *
 * Sector uses a two-pane picker (groups left with counts, sectors right) with
 * a search field above both panes that matches across every sector and shows
 * the group of each match. Both fields are optional and never block a save.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  BUSINESS_MODELS,
  SECTOR_GROUPS,
  SECTOR_HINTS,
  sectorGroupOf,
} from "@/lib/sectors";
import { cn } from "@/lib/utils";

function norm(s: string) {
  return s.toLowerCase().replace(/[\s\-—–._&/]/g, "");
}

export function SectorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>(
    () => sectorGroupOf(value) ?? SECTOR_GROUPS[0]!.group,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
    setQuery("");
    setGroup(sectorGroupOf(s) ?? group);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[42px] w-full items-center gap-2 rounded-[9px] border border-[#D7DBE2] bg-background px-3 text-left text-[13.5px] focus:border-[#2563EB] focus:outline-none focus:shadow-[0_0_0_3px_#EFF4FE]"
      >
        <Search className="h-[15px] w-[15px] shrink-0 text-[#9AA3AF]" />
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ?? "Search or pick a sector…"}
        </span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-[6px] w-full overflow-hidden rounded-[10px] border border-[#D7DBE2] bg-background shadow-[0_10px_24px_rgba(15,23,42,.10)]">
          <div className="flex items-center gap-2 border-b border-[#EFF1F4] px-3 py-2">
            <Search className="h-[14px] w-[14px] text-[#9AA3AF]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="Search sectors…"
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-[#9AA3AF]"
            />
          </div>

          {searchMatches ? (
            <div className="max-h-[330px] overflow-y-auto">
              {searchMatches.length === 0 && (
                <div className="px-3 py-3 text-[13px] italic text-muted-foreground">
                  No sector matches “{typed}”
                </div>
              )}
              {searchMatches.map((m) => (
                <button
                  key={m.sector}
                  type="button"
                  onClick={() => pick(m.sector)}
                  className="flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] last:border-b-0 hover:bg-[#F8FAFD]"
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
              <div className="max-h-[330px] overflow-y-auto border-r border-[#EFF1F4] bg-muted/30">
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
              <div className="max-h-[330px] overflow-y-auto">
                {activeGroup.sectors.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pick(s)}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] last:border-b-0 hover:bg-[#F8FAFD]",
                      s === value && "bg-[#EFF4FE] font-semibold text-[#1D4ED8]",
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
        </div>
      )}

      {value && (
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
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  /** Scopes availability badges. No sector → no badges. */
  sector?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = BUSINESS_MODELS.find((b) => b.value === value) ?? null;
  const { data: availability } = usePeerAvailability(!!sector);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const badgeFor = (model: string | null) => modelAvailability(availability, sector, model);
  const notSetBadge = badgeFor(null);

  return (
    <div>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-[42px] w-full items-center gap-2 rounded-[9px] border border-[#D7DBE2] bg-background px-3 text-left text-[13.5px] focus:border-[#2563EB] focus:outline-none focus:shadow-[0_0_0_3px_#EFF4FE]"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? "Choose a business model…"}
          </span>
          {selected && (
            <span className="truncate text-[11.5px] text-[#9AA3AF]">{selected.hint}</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute z-50 mt-[6px] w-full overflow-hidden rounded-[10px] border border-[#D7DBE2] bg-background shadow-[0_10px_24px_rgba(15,23,42,.10)]">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] hover:bg-[#F8FAFD]",
                !value && "bg-[#EFF4FE] font-semibold text-[#1D4ED8]",
              )}
            >
              <span className="shrink-0">Not set</span>
              {notSetBadge && <AvailabilityBadgePill badge={notSetBadge} />}
            </button>
            {BUSINESS_MODELS.map((b) => {
              const badge = badgeFor(b.value);
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => {
                    onChange(b.value === value ? null : b.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-[#EFF1F4] px-3 py-[9px] text-left text-[13px] last:border-b-0 hover:bg-[#F8FAFD]",
                    b.value === value && "bg-[#EFF4FE] font-semibold text-[#1D4ED8]",
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
        )}
      </div>

      {sector && (
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
        <BusinessModelPicker value={businessModel} onChange={onBusinessModelChange} />
      </div>
    </div>
  );
}
