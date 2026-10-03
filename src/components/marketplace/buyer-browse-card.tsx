import { BadgeCheck, Briefcase, Building2, EyeOff, Landmark, Lock, Rocket, Sprout, User, Users } from "lucide-react";
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
  aumBand?: string | null; ticketBand?: string | null; revBand?: string | null;
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

function Figure({ label, band, empty, shade, wideSpan, big }: { label: string; band: string | null | undefined; empty: string; shade?: boolean; wideSpan?: boolean; big?: boolean }) {
  const b = bandOf(band);
  const on = shade && !!b;
  return (
    <div className={cn("min-w-0 px-[11px] pb-[9px] pt-[10px]", on ? "bg-[#FFF4E0] dark:bg-amber-950/40" : "bg-[#FAFBFC] dark:bg-muted/40", wideSpan && "col-span-2")}>
      <dt className={cn("truncate", big ? "text-[12px]" : "text-[11.5px]", on ? "text-[#8A5A06] dark:text-amber-300" : "text-[#6B7280] dark:text-muted-foreground")}>{label}</dt>
      {b ? (
        <dd>
          <div className={cn("tabular-nums text-[#151A28] dark:text-foreground", big ? "text-[15px] font-semibold" : "text-[13.5px] font-bold")}>{nbspDash(b.label)}</div>
          <div className={cn(big ? "text-[12.5px]" : "text-[11.5px]", on ? "text-[#8A5A06] dark:text-amber-300" : "text-[#6B7280] dark:text-muted-foreground")}>({nbspDash(b.baht)})</div>
        </dd>
      ) : (
        <dd className="text-[13.5px] font-medium text-[#9CA3AF]">{empty}</dd>
      )}
    </div>
  );
}

/** Ticket size · AUM · Min. target revenue · Geography. Wide (≥560px) puts the values in one row. */
export function KeyFigures({ i, empty, oneRow }: { i: CardInvestor; empty: string; oneRow?: boolean }) {
  const individual = (i.type ?? "") === INDIVIDUAL_TYPE || i.relation === "individual" || i.relation === "agent";
  const corp = isCorporateBuyer(i.type);
  const places = (i.geography ?? "").split(/\s*[,·]\s*/).filter(Boolean);
  return (
    <dl className="overflow-hidden rounded-[12px] border border-[#E9EBF0] dark:border-border">
      <div className={cn("grid gap-px bg-[#EEF0F3] dark:bg-border",
        oneRow ? (individual ? "grid-cols-2" : "grid-cols-3") : "grid-cols-2")}>
        <Figure label="Ticket size" band={i.ticketBand} empty={empty} big />
        {!individual && <Figure label={corp ? "Group revenue" : "AUM"} band={i.aumBand} empty={empty} big />}
        <Figure label="Min. target revenue" band={i.revBand} empty={empty} shade wideSpan={!individual && !oneRow} big />
      </div>
      {!oneRow && (
        <div className="flex flex-wrap items-baseline gap-x-2.5 border-t border-[#EEF0F3] bg-[#FAFBFC] px-[11px] pb-[10px] pt-[9px] dark:border-border dark:bg-muted/40">
          <dt className="text-[11.5px] text-[#6B7280] dark:text-muted-foreground">Geography</dt>
          <dd className={cn("text-[12.5px]", places.length ? "font-semibold text-[#434A5C] dark:text-foreground" : "font-medium text-[#9CA3AF]")}>{places.length ? places.join(" · ") : empty}</dd>
        </div>
      )}
    </dl>
  );
}

const shortPlace = (p: string) => p.replace(/\s+Sub-region$/i, "");
const shortChip = (s: string) => s.replace(/\(above 51%\)/i, "(51%+)");

export function NameAfterNdaPill() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full border border-[#FCD9A0] bg-[#FFFBEB] px-2.5 text-[12.5px] font-medium text-[#B45309] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <Lock className="h-[13px] w-[13px]" />Name after NDA
    </span>
  );
}

