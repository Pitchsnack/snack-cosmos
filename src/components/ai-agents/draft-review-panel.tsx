import { useState } from "react";
import { AlertTriangle, ExternalLink, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveDraft,
  finalDuplicateCheck,
  rejectDraft,
} from "@/lib/ai-agents/agent-runtime";
import type { AiDraft } from "@/lib/ai-agents/types";
import { cn } from "@/lib/utils";

export function AiDraftsPanel({ drafts }: { drafts: AiDraft[] }) {
  const [pendingApproval, setPendingApproval] = useState<{
    draft: AiDraft;
    match?: string;
  } | null>(null);

  if (drafts.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No AI Drafts yet. Run the Find Startups AI Agent to generate drafts for review.
      </p>
    );
  }

  const startApproval = (draft: AiDraft) => {
    // Mandatory final duplicate check, always re-run immediately before approval.
    const { match } = finalDuplicateCheck(draft.id);
    setPendingApproval({ draft, match });
    if (!match) {
      approveDraft(draft.id);
      setPendingApproval(null);
      toast.success(`${draft.result.name} approved and created as a Global Startup.`);
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Startup Name</th>
              <th className="px-3 py-2 font-medium">Website</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Country</th>
              <th className="px-3 py-2 font-medium">City</th>
              <th className="px-3 py-2 font-medium">Sources</th>
              <th className="px-3 py-2 font-medium">Duplicate</th>
              <th className="px-3 py-2 font-medium">Draft Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {drafts.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium">{d.result.name}</td>
                <td className="px-3 py-2">
                  <a
                    href={d.result.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {d.result.website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
                <td className="px-3 py-2 tabular-nums">{d.result.yearFounded ?? "—"}</td>
                <td className="px-3 py-2">{d.result.country ?? "—"}</td>
                <td className="px-3 py-2">{d.result.city ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    {d.result.sources.map((s) => (
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
                <td className="px-3 py-2 text-xs">
                  {d.result.duplicateStatus === "possible" ? (
                    <span className="text-purple-600 dark:text-purple-400">Possible duplicate</span>
                  ) : (
                    <span className="text-muted-foreground">No match</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      d.status === "approved"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : d.status === "rejected"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
                    )}
                  >
                    {d.status === "pending_review"
                      ? "AI Draft — Pending Review"
                      : d.status === "approved"
                        ? "Approved"
                        : "Rejected"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {d.status === "pending_review" ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => startApproval(d)}>
                        Approve & Create
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          rejectDraft(d.id);
                          toast.success("AI Draft rejected.");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!pendingApproval?.match}
        onOpenChange={(o) => !o && setPendingApproval(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Possible Duplicate Found
            </DialogTitle>
            <DialogDescription>
              The final duplicate check matched an existing official Global Startup:{" "}
              <strong className="text-foreground">{pendingApproval?.match}</strong>. The existing
              record is never modified or deleted from this workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Delete here rejects the AI Draft only.
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button variant="outline" asChild>
              <a href="/global-startups" target="_blank" rel="noreferrer">
                View Existing Record
              </a>
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (pendingApproval) rejectDraft(pendingApproval.draft.id);
                  setPendingApproval(null);
                  toast.success("AI Draft rejected.");
                }}
              >
                Reject / Delete AI Draft
              </Button>
              <Button
                onClick={() => {
                  if (pendingApproval) approveDraft(pendingApproval.draft.id);
                  setPendingApproval(null);
                  toast.success("Global Startup created despite possible duplicate.");
                }}
              >
                Create Anyway
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
