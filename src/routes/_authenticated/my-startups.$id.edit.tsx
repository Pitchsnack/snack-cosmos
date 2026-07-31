import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Lock } from "lucide-react";
import { z } from "zod";

import { StartupForm } from "@/components/startups/startup-form";
import { PermissionGuard } from "@/components/permission-guard";
import { StartupNotFound } from "@/components/startups/startup-not-found";
import { BasicInformationRestrictionsTab } from "@/components/startups/basic-information-restrictions-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStartup } from "@/hooks/use-startup";
import type { StartupDetail } from "@/lib/startups.functions";
import { isUuid } from "@/lib/uuid";

export const Route = createFileRoute("/_authenticated/my-startups/$id/edit")({
  validateSearch: z.object({
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
    page: z.coerce.number().int().optional(),
    fav: z.coerce.boolean().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Edit My Startup — SnackPortal2" },
      {
        name: "description",
        content: "Edit a startup profile you own inside your private My Startups workspace.",
      },
    ],
  }),
  component: EditMyStartupPage,
});

function EditMyStartupPage() {
  const { id } = Route.useParams();
  const returnSearch = Route.useSearch();
  const validId = isUuid(id);
  const { data, isLoading, error } = useStartup(validId ? id : undefined);

  return (
    <PermissionGuard permission="startups.write" message="You don't have permission to edit startups.">
      <div className="mx-auto max-w-6xl space-y-6">
        {!validId ? (
          <StartupNotFound reason="invalid" workspace="my-startups" />
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> MY WORKSPACE
              </div>
              <Link
                to="/my-startups"
                search={{ ...returnSearch, panel: id }}
                className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to my startup
              </Link>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Edit my startup</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Changes stay in your private workspace. Publishing to the Startup Directory is a
                separate, explicit action.
              </p>
            </div>
            {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!isLoading && (error || !data) && <StartupNotFound reason="missing" workspace="my-startups" />}
            {data && (
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="bg-transparent p-0 h-auto border-b border-border/60 rounded-none w-full justify-start gap-6 overflow-x-auto">
                  <TabsTrigger
                    value="edit"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Edit My Startup
                  </TabsTrigger>
                  <TabsTrigger
                    value="basic-restrictions"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none gap-1.5"
                  >
                    Basic Information Restrictions <Lock className="h-3.5 w-3.5" />
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-6">
                  <div className="mx-auto max-w-4xl">
                    <StartupForm
                      startup={data as unknown as StartupDetail}
                      workspace="my-startups"
                      myStartupsReturnSearch={returnSearch}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="basic-restrictions" className="mt-6">
                  <BasicInformationRestrictionsTab
                    startup={data as unknown as StartupDetail}
                    scope="my-startups"
                  />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
