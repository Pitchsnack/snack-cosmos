import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { StartupForm } from "@/components/startups/startup-form";
import { PermissionGuard } from "@/components/permission-guard";
import { PrivateInformationTab } from "@/components/startups/private-information-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStartup } from "@/hooks/use-startup";
import type { StartupDetail } from "@/lib/startups.functions";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

export const Route = createFileRoute("/_authenticated/startups/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Startup — SnackPortal2" }] }),
  component: EditStartupPage,
});

function EditStartupPage() {
  const { id } = Route.useParams();
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
        <Link to="/startups/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to startup
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit startup</h1>
        </div>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (error || !data) && <StartupNotFound reason="missing" />}
        {data && (
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="bg-transparent p-0 h-auto border-b border-border/60 rounded-none w-full justify-start gap-6">
              <TabsTrigger
                value="edit"
                className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Edit Startup
              </TabsTrigger>
              <TabsTrigger
                value="private"
                className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none gap-1.5"
              >
                Private Information <Lock className="h-3.5 w-3.5" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-6">
              <div className="mx-auto max-w-4xl">
                <StartupForm startup={data as unknown as StartupDetail} />
              </div>
            </TabsContent>
            <TabsContent value="private" className="mt-6">
              <PrivateInformationTab startup={data as unknown as StartupDetail} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PermissionGuard>
  );
}
