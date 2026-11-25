import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { SectorArt } from "@/components/hidden-profile/bits";
import { ListingPill, type ListingDeal } from "@/components/hidden-profile/public-listing-card";
import { ManagedBadge } from "@/components/common/managed-badge";
import { TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { FirmLogo, ServiceChip } from "@/components/advisor/advisor-firm-card";
import { useTranslation, setupText, tr } from "@/i18n/language";
import { isCorporateBuyer, type PublicInvestor } from "@/lib/investor-browse";
import { dealBandLabels, reviewStats, type AdvisorFirm } from "@/lib/advisor-firm";
import type { PublicListing } from "@/lib/public-listing";
import { OWNER_STATUS_LABEL, type OwnerStatus } from "@/lib/owner-status";

export function OwnerStatusPill({ status }: { status: OwnerStatus }) {
  return <span className="standard-card-status standard-card-owner-status standard-row-owner-status" data-status={status}>{setupText(OWNER_STATUS_LABEL[status])}</span>;
}

/** Shared Browse/List row boundary. Owner mode replaces only the final action with the existing status words. */
export function StandardBrowseListRow({ children, beforeTrailing, trailing, ownerTrailing, ownerStatus, onOpen, className, trailingClassName, dataKind, connectSource, connectType }: {
  children: ReactNode;
  beforeTrailing?: ReactNode;
  trailing?: ReactNode;
  ownerTrailing?: ReactNode;
  ownerStatus?: OwnerStatus;
  onOpen: () => void;
  className: string;
  trailingClassName?: string;
  dataKind: "seller" | "buyer" | "advisor";
  connectSource?: string;
  connectType?: string | null;
}) {
  return <div data-browse-list-row={dataKind} data-connect-source={connectSource} data-connect-type={connectType} role="button" tabIndex={0} onClick={onOpen}
    onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
    className={className}>
    {children}
    {!ownerStatus && beforeTrailing}
    {(trailing || ownerTrailing || ownerStatus) && <div className={trailingClassName}>
      {ownerStatus ? <>{ownerTrailing}<OwnerStatusPill status={ownerStatus} /></> : trailing}
    </div>}
  </div>;
}

export function ListingBrowseListRow({ l, deal, nda, tag, star, ownerStatus, onOpen }: {
  l: PublicListing;
  deal?: ListingDeal;
  nda?: "requested" | "approved" | null;
  tag?: ReactNode;
  star?: ReactNode;
  ownerStatus?: OwnerStatus;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return <StandardBrowseListRow dataKind="seller" onOpen={onOpen} ownerStatus={ownerStatus}
    ownerTrailing={l.managed ? <ManagedBadge size="sm" /> : null}
    trailing={<>{tag}<ListingPill kind={nda ?? "hidden"} newDays={l.newDays} />{l.managed && <ManagedBadge size="sm" />}{star}</>}
    trailingClassName="flex shrink-0 items-center gap-1.5 max-[639px]:basis-full max-[639px]:justify-end"
    className="group flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-all duration-200 hover:border-accent hover:shadow-[var(--shadow-elevated)]">
    <SectorArt src={l.coverUrl} art={l.coverArt ?? l.sector} sector={l.sector} imageId={l.publicImageId} className="h-[54px] w-[96px] shrink-0 rounded-md" />
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent">{l.headline || l.codeName}</div>
      <div className="truncate text-[12px] text-muted-foreground">
        {[l.verified && t("Verified company"), l.hasFinancials && t("Verified financials"), l.revenueBand, l.sector, l.location].filter(Boolean).join(" · ")}
      </div>
    </div>
  </StandardBrowseListRow>;
}

export function InvestorBrowseListRow({ i, tag, star, ownerStatus, onOpen }: {
  i: PublicInvestor;
  tag?: ReactNode;
  star?: ReactNode;
  ownerStatus?: OwnerStatus;
  onOpen: () => void;
}) {
  return <StandardBrowseListRow dataKind="buyer" onOpen={onOpen} ownerStatus={ownerStatus} connectSource={i.refNo} connectType={i.type ?? i.codeName}
    ownerTrailing={i.managed ? <ManagedBadge size="sm" /> : null} beforeTrailing={tag}
    trailing={<>{!i.name && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"><Lock className="h-3 w-3" />Name after NDA</span>}{i.managed && <ManagedBadge size="sm" />}{star}</>}
    trailingClassName="flex shrink-0 items-center gap-1.5 max-[639px]:basis-full max-[639px]:justify-end"
    className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-colors hover:border-accent">
    <div data-connect-source={i.refNo} data-connect-type={i.type ?? i.codeName} className="contents">
      <div data-connect-cover={i.refNo} data-connect-type={i.type ?? i.codeName} className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><TypeIcon type={i.type} className="h-5 w-5 text-muted-foreground" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{i.name || i.codeName} <span className="font-normal text-muted-foreground">· {i.refNo}</span></div>
        <div className="truncate text-[12px] text-muted-foreground">
          {[i.country, i.ticketLabel && `Ticket ${i.ticketLabel}`, i.aumLabel && `${isCorporateBuyer(i.type) ? "Group revenue" : "AUM"} ${i.aumLabel}`,
            i.revLabel && `Revenue min. ${i.revLabel}`].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  </StandardBrowseListRow>;
}

export function FirmBrowseListRow({ f, rating, action, ownerStatus, onOpen }: {
  f: AdvisorFirm;
  rating: ReturnType<typeof reviewStats>;
  action?: ReactNode;
  ownerStatus?: OwnerStatus;
  onOpen: () => void;
}) {
  const band = dealBandLabels(f.dealBand);
  const st = rating;
  return <StandardBrowseListRow dataKind="advisor" onOpen={onOpen} ownerStatus={ownerStatus}
    trailing={action} trailingClassName="flex justify-end"
    className="grid cursor-pointer grid-cols-[2fr_1.6fr_92px_136px_168px] items-center gap-4 border-t border-[#F0F1F4] px-[18px] py-3 hover:bg-muted/40 dark:border-border">
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-[60px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">{f.logoUrl ? <img src={f.logoUrl} alt="" className="max-h-8 max-w-[52px] object-contain" /> : <FirmLogo f={f} size={40} radius={6} ring={false} />}</span>
      <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{f.name}</div><div className="truncate text-[12px] text-muted-foreground">{[f.refNo, f.firmType, f.city].filter(Boolean).join(" · ")}</div>
        {(f.verifiedAt || f.managed) && <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{f.verifiedAt && <span className="inline-flex h-5 items-center gap-1 rounded-full border border-[#BBE8CA] bg-[#E9F6EE] px-2 text-[11px] font-semibold text-[#15803D]">✓ {tr("Verified")}</span>}{f.managed && <ManagedBadge size="xs" shadow align="left" />}</div>}</div>
    </div>
    <div className="flex flex-wrap gap-1">{f.services.slice(0, 3).map((s) => <ServiceChip key={s} name={s} />)}{f.services.length > 3 && <span className="text-[12px] text-muted-foreground">+{f.services.length - 3}</span>}</div>
    <div className="text-[13px]">{st.n ? <><div className="font-semibold"><span className="text-[#F59E0B]">★</span> {st.avg.toFixed(1)}</div><div className="text-[12px] text-muted-foreground">{st.n} {tr(st.n === 1 ? "review" : "reviews")}</div></> : <span className="text-[12px] text-muted-foreground">{tr("No reviews yet")}</span>}</div>
    <div className="text-[13px]"><div>{band?.usd ?? "—"}</div><div className="text-[12px] text-muted-foreground">{f.teamSize ? `${f.teamSize} ${tr("people")}` : ""}</div></div>
  </StandardBrowseListRow>;
}

export function FirmBrowseList({ items, ratings, action, ownerStatus, onOpen }: {
  items: AdvisorFirm[];
  ratings: Record<string, ReturnType<typeof reviewStats>>;
  action?: (f: AdvisorFirm) => ReactNode;
  ownerStatus?: (f: AdvisorFirm) => OwnerStatus;
  onOpen: (id: string) => void;
}) {
  return <div className="overflow-x-auto rounded-[14px] border border-[#E9EBF0] bg-card dark:border-border">
    <div className="min-w-[860px]">
      <div className="grid grid-cols-[2fr_1.6fr_92px_136px_168px] gap-4 bg-[#FAFAFB] px-[18px] py-2.5 text-[11px] font-bold uppercase text-muted-foreground dark:bg-muted/40">
        <span>{tr("Firm")}</span><span>{tr("Services")}</span><span>{tr("Rating")}</span><span>{tr("Deal size · team")}</span><span />
      </div>
      {items.map((f) => <FirmBrowseListRow key={f.id} f={f} rating={ratings[f.id] ?? { n: 0, avg: 0 }} action={action?.(f)} ownerStatus={ownerStatus?.(f)} onOpen={() => onOpen(f.id)} />)}
    </div>
  </div>;
}

