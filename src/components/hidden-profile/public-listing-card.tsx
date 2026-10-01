import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Briefcase, Building2, Calendar, FileText, Lock, MapPin, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/language";
import type { PublicListing } from "@/lib/public-listing";
import { getStartupSignedUrl } from "@/lib/startups.functions";
import { SectorArt } from "./bits";

/** Resolves a startup-media storage path to a signed URL. */
export function useMediaUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const getUrl = useServerFn(getStartupSignedUrl);
  useEffect(() => {
    let cancel = false;
    if (!path || path.startsWith("art:")) { setUrl(null); return; }
    getUrl({ data: { path } }).then((r) => { if (!cancel) setUrl(r.url); }).catch(() => {});
    return () => { cancel = true; };
  }, [path, getUrl]);
  return url;
}

/** Locked placeholder shown until Admin sets the public image and approves. */
export function LockedCover({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-muted text-muted-foreground", className)}>
      <div className="flex flex-col items-center gap-1.5 text-center text-[11.5px] font-semibold"><Lock className="h-5 w-5" />Image locked · set by Admin</div>
      {children}
    </div>
  );
}

/** Renders a public cover value: storage path, "art:<sector>", or the locked placeholder. */
export function CoverView({ cover, fallbackArt, locked, className, children }: { cover: string | null; fallbackArt?: string | null; locked?: boolean; className?: string; children?: React.ReactNode }) {
  const url = useMediaUrl(cover);
  if (cover?.startsWith("art:")) return <SectorArt art={cover.slice(4)} className={className}>{children}</SectorArt>;
  if (url) return <div className={cn("relative overflow-hidden", className)}><img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />{children}</div>;
  if (locked) return <LockedCover className={className}>{children}</LockedCover>;
  return <SectorArt art={fallbackArt} className={className}>{children}</SectorArt>;
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
}

function Badge({ tone, icon, children }: { tone: "blue" | "green" | "violet" | "dashed"; icon: React.ReactNode; children: React.ReactNode }) {
  const t = {
    blue: "border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8]",
    green: "border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]",
    violet: "border-[#C4B5FD] bg-[#F5F3FF] text-[#6D28D9]",
    dashed: "border-dashed border-[#D1D5DB] bg-transparent text-[#9CA3AF]",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", t)}>{icon}{children}</span>;
}

export function TagChips({ tags, green }: { tags: string[]; green?: boolean }) {
  if (!tags.length) return <span className="text-[12px] text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", green ? "bg-[#ECFDF5] text-[#065F46]" : "bg-muted text-foreground/80")}>{t}</span>
      ))}
    </div>
  );
}

