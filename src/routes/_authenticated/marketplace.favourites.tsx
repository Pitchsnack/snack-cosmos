import { StandardListingCard } from "@/components/marketplace/standard-listing-card";
import {PrivateListingPanel} from "@/components/marketplace/private-listing-panel";
import { ManagedBadge } from "@/components/common/managed-badge";
import { BuyerVerificationBox } from '@/components/company-verification/buyer-box';
import { VerificationBadge } from '@/components/company-verification/verification-badge';
import { AdvisorFavourites } from "@/components/marketplace/advisor-marketplace";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Clock, ExternalLink, LockOpen, Search, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useHasSession } from "@/hooks/use-has-session";
import { PublicListingCard, useMediaUrl } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
import {
  BOX, DealTerms, KV, ListingDetail, NdaButton, NdaRequestedBadge, SaveButton, Section, useInvalidateListings, useSavedListings,
} from "@/components/marketplace/listing-panel";
import { listFavourites, withdrawNdaRequest, type Favourite, type FavStatus } from "@/lib/favourites.functions";
import { useTranslation } from "@/i18n/language";
import { usePersona } from "@/hooks/use-marketplace";
import { SellerFavourites } from "@/components/marketplace/seller-favourites";
import { NdaSentDialog, type NdaSent } from "@/components/marketplace/buyer-invitations";
import { cn } from "@/lib/utils";
import { FavViewCard, FavViewLine, publicStatusSentence, type FavView } from "@/components/marketplace/fav-view-card";
import { BrowseHeader, NdaInfoStrip, PlanEndedBar } from "@/components/marketplace/browse-header";

