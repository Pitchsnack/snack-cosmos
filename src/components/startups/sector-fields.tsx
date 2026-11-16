/**
 * SET sector + Business model — the financial-benchmarking pair.
 * Every seller sector editor reuses the shared two-pane SetSectorPicker.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BUSINESS_MODELS } from "@/lib/sectors";
import { cn } from "@/lib/utils";
import { usePeerAvailability } from "@/hooks/use-peer-availability";
import { modelAvailability, type AvailabilityBadge } from "@/lib/peer-comparables";
import { useTr } from "@/components/common/edit-info-popup";
import { useTextLang } from "@/components/common/text-lang";
import { businessModelLabel } from "@/i18n/th-edit-info";
import { sectorMissing } from "@/lib/seller-sector";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { setupText } from "@/i18n/language";

/** Compact financial-matching trigger; the editor itself is the same shared two-pane picker. */
export function SectorPickerPopover({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const tr = useTr();
  const { lang } = useTextLang();
  const label = value ? (lang === "th" ? setupText(value) : value) : tr("Choose sector", "เลือกกลุ่มอุตสาหกรรม");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-label={tr("Choose sector", "เลือกกลุ่มอุตสาหกรรม")}
          className={cn(
            "inline-flex h-7 max-w-[240px] items-center gap-2 rounded-[6px] border px-[9px] text-left text-[12.5px] font-medium text-[#0F1B33] focus:outline-none",
            value ? "border-[#D3D9E2] bg-white" : "border-[#E9D4B4] bg-[#FDF9F3] font-normal text-[#B45309]",
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className="w-[min(680px,calc(100vw-2rem))] rounded-[12px] border-[#D7DBE2] p-3 shadow-[0_10px_24px_rgba(15,23,42,.10)]"
      >
        <SetSectorPicker
          mode="single"
          value={value ? [value] : []}
          onChange={(next) => {
            onChange(next[0] ?? null);
            setOpen(false);
          }}
          singleSummary={{ selectedLabel: "Selected:", emptyLabel: "No sector picked yet", includeGroup: false }}
        />
      </PopoverContent>
    </Popover>
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
  const { lang } = useTextLang();
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
              {selected ? businessModelLabel(selected.label, lang) : (compact ? "Not set" : lang === "th" ? "เลือกรูปแบบธุรกิจ…" : "Choose a business model…")}
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
                  <span className="shrink-0">{businessModelLabel(b.label, lang)}</span>
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

    </div>
  );
}

/** SET sector and optional Business model shown as a related pair. */
export function SectorBusinessModelFields({
  sector,
  onSectorChange,
  businessModel,
  onBusinessModelChange,
  required = false,
}: {
  sector: string | null;
  onSectorChange: (v: string | null) => void;
  businessModel: string | null;
  onBusinessModelChange: (v: string | null) => void;
  /** Shows the bilingual missing warning without blocking Save or Create. */
  required?: boolean;
}) {
  const tr = useTr();
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
        <div className={cn("text-[13px] font-medium", required && sectorMissing(sector) ? "text-destructive" : "text-foreground")}>
          {tr("Industry group", "กลุ่มอุตสาหกรรม")}
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          {tr("SET classification, used for financial benchmarking", "การจัดกลุ่มของ SET ใช้เทียบเคียงตัวเลขทางการเงิน")}
        </p>
        <SetSectorPicker
          mode="single"
          value={sector ? [sector] : []}
          onChange={(next) => onSectorChange(next[0] ?? null)}
          singleSummary={{
            selectedLabel: "Selected:",
            emptyLabel: "No sector picked yet",
            required,
            includeGroup: false,
          }}
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-[13px] font-medium text-foreground">
          {tr("Business model", "รูปแบบธุรกิจ")} <span className="text-muted-foreground">{tr("(optional)", "(ไม่บังคับ)")}</span>
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
