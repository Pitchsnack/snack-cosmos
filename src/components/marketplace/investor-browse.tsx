import { useMemo, useState } from "react";
import { Bookmark, Briefcase, Building2, Coins, Layers, MapPin, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useInvestors } from "@/hooks/use-investors";
import type { InvestorListItem } from "@/lib/investors.functions";
import { useSavedIds } from "@/hooks/use-saved-ids";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPublicBuyers } from "@/lib/buyer-profile.functions";
import type { PublicBuyer } from "@/lib/buyer-profile";
import { BuyerBrowseCard } from "@/components/marketplace/buyer-browse-card";

function ticket(i: InvestorListItem) {
  const min = i.min_ticket_size?.trim();
  const max = i.max_ticket_size?.trim();
  if (min && max) return `${min} – ${max}`;
  return min || max || i.ticket_size || null;
}

function Meta({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 truncate text-[12px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function SaveBtn({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={saved ? "Saved" : "Save"}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted",
        saved && "border-accent/50 bg-accent/10",
      )}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-accent text-accent")} />
    </button>
  );
}

function InvestorTile({
  i, saved, onSave, onSelect, selected,
}: { i: InvestorListItem; saved: boolean; onSave: () => void; onSelect: () => void; selected?: boolean }) {
  const t = ticket(i);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
      className={cn(
        "flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-border bg-card p-4 shadow-card transition-colors",
        selected && "border-accent ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-foreground">{i.investor_name}</div>
          {i.investor_type && <Badge variant="outline" className="mt-1 text-[11px]">{i.investor_type}</Badge>}
        </div>
        <SaveBtn saved={saved} onClick={onSave} />
      </div>
      {i.short_description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{i.short_description}</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {i.country && <Meta icon={MapPin}>{i.country}</Meta>}
        {t && <Meta icon={Coins}>{t}</Meta>}
        {i.aum && <Meta icon={Building2}>AUM {i.aum}</Meta>}
        {i.preferred_stages.length > 0 && <Meta icon={Layers}>{i.preferred_stages.slice(0, 2).join(", ")}</Meta>}
      </div>
      {i.preferred_industries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {i.preferred_industries.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function InvestorDetail({ i }: { i: InvestorListItem }) {
  const t = ticket(i);
  const rows: Array<[string, React.ReactNode]> = [
    ["Investor type", i.investor_type || "—"],
    ["Country", i.country || "—"],
    ["Ticket size", t || "—"],
    ["Assets under management", i.aum || "—"],
    ["Preferred stages", i.preferred_stages.join(", ") || "—"],
    ["Focus sectors", i.preferred_industries.join(", ") || "—"],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{i.investor_name}</h3>
        {i.short_description && <p className="mt-1 text-[13px] text-muted-foreground">{i.short_description}</p>}
      </div>
      <div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 border-b border-border py-1.5 text-[13px] last:border-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      {i.long_description && (
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mandate</h4>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{i.long_description}</p>
        </div>
      )}
    </div>
  );
}

/** Seller-side marketplace: investors and funds only — never SME listings. */
export function InvestorBrowse() {
  const { data, isLoading } = useInvestors();
  const fetchBuyers = useServerFn(listPublicBuyers);
  const { data: buyerData } = useQuery({ queryKey: ["public-buyers"], queryFn: () => fetchBuyers() });
  const buyers = (buyerData ?? []) as PublicBuyer[];
  const all = useMemo(() => (data ?? []) as InvestorListItem[], [data]);

  const { view, persist } = usePersistentView("ps-investor-browse-view", undefined);
  const { ids: savedIds, toggle: toggleSave } = useSavedIds("ps.savedInvestors");

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [country, setCountry] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const types = useMemo(() => Array.from(new Set(all.map((i) => i.investor_type).filter(Boolean) as string[])).sort(), [all]);
  const countries = useMemo(() => Array.from(new Set(all.map((i) => i.country).filter(Boolean) as string[])).sort(), [all]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((i) => {
      if (type !== "all" && i.investor_type !== type) return false;
      if (country !== "all" && i.country !== country) return false;
      if (!needle) return true;
      return [i.investor_name, i.short_description, i.investor_type, i.country, ...i.preferred_industries, ...i.preferred_stages]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [all, q, type, country]);

  const current = items.find((i) => i.id === selected) ?? items[0] ?? null;
  const hasFilter = !!q || type !== "all" || country !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Discover
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Browse investors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length > 0
              ? `${items.length} investor${items.length === 1 ? "" : "s"} looking for companies like yours`
              : "Investors and funds appear here."}
          </p>
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search investors" className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Investor type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setType("all"); setCountry("all"); }}>
            <X className="mr-1 h-4 w-4" />Clear
          </Button>
        )}
      </div>

      {buyers.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Verified buyers on PitchSnack</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buyers.map((b) => <BuyerBrowseCard key={b.id} b={b} />)}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[180px] rounded-[14px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No investors match your filters yet.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <InvestorTile key={i.id} i={i} saved={savedIds.has(i.id)} onSave={() => toggleSave(i.id)} onSelect={() => setSelected(i.id)} />
          ))}
        </div>
      ) : view === "split" ? (
        <div className="grid items-start gap-[18px] min-[1100px]:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-3">
            {items.map((i) => (
              <InvestorTile key={i.id} i={i} saved={savedIds.has(i.id)} onSave={() => toggleSave(i.id)}
                onSelect={() => setSelected(i.id)} selected={current?.id === i.id} />
            ))}
          </div>
          <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm min-[1100px]:flex">
            {current ? (
              <div className="overflow-y-auto p-5"><InvestorDetail i={current} /></div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Select an investor to see the details.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} role="button" tabIndex={0} onClick={() => setSelected(i.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setSelected(i.id); }}
              className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{i.investor_name}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {[i.investor_type, i.country, ticket(i), i.preferred_industries.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
                </div>
              </div>
              <SaveBtn saved={savedIds.has(i.id)} onClick={() => toggleSave(i.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
