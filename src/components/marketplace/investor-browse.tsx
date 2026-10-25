import { StandardInvestorCard } from "@/components/marketplace/standard-investor-card";
import { ManagedBadge } from "@/components/common/managed-badge";
import { ConnectButton } from "@/components/marketplace/connect-invite";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, ChevronDown, Lock, Star } from "lucide-react";
import { BrowseHeader, FilterPill, MatchBox, MatchTag, NdaInfoStrip, PlanEndedBar, pillCls, useBrowseMatches } from "@/components/marketplace/browse-header";
import { useTranslation } from "@/i18n/language";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { NameAfterNdaPill, PublicInvestorCard, TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { INDIVIDUAL_TYPE, actsForText, bandOf } from "@/lib/investor-bands";
import { listBrowseInvestors, listSellerFavourites, mySavedInvestorIds, toggleSavedInvestor } from "@/lib/investor-browse.functions";
import {
  AUM_FILTER, REVENUE_FILTER, TICKET_FILTER, isCorporateBuyer, matchAum, matchRevenue, matchTicket,
  type FilterOpt, type PublicInvestor,
} from "@/lib/investor-browse";
import { cn } from "@/lib/utils";

/** Starred investors are stored per seller on the server (they feed seller Favourites). */
export function useSavedInvestors() {
  const list = useServerFn(mySavedInvestorIds);
  const toggleFn = useServerFn(toggleSavedInvestor);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["saved-investors"], queryFn: () => list() });
  const ids = new Set(data);
  const toggle = async (id: string) => {
    const saved = !ids.has(id);
    qc.setQueryData<string[]>(["saved-investors"], (prev = []) => (saved ? [...prev, id] : prev.filter((x) => x !== id)));
    try {
      await toggleFn({ data: { id, saved } });
      toast.success(saved ? "Added to my watchlist." : "Removed from my watchlist.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      qc.invalidateQueries({ queryKey: ["saved-investors"] });
      qc.invalidateQueries({ queryKey: ["seller-favourites"] });
    }
  };
  return { ids, toggle };
}