function Fact({ icon, children, full }: { icon: React.ReactNode; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", full && "col-span-2")}>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export type ListingDeal = { dealType?: string | null; askingPrice?: number | null; stakePct?: number | null };

export function dealLine(d?: ListingDeal, t: (s: string) => string = (s) => s) {
  if (!d) return "";
  return [
    d.dealType,
    d.stakePct != null ? `${d.stakePct}% ${t("stake")}` : null,
    d.askingPrice == null ? t("price on request") : `฿${d.askingPrice}M ${t("asking")}`,
  ].filter(Boolean).join(" · ");
}

/**
 * One listing card used by the seller's "How buyers see it", the buyer Grid,
 * the Split list and the Split detail panel. The cover is ALWAYS sector vector
 * art — photos and logos only appear in the Private view after NDA.
 */
export function PublicListingCard({
  l, seller = false, className, deal, expanded = true, onToggleExpand, selected, onSelect, topRight, badge, priv, wrapMeta,
}: {
  l: PublicListing;
  seller?: boolean;
  className?: string;
  deal?: ListingDeal;
  /** When false, shows the compact version with a "Show more" link. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  topRight?: React.ReactNode;
  /** Replaces the top-left "Identity hidden" badge. */
  badge?: React.ReactNode;
  /** Unlocked (approved NDA) fields — only ever sent by the server for the buyer's own valid NDAs. */
  priv?: { name: string; logoPath: string | null; revenueText: string | null; fy: number | null; employees: string | null };
  wrapMeta?: boolean;
}) {
  const { t } = useTranslation();
  const badgeLabel = seller ? (l.live ? t("Live") : l.refNo ? t("Draft") : t("Preview")) : t("Identity hidden");
  const emp = priv?.employees ? (/employee/i.test(priv.employees) ? priv.employees : `${priv.employees} ${t("employees")}`) : l.employees;
  const meta = [l.sector, l.subSector, l.location?.replace(/, Thailand$/, ""), emp].filter(Boolean).join(" · ");
  const dl = dealLine(deal, t);
  const interactive = !!onSelect;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!selected : undefined}
      onClick={onSelect}
      onKeyDown={interactive ? (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect?.(); } } : undefined}
      className={cn(
        "flex flex-col overflow-hidden rounded-[14px] border-[1.5px] bg-card text-left transition-shadow",
        selected ? "border-[#F59E0B] shadow-[0_0_0_4px_rgba(245,158,11,.15)]" : "border-border",
        interactive && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
    >
      <SectorArt art={l.coverArt ?? l.sector} sector={l.sector} imageId={l.publicImageId} className="h-[112px] w-full shrink-0" tile={priv ? <PrivLogo name={priv.name} path={priv.logoPath} /> : undefined}>
        {badge ? <span className="absolute left-2.5 top-2.5">{badge}</span> : <span className={cn("absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
          seller ? (l.live ? "bg-[#E8F6EE] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]") : "bg-background/95 text-foreground")}>
          {!seller && <Lock className="h-3 w-3" />}{badgeLabel}
        </span>}
        {topRight && <div className="absolute right-2.5 top-2.5">{topRight}</div>}
      </SectorArt>
      <div className="flex flex-1 flex-col p-3.5">
        {priv && <div className="truncate text-[16px] font-bold text-[#111827]" title={priv.name}>{priv.name}</div>}
        <h3 className={priv ? "mt-0.5 line-clamp-2 text-[13.5px] font-medium leading-[1.35] text-[#374151]" : "line-clamp-2 text-[15px] font-bold leading-[1.3]"}>{l.headline || <span className="text-muted-foreground">{t("Add a headline")}</span>}</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {l.verified && <Badge tone="blue" icon={<BadgeCheck className="h-3 w-3" />}>{t("Verified company")}</Badge>}
          {l.hasFinancials ? <Badge tone="green" icon={<FileText className="h-3 w-3" />}>{t("Verified financials")}</Badge>
            : seller && <Badge tone="dashed" icon={<FileText className="h-3 w-3" />}>{t("Verified financials · optional")}</Badge>}
          {!priv && <Badge tone="violet" icon={<Lock className="h-3 w-3" />}>{t("Identity after NDA")}</Badge>}
        </div>
        {priv ? (priv.revenueText && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">{t("Revenue")} FY{priv.fy != null ? String(priv.fy).slice(-2) : "25"}</span>
            <span className="text-[14px] font-bold">{priv.revenueText}</span>
          </div>
        )) : l.revenueBand && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">{t("Revenue")} FY25</span>
            <span className="text-[14px] font-bold">{l.revenueBand}</span>
            <span className="rounded bg-[#EEF0FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#4338CA]">{t("Range")}</span>
          </div>
        )}
        {meta && <div className={cn("mt-1.5 text-[12.5px] text-muted-foreground", !wrapMeta && "truncate")}>{meta}</div>}
        {expanded && (
          <div className="mt-3 space-y-2.5 border-t border-border pt-3">
            {l.description && <p className="text-[13px] text-foreground/80">{l.description}</p>}
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-2">
              <span className="pt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Products & services</span>
              <TagChips tags={l.productTags} />
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-2">
              <span className="pt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Markets</span>
              <TagChips tags={l.marketTags} green />
            </div>
            {l.certifications.length > 0 && (
              <div className="flex items-center gap-2 text-[12.5px]"><ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />{l.certifications.join(" · ")}</div>
            )}
            {dl && <div className="flex items-center gap-2 text-[12.5px] font-medium"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{dl}</div>}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[12px] text-muted-foreground" style={{ marginTop: 12 }}>
          <span className="min-w-0 truncate">{[l.codeName, l.refNo].filter(Boolean).join(" · ")}</span>
          {onToggleExpand ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }} className="shrink-0 font-semibold text-foreground hover:underline">
              {expanded ? "Show less ▴" : "Show more ▾"}
            </button>
          ) : (
            <span className="shrink-0">{l.live && l.publishedAt ? `Posted ${fmt(l.publishedAt)}` : "Not published yet"}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PrivLogo({ name, path }: { name: string; path: string | null }) {
  const url = useMediaUrl(path);
  const ini = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return url
    ? <img src={url} alt="" className="h-full w-full object-contain" />
    : <span className="text-[15px] font-bold text-foreground">{ini}</span>;
}
