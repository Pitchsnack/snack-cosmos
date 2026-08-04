import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConfidenceBadge, ReviewStatusBadge } from "./badges";
import { DRAFTS_DISCLAIMER } from "@/lib/entity-control/drafts-adapter";
import type { DraftRecord, DraftReviewStatus } from "@/lib/entity-control/types";
import { AlertTriangle, Copy, ExternalLink } from "lucide-react";

export function DraftReviewPanel({
  draft,
  onClose,
  onDecide,
}: {
  draft: DraftRecord | null;
  onClose: () => void;
  onDecide: (refs: string[], status: DraftReviewStatus) => void;
}) {
  return (
    <Sheet open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {draft && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {draft.name}
                <ConfidenceBadge value={draft.confidence} />
                <ReviewStatusBadge status={draft.status} />
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-6 text-sm">
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                AI Draft ≠ Published Record. AI extraction ≠ automatic approval. {DRAFTS_DISCLAIMER}
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Meta label="Entity Type" value={draft.entity_kind === "startup" ? "Startup" : "Investor / VC"} />
                <Meta label="Source" value={draft.source} />
                <Meta label="Country / HQ" value={draft.country} />
                <Meta
                  label="Extraction Date"
                  value={new Date(draft.extracted_at).toLocaleString()}
                />
              </dl>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Extracted Data
                </h3>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {draft.fields.map((f) => (
                    <li key={f.label} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">{f.label}</div>
                        <div className="break-words">{f.value}</div>
                      </div>
                      <ConfidenceBadge value={f.confidence} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Field-level confidence is AI-proposed and not human-verified.
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Source Evidence
                </h3>
                <a
                  href={draft.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  {draft.source_url} <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <div className="mt-1 text-xs text-muted-foreground">
                  Extracted {new Date(draft.extracted_at).toLocaleString()}
                </div>
              </section>

              {draft.issues.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Potential Issues
                  </h3>
                  <ul className="space-y-1">
                    {draft.issues.map((i) => (
                      <li key={i} className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {i}
                      </li>
                    ))}
                  </ul>
                  {draft.duplicate_of && (
                    <div className="mt-3 rounded-md border border-border p-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Copy className="h-4 w-4" /> Possible duplicate — {draft.duplicate_of}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline">
                          Compare Existing Record
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDecide([draft.draft_ref], "pending_review")}
                        >
                          Review as New
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDecide([draft.draft_ref], "rejected")}
                        >
                          Reject Draft
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Records are never merged automatically from this screen.
                      </p>
                    </div>
                  )}
                </section>
              )}

              <Separator />

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Human Review
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => {
                      onDecide([draft.draft_ref], "approved");
                      onClose();
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDecide([draft.draft_ref], "needs_review")}
                  >
                    Send to Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onDecide([draft.draft_ref], "rejected");
                      onClose();
                    }}
                  >
                    Reject
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approving creates an <strong>Unpublished</strong> Control record. Publication is a
                  separate, explicit decision.
                </p>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
