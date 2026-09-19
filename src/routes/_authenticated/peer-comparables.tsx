import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Layers, Plus, Table2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { SuggestCombobox, type ComboOption } from "@/components/ui/suggest-combobox";
import { PermissionGuard } from "@/components/permission-guard";
import { ListedCompanyDialog } from "@/components/peer-comparables/listed-company-dialog";
import { usePermissions } from "@/hooks/use-session-context";
import { cn } from "@/lib/utils";
import {
  EMPTY_CELL,
  fmtMetric,
  median,
  parsePeerCsv,
  peerSetCsvFilename,
  peerSetLabel,
  peerSetStatus,
  peersToCsv,
  type Peer,
  type PeerSetStatus,
  type PeerSetSummary,
} from "@/lib/peer-comparables";
import { downloadCsv, type ListedCompany } from "@/lib/listed-companies";
import {
  importListedCompanies,
  listListedCompanies,
} from "@/lib/listed-companies.functions";
import { BUSINESS_MODELS, SECTORS } from "@/lib/sectors";
import {
  getPeerSet,
  listPeerSets,
  savePeerSet,
} from "@/lib/peer-comparables.functions";

const ALL_MODELS = "__all__";

export const Route = createFileRoute("/_authenticated/peer-comparables")({
  validateSearch: z.object({ sector: z.string().optional(), model: z.string().optional() }),
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
  const { sector, model } = Route.useSearch();
  return sector ? (
    <PeerSetEditor sector={sector} businessModel={model ?? null} />
  ) : (
    <PeerSetList />
  );
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
  const [pickedModel, setPickedModel] = useState<string>(ALL_MODELS);

  const rows = data ?? [];
  const open = (sector: string, businessModel: string | null) =>
    navigate({
      to: "/peer-comparables",
      search: businessModel ? { sector, model: businessModel } : { sector },
    });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Administration
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Peer Comparables</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Peer sets are keyed on Sector and Business model. A sector-wide set applies to every
          business model; a model-specific set takes priority when it exists.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">Peer sets</h2>
          <div className="flex-1" />
          <Button size="sm" variant="outline" asChild>
            <Link to="/listed-companies">
              <Table2 className="mr-1.5 h-4 w-4" />
              Listed companies
            </Link>
          </Button>
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
                  Peer set
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
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No peer sets yet. Build one for a sector to make valuations available.
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((r) => {
                  const status = peerSetStatus(r);
                  return (
                    <tr
                      key={`${r.sector}::${r.businessModel ?? "all"}`}
                      className="border-t border-border/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {peerSetLabel(r.sector, r.businessModel)}
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
                        <StatusTag status={status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.ownerName ?? EMPTY_CELL}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => open(r.sector, r.businessModel)}
                        >
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
          A sector with no peer set simply has no valuation yet — that is a legitimate state.
        </p>
      </div>

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
              onClick={() => open(picked, pickedModel === ALL_MODELS ? null : pickedModel)}
            >
              Build peer set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Editor — a list of companies linked from the master table       */
/* ------------------------------------------------------------------ */

const METRICS = [
  { key: "revenueThbM", label: "Revenue THB m", suffix: "" },
  { key: "ebitdaMarginPct", label: "EBITDA margin", suffix: "%" },
  { key: "evEbitda", label: "EV/EBITDA", suffix: "×" },
  { key: "pe", label: "P/E", suffix: "×" },
  { key: "pbv", label: "P/BV", suffix: "×" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function PeerSetEditor({
  sector,
  businessModel,
}: {
  sector: string;
  businessModel: string | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isControl } = usePermissions();
  const getFn = useServerFn(getPeerSet);
  const saveFn = useServerFn(savePeerSet);
  const listFn = useServerFn(listListedCompanies);
  const importFn = useServerFn(importListedCompanies);
  const fileRef = useRef<HTMLInputElement>(null);
  const label = peerSetLabel(sector, businessModel);

  const { data, isLoading } = useQuery({
    queryKey: ["peer-set", sector, businessModel],
    queryFn: () => getFn({ data: { sector, businessModel } }),
  });

  const { data: master } = useQuery<ListedCompany[]>({
    queryKey: ["listed-companies"],
    queryFn: () => listFn(),
  });

  const [peers, setPeers] = useState<Peer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (data && !loaded) {
      setPeers(data.peers);
      setLoaded(true);
    }
  }, [data, loaded]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          sector,
          businessModel,
          listedCompanyIds: peers
            .map((p) => p.listedCompanyId ?? p.id)
            .filter((v): v is string => !!v),
        },
      }),
    onSuccess: () => {
      toast.success("Peer set saved.");
      qc.invalidateQueries({ queryKey: ["peer-sets"] });
      qc.invalidateQueries({ queryKey: ["peer-set", sector, businessModel] });
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inSet = useMemo(
    () => new Set(peers.map((p) => p.listedCompanyId ?? p.id).filter(Boolean) as string[]),
    [peers],
  );

  /** One searchable line per company so ticker and name both match. */
  const options: ComboOption[] = useMemo(
    () =>
      (master ?? []).map((c) => ({
        value: `${c.ticker} — ${c.name}`,
        meta: c.market,
        added: inSet.has(c.id),
      })),
    [master, inSet],
  );

  const addById = (id: string) => {
    const c = (master ?? []).find((m) => m.id === id);
    if (!c || inSet.has(id)) return;
    setPeers((rows) => [...rows, listedToPeer(c)]);
  };

  const onPick = (value: string, isNew: boolean) => {
    if (isNew) {
      setTypedName(value);
      setNewCompanyOpen(true);
      return;
    }
    const c = (master ?? []).find((m) => `${m.ticker} — ${m.name}` === value);
    if (c) addById(c.id);
  };

  const status = peerSetStatus({
    exists: !!data?.exists,
    lastRefreshedAt: data?.lastRefreshedAt ?? null,
  });

  const onCsv = async (file: File) => {
    const text = await file.text();
    const { peers: parsed, errors } = parsePeerCsv(text);
    if (errors.length) toast.warning(errors.slice(0, 3).join(" "));
    if (!parsed.length) return;
    try {
      const res = await importFn({
        data: {
          rows: parsed.map((p) => ({
            ticker: (p.ticker || p.companyName).trim(),
            name: p.companyName.trim(),
            market: p.market,
            sector: null,
            revenueThbM: p.revenueThbM,
            ebitdaMarginPct: p.ebitdaMarginPct,
            evEbitda: p.evEbitda,
            pe: p.pe,
            pbv: p.pbv,
            asAt: null,
          })),
        },
      });
      const fresh = await qc.fetchQuery<ListedCompany[]>({
        queryKey: ["listed-companies"],
        queryFn: () => listFn(),
      });
      setPeers((rows) => {
        const have = new Set(rows.map((r) => r.listedCompanyId ?? r.id));
        const added = res.ids
          .filter((id) => !have.has(id))
          .map((id) => fresh.find((c) => c.id === id))
          .filter((c): c is ListedCompany => !!c)
          .map(listedToPeer);
        return [...rows, ...added];
      });
      toast.success(`${res.ids.length} companies linked from the file.`);
    } catch (e) {
      toast.error((e as Error).message);
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
          All peer sets
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
          <h1 className="text-base font-semibold">{label}</h1>
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
            <Upload className="mr-1.5 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(peerSetCsvFilename(sector, businessModel), peersToCsv(peers))
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            size="sm"
            disabled={!isControl || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>

        <div className="border-b border-border/60 px-4 py-3">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Add peer — search by ticker or company name
          </span>
          <SuggestCombobox
            id="add-peer"
            className="max-w-[520px]"
            options={options}
            noun="listed company"
            placeholder="e.g. TU, or Thai Union"
            onSelect={onPick}
          />
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
                <th className="w-24 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
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
              {!isLoading && peers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No companies in this set yet. Search above to add one.
                  </td>
                </tr>
              )}
              {!isLoading &&
                peers.map((p, i) => (
                  <tr key={p.listedCompanyId ?? p.id ?? i} className="border-t border-border/50">
                    <td className="px-3 py-2.5 font-medium">{p.companyName}</td>
                    <td className="px-3 py-2.5">{p.ticker ?? EMPTY_CELL}</td>
                    <td className="px-3 py-2.5 text-center">{p.market}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="px-3 py-2.5 text-right tabular-nums">
                        {fmtMetric(p[m.key as MetricKey], m.suffix)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${p.companyName}`}
                        onClick={() =>
                          setPeers((rows) => rows.filter((_, idx) => idx !== i))
                        }
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
                    {fmtMetric(median(peers.map((p) => p[m.key as MetricKey])), m.suffix)}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          {peers.length > 0 && peers.length < 4 && (
            <p className="text-warning">
              Fewer than 4 peers — the median may be distorted by one outlier.
            </p>
          )}
          {peers.length > 10 && (
            <p className="text-warning">
              More than 10 peers — large sets dilute the comparison.
            </p>
          )}
          <p>
            Ratios come from the Listed Companies table and are read-only here. Edit a company
            there to update every set that uses it.
          </p>
          {!isControl && <p>You can view this set but only administrators can save changes.</p>}
        </div>
      </div>

      <ListedCompanyDialog
        open={newCompanyOpen}
        onOpenChange={setNewCompanyOpen}
        defaultMarket="SET"
        prefillName={typedName}
        onSaved={async (id) => {
          const fresh = await qc.fetchQuery<ListedCompany[]>({
            queryKey: ["listed-companies"],
            queryFn: () => listFn(),
          });
          const c = fresh.find((m) => m.id === id);
          if (c) setPeers((rows) => [...rows, listedToPeer(c)]);
        }}
      />
    </div>
  );
}

function listedToPeer(c: ListedCompany): Peer {
  return {
    id: c.id,
    listedCompanyId: c.id,
    companyName: c.name,
    ticker: c.ticker,
    market: c.market,
    revenueThbM: c.revenueThbM,
    ebitdaMarginPct: c.ebitdaMarginPct,
    evEbitda: c.evEbitda,
    pe: c.pe,
    pbv: c.pbv,
  };
}
