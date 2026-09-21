import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Layers, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { SuggestCombobox, type ComboOption } from "@/components/ui/suggest-combobox";
import { PermissionGuard } from "@/components/permission-guard";
import { ListedCompaniesTab } from "@/components/peer-comparables/listed-companies-tab";
import { PeerSetsTab } from "@/components/peer-comparables/peer-sets-tab";
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
import { getPeerSet, listPeerSets, savePeerSet } from "@/lib/peer-comparables.functions";

const searchSchema = z.object({
  tab: z.enum(["sets", "companies"]).optional(),
  /** Editor: an open peer set. */
  sector: z.string().optional(),
  model: z.string().optional(),
  /** Round trip from the peer picker to the company form and back. */
  addName: z.string().optional(),
  fromSector: z.string().optional(),
  fromModel: z.string().optional(),
  add: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/peer-comparables")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Peer Comparables — SnackPortal2" },
      {
        name: "description",
        content:
          "Peer sets keyed on sector and business model, and the listed companies behind them.",
      },
      { property: "og:title", content: "Peer Comparables — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Maintain peer sets and the master list of SET and mai listed companies used in valuations.",
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

function fmtDate(iso: string | null) {
  if (!iso) return EMPTY_CELL;
  return new Date(iso).toISOString().slice(0, 10);
}

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

/* ------------------------------------------------------------------ */
/* Page — two tabs over one heading                                    */
/* ------------------------------------------------------------------ */

function PeerComparablesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const listSetsFn = useServerFn(listPeerSets);
  const listCompaniesFn = useServerFn(listListedCompanies);

  const { data: sets, isLoading: setsLoading } = useQuery<PeerSetSummary[]>({
    queryKey: ["peer-sets"],
    queryFn: () => listSetsFn(),
  });
  const { data: companies, isLoading: companiesLoading } = useQuery<ListedCompany[]>({
    queryKey: ["listed-companies"],
    queryFn: () => listCompaniesFn(),
  });

  if (search.sector) {
    return (
      <PeerSetEditor
        sector={search.sector}
        businessModel={search.model ?? null}
        addId={search.add ?? null}
      />
    );
  }

  const tab = search.tab === "companies" ? "companies" : "sets";
  const go = (next: "sets" | "companies") => navigate({ to: "/peer-comparables", search: { tab: next } });

  const tabs = (
    <div className="flex items-center gap-6">
      {(
        [
          { key: "sets" as const, label: "Peer Sets", count: sets?.length ?? 0 },
          { key: "companies" as const, label: "Listed Companies", count: companies?.length ?? 0 },
        ]
      ).map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => go(t.key)}
          aria-current={tab === t.key}
          className={cn(
            "flex items-center gap-2 border-b-[2.5px] py-2.5 text-sm transition-colors",
            tab === t.key
              ? "border-[hsl(222_47%_23%)] font-bold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          <span
            className={cn(
              "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
              tab === t.key
                ? "bg-[hsl(222_47%_23%)] text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t.count}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Administration
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Peer Comparables</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listed-company comparables used for financial benchmarking. Peer sets are keyed on
          sector and business model; listed companies are the reference data behind them.
        </p>
      </div>

      {tab === "sets" ? (
        <PeerSetsTab
          key="sets"
          tabs={tabs}
          sets={sets ?? []}
          isLoading={setsLoading}
          onOpen={(sector, model) =>
            navigate({
              to: "/peer-comparables",
              search: model ? { sector, model } : { sector },
            })
          }
        />
      ) : (
        <ListedCompaniesTab
          key="companies"
          tabs={tabs}
          companies={companies ?? []}
          isLoading={companiesLoading}
          prefillName={search.addName}
          onDialogClosed={() =>
            search.addName &&
            navigate({ to: "/peer-comparables", search: { tab: "companies" } })
          }
          onSavedReturn={(id) => {
            if (search.fromSector) {
              navigate({
                to: "/peer-comparables",
                search: {
                  sector: search.fromSector,
                  ...(search.fromModel ? { model: search.fromModel } : {}),
                  add: id,
                },
              });
            }
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor — a list of companies linked from the master table           */
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
  addId,
}: {
  sector: string;
  businessModel: string | null;
  addId: string | null;
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
  const [merged, setMerged] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setPeers(data.peers);
      setLoaded(true);
    }
  }, [data, loaded]);

  /** Coming back from the company form: link the company just created. */
  useEffect(() => {
    if (!loaded || merged || !addId || !master) return;
    const c = master.find((m) => m.id === addId);
    setMerged(true);
    if (c) {
      setPeers((rows) =>
        rows.some((r) => (r.listedCompanyId ?? r.id) === c.id) ? rows : [...rows, listedToPeer(c)],
      );
    }
    navigate({
      to: "/peer-comparables",
      search: businessModel ? { sector, model: businessModel } : { sector },
      replace: true,
    });
  }, [loaded, merged, addId, master, navigate, sector, businessModel]);

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

  const onPick = (value: string, isNew: boolean) => {
    if (isNew) {
      // Open the Listed Companies tab, and come back to this set afterwards.
      navigate({
        to: "/peer-comparables",
        search: {
          tab: "companies",
          addName: value,
          fromSector: sector,
          ...(businessModel ? { fromModel: businessModel } : {}),
        },
      });
      return;
    }
    const c = (master ?? []).find((m) => `${m.ticker} — ${m.name}` === value);
    if (c && !inSet.has(c.id)) setPeers((rows) => [...rows, listedToPeer(c)]);
  };

  const isBaseline = !!data?.isBaseline;

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
          onClick={() => navigate({ to: "/peer-comparables", search: { tab: "sets" } })}
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
          {isBaseline ? null : (
          <>
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
          </>
          )}
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
          {!isBaseline && (
            <Button size="sm" disabled={!isControl || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>

        {isBaseline && (
          <div className="border-b border-border/60 bg-info/5 px-4 py-3 text-xs text-foreground">
            <strong>Baseline set</strong> — generated automatically from SET listings in this
            sector. To customise the comparables, create a business-model set.
          </div>
        )}

        {!isBaseline && (
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
        )}

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
                    {isBaseline
                      ? "No companies in this baseline set."
                      : "No companies in this set yet. Search above to add one."}
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
                      {!isBaseline && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${p.companyName}`}
                        onClick={() => setPeers((rows) => rows.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      )}
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
            <p className="text-warning">More than 10 peers — large sets dilute the comparison.</p>
          )}
          <p>
            Ratios come from the Listed Companies tab and are read-only here. Edit a company there
            to update every set that uses it.
          </p>
          {!isControl && !isBaseline && (
            <p>You can view this set but only administrators can save changes.</p>
          )}
        </div>
      </div>
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
