/**
 * Default Intake — queue table (preview).
 *
 * PRESENTATION ONLY. Reads from the preview adapter's fixture queue.
 * No server calls, no cache mutation, no persistence.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  listDefaultIntakePreviewQueue,
  type DefaultIntakePreviewQueueRecord,
} from "@/lib/preview/default-intake-preview-adapter";
import { NeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { ReassignDialog } from "@/components/intake/reassign-dialog";
import { BulkReassignToolbar } from "@/components/intake/bulk-reassign-toolbar";
import { BulkReassignDialog } from "@/components/intake/bulk-reassign-dialog";

type TabKey = "all" | "startup" | "investor";

const SOURCE_LABEL: Record<DefaultIntakePreviewQueueRecord["source"], string> = {
  manual_entry: "Manual entry",
  bulk_import: "Bulk import",
  relationship_created: "Relationship created",
  auto_enrich: "Auto enrich",
};

function ageInDays(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

export function QueueTable() {
  const all = useMemo(() => listDefaultIntakePreviewQueue(), []);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [singleTarget, setSingleTarget] = useState<DefaultIntakePreviewQueueRecord | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const visible = all.filter((r) => {
    if (tab !== "all" && r.domain !== tab) return false;
    if (source !== "all" && r.source !== source) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = all.filter((r) => selectedIds.has(r.id));
  const startupCount = selected.filter((r) => r.domain === "startup").length;
  const investorCount = selected.filter((r) => r.domain === "investor").length;

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selectedIds.has(r.id));

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="startup">
              Startups ({all.filter((r) => r.domain === "startup").length})
            </TabsTrigger>
            <TabsTrigger value="investor">
              Investors ({all.filter((r) => r.domain === "investor").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name…"
              className="h-8 w-48 pl-7 text-xs"
            />
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <BulkReassignToolbar
        selectedCount={selected.length}
        startupCount={startupCount}
        investorCount={investorCount}
        onClear={() => setSelectedIds(new Set())}
        onReassign={() => setBulkOpen(true)}
        onExport={() => setBulkOpen(false)}
      />

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Select all visible"
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Human owner</TableHead>
              <TableHead>AI owner</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No records match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow
                  key={r.id}
                  data-state={selectedIds.has(r.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1.5">
                            <AlertTriangle
                              className="h-3 w-3 text-amber-500"
                              aria-hidden="true"
                            />
                            {r.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Preview fixture record</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.domain}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.humanOwner.name}</TableCell>
                  <TableCell className="text-xs">{r.aiOwner.name}</TableCell>
                  <TableCell className="text-xs">{SOURCE_LABEL[r.source]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ageInDays(r.createdAt)}d
                  </TableCell>
                  <TableCell>
                    <NeedsReassignmentBadge size="xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setSingleTarget(r)}
                    >
                      Reassign
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked */}
      <ul className="space-y-2 md:hidden">
        {visible.length === 0 ? (
          <li className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
            No records match the current filters.
          </li>
        ) : (
          visible.map((r) => (
            <li
              key={r.id}
              className={cn(
                "rounded-lg border border-border bg-card p-3 shadow-sm",
                selectedIds.has(r.id) && "border-amber-500/50 bg-amber-500/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    aria-label={`Select ${r.name}`}
                    checked={selectedIds.has(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-semibold">{r.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {r.domain} · {SOURCE_LABEL[r.source]} · {ageInDays(r.createdAt)}d
                    </div>
                  </div>
                </div>
                <NeedsReassignmentBadge size="xs" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Human</div>
                  <div>{r.humanOwner.name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">AI</div>
                  <div>{r.aiOwner.name}</div>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setSingleTarget(r)}
                >
                  Reassign
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <ReassignDialog
        open={!!singleTarget}
        onOpenChange={(v) => !v && setSingleTarget(null)}
        record={singleTarget}
      />
      <BulkReassignDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selected={selected}
      />
    </div>
  );
}
