import type {
  ControlInvestorRow,
  ControlListParams,
  ControlStartupRow,
  DirectoryState,
  PagedResult,
} from "./types";

type Client = import("@supabase/supabase-js").SupabaseClient;

/**
 * Directory visibility rule (matches the Startup Directory scope):
 * "Private" records stay internal to Control, everything else is published.
 */
export const PRIVATE_VISIBILITY = "Private";
export const PUBLISHED_VISIBILITY = "Tenant";

export function toDirectoryState(visibility: string | null): DirectoryState {
  return visibility === PRIVATE_VISIBILITY ? "unpublished" : "published";
}

function updatedSince(window: ControlListParams["updated"]): string | null {
  const days = window === "7d" ? 7 : window === "30d" ? 30 : window === "90d" ? 90 : 0;
  if (!days) return null;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function applySort<T>(query: T, sort: ControlListParams["sort"], nameCol: string): T {
  const q = query as unknown as {
    order: (col: string, opts: { ascending: boolean }) => T;
  };
  switch (sort) {
    case "updated_asc":
      return q.order("updated_at", { ascending: true });
    case "name_asc":
      return q.order(nameCol, { ascending: true });
    case "name_desc":
      return q.order(nameCol, { ascending: false });
    default:
      return q.order("updated_at", { ascending: false });
  }
}

function range(params: ControlListParams) {
  const from = (params.page - 1) * params.pageSize;
  return [from, from + params.pageSize - 1] as const;
}

export async function fetchControlStartups(
  supabase: Client,
  params: ControlListParams,
): Promise<PagedResult<ControlStartupRow>> {
  let query = supabase
    .from("startups")
    .select(
      "id,startup_name,short_description,logo_url,industry,headquarters,city,region,visibility,updated_at",
      { count: "exact" },
    );

  if (params.q) {
    const term = `%${params.q.replace(/[%,]/g, "")}%`;
    query = query.or(
      `startup_name.ilike.${term},website_url.ilike.${term},short_description.ilike.${term}`,
    );
  }
  if (params.facet) query = query.contains("industry", [params.facet]);
  if (params.country) query = query.eq("headquarters", params.country);
  if (params.status === "published") query = query.neq("visibility", PRIVATE_VISIBILITY);
  if (params.status === "unpublished") query = query.eq("visibility", PRIVATE_VISIBILITY);
  const since = updatedSince(params.updated);
  if (since) query = query.gte("updated_at", since);

  query = applySort(query, params.sort, "startup_name");
  const [from, to] = range(params);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows: ControlStartupRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.startup_name as string) ?? "Untitled",
    short_description: (r.short_description as string) ?? null,
    logo_url: (r.logo_url as string) ?? null,
    industry: Array.isArray(r.industry) ? (r.industry as string[]) : [],
    location: (r.headquarters as string) ?? (r.city as string) ?? (r.region as string) ?? null,
    updated_at: r.updated_at as string,
    directory_state: toDirectoryState((r.visibility as string) ?? null),
  }));

  return { rows, total: count ?? rows.length, page: params.page, pageSize: params.pageSize };
}

export async function fetchControlInvestors(
  supabase: Client,
  params: ControlListParams,
): Promise<PagedResult<ControlInvestorRow>> {
  let query = supabase
    .from("investors")
    .select(
      "id,investor_name,firm_name,investor_type,preferred_stages,preferred_industries,investment_focus,country,logo_url,visibility,updated_at",
      { count: "exact" },
    );

  if (params.q) {
    const term = `%${params.q.replace(/[%,]/g, "")}%`;
    query = query.or(
      `investor_name.ilike.${term},firm_name.ilike.${term},website_url.ilike.${term}`,
    );
  }
  if (params.type) query = query.eq("investor_type", params.type);
  if (params.stage) query = query.contains("preferred_stages", [params.stage]);
  if (params.facet) query = query.contains("preferred_industries", [params.facet]);
  if (params.country) query = query.eq("country", params.country);
  if (params.status === "published") query = query.neq("visibility", PRIVATE_VISIBILITY);
  if (params.status === "unpublished") query = query.eq("visibility", PRIVATE_VISIBILITY);
  const since = updatedSince(params.updated);
  if (since) query = query.gte("updated_at", since);

  query = applySort(query, params.sort, "investor_name");
  const [from, to] = range(params);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows: ControlInvestorRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.investor_name as string) ?? (r.firm_name as string) ?? "Untitled",
    investor_type: (r.investor_type as string) ?? null,
    stages: Array.isArray(r.preferred_stages) ? (r.preferred_stages as string[]) : [],
    sectors: Array.isArray(r.preferred_industries)
      ? (r.preferred_industries as string[])
      : Array.isArray(r.investment_focus)
        ? (r.investment_focus as string[])
        : [],
    location: (r.country as string) ?? null,
    logo_url: (r.logo_url as string) ?? null,
    updated_at: r.updated_at as string,
    directory_state: toDirectoryState((r.visibility as string) ?? null),
  }));

  return { rows, total: count ?? rows.length, page: params.page, pageSize: params.pageSize };
}

export async function setDirectoryState(
  supabase: Client,
  table: "startups" | "investors",
  ids: string[],
  state: DirectoryState,
): Promise<number> {
  if (ids.length === 0) return 0;
  const visibility = state === "published" ? PUBLISHED_VISIBILITY : PRIVATE_VISIBILITY;
  const { data, error } = await supabase
    .from(table)
    .update({ visibility, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function fetchControlFacets(supabase: Client) {
  const [startups, investors] = await Promise.all([
    supabase.from("startups").select("industry,headquarters").limit(500),
    supabase.from("investors").select("investor_type,preferred_stages,preferred_industries,country").limit(500),
  ]);

  const industries = new Set<string>();
  const startupCountries = new Set<string>();
  (startups.data ?? []).forEach((r) => {
    (Array.isArray(r.industry) ? (r.industry as string[]) : []).forEach((i) => i && industries.add(i));
    if (r.headquarters) startupCountries.add(r.headquarters as string);
  });

  const investorTypes = new Set<string>();
  const stages = new Set<string>();
  const sectors = new Set<string>();
  const investorCountries = new Set<string>();
  (investors.data ?? []).forEach((r) => {
    if (r.investor_type) investorTypes.add(r.investor_type as string);
    (Array.isArray(r.preferred_stages) ? (r.preferred_stages as string[]) : []).forEach(
      (s) => s && stages.add(s),
    );
    (Array.isArray(r.preferred_industries) ? (r.preferred_industries as string[]) : []).forEach(
      (s) => s && sectors.add(s),
    );
    if (r.country) investorCountries.add(r.country as string);
  });

  const sorted = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
  return {
    industries: sorted(industries),
    startupCountries: sorted(startupCountries),
    investorTypes: sorted(investorTypes),
    stages: sorted(stages),
    sectors: sorted(sectors),
    investorCountries: sorted(investorCountries),
  };
}

export async function deleteControlEntities(
  supabase: Client,
  table: "startups" | "investors",
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.from(table).delete().in("id", ids).select("id");
  if (error) {
    if (/violates foreign key|23503/i.test(error.message)) {
      throw new Error(
        "This record is still linked to deals, relationships or other data and cannot be deleted.",
      );
    }
    throw new Error(error.message);
  }
  return (data ?? []).length;
}
