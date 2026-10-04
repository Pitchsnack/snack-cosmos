import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Search, Star, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { PublicListingCard, ListingPill } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
import { PublicInvestorCard, TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { AdvisorNdaButton, ListingDetail, SaveButton } from "@/components/marketplace/listing-panel";
import { FilterMenu, InvestorDetail, StarBtn } from "@/components/marketplace/investor-browse";
import {
  listAdvisorFavourites, listAdvisorMarketplace, toggleAdvisorFavourite,
  type AdvisorFav, type AdvisorInvestor, type AdvisorTeaser,
} from "@/lib/advisor.functions";
import { AUM_FILTER, REVENUE_FILTER, TICKET_FILTER, isCorporateBuyer, matchAum, matchRevenue, matchTicket } from "@/lib/investor-browse";
import { cn } from "@/lib/utils";

/**
 * Marketplace › I'm Advisor: Browse marketplace and Favourites.
 * Reuses the Browse listings card/panel and the Browse investors card/panel
 * as they are; only public records reach the browser (listAdvisorMarketplace).
 */

type Kind = "listing" | "investor";
type Item =
  | { kind: "listing"; key: string; id: string; date: string | null; t: AdvisorTeaser }
  | { kind: "investor"; key: string; id: string; date: string | null; i: AdvisorInvestor };
type Side = "all" | "sellers" | "buyers";

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "";

export function RolePill({ kind }: { kind: Kind }) {
  return (
    <span className={cn(
      "inline-flex h-5 shrink-0 items-center rounded-full px-[7px] text-[10px] font-bold uppercase tracking-[0.05em]",
      kind === "listing" ? "bg-[#FEF3DE] text-[#8A4B06]" : "bg-[#EEF0FF] text-[#4338CA]",
    )}>{kind === "listing" ? "Seller" : "Buyer"}</span>
  );
}

function RoleLine({ kind, text }: { kind: Kind; text: string }) {
  return (
    <div className="mb-[7px] flex min-w-0 items-center gap-2">
      <RolePill kind={kind} />
      <span className="min-w-0 truncate text-[12px] text-[#6B7280]">{text}</span>
    </div>
  );
}

function useAdvisorData() {
  const fn = useServerFn(listAdvisorMarketplace);
  return useQuery({ queryKey: ["advisor-marketplace"], queryFn: () => fn(), staleTime: 60_000 });
}

function useAdvisorStars() {
  const list = useServerFn(listAdvisorFavourites);
  const toggleFn = useServerFn(toggleAdvisorFavourite);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["advisor-favourites"], queryFn: () => list() });
  const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;
  const starred = new Map(data.map((f) => [keyOf(f.kind, f.id), f.at]));
  const toggle = async (kind: Kind, id: string) => {
    const saved = !starred.has(keyOf(kind, id));
    qc.setQueryData<AdvisorFav[]>(["advisor-favourites"], (prev = []) =>
      saved ? [{ kind, id, at: new Date().toISOString() }, ...prev] : prev.filter((f) => !(f.kind === kind && f.id === id)));
    try {
      await toggleFn({ data: { kind, id, saved } });
      toast.success(saved ? "Added to Favourites." : "Removed from Favourites.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      qc.invalidateQueries({ queryKey: ["advisor-favourites"] });
    }
  };
  return { starred, isStarred: (kind: Kind, id: string) => starred.has(keyOf(kind, id)), toggle, isLoading };
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

const isAgnostic = (s: string[]) => s.length === 0 || s.some((x) => /agnostic/i.test(x));

export function AdvisorBrowse() { return <AdvisorMarket mode="browse" />; }
export function AdvisorFavourites() { return <AdvisorMarket mode="favourites" />; }

function AdvisorMarket({ mode }: { mode: "browse" | "favourites" }) {
  const fav = mode === "favourites";
  const { data, isLoading } = useAdvisorData();
  const stars = useAdvisorStars();
  const { view, persist } = usePersistentView(fav ? "ps-advisor-fav-view" : "ps-advisor-browse-view", undefined);
  const wide = useWide();

  const [side, setSide] = useState<Side>("all");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [deal, setDeal] = useState("all");
  const [type, setType] = useState("all");
  const [country, setCountry] = useState("all");
  const [aum, setAum] = useState("");
  const [ticket, setTicket] = useState("");
  const [revenue, setRevenue] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pickSide = (s: Side) => {
    setSide(s);
    setSector("all"); setDeal("all"); setType("all"); setCountry("all"); setAum(""); setTicket(""); setRevenue("");
  };

  // Every live listing and Live investor profile, newest first (or newest star first in Favourites).
  const universe = useMemo<Item[]>(() => {
    const ls: Item[] = (data?.listings ?? []).map((t) => ({ kind: "listing", key: `listing:${t.id}`, id: t.id, date: t.listing.publishedAt, t }));
    const is: Item[] = (data?.investors ?? []).map((i) => ({ kind: "investor", key: `investor:${i.id}`, id: i.id, date: i.liveSince, i }));
    let all = [...ls, ...is];
    if (fav) {
      all = all.filter((x) => stars.starred.has(x.key)).map((x) => ({ ...x, date: stars.starred.get(x.key) ?? null }));
    }
    return all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [data, fav, stars.starred]);

  const sellersN = universe.filter((x) => x.kind === "listing").length;
  const buyersN = universe.length - sellersN;

  const needle = q.trim().toLowerCase();
  const matchesSearch = (x: Item) => {
    if (!needle) return true;
    const vals = x.kind === "listing"
      ? (({ listing: l }) => [l.codeName, l.refNo, l.headline, l.description, l.location, l.sector, ...l.productTags, ...l.marketTags])(x.t)
      : (({ i }) => [i.name, i.codeName, i.refNo, i.description, i.type, i.country, i.city, ...i.sectors, ...i.stages])(x);
    return vals.filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
  };
  const invPasses = (i: AdvisorInvestor, o: Partial<{ aum: string; ticket: string; revenue: string }> = {}) => {
    const f = { aum, ticket, revenue, ...o };
    if (type !== "all" && i.type !== type) return false;
    if (country !== "all" && i.country !== country) return false;
    return matchAum(i, f.aum) && matchTicket(i, f.ticket) && matchRevenue(i, f.revenue);
  };
  const passesFilters = (x: Item) => {
    if (fav) return true;
    if (x.kind === "listing") {
      if (sector !== "all" && x.t.listing.sector !== sector) return false;
      if (side === "sellers" && deal !== "all" && x.t.dealType !== deal) return false;
      return true;
    }
    if (side === "all") return sector === "all" || x.i.sectors.includes(sector) || isAgnostic(x.i.sectors);
    return invPasses(x.i);
  };
  const inSide = (x: Item) => side === "all" || (side === "sellers" ? x.kind === "listing" : x.kind === "investor");
  const sideItems = universe.filter(inSide);
  const filtered = sideItems.filter(passesFilters);
  const items = filtered.filter(matchesSearch);

  const allListings = universe.filter((x): x is Extract<Item, { kind: "listing" }> => x.kind === "listing");
  const allInvestors = universe.filter((x): x is Extract<Item, { kind: "investor" }> => x.kind === "investor");
  const sectors = useMemo(() => {
    const s = new Set<string>();
    allListings.forEach((x) => x.t.listing.sector && s.add(x.t.listing.sector));
    if (side === "all") allInvestors.forEach((x) => x.i.sectors.forEach((v) => !/agnostic/i.test(v) && s.add(v)));
    return [...s].sort();
  }, [allListings, allInvestors, side]);
  const dealTypes = [...new Set(allListings.map((x) => x.t.dealType).filter(Boolean) as string[])].sort();
  const types = [...new Set(allInvestors.map((x) => x.i.type).filter(Boolean) as string[])].sort();
  const countries = [...new Set(allInvestors.map((x) => x.i.country).filter(Boolean) as string[])].sort();
  const invCount = (k: "aum" | "ticket" | "revenue") => (v: string) =>
    allInvestors.filter((x) => matchesSearch(x) && invPasses(x.i, { [k]: v })).length;

  const current = items.find((x) => x.key === selected) ?? items[0] ?? null;
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }); }, [current?.key]);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [side, q, sector, deal, type, country, aum, ticket, revenue]);

  const openInSplit = (key: string) => {
    setSelected(key);
    persist("split");
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" }));
  };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = Math.max(0, items.findIndex((x) => x.key === current?.key));
    const next = items[Math.min(items.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      setSelected(next.key);
      listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"]`)?.scrollIntoView({ block: "nearest" });
    }
  };

  const lineText = (x: Item) => fav
    ? `Starred ${fmtDate(x.date)}`
    : x.kind === "listing" ? `Listing · posted ${fmtDate(x.date)}` : `Investor profile · live ${fmtDate(x.date)}`;
  const starOf = (x: Item) => x.kind === "listing"
    ? <SaveButton square saved={stars.isStarred("listing", x.id)} onClick={() => stars.toggle("listing", x.id)} />
    : <StarBtn saved={stars.isStarred("investor", x.id)} onClick={() => stars.toggle("investor", x.id)} />;

  const card = (x: Item, split: boolean) => x.kind === "listing" ? (
    <PublicListingCard l={x.t.listing} deal={x.t} topRight={starOf(x)}
      expanded={split ? expanded === x.key : true}
      onToggleExpand={split ? () => setExpanded((e) => (e === x.key ? null : x.key)) : undefined}
      selected={split && wide && current?.key === x.key}
      onSelect={() => (split && wide ? setSelected(x.key) : openInSplit(x.key))} />
  ) : (
    <PublicInvestorCard i={x.i} topRight={starOf(x)} selected={split && wide && current?.key === x.key}
      onClick={() => (split && wide ? setSelected(x.key) : openInSplit(x.key))} />
  );

  const subtitle = needle ? (
    <><b className="font-semibold text-foreground">{items.length}</b> of {filtered.length} match “{q.trim()}” ·{" "}
      <button type="button" onClick={() => setQ("")} className="text-[#2563EB] hover:underline">Clear search</button></>
  ) : fav ? "Sellers and buyers you starred"
    : side === "sellers" ? `${sellersN} live listing${sellersN === 1 ? "" : "s"}`
    : side === "buyers" ? `${buyersN} investor profile${buyersN === 1 ? "" : "s"}`
    : `${sellersN} live listing${sellersN === 1 ? "" : "s"} and ${buyersN} investor profile${buyersN === 1 ? "" : "s"}`;

  const tray = (
    <div role="tablist" aria-label="Type" className="inline-flex gap-1 rounded-[12px] border border-border bg-card p-1">
      {([["all", "All", universe.length], ["sellers", "Sellers", sellersN], ["buyers", "Buyers", buyersN]] as const).map(([v, label, n]) => {
        const on = side === v;
        return (
          <button key={v} role="tab" aria-selected={on} type="button" onClick={() => pickSide(v)}
            className={cn("inline-flex h-9 items-center gap-2 rounded-[9px] px-3 text-sm font-medium transition-colors",
              on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {v === "sellers" && <span className="h-2 w-2 rounded-full bg-[#F6A823]" />}
            {v === "buyers" && <span className="h-2 w-2 rounded-full bg-[#4338CA]" />}
            {label}
            <span className={cn("rounded-full px-1.5 text-[11.5px] font-semibold", on ? "bg-[#E0F5F2] text-[#0F766E]" : "bg-muted text-muted-foreground")}>{n}</span>
          </button>
        );
      })}
    </div>
  );

  const searchEmpty = (
    <div className="rounded-[14px] border border-dashed border-border py-14 text-center">
      <p className="text-sm font-semibold">Nothing matches “{q.trim()}”</p>
      <p className="mt-1 text-sm text-muted-foreground">Try another word, or clear the search.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setQ("")}>Clear search</Button>
    </div>
  );
  const favEmpty = (
    <div className="rounded-lg border border-border bg-card py-16 text-center shadow-card">
      <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
      <p className="text-sm font-semibold">
        {side === "sellers" ? "No sellers in your Favourites yet" : side === "buyers" ? "No buyers in your Favourites yet" : "Nothing in your Favourites yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Star a seller or buyer in Browse marketplace and it shows here.</p>
      <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/marketplace/browse">Open Browse marketplace</Link></Button>
    </div>
  );
  const filterEmpty = (
    <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
      <Store className="mx-auto mb-2 h-8 w-8 opacity-50" />
      <p>{side === "buyers" ? "No investors match your filters." : side === "sellers" ? "No listings match your filters yet." : "Nothing matches your filters yet."}</p>
    </div>
  );
  const empty = needle && filtered.length > 0 ? searchEmpty : fav && sideItems.length === 0 ? favEmpty : needle ? searchEmpty : filterEmpty;

  const loading = isLoading || (fav && stars.isLoading);
  const splitFixed = wide && view === "split" && !loading && items.length > 0;

  const panel = (x: Item) => x.kind === "listing" ? (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <RolePill kind="listing" />
          <span className="min-w-0 truncate text-sm font-semibold">{[x.t.listing.codeName, x.t.listing.refNo].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <SaveButton saved={stars.isStarred("listing", x.id)} onClick={() => stars.toggle("listing", x.id)} />
          <AdvisorNdaButton />
        </div>
      </div>
      <div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto p-5">
        <ListingDetail t={x.t} advisor />
      </div>
    </>
  ) : (
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col">
      <InvestorDetail key={x.id} i={x.i} saved={stars.isStarred("investor", x.id)} onSave={() => stars.toggle("investor", x.id)}
        pill={<RolePill kind="investor" />}
        actions={<div className="flex shrink-0 gap-2">
          <SaveButton saved={stars.isStarred("investor", x.id)} onClick={() => stars.toggle("investor", x.id)} />
          <AdvisorNdaButton />
        </div>} />
    </div>
  );

  return (
    <div className={splitFixed ? "flex h-[calc(100vh-7.5rem)] min-h-[520px] flex-col gap-5 [&>*]:shrink-0" : "space-y-5"}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            {fav ? <Star className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />} Discover
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{fav ? "Favourites" : "Browse marketplace"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {tray}
        <div className="relative w-full max-w-[380px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={fav ? "Search Favourites" : "Search sellers and buyers"} className="pl-9" />
        </div>
      </div>

      {!fav && (
        <div className="flex flex-wrap items-center gap-2">
          {side !== "buyers" && (
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {side === "sellers" && (
            <Select value={deal} onValueChange={setDeal}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Deal type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All deal types</SelectItem>
                {dealTypes.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {side === "buyers" && (
            <>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Investor type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <FilterMenu label="AUM size" heading="AUM size" options={AUM_FILTER} value={aum} onChange={setAum} countFor={invCount("aum")}
                hint="Fund size or AUM (group revenue for corporate buyers), matched on the band each card shows."
                foot="Exact AUM is shown only after the NDA is approved." />
              <FilterMenu label="Ticket size" heading="Ticket size" options={TICKET_FILTER} value={ticket} onChange={setTicket} countFor={invCount("ticket")}
                hint="Shows investors whose average investment is in that band."
                foot="Exact ticket sizes are shown only after the NDA is approved." />
              <FilterMenu label="Revenue minimum" heading="Revenue minimum" options={REVENUE_FILTER} value={revenue} onChange={setRevenue} countFor={invCount("revenue")}
                hint="Shows investors whose minimum is at or below the revenue you pick." />
            </>
          )}
        </div>
      )}

      {!fav && (
        <div className="flex items-start gap-2 rounded-[12px] border border-[#F3D9A6] bg-[#FFF4E0] px-[15px] py-3 text-[13px] text-[#8A5A06]">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span><b className="font-semibold">Sellers and buyers appear without their names.</b> You see code names, sectors and ranges. Names, contacts and exact figures show once an NDA for one of your clients is approved.</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[400px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? empty : view === "grid" ? (
        <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => <div key={x.key}><RoleLine kind={x.kind} text={lineText(x)} />{card(x, false)}</div>)}
        </div>
      ) : view === "split" ? (
        <div className={splitFixed ? "!shrink grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)] gap-[18px]" : "grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]"}>
          <div ref={listRef} tabIndex={-1} onKeyDown={onListKey}
            className={cn("space-y-[18px] outline-none", splitFixed && "min-h-0 overflow-y-scroll pr-2 [scrollbar-gutter:stable]")}>
            {items.map((x) => <div key={x.key} data-key={x.key}><RoleLine kind={x.kind} text={lineText(x)} />{card(x, true)}</div>)}
          </div>
          {wide && (
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {current ? panel(current) : <p className="py-16 text-center text-sm text-muted-foreground">Select a card to see the details.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((x) => (
            <div key={x.key} role="button" tabIndex={0} onClick={() => openInSplit(x.key)} onKeyDown={(e) => { if (e.key === "Enter") openInSplit(x.key); }}
              className="group flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-all duration-200 hover:border-accent hover:shadow-[var(--shadow-elevated)]">
              {x.kind === "listing" ? (
                <>
                  <SectorArt art={x.t.listing.coverArt ?? x.t.listing.sector} sector={x.t.listing.sector} imageId={x.t.listing.publicImageId} className="h-[54px] w-[96px] shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <RolePill kind="listing" />
                      <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent">{x.t.listing.headline || x.t.listing.codeName}</span>
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {[x.t.listing.verified && "Verified company", x.t.listing.hasFinancials && "Verified financials", x.t.listing.revenueBand, x.t.listing.sector, x.t.listing.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5"><ListingPill kind="hidden" newDays={x.t.listing.newDays} />{starOf(x)}</div>
                </>
              ) : (
                <>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><TypeIcon type={x.i.type} className="h-5 w-5 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <RolePill kind="investor" />
                      <span className="truncate text-sm font-semibold text-foreground">{x.i.name || x.i.codeName} <span className="font-normal text-muted-foreground">· {x.i.refNo}</span></span>
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {[x.i.country, x.i.ticketLabel && `Ticket ${x.i.ticketLabel}`, x.i.aumLabel && `${isCorporateBuyer(x.i.type) ? "Group revenue" : "AUM"} ${x.i.aumLabel}`, x.i.revLabel && `Revenue min. ${x.i.revLabel}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {!x.i.name && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"><Lock className="h-3 w-3" />Name after NDA</span>}
                  {starOf(x)}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
