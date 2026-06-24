import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/components/permission-guard";
import { GlobalStartupTable } from "@/components/global-startups/global-startup-table";
import {
  GlobalStartupForm,
  type GlobalStartupFormValues,
} from "@/components/global-startups/global-startup-form";
import { useGlobalStartups } from "@/hooks/use-global-startups";
import { createGlobalStartup } from "@/lib/api-gateway/global-startups";

export const Route = createFileRoute("/_authenticated/global-startups/")({
  head: () => ({ meta: [{ title: "Global Startups — SnackPortal2" }] }),
  component: GlobalStartupsIndexPage,
});

function GlobalStartupsIndexPage() {
  return (
    <PermissionGuard
      permission="global_startups.write"
      message="Only Control admins can curate the Global Startups registry."
    >
      <GlobalStartupsIndexInner />
    </PermissionGuard>
  );
}

function GlobalStartupsIndexInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createGlobalStartup);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("__all");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState<string>("__all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useGlobalStartups({
    search: search || undefined,
    status: status === "__all" ? undefined : (status as never),
    sector: sector || undefined,
    stage: stage === "__all" ? undefined : stage,
  });

  const createM = useMutation({
    mutationFn: (v: GlobalStartupFormValues) => createFn({ data: v }),
    onSuccess: (row) => {
      toast.success(`Created "${row.name}"`);
      qc.invalidateQueries({ queryKey: ["global-startups"] });
      setCreateOpen(false);
      navigate({ to: "/global-startups/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Global Catalogue
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Global Startups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate the platform-wide startup catalogue. Tenants import their
            own independent copies from entries marked Available or
            Recommended.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" /> New global startup
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[16rem] items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Input
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Sector"
          className="h-9 w-36"
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All stages</SelectItem>
            {["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Other"].map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <GlobalStartupTable items={items} linkTo="control" />
      )}

      <p className="text-xs text-muted-foreground">
        <Link to="/startups" className="hover:underline">
          ← Back to tenant Startups
        </Link>
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New global startup</DialogTitle>
          </DialogHeader>
          <GlobalStartupForm
            onSubmit={(v) => createM.mutate(v)}
            onCancel={() => setCreateOpen(false)}
            submitting={createM.isPending}
            submitLabel="Create"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
