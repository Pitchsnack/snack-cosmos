import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Layers, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGuard } from "@/components/permission-guard";
import { usePermissions } from "@/hooks/use-session-context";
import { cn } from "@/lib/utils";
import {
  EMPTY_CELL,
  emptyPeer,
  fmtMetric,
  median,
  parsePeerCsv,
  peerSetStatus,
  type Peer,
  type PeerMarket,
  type PeerSetStatus,
  type PeerSetSummary,
} from "@/lib/peer-comparables";
import {
  getPeerSet,
  listPeerSets,
  savePeerSet,
} from "@/lib/peer-comparables.functions";

export const Route = createFileRoute("/_authenticated/peer-comparables")({
  validateSearch: z.object({ tag: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Peer Comparables — SnackPortal2" },
      {
        name: "description",
        content:
          "Maintain one listed-peer set per industry tag: tickers, market, revenue and valuation ratios.",
      },
      { property: "og:title", content: "Peer Comparables — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Reference peer sets per industry tag, used by every valuation on the platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PeerComparablesRoute,
});

function PeerComparablesRoute() {
  return (
    <PermissionGuard
      permission="roles.read"
      allowControl
      message="Peer Comparables is available to administrators only."
    >
      <PeerComparablesPage />
    </PermissionGuard>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function PeerComparablesPage() {
  const { tag } = Route.useSearch();
  return tag ? <PeerSetEditor industryTag={tag} /> : <PeerSetList />;
}

/* ------------------------------------------------------------------ */
/* 1 · List                                                            */
/* ------------------------------------------------------------------ */

function PeerSetList() {
  const navigate = useNavigate();
  const fn = useServerFn(listPeerSets);
  const { data, isLoading } = useQuery<PeerSetSummary[]>({
    queryKey: ["peer-sets"],
    queryFn: () => fn(),
  });
  const [newOpen, setNewOpen] = useState(false);
  const [picked, setPicked] = useState<string>("");

  const rows = data ?? [];
  const open = (t: string) => navigate({ to: "/peer-comparables", search: { tag: t } });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Administration
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Peer Comparables</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One peer set per industry tag. This is reference data — every valuation reads it.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">Industry tags</h2>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New peer set
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-[hsl(222_47%_23%)] text-white">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Industry tag
                </th>
                <th className="w-20 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Peers
                </th>
                <th className="w-32 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Market mix
                </th>
                <th className="w-32 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Last refreshed
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
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((r) => {
                  const status = peerSetStatus(r);
                  return (
                    <tr key={r.industryTag} className="border-t border-border/50">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.industryTag}</td>
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
                        <StatusTag status={status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.ownerName ?? EMPTY_CELL}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Button size="sm" variant="outline" onClick={() => open(r.industryTag)}>
                          {r.exists ? "Edit" : "Build"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Every industry tag appears here. <strong>Not built</strong> is a legitimate state.
        </p>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New peer set</DialogTitle>
            <DialogDescription>
              Pick the industry tag this peer set belongs to.
            </DialogDescription>
          </DialogHeader>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger>
              <SelectValue placeholder="Select an industry tag" />
            </SelectTrigger>
            <SelectContent>
              {rows
                .filter((r) => !r.exists)
                .map((r) => (
                  <SelectItem key={r.industryTag} value={r.industryTag}>
                    {r.industryTag}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!picked} onClick={() => open(picked)}>
              Build peer set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Editor                                                          */
/* ------------------------------------------------------------------ */

const METRICS = [
  { key: "revenueThbM", label: "Revenue THB m", suffix: "" },
  { key: "ebitdaMarginPct", label: "EBITDA margin", suffix: "%" },
  { key: "evEbitda", label: "EV/EBITDA", suffix: "×" },
  { key: "pe", label: "P/E", suffix: "×" },
  { key: "pbv", label: "P/BV", suffix: "×" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function PeerSetEditor({ industryTag }: { industryTag: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isControl } = usePermissions();
  const getFn = useServerFn(getPeerSet);
  const saveFn = useServerFn(savePeerSet);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["peer-set", industryTag],
    queryFn: () => getFn({ data: { industryTag } }),
  });

  const [peers, setPeers] = useState<Peer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setPeers(data.peers.length ? data.peers : [emptyPeer()]);
      setLoaded(true);
    }
  }, [data, loaded]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          industryTag,
          peers: peers
            .filter((p) => p.companyName.trim().length > 0)
            .map((p) => ({
              companyName: p.companyName.trim(),
              ticker: p.ticker,
              market: p.market,
              revenueThbM: p.revenueThbM,
              ebitdaMarginPct: p.ebitdaMarginPct,
              evEbitda: p.evEbitda,
              pe: p.pe,
              pbv: p.pbv,
            })),
        },
      }),
    onSuccess: () => {
      toast.success("Peer set saved.");
      qc.invalidateQueries({ queryKey: ["peer-sets"] });
      qc.invalidateQueries({ queryKey: ["peer-set", industryTag] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<Peer>) =>
    setPeers((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const named = peers.filter((p) => p.companyName.trim().length > 0);
  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    for (const p of named) {
      const k = p.companyName.trim().toLowerCase();
      if (seen.has(k)) return p.companyName.trim();
      seen.add(k);
    }
    return null;
  }, [named]);

  const status = peerSetStatus({
    exists: !!data?.exists,
    lastRefreshedAt: data?.lastRefreshedAt ?? null,
  });

  const onCsv = async (file: File) => {
    const text = await file.text();
    const { peers: parsed, errors } = parsePeerCsv(text);
    if (errors.length) toast.warning(errors.slice(0, 3).join(" "));
    if (parsed.length) {
      setPeers((rows) => [...rows.filter((r) => r.companyName.trim()), ...parsed]);
      toast.success(`${parsed.length} peers added from the file.`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/peer-comparables", search: {} })}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          All tags
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
          <h1 className="text-base font-semibold">{industryTag}</h1>
          <StatusTag status={status} />
          {data?.lastRefreshedAt && (
            <span className="text-xs text-muted-foreground">
              refreshed {fmtDate(data.lastRefreshedAt)}
            </span>
          )}
          <div className="flex-1" />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCsv(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Download className="mr-1.5 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPeers((r) => [...r, emptyPeer()])}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add peer
          </Button>
          <Button
            size="sm"
            disabled={!isControl || save.isPending || !!duplicate}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-[hsl(222_47%_23%)] text-white">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Company
                </th>
                <th className="w-28 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Ticker
                </th>
                <th className="w-28 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Market
                </th>
                {METRICS.map((m) => (
                  <th
                    key={m.key}
                    className="w-32 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="w-12 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading &&
                peers.map((p, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-3 py-2">
                      <Input
                        value={p.companyName}
                        placeholder="Company name"
                        onChange={(e) => update(i, { companyName: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={p.ticker ?? ""}
                        placeholder="—"
                        onChange={(e) => update(i, { ticker: e.target.value || null })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={p.market}
                        onValueChange={(v) => update(i, { market: v as PeerMarket })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SET">SET</SelectItem>
                          <SelectItem value="mai">mai</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="px-3 py-2">
                        <Input
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          placeholder={EMPTY_CELL}
                          value={p[m.key as MetricKey] === null ? "" : String(p[m.key as MetricKey])}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const num = raw === "" || raw === "-" ? null : Number(raw);
                            update(i, {
                              [m.key]: num !== null && Number.isFinite(num) ? num : null,
                            } as Partial<Peer>);
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${p.companyName || "peer"}`}
                        onClick={() => setPeers((rows) => rows.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              <tr className="border-t border-border bg-info/5 font-semibold">
                <td className="px-3 py-2.5">Median</td>
                <td className="px-3 py-2.5 text-muted-foreground">{EMPTY_CELL}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{EMPTY_CELL}</td>
                {METRICS.map((m) => (
                  <td key={m.key} className="px-3 py-2.5 text-right tabular-nums">
                    {fmtMetric(
                      median(named.map((p) => p[m.key as MetricKey])),
                      m.suffix,
                    )}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          {duplicate && (
            <p className="text-destructive">
              “{duplicate}” appears twice — remove the duplicate before saving.
            </p>
          )}
          {!duplicate && named.length > 0 && named.length < 4 && (
            <p className="text-warning">
              Fewer than 4 peers — the median may be distorted by one outlier.
            </p>
          )}
          {!duplicate && named.length > 10 && (
            <p className="text-warning">
              More than 10 peers — large sets dilute the comparison.
            </p>
          )}
          <p>
            Median is computed, not entered. Changes are written to Audit Logs, because they
            silently change every valuation that uses this set.
          </p>
          {!isControl && <p>You can view this set but only administrators can save changes.</p>}
        </div>
      </div>
    </div>
  );
}
