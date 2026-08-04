import { cn } from "@/lib/utils";
import type { DirectoryState, DraftReviewStatus } from "@/lib/entity-control/types";

export function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 90
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : value >= 70
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-orange-600/40 bg-orange-600/10 text-orange-600 dark:text-orange-400";
  const label = value >= 90 ? "High confidence" : value >= 70 ? "Medium confidence" : "Low confidence";
  return (
    <span
      title={label}
      className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", tone)}
    >
      {value}%
    </span>
  );
}

export function DirectoryStateBadge({ state }: { state: DirectoryState }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
        state === "published"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {state === "published" ? "Published" : "Unpublished"}
    </span>
  );
}

const REVIEW_LABELS: Record<DraftReviewStatus, string> = {
  pending_review: "Pending Review",
  needs_review: "Needs Review",
  approved: "Approved",
  rejected: "Rejected",
  duplicate_suspected: "Duplicate Suspected",
  conflict_detected: "Conflict Detected",
  incomplete: "Incomplete",
};

export function ReviewStatusBadge({ status }: { status: DraftReviewStatus }) {
  const tone: Record<DraftReviewStatus, string> = {
    pending_review: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    needs_review: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rejected: "border-destructive/40 bg-destructive/10 text-destructive",
    duplicate_suspected: "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    conflict_detected: "border-orange-600/40 bg-orange-600/10 text-orange-600 dark:text-orange-400",
    incomplete: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", tone[status])}>
      {REVIEW_LABELS[status]}
    </span>
  );
}

export { REVIEW_LABELS };
