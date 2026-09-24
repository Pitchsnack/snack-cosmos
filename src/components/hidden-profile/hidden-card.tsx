import { EyeOff, Plus, TrendingUp, Wallet, Users } from "lucide-react";
import type { StartupListItem } from "@/lib/startups.functions";
import {
  hiddenStatusOf,
  identityTerms,
  isStartupEntry,
  moneyRange,
  staffRange,
  type HiddenDraft,
  type HiddenProfileRow,
} from "@/lib/hidden-profile";
import { Flagged, SectorArt } from "./bits";
import { cn } from "@/lib/utils";

function priceLabel(d: HiddenDraft) {
  if (d.asking_price == null) return "Price on request";
  return `฿${d.asking_price}M`;
}

function isNew(publishedAt: string | null) {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < 3 * 86400_000;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-muted px-2 text-[11px] text-muted-foreground">{children}</span>;
}

/** The card buyers see in SME Takeover, plus one admin-only row. */
export function HiddenCard({
  s,
  row,
  variant,
  selected,
  onOpen,
  onProfiles,
  onCreate,
}: {
  s: StartupListItem;
  row: HiddenProfileRow | null | undefined;
  variant: "grid" | "split";
  selected?: boolean;
  onOpen: () => void;
  onProfiles?: () => void;
  onCreate?: () => void;
}) {
  const startup = isStartupEntry(s.company_type);
  const h = variant === "grid" ? "h-[440px]" : "h-[226px]";

  if (startup || !row) {
    return (
      <div className={cn("flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 p-4 text-center", h, selected && "border-accent")}>
        <EyeOff className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">{startup ? "Not for startups" : "No hidden card yet"}</div>
        <div className="text-xs text-muted-foreground">{s.startup_name}</div>
        {!startup && onCreate && (
          <button type="button" onClick={onCreate} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:bg-accent/90">
            <Plus className="h-3.5 w-3.5" /> Create hidden profile
          </button>
        )}
        <div className="w-full border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
          Hidden profile: {startup ? "N/A" : "None yet"}
        </div>
      </div>
    );
  }

  const status = hiddenStatusOf(row, s.company_type);
  const showLive = row.status === "live" && row.live;
  const d = (showLive ? row.live : row) as HiddenDraft;
  const terms = showLive ? [] : identityTerms(s);
  const industry = s.sector || s.industry?.[0] || "SME";
  const tags = [industry, s.industry?.[1], d.deal_type].filter(Boolean) as string[];
  const rev = moneyRange(s.last_year_revenue);
  const statusText = status === "live" ? "Live" : status === "live_edited" ? "Live · edited" : "Draft";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className={cn(
        "flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-card transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        h,
        selected ? "border-accent" : "border-border",
      )}
    >
      {variant === "grid" && (
        <SectorArt art={d.cover_art} className="h-[110px] w-full shrink-0">
          {isNew(row.published_at) && row.status === "live" && (
            <span className="absolute left-3 top-3"><Chip>New</Chip></span>
          )}
        </SectorArt>
      )}
      <div className={cn("flex flex-1 flex-col gap-2", variant === "grid" ? "p-4" : "p-3")}>
        <div className="flex min-w-0 items-start gap-3">
          {variant === "split" && <SectorArt art={null} className="h-12 w-16 shrink-0 rounded-md" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-foreground"><Flagged text={d.code_name} terms={terms} /></div>
            <div className="truncate text-[12px] text-muted-foreground">{row.ref_no} · {industry}</div>
            <div className="truncate text-[12px] text-muted-foreground">{d.region || "Region not set"}</div>
          </div>
        </div>
        <p className="line-clamp-2 text-[12.5px] text-muted-foreground">
          {d.headline ? <Flagged text={d.headline} terms={terms} /> : <em>No headline yet</em>}
        </p>
        <div className="flex gap-1.5 overflow-hidden">{tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
        <div className="space-y-1 text-[12.5px]">
          <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Revenue</span><span className="font-medium">{rev ?? "—"}</span></div>
          <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Asking</span><span className="font-medium">{priceLabel(d)}</span></div>
          {variant === "grid" && (
            <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" />Employees</span><span className="font-medium">{staffRange(s.company_size) ?? "—"}</span></div>
          )}
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-2 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground" title="Admin only — buyers never see this row">
            <span className="shrink-0">Full profile:</span>
            {s.logo_signed_url && <img src={s.logo_signed_url} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />}
            <span className="truncate font-medium text-foreground">{s.startup_name}</span>
            <span className={cn("ml-auto shrink-0 rounded-full px-1.5", status === "draft" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>{statusText}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground"><EyeOff className="h-3.5 w-3.5" />Identity hidden</span>
            {variant === "grid" && onProfiles && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onProfiles(); }} className="ml-auto rounded-md border border-border px-2 py-1 font-medium hover:bg-muted">Profiles</button>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className={cn("font-medium text-accent hover:underline", !(variant === "grid" && onProfiles) && "ml-auto")}>View details</button>
          </div>
        </div>
      </div>
    </div>
  );
}
