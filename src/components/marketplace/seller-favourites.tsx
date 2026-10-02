import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Lock, LockOpen, Search, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useHasSession } from "@/hooks/use-has-session";
import { PublicInvestorCard, TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { InvestorDetail, StarBtn, useSavedInvestors } from "@/components/marketplace/investor-browse";
import { listSellerFavourites, type SellerFavourite, type SellerFavStatus } from "@/lib/investor-browse.functions";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

type Filter = "all" | SellerFavStatus;
const FILTERS: [Filter, string][] = [["all", "All"], ["saved", "Starred"], ["requested", "NDA requested"], ["approved", "NDA approved"]];
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");

function StatusBadge({ s }: { s: SellerFavStatus }) {
  const { t } = useTranslation();
  if (s === "approved") return <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-bold text-[#15803D]"><LockOpen className="h-3 w-3" />{t("NDA approved")}</span>;
  if (s === "requested") return <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[10.5px] font-bold text-[#B45309]"><Clock className="h-3 w-3" />{t("NDA requested")}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[10.5px] font-bold text-[#374151]"><Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />{t("Starred")}</span>;
}

/** Fixed, filled star for investors in Favourites because of an NDA. */
function NdaStar() {
  const { t } = useTranslation();
  const tip = t("In Favourites because of an NDA");
  return <span title={tip} aria-label={tip} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[#FDE68A] bg-white"><Star className="h-4 w-4 fill-[#F59E0B] text-[#D97706]" /></span>;
}

export function SellerFavourites() {
  const { t } = useTranslation();
  const fn = useServerFn(listSellerFavourites);
  const enabled = useHasSession();
  const { data, isLoading } = useQuery({ queryKey: ["seller-favourites"], queryFn: () => fn(), enabled });
  const all = useMemo(() => (data ?? []) as SellerFavourite[], [data]);
  const { view, persist } = usePersistentView("ps-seller-favourites-view", undefined);
  const { ids: savedIds, toggle } = useSavedInvestors();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1100px)");
    const f = () => setWide(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);

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
      return [f.name, f.codeName, f.refNo, f.description, f.type, f.country, f.city, f.listingCode, ...f.sectors, ...f.stages]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(n));
    });
  }, [all, filter, q]);

  const current = items.find((f) => f.id === selected) ?? items[0] ?? null;
  const modal = all.find((f) => f.id === modalId) ?? null;
  const star = (f: SellerFavourite) => (f.status === "saved" ? <StarBtn saved={savedIds.has(f.id)} onClick={() => toggle(f.id)} /> : <NdaStar />);
  const badgeRow = (f: SellerFavourite) => (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-1 text-[11.5px] text-muted-foreground">
      <StatusBadge s={f.status} />
      {f.status !== "saved" && <span>{f.listingCode ? `${f.listingCode} · ` : ""}{fmtDate(f.at)}</span>}
    </div>
  );
  const panel = (f: SellerFavourite) => (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
        <StatusBadge s={f.status} />
        {f.status === "approved" && (
          <Link to="/marketplace/pipeline" className="ml-auto text-[12.5px] font-semibold text-[#2563EB] hover:underline">{t("Open in Pipeline")}</Link>
        )}
        {f.status === "requested" && (
          <Link to="/marketplace/pipeline" className="ml-auto text-[12.5px] font-semibold text-[#2563EB] hover:underline">{t("Review NDA request")}</Link>
        )}
      </div>
      <InvestorDetail i={f} saved={savedIds.has(f.id) || f.status !== "saved"} onSave={() => f.status === "saved" && toggle(f.id)} />
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Star className="h-3.5 w-3.5" /> {t("Discover")}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("Favourites")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Investors you starred or have an NDA with")}</p>
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="relative w-full sm:w-[380px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search Favourites")} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[260px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Star className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {all.length === 0 && !q ? (
            <p>{t("Nothing here yet. Star an investor in")} <Link to="/marketplace/browse" className="font-semibold text-[#2563EB] hover:underline">{t("Browse investors")}</Link>.</p>
          ) : <p>{t("No investors with this status.")}</p>}
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.id}>{badgeRow(f)}<PublicInvestorCard i={f} onClick={() => setModalId(f.id)} topRight={star(f)} /></div>
          ))}
        </div>
      ) : view === "split" ? (
        <div className="grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-3">
            {items.map((f) => (
              <div key={f.id}>
                {badgeRow(f)}
                <PublicInvestorCard i={f} selected={wide && current?.id === f.id}
                  onClick={() => (wide ? setSelected(f.id) : setModalId(f.id))}
                  expanded={expandedId === f.id} onToggleExpand={() => setExpandedId((e) => (e === f.id ? null : f.id))}
                  topRight={star(f)} />
              </div>
            ))}
          </div>
          {wide && current && (
            <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {panel(current)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <div key={f.id} role="button" tabIndex={0} onClick={() => setModalId(f.id)}
              className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><TypeIcon type={f.type} className="h-5 w-5 text-muted-foreground" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{f.name || f.codeName} <span className="font-normal text-muted-foreground">· {f.refNo}</span></div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {[f.country, f.ticketLabel && `Ticket ${f.ticketLabel}`, f.aumLabel && `AUM ${f.aumLabel}`,
                    f.revLabel && `Revenue min. ${f.revLabel}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusBadge s={f.status} />
              {!f.name && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"><Lock className="h-3 w-3" />{t("Name after NDA")}</span>}
              {star(f)}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-[640px] flex-col overflow-hidden p-0">
          {modal && panel(modal)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