/** Card body: each fact once. `oneRow` puts the three figures in one row (Split panel). */
function CardBody({ i, empty, desc, oneRow }: { i: CardInvestor; empty: string; desc: string | null; oneRow?: boolean }) {
  const places = (i.geography ?? "").split(/\s*[,·]\s*/).filter(Boolean).map(shortPlace);
  const chips = [...i.sectors, ...i.stages, ...i.dealTypes].map(shortChip);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-2 py-[5px] text-[13px]">
      <span className="w-[88px] shrink-0 text-[#6B7280] dark:text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-[#374151] dark:text-foreground">{value}</div>
    </div>
  );
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[18px] font-semibold leading-snug text-[#111827] dark:text-foreground">{typeName(i.type)}</div>
        <div className="whitespace-nowrap text-[13px] tabular-nums text-[#6B7280] dark:text-muted-foreground">{i.refNo}</div>
      </div>
      {(i.verified || i.proofOfFunds) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {i.verified && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Verified investor</Pill>}
          {i.proofOfFunds && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Proof of funds</Pill>}
        </div>
      )}
      {desc && <p className="mb-3 mt-1.5 text-[14px] leading-[1.5] text-[#374151] dark:text-foreground/85">{desc}</p>}
      <div className={desc ? "" : "mt-3"}><KeyFigures i={i} empty={empty} oneRow={oneRow} /></div>
      <div className="mt-3">
        {row("Invests in", places.length ? places.join(" · ") : <span className="text-[#9CA3AF]">{empty}</span>)}
        {i.city && row("Based in", i.city)}
        {chips.length > 0 && row("Focus", (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c, k) => <span key={c + k} className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-[9px] py-0.5 text-[12px] text-[#374151] dark:border-border dark:bg-muted dark:text-foreground">{c}</span>)}
          </div>
        ))}
      </div>
    </>
  );
}

/** The one public investor card (Browse investors, Favourites, My Company). Only public fields reach it. */
export function PublicInvestorCard({ i, className, onClick, selected, topRight, empty = "Not stated", status, cardFooter, panel }: {
  i: CardInvestor; className?: string; onClick?: () => void; selected?: boolean;
  /** Legacy props, ignored: the card always shows in full. */
  expanded?: boolean; onToggleExpand?: () => void; footerRight?: React.ReactNode;
  topRight?: React.ReactNode;
  /** "Not stated" for sellers, "Not added" on the buyer's own My Company. */
  empty?: string; status?: ListingStatus;
  /** Optional extra footer (e.g. the seller-style "Live since" footer). */
  cardFooter?: React.ReactNode;
  /** Split information panel: figures in one row of three. */
  panel?: boolean;
}) {
  const desc = i.description || (empty === "Not added" ? "Not added" : null);
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onClick(); } : undefined}
      className={cn("overflow-hidden rounded-[14px] border bg-card", selected ? "border-accent ring-1 ring-accent/40" : "border-border", onClick && "cursor-pointer transition-shadow hover:shadow-md", className)}
    >
      <BuyerCover type={i.type} className="h-[110px]">
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
          <EyeOff className="h-3 w-3" />Name hidden
        </span>
        {(topRight || status) && <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">{status && <StatusPill status={status} />}{topRight}</div>}
      </BuyerCover>
      <div className="p-4">
        <CardBody i={i} empty={empty} desc={desc} oneRow={panel} />
        {cardFooter}
      </div>
    </div>
  );
}

/** Buyer's own "How sellers see it" preview — same card. */
export function BuyerBrowseCard({ b, onClick, className, revLabel = null, bands, relation = null, empty, status, expanded, cardFooter }: {
  b: PublicBuyer; onClick?: () => void; className?: string; revLabel?: string | null;
  bands?: { aum?: string | null; ticket?: string | null; rev?: string | null };
  relation?: CardInvestor["relation"]; empty?: string; status?: ListingStatus; expanded?: boolean; cardFooter?: React.ReactNode;
}) {
  return (
    <PublicInvestorCard onClick={onClick} className={className} empty={empty} status={status} expanded={expanded} cardFooter={cardFooter} i={{
      refNo: b.refNo, codeName: b.codeName, name: null, type: b.type, city: b.city, country: b.country,
      description: b.description, sectors: b.sectors, stages: b.stages, dealTypes: b.dealTypes, geography: (b as PublicBuyer & { geography?: string | null }).geography ?? null,
      verified: b.verified, proofOfFunds: b.proofOfFunds, ticketLabel: b.ticket, aumLabel: b.aum, revLabel,
      aumBand: bands?.aum, ticketBand: bands?.ticket, revBand: bands?.rev, relation,
    }} />
  );
}
