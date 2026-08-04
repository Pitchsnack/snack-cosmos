import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Clock, CheckCircle2, XCircle, UserSearch } from "lucide-react";
import { BulkBar, ControlPagination, FilterSelect } from "./control-toolbar";
import { ConfidenceBadge, ReviewStatusBadge, REVIEW_LABELS } from "./badges";
import { DraftReviewPanel } from "./draft-review-panel";
import { useDecideDrafts, useDraftSummary, useDrafts } from "@/hooks/use-entity-control";
import { useDebounced } from "@/hooks/use-debounced";
import {
  DRAFTS_DISCLAIMER,
  DRAFT_SOURCES,
  DRAFT_TOTALS,
  getDraft,
} from "@/lib/entity-control/drafts-adapter";
import type { DraftListParams, DraftReviewStatus, EntityKind } from "@/lib/entity-control/types";
import { cn } from "@/lib/utils";

export function DraftControlTab() {
  const [kind, setKind] = useState<EntityKind>("startup");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);
  const [source, setSource] = useState<string | undefined>();
  const [status, setStatus] = useState<DraftReviewStatus | undefined>();
  const [confidence, setConfidence] = useState<DraftListParams["confidence"]>("all");
  const [extracted, setExtracted] = useState<DraftListParams["extracted"]>("any");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [openRef, setOpenRef] = useState<string | null>(null);

  const params: DraftListParams = useMemo(
    () => ({
      kind,
      page,
      pageSize,
      q: debouncedQ || undefined,
      source,
      status: status ?? "all",
      confidence,
      extracted,
    }),
    [kind, page, pageSize, debouncedQ, source, status, confidence, extracted],
  );

  const result = useDrafts(params);
  const summary = useDraftSummary(kind);
  const decide = useDecideDrafts();

  const reset = () => {
    setQ("");
    setSource(undefined);
    setStatus(undefined);
    setConfidence("all");
    setExtracted("any");
    setPage(1);
  };

  const toggle = (ref: string) =>
    setSelected((s) => (s.includes(ref) ? s.filter((x) => x !== ref) : [...s, ref]));

  const bulk = (s: DraftReviewStatus) => {
    decide(selected, s);
    setSelected([]);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-1">
          {(["startup", "investor"] as EntityKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setPage(1); setSelected([]); }}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                kind === k
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {k === "startup" ? "Startup Drafts" : "Investor Drafts"}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {DRAFT_TOTALS[k].toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={Clock} label="Pending review" value={summary.pending} hint={`of ${(DRAFT_TOTALS.startup + DRAFT_TOTALS.investor).toLocaleString()}`} />
          <SummaryCard icon={CheckCircle2} label="Approved today" value={summary.approvedToday} />
          <SummaryCard icon={XCircle} label="Rejected today" value={summary.rejectedToday} />
          <SummaryCard icon={UserSearch} label="Needs human review" value={summary.needsHumanReview} hint="High uncertainty or conflicts" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[18rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search entity name, website, email, source…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <FilterSelect
            label="Source"
            value={source}
            options={DRAFT_SOURCES.map((v) => ({ value: v, label: v }))}
            onChange={(v) => { setSource(v); setPage(1); }}
            width="w-36"
          />
          <FilterSelect
            label="Confidence"
            value={confidence === "all" ? undefined : confidence}
            options={[
              { value: "high", label: "High (90–100%)" },
              { value: "medium", label: "Medium (70–89%)" },
              { value: "low", label: "Low (<70%)" },
            ]}
            onChange={(v) => { setConfidence((v as DraftListParams["confidence"]) ?? "all"); setPage(1); }}
            width="w-40"
          />
          <FilterSelect
            label="Status"
            value={status}
            options={(Object.keys(REVIEW_LABELS) as DraftReviewStatus[]).map((v) => ({
              value: v,
              label: REVIEW_LABELS[v],
            }))}
            onChange={(v) => { setStatus(v as DraftReviewStatus | undefined); setPage(1); }}
            width="w-44"
          />
          <FilterSelect
            label="Last Extracted"
            value={extracted === "any" ? undefined : extracted}
            options={[
              { value: "24h", label: "Last 24 hours" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
            ]}
            onChange={(v) => { setExtracted((v as DraftListParams["extracted"]) ?? "any"); setPage(1); }}
            width="w-40"
          />
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>

        <BulkBar count={selected.length}>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={!selected.length} onClick={() => bulk("approved")}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => bulk("needs_review")}>
            Send to Review
          </Button>
          <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => bulk("rejected")}>
            Reject
          </Button>
          <Button size="sm" variant="outline" disabled={!selected.length}>
            Export
          </Button>
        </BulkBar>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="grid min-w-[1200px] grid-cols-[2.5rem_minmax(0,1.8fr)_6rem_5rem_7rem_7rem_minmax(0,2fr)_8rem_9rem_9rem] items-center gap-3 whitespace-nowrap [&>span]:truncate border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span />
            <span>Entity Name</span>
            <span>Type</span>
            <span>AI</span>
            <span>Source</span>
            <span>Country</span>
            <span>Key Extracted Fields</span>
            <span>Extracted</span>
            <span>Review Status</span>
            <span className="text-right">Actions</span>
          </div>

          {result.rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              <p>No {kind === "startup" ? "startup" : "investor"} drafts require review.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                Reset filters
              </Button>
            </div>
          ) : (
            result.rows.map((d) => (
              <div
                key={d.draft_ref}
                className="grid h-14 min-w-[1200px] grid-cols-[2.5rem_minmax(0,1.8fr)_6rem_5rem_7rem_7rem_minmax(0,2fr)_8rem_9rem_9rem] items-center gap-3 border-b border-border px-4 text-sm last:border-0 hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.includes(d.draft_ref)}
                  onCheckedChange={() => toggle(d.draft_ref)}
                  aria-label={`Select ${d.name}`}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.website}</div>
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {d.entity_kind === "startup" ? "Startup" : "Investor / VC"}
                </span>
                <ConfidenceBadge value={d.confidence} />
                <span className="truncate text-muted-foreground">{d.source}</span>
                <span className="truncate text-muted-foreground">{d.country}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {d.summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {new Date(d.extracted_at).toLocaleDateString()}
                </span>
                <ReviewStatusBadge status={d.status} />
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setOpenRef(d.draft_ref)}>
                    Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decide([d.draft_ref], "approved")}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}

          <ControlPagination
            page={page}
            pageSize={pageSize}
            total={result.total}
            approximate={result.approximate}
            onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        </div>
      </div>

      <aside className="hidden h-fit rounded-lg border border-border bg-card p-4 text-sm xl:block">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Sparkles className="h-4 w-4" />
        </div>
        <h2 className="font-semibold">AI Draft Extraction</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          AI Draft Extraction reviews new startup and investor records before they enter Control or
          the Directory.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          AI extracts data from configured sources and highlights records that need human validation.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Review, approve or reject drafts to keep the Control database accurate and high quality.
        </p>
        <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
          {DRAFTS_DISCLAIMER}
        </p>
      </aside>

      <DraftReviewPanel
        draft={openRef ? getDraft(openRef) : null}
        onClose={() => setOpenRef(null)}
        onDecide={decide}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