export const Route = createFileRoute("/_authenticated/marketplace/favourites")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s.id === "string" ? { id: s.id } : {}),
  head: () => ({
    meta: [
      { title: "My watchlist — PitchSnack" },
      { name: "description", content: "Listings you starred or requested an NDA for, with the private view once the seller approves." },
      { property: "og:title", content: "My watchlist — PitchSnack" },
      { property: "og:description", content: "Listings you starred or requested an NDA for, with the private view once the seller approves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavouritesRoute,
});

type Filter = "all" | FavStatus;
const FILTERS: [Filter, string][] = [["all", "All"], ["saved", "My watchlist"], ["requested", "NDA requested"], ["approved", "NDA approved"]];

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");
const baht = (n: number | null) => {
  if (n == null) return null;
  const a = Math.abs(n);
  const s = a >= 1e9 ? `฿${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `฿${(a / 1e6).toFixed(1)}M` : `฿${a.toLocaleString("en-US")}`;
  return n < 0 ? `(${s})` : s;
};
const fy = (y: number | null) => (y != null ? String(y).slice(-2) : "25");

function ApprovedBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-bold text-[#15803D]">
      <LockOpen className="h-3 w-3" />{t("NDA approved")}
    </span>
  );
}

function StarredBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[10.5px] font-bold text-[#374151]">
      <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />{t("Starred")}
    </span>
  );
}

function FavCard({ f, view, open, onView, onOpen, expanded, onToggleExpand, savedIds, toggleSave, reserveTabs }: {
  f: Favourite; view: FavView; open: boolean; onView: (v: FavView) => void; onOpen: (v: FavView) => void;
  expanded?: boolean; onToggleExpand?: () => void; savedIds: Set<string>; toggleSave: (id: string) => void; reserveTabs?: boolean;
}) {
  const p = f.priv;
  const star = <SaveButton square saved={savedIds.has(f.id)} nda={f.status !== "saved"} onClick={() => toggleSave(f.id)} />;
  const publicBody = (
    <StandardListingCard l={f.listing} deal={f} publicOnly status={f.status} onSelect={() => onOpen("public")} topRight={star} />
  );
  const privateBody = p ? (
    <StandardListingCard l={f.listing} deal={f} status={f.status} privateData={p} onSelect={() => onOpen("private")} topRight={star} />
  ) : undefined;
  return (
    <FavViewCard side="buyer" name={p?.companyName ?? f.listing.codeName ?? f.listing.refNo ?? ""} hasPrivate={!!p} view={view} open={open}
      onView={onView} privateBody={privateBody} publicBody={publicBody} reserveTabs={reserveTabs} />
  );
}

function FavouritesRoute() {
  const { persona } = usePersona();
  if (persona === "advisor") return <AdvisorFavourites />;
  return persona === "seller" ? <SellerFavourites /> : <FavouritesPage />;
}

function FavouritesPage() {
  const { t, language } = useTranslation();
  const fn = useServerFn(listFavourites);
  const enabled = useHasSession();
  const { id: wantId } = Route.useSearch();
  const { data, isLoading } = useQuery({ queryKey: ["favourites", "list"], queryFn: () => fn(), enabled });
  const all = useMemo(() => (data ?? []) as Favourite[], [data]);
  const { view, persist } = usePersistentView("ps-favourites-view", undefined);
  const { ids: savedIds, toggle: toggleSave } = useSavedListings();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(wantId ?? null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1100px)");
    const f = () => setWide(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  useEffect(() => { if (wantId) setSelected(wantId); }, [wantId]);

  const counts = useMemo(() => ({
    all: all.length,
    saved: all.filter((f) => f.status === "saved").length,
    requested: all.filter((f) => f.status === "requested").length,
    approved: all.filter((f) => f.status === "approved").length,
  }), [all]);

  const items = useMemo(() => {
    const n = q.trim().toLowerCase();
    return all.filter((f) => {
      if (filter !== "all" && f.status !== filter) return false;
      if (!n) return true;
      const l = f.listing;
      // Company name is only searchable where the server unlocked it.
      return [f.priv?.companyName, l.codeName, l.refNo, l.headline, l.description, l.location, l.sector, ...l.productTags, ...l.marketTags]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(n));
    });
  }, [all, filter, q]);

  const current = items.find((f) => f.id === selected) ?? items[0] ?? null;
  const modal = all.find((f) => f.id === modalId) ?? null;
  const open = (id: string) => (view === "split" && wide ? setSelected(id) : setModalId(id));
  // Each card keeps its front tab while on the page; Exclusive view first.
  const [views, setViews] = useState<Record<string, FavView>>({});
  const viewOf = (f: Favourite): FavView => (f.priv ? views[f.id] ?? "private" : "public");
  const setView = (id: string, v: FavView) => setViews((m) => ({ ...m, [id]: v }));
  const anyTabs = items.some((f) => !!f.priv);

  return (
    <div className="space-y-6">
      <div>
        <BrowseHeader role="buyer" eyebrow={<><Star className="h-3.5 w-3.5" /> {t("Discover")}</>} title={t("My watchlist")}
          subtitle={t("Listings you starred or have an NDA with")} toggle={<ViewToggle value={view} onChange={persist} />}
          q={q} setQ={setQ} placeholder={language === "th" ? "ค้นหาในรายการที่ติดตาม" : "Search my watchlist"}
          hasFilters={!!q || filter !== "all"} onClear={() => { setQ(""); setFilter("all"); }}
          count={language === "th" ? `แสดง ${items.length} รายการ` : `Showing ${items.length}`}
          lead={
        <div role="tablist" aria-label={t("Filter by status")} className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-[#E3E8F0] bg-[#F1F4F9] p-[3px]">
          {FILTERS.map(([k, label]) => {
            const on = filter === k;
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => setFilter(k)}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13.5px]",
                  on ? "bg-white font-semibold text-[#111827] shadow-[inset_0_0_0_1px_#DCE3EF]" : "font-medium text-[#5B6576] hover:text-[#111827]")}>
                {t(label)}
                <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-bold", on ? "bg-[#EEF0FF] text-[#4338CA]" : "bg-[#E3E8F0] text-[#4B5563]")}>{counts[k]}</span>
              </button>
            );
          })}
        </div>
          } />
        <div className="mt-[18px] empty:hidden"><PlanEndedBar /></div>
        <NdaInfoStrip role="buyer" />
      </div>

      {isLoading ? (
        <div className="standard-card-grid">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[320px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Star className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {all.length === 0 && !q ? (
            <p>{t("Nothing here yet. Save a listing or request an NDA in")} <Link to="/marketplace/browse" className="font-semibold text-[#2563EB] hover:underline">{t("Browse listings")}</Link>.</p>
          ) : (
            <p>{t("No listings with this status.")}</p>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="standard-card-grid">
          {items.map((f) => <div key={f.id} data-flight-src={f.id}><FavCard f={f} view={viewOf(f)} open={false} onView={(v) => setView(f.id, v)}
            onOpen={(v) => { setView(f.id, v); setModalId(f.id); }} expanded={false} savedIds={savedIds} toggleSave={toggleSave} reserveTabs={anyTabs} /></div>)}
        </div>
      ) : view === "split" ? (
        <div className="grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-5">
            {items.map((f) => (
              <div key={f.id} data-flight-src={f.id}><FavCard f={f} view={viewOf(f)} open={wide && current?.id === f.id}
                onView={(v) => { setView(f.id, v); open(f.id); }} onOpen={(v) => { setView(f.id, v); open(f.id); }}
                expanded={expandedId === f.id} onToggleExpand={() => setExpandedId((e) => (e === f.id ? null : f.id))}
                savedIds={savedIds} toggleSave={toggleSave} /></div>
            ))}
          </div>
          {wide && current && (
            <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              <FavPanel key={`${current.id}:${viewOf(current)}`} f={current} view={viewOf(current)} savedIds={savedIds} toggleSave={toggleSave} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => {
            const l = f.listing;
            return (
              <div key={f.id} data-flight-src={f.id} role="button" tabIndex={0} onClick={() => setModalId(f.id)} onKeyDown={(e) => { if (e.key === "Enter") setModalId(f.id); }}
                className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
                <SectorArt art={l.coverArt ?? l.sector} sector={l.sector} imageId={l.publicImageId} className="h-[54px] w-[96px] shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{f.priv?.companyName ?? (l.headline || l.codeName)}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[f.priv ? l.headline : null, f.priv ? (f.priv.revenue != null ? `${t("Revenue")} FY${fy(f.priv.fy)} ${baht(f.priv.revenue)}` : null) : l.revenueBand, l.sector, l.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 max-[639px]:basis-full max-[639px]:justify-end">
                  {f.status === "approved" ? <ApprovedBadge /> : f.status === "requested" ? <NdaRequestedBadge /> : null}
                  {l.managed && <ManagedBadge size="sm" />}
                  {f.status !== "approved" && f.status !== "requested" && <SaveButton saved={savedIds.has(f.id)} onClick={() => toggleSave(f.id)} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-[860px]">
          {modal && <div className="flex max-h-[88vh] flex-col"><FavPanel key={`${modal.id}:${viewOf(modal)}`} f={modal} view={viewOf(modal)} savedIds={savedIds} toggleSave={toggleSave} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FavPanel({ f, view, savedIds, toggleSave }: { f: Favourite; view: FavView; savedIds: Set<string>; toggleSave: (id: string) => void }) {
  const { t } = useTranslation();
  const code = [f.listing.codeName, f.listing.refNo].filter(Boolean).join(" · ");
  const [sent, setSent] = useState<NdaSent | null>(null);
  if (sent) return <NdaSentDialog sent={sent} fromWatchlist onClose={() => setSent(null)} />;
  if (view === "private" && f.priv) return <PrivateListingPanel f={f} code={code} />;
  return <PublicPanel f={f} savedIds={savedIds} toggleSave={toggleSave} onSent={(name, invitationId) => setSent({ listingId: f.id, name, invitationId, saved: true })} />;
}

function PublicPanel({ f, savedIds, toggleSave, onSent }: { f: Favourite; savedIds: Set<string>; toggleSave: (id: string) => void; onSent: (name: string, invitationId: string | null) => void }) {
  const { t } = useTranslation();
  const withdraw = useServerFn(withdrawNdaRequest);
  const invalidate = useInvalidateListings();
  const [busy, setBusy] = useState(false);
  const l = f.listing;
  const name = l.codeName || l.refNo || t("This listing");
  const chip = f.status === "approved" ? <ApprovedBadge /> : f.status === "requested" ? <NdaRequestedBadge /> : <StarredBadge />;
  const actions = f.status === "approved" ? (
    <Button asChild size="sm" className="flex-none"><Link to="/marketplace/pipeline">{t("Open full profile")}</Link></Button>
  ) : f.status === "requested" ? (
    <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await withdraw({ data: { id: f.id } });
        toast.success(savedIds.has(f.id) ? `${t("Request withdrawn.")} ${name} ${t("stays in Favourites as starred.")}` : `${t("Request withdrawn.")} ${name} ${t("has left Favourites.")}`); invalidate(); }
      catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
    }}>{t("Withdraw request")}</Button>
  ) : (
    <div className="flex shrink-0 gap-2">
      <SaveButton saved={savedIds.has(f.id)} onClick={() => toggleSave(f.id)} />
      <NdaButton listingId={f.id} onRequested={(_, info) => onSent(name, info?.invitationId ?? null)} />
    </div>
  );
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 pr-12">
        <div className="flex min-w-0 items-center gap-3">
          <SectorArt art={l.coverArt ?? l.sector} sector={l.sector} imageId={l.publicImageId} className="h-[46px] w-[46px] flex-none rounded-[10px]" />
          <div className="min-w-0">
            <div className="truncate text-[18px] font-bold leading-tight">{l.codeName || l.headline || l.refNo}</div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              {chip}
              <span className="truncate text-[12.5px] text-[#6A7181]">{[l.refNo, l.sector].filter(Boolean).join(" · ")}</span>
            </div>
          </div>
        </div>
        {actions}
      </div>
      <div className="space-y-5 overflow-y-auto p-5">
        <FavViewLine view="public">{t("What every buyer sees in Browse listings.")} {publicStatusSentence(t, f.status, "company", fmtDate(f.ndaRequestedAt))}</FavViewLine>
        <ListingDetail t={f} requested={f.status === "requested"} approved={f.status === "approved"} />
      </div>
    </>
  );
}

