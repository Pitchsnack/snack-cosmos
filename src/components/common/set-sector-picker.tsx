/**
 * The one SET sector picker: groups on the left (chips on phones), the open
 * group's sectors on the right. Seller = one sector (radios); buyer and advisor
 * = up to `max` sectors (tick boxes) with an optional "Sector agnostic" card.
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { SECTOR_GROUPS, sectorGroupOf } from "@/lib/sectors";
import { cn } from "@/lib/utils";
import { tr, useTranslation } from "@/i18n/language";

type Agnostic = {
  on: boolean;
  onToggle: (on: boolean) => void;
  /** One line under "Sector agnostic". */
  line: string;
  /** Amber note shown while ticked (buyer only). */
  note?: string;
  /** Line under the box while ticked. */
  summary: ReactNode;
};

export function SetSectorPicker({
  mode,
  value,
  onChange,
  max = 5,
  limitMsg,
  agnostic,
  error,
}: {
  mode: "single" | "multi";
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  limitMsg?: string;
  agnostic?: Agnostic;
  error?: string | null;
}) {
  useTranslation();
  const [group, setGroup] = useState(() => sectorGroupOf(value[0]) ?? SECTOR_GROUPS[0]!.group);
  const tabsRef = useRef<HTMLDivElement>(null);
  const radiosRef = useRef<HTMLDivElement>(null);
  const open = SECTOR_GROUPS.find((g) => g.group === group) ?? SECTOR_GROUPS[0]!;
  const off = !!agnostic?.on;
  const single = mode === "single";

  const tabKeys = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + SECTOR_GROUPS.length) % SECTOR_GROUPS.length;
    setGroup(SECTOR_GROUPS[n]!.group);
    tabsRef.current?.querySelectorAll<HTMLElement>("[role=tab]")[n]?.focus();
  };
  const radioKeys = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + open.sectors.length) % open.sectors.length;
    onChange([open.sectors[n]!]);
    radiosRef.current?.querySelectorAll<HTMLElement>("[role=radio]")[n]?.focus();
  };
  const toggle = (s: string) => {
    if (value.includes(s)) return onChange(value.filter((x) => x !== s));
    if (value.length >= max) { toast.error(limitMsg ?? `${tr("Pick up to")} ${max}.`); return; }
    onChange([...value, s]);
  };
  const countIn = (sectors: string[]) => value.filter((v) => sectors.includes(v)).length;
  const navy = "bg-[#1E2A4A] dark:bg-[#4A5CA6]";
  const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E2A4A]/40 dark:focus-visible:ring-[#4A5CA6]/60";

  return (
    <div>
      {agnostic && (
        <>
          <button type="button" role="checkbox" aria-checked={off} onClick={() => agnostic.onToggle(!off)}
            className={cn("flex w-full items-center gap-3 rounded-[10px] border px-[14px] py-3 text-left", ring,
              off ? "border-[#1E2A4A] bg-[#F4F6FA] shadow-[inset_0_0_0_1px_#1E2A4A] dark:border-[#4A5CA6] dark:bg-[#1B2238] dark:shadow-[inset_0_0_0_1px_#4A5CA6]"
                : "border-[#DCDFE5] bg-white dark:border-[#2A3044] dark:bg-[#161B2B]")}>
            <span className={cn("grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] text-white",
              off ? cn("border-transparent", navy) : "border-[#C3C8D2] dark:border-[#3A4158]")}>{off && <Check className="h-3 w-3" strokeWidth={3} />}</span>
            <span>
              <b className="block text-[14.5px] font-semibold text-[#151A28] dark:text-foreground">{tr("Sector agnostic")}</b>
              <span className="text-[12.5px] text-[#6B7280] dark:text-muted-foreground">{agnostic.line}</span>
            </span>
          </button>
          {off && agnostic.note && (
            <p className="mt-2.5 flex items-start gap-2 rounded-[10px] border border-[#F3D9A6] bg-[#FFF4E0] px-3.5 py-2.5 text-[13px] text-[#8A5A06]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />{agnostic.note}
            </p>
          )}
        </>
      )}

      <div aria-disabled={off}
        className={cn("overflow-hidden rounded-[12px] border border-[#DCDFE5] bg-white dark:border-[#2A3044] dark:bg-[#161B2B]",
          "flex flex-col sm:grid sm:h-[344px] sm:grid-cols-[232px_1fr]", agnostic && "mt-3", off && "pointer-events-none opacity-45")}>
        <div ref={tabsRef} role="tablist" aria-orientation="vertical" aria-label="SET industry groups"
          className="flex gap-1.5 overflow-x-auto border-b border-[#E9EBF0] bg-[#FBFBFD] p-1.5 sm:block sm:overflow-y-auto sm:border-b-0 sm:border-r dark:border-[#242A3E] dark:bg-[#1A2033]">
          {SECTOR_GROUPS.map((g, i) => {
            const on = g.group === open.group;
            const n = countIn(g.sectors);
            return (
              <button key={g.group} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
                onClick={() => setGroup(g.group)} onKeyDown={(e) => tabKeys(e, i)}
                className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] p-2.5 text-left text-[13.5px] sm:w-full", ring,
                  "max-sm:rounded-full max-sm:border max-sm:border-[#DCDFE5] max-sm:px-3 max-sm:py-1.5 dark:max-sm:border-[#2A3044]",
                  on ? "bg-white font-semibold text-[#151A28] shadow-[0_1px_3px_rgba(16,24,40,.08)] max-sm:border-[#1E2A4A] dark:bg-[#161B2B] dark:text-foreground dark:max-sm:border-[#4A5CA6]"
                    : "font-medium text-[#434A5C] hover:bg-white dark:text-muted-foreground dark:hover:bg-[#161B2B]")}>
                <span className="truncate">{tr(g.group)}</span>
                {n > 0 ? (
                  single
                    ? <span className={cn("ml-auto grid h-5 w-5 flex-none place-items-center rounded-full text-white", navy)}><Check className="h-3 w-3" strokeWidth={3} /></span>
                    : <span className={cn("ml-auto grid h-5 min-w-5 flex-none place-items-center rounded-full px-1.5 text-[11px] font-bold text-white", navy)}>{n}</span>
                ) : <span className="ml-auto text-[12px] font-normal text-[#9CA3AF]">{g.sectors.length}</span>}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" aria-label={open.group} className="max-h-[300px] overflow-y-auto p-2 sm:max-h-none">
          <div className="px-2 pb-2 pt-1.5 text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]">{tr(open.group)}</div>
          <div ref={radiosRef} role={single ? "radiogroup" : "group"} aria-label={`${open.group} sectors`}>
            {open.sectors.map((s, i) => {
              const on = value.includes(s);
              const focusIdx = Math.max(0, open.sectors.findIndex((x) => value.includes(x)));
              return single ? (
                <button key={s} type="button" role="radio" aria-checked={on} tabIndex={i === focusIdx ? 0 : -1}
                  onClick={() => onChange([s])} onKeyDown={(e) => radioKeys(e, i)}
                  className={cn("flex w-full items-center gap-3 rounded-[8px] px-2 py-2.5 text-left text-[14px] text-[#151A28] dark:text-foreground", ring,
                    on ? "bg-[#F4F6FA] font-semibold dark:bg-[#1B2238]" : "hover:bg-[#F6F7F9] dark:hover:bg-[#1B2238]/60")}>
                  <span className={cn("h-5 w-5 flex-none rounded-full border-[1.5px]",
                    on ? "border-[6px] border-[#1E2A4A] dark:border-[#4A5CA6]" : "border-[#C3C8D2] dark:border-[#3A4158]")} />
                  {tr(s)}
                </button>
              ) : (
                <label key={s} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-[8px] px-2 py-2.5 text-[14px] text-[#151A28] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#1E2A4A]/40 dark:text-foreground",
                  on ? "bg-[#F4F6FA] font-semibold dark:bg-[#1B2238]" : "hover:bg-[#F6F7F9] dark:hover:bg-[#1B2238]/60")}>
                  <input type="checkbox" className="sr-only" checked={on} disabled={off} onChange={() => toggle(s)} />
                  <span className={cn("grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] text-white",
                    on ? cn("border-transparent", navy) : "border-[#C3C8D2] dark:border-[#3A4158]")}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                  {tr(s)}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[12.5px] text-[#6B7280] dark:text-muted-foreground">
        {single ? (
          value[0] ? (
            <span className="flex flex-wrap items-center gap-2">{tr("Your sector:")}
              <span className="rounded-[20px] border border-[#1E2A4A] bg-[#F4F6FA] px-3 py-1 font-semibold text-[#151A28] dark:border-[#4A5CA6] dark:bg-[#1B2238] dark:text-foreground">
                {tr(value[0])}{sectorGroupOf(value[0]) && <span className="font-normal text-[#6B7280]"> · {tr(sectorGroupOf(value[0])!)}</span>}
              </span>
            </span>
          ) : tr("Pick the sector your main business is in.")
        ) : off ? (
          <span>{agnostic!.summary}</span>
        ) : value.length === 0 ? tr("None selected yet") : (
          <span className="flex flex-wrap items-center gap-1.5">
            <span>{tr("Selected")} <b className="text-[#151A28] dark:text-foreground">{value.length}</b> {tr("of")} {max}</span>
            {value.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-[20px] border border-[#1E2A4A] bg-[#F4F6FA] px-3 py-1 font-semibold text-[#151A28] dark:border-[#4A5CA6] dark:bg-[#1B2238] dark:text-foreground">
                {tr(s)}<button type="button" aria-label={`Remove ${s}`} onClick={() => onChange(value.filter((x) => x !== s))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </span>
        )}
      </div>
      {error && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#B42318]"><AlertCircle className="h-[15px] w-[15px]" />{error}</p>}
    </div>
  );
}
