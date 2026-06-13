import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Rocket, RefreshCw, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StartupCard } from "@/components/startups/startup-card";
import { useStartups } from "@/hooks/use-startups";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { cn } from "@/lib/utils";

const SORT = ["updated_desc","created_desc","name_asc","name_desc"] as const;
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Other"];
const COMPANY_TYPES = ["SaaS","FinTech","Marketplace","AI","Hardware","Consumer","Other"];

const searchSchema = z.object({
  q: z.string().optional(),
  stage: z.string().optional(),
  industry: z.string().optional(),
  hq: z.string().optional(),
  ct: z.string().optional(),
  ptag: z.string().optional(),
  mtag: z.string().optional(),
  sort: z.enum(SORT).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/_authenticated/startups/")({
  head: () => ({ meta: [{ title: "Startups — SnackPortal2" }] }),
  validateSearch: searchSchema,
  component: StartupsPage,
});

function StartupsPage() {
  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <StartupsPageInner />
    </PermissionGuard>
  );
}

function StartupsPageInner() {
  const { has } = usePermissions();
  const navigate = useNavigate({ from: "/startups" });
  const s = Route.useSearch();
  const page = s.page ?? 1;
  const sort = s.sort ?? "updated_desc";

  const { data, isLoading, isFetching, refetch } = useStartups({
    search: s.q, stage: s.stage, industry: s.industry, headquarters: s.hq,
    companyType: s.ct, productTag: s.ptag, marketTag: s.mtag,
    sort, page, pageSize: 24,
  });

  const items = data && "items" in data ? data.items : [];
  const total = data && "total" in data ? data.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / 24));

  const update = (patch: Partial<typeof s>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });

  const hasFilter = !!(s.q || s.stage || s.industry || s.hq || s.ct || s.ptag || s.mtag);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Rocket className="h-3.5 w-3.5" /> Startup Directory
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Startups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${total} startup${total === 1 ? "" : "s"}` : "Browse and manage your portfolio."}
          </p>
        </div>
        {has("startups.write") && (
          <Button
            onClick={() => navigate({ to: "/startups/new" })}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="mr-2 h-4 w-4" /> New startup
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[16rem] items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={s.q ?? ""}
            onChange={(e) => update({ q: e.target.value || undefined })}
            placeholder="Search name, description, industry, HQ…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <FilterSelect label="Stage" value={s.stage} options={STAGES} onChange={(v) => update({ stage: v })} />
        <FilterSelect label="Type" value={s.ct} options={COMPANY_TYPES} onChange={(v) => update({ ct: v })} />
        <Input value={s.industry ?? ""} onChange={(e) => update({ industry: e.target.value || undefined })} placeholder="Industry" className="h-9 w-36" />
        <Input value={s.hq ?? ""} onChange={(e) => update({ hq: e.target.value || undefined })} placeholder="HQ" className="h-9 w-32" />
        <Select value={sort} onValueChange={(v) => navigate({ search: (prev) => ({ ...prev, sort: v as typeof SORT[number] }) })}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Recently updated</SelectItem>
            <SelectItem value="created_desc">Recently created</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ search: {} })} className="gap-1">
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Rocket className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No startups match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((s) => <StartupCard key={s.id} s={s} />)}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}>Next</Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void }) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
      <SelectTrigger className="h-9 w-36"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
