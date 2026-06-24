import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Globe, Download, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/components/permission-guard";
import { ImportGlobalStartupDialog } from "@/components/global-startups/import-global-startup-dialog";
import { useGlobalStartups } from "@/hooks/use-global-startups";
import { useGlobalStartupImports } from "@/hooks/use-global-startup";
import { useSessionContext } from "@/hooks/use-session-context";
import type { GlobalStartup } from "@/lib/api-gateway/global-startups";

export const Route = createFileRoute("/_authenticated/global-startups/browse")({
  head: () => ({ meta: [{ title: "Browse Global Catalogue — SnackPortal2" }] }),
  component: BrowsePage,
});

function BrowsePage() {
  return (
    <PermissionGuard
      permission="global_startups.read"
      message="You don't have permission to browse the Global Catalogue."
    >
      <BrowseInner />
    </PermissionGuard>
  );
}

function BrowseInner() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("__all");
  const [importing, setImporting] = useState<GlobalStartup | null>(null);

  const { data, isLoading } = useGlobalStartups({
    publishedOnly: true,
    search: search || undefined,
    stage: stage === "__all" ? undefined : stage,
  });

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Globe className="h-3.5 w-3.5" /> Global Catalogue
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Browse Global Catalogue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse platform-curated startups and import an independent copy into
          your workspace. There is no automatic sync.
        </p>
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
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No startups match these filters.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => (
            <BrowseCard key={g.id} g={g} onImport={() => setImporting(g)} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <Link to="/startups" className="hover:underline">
          ← Back to my Startups
        </Link>
      </p>

      <ImportGlobalStartupDialog
        open={!!importing}
        onOpenChange={(v) => !v && setImporting(null)}
        global={importing}
      />
    </div>
  );
}

function BrowseCard({
  g,
  onImport,
}: {
  g: GlobalStartup;
  onImport: () => void;
}) {
  const { data: session } = useSessionContext();
  const tenantId = session?.activeWorkspace?.tenantId ?? null;
  const importsQ = useGlobalStartupImports(g.id);
  const alreadyImported = useMemo(() => {
    if (!tenantId || !importsQ.data) return false;
    return importsQ.data.some((i) => i.tenant_id === tenantId);
  }, [importsQ.data, tenantId]);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{g.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[g.sector, g.stage].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        {g.status === "recommended" && (
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Recommended
          </Badge>
        )}
      </div>

      {g.description && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {g.description}
        </p>
      )}

      {g.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {g.tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        {g.website ? (
          <a
            href={g.website}
            target="_blank"
            rel="noreferrer"
            className="truncate text-xs text-muted-foreground hover:text-foreground"
          >
            {g.website.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {alreadyImported ? (
          <Button size="sm" variant="outline" disabled>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Imported
          </Button>
        ) : (
          <Button size="sm" onClick={onImport}>
            <Download className="mr-1 h-3.5 w-3.5" /> Import
          </Button>
        )}
      </div>
    </div>
  );
}
