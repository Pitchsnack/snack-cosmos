import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Search, Store, X } from "lucide-react";
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
import { InvestorBrowse } from "@/components/marketplace/investor-browse";
import { usePersona } from "@/hooks/use-marketplace";
import { PublicListingCard } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
import type { PublicListing } from "@/lib/public-listing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marketplace/browse")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : undefined,
  }),
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
  return <BrowseListingsPage ownOnly={persona === "seller" ? (company ?? null) : null} />;
}


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
      <LowerPanel t={t} />
    </div>
  );
}

type NdaStatus = "none" | "requested" | "approved" | "exchanged";

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== "");
  return <>{shown.map(([k, v]) => <Row key={k} k={k} v={v} />)}</>;
}

function LowerPanel({ t }: { t: Teaser }) {
  const l = t.listing;
  const x = t as Teaser & {
    reason?: string | null; ndaCount?: number | null; loiCount?: number | null;
    growthBand?: string | null; ebitdaMargin?: string | null; netCash?: string | null; ndaStatus?: NdaStatus;
  };
  const status: NdaStatus = x.ndaStatus ?? "none";
  const interest = x.ndaCount != null || x.loiCount != null
    ? [x.ndaCount != null && `${x.ndaCount} NDAs`, x.loiCount != null && `${x.loiCount} LOIs`].filter(Boolean).join(" · ")
    : null;
  const unlock = [
    "Company name & logo",
    "website & contacts",
    (l as { people?: string[] }).people?.length !== 0 && "founder names",
    l.hasFinancials && "exact financials FY23–25",
    "valuation report",
    "data room",
  ].filter(Boolean).join(" · ");
  const step = { none: 0, requested: 1, approved: 2, exchanged: 3 }[status];
  const subs = [status === "none" ? "You are here" : "", status === "requested" ? "waiting for the seller" : "usually 2 days", "identity, financials, data room", "talk directly"];
  const card = "rounded-[12px] border border-border px-[14px] py-3";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={card}>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deal terms</h4>
          <KV rows={[
            ["Stake offered", t.stakePct != null ? `${t.stakePct}%` : null],
            ["Asking price", t.askingPrice == null ? "On request" : `฿${t.askingPrice}M`],
            ["Deal type", t.dealType ?? null],
            ["Reason", x.reason ?? null],
            ["Buyer interest", interest],
          ]} />
        </div>
        <div className={card}>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Financials · ranges before NDA</h4>
          <KV rows={[
            ["Revenue FY25", l.revenueBand],
            ["Growth", x.growthBand ?? null],
            ["EBITDA margin", x.ebitdaMargin ?? null],
            ["Net cash", x.netCash ?? null],
            ["Verified by", l.hasFinancials
              ? <span className="text-[#16A34A]">✓ PitchSnack analysts</span>
              : <span className="font-normal text-muted-foreground">Seller-provided, not verified</span>],
          ]} />
        </div>
      </div>

      {status === "approved" || status === "exchanged" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#86EFAC] bg-[#F0FDF4] px-[14px] py-3">
          <div className="text-sm font-bold text-[#166534]">NDA approved · full profile unlocked</div>
          <Button size="sm">Open full profile</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#FCD34D] bg-[#FFFBEB] px-[14px] py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#78350F]">Request the NDA to unlock</div>
            <p className="mt-0.5 text-[12.5px] text-[#92400E]">{unlock}</p>
          </div>
          <NdaButton />
        </div>
      )}

      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">How it works</h4>
        <ol className="relative grid grid-cols-4">
          <span className="absolute left-[12.5%] right-[12.5%] top-[7px] h-[2px] bg-[#E5E7EB]" />
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex flex-col items-center text-center">
              <span className={cn(
                "h-4 w-4 rounded-full",
                i < step && "bg-[#9CA3AF]",
                i === step && "bg-[#6D28D9] ring-4 ring-[#6D28D9]/20",
                i > step && "border-2 border-[#D1D5DB] bg-card",
              )} />
              <span className={cn("mt-2 text-[12.5px]", i === step ? "font-bold" : "text-foreground/80")}>{s}</span>
              {subs[i] && <span className="text-[11px] text-muted-foreground">{subs[i]}</span>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function BrowseListingsPage({ ownOnly }: { ownOnly?: string | null }) {
  const fn = useServerFn(listMarketplaceTeasers);
  const enabled = useHasSession();
  const { data, isLoading } = useQuery({ queryKey: ["marketplace-teasers"], queryFn: () => fn(), enabled });
  const all = (data ?? []) as Teaser[];
  const teasers = ownOnly ? all.filter((t) => t.id === ownOnly) : all;

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
