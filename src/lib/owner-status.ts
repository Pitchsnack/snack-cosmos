import type { HiddenProfileRow } from "@/lib/hidden-profile";
import type { AdvisorFirm } from "@/lib/advisor-firm";
import type { BuyerProfile } from "@/lib/buyer-profile";

/** Existing publication/approval states used by the shared owner card and List row. */
export type OwnerStatus = "draft" | "pending" | "changes" | "rejected" | "live" | "paused" | "live_edits_pending";

export const OWNER_STATUS_LABEL: Record<OwnerStatus, string> = {
  draft: "Draft",
  pending: "Pending approval",
  changes: "Changes requested",
  rejected: "Not approved",
  live: "Live",
  paused: "Paused",
  live_edits_pending: "Live · edits pending",
};

export function sellerOwnerStatus(row: HiddenProfileRow | null | undefined): OwnerStatus {
  if (!row) return "draft";
  if (row.status === "live" && row.has_unpublished_changes) return "live_edits_pending";
  switch (row.approval_status ?? "draft") {
    case "in_review": return "pending";
    case "changes_requested": return "changes";
    case "rejected": return "rejected";
    case "live": return "live";
    case "live_edits_pending": return "live_edits_pending";
    case "unpublished": return "paused";
    default: return "draft";
  }
}

export function buyerOwnerStatus(p: BuyerProfile & { approval_status?: string | null }): OwnerStatus {
  if (p.status === "paused") return "paused";
  const approval = p.approval_status ?? "draft";
  if (p.status === "live" && (approval === "in_review" || approval === "changes_requested")) return "live_edits_pending";
  switch (approval) {
    case "in_review":
    case "pending": return "pending";
    case "changes_requested":
    case "more_info": return "changes";
    case "rejected":
    case "declined": return "rejected";
    case "approved":
    case "live": return p.status === "live" ? "live" : "draft";
    case "unpublished": return "paused";
    default: return "draft";
  }
}

export function advisorOwnerStatus(f: Pick<AdvisorFirm, "status" | "verification">): OwnerStatus {
  if (f.status === "paused") return "paused";
  const verification = f.verification?.state;
  if (f.status === "live" && (verification === "pending" || verification === "re_check")) return "live_edits_pending";
  switch (verification) {
    case "pending":
    case "re_check": return "pending";
    case "more_info": return "changes";
    case "declined": return "rejected";
    default: return f.status === "live" ? "live" : "draft";
  }
}