export function StarBtn({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={saved ? "Remove from my watchlist" : "Add to my watchlist"} title={saved ? "Remove from my watchlist" : "Add to my watchlist"}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-border bg-background hover:bg-muted">
      <Star className={cn("h-4 w-4", saved ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
    </button>
  );
}

/** Single-choice dropdown filter with hint, live counts and lock footnote. */
export function FilterMenu({ label, heading, hint, foot, options, value, onChange, countFor }: {
  label: string; heading: string; hint: string; foot?: string; options: FilterOpt[]; value: string;
  onChange: (v: string) => void; countFor: (v: string) => number;
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const active = options.find((o) => o.value === value && value !== "");
  useEffect(() => { if (open) setFocus(Math.max(0, options.findIndex((o) => o.value === value))); }, [open, options, value]);
  const pick = (v: string) => { onChange(v); setOpen(false); btn.current?.focus(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} className={pillCls(!!active, open)}>
          <span className="truncate">{active?.active ?? label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} collisionPadding={16}
        className="w-[292px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[14px] border-[#DCDFE5] p-2 shadow-lg"
        style={{ maxHeight: "min(470px, calc(100vh - 150px))" }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setFocus((f) => Math.min(options.length - 1, f + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setFocus((f) => Math.max(0, f - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(options[focus].value); }
        }}>
        <div className="border-b border-[#F0F1F4] px-2.5 pb-2 pt-1">
          <div className="text-[12.5px] font-bold text-[#151A28] dark:text-foreground">{heading}</div>
          <div className="text-[12px] text-[#6B7280]">{hint}</div>
        </div>
        <div role="listbox" className="py-1">
          {options.map((o, k) => {
            const n = countFor(o.value);
            const sel = o.value === value;
            return (
              <button key={o.value || "any"} type="button" role="option" aria-selected={sel}
                onClick={() => pick(o.value)} onMouseEnter={() => setFocus(k)}
                className={cn("flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px]",
                  focus === k && "bg-[#F6F7F9] dark:bg-muted", sel && "font-semibold", n === 0 && "text-[#9CA3AF]")}>
                <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", sel ? "border-[#F6A823]" : "border-[#C9CED6]")}>
                  {sel && <span className="h-2 w-2 rounded-full bg-[#F6A823]" />}
                </span>
                <span className="flex-1">{o.label}</span>
                <span className="text-[12px] text-[#9CA3AF]">{n}</span>
              </button>
            );
          })}
        </div>
        {foot && (
          <div className="flex items-center gap-1.5 border-t border-[#F0F1F4] px-2.5 pt-2 text-[11.5px] text-[#6B7280]">
            <Lock className="h-3 w-3" />{foot}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function InvestorDetail({ i, saved, onSave, ndaApproved, pill, actions, match, header, lead }: {
  /** Favourites: replaces the header row. */
  header?: React.ReactNode;
  /** Favourites: first line of the body (the view line); also drops the locked box. */
  lead?: React.ReactNode;
  i: PublicInvestor; saved: boolean; onSave: () => void; ndaApproved?: boolean;
  /** Criteria this investor's mandate matched (seller view). */
  match?: string[];
  /** Optional role pill before the title (Advisor view). */
  pill?: React.ReactNode;
  /** Replaces the star on the right of the header (Advisor view). */
  actions?: React.ReactNode;
}) {
  const corp = isCorporateBuyer(i.type);
  const indiv = (i.type ?? "") === INDIVIDUAL_TYPE || i.relation === "individual" || i.relation === "agent";
  const money = (k: string | null | undefined): React.ReactNode => {
    const b = bandOf(k);
    return b ? <>{b.label} <span className="font-normal text-[#6B7280] dark:text-muted-foreground">({b.baht})</span></> : "Not stated";
  };
  const rows: Array<[string, React.ReactNode]> = [
    ["Investor type", i.actsFor?.length ? actsForText(i.actsFor) : i.type || "Not stated"],
    ["Ticket size", money(i.ticketBand)],
    ["Min. target revenue", money(i.revBand)],
    ...(indiv ? [] : [[corp ? "Group revenue" : "Assets under management", money(i.aumBand)] as [string, React.ReactNode]]),
    ...(i.stages.length ? [["Preferred stages", i.stages.join(", ")] as [string, React.ReactNode]] : []),
    ["Deal types", i.dealTypes.join(", ") || "Not stated"],
    ["Geography", i.geography || "Not stated"],
  ];
  return (
    <>
      {header ?? <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {pill}
          <span className="min-w-0 truncate text-sm font-semibold">{i.codeName} · {i.refNo}</span>
          {!ndaApproved && !i.name && <NameAfterNdaPill />}
        </div>
        {actions ?? <StarBtn saved={saved} onClick={onSave} />}
      </div>}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {lead}
        {match && <MatchBox side="seller" criteria={match} />}
        <PublicInvestorCard showManaged i={i} panel />
        <div>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mandate · shown as ranges</h4>
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-2 gap-6 border-b border-[#F0F1F4] py-2.5 text-[14px] last:border-0 dark:border-border">
              <span className="text-[#6B7280] dark:text-muted-foreground">{k}</span>
              <span className="text-left text-[#374151] dark:text-foreground">{v}</span>
            </div>
          ))}
        </div>
        {!lead && <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" />Shown after the NDA is approved
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Name & logo", "Website & contacts", "Decision-makers", "Exact AUM & ticket", "Portfolio"].map((c) => (
              <span key={c} className="rounded-full border border-amber-200 bg-background px-2 py-0.5 text-[11.5px] text-amber-800 dark:border-amber-800 dark:text-amber-300">{c}</span>
            ))}
          </div>
        </div>}
      </div>
    </>
  );
}

/** Seller-side marketplace: public (hidden) investor profiles only. */
export function InvestorBrowse() {
  const fetchAll = useServerFn(listBrowseInvestors);
  const { data, isLoading } = useQuery({ queryKey: ["browse-investors"], queryFn: () => fetchAll(), staleTime: 60_000 });
  const fetchFavourites = useServerFn(listSellerFavourites);
  const { data: favourites } = useQuery({ queryKey: ["seller-favourites"], queryFn: () => fetchFavourites() });
  const all = useMemo(() => (data ?? []) as PublicInvestor[], [data]);
  const cardInvestor = (i: PublicInvestor) => ({ ...i, status: favourites?.find((f) => f.id === i.id)?.status });

  const { view, persist } = usePersistentView("ps-investor-browse-view", undefined);
  const { ids: savedIds, toggle: toggleSave } = useSavedInvestors();

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [country, setCountry] = useState("all");
  const [aum, setAum] = useState("");
  const [ticket, setTicket] = useState("");
  const [revenue, setRevenue] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const modal = all.find((x) => x.id === modalId) ?? null;
  const listRef = useRef<HTMLDivElement>(null);

  const types = useMemo(() => Array.from(new Set(all.flatMap((i) => (i.actsFor?.length ? i.actsFor : [i.type])).filter(Boolean) as string[])).sort(), [all]);
  const countries = useMemo(() => Array.from(new Set(all.map((i) => i.country).filter(Boolean) as string[])).sort(), [all]);

  const base = (i: PublicInvestor) => {
    if (type !== "all" && i.type !== type && !(i.actsFor ?? []).includes(type)) return false;
    if (country !== "all" && i.country !== country) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [i.name, i.codeName, i.refNo, i.description, i.type, i.country, i.city, ...i.sectors, ...i.stages]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
  };
  const f = { aum, ticket, revenue };
  const passes = (i: PublicInvestor, o: Partial<typeof f> = {}) => {
    const x = { ...f, ...o };
    return base(i) && matchAum(i, x.aum) && matchTicket(i, x.ticket) && matchRevenue(i, x.revenue);
  };
  const items = all.filter((i) => passes(i));
  const count = (key: keyof typeof f) => (v: string) => all.filter((i) => passes(i, { [key]: v })).length;

  const th = useTranslation().language === "th";
  const matches = useBrowseMatches();
  const tagOf = (id: string) => (matches[id] ? <MatchTag side="seller" /> : undefined);
  const hasFilter = !!q || type !== "all" || country !== "all" || !!aum || !!ticket || !!revenue;
  const clearAll = () => { setQ(""); setType("all"); setCountry("all"); setAum(""); setTicket(""); setRevenue(""); };

  const current = items.find((i) => i.id === selected) ?? items[0] ?? null;

  // Changing a filter takes the list back to its top.
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [q, type, country, aum, ticket, revenue]);

  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1100px)");
    const on = () => setWide(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const splitFixed = view === "split" && wide;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = Math.max(0, items.findIndex((i) => i.id === current?.id));
    const next = items[Math.min(items.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    setSelected(next.id);
    listRef.current?.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const empty = (
    <div className="rounded-[14px] border border-dashed border-border bg-card py-14 text-center">
      <p className="text-sm font-semibold text-foreground">No investors match these filters</p>
      <p className="mt-1 text-[13px] text-muted-foreground">Try a wider range, or clear the filters.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={clearAll}>Clear filters</Button>
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-5", splitFixed && "h-[calc(100vh-7.5rem)] min-h-[520px]")}>
      <div>
        <BrowseHeader role="seller" eyebrow={<><Briefcase className="h-3.5 w-3.5" /> {th ? "ค้นพบ" : "Discover"}</>}
          title={th ? "ค้นหานักลงทุน" : "Browse investors"} toggle={<ViewToggle value={view} onChange={persist} />}
          q={q} setQ={setQ} placeholder={th ? "ค้นหานักลงทุน" : "Search investors"}
          hasFilters={hasFilter} onClear={clearAll}
          count={th ? `แสดงนักลงทุน ${items.length} ราย` : `Showing ${items.length} investor${items.length === 1 ? "" : "s"}`}
          filters={<>
            <FilterPill label={th ? "ทุกประเภท" : "All types"} value={type} onChange={setType} options={types.map((t) => ({ value: t, label: t }))} />
            <FilterPill label={th ? "ทุกประเทศ" : "All countries"} value={country} onChange={setCountry} options={countries.map((c) => ({ value: c, label: c }))} />
            <FilterMenu label={th ? "ขนาด AUM" : "AUM size"} heading="AUM size" options={AUM_FILTER} value={aum} onChange={setAum} countFor={count("aum")}
              hint="Fund size or AUM (group revenue for corporate buyers), matched on the band each card shows."
              foot="Exact AUM is shown only after the NDA is approved." />
            <FilterMenu label={th ? "ขนาดเงินลงทุน" : "Ticket size"} heading="Ticket size" options={TICKET_FILTER} value={ticket} onChange={setTicket} countFor={count("ticket")}
              hint="Pick the amount you're raising or selling for. Shows investors whose average investment is in that band."
              foot="Exact ticket sizes are shown only after the NDA is approved." />
            <FilterMenu label={th ? "รายได้ขั้นต่ำ" : "Revenue minimum"} heading="Revenue minimum" options={REVENUE_FILTER} value={revenue} onChange={setRevenue} countFor={count("revenue")}
              hint="Pick your company's revenue. Shows investors whose minimum is at or below it." />
          </>} />
        <div className="mt-[18px] empty:hidden"><PlanEndedBar /></div>
        <NdaInfoStrip role="seller" />
      </div>

      {isLoading ? (
        <div className="standard-card-grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[260px] rounded-[14px]" />)}
        </div>
      ) : view === "grid" ? (
        items.length === 0 ? empty : (
          <div className="standard-card-grid">
            {items.map((i) => <StandardInvestorCard key={i.id} i={cardInvestor(i)} tag={tagOf(i.id)} onClick={() => setModalId(i.id)} topRight={<StarBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />} />)}
          </div>
        )
      ) : view === "split" ? (
        <div className={cn("grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]", splitFixed && "min-h-0 flex-1 items-stretch")}>
          <div ref={listRef} tabIndex={-1} onKeyDown={onListKey}
            className={cn("space-y-3 outline-none", splitFixed && "min-h-0 overflow-y-scroll pr-2 [scrollbar-gutter:stable]")}>
            {items.length === 0 ? empty : items.map((i) => (
              <div key={i.id} data-id={i.id}>
                <StandardInvestorCard i={cardInvestor(i)} tag={tagOf(i.id)} selected={current?.id === i.id}
                  onClick={() => setSelected(i.id)}
                  topRight={<StarBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />} />
              </div>
            ))}
          </div>
          {wide && (
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {current ? (
                <InvestorDetail key={current.id} i={current} match={matches[current.id]} saved={savedIds.has(current.id)} onSave={() => toggleSave(current.id)} actions={<div className="flex shrink-0 gap-2"><StarBtn saved={savedIds.has(current.id)} onClick={() => toggleSave(current.id)} /><ConnectButton big investorId={current.id} investorRef={current.refNo} /></div>} />
              ) : (
                <p className="px-6 py-16 text-center text-sm text-muted-foreground">No investor selected. Widen or clear the filters to see investors.</p>
              )}
            </div>
          )}
        </div>
      ) : items.length === 0 ? empty : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} data-connect-source={i.refNo} data-connect-type={i.type ?? i.codeName} role="button" tabIndex={0} onClick={() => setModalId(i.id)} onKeyDown={(e) => { if (e.key === "Enter") setModalId(i.id); }} className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-colors hover:border-accent">
              <div data-connect-cover={i.refNo} data-connect-type={i.type ?? i.codeName} className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><TypeIcon type={i.type} className="h-5 w-5 text-muted-foreground" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{i.name || i.codeName} <span className="font-normal text-muted-foreground">· {i.refNo}</span></div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {[i.country, i.ticketLabel && `Ticket ${i.ticketLabel}`, i.aumLabel && `${isCorporateBuyer(i.type) ? "Group revenue" : "AUM"} ${i.aumLabel}`,
                    i.revLabel && `Revenue min. ${i.revLabel}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              {tagOf(i.id)}
              <div className="flex shrink-0 items-center gap-1.5 max-[639px]:basis-full max-[639px]:justify-end">
                {!i.name && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"><Lock className="h-3 w-3" />Name after NDA</span>}
                {i.managed && <ManagedBadge size="sm" />}
                <StarBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto p-0 sm:max-w-[820px]">
          {modal && <InvestorDetail key={modal.id} i={modal} match={matches[modal.id]} saved={savedIds.has(modal.id)} onSave={() => toggleSave(modal.id)} actions={<div className="flex shrink-0 gap-2"><StarBtn saved={savedIds.has(modal.id)} onClick={() => toggleSave(modal.id)} /><ConnectButton big investorId={modal.id} investorRef={modal.refNo} /></div>} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
