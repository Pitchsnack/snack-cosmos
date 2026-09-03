import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/entity-control/control-toolbar";
import {
  EntityLogo,
  EntityRow,
  RankedBar,
  SidebarCard,
  StatRow,
} from "@/components/relationships/portfolio-ui";
import { getStartupInvestors } from "@/lib/startups.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { isUuid } from "@/lib/uuid";
import { HatSkeleton } from "@/components/ui/PitchSnackLoader";

export const Route = createFileRoute("/_authenticated/startups/$id/investors")({
  head: () => ({
    meta: [
      { title: "Startup Investors — SnackPortal2" },
      {
        name: "description",
        content: "Browse, search and filter every investor connected to this startup.",
      },
      { property: "og:title", content: "Startup Investors — SnackPortal2" },
      {
        property: "og:description",
        content: "Browse, search and filter every investor connected to this startup.",
      },
    ],
  }),
  component: StartupInvestorsPage,
});

function StartupInvestorsPage() {
  const { id } = Route.useParams();
  const valid = isUuid(id);
  const fn = useServerFn(getStartupInvestors);
  const { data, isLoading, error } = useQuery({
    queryKey: ["startup-investors-page", id],
    queryFn: () => fn({ data: { id } }),
    enabled: useHasSession() && valid,
  });

  const [q, setQ] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [country, setCountry] = useState<string | undefined>();
  const [sort, setSort] = useState<"az" | "za">("az");

  const investors = data?.investors ?? [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = investors.filter((i) => {
      if (term && !`${i.investor_name} ${i.short_description ?? ""}`.toLowerCase().includes(term))
        return false;
      if (type && i.investor_type !== type) return false;
      if (country && i.country !== country) return false;
      return true;
    });
    return list.sort((a, b) =>
      sort === "az"
        ? a.investor_name.localeCompare(b.investor_name)
        : b.investor_name.localeCompare(a.investor_name),
    );
  }, [investors, q, type, country, sort]);

  const facets = useMemo(() => {
    const uniq = (vals: (string | null)[]) =>
      [...new Set(vals.filter((v): v is string => !!v))].sort().map((v) => ({ value: v, label: v }));
    return {
      types: uniq(investors.map((i) => i.investor_type)),
      countries: uniq(investors.map((i) => i.country)),
    };
  }, [investors]);

  const stats = useMemo(() => {
    const types = new Map<string, number>();
    const countries = new Set<string>();
    investors.forEach((i) => {
      if (i.investor_type) types.set(i.investor_type, (types.get(i.investor_type) ?? 0) + 1);
      if (i.country) countries.add(i.country);
    });
    return {
      types: [...types.entries()].sort((a, b) => b[1] - a[1]),
      countries: countries.size,
    };
  }, [investors]);

  if (!valid) return <p className="text-sm text-destructive">Invalid startup id.</p>;
  if (isLoading)
    return (
      <div className="min-h-[40vh] p-6">
        <HatSkeleton lines={5} headMessage="Loading investors…" />
      </div>
    );
  if (error || !data) return <p className="text-sm text-destructive">Failed to load investors.</p>;

  const s = data.startup;

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/startups" className="hover:text-foreground">
          Startups
        </Link>
        <span>›</span>
        <Link to="/startups/$id" params={{ id }} className="hover:text-foreground">
          {s.startup_name}
        </Link>
        <span>›</span>
        <span className="font-medium text-foreground">Investors</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <EntityLogo name={s.startup_name} logoUrl={s.logo_signed_url} className="h-14 w-14" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{s.startup_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {s.country && <span>{s.country}</span>}
              {s.country && s.investment_stage && <span aria-hidden>·</span>}
              {s.investment_stage && <span>{s.investment_stage}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.industry.slice(0, 3).map((i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/startups/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to startup
          </Link>
        </Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
            <p className="text-sm text-muted-foreground">
              {investors.length} investor{investors.length === 1 ? "" : "s"} connected to{" "}
              {s.startup_name}. Search and filter by type or country to explore the cap-table network.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-card">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search investors…"
                className="h-9 pl-8"
              />
            </div>
            <FilterSelect label="Type: All" value={type} options={facets.types} onChange={setType} width="w-48" />
            <FilterSelect label="Country: All" value={country} options={facets.countries} onChange={setCountry} />
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

          <p className="text-xs text-muted-foreground">
            {filtered.length} investor{filtered.length === 1 ? "" : "s"}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No investors match the current filters.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filtered.map((i) => (
                <EntityRow
                  key={i.id}
                  to="/investors/$id"
                  id={i.id}
                  name={i.investor_name}
                  logoUrl={i.logo_signed_url}
                  description={i.short_description}
                  tags={[i.investor_type, ...i.preferred_stages.slice(0, 2)]}
                  country={i.country}
                  websiteUrl={i.website_url}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <SidebarCard title="Investor summary">
            <StatRow label="Total investors" value={investors.length} />
            <StatRow label="Investor types" value={stats.types.length} />
            <StatRow label="Countries / regions" value={stats.countries} />
          </SidebarCard>

          {stats.types.length > 0 && (
            <SidebarCard title="By investor type">
              {stats.types.slice(0, 6).map(([t, n]) => (
                <RankedBar key={t} label={t} value={n} max={stats.types[0][1]} />
              ))}
            </SidebarCard>
          )}
        </aside>
      </div>
    </div>
  );
}
