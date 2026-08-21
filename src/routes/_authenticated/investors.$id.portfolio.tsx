import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Building2, Loader2, PieChart, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/entity-control/control-toolbar";
import {
  EntityLogo,
  EntityRow,
  GroupHeader,
  RankedBar,
  SidebarCard,
  StatRow,
} from "@/components/relationships/portfolio-ui";
import { getInvestorPortfolio } from "@/lib/investors.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { isUuid } from "@/lib/uuid";

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
  component: InvestorPortfolioPage,
});

const PREVIEW_COUNT = 5;

type GroupKey = "industry" | "product" | "market" | "stage" | "country";

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "industry", label: "Industry" },
  { value: "product", label: "Product & Service Tags" },
  { value: "market", label: "Market Tags" },
  { value: "stage", label: "Investment Stage" },
  { value: "country", label: "Country / Region" },
];

const EARLY_STAGES = ["Pre-Seed", "Seed", "Series A"];

function InvestorPortfolioPage() {
  const { id } = Route.useParams();
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
  const [sort, setSort] = useState<"az" | "za">("az");
  const [open, setOpen] = useState<Record<string, boolean>>({});
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
      return true;
    });
    return list.sort((a, b) =>
      sort === "az"
        ? a.startup_name.localeCompare(b.startup_name)
        : b.startup_name.localeCompare(a.startup_name),
    );
  }, [startups, q, industry, stage, country, sort]);

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

  const groups = useMemo(() => {
    const map = new Map<string, typeof filteredStartups>();
    for (const s of filteredStartups) {
      let keys: string[] = [];
      if (groupBy === "industry") keys = s.industry;
      else if (groupBy === "product") keys = s.product_tags;
      else if (groupBy === "market") keys = s.market_tags;
      else if (groupBy === "stage") keys = s.investment_stage ? [s.investment_stage] : [];
      else keys = s.country ? [s.country] : [];
      if (keys.length === 0) keys = ["Other"];
      for (const k of keys) {
        const arr = map.get(k) ?? [];
        arr.push(s);
        map.set(k, arr);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
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
      topCountries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [startups]);

  if (!valid) return <p className="text-sm text-destructive">Invalid investor id.</p>;
  if (isLoading)
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Loading portfolio…</span>
      </div>
    );
  if (error || !data)
    return <p className="text-sm text-destructive">Failed to load portfolio.</p>;

  const inv = data.investor;

  return (
    <div className="space-y-5">
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
          <Link to="/investors/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to investor
          </Link>
        </Button>
      </header>

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
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition " +
              (tab === t.key
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Intro summary */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
            <PieChart className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
            <p className="text-sm text-muted-foreground">
              {tab === "startups" ? (
                <>
                  {inv.investor_name} is connected to {startups.length} portfolio startup
                  {startups.length === 1 ? "" : "s"}
                  {summary.industries > 0 && <> across {summary.industries} industries</>}. Group,
                  search and filter to explore the portfolio instead of scrolling one long list.
                </>
              ) : (
                <>
                  {investors.length} investor{investors.length === 1 ? "" : "s"} are linked to{" "}
                  {inv.investor_name} — co-investors and firms in its investor network.
                </>
              )}
            </p>
          </div>

          {/* Control bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-card">
            <div className="relative min-w-[220px] flex-1">
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
                <FilterSelect label="Country: All" value={country} options={facets.countries} onChange={setCountry} />
              </>
            ) : (
              <>
                <FilterSelect label="Type: All" value={invType} options={facets.invTypes} onChange={setInvType} width="w-48" />
                <FilterSelect label="Country: All" value={invCountry} options={facets.invCountries} onChange={setInvCountry} />
              </>
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
            {tab === "startups" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(Object.fromEntries(groups.map(([k]) => [k, true])))}
                >
                  Expand all
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOpen({})}>
                  Collapse all
                </Button>
              </div>
            )}
          </div>

          {tab === "startups" ? (
            <>
              <p className="text-xs text-muted-foreground">
                {filteredStartups.length} startup{filteredStartups.length === 1 ? "" : "s"}
              </p>
              {groups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No startups match the current filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map(([key, items]) => {
                    const isOpen = !!open[key];
                    const visible = isOpen ? items : items.slice(0, PREVIEW_COUNT);
                    return (
                      <section key={key} className="rounded-lg border border-border bg-card p-4 shadow-card">
                        <GroupHeader
                          title={key}
                          count={items.length}
                          open={isOpen}
                          onToggle={() => setOpen((p) => ({ ...p, [key]: !p[key] }))}
                        />
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {visible.map((s) => (
                            <EntityRow
                              key={s.id}
                              to="/startups/$id"
                              id={s.id}
                              name={s.startup_name}
                              logoUrl={s.logo_signed_url}
                              description={s.short_description}
                              tags={[s.investment_stage, ...s.industry.slice(0, 2)]}
                              country={s.country}
                              websiteUrl={s.website_url}
                            />
                          ))}
                        </div>
                        {!isOpen && items.length > PREVIEW_COUNT && (
                          <button
                            type="button"
                            onClick={() => setOpen((p) => ({ ...p, [key]: true }))}
                            className="mt-3 text-xs font-medium text-accent hover:underline"
                          >
                            +{items.length - PREVIEW_COUNT} more in {key}
                          </button>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {filteredInvestors.length} investor{filteredInvestors.length === 1 ? "" : "s"}
              </p>
              {filteredInvestors.length === 0 ? (
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
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <SidebarCard title="Portfolio summary">
            <StatRow label="Total startups" value={summary.total} />
            <StatRow label="Portfolio investors" value={investors.length} />
            <StatRow label="Industries" value={summary.industries} />
            <StatRow label="Countries / regions" value={summary.countries} />
            <StatRow label="Early stage" value={`${summary.earlyPct}%`} />
            <StatRow label="Growth stage" value={`${summary.growthPct}%`} />
          </SidebarCard>

          {summary.topCountries.length > 0 && (
            <SidebarCard title="Top countries / regions">
              {summary.topCountries.map(([c, n]) => (
                <RankedBar key={c} label={c} value={n} max={summary.topCountries[0][1]} />
              ))}
            </SidebarCard>
          )}

          <SidebarCard title="Quick group by">
            <div className="flex flex-col gap-1">
              {GROUP_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => {
                    setTab("startups");
                    setGroupBy(g.value);
                  }}
                  className={
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition " +
                    (groupBy === g.value
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {g.label}
                </button>
              ))}
            </div>
          </SidebarCard>
        </aside>
      </div>
    </div>
  );
}
