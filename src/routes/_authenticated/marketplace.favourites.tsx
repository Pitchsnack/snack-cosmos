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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marketplace/favourites")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s.id === "string" ? { id: s.id } : {}),
  head: () => ({
    meta: [
      { title: "Favourites — PitchSnack" },
      { name: "description", content: "Listings you saved or requested an NDA for, with the private view once the seller approves." },
      { property: "og:title", content: "Favourites — PitchSnack" },
      { property: "og:description", content: "Listings you saved or requested an NDA for, with the private view once the seller approves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavouritesPage,
});

type Filter = "all" | FavStatus;
const FILTERS: [Filter, string][] = [["all", "All"], ["saved", "Saved"], ["requested", "NDA requested"], ["approved", "NDA approved"]];

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");
const baht = (n: number | null) => {
  if (n == null) return null;
  const a = Math.abs(n);
  const s = a >= 1e9 ? `฿${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `฿${(a / 1e6).toFixed(1)}M` : `฿${a.toLocaleString("en-US")}`;
  return n < 0 ? `(${s})` : s;
};
const fy = (y: number | null) => (y != null ? String(y).slice(-2) : "25");

function ApprovedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-bold text-[#15803D]">
      <LockOpen className="h-3 w-3" />NDA approved
    </span>
  );
}

function FavCard({ f, selected, onSelect, expanded, onToggleExpand, savedIds, toggleSave, wrapMeta }: {
  f: Favourite; selected?: boolean; onSelect?: () => void; expanded?: boolean; onToggleExpand?: () => void;
  savedIds: Set<string>; toggleSave: (id: string) => void; wrapMeta?: boolean;
}) {
  const p = f.priv;
  return (
    <PublicListingCard
      l={f.listing}
      deal={f}
      selected={selected}
      onSelect={onSelect}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      wrapMeta={wrapMeta}
      badge={f.status === "approved" ? <ApprovedBadge /> : f.status === "requested" ? <NdaRequestedBadge /> : undefined}
      priv={p ? { name: p.companyName, logoPath: p.logoPath, revenueText: baht(p.revenue), fy: p.fy, employees: p.employees } : undefined}
      topRight={f.status === "saved" ? <SaveButton square saved={savedIds.has(f.id)} onClick={() => toggleSave(f.id)} /> : undefined}
    />
  );
}

function FavouritesPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Star className="h-3.5 w-3.5" /> Discover</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Favourites</h1>
          <p className="mt-1 text-sm text-muted-foreground">Listings you saved or requested an NDA for</p>
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter by status" className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-[#E3E8F0] bg-[#F1F4F9] p-[3px]">
          {FILTERS.map(([k, label]) => {
            const on = filter === k;
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => setFilter(k)}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13.5px]",
                  on ? "bg-white font-semibold text-[#111827] shadow-[inset_0_0_0_1px_#DCE3EF]" : "font-medium text-[#5B6576] hover:text-[#111827]")}>
                {label}
                <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-bold", on ? "bg-[#EEF0FF] text-[#4338CA]" : "bg-[#E3E8F0] text-[#4B5563]")}>{counts[k]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-[380px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Favourites" className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[320px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Star className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {all.length === 0 && !q ? (
            <p>Nothing here yet. Save a listing or request an NDA in <Link to="/marketplace/browse" className="font-semibold text-[#2563EB] hover:underline">Browse listings</Link>.</p>
          ) : (
            <p>No listings with this status.</p>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => <FavCard key={f.id} f={f} onSelect={() => setModalId(f.id)} expanded={false} savedIds={savedIds} toggleSave={toggleSave} />)}
        </div>
      ) : view === "split" ? (
        <div className="grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-3">
            {items.map((f) => (
              <FavCard key={f.id} f={f} selected={wide && current?.id === f.id} onSelect={() => open(f.id)}
                expanded={expandedId === f.id} onToggleExpand={() => setExpandedId((e) => (e === f.id ? null : f.id))}
                savedIds={savedIds} toggleSave={toggleSave} />
            ))}
          </div>
          {wide && current && (
            <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              <FavPanel f={current} savedIds={savedIds} toggleSave={toggleSave} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => {
            const l = f.listing;
            return (
              <div key={f.id} role="button" tabIndex={0} onClick={() => setModalId(f.id)} onKeyDown={(e) => { if (e.key === "Enter") setModalId(f.id); }}
                className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
                <SectorArt art={l.coverArt ?? l.sector} className="h-[54px] w-[96px] shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{f.priv?.companyName ?? (l.headline || l.codeName)}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[f.priv ? l.headline : null, f.priv ? (f.priv.revenue != null ? `Revenue FY${fy(f.priv.fy)} ${baht(f.priv.revenue)}` : null) : l.revenueBand, l.sector, l.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {f.status === "approved" ? <ApprovedBadge /> : f.status === "requested" ? <NdaRequestedBadge /> : <SaveButton saved={savedIds.has(f.id)} onClick={() => toggleSave(f.id)} />}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-[860px]">
          {modal && <div className="flex max-h-[88vh] flex-col"><FavPanel f={modal} savedIds={savedIds} toggleSave={toggleSave} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FavPanel({ f, savedIds, toggleSave }: { f: Favourite; savedIds: Set<string>; toggleSave: (id: string) => void }) {
  const code = [f.listing.codeName, f.listing.refNo].filter(Boolean).join(" · ");
  if (f.status === "approved" && f.priv) return <PrivatePanel f={f} code={code} />;
  if (f.status === "requested") return <RequestedPanel f={f} code={code} />;
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 pr-12">
        <span className="min-w-0 truncate text-sm font-semibold">{code}</span>
        <div className="flex shrink-0 gap-2">
          <SaveButton saved={savedIds.has(f.id)} onClick={() => toggleSave(f.id)} />
          <NdaButton listingId={f.id} onRequested={() => toast.success("NDA requested.")} />
        </div>
      </div>
      <div className="overflow-y-auto p-5"><ListingDetail t={f} /></div>
    </>
  );
}

function RequestedPanel({ f, code }: { f: Favourite; code: string }) {
  const withdraw = useServerFn(withdrawNdaRequest);
  const invalidate = useInvalidateListings();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 pr-12">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold">{code}</span>
          <NdaRequestedBadge />
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await withdraw({ data: { id: f.id } }); toast.success("NDA request withdrawn."); invalidate(); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>Withdraw request</Button>
      </div>
      <div className="space-y-5 overflow-y-auto p-5">
        <div className="flex items-start gap-2 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-[14px] py-[11px] text-[13.5px] text-[#92400E]">
          <Clock className="mt-0.5 h-4 w-4 flex-none" />
          <span>You requested the NDA on {fmtDate(f.ndaRequestedAt)}. The seller usually replies within 2 days, and the private view opens here once they approve.</span>
        </div>
        <ListingDetail t={f} requested />
      </div>
    </>
  );
}

function PrivatePanel({ f, code }: { f: Favourite; code: string }) {
  const p = f.priv!;
  const logo = useMediaUrl(p.logoPath);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [f.id]);
  const ini = p.companyName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const web = p.website ? (p.website.startsWith("http") ? p.website : `https://${p.website}`) : null;
  const cell = (k: string, v: React.ReactNode) => (
    <div className="flex gap-3 border-b border-border py-1.5 text-[13px] last:border-0 sm:[&:nth-last-child(2)]:border-0">
      <span className="w-[110px] flex-none text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1 font-medium">{v ?? "—"}</span>
    </div>
  );
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 pr-12">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-[34px] w-[34px] flex-none place-items-center overflow-hidden rounded-[9px] border border-border bg-card text-[12px] font-bold">
            {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : ini}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[16px] font-bold">{p.companyName}</span>
              <span className="inline-flex h-[22px] flex-none items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 text-[11.5px] font-semibold text-[#15803D]"><BadgeCheck className="h-3.5 w-3.5" />NDA approved</span>
            </div>
            <div className="truncate text-[12.5px] text-[#6A7181]">{code}</div>
          </div>
        </div>
        <Button asChild size="sm" className="flex-none"><Link to="/marketplace/pipeline">Open full profile</Link></Button>
      </div>
      <div className="space-y-5 overflow-y-auto p-5">
        <div className="flex flex-wrap items-start gap-2 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-[14px] py-[11px] text-[13.5px] text-[#166534]">
          <LockOpen className="mt-0.5 h-4 w-4 flex-none" />
          <span className="rounded-[6px] bg-[#E8F6EE] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">Private view</span>
          <span className="min-w-0 flex-1">Shared with you under your NDA, approved {fmtDate(p.ndaApprovedAt)} and valid until {fmtDate(p.ndaValidUntil)}.</span>
        </div>
        <PublicListingCard l={f.listing} deal={f} wrapMeta badge={<ApprovedBadge />}
          priv={{ name: p.companyName, logoPath: p.logoPath, revenueText: baht(p.revenue), fy: p.fy, employees: p.employees }} />
        {p.description && (
          <Section title="Business overview">
            <p className={cn("whitespace-pre-line text-[13.5px] text-foreground/80", !more && "line-clamp-2")}>{p.description}</p>
            <button type="button" onClick={() => setMore((m) => !m)} className="text-[12.5px] font-semibold hover:underline">{more ? "Show less ▴" : "Show more ▾"}</button>
          </Section>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <DealTerms t={f} />
          <div className={BOX}>
            <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Financials · FY{fy(p.fy)}</h4>
            <KV rows={[
              [`Revenue FY${fy(p.fy)}`, baht(p.revenue)],
              [`Net profit FY${fy(p.fy)}`, baht(p.netProfit)],
              ["Revenue growth", p.growthPct != null && p.fy != null ? `${p.growthPct >= 0 ? "+" : ""}${p.growthPct.toFixed(1)}% vs FY${fy(p.fy - 1)}` : null],
              ["Verified by", f.listing.hasFinancials ? <span className="text-[#16A34A]">✓ PitchSnack analysts</span> : null],
            ]} />
          </div>
        </div>
        <div className={BOX}>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Company</h4>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {cell("Legal name", (p.legalNameEn || p.legalNameTh) ? <>{p.legalNameEn ?? p.legalNameTh}{p.legalNameEn && p.legalNameTh && <div className="text-[12px] font-normal text-[#6A7181]" style={{ fontFamily: "'Noto Sans Thai', 'DM Sans', sans-serif" }}>{p.legalNameTh}</div>}</> : null)}
            {cell("Registration no.", p.regNo)}
            {cell("Website", web ? <a href={web} target="_blank" rel="noreferrer" className="inline-flex min-w-0 max-w-full items-center gap-1 break-all text-[#2563EB] hover:underline">{p.website!.replace(/^https?:\/\//, "").replace(/\/$/, "")}<ExternalLink className="h-3 w-3" /></a> : null)}
            {cell("Location", p.location)}
            {cell("Founded", p.founded)}
            {cell("Employees", p.employees)}
          </div>
        </div>
      </div>
    </>
  );
}
