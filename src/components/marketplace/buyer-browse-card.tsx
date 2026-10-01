import { useState } from "react";
import { BadgeCheck, Briefcase, Building2, ChevronDown, Eye, EyeOff, Landmark, Lock, Rocket, Sprout, Users } from "lucide-react";
import { isCorporateBuyer } from "@/lib/investor-browse";
import { typeTone, type PublicBuyer } from "@/lib/buyer-profile";
import { cn } from "@/lib/utils";

export function TypeIcon({ type, className }: { type: string | null; className?: string }) {
  const t = (type ?? "").toLowerCase();
  const I = t.includes("family") ? Users : t.includes("private equity") ? Landmark : t.includes("venture") || t.includes("vc") ? Rocket
    : t.includes("incubat") || t.includes("accelerat") ? Sprout : t.includes("corporate") ? Building2 : Briefcase;
  return <I className={className} />;
}

/** Vector cover for an investor — never a logo or photo. */
export function BuyerCover({ type, className, children }: { type: string | null; className?: string; children?: React.ReactNode }) {
  const tone = typeTone(type);
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
  ticketLabel: string | null; aumLabel: string | null; revenueMinM: number | null;
};

function revLabel(m: number | null) {
  if (m == null) return null;
  if (m === 0) return "No revenue minimum";
  return m >= 1000 ? `฿${+(m / 1000).toFixed(1)}B` : `฿${m}M`;
}

/** The one public investor card sellers see in Browse investors. Only public fields reach it. */
export function PublicInvestorCard({ i, className, onClick, selected, expanded, onToggleExpand, topRight }: {
  i: CardInvestor; className?: string; onClick?: () => void; selected?: boolean;
  expanded?: boolean; onToggleExpand?: () => void; topRight?: React.ReactNode;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  const toggle = onToggleExpand ?? (() => setLocalOpen((o) => !o));
  const hidden = !i.name;
  const corp = isCorporateBuyer(i.type);
  const rev = revLabel(i.revenueMinM);
  const sub: React.ReactNode[] = [];
  sub.push(<span key="a">{corp ? "Group revenue" : "AUM"} {i.aumLabel ? <b className="font-semibold text-[#434A5C] dark:text-foreground">{i.aumLabel}</b> : "undisclosed"}</span>);
  if (rev) sub.push(i.revenueMinM === 0
    ? <span key="r">No revenue minimum</span>
    : <span key="r">Revenue min. <b className="font-semibold text-[#434A5C] dark:text-foreground">{rev}</b></span>);
  const facts = [[i.city, i.country].filter(Boolean).join(", "), i.stages.join(", "), i.dealTypes.join(", "), i.geography].filter(Boolean).join(" · ");
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onClick(); } : undefined}
      className={cn("overflow-hidden rounded-[14px] border bg-card", selected ? "border-accent ring-1 ring-accent/40" : "border-border", onClick && "cursor-pointer", className)}
    >
      <BuyerCover type={i.type} className="h-[110px]">
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
          {hidden ? <><EyeOff className="h-3 w-3" />Name hidden</> : <><Eye className="h-3 w-3" />Name public</>}
        </span>
        {topRight && <div className="absolute right-2.5 top-2.5">{topRight}</div>}
      </BuyerCover>
      <div className="space-y-2.5 p-4">
        <div>
          <div className="text-[15px] font-semibold leading-snug text-foreground">{i.name || i.codeName}</div>
          <div className="truncate text-[12px] text-muted-foreground">{[i.refNo, i.type ?? "Investor", i.country].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {i.verified && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Verified investor</Pill>}
          {i.proofOfFunds && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Proof of funds</Pill>}
          {hidden && <Pill tone="amber"><Lock className="h-3 w-3" />Name after NDA</Pill>}
        </div>
        <div>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Ticket size</span>
            <span className="font-semibold text-foreground">{i.ticketLabel ?? "Not set"}</span>
            {i.ticketLabel && <span className="rounded bg-indigo-50 px-1 py-0.5 text-[9.5px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Range</span>}
          </div>
          <div className="mt-0.5 text-[12.5px] text-[#6B7280] dark:text-muted-foreground">
            {sub.map((s, k) => <span key={k}>{k > 0 && " · "}{s}</span>)}
          </div>
        </div>
        {i.description && <p className={cn("text-[12.5px] text-muted-foreground", !open && "line-clamp-2")}>{i.description}</p>}
        {i.sectors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {i.sectors.slice(0, open ? 20 : 5).map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>)}
          </div>
        )}
        {open && facts && <div className="text-[12px] text-muted-foreground">{facts}</div>}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11.5px] text-muted-foreground">
          <span className="truncate">{i.codeName} · {i.refNo}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); toggle(); }} className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground hover:underline">
            {open ? "Show less" : "Show more"}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Buyer's own "How sellers see it" preview — same card. */
export function BuyerBrowseCard({ b, className, revenueMinM = null }: { b: PublicBuyer; className?: string; revenueMinM?: number | null }) {
  return (
    <PublicInvestorCard className={className} i={{
      refNo: b.refNo, codeName: b.codeName, name: b.name, type: b.type, city: b.city, country: b.country,
      description: b.description || b.headline, sectors: b.sectors, stages: b.stages, dealTypes: b.dealTypes, geography: null,
      verified: b.verified, proofOfFunds: b.proofOfFunds, ticketLabel: b.ticket, aumLabel: b.aum, revenueMinM,
    }} />
  );
}
