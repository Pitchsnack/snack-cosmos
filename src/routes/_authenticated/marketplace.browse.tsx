import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Lock, Search, Store, X } from "lucide-react";
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
import { useMyVerification } from "@/components/marketplace/buyer-verification";
import { PublicListingCard } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
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
function SaveButton({ saved, onClick, square }: { saved: boolean; onClick: () => void; square?: boolean }) {
  return (
    <button
      type="button"
      aria-label={saved ? "Saved" : "Save"}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border text-sm font-medium transition-colors",
        square ? "h-[30px] w-[30px] rounded-md border-border bg-background" : "h-[34px] rounded-md px-3",
        !square && (saved ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-background text-foreground hover:bg-muted"),
      )}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-accent text-accent")} />
      {!square && (saved ? "Saved" : "Save")}
    </button>
  );
}

function NdaButton({ className }: { className?: string }) {
  const { data } = useMyVerification();
  const locked = !data?.verified;
  return (
    <button
      type="button"
      disabled={locked}
      title={locked ? "Submit for verification on My Profile first" : undefined}
      onClick={(e) => { e.stopPropagation(); toast.success("NDA request sent for review."); }}
      className={cn("h-[34px] rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60", className)}
    >
      {locked ? "Available after verification" : "Request NDA"}
    </button>
  );
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-[13px] last:border-0">
      <span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span>
    </div>
  );
}

const AFTER_NDA = ["Company name & logo", "Website & contacts", "Founder names", "Exact financials FY23–25", "Valuation report", "Data room"];
const STEPS = ["Request NDA", "Seller approves", "Full access", "Exchange contact"];

/** Right panel body — everything comes from the public read model only. */
function ListingDetail({ t }: { t: Teaser }) {
  const l = t.listing;
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [t.id]);
  return (
    <div className="space-y-5">
      <PublicListingCard l={l} deal={t} />
      {l.description && (
        <Section title="Business overview">
          <p className={cn("text-[13.5px] text-foreground/80", !more && "line-clamp-3")}>{l.description}</p>
          <button type="button" onClick={() => setMore((m) => !m)} className="text-[12.5px] font-semibold hover:underline">{more ? "Show less ▴" : "Show more ▾"}</button>
        </Section>
      )}
      <Section title="Deal terms">
        <div className="rounded-lg border border-border px-3">
          <Row k="Stake offered" v={t.stakePct != null ? `${t.stakePct}%` : "—"} />
          <Row k="Asking price" v={t.askingPrice == null ? "On request" : `฿${t.askingPrice}M`} />
          <Row k="Deal type" v={t.dealType ?? "—"} />
        </div>
      </Section>
      <Section title="Financial snapshot · ranges before NDA">
        <div className="rounded-lg border border-border px-3">
          <Row k="Revenue FY25" v={l.revenueBand ?? "—"} />
          <Row k="Verified financials" v={l.hasFinancials ? "Yes" : "Not yet"} />
          <Row k="Full report" v="After NDA" />
        </div>
      </Section>
      <Section title="Shown after you sign the NDA">
        <div className="flex flex-wrap gap-1.5">
          {AFTER_NDA.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 text-[11.5px] font-semibold text-[#92400E]"><Lock className="h-3 w-3" />{x}</span>
          ))}
        </div>
      </Section>
      <Section title="How it works">
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-lg border border-border p-2.5 text-[12.5px]">
              <span className="mb-1 grid h-5 w-5 place-items-center rounded-full bg-muted text-[11px] font-bold">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function BrowseListingsPage() {
  const fn = useServerFn(listMarketplaceTeasers);
  const enabled = useHasSession();
  const { data, isLoading } = useQuery({ queryKey: ["marketplace-teasers"], queryFn: () => fn(), enabled });
  const teasers = (data ?? []) as Teaser[];

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

  const current = items.find((t) => t.id === selected) ?? items[0] ?? null;
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
            <PublicListingCard key={t.id} l={t.listing} deal={t} onSelect={() => setModalId(t.id)}
              topRight={<SaveButton square saved={savedIds.has(t.id)} onClick={() => toggleSave(t.id)} />} />
          ))}
        </div>
      ) : view === "split" ? (
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
                onSelect={() => (wide ? setSelected(t.id) : setModalId(t.id))}
                topRight={<SaveButton square saved={savedIds.has(t.id)} onClick={() => toggleSave(t.id)} />}
              />
            ))}
          </div>
          {wide && (
            <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {current ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                    <span className="min-w-0 truncate text-sm font-semibold">{[current.listing.codeName, current.listing.refNo].filter(Boolean).join(" · ")}</span>
                    <div className="flex shrink-0 gap-2">
                      <SaveButton saved={savedIds.has(current.id)} onClick={() => toggleSave(current.id)} />
                      <NdaButton />
                    </div>
                  </div>
                  <div className="overflow-y-auto p-5"><ListingDetail t={current} /></div>
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
                <NdaButton />
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
                <NdaButton />
              </div>
              <ListingDetail t={modal} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
