import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Building2, Lock, MapPin, Search, Store, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useHasSession } from "@/hooks/use-has-session";
import { useIsMobile } from "@/hooks/use-mobile";
import { listMarketplaceTeasers } from "@/lib/hidden-profiles.functions";
import { useMyVerification } from "@/components/marketplace/buyer-verification";
import { PublicListingCard, CoverView } from "@/components/hidden-profile/public-listing-card";
import type { PublicListing } from "@/lib/public-listing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marketplace/browse")({
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
  component: BrowseListingsPage,
});

type Teaser = {
  id: string;
  listing: PublicListing;
  dealType?: string | null;
  askingPrice?: number | null;
  stakePct?: number | null;
};

const SAVED_KEY = "ps.savedListings";

function useSavedListings() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setIds(JSON.parse(raw) as string[]);
    } catch {
      /* noop */
    }
  }, []);
  const toggle = (id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };
  return { ids: new Set(ids), toggle };
}

/** Save + Request NDA — the only actions a buyer has on a listing. */
function ListingActions({ id, saved, onSave }: { id: string; saved: boolean; onSave: (id: string) => void }) {
  const { data } = useMyVerification();
  const locked = !data?.verified;
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onSave(id)}
        className={cn(
          "inline-flex h-[34px] items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
          saved ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-background text-foreground hover:bg-muted",
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-accent")} />
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        disabled={locked}
        title={locked ? "Submit for verification on My Profile first" : undefined}
        onClick={() => toast.success("NDA request sent for review.")}
        className="h-[34px] rounded-md bg-accent text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
      >
        {locked ? "Available after verification" : "Request NDA"}
      </button>
    </div>
  );
}

function GridCard({ t, saved, onSave, onOpen }: { t: Teaser; saved: boolean; onSave: (id: string) => void; onOpen: () => void }) {
  const l = t.listing;
  return (
    <div className="flex h-full min-h-[453px] flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
      <CoverView cover={l.coverImage} fallbackArt={l.coverArt ?? l.sector} className="h-[120px] w-full shrink-0">
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground">
          <Lock className="h-3 w-3" />Identity hidden
        </span>
      </CoverView>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-[15.5px] font-semibold text-foreground">{l.codeName}</div>
          <div className="truncate text-[12px] text-muted-foreground">{[l.refNo, l.location].filter(Boolean).join(" · ")}</div>
        </div>
        <p className="line-clamp-2 text-[13px] font-medium text-foreground">{l.headline}</p>
        <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{l.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {[l.sector, t.dealType, ...l.productTags.slice(0, 2)].filter(Boolean).map((tag) => (
            <span key={tag as string} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{tag as string}</span>
          ))}
        </div>
        <div className="space-y-2 border-t border-border pt-3 text-[13px]">
          {[
            { label: "Revenue", value: l.revenueBand ?? "—" },
            { label: "Asking", value: t.askingPrice == null ? "On request" : `฿${t.askingPrice}M` },
            { label: "Stake", value: t.stakePct != null ? `${t.stakePct}%` : "—" },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto space-y-2">
          <button type="button" onClick={onOpen} className="h-[34px] w-full rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted">
            View listing
          </button>
          <ListingActions id={t.id} saved={saved} onSave={onSave} />
        </div>
      </div>
    </div>
  );
}

function SplitRow({ t, selected, onSelect }: { t: Teaser; selected: boolean; onSelect: () => void }) {
  const l = t.listing;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-[14px] border bg-card p-4 text-left shadow-card",
        selected ? "border-accent" : "border-border",
      )}
    >
      <div className="truncate text-[15.5px] font-semibold text-foreground">{l.codeName}</div>
      <div className="truncate text-[12px] text-muted-foreground">{[l.refNo, l.sector].filter(Boolean).join(" · ")}</div>
      <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{l.headline}</p>
      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{l.location ?? "—"}</span>
        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{l.revenueBand ?? "—"}</span>
      </div>
    </button>
  );
}

function BrowseListingsPage() {
  const fn = useServerFn(listMarketplaceTeasers);
  const enabled = useHasSession();
  const { data, isLoading } = useQuery({ queryKey: ["marketplace-teasers"], queryFn: () => fn(), enabled });
  const teasers = (data ?? []) as Teaser[];

  const { view, persist } = usePersistentView("ps-browse-view", undefined);
  const isMobile = useIsMobile();
  const { ids: savedIds, toggle: toggleSave } = useSavedListings();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [deal, setDeal] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);

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

  const current = items.find((t) => t.id === selected) ?? null;
  const modal = teasers.find((t) => t.id === modalId) ?? null;
  const hasFilter = !!q || sector !== "all" || deal !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Store className="h-3.5 w-3.5" /> Discover
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Browse listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length > 0 ? `${items.length} live listing${items.length === 1 ? "" : "s"}` : "Approved businesses appear here."}
          </p>
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

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

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[453px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Store className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No listings match your filters yet.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <GridCard key={t.id} t={t} saved={savedIds.has(t.id)} onSave={toggleSave} onOpen={() => setModalId(t.id)} />
          ))}
        </div>
      ) : view === "split" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          <div className="h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto pr-1">
            {items.map((t) => (
              <SplitRow
                key={t.id}
                t={t}
                selected={selected === t.id}
                onSelect={() => (isMobile ? setModalId(t.id) : setSelected(t.id))}
              />
            ))}
          </div>
          <div className="hidden min-w-0 self-start rounded-lg border border-border bg-card p-6 shadow-sm lg:sticky lg:top-4 lg:block">
            {current ? (
              <div className="space-y-4">
                <PublicListingCard l={current.listing} />
                <ListingActions id={current.id} saved={savedIds.has(current.id)} onSave={toggleSave} />
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Select a listing to see the details.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{t.listing.codeName}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {[t.listing.refNo, t.listing.sector, t.listing.location, t.listing.revenueBand].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button type="button" onClick={() => setModalId(t.id)} className="h-[34px] rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
                View listing
              </button>
              <div className="w-[320px] shrink-0">
                <ListingActions id={t.id} saved={savedIds.has(t.id)} onSave={toggleSave} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!modalId} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[820px]">
          {modal && (
            <div className="space-y-4">
              <PublicListingCard l={modal.listing} />
              <ListingActions id={modal.id} saved={savedIds.has(modal.id)} onSave={toggleSave} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
