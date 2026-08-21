import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  investorDirectorySearchSchema,
  type InvestorDirectorySearch,
} from "@/routes/_authenticated/investors.index";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Globe2,
  Hash,
  Info,
  PieChart,
  Layers,
  Loader2,
  Maximize2,
  Minus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Tags,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterSelect } from "@/components/entity-control/control-toolbar";
import { EntityLogo, EntityRow, SidebarCard } from "@/components/relationships/portfolio-ui";
import {
  ChipRow,
  GroupCardHeader,
  OTHER_GROUP,
  type ChipItem,
} from "@/components/relationships/portfolio-chips";
import { getInvestorPortfolio } from "@/lib/investors.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { isUuid } from "@/lib/uuid";
import { cn } from "@/lib/utils";

export type InvestorPortfolioSearch = InvestorDirectorySearch;

export const Route = createFileRoute("/_authenticated/investors/$id/portfolio")({
  head: () => ({
    meta: [
      { title: "Investor Portfolio — SnackPortal2" },
      {
        name: "description",
        content: "Browse, group and filter every startup and investor connected to this investor.",
      },
      { property: "og:title", content: "Investor Portfolio — SnackPortal2" },
      {
        property: "og:description",
        content: "Browse, group and filter every startup and investor connected to this investor.",
      },
    ],
  }),
  validateSearch: investorDirectorySearchSchema,
  component: InvestorPortfolioPage,
});

const GROUPS_PER_PAGE = 6;

type GroupKey = "industry" | "keywords" | "product" | "market" | "stage" | "country";

const GROUP_OPTIONS: { value: GroupKey; label: string; icon: typeof Layers }[] = [
  { value: "industry", label: "Industry", icon: Layers },
  { value: "keywords", label: "Keywords", icon: Hash },
  { value: "product", label: "Product & Service Tags", icon: Tags },
  { value: "market", label: "Market Tags", icon: ShoppingCart },
  { value: "stage", label: "Investment Stage", icon: TrendingUp },
  { value: "country", label: "Country / Region", icon: Globe2 },
];

const EARLY_STAGES = ["Pre-Seed", "Seed", "Series A"];

