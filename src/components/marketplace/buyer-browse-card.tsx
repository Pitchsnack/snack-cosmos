import { useState } from "react";
import { BadgeCheck, Briefcase, Building2, ChevronDown, EyeOff, Landmark, Lock, Rocket, Sprout, User, Users } from "lucide-react";
import { isCorporateBuyer } from "@/lib/investor-browse";
import { INDIVIDUAL_TYPE, bandOf, typeName } from "@/lib/investor-bands";
import { typeTone, type PublicBuyer } from "@/lib/buyer-profile";
import { cn } from "@/lib/utils";
import { useInvestorTypeImage } from "@/hooks/use-investor-type-image";

export function TypeIcon({ type, className }: { type: string | null; className?: string }) {
  const t = (type ?? "").toLowerCase();
  const I = t.includes("individual") ? User : t.includes("family") ? Users : t.includes("private equity") ? Landmark : t.includes("venture") || t.includes("vc") ? Rocket
    : t.includes("incubat") || t.includes("accelerat") ? Sprout : t.includes("corporate") ? Building2 : Briefcase;
  return <I className={className} />;
}

/** Investor cover: Admin's investor-type image, else a drawn cover — never a logo. */
export function BuyerCover({ type, className, children }: { type: string | null; className?: string; children?: React.ReactNode }) {
  const tone = typeTone(type);
  const img = useInvestorTypeImage(type);
  if (img) {
    return (
      <div className={cn("relative overflow-hidden", tone.bg, className)}>
        <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        {children}
      </div>
    );
  }
  return (
    <div className={cn("relative grid place-items-center overflow-hidden", tone.bg, className)}>
      <svg aria-hidden className={cn("absolute inset-0 h-full w-full opacity-30", tone.fg)} viewBox="0 0 320 120" preserveAspectRatio="none">
        <circle cx="40" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="280" cy="10" r="70" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M0 90 Q80 60 160 80 T320 60" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className={cn("relative grid h-12 w-12 place-items-center rounded-[12px] bg-card shadow-sm", tone.fg)}>
        <TypeIcon type={type} className="h-6 w-6" />
      </div>
      {children}
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "amber" | "grey" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
      tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
      tone === "amber" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
      tone === "grey" && "border-border bg-muted text-muted-foreground")}>{children}</span>
  );
}

export type CardInvestor = {
  refNo: string; codeName: string; name: string | null; type: string | null;
  city: string | null; country: string | null; description: string | null;
  sectors: string[]; stages: string[]; dealTypes: string[]; geography: string | null;
  verified: boolean; proofOfFunds: boolean;
  ticketLabel: string | null; aumLabel: string | null;
  revLabel: string | null;
  aumBand?: string | null; ticketBand?: string | null; revBand?: string | null; dealBand?: string | null;
  relation?: "individual" | "corporate" | "agent" | null;
};

export type ListingStatus = "live" | "draft" | "paused";
const STATUS_STYLE: Record<ListingStatus, string> = {
  live: "bg-[#E8F6EE] text-[#166534] dark:bg-emerald-950/60 dark:text-emerald-300",
  draft: "bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950/60 dark:text-amber-300",
  paused: "bg-[#F1F2F5] text-[#4B5563] dark:bg-muted dark:text-muted-foreground",
};
export function StatusPill({ status, children }: { status: ListingStatus; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-[9px] text-[11.5px] font-bold", STATUS_STYLE[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children ?? (status === "live" ? "Live" : status === "draft" ? "Draft" : "Paused")}
    </span>
  );
}

const nbspDash = (s: string) => s.replace(/ – /g, "\u00A0– ");

function Figure({ label, band, empty, shade, wideSpan }: { label: string; band: string | null | undefined; empty: string; shade?: boolean; wideSpan?: boolean }) {
  const b = bandOf(band);
  const on = shade && !!b;
  return (
    <div className={cn("min-w-0 px-[11px] pb-[9px] pt-[10px]", on ? "bg-[#FFF4E0] dark:bg-amber-950/40" : "bg-[#FAFBFC] dark:bg-muted/40", wideSpan && "col-span-2 @[560px]:col-span-1")}>
      <dt className={cn("truncate text-[11.5px]", on ? "text-[#8A5A06] dark:text-amber-300" : "text-[#6B7280] dark:text-muted-foreground")}>{label}</dt>
      {b ? (
        <dd>
          <div className="text-[13.5px] font-bold tabular-nums text-[#151A28] dark:text-foreground">{nbspDash(b.label)}</div>
          <div className={cn("text-[11.5px]", on ? "text-[#8A5A06] dark:text-amber-300" : "text-[#6B7280] dark:text-muted-foreground")}>({nbspDash(b.baht)})</div>
        </dd>
      ) : (
        <dd className="text-[13.5px] font-medium text-[#9CA3AF]">{empty}</dd>
      )}
    </div>
  );
}

