import { StandardListingCard } from "@/components/marketplace/standard-listing-card";
import { ManagedBadge } from "@/components/common/managed-badge";
import { PRICE_BANDS, bandInText } from "@/lib/asking-price";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, LockOpen, Search, Star, Store, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useHasSession } from "@/hooks/use-has-session";
import { listMarketplaceTeasers } from "@/lib/hidden-profiles.functions";
import { myNdaRequestDates } from "@/lib/pipeline.functions";
import { markListingViewed } from "@/lib/invitations.functions";
import { InvitedYouChip, NdaSentDialog, useInvitedListings, type NdaSent } from "@/components/marketplace/buyer-invitations";
import { ListingDetail, NdaApprovedBadge, NdaButton, NdaRequestedBadge, SaveButton, useNdaStatuses, useSavedListings, type Teaser } from "@/components/marketplace/listing-panel";
import { InvestorBrowse } from "@/components/marketplace/investor-browse";
import { AdvisorBrowse } from "@/components/marketplace/advisor-marketplace";
import { usePersona } from "@/hooks/use-marketplace";
import { ListingPill, PublicListingCard } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";
import { ClosedListingCard } from "@/components/marketplace/plan-strip";
import { BrowseHeader, FilterPill, MatchBox, MatchTag, NdaInfoStrip, PlanEndedBar, useBrowseMatches } from "@/components/marketplace/browse-header";
import type { ClosedTeaser } from "@/lib/hidden-profiles.functions";

