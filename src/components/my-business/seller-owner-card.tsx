import { StandardListingCard } from "@/components/marketplace/standard-listing-card";
import { ListingBrowseListRow } from "@/components/marketplace/browse-list-rows";
import { useAdminReview } from "@/components/my-business/admin-review-context";
import { useHasFinancials } from "@/hooks/use-has-financials";
import { useManagedIds } from "@/hooks/use-managed-ids";
import { useMediaUrl, type ListingDeal } from "@/components/hidden-profile/public-listing-card";
import { buildPublicListing, type ListingSource, type PublicListing } from "@/lib/public-listing";
import { hiddenStatusOf, type HiddenProfileRow } from "@/lib/hidden-profile";
import { sellerOwnerStatus } from "@/lib/owner-status";
import type { StartupListItem } from "@/lib/startups.functions";

type OwnerRow = HiddenProfileRow & {
  suggested_listing_name?: string | null;
  suggested_headline?: string | null;
  published_headline?: string | null;
  published_headline_th?: string | null;
  asking_price_band?: ListingDeal["priceBand"];
  public_image_id?: string | null;
};

/** Latest owner draft, with Admin's published name/headline leading where those values exist. */
export function sellerOwnerListing(s: StartupListItem, row: HiddenProfileRow | null | undefined, hasFinancials: boolean, coverUrl?: string | null): PublicListing {
  const r = row as OwnerRow | null | undefined;
  const status = hiddenStatusOf(row, s.company_type);
  const base = buildPublicListing(s as ListingSource, row ? { ...row, live: status === "live" || status === "live_edited" } : null, hasFinancials);
  const live = row?.live as OwnerRow | null | undefined;
  const pendingEdits = !!r && (r.has_unpublished_changes || (!!live && (r.approval_status === "in_review" || r.approval_status === "live_edits_pending" || r.approval_status === "changes_requested")));
  const adminName = r?.code_name?.trim();
  const ownName = r?.suggested_listing_name?.trim();
  const adminHeadline = r?.published_headline?.trim();
  const ownHeadline = r?.headline?.trim();
  const adminHeadlineTh = r?.published_headline_th?.trim();
  const ownHeadlineTh = r?.headline_th?.trim();
  return {
    ...base,
    codeName: (pendingEdits ? ownName || adminName : adminName || ownName) || r?.ref_no || base.codeName,
    headline: (pendingEdits ? ownHeadline || adminHeadline : adminHeadline || ownHeadline) || base.headline,
    th: {
      ...base.th,
      headline: (pendingEdits ? ownHeadlineTh || adminHeadlineTh : adminHeadlineTh || ownHeadlineTh) || base.th?.headline || "",
      description: base.th?.description ?? "",
      highlights: base.th?.highlights ?? [],
      customerProfile: base.th?.customerProfile ?? "",
    },
    coverUrl,
    coverArt: r?.cover_art ?? live?.cover_art ?? base.coverArt,
    coverImage: r?.cover_image_url ?? live?.cover_image_url ?? base.coverImage,
    publicImageId: r?.public_image_id ?? live?.public_image_id ?? base.publicImageId,
    publishedAt: r?.published_at ?? base.publishedAt,
    certified: !!(s as StartupListItem & { registration_verified_at?: string | null }).registration_verified_at,
  };
}

export function sellerOwnerDeal(row: HiddenProfileRow | null | undefined): ListingDeal {
  const r = row as OwnerRow | null | undefined;
  return { dealType: r?.deal_type ?? null, askingPrice: null, priceBand: r?.asking_price_band ?? null };
}

export function SellerOwnerCard({ s, row, hasFinancials = false, coverUrl, managed = false, selected, onSelect, className }: {
  s: StartupListItem;
  row: HiddenProfileRow | null | undefined;
  hasFinancials?: boolean;
  coverUrl?: string | null;
  managed?: boolean;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const listing = { ...sellerOwnerListing(s, row, hasFinancials, coverUrl), managed };
  return <StandardListingCard l={listing} deal={sellerOwnerDeal(row)} publicOnly ownerStatus={sellerOwnerStatus(row)} selected={selected} onSelect={onSelect} className={className} />;
}

export function SellerOwnerListRow({ s, row, hasFinancials = false, coverUrl, managed = false, onOpen }: {
  s: StartupListItem;
  row: HiddenProfileRow | null | undefined;
  hasFinancials?: boolean;
  coverUrl?: string | null;
  managed?: boolean;
  onOpen: () => void;
}) {
  const listing = { ...sellerOwnerListing(s, row, hasFinancials, coverUrl), managed };
  return <ListingBrowseListRow l={listing} deal={sellerOwnerDeal(row)} ownerStatus={sellerOwnerStatus(row)} onOpen={onOpen} />;
}

/** Existing authorised owner reads feed every seller My Company layout. */
export function SellerOwnerCardData({ s, row, selected, onSelect, className, list = false }: {
  s: StartupListItem;
  row: HiddenProfileRow | null | undefined;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
  list?: boolean;
}) {
  const adminReview = useAdminReview();
  const managed = useManagedIds("startup", [s.id]);
  const { hasData } = useHasFinancials(s.id);
  const r = row as OwnerRow | null | undefined;
  const rawCover = adminReview?.pendingCover ?? r?.cover_image_url ?? r?.live?.cover_image_url ?? null;
  const remoteCover = rawCover && !/^https?:\/\//i.test(rawCover) ? rawCover : null;
  const signedCover = useMediaUrl(remoteCover);
  const coverUrl = rawCover ? (/^https?:\/\//i.test(rawCover) ? rawCover : signedCover) : undefined;
  return list
    ? <SellerOwnerListRow s={s} row={row} hasFinancials={hasData} coverUrl={coverUrl} managed={managed.has(s.id)} onOpen={onSelect} />
    : <SellerOwnerCard s={s} row={row} hasFinancials={hasData} coverUrl={coverUrl} managed={managed.has(s.id)} selected={selected} onSelect={onSelect} className={className} />;
}
