import { Fragment, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleSlash,
  Database,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunResultsDialog } from "@/components/ai-agents/run-results-dialog";
import { AiDraftsPanel } from "@/components/ai-agents/draft-review-panel";
import {
  cancelRun,
  pauseRun,
  restartRun,
  resumeRun,
  summariseCriteria,
} from "@/lib/ai-agents/agent-runtime";
import type { AgentRun, AiDraft, RunStatus } from "@/lib/ai-agents/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<RunStatus, string> = {
  draft: "Draft",
  running: "Running",
  paused: "Paused",
  waiting_for_user: "Waiting for User",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function StatusPill({ status }: { status: RunStatus }) {
  const tone: Record<RunStatus, string> = {
    draft: "border-border bg-muted text-muted-foreground",
    running: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    paused: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    waiting_for_user: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
    cancelled: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tone[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StatusResultsSection({
  runs,
  drafts,
}: {
  runs: AgentRun[];
  drafts: AiDraft[];
}) {
  const [openRun, setOpenRun] = useState<AgentRun | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const completed = runs.filter((r) => r.status === "completed");
  const stats = [
    { label: "Total Runs", value: runs.length, icon: Activity },
    { label: "Completed", value: completed.length, icon: CheckCircle2 },
    { label: "In Progress", value: runs.filter((r) => r.status === "running" || r.status === "paused").length, icon: Loader2 },
    { label: "Failed", value: runs.filter((r) => r.status === "failed").length, icon: TriangleAlert },
    { label: "No Results", value: completed.filter((r) => r.results.length === 0).length, icon: CircleSlash },
    { label: "Total Startups Found", value: completed.reduce((a, r) => a + r.results.length, 0), icon: Database },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          3
        </span>
        <h2 className="text-xl font-semibold tracking-tight">Status &amp; Results</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Track progress, view status, and explore results. Runs continue in the background while you
        work elsewhere in SnackPortal2.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="runs" className="mt-6">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="drafts">AI Drafts ({drafts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="pt-4">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet. Configure criteria above and choose Run Now.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Run ID</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 font-medium">Criteria Summary</th>
                    <th className="px-3 py-2 font-medium">Schedule</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Progress</th>
                    <th className="px-3 py-2 font-medium">Results</th>
                    <th className="px-3 py-2 font-medium">AI Drafts</th>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="align-top">
                        <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                        <td className="px-3 py-2">Find Startups</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {summariseCriteria(r.criteria).map((p) => (
                            <div key={p}>{p}</div>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.scheduleLabel}</td>
                        <td className="px-3 py-2">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-3 py-2 w-40">
                          <Progress value={r.progress} className="h-1.5" />
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {r.progress}%
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{r.results.length}</td>
                        <td className="px-3 py-2 tabular-nums">{r.draftIds.length}</td>
                        <td className="px-3 py-2 text-xs">
                          {new Date(r.startedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {Math.round(r.durationMs / 1000)}s
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.status === "running" && (
                              <Button size="sm" variant="outline" onClick={() => pauseRun(r.id)}>
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {r.status === "paused" && (
                              <Button size="sm" variant="outline" onClick={() => resumeRun(r.id)}>
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(r.status === "running" || r.status === "paused") && (
                              <Button size="sm" variant="outline" onClick={() => cancelRun(r.id)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(r.status === "failed" ||
                              r.status === "cancelled" ||
                              r.status === "completed") && (
                              <Button size="sm" variant="outline" onClick={() => restartRun(r.id)}>
                                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restart
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => setOpenRun(r)}
                              disabled={r.results.length === 0}
                            >
                              View Results
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                            >
                              {expanded === r.id ? "Hide steps" : "Steps"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr className="bg-muted/20">
                          <td colSpan={11} className="px-3 py-3">
                            <ul className="space-y-1 text-xs">
                              {r.steps.map((s, i) => (
                                <li key={s.label} className="flex items-center gap-2">
                                  <span className="w-4 text-center">
                                    {s.state === "done"
                                      ? "✓"
                                      : s.state === "active"
                                        ? "→"
                                        : s.state === "failed"
                                          ? "✕"
                                          : "○"}
                                  </span>
                                  <span
                                    className={cn(
                                      s.state === "pending" && "text-muted-foreground",
                                      s.state === "failed" && "text-destructive",
                                    )}
                                  >
                                    Step {i + 1} — {s.label}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {r.followUps.length > 0 && (
                              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                <div className="font-medium text-foreground">Follow-up activity</div>
                                {r.followUps.map((f) => (
                                  <div key={f.at}>
                                    {new Date(f.at).toLocaleString()} — {f.note}
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="mt-3 text-[11px] text-muted-foreground">
                              Restart always begins from Step 1. Previous runs stay in history and
                              are never overwritten.
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="pt-4">
          <div className="rounded-lg border border-border">
            <AiDraftsPanel drafts={drafts} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            AI Draft ≠ official Global Startup record. Approval always re-runs the duplicate check
            first, and never deletes an existing Global record.
          </p>
        </TabsContent>
      </Tabs>

      <RunResultsDialog run={openRun} onOpenChange={(o) => !o && setOpenRun(null)} />
    </section>
  );
}
