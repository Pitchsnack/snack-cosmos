import { BadgeCheck, Briefcase, Building2, Eye, EyeOff, Landmark, Lock, Rocket, Sprout, Users, Wallet } from "lucide-react";
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

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

/** The card sellers see in Browse investors. Only public fields reach it. */
export function BuyerBrowseCard({ b, className, onClick, selected }: { b: PublicBuyer; className?: string; onClick?: () => void; selected?: boolean }) {
  const hidden = !b.name;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={cn("overflow-hidden rounded-[14px] border bg-card", selected ? "border-accent" : "border-border", onClick && "cursor-pointer", className)}
    >
      <BuyerCover type={b.type} className="h-[110px]">
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
          {hidden ? <><EyeOff className="h-3 w-3" />Name hidden</> : <><Eye className="h-3 w-3" />Name public</>}
        </span>
      </BuyerCover>
      <div className="space-y-2.5 p-4">
        <div className="text-[15px] font-semibold leading-snug text-foreground">{b.headline || b.name || b.codeName}</div>
        <div className="flex flex-wrap gap-1.5">
          {b.verified && <Pill tone="ok"><BadgeCheck className="h-3 w-3" />Verified investor</Pill>}
          {b.proofOfFunds && <Pill tone="ok"><Wallet className="h-3 w-3" />Proof of funds</Pill>}
          {hidden && <Pill tone="amber"><Lock className="h-3 w-3" />Name after NDA</Pill>}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Ticket size</span>
          <span className="font-semibold text-foreground">{b.ticket ?? "Not set"}</span>
          {b.ticket && <span className="rounded bg-indigo-50 px-1 py-0.5 text-[9.5px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Range</span>}
        </div>
        {b.description && <p className="line-clamp-3 text-[12.5px] text-muted-foreground">{b.description}</p>}
        {b.sectors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {b.sectors.slice(0, 5).map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span className="truncate">{b.type ?? "Investor"}</span>
          <span className="truncate">{[b.city, b.country].filter(Boolean).join(", ") || "Location not set"}</span>
          <span className="truncate">{b.stages.slice(0, 2).join(", ") || "Stages not set"}</span>
          <span className="truncate">{b.aum ? `AUM ${b.aum}` : "AUM not set"}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11.5px] text-muted-foreground">
          <span className="truncate">{(b.name || b.codeName)} · {b.refNo}</span>
          {b.liveSince && b.status === "live" && <span className="shrink-0">Live since {fmtDate(b.liveSince)}</span>}
        </div>
      </div>
    </div>
  );
}
