import { StandardInvestorCard } from "@/components/marketplace/standard-investor-card";
import { InvestorBrowseListRow } from "@/components/marketplace/browse-list-rows";
import { useBuyerInvestor } from "@/components/my-business/buyer-private-view";
import { useManagedIds } from "@/hooks/use-managed-ids";
import { bandText, sortActsFor, typeName } from "@/lib/investor-bands";
import { buyerOwnerStatus } from "@/lib/owner-status";
import type { BuyerOrg, BuyerProfile } from "@/lib/buyer-profile";
import type { PublicInvestor } from "@/lib/investor-browse";
import type { Data } from "@/components/my-business/buyer-investor-edit";

type BuyerWithPublished = BuyerProfile & {
  approval_status?: string | null;
  published_listing_name?: string | null;
  published_headline?: string | null;
  published_headline_th?: string | null;
};

/** Owner preview of the same public DTO sellers receive, but from the latest authorised draft. */
export function buyerOwnerInvestor(p: BuyerProfile, org: BuyerOrg, d?: Data, managed = false): PublicInvestor {
  const iv = d?.investor;
  const bp = d?.buyer;
  const old = p as BuyerWithPublished;
  const relation = bp?.relation ?? null;
  const actsFor = relation === "agent" ? sortActsFor(iv?.acts_for_types ?? []) : [];
  const type = org.type ?? iv?.investor_type ?? null;
  const approval = bp?.approval_status ?? old.approval_status;
  const pendingEdits = p.status === "live" && (approval === "in_review" || approval === "changes_requested");
  const adminWant = bp?.published_headline || old.published_headline || null;
  const ownWant = bp?.suggested_headline || p.suggested_headline || null;
  const adminWantTh = bp?.published_headline_th || old.published_headline_th || null;
  const ownWantTh = bp?.suggested_headline_th || p.suggested_headline_th || null;
  const publishedHeadline = (pendingEdits ? ownWant || adminWant : adminWant || ownWant) || null;
  const publishedHeadlineTh = (pendingEdits ? ownWantTh || adminWantTh : adminWantTh || ownWantTh) || null;
  return {
    id: iv?.id ?? p.user_id,
    refNo: p.ref_no || bp?.ref_no || "",
    codeName: typeName(type, actsFor),
    publishedListingName: (pendingEdits ? bp?.suggested_listing_name || bp?.published_listing_name || old.published_listing_name : bp?.published_listing_name || old.published_listing_name || bp?.suggested_listing_name) || null,
    publishedHeadline,
    publishedHeadlineTh,
    name: null,
    type,
    city: p.city ?? iv?.city ?? null,
    country: p.country ?? iv?.country ?? null,
    description: p.description,
    descriptionTh: p.description_th,
    sectors: iv?.preferred_industries ?? p.sectors,
    stages: iv?.preferred_stages ?? p.stages,
    dealTypes: bp?.deal_types ?? p.deal_types,
    geography: p.geography || (iv?.investment_focus_raw ?? []).join(", ") || null,
    verified: org.verified,
    proofOfFunds: !!p.pof_verified_at,
    aumBand: iv?.aum_band ?? null,
    ticketBand: iv?.ticket_band ?? null,
    revBand: iv?.revenue_min_band ?? null,
    relation,
    actsFor,
    aumLabel: bandText(iv?.aum_band),
    ticketLabel: bandText(iv?.ticket_band),
    revLabel: bandText(iv?.revenue_min_band),
    managed,
  };
}

export function BuyerOwnerCard({ p, org, d, managed = false, selected, onClick, className }: {
  p: BuyerProfile;
  org: BuyerOrg;
  d?: Data;
  managed?: boolean;
  selected?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return <StandardInvestorCard i={buyerOwnerInvestor(p, org, d, managed)} ownerStatus={buyerOwnerStatus({ ...p, approval_status: d?.buyer.approval_status ?? (p as BuyerWithPublished).approval_status })}
    selected={selected} onClick={onClick} className={className} />;
}

export function BuyerOwnerListRow({ p, org, d, managed = false, onOpen }: {
  p: BuyerProfile;
  org: BuyerOrg;
  d?: Data;
  managed?: boolean;
  onOpen: () => void;
}) {
  return <InvestorBrowseListRow i={buyerOwnerInvestor(p, org, d, managed)} ownerStatus={buyerOwnerStatus({ ...p, approval_status: d?.buyer.approval_status ?? (p as BuyerWithPublished).approval_status })} onOpen={onOpen} />;
}

/** Hook boundary shared by the primary buyer profile and Control's authorised extra profiles. */
export function BuyerOwnerCardData({ p, org, d, mode, selected = false, onClick, className }: {
  p: BuyerProfile;
  org: BuyerOrg;
  d?: Data;
  mode: "grid" | "split" | "list";
  selected?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const own = useBuyerInvestor();
  const data = d ?? own.data;
  const id = data?.investor.id;
  const managedIds = useManagedIds("investor", [id]);
  const managed = managedIds.has(id ?? "");
  return mode === "list"
    ? <BuyerOwnerListRow p={p} org={org} d={data} managed={managed} onOpen={onClick} />
    : <BuyerOwnerCard p={p} org={org} d={data} managed={managed} selected={selected} onClick={onClick} className={className} />;
}
