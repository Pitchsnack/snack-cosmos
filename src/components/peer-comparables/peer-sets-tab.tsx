import { useMemo, useState, type ReactNode } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_SECTORS,
  Highlight,
  matchesTerm,
  ResultCount,
  TabToolbar,
} from "@/components/peer-comparables/tab-toolbar";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/listed-companies";
import {
  EMPTY_CELL,
  peerSetStatus,
  type PeerSetStatus,
  type PeerSetSummary,
} from "@/lib/peer-comparables";
import { BUSINESS_MODELS, businessModelLabel, SECTORS } from "@/lib/sectors";

const ALL_MODELS = "__all__";

const STATUS_STYLE: Record<PeerSetStatus, string> = {
  current: "bg-success/10 text-success border-success/30",
  stale: "bg-warning/10 text-warning border-warning/30",
  "not built": "bg-destructive/10 text-destructive border-destructive/30",
};

function StatusTag({ status }: { status: PeerSetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        STATUS_STYLE[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return EMPTY_CELL;
  return new Date(iso).toISOString().slice(0, 10);
}

function modelText(model: string | null) {
  return model ? (businessModelLabel(model) ?? model) : "All business models";
}

export function PeerSetsTab({
  tabs,
  sets,
  isLoading,
  onOpen,
}: {
  tabs: ReactNode;
  sets: PeerSetSummary[];
  isLoading: boolean;
  onOpen: (sector: string, businessModel: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>(ALL_SECTORS);
  const [newOpen, setNewOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const [pickedModel, setPickedModel] = useState(ALL_MODELS);

  const sectors = useMemo(
    () => [...new Set(sets.map((s) => s.sector))].sort((a, b) => a.localeCompare(b)),
    [sets],
  );

  const rows = sets.filter(
    (s) =>
      matchesTerm(search, s.sector, modelText(s.businessModel)) &&
      (sectorFilter === ALL_SECTORS || s.sector === sectorFilter),
  );

  const clearAll = () => {
    setSearch("");
    setSectorFilter(ALL_SECTORS);
  };

  const exportVisible = () => {
    const csv = [
      "sector,business_model,peers,set,mai,last_refreshed,owner",
      ...rows.map((r) =>
        [
          `"${r.sector}"`,
          `"${modelText(r.businessModel)}"`,
          r.peerCount,
          r.setCount,
          r.maiCount,
          r.lastRefreshedAt ? fmtDate(r.lastRefreshedAt) : "",
          `"${r.ownerName ?? ""}"`,
        ].join(","),
      ),
    ].join("\n");
    downloadCsv(`peer-sets_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-6 border-b border-border px-5">
        {tabs}
        <TabToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search sector or business model…"
          sector={sectorFilter}
          onSector={setSectorFilter}
          sectors={sectors}
          menu={
            <>
              <DropdownMenuItem
                className="font-semibold text-info focus:text-info"
                onSelect={() => setNewOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New peer set
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  toast.info("Open a peer set to import its companies from a CSV.")
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportVisible}>
                <Download className="mr-2 h-4 w-4" />
                Export all
              </DropdownMenuItem>
            </>
          }
        />
      </div>

      <div className="flex items-center gap-1 px-5 pt-3">
        {(["list", "coverage"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded-full border px-3 py-[3px] text-[12px] font-semibold",
              view === v
                ? "border-info/40 bg-info/10 text-info"
                : "border-transparent text-muted-foreground hover:bg-muted",
            )}
          >
            {v === "list" ? "Peer set list" : "Coverage"}
          </button>
        ))}
      </div>

      {view === "coverage" ? (
        <CoverageGrid />
      ) : (
        <>
      <ResultCount
        shown={rows.length}
        total={sets.length}
        noun="peer sets"
        term={search}
        sector={sectorFilter}
        onClear={clearAll}
      />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-[hsl(222_47%_23%)] text-white">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                Sector
              </th>
              <th className="w-48 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                Business model
              </th>
              <th className="w-20 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                Peers
              </th>
              <th className="w-32 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                Market mix
              </th>
              <th className="w-32 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                Refreshed
              </th>
              <th className="w-28 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                Status
              </th>
              <th className="w-40 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                Owner
              </th>
              <th className="w-24 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {search.trim() || sectorFilter !== ALL_SECTORS ? (
                    <>
                      No peer sets match “{search.trim() || sectorFilter}”.{" "}
                      <button
                        type="button"
                        onClick={clearAll}
                        className="font-medium text-info hover:underline"
                      >
                        clear all
                      </button>
                    </>
                  ) : (
                    <>No peer sets yet. Build one for a sector to make valuations available.</>
                  )}
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((r) => (
                <tr
                  key={`${r.sector}::${r.businessModel ?? "all"}`}
                  className="border-t border-border/50"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <Highlight text={r.sector} term={search} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        r.businessModel
                          ? "bg-info/10 text-info"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Highlight text={modelText(r.businessModel)} term={search} />
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums">
                    {r.exists ? r.peerCount : EMPTY_CELL}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.exists && r.peerCount > 0 ? (
                      <span className="inline-flex gap-1">
                        {r.maiCount > 0 && (
                          <Badge variant="outline" className="bg-success/10 text-success">
                            mai {r.maiCount}
                          </Badge>
                        )}
                        {r.setCount > 0 && (
                          <Badge variant="outline" className="bg-info/10 text-info">
                            SET {r.setCount}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{EMPTY_CELL}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(r.lastRefreshedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusTag status={peerSetStatus(r)} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.ownerName ?? EMPTY_CELL}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpen(r.sector, r.businessModel)}
                    >
                      {r.exists ? "Edit" : "Build"}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        A sector with no peer set simply has no valuation yet — that is a legitimate state.
      </p>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New peer set</DialogTitle>
            <DialogDescription>
              Choose the sector, and optionally the business model this set is narrowed to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Sector</span>
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sector" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Business model (optional)
              </span>
              <Select value={pickedModel} onValueChange={setPickedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MODELS}>All business models</SelectItem>
                  {BUSINESS_MODELS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!picked}
              onClick={() => onOpen(picked, pickedModel === ALL_MODELS ? null : pickedModel)}
            >
              Build peer set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
