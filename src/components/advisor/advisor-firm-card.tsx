import { useState } from "react";
import { BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { StatusPill } from "@/components/marketplace/buyer-browse-card";
import { dealSizeLabels, initials, reviewStats, serviceOf, type AdvisorFirm } from "@/lib/advisor-firm";
import { cn } from "@/lib/utils";

/** Advisor firm card: the investor public card's layout with firm content. */

export function FirmLogo({ f, size = 52, radius = 13, ring = true }: { f: Pick<AdvisorFirm, "name" | "logoUrl">; size?: number; radius?: number; ring?: boolean }) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center overflow-hidden bg-[#0F766E] font-bold text-white", ring && "shadow-[0_0_0_3px_#fff,0_4px_12px_rgba(15,118,110,.25)]")}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.33) }}
    >
      {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full bg-white object-cover" /> : initials(f.name)}
    </div>
  );
}

export function VerifiedAdvisorChip({ small }: { small?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 font-semibold text-[#15803D]", small ? "h-5 text-[11px]" : "h-[22px] text-[11px]")}>
      <BadgeCheck className="h-3 w-3" /> Verified advisor
    </span>
  );
}

export function Stars({ value, size = 14, gap = 2 }: { value: number; size?: number; gap?: number }) {
  return (
    <span className="inline-flex" style={{ gap }} aria-label={`${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i)) * 100;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <StarSvg className="absolute inset-0 text-[#E3E6EB]" size={size} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
              <StarSvg className="text-[#F59E0B]" size={size} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
function StarSvg({ className, size }: { className?: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

export function ServiceChip({ name }: { name: string }) {
  const I = serviceOf(name).icon;
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-[#B9E6DF] bg-[#F0FAF8] px-[9px] text-[12px] font-semibold text-[#0F5E57]">
      <I className="h-[13px] w-[13px]" /> {name}
    </span>
  );
}

function Cover({ f, wide }: { f: AdvisorFirm; wide?: boolean }) {
  return (
    <div className="relative grid place-items-center overflow-hidden bg-[#E0F5F2]" style={{ height: wide ? 126 : 116 }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full text-[#0F766E] opacity-35" viewBox="0 0 320 120" preserveAspectRatio="none">
        <circle cx="40" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="280" cy="10" r="70" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="relative"><FirmLogo f={f} /></div>
      {f.verifiedAt && <div className="absolute left-3 top-3"><VerifiedAdvisorChip /></div>}
      <div className="absolute right-3 top-3"><StatusPill status={f.status} /></div>
    </div>
  );
}

function Fig({ label, main, sub }: { label: string; main: string; sub: string | null }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</div>
      <div className="mt-0.5 text-[15px] font-bold text-[#111827]">{main}</div>
      {sub && <div className="text-[12px] text-[#6B7280]">{sub}</div>}
    </div>
  );
}

function MoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="w-[84px] shrink-0 text-[#6B7280]">{label}</span>
      <span className="min-w-0 flex-1 font-medium text-[#111827]">{value}</span>
    </div>
  );
}

export function FirmCard({ f, wide, selected, onClick, className }: { f: AdvisorFirm; wide?: boolean; selected?: boolean; onClick?: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const deal = dealSizeLabels(f);
  const { n, avg } = reviewStats(f.reviews);
  const showMore = wide || open;
  return (
    <div
      onClick={onClick}
      className={cn(
        "group overflow-hidden rounded-[14px] border bg-card text-left transition-all",
        selected ? "border-[#F6A823] shadow-[0_0_0_1px_#F6A823]" : "border-border",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-[#F6A823]",
        className,
      )}
    >
      <Cover f={f} wide={wide} />
      <div className="space-y-2.5 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-[17px] font-semibold leading-snug text-[#111827] group-hover:text-[#ea580c] dark:text-foreground">{f.name}</h3>
            <span className="shrink-0 whitespace-nowrap pt-0.5 text-[13px] text-[#6B7280]">
              {f.refNo}{f.city && <> · <span className="font-medium text-[#4B5563]">{f.city}</span></>}
            </span>
          </div>
          <div className="mt-[3px] text-[13px] text-[#6B7280]">{f.firmType}{f.yearFounded ? ` · since ${f.yearFounded}` : ""}</div>
          {n > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px]">
              <Stars value={avg} />
              <span className="font-bold text-[#151A28] dark:text-foreground">{avg.toFixed(1)}</span>
              <span className="text-[#6A7181]">({n} review{n === 1 ? "" : "s"})</span>
            </div>
          )}
        </div>
        {f.description && <p className={cn("text-[13.5px] leading-[1.5] text-[#374151] dark:text-foreground/80", !showMore && "line-clamp-3")}>{f.description}</p>}
        {f.services.length > 0 && <div className="flex flex-wrap gap-1.5">{f.services.map((s) => <ServiceChip key={s} name={s} />)}</div>}
        <div className="grid grid-cols-2 divide-x divide-border rounded-[10px] border border-border bg-muted/30">
          <Fig label="Typical deal size" main={deal?.usd ?? "Not set"} sub={deal ? `(${deal.thb})` : null} />
          <Fig label="Team size" main={f.teamSize ? String(f.teamSize) : "Not set"} sub={f.teamSize ? "people" : null} />
        </div>
        {showMore && (
          <div className="space-y-1.5">
            <MoreRow label="Languages" value={f.languages.join(" · ") || "Not set"} />
            <MoreRow label="Sectors" value={f.sectors.join(" · ") || "Not set"} />
          </div>
        )}
      </div>
      {!wide && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          {open ? <>Show less <ChevronUp className="h-4 w-4" /></> : <>Show more <ChevronDown className="h-4 w-4" /></>}
        </button>
      )}
    </div>
  );
}
