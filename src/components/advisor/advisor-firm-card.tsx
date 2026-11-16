import { setupText } from "@/i18n/language";
import { ManagedBadge } from "@/components/common/managed-badge";
import { sectorChips } from "@/lib/business-types";
import type React from "react";
import { BadgeCheck, Building2 } from "lucide-react";
import { StandardBrowseCard } from "@/components/marketplace/standard-browse-card";
import { StatusPill } from "@/components/marketplace/buyer-browse-card";
import { dealBandLabels, initials, reviewStats, serviceOf, type AdvisorFirm } from "@/lib/advisor-firm";
import { cn } from "@/lib/utils";
import { LAST_LOGIN_LABEL, type LastLoginStep } from "@/lib/last-login";
import { tr } from "@/i18n/language";

/** Advisor firm card: the investor public card's layout with firm content. */

export function FirmLogo({ f, size = 52, radius = 13, ring = true }: { f: Pick<AdvisorFirm, "name" | "logoUrl">; size?: number; radius?: number; ring?: boolean }) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center overflow-hidden bg-[#0F766E] font-bold text-white", ring && "shadow-[0_0_0_3px_#fff,0_4px_12px_rgba(15,118,110,.25)]")}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.33) }}
    >
      {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full border border-[#E3E6EB] bg-white object-contain" style={{ borderRadius: radius }} />
        : f.name.trim() ? initials(f.name) : <Building2 style={{ width: size * 0.45, height: size * 0.45 }} />}
    </div>
  );
}

