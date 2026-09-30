import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Search, Star, Store, X } from "lucide-react";
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
import { favouritesNdaCount } from "@/lib/favourites.functions";
import { ListingDetail, NdaButton, SaveButton, useSavedListings, type Teaser } from "@/components/marketplace/listing-panel";
import { InvestorBrowse } from "@/components/marketplace/investor-browse";
import { usePersona } from "@/hooks/use-marketplace";
import { PublicListingCard } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
import { cn } from "@/lib/utils";

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
  if (persona === "seller" && !company) return <InvestorBrowse />;
  if (persona === "seller") return <BrowseListingsPage ownOnly={company ?? null} />;
  // A buyer's direct link only opens the listing when it is approved and live.
  return <BrowseListingsPage directId={company ?? null} />;
}


function BrowseListingsPage({ ownOnly, directId }: { ownOnly?: string | null; directId?: string | null }) {
  const fn = useServerFn(listMarketplaceTeasers);
  const enabled = useHasSession();
  const buyer = !ownOnly;
  const { data, isLoading } = useQuery({ queryKey: ["marketplace-teasers", buyer ? "buyer" : "own"], queryFn: () => fn({ data: { excludeNda: buyer && !directId } }), enabled });
  const countFn = useServerFn(favouritesNdaCount);
  const { data: favCount = 0 } = useQuery({ queryKey: ["favourites", "nda-count"], queryFn: () => countFn(), enabled: enabled && buyer });
  // After Request NDA the listing moves to Favourites; the panel confirms it.
  const [moved, setMoved] = useState<{ id: string; codeName: string } | null>(null);
  const onRequested = (id: string) => {
    const t = all.find((x) => x.id === id);
    const codeName = t?.listing.codeName || t?.listing.refNo || "This listing";
    setMoved({ id, codeName });
    setModalId(null);
    toast.success(`NDA requested. ${codeName} moved to Favourites.`);
  };
  const all = (data ?? []) as Teaser[];
  const focus = ownOnly ?? directId ?? null;
  const teasers = focus ? all.filter((t) => t.id === focus) : all;

  const { view, persist } = usePersistentView("ps-browse-view", undefined);
  const { ids: savedIds, toggle: toggleSave } = useSavedListings();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [deal, setDeal] = useState("all");
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
      if (!needle) return true;
      return [l.codeName, l.refNo, l.headline, l.description, l.location, l.sector, ...l.productTags, ...l.marketTags]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [teasers, q, sector, deal]);

  const current = moved ? null : items.find((t) => t.id === selected) ?? items[0] ?? null;
  const modal = teasers.find((t) => t.id === modalId) ?? null;
  const hasFilter = !!q || sector !== "all" || deal !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Store className="h-3.5 w-3.5" /> {ownOnly ? "My listing" : "Discover"}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{ownOnly ? "My company on the Marketplace" : "Browse listings"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ownOnly
              ? "This is exactly how buyers see your company. Other companies are not shown here."
              : items.length > 0 ? `${items.length} live listing${items.length === 1 ? "" : "s"}` : "Approved businesses appear here."}
          </p>
        </div>
        {!ownOnly && <ViewToggle value={view} onChange={persist} />}
      </div>

      {!ownOnly && (
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings" className="pl-9" />
        </div>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Sector" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deal} onValueChange={setDeal}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Deal type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All deal types</SelectItem>
            {dealTypes.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setSector("all"); setDeal("all"); }}>
            <X className="mr-1 h-4 w-4" />Clear
          </Button>
        )}
      </div>
      )}


      {buyer && !directId && favCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E0E7FF] bg-[#F5F7FF] px-[14px] py-2.5 text-[13.5px] text-[#374151]">
          <Star className="h-4 w-4 text-[#4338CA]" />
          <span className="min-w-0 flex-1">{favCount === 1 ? "1 listing you requested an NDA for is in Favourites." : `${favCount} listings you requested an NDA for are in Favourites.`}</span>
          <Link to="/marketplace/favourites" className="text-[13.5px] font-semibold text-[#2563EB] hover:underline">Open Favourites →</Link>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[453px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Store className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>{ownOnly ? "Your company is not live on the Marketplace yet." : directId ? "This listing isn't available." : hasFilter ? "No listings match your filters yet." : "Approved businesses appear here."}</p>
        </div>
      ) : !ownOnly && view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <PublicListingCard key={t.id} l={t.listing} deal={t} onSelect={() => setModalId(t.id)}
              topRight={<SaveButton square saved={savedIds.has(t.id)} onClick={() => toggleSave(t.id)} />} />
          ))}
        </div>
      ) : ownOnly || view === "split" ? (
        <div className="grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-3">
            {items.map((t) => (
              <PublicListingCard
                key={t.id}
                l={t.listing}
                deal={t}
                expanded={expandedId === t.id}
                onToggleExpand={() => setExpandedId((e) => (e === t.id ? null : t.id))}
                selected={wide && current?.id === t.id}
                onSelect={() => { setMoved(null); if (wide) setSelected(t.id); else setModalId(t.id); }}
                topRight={ownOnly ? undefined : <SaveButton square saved={savedIds.has(t.id)} onClick={() => toggleSave(t.id)} />}
              />
            ))}
          </div>
          {wide && (
            <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {moved ? (
                <div className="flex flex-col items-center px-8 py-16 text-center">
                  <div className="grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#ECFDF3]"><Check className="h-7 w-7 text-[#16A34A]" /></div>
                  <h2 className="mt-4 text-[21px] font-bold">NDA requested</h2>
                  <p className="mt-2 max-w-[420px] text-[14px] text-[#4B5563]">{moved.codeName} is now in Favourites. The seller usually replies within 2 days, and the private view opens there once they approve.</p>
                  <Button asChild className="mt-5"><Link to="/marketplace/favourites" search={{ id: moved.id }}><Star className="mr-1.5 h-4 w-4" />Open Favourites</Link></Button>
                </div>
              ) : current ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                    <span className="min-w-0 truncate text-sm font-semibold">{[current.listing.codeName, current.listing.refNo].filter(Boolean).join(" · ")}</span>
                    {ownOnly ? (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Buyer preview</span>
                    ) : (
                      <div className="flex shrink-0 gap-2">
                        <SaveButton saved={savedIds.has(current.id)} onClick={() => toggleSave(current.id)} />
                        <NdaButton listingId={current.id} onRequested={onRequested} />
                      </div>
                    )}
                  </div>
                  <div className="overflow-y-auto p-5"><ListingDetail t={current} onRequested={onRequested} /></div>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">Select a listing to see the details.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => {
            const l = t.listing;
            return (
              <div key={t.id} role="button" tabIndex={0} onClick={() => setModalId(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setModalId(t.id); }}
                className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
                <SectorArt art={l.coverArt ?? l.sector} className="h-[54px] w-[96px] shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{l.headline || l.codeName}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[l.verified && "Verified company", l.hasFinancials && "Verified financials", l.revenueBand, l.sector, l.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <SaveButton saved={savedIds.has(t.id)} onClick={() => toggleSave(t.id)} />
                <NdaButton listingId={t.id} onRequested={onRequested} />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!modalId} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[820px]">
          {modal && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2 pr-6">
                <SaveButton saved={savedIds.has(modal.id)} onClick={() => toggleSave(modal.id)} />
                <NdaButton listingId={modal.id} onRequested={onRequested} />
              </div>
              <ListingDetail t={modal} onRequested={onRequested} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
