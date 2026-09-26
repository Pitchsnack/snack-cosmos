import { BadgeCheck, Briefcase, Building2, Calendar, FileText, Lock, MapPin, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicListing } from "@/lib/public-listing";
import { SectorArt } from "./bits";

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

/** One listing card used by the seller's Public view AND the buyer Marketplace. */
export function PublicListingCard({ l, seller = false, className }: { l: PublicListing; seller?: boolean; className?: string }) {
  const ic = "h-4 w-4";
  return (
    <div className={cn("grid gap-[18px] rounded-[14px] bg-card p-3.5 shadow-[0_1px_3px_rgba(16,24,40,.08),0_4px_12px_rgba(16,24,40,.05)] sm:grid-cols-[190px_minmax(0,1fr)]", className)} style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <SectorArt art={l.coverArt ?? l.sector} className="min-h-[160px] rounded-[10px] bg-none !bg-[#E0E7FF]">
        {seller && (
          <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
            l.live ? "bg-[#E8F6EE] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]")}>{l.live ? "Live" : "Draft"}</span>
        )}
      </SectorArt>
      <div className="min-w-0">
        <h3 className="text-[18px] font-bold leading-[1.3]">{l.headline || <span className="text-muted-foreground">Add a headline</span>}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {l.verified && <Badge tone="blue" icon={<BadgeCheck className="h-3.5 w-3.5" />}>Verified company</Badge>}
          {l.hasFinancials ? (
            <Badge tone="green" icon={<FileText className="h-3.5 w-3.5" />}>Financial reports available</Badge>
          ) : seller ? (
            <Badge tone="dashed" icon={<FileText className="h-3.5 w-3.5" />}>Financial reports · add FY23–25</Badge>
          ) : null}
          <Badge tone="violet" icon={<Lock className="h-3.5 w-3.5" />}>Identity after NDA</Badge>
        </div>
        {l.revenueBand && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[14px] text-muted-foreground">Revenue FY25</span>
            <span className="text-[15px] font-bold">{l.revenueBand}</span>
            <span className="rounded bg-[#EEF0FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#4338CA]">Range</span>
          </div>
        )}
        {l.description && <p className="mt-2 text-[13.5px] text-[#374151] dark:text-foreground/80">{l.description}</p>}
        <div className="mt-3 space-y-2 border-t border-[#F0F1F3] pt-3 dark:border-border">
          <div className="grid grid-cols-[126px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Products & services</span>
            <TagChips tags={l.productTags} />
          </div>
          <div className="grid grid-cols-[126px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Markets</span>
            <TagChips tags={l.marketTags} green />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          {l.sector && (
            <Fact full icon={<Building2 className={ic} />}>
              {l.sector}{l.subSector && <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold">{l.subSector}</span>}
            </Fact>
          )}
          <Fact icon={<MapPin className={ic} />}>{l.location ?? "—"}</Fact>
          <Fact icon={<Calendar className={ic} />}>{l.typeFounded ?? "—"}</Fact>
          <Fact icon={<Users className={ic} />}>{l.employees ?? "—"}</Fact>
          {l.certifications.length > 0 ? (
            <Fact icon={<ShieldCheck className={ic} />}>{l.certifications.join(" · ")}</Fact>
          ) : <span />}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1 truncate"><Briefcase className="h-3.5 w-3.5 shrink-0" />{[l.codeName, l.refNo].filter(Boolean).join(" · ")}</span>
          <span className="shrink-0">{l.live && l.publishedAt ? `Posted on ${fmt(l.publishedAt)}` : "Not published yet"}</span>
        </div>
      </div>
    </div>
  );
}