export function VerifiedAdvisorChip({ small }: { small?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-[9px] font-semibold text-[#15803D] shadow-[0_1px_2px_rgba(16,24,40,.14)]", small ? "h-5 text-[11px]" : "h-6 text-[12px]")}>
      <BadgeCheck className="h-[13px] w-[13px]" />{setupText("Verified advisor")}
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
      <I className="h-[13px] w-[13px]" /> {tr(name)}
    </span>
  );
}

/** 116px cover: the logo whole (up to 96 × 240px), its bottom on the cover line; the badges sit on top where they meet. */
export function FirmCover({ f, noStatus }: { f: Pick<AdvisorFirm, "name" | "logoUrl" | "refNo" | "city" | "verifiedAt" | "managed" | "status">; noStatus?: boolean }) {
  const pills = (
    <div className="advisor-cover-top">
      <div className="shrink-0">{f.verifiedAt && <VerifiedAdvisorChip />}</div>
      <div className="advisor-cover-right">
        {f.managed && <ManagedBadge size="sm" hatOnly shadow className="advisor-cover-hat" />}
        <span className="advisor-cover-ref" title={[f.refNo, f.city].filter(Boolean).join(" · ")}>
          <span className="shrink-0">{f.refNo}</span>
          {f.city && <><span className="shrink-0"> · </span><span className="min-w-0 truncate">{f.city}</span></>}
        </span>
      </div>
      {!noStatus && <div className="absolute right-0 top-8"><StatusPill status={f.status} /></div>}
    </div>
  );
  if (f.logoUrl) {
    return (
      <div className="relative flex items-end justify-center border-b border-[#EEF0F3] bg-white px-5" style={{ height: 116 }}>
        <img src={f.logoUrl} alt="" className="block object-contain" style={{ maxHeight: 96, maxWidth: "min(240px, 100%)" }} />
        {pills}
      </div>
    );
  }
  return (
    <div className="relative grid place-items-center overflow-hidden bg-[#E0F5F2]" style={{ height: 116 }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full text-[#0F766E] opacity-35" viewBox="0 0 320 120" preserveAspectRatio="none">
        <circle cx="40" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="280" cy="10" r="70" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="relative"><FirmLogo f={f} /></div>
      {pills}
    </div>
  );
}

function MoreRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="w-[84px] shrink-0 text-[#6B7280]">{label}</span>
      <span className="min-w-0 flex-1 font-medium text-[#111827] dark:text-foreground">{value}</span>
    </div>
  );
}

/** "{first two} +{n}" on one line; the full list in the tooltip. */
function TwoPlus({ items }: { items: string[] }) {
  return (
    <span className="standard-card-value-row" title={items.join(" · ")}>
      <span className="standard-card-value">{items.slice(0, 2).join(" · ")}</span>
      {items.length > 2 && <span className="standard-card-plus">+{items.length - 2}</span>}
    </span>
  );
}
const empty = (text: string) => <span className="standard-card-value standard-card-empty">{text}</span>;

/** The advisor firm card, built on the shared seller/buyer card: 116px cover, fixed text block, figures box and footer. */
export function FirmCard({ f, wide, preview, selected, onClick, className, action, accent = "#F6A823", noStatus, lastLogin, cover }: {
  f: AdvisorFirm; wide?: boolean; preview?: boolean; selected?: boolean; onClick?: () => void; className?: string;
  /** Send enquiry (or the status chip), shown full width inside Show more after Sectors. */
  action?: React.ReactNode; accent?: string; noStatus?: boolean;
  /** Owner's last-login bucket on the left of Show more (Browse advisors only; previews/Admin omit it). */
  lastLogin?: LastLoginStep | null;
  /** Replaces the cover (Admin's directory cover with its bookmark). */
  cover?: React.ReactNode;
}) {
  const deal = dealBandLabels(f.dealBand);
  const { n, avg } = reviewStats(f.reviews);
  const services = f.services.map(tr).filter(Boolean);
  const langs = f.languages.map(tr).filter(Boolean);
  const line = [tr(f.firmType ?? ""), f.yearFounded ? `${tr("since")} ${f.yearFounded}` : ""].filter(Boolean).join(" · ");
  const stars = n > 0 ? `★ ${avg.toFixed(1)} (${n})` : "☆ 0 (0)";
  const sectors = f.sectorAgnostic ? [tr("Sector agnostic")] : sectorChips(f.sectors, f.sectorPicks);
  const more = (
    <div className="space-y-2.5">
      {services.length > 0 && <div className="flex flex-wrap gap-1.5">{f.services.map((s) => <ServiceChip key={s} name={s} />)}</div>}
      <MoreRow label={tr("Typical deal size")} value={deal ? `${deal.usd} (${deal.thb})` : <span className="text-[#9CA3AF]">{tr("Not added")}</span>} />
      {sectors.length > 0 && <MoreRow label={tr("Sectors")} value={<span className="flex flex-wrap gap-1">{sectors.map((s) => <span key={s} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[12px]">{s}</span>)}</span>} />}
      {action && !preview && <div className="flex justify-center pt-0.5 [&_button]:w-full [&_button]:justify-center">{action}</div>}
    </div>
  );
  const name = f.name.trim() || tr("New firm profile");
  return (
    <StandardBrowseCard
      title={name} refNo={f.refNo} place={f.city} hideRef hideStatus
      subtitle={[line, stars].filter(Boolean).join(" · ")}
      subtitleContent={<>{line}{line && " · "}{n > 0
        ? <><span className="standard-card-star">★ {avg.toFixed(1)}</span> ({n})</>
        : <><span className="standard-card-star">☆</span> <span className="standard-card-star-zero">0 (0)</span></>}</>}
      description={f.description?.trim() || tr("No description yet.")}
      cover={(children) => <div className="standard-advisor-cover">{cover ?? <FirmCover f={f} noStatus={noStatus} />}{children}</div>}
      figures={[
        { label: tr("Typical deal size"), value: deal?.usd ?? null, node: deal ? undefined : empty(tr("Not added")) },
        { label: tr("Team size"), value: f.teamSize ? `${f.teamSize} ${tr("people")}` : null, node: f.teamSize ? undefined : empty(tr("Not added")) },
      ]}
      fit={{ label: tr("Services"), value: services.length ? services.join(" · ") : null, node: services.length ? <TwoPlus items={services} /> : empty("0") }}
      textRow={{ label: tr("Languages"), value: langs.length ? langs.join(" · ") : null, node: langs.length ? <TwoPlus items={langs} /> : <span className="standard-card-empty">{tr("Not added")}</span> }}
      lastLogin={lastLogin ?? null}
      lastLoginTooltip={lastLogin ? `${tr(LAST_LOGIN_LABEL[lastLogin])} — ${tr("When the advisor last logged in to PitchSnack")}` : undefined}
      more={more} defaultExpanded={wide} selected={selected} onOpen={onClick}
      sourceType="advisor"
      style={selected ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}
      className={cn("standard-advisor-card", noStatus && "advisor-browse-card", className)}
    />
  );
}
