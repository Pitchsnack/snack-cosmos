import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { StartupForm } from "@/components/startups/startup-form";
import { PermissionGuard } from "@/components/permission-guard";
import { useStartup } from "@/hooks/use-startup";
import type { StartupDetail } from "@/lib/startups.functions";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

const editSearchSchema = z.object({
  q: z.string().optional(),
  stage: z.string().optional(),
  industry: z.string().optional(),
  hq: z.string().optional(),
  ct: z.string().optional(),
  ptag: z.string().optional(),
  mtag: z.string().optional(),
  sort: z.enum(["updated_desc", "created_desc", "name_asc", "name_desc"]).optional(),
  view: z.enum(["grid", "split", "list"]).optional(),
  selected: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  fav: z.coerce.boolean().optional(),
  from: z.literal("entity-control").optional(),
  tab: z.enum(["startups", "investors", "drafts"]).optional(),
  focus: z.literal("sector").optional(),
  returnTo: z.literal("valuation").optional(),
});

export const Route = createFileRoute("/_authenticated/startups/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Startup — SnackPortal2" }] }),
  validateSearch: editSearchSchema,
  beforeLoad: ({params,search}) => { throw redirect({to:"/startups",search:{editor:params.id,selected:params.id,view:search.view,q:search.q,sort:search.sort},replace:true}); },
  component: EditStartupPage,
});

function EditStartupPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const fromControl = search.from === "entity-control";
  const { from: _from, tab: _tab, returnTo: _returnTo, ...listSearch } = search;
  const validId = isUuid(id);
  const { data, isLoading, error } = useStartup(validId ? id : undefined);

  if (!validId) {
    return (
      <PermissionGuard permission="startups.write" message="You don't have permission to edit startups.">
        <StartupNotFound reason="invalid" />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="startups.write" message="You don't have permission to edit startups.">
      <div className="mx-auto max-w-6xl space-y-6">
        {fromControl ? (
          <Link
            to="/entity-control"
            search={{ tab: search.tab ?? "startups" }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Data Intelligence
          </Link>
        ) : (
          <Link
            to="/startups"
            search={{ ...listSearch, panel: id }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to startup
          </Link>
        )}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit startup</h1>
        </div>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (error || !data) && <StartupNotFound reason="missing" />}

        {data && (
          <div className="mx-auto max-w-4xl">
            <StartupForm
              startup={data as unknown as StartupDetail}
              directoryReturnSearch={listSearch}
              controlReturn={fromControl ? { tab: search.tab ?? "startups" } : undefined}
              valuationReturn={search.returnTo === "valuation"}
            />
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
