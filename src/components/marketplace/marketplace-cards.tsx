import { Bookmark, EyeOff, TrendingUp, Wallet, Tag, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/** Teaser-only listing shape. Hidden fields (name, logo, exact figures) are
 *  only present once the NDA is approved — the server must not send them before. */
export type NdaState = "locked" | "requested" | "approved";
export type MarketplaceListing = {
  id: string;
  kind: "sme" | "pe" | "vc";
  ref: string;
  codeName: string;
  region: string;
  headline: string;
  tags: string[];
  rows: { label: string; value: string }[]; // ranges before NDA
  mandateFit: number; // 0–100
  listedAt: string;
  nda: NdaState;
  isNew?: boolean;
  name?: string; // after NDA only
  logoUrl?: string; // after NDA only
};

const TYPE_LABEL = { sme: "SME", pe: "PE fund", vc: "VC fund" } as const;
const STATUS_LABEL = { locked: "Identity hidden", requested: "NDA requested", approved: "NDA signed" } as const;
const ROW_ICONS = [TrendingUp, Wallet, Tag, Target];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

function LogoTile({ l, className }: { l: MarketplaceListing; className: string }) {
  if (l.nda === "approved" && l.logoUrl)
    return <img src={l.logoUrl} alt="" className={cn("shrink-0 rounded-md border border-border object-contain", className)} />;
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-md border border-dashed border-border text-muted-foreground", className)}>
      <EyeOff className="h-4 w-4" />
    </div>
  );
}

export function MarketplaceGridCard({ l, onOpen }: { l: MarketplaceListing; onOpen?: () => void }) {
  const title = l.nda === "approved" && l.name ? l.name : l.codeName;
  return (
    <div className="flex h-full min-h-[453px] flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
      <div className="relative h-[120px] w-full shrink-0 bg-muted">
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Chip>{STATUS_LABEL[l.nda]}</Chip>
          {l.isNew && <Chip>New</Chip>}
        </div>
        <button type="button" aria-label="Save" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground">
          <Bookmark className="h-4 w-4" />
        </button>
        <span className="absolute bottom-2 left-3 text-[11px] text-muted-foreground">Representative image</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <LogoTile l={l} className="h-8 w-16" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-semibold text-foreground">{title}</div>
            <div className="truncate text-[12px] text-muted-foreground">{l.ref} · {l.region}</div>
          </div>
          <Chip>{TYPE_LABEL[l.kind]}</Chip>
        </div>
        <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{l.headline}</p>
        <div className="flex gap-1.5 overflow-hidden">{l.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
        <div className="space-y-2 border-t border-border pt-3 text-[13px]">
          {[...l.rows, { label: "Mandate fit", value: `${l.mandateFit}% · ${l.listedAt}` }].slice(0, 4).map((r, i) => {
            const Icon = ROW_ICONS[i];
            return (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{r.label}</span>
                <span className="font-medium text-foreground">{r.value}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <button type="button" onClick={onOpen} className="h-[34px] rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted">
            {l.nda === "approved" ? "Data room" : "View teaser"}
          </button>
          <button type="button" disabled={l.nda === "requested"} className="h-[34px] rounded-md bg-accent text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
            {l.nda === "approved" ? "Full profile" : l.nda === "requested" ? "Requested" : "Request NDA"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MarketplaceSplitCard({ l, selected, onSelect, onOpen }: { l: MarketplaceListing; selected?: boolean; onSelect?: () => void; onOpen?: () => void }) {
  const title = l.nda === "approved" && l.name ? l.name : l.codeName;
  const sub = l.kind === "sme" ? `${l.ref} · ${l.tags[0] ?? ""}` : l.kind === "pe" ? "PE · Buyout" : "VC · Early-stage";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className={cn(
        "flex h-[226px] flex-col gap-2 overflow-hidden rounded-[14px] border bg-card p-4 shadow-card",
        selected ? "border-accent" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <LogoTile l={l} className="h-12 w-24" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-semibold text-foreground">{title}</div>
          <div className="truncate text-[12px] text-muted-foreground">{sub}</div>
          <div className="truncate text-[12px] text-muted-foreground">{l.region}</div>
        </div>
        <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{l.headline}</p>
      <div className="flex gap-1.5 overflow-hidden">{l.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
      <div className="truncate text-[13px] text-foreground">{l.rows.map((r) => `${r.label} ${r.value}`).join(" · ")}</div>
      <div className="mt-auto flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${l.mandateFit}%` }} /></div>
        <Chip>{STATUS_LABEL[l.nda]}</Chip>
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen?.(); }} className="ml-auto text-xs font-medium text-accent hover:underline">
          {l.nda === "approved" ? "Full profile" : "View details"}
        </button>
      </div>
    </div>
  );
}
