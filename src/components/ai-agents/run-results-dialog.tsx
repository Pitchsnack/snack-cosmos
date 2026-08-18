import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentRun } from "@/lib/ai-agents/types";

export function RunResultsDialog({
  run,
  onOpenChange,
}: {
  run: AgentRun | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!run} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Results — {run?.id}</DialogTitle>
          <DialogDescription>
            Structured startup results with source evidence. Results are not official Global
            Startup records until an AI Draft is approved.
          </DialogDescription>
        </DialogHeader>

        {run && run.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">This run returned no results.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Startup Name</th>
                  <th className="px-3 py-2 font-medium">Website</th>
                  <th className="px-3 py-2 font-medium">Year Founded</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">City</th>
                  <th className="px-3 py-2 font-medium">Sources</th>
                  <th className="px-3 py-2 font-medium">Duplicate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run?.results.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 font-medium">
                      {r.name}
                      {r.conflicts.map((c) => (
                        <div
                          key={c.field}
                          className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-1.5 text-[11px] text-amber-700 dark:text-amber-400"
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Conflicting {c.field}
                          </div>
                          {c.values.map((v) => (
                            <div key={v.value}>
                              {v.value} —{" "}
                              <a
                                href={v.source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                {v.source.label}
                              </a>
                            </div>
                          ))}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {r.website.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.yearFounded ?? "—"}</td>
                    <td className="px-3 py-2">{r.country ?? "—"}</td>
                    <td className="px-3 py-2">{r.city ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        {r.sources.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            {s.label}
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {r.duplicateStatus === "possible" ? (
                        <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-600 dark:text-purple-400">
                          Possible duplicate{r.duplicateOf ? ` — ${r.duplicateOf}` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
