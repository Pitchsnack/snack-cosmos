import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Lock, Search, Star, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useSavedIds } from "@/hooks/use-saved-ids";
import { PublicInvestorCard, TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { listBrowseInvestors } from "@/lib/investor-browse.functions";
import {
  AUM_FILTER, REVENUE_FILTER, TICKET_FILTER, isCorporateBuyer, matchAum, matchRevenue, matchTicket, revenueCardText,
  type FilterOpt, type PublicInvestor,
} from "@/lib/investor-browse";
import { cn } from "@/lib/utils";

function StarBtn({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={saved ? "Remove from saved" : "Save"} title={saved ? "Remove from saved" : "Save"}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-border bg-background hover:bg-muted">
      <Star className={cn("h-4 w-4", saved ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
    </button>
  );
}

/** Single-choice dropdown filter with hint, live counts and lock footnote. */
function FilterMenu({ label, heading, hint, foot, options, value, onChange, countFor }: {
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
      <div className="relative inline-flex">
        <PopoverTrigger asChild>
          <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open}
            className={cn("inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
              active ? "border-[#F3D9A6] bg-[#FFF4E0] pr-8 font-medium text-[#8A5A06]" : "border-input bg-background text-foreground",
              open && "border-[#F6A823] ring-[3px] ring-[rgba(246,168,35,.2)]")}>
            {active?.active ?? label}
            {!active && <span className="text-muted-foreground">▾</span>}
          </button>
        </PopoverTrigger>
        {active && (
          <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange("")}
            className="absolute right-1.5 top-1/2 grid h-[22px] w-[22px] -translate-y-1/2 place-items-center rounded text-[#8A5A06] hover:bg-[#F3D9A6]/60">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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

function Detail({ i, saved, onSave }: { i: PublicInvestor; saved: boolean; onSave: () => void }) {
  const corp = isCorporateBuyer(i.type);
  const rows: Array<[string, string]> = [
    ["Investor type", i.type || "—"],
    ["Ticket size", i.ticketLabel || "—"],
    [corp ? "Group revenue" : "Assets under management", i.aumLabel || "Undisclosed"],
    ["Revenue band", revenueCardText(i.revenueMinM, i.revenueMaxM) ?? "Not stated"],
    ["Preferred stages", i.stages.join(", ") || "—"],
    ["Deal types", i.dealTypes.join(", ") || "—"],
    ["Geography", i.geography || "—"],
  ];
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="min-w-0 truncate text-sm font-semibold">{i.name || i.codeName} · {i.refNo}</span>
        <StarBtn saved={saved} onClick={onSave} />
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <PublicInvestorCard i={i} className="mx-auto max-w-[420px]" />
        <div>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mandate · shown as ranges</h4>
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 border-b border-border py-1.5 text-[13px] last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right font-medium">{v}</span>
            </div>
          ))}
        </div>
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" />Shown after the NDA is approved
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Name & logo", "Website & contacts", "Decision-makers", "Exact AUM & ticket", "Portfolio"].map((c) => (
              <span key={c} className="rounded-full border border-amber-200 bg-background px-2 py-0.5 text-[11.5px] text-amber-800 dark:border-amber-800 dark:text-amber-300">{c}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/** Seller-side marketplace: public (hidden) investor profiles only. */
export function InvestorBrowse() {
  const fetchAll = useServerFn(listBrowseInvestors);
  const { data, isLoading } = useQuery({ queryKey: ["browse-investors"], queryFn: () => fetchAll(), staleTime: 60_000 });
  const all = useMemo(() => (data ?? []) as PublicInvestor[], [data]);

  const { view, persist } = usePersistentView("ps-investor-browse-view", undefined);
  const { ids: savedIds, toggle: toggleSave } = useSavedIds("ps.savedInvestors");

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [country, setCountry] = useState("all");
  const [aum, setAum] = useState("");
  const [ticket, setTicket] = useState("");
  const [revenue, setRevenue] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const types = useMemo(() => Array.from(new Set(all.map((i) => i.type).filter(Boolean) as string[])).sort(), [all]);
  const countries = useMemo(() => Array.from(new Set(all.map((i) => i.country).filter(Boolean) as string[])).sort(), [all]);

  const base = (i: PublicInvestor) => {
    if (type !== "all" && i.type !== type) return false;
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
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Discover
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Browse investors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilter ? (
              <><b className="font-semibold text-foreground">{items.length}</b> of {all.length} investors match your filters ·{" "}
                <button type="button" onClick={clearAll} className="text-[#2563EB] hover:underline">Clear filters</button></>
            ) : `${all.length} investor${all.length === 1 ? "" : "s"} looking for companies like yours`}
          </p>
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search investors" className="pl-9" />
        </div>
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
        <FilterMenu label="AUM size" heading="AUM size" options={AUM_FILTER} value={aum} onChange={setAum} countFor={count("aum")}
          hint="Fund size or AUM (group revenue for corporate buyers), matched on the range each card shows."
          foot="Exact AUM is shown only after the NDA is approved." />
        <FilterMenu label="Ticket size" heading="Ticket size" options={TICKET_FILTER} value={ticket} onChange={setTicket} countFor={count("ticket")}
          hint="Pick the amount you're raising or selling for. Shows investors whose ticket range covers it."
          foot="Exact ticket sizes are shown only after the NDA is approved." />
        <FilterMenu label="Revenue band" heading="Revenue band" options={REVENUE_FILTER} value={revenue} onChange={setRevenue} countFor={count("revenue")}
          hint="Pick the revenue range of the company you're selling. Shows investors who buy in that range." />
      </div>

      <div className="flex shrink-0 items-start gap-2 rounded-[10px] bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Investors appear as hidden profiles. Names, contacts and exact figures show in your Pipeline and Contacts once an NDA is approved.
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[260px] rounded-[14px]" />)}
        </div>
      ) : view === "grid" ? (
        items.length === 0 ? empty : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => <PublicInvestorCard key={i.id} i={i} topRight={<StarBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />} />)}
          </div>
        )
      ) : view === "split" ? (
        <div className={cn("grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]", splitFixed && "min-h-0 flex-1 items-stretch")}>
          <div ref={listRef} tabIndex={-1} onKeyDown={onListKey}
            className={cn("space-y-3 outline-none", splitFixed && "min-h-0 overflow-y-scroll pr-2 [scrollbar-gutter:stable]")}>
            {items.length === 0 ? empty : items.map((i) => (
              <div key={i.id} data-id={i.id}>
                <PublicInvestorCard i={i} selected={current?.id === i.id}
                  expanded={expandedId === i.id} onToggleExpand={() => setExpandedId((e) => (e === i.id ? null : i.id))}
                  onClick={() => setSelected(i.id)}
                  topRight={<StarBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />} />
              </div>
            ))}
          </div>
          {wide && (
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {current ? (
                <Detail key={current.id} i={current} saved={savedIds.has(current.id)} onSave={() => toggleSave(current.id)} />
              ) : (
                <p className="px-6 py-16 text-center text-sm text-muted-foreground">No investor selected. Widen or clear the filters to see investors.</p>
              )}
            </div>
          )}
        </div>
      ) : items.length === 0 ? empty : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><TypeIcon type={i.type} className="h-5 w-5 text-muted-foreground" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{i.name || i.codeName} <span className="font-normal text-muted-foreground">· {i.refNo}</span></div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {[i.type, i.country, i.ticketLabel && `Ticket ${i.ticketLabel}`, i.aumLabel && `AUM ${i.aumLabel}`,
                    i.revenueMinM != null && revenueCardText(i.revenueMinM, i.revenueMaxM)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {!i.name && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"><Lock className="h-3 w-3" />Name after NDA</span>}
              <StarBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