export const Route = createFileRoute("/_authenticated/marketplace/browse")({
  validateSearch: (search: Record<string, unknown>): { company?: string } =>
    typeof search.company === "string" ? { company: search.company } : {},
  head: () => ({
    meta: [
      { title: "Browse listings — PitchSnack" },
      { name: "description", content: "Browse anonymous business listings approved for the PitchSnack marketplace." },
      { property: "og:title", content: "Browse listings — PitchSnack" },
      { property: "og:description", content: "Browse anonymous business listings approved for the PitchSnack marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrowseRoute,
});

/** Buyers browse every live listing; sellers browse investors, and only ever see their own listing. */
function BrowseRoute() {
  const { persona } = usePersona();
  const { company } = Route.useSearch();
  if (persona === "advisor") return <AdvisorBrowse />;
  if (persona === "seller" && !company) return <InvestorBrowse />;
  if (persona === "seller") return <BrowseListingsPage ownOnly={company ?? null} />;
  // A buyer's direct link only opens the listing when it is approved and live.
  return <BrowseListingsPage directId={company ?? null} />;
}


function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1100px)");
    const f = () => setWide(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return wide;
}

function BrowseListingsPage({ ownOnly, directId }: { ownOnly?: string | null; directId?: string | null }) {
  const { t } = useTranslation();
  const fn = useServerFn(listMarketplaceTeasers);
  const enabled = useHasSession();
  const buyer = !ownOnly;
  const { data, isLoading } = useQuery({ queryKey: ["marketplace-teasers", buyer ? "buyer" : "own"], queryFn: () => fn({ data: { excludeNda: false } }), enabled });
  const { data: ndaMap } = useNdaStatuses();
  const ndaOf = (id: string): "requested" | "approved" | null => {
    if (!buyer) return null;
    const v = ndaMap?.[id];
    return v === "requested" ? "requested" : v === "approved" || v === "exchanged" ? "approved" : null;
  };
  // After Request NDA the listing stays in Browse, marked NDA requested.
  const [sent, setSent] = useState<NdaSent | null>(null);
  const onRequested = (id: string, info?: { invitationId: string | null }) => {
    const item = all.find((x) => x.id === id);
    setModalId(null);
    setSent({ listingId: id, name: item?.listing.codeName || item?.listing.refNo || t("This listing"), invitationId: info?.invitationId ?? null, saved: savedIds.has(id) });
  };
  const invited = useInvitedListings();
  const star = (id: string) => <SaveButton square nda={!!ndaOf(id)} saved={savedIds.has(id)} onClick={() => toggleSave(id)} />;
  const badgeOf = (id: string) => { const n = ndaOf(id); return n === "approved" ? <NdaApprovedBadge /> : n === "requested" ? <NdaRequestedBadge /> : buyer && invited.has(id) ? <InvitedYouChip /> : undefined; };
  const raw = (data ?? []) as Array<Teaser | ClosedTeaser>;
  const closedItems = buyer ? (raw.filter((x) => "closed" in x) as ClosedTeaser[]) : [];
  const all = raw.filter((x) => !("closed" in x)) as Teaser[];
  const focus = ownOnly ?? directId ?? null;
  const teasers = focus ? all.filter((t) => t.id === focus) : all;

  const { view, persist } = usePersistentView("ps-browse-view", undefined);
  const { ids: savedIds, toggle: toggleSave } = useSavedListings();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [deal, setDeal] = useState("all");
  const [price, setPrice] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wide = useWide();

  const sectors = useMemo(
    () => Array.from(new Set(teasers.map((t) => t.listing.sector).filter(Boolean) as string[])).sort(),
    [teasers],
  );
  const dealTypes = useMemo(
    () => Array.from(new Set(teasers.map((t) => t.dealType).filter(Boolean) as string[])).sort(),
    [teasers],
  );

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teasers.filter((t) => {
      const l = t.listing;
      if (sector !== "all" && l.sector !== sector) return false;
      if (deal !== "all" && t.dealType !== deal) return false;
      // The range comes from the server; listings without a price show only with Any asking price.
      if (price !== "all" && t.priceBand?.key !== price) return false;
      if (!needle) return true;
      return [l.codeName, l.refNo, l.headline, l.description, l.location, l.sector, ...l.productTags, ...l.marketTags]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [teasers, q, sector, deal, price]);

  const current = items.find((t) => t.id === selected) ?? items[0] ?? null;
  const modal = teasers.find((t) => t.id === modalId) ?? null;
  const hasFilter = !!q || sector !== "all" || deal !== "all" || price !== "all";
  const th = useTranslation().language === "th";
  const matches = useBrowseMatches();
  const tagOf = (id: string) => (buyer && matches[id] ? <MatchTag side="buyer" /> : undefined);

  const listRef = useRef<HTMLDivElement>(null);
  const splitFixed = wide && (ownOnly || view === "split") && !isLoading && items.length > 0;
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [q, sector, deal, price]);

  return (
    <div className={splitFixed ? "flex h-[calc(100vh-7.5rem)] min-h-[520px] flex-col gap-6 [&>*]:shrink-0" : "space-y-6"}>
      {ownOnly ? (
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Store className="h-3.5 w-3.5" /> {t("My listing")}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("My company on the Marketplace")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("This is exactly how buyers see your company. Other companies are not shown here.")}</p>
        </div>
      ) : (
        <div>
          <BrowseHeader role="buyer" eyebrow={<><Store className="h-3.5 w-3.5" /> {t("Discover")}</>} title={t("Browse listings")}
            toggle={<ViewToggle value={view} onChange={persist} />}
            q={q} setQ={setQ} placeholder={th ? "ค้นหากิจการ" : "Search listings"}
            hasFilters={hasFilter} onClear={() => { setQ(""); setSector("all"); setDeal("all"); setPrice("all"); }}
            count={th ? `แสดง ${items.length} รายการ` : `Showing ${items.length} listing${items.length === 1 ? "" : "s"}`}
            filters={<>
              <FilterPill label={t("All sectors")} value={sector} onChange={setSector} options={sectors.map((x) => ({ value: x, label: x }))} />
              <FilterPill label={t("All deal types")} value={deal} onChange={setDeal} options={dealTypes.map((x) => ({ value: x, label: x }))} />
              <FilterPill label={th ? "ทุกช่วงราคา" : "Any asking price"} value={price} onChange={setPrice}
                options={PRICE_BANDS.map((b) => ({ value: b.key, label: th ? `ราคา ${b.th}` : `Price ${bandInText(b.label)}` }))} />
            </>} />
          <div className="mt-[18px] empty:hidden"><PlanEndedBar /></div>
          <NdaInfoStrip role="buyer" />
        </div>
      )}

      {isLoading ? (
        <div className="standard-card-grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[453px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Store className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>{ownOnly ? t("Your company is not live on the Marketplace yet.") : directId ? t("This listing isn't available.") : hasFilter ? t("No listings match your filters yet.") : t("Approved businesses appear here.")}</p>
        </div>
      ) : !ownOnly && view === "grid" ? (
        <div className="standard-card-grid">
          {items.map((t) => (
            <div key={t.id} data-flight-src={t.id}><StandardListingCard tag={tagOf(t.id)} l={t.listing} deal={t} status={ndaOf(t.id)} onSelect={() => setModalId(t.id)} topRight={star(t.id)} /></div>
          ))}
          {!hasFilter && closedItems.map((c) => <ClosedListingCard key={c.id} c={c} star={star(c.id)} />)}
        </div>
      ) : ownOnly || view === "split" ? (
        <div className={splitFixed ? "!shrink grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)] gap-[18px]" : "grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]"}>
          <div ref={listRef} className={splitFixed ? "min-h-0 space-y-3 overflow-y-scroll pr-2 [scrollbar-gutter:stable]" : "space-y-3"}>
            {items.map((t) => (
              <div key={t.id} data-flight-src={t.id}><StandardListingCard
                tag={tagOf(t.id)}
                l={t.listing}
                deal={t}
                selected={wide && current?.id === t.id}
                onSelect={() => { if (wide) setSelected(t.id); else setModalId(t.id); }}
                status={ndaOf(t.id)}
                topRight={ownOnly ? undefined : star(t.id)}
              /></div>
            ))}
            {!hasFilter && closedItems.map((c) => <ClosedListingCard key={c.id} c={c} star={star(c.id)} />)}
          </div>
          {wide && (
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {current ? (
                <BrowsePanel match={buyer ? matches[current.id] : undefined} t={current} ownOnly={!!ownOnly} invited={buyer && invited.has(current.id)} nda={ndaOf(current.id)} saved={savedIds.has(current.id)} onToggleSave={() => toggleSave(current.id)} onRequested={onRequested} />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">{t("Select a listing to see the details.")}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const l = item.listing;
            return (
              <div key={item.id} data-flight-src={item.id} role="button" tabIndex={0} onClick={() => setModalId(item.id)} onKeyDown={(e) => { if (e.key === "Enter") setModalId(item.id); }}
                className="group flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-all duration-200 hover:border-accent hover:shadow-[var(--shadow-elevated)]">
                <SectorArt src={l.coverUrl} art={l.coverArt ?? l.sector} sector={l.sector} imageId={l.publicImageId} className="h-[54px] w-[96px] shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent">{l.headline || l.codeName}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[l.verified && t("Verified company"), l.hasFinancials && t("Verified financials"), l.revenueBand, l.sector, l.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 max-[639px]:basis-full max-[639px]:justify-end">
                  {tagOf(item.id)}
                  {(() => { const n = ndaOf(item.id); return <ListingPill kind={n ?? "hidden"} newDays={l.newDays} />; })()}
                  {l.managed && <ManagedBadge size="sm" />}
                  {star(item.id)}
                </div>
              </div>
            );
          })}
          {!hasFilter && closedItems.map((c) => <ClosedListingCard key={c.id} c={c} star={star(c.id)} />)}
        </div>
      )}

      <Dialog open={!!modalId} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[820px]">
          {modal && (
            <div className="-m-6 flex flex-col">
              <BrowsePanel match={buyer ? matches[modal.id] : undefined} t={modal} ownOnly={!!ownOnly} invited={buyer && invited.has(modal.id)} nda={ndaOf(modal.id)} saved={savedIds.has(modal.id)} onToggleSave={() => toggleSave(modal.id)} onRequested={onRequested} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {sent && <NdaSentDialog sent={sent} onClose={() => setSent(null)} />}
    </div>
  );
}

function BrowsePanel({ t, ownOnly, nda, saved, onToggleSave, onRequested, match, invited }: {
  invited?: boolean; match?: string[]; t: Teaser; ownOnly: boolean; nda: "requested" | "approved" | null; saved: boolean; onToggleSave: () => void; onRequested: (id: string, info?: { invitationId: string | null }) => void;
}) {
  const { t: tr } = useTranslation();
  const datesFn = useServerFn(myNdaRequestDates);
  const { data: dates } = useQuery({ queryKey: ["pipeline", "nda-dates"], queryFn: () => datesFn(), enabled: nda === "requested" });
  const d = dates?.[t.id];
  const viewFn = useServerFn(markListingViewed);
  const qc = useQueryClient();
  // Opening the listing counts as viewing its invitation.
  useEffect(() => { if (invited && !ownOnly) viewFn({ data: { listingId: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["invitations"] })); }, [t.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const when = d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : null;
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3 pr-12">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold">{[t.listing.codeName, t.listing.refNo].filter(Boolean).join(" · ")}</span>
          {nda === "requested" && <NdaRequestedBadge />}
          {nda === "approved" && <NdaApprovedBadge />}
          {!nda && invited && <InvitedYouChip />}
        </div>
        {ownOnly ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{tr("Buyer preview")}</span>
        ) : nda === "requested" ? (
          <Button asChild variant="outline" size="sm" className="shrink-0"><Link to="/marketplace/favourites" search={{ id: t.id }}><Star className="mr-1.5 h-4 w-4" />{tr("Open in My watchlist")}</Link></Button>
        ) : nda === "approved" ? (
          <Button asChild size="sm" className="shrink-0"><Link to="/marketplace/favourites" search={{ id: t.id }}><LockOpen className="mr-1.5 h-4 w-4" />{tr("Open private view")}</Link></Button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <SaveButton saved={saved} onClick={onToggleSave} />
            <NdaButton listingId={t.id} onRequested={onRequested} />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {nda === "requested" && (
          <div className="flex items-start gap-2 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-[14px] py-[11px] text-[13.5px] text-[#92400E]">
            <Clock className="mt-0.5 h-4 w-4 flex-none" />
            <span>{tr("You requested the NDA")}{when ? ` ${tr("on")} ${when}` : ""}. {tr("This listing is in My watchlist, and its private view opens there once the seller approves.")}</span>
          </div>
        )}
        {nda === "approved" && (
          <div className="flex items-start gap-2 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-[14px] py-[11px] text-[13.5px] text-[#166534]">
            <Star className="mt-0.5 h-4 w-4 flex-none" />
            <span>{tr("Your NDA is approved. This listing is in your Favourites, where its private view shows the company’s name and exact figures.")}</span>
          </div>
        )}
        {match && <MatchBox side="buyer" criteria={match} />}
        <ListingDetail t={t} requested={nda === "requested"} approved={nda === "approved"} onRequested={onRequested} />
      </div>
    </>
  );
}