/** Ticket size · Avg deal size · Min. target revenue · AUM · Geography. Wide (≥560px) puts the values in one row. */
export function KeyFigures({ i, empty }: { i: CardInvestor; empty: string }) {
  const individual = (i.type ?? "") === INDIVIDUAL_TYPE || i.relation === "individual" || i.relation === "agent";
  const corp = isCorporateBuyer(i.type);
  const places = (i.geography ?? "").split(/\s*[,·]\s*/).filter(Boolean);
  return (
    <dl className="overflow-hidden rounded-[12px] border border-[#E9EBF0] dark:border-border">
      <div className={cn("grid grid-cols-2 gap-px bg-[#EEF0F3] dark:bg-border", individual ? "@[560px]:grid-cols-3" : "@[560px]:grid-cols-4")}>
        <Figure label="Ticket size" band={i.ticketBand} empty={empty} />
        <Figure label="Avg deal size" band={i.dealBand} empty={empty} />
        <Figure label="Min. target revenue" band={i.revBand} empty={empty} shade wideSpan={individual} />
        {!individual && <Figure label={corp ? "Group revenue" : "AUM"} band={i.aumBand} empty={empty} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 border-t border-[#EEF0F3] bg-[#FAFBFC] px-[11px] pb-[10px] pt-[9px] dark:border-border dark:bg-muted/40">
        <dt className="text-[11.5px] text-[#6B7280] dark:text-muted-foreground">Geography</dt>
        <dd className={cn("text-[12.5px]", places.length ? "font-semibold text-[#434A5C] dark:text-foreground" : "font-medium text-[#9CA3AF]")}>{places.length ? places.join(" · ") : empty}</dd>
      </div>
    </dl>
  );
}

/** The one public investor card sellers see in Browse investors. Only public fields reach it. */
export function PublicInvestorCard({ i, className, onClick, selected, expanded, onToggleExpand, topRight, empty = "Not stated", status, footerRight, cardFooter }: {
  i: CardInvestor; className?: string; onClick?: () => void; selected?: boolean;
  expanded?: boolean; onToggleExpand?: () => void; topRight?: React.ReactNode;
  /** "Not stated" for sellers, "Not added" on the buyer's own My Company. */
  empty?: string; status?: ListingStatus; footerRight?: React.ReactNode;
  /** Replace the default footer (e.g. the seller-style "Live since" footer). */
  cardFooter?: React.ReactNode;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  const toggle = onToggleExpand ?? (() => setLocalOpen((o) => !o));
  const title = typeName(i.type);
  const facts = [[i.city, i.country].filter(Boolean).join(", "), i.stages.join(", "), i.dealTypes.join(", ")].filter(Boolean).join(" · ");
  const desc = i.description || (empty === "Not added" ? "Not added" : null);
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onClick(); } : undefined}
      className={cn("@container overflow-hidden rounded-[14px] border bg-card", selected ? "border-accent ring-1 ring-accent/40" : "border-border", onClick && "cursor-pointer transition-shadow hover:shadow-md", className)}
    >
      <BuyerCover type={i.type} className="h-[110px]">
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
          <EyeOff className="h-3 w-3" />Name hidden
        </span>
        {(topRight || status) && <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">{status && <StatusPill status={status} />}{topRight}</div>}
      </BuyerCover>
      <div className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="text-[16px] font-bold leading-snug text-[#151A28] dark:text-foreground">{title}</div>
          <div className="whitespace-nowrap text-[12.5px] tabular-nums text-[#6B7280] dark:text-muted-foreground">{[i.refNo, i.country].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {i.verified && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Verified investor</Pill>}
          {i.proofOfFunds && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Proof of funds</Pill>}
          <Pill tone="amber"><Lock className="h-3 w-3" />Name after NDA</Pill>
        </div>
        <div className="mt-3"><KeyFigures i={i} empty={empty} /></div>
        {desc && <p className={cn("mt-3 text-[12.5px] text-muted-foreground", !open && "line-clamp-2")}>{desc}</p>}
        {i.sectors.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {i.sectors.slice(0, open ? 20 : 5).map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>)}
          </div>
        )}
        {open && facts && <div className="mt-2.5 text-[12px] text-muted-foreground">{facts}</div>}
        {cardFooter ?? (
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11.5px] text-muted-foreground">
            <span className="truncate">{title} · {i.refNo}</span>
            {footerRight ?? (
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(); }} className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground hover:underline">
                {open ? "Show less" : "Show more"}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Buyer's own "How sellers see it" preview — same card. */
export function BuyerBrowseCard({ b, onClick, className, revLabel = null, bands, relation = null, empty, status, expanded, cardFooter }: {
  b: PublicBuyer; onClick?: () => void; className?: string; revLabel?: string | null;
  bands?: { aum?: string | null; ticket?: string | null; rev?: string | null; deal?: string | null };
  relation?: CardInvestor["relation"]; empty?: string; status?: ListingStatus; expanded?: boolean; cardFooter?: React.ReactNode;
}) {
  return (
    <PublicInvestorCard onClick={onClick} className={className} empty={empty} status={status} expanded={expanded} cardFooter={cardFooter} i={{
      refNo: b.refNo, codeName: b.codeName, name: null, type: b.type, city: b.city, country: b.country,
      description: b.description, sectors: b.sectors, stages: b.stages, dealTypes: b.dealTypes, geography: (b as PublicBuyer & { geography?: string | null }).geography ?? null,
      verified: b.verified, proofOfFunds: b.proofOfFunds, ticketLabel: b.ticket, aumLabel: b.aum, revLabel,
      aumBand: bands?.aum, ticketBand: bands?.ticket, revBand: bands?.rev, dealBand: bands?.deal, relation,
    }} />
  );
}