function InvestorPortfolioPage() {
  const { id } = Route.useParams();
  const rawSearch = useRouterState({ select: (s) => s.location.search });
  const parsed = investorDirectorySearchSchema.safeParse(rawSearch);
  const baseSearch: InvestorDirectorySearch = parsed.success ? parsed.data : { selected: id };
  const returnSearch = baseSearch.view === "split" ? { ...baseSearch, selected: id } : { ...baseSearch, panel: id };
  const valid = isUuid(id);
  const fn = useServerFn(getInvestorPortfolio);
  const { data, isLoading, error } = useQuery({
    queryKey: ["investor-portfolio", id],
    queryFn: () => fn({ data: { id } }),
    enabled: useHasSession() && valid,
  });

  const [tab, setTab] = useState<"startups" | "investors">("startups");
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<GroupKey>("industry");
  const [industry, setIndustry] = useState<string | undefined>();
  const [stage, setStage] = useState<string | undefined>();
  const [country, setCountry] = useState<string | undefined>();
  const [stageBand, setStageBand] = useState<"early" | "growth" | undefined>();
  const [sort, setSort] = useState<"az" | "za">("az");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [groupLimit, setGroupLimit] = useState(GROUPS_PER_PAGE);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [invType, setInvType] = useState<string | undefined>();
  const [invCountry, setInvCountry] = useState<string | undefined>();

  const startups = data?.startups ?? [];
  const investors = data?.investors ?? [];

  const filteredStartups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = startups.filter((s) => {
      if (term && !`${s.startup_name} ${s.short_description ?? ""}`.toLowerCase().includes(term))
        return false;
      if (industry && !s.industry.includes(industry)) return false;
      if (stage && s.investment_stage !== stage) return false;
      if (country && s.country !== country) return false;
      if (stageBand) {
        if (!s.investment_stage) return false;
        const early = EARLY_STAGES.includes(s.investment_stage);
        if (stageBand === "early" ? !early : early) return false;
      }
      return true;
    });
    return list.sort((a, b) =>
      sort === "az"
        ? a.startup_name.localeCompare(b.startup_name)
        : b.startup_name.localeCompare(a.startup_name),
    );
  }, [startups, q, industry, stage, country, stageBand, sort]);

  const filteredInvestors = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = investors.filter((i) => {
      if (term && !`${i.investor_name} ${i.short_description ?? ""}`.toLowerCase().includes(term))
        return false;
      if (invType && i.investor_type !== invType) return false;
      if (invCountry && i.country !== invCountry) return false;
      return true;
    });
    return list.sort((a, b) =>
      sort === "az"
        ? a.investor_name.localeCompare(b.investor_name)
        : b.investor_name.localeCompare(a.investor_name),
    );
  }, [investors, q, invType, invCountry, sort]);

  /** Each startup lands in exactly one group — its primary value for the dimension. */
  const groups = useMemo(() => {
    const map = new Map<string, ChipItem[]>();
    for (const s of filteredStartups) {
      let keys: string[] = [];
      if (groupBy === "industry") keys = s.industry;
      else if (groupBy === "product") keys = s.product_tags;
      else if (groupBy === "market") keys = s.market_tags;
      else if (groupBy === "keywords") keys = [...s.product_tags, ...s.market_tags];
      else if (groupBy === "stage") keys = s.investment_stage ? [s.investment_stage] : [];
      else keys = s.country ? [s.country] : [];
      const key = keys.find((k) => !!k?.trim()) ?? OTHER_GROUP;
      const arr = map.get(key) ?? [];
      arr.push({ id: s.id, name: s.startup_name, logoUrl: s.logo_signed_url });
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === OTHER_GROUP) return 1;
      if (b[0] === OTHER_GROUP) return -1;
      return b[1].length - a[1].length || a[0].localeCompare(b[0]);
    });
  }, [filteredStartups, groupBy]);

  const facets = useMemo(() => {
    const uniq = (vals: (string | null)[]) =>
      [...new Set(vals.filter((v): v is string => !!v))].sort().map((v) => ({ value: v, label: v }));
    return {
      industries: uniq(startups.flatMap((s) => s.industry)),
      stages: uniq(startups.map((s) => s.investment_stage)),
      countries: uniq(startups.map((s) => s.country)),
      invTypes: uniq(investors.map((i) => i.investor_type)),
      invCountries: uniq(investors.map((i) => i.country)),
    };
  }, [startups, investors]);

  const summary = useMemo(() => {
    const industries = new Set(startups.flatMap((s) => s.industry));
    const countries = new Map<string, number>();
    startups.forEach((s) => {
      if (s.country) countries.set(s.country, (countries.get(s.country) ?? 0) + 1);
    });
    const staged = startups.filter((s) => s.investment_stage);
    const early = staged.filter((s) => EARLY_STAGES.includes(s.investment_stage!)).length;
    return {
      total: startups.length,
      industries: industries.size,
      countries: countries.size,
      earlyPct: staged.length ? Math.round((early / staged.length) * 100) : 0,
      growthPct: staged.length ? 100 - Math.round((early / staged.length) * 100) : 0,
      allCountries: [...countries.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [startups]);

  const resetFilters = () => {
    setIndustry(undefined);
    setStage(undefined);
    setCountry(undefined);
    setStageBand(undefined);
    setQ("");
  };

  if (!valid) return <p className="text-sm text-destructive">Invalid investor id.</p>;
  if (isLoading)
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Loading portfolio…</span>
      </div>
    );
  if (error || !data) return <p className="text-sm text-destructive">Failed to load portfolio.</p>;

  const inv = data.investor;
  const visibleGroups = groups.slice(0, groupLimit);
  const topCountries = showAllCountries ? summary.allCountries : summary.allCountries.slice(0, 5);
  const maxCountry = summary.allCountries[0]?.[1] ?? 0;

  return (
    <div className="-mx-2 my-6">
      <div className="mx-auto max-w-[1280px] space-y-5 rounded-2xl border border-[#E8EAED] bg-card p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">

        <Link to="/investors" className="hover:text-foreground">
          Investors
        </Link>
        <span>›</span>
        <Link to="/investors/$id" params={{ id }} className="hover:text-foreground">
          {inv.investor_name}
        </Link>
        <span>›</span>
        <span className="font-medium text-foreground">Portfolio</span>
      </nav>

      {/* Identity header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <EntityLogo name={inv.investor_name} logoUrl={inv.logo_signed_url} className="h-14 w-14" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{inv.investor_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {inv.country && <span>{inv.country}</span>}
              {inv.country && inv.investor_type && <span aria-hidden>·</span>}
              {inv.investor_type && <span>{inv.investor_type}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {inv.status && <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>}
              {inv.visibility && <Badge variant="outline" className="text-[10px]">{inv.visibility}</Badge>}
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/investors" search={returnSearch}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to investor
          </Link>
        </Button>
      </header>

      {/* Section heading */}
      <h2 className="!mb-5 text-[22px] font-semibold tracking-tight">Portfolio</h2>

      {/* Relationship tabs */}
      <div className="flex flex-wrap gap-2">

        {(
          [
            { key: "startups", label: `Portfolio Startups (${startups.length})` },
            { key: "investors", label: `Portfolio Investors (${investors.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
              tab === t.key
                ? "border-link/40 bg-link/10 text-link"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg border border-link/20 bg-link/5 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-link/10 text-link">
              <BarChart3 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="text-[13px] leading-relaxed text-foreground/80">
              {tab === "startups" ? (
                <>
                  {inv.investor_name} is connected to {startups.length} portfolio startup
                  {startups.length === 1 ? "" : "s"}
                  {summary.industries > 0 && <> across {summary.industries} industries</>}. Group,
                  search and filter to explore the portfolio.
                </>
              ) : (
                <>
                  {investors.length} investor{investors.length === 1 ? "" : "s"} are linked to{" "}
                  {inv.investor_name} — co-investors and firms in its investor network.
                </>
              )}
            </p>
          </div>

          {/* Toolbar — row 1 */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "startups" ? "Search startups in portfolio…" : "Search investors…"}
                className="h-9 pl-8"
              />
            </div>
            {tab === "startups" ? (
              <>
                <FilterSelect
                  label="Group by: Industry"
                  value={groupBy}
                  options={GROUP_OPTIONS.map((g) => ({ value: g.value, label: `Group by: ${g.label}` }))}
                  onChange={(v) => setGroupBy((v as GroupKey) ?? "industry")}
                  width="w-56"
                />
                <FilterSelect label="Industry: All" value={industry} options={facets.industries} onChange={setIndustry} />
                <FilterSelect label="Stage: All" value={stage} options={facets.stages} onChange={setStage} width="w-36" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shrink-0">
                      <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> More filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      More filters
                    </div>
                    <FilterSelect
                      label="Country: All"
                      value={country}
                      options={facets.countries}
                      onChange={setCountry}
                      width="w-full"
                    />
                    <FilterSelect
                      label="Stage band: All"
                      value={stageBand}
                      options={[
                        { value: "early", label: "Early stage" },
                        { value: "growth", label: "Growth stage" },
                      ]}
                      onChange={(v) => setStageBand((v as "early" | "growth") ?? undefined)}
                      width="w-full"
                    />
                    <Button variant="ghost" size="sm" className="w-full" onClick={resetFilters}>
                      Clear all
                    </Button>
                  </PopoverContent>
                </Popover>
              </>
            ) : (
              <>
                <FilterSelect label="Type: All" value={invType} options={facets.invTypes} onChange={setInvType} width="w-48" />
                <FilterSelect label="Country: All" value={invCountry} options={facets.invCountries} onChange={setInvCountry} />
              </>
            )}
          </div>

          {/* Toolbar — row 2 */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {tab === "startups"
                ? `${filteredStartups.length} startup${filteredStartups.length === 1 ? "" : "s"}`
                : `${filteredInvestors.length} investor${filteredInvestors.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2">
              {tab === "startups" && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => setOpen(Object.fromEntries(groups.map(([k]) => [k, true])))}
                  >
                    <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Expand all
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen({})}>
                    <Minus className="mr-1.5 h-3.5 w-3.5" /> Collapse all
                  </Button>
                </div>
              )}
              <FilterSelect
                label="Sort: A–Z"
                value={sort}
                options={[
                  { value: "az", label: "Sort: A–Z" },
                  { value: "za", label: "Sort: Z–A" },
                ]}
                onChange={(v) => setSort((v as "az" | "za") ?? "az")}
                width="w-36"
              />
            </div>
          </div>

          {tab === "startups" ? (
            <>
              {groups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No startups match the current filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleGroups.map(([key, items]) => {
                    const isOpen = !!open[key];
                    return (
                      <section
                        key={key}
                        className="rounded-xl border border-[#EEF0F3] bg-card px-5 py-[7px]"
                      >
                        <GroupCardHeader
                          title={key}
                          count={items.length}
                          expanded={isOpen}
                          onToggle={() => setOpen((p) => ({ ...p, [key]: !p[key] }))}
                        />
                        <div className="mt-2">

                          <ChipRow
                            items={items}
                            expanded={isOpen}
                            onExpand={() => setOpen((p) => ({ ...p, [key]: true }))}
                          />
                        </div>
                      </section>
                    );
                  })}

                  {groups.length > groupLimit && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setGroupLimit((n) => n + GROUPS_PER_PAGE)}
                    >
                      Load more startups
                      <ChevronDown className="ml-1.5 h-4 w-4" />
                    </Button>
                  )}

                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    Classifications are based on startup information and may be updated over time.
                  </div>
                </div>
              )}
            </>
          ) : filteredInvestors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No portfolio investors match the current filters.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filteredInvestors.map((i) => (
                <EntityRow
                  key={i.id}
                  to="/investors/$id"
                  id={i.id}
                  name={i.investor_name}
                  logoUrl={i.logo_signed_url}
                  description={i.short_description}
                  tags={[i.investor_type]}
                  country={i.country}
                  websiteUrl={i.website_url}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <SidebarCard title="Portfolio Summary" icon={<PieChart className="h-4 w-4 text-link" strokeWidth={2} />}>
            <SummaryRow
              label="Total startups"
              value={summary.total}
              onClick={() => {
                setTab("startups");
                resetFilters();
              }}
            />
            <SummaryRow
              label="Industries"
              value={summary.industries}
              onClick={() => {
                setTab("startups");
                setGroupBy("industry");
              }}
            />
            <SummaryRow
              label="Countries / regions"
              value={summary.countries}
              onClick={() => {
                setTab("startups");
                setGroupBy("country");
              }}
            />
            <SummaryRow
              label="Early stage"
              value={`${summary.earlyPct}%`}
              accent
              onClick={() => {
                setTab("startups");
                setStageBand("early");
              }}
            />
            <SummaryRow
              label="Growth stage"
              value={`${summary.growthPct}%`}
              accent
              onClick={() => {
                setTab("startups");
                setStageBand("growth");
              }}
            />
          </SidebarCard>

          {summary.allCountries.length > 0 && (
            <SidebarCard title="Top Countries / Regions">
              {topCountries.map(([c, n]) => (
                <div key={c} className="py-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{c}</span>
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-link"
                      style={{ width: `${maxCountry > 0 ? Math.max(6, (n / maxCountry) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {summary.allCountries.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllCountries((v) => !v)}
                  className="mt-2 text-xs font-medium text-link hover:underline"
                >
                  {showAllCountries ? "Show less" : `+${summary.allCountries.length - 5} more`}
                </button>
              )}
            </SidebarCard>
          )}

          <SidebarCard title="Quick Group By">
            <div className="flex flex-col gap-1">
              {GROUP_OPTIONS.map((g) => {
                const Icon = g.icon;
                const active = groupBy === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      setTab("startups");
                      setGroupBy(g.value);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
                      active
                        ? "bg-link/10 font-medium text-link"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {g.label}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </SidebarCard>
        </aside>
      </div>
      </div>
    </div>
  );
}


function SummaryRow({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-sm transition hover:bg-muted"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <span className={cn("font-medium tabular-nums", accent && "text-link")}>{value}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}
