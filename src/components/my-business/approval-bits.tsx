import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronDown, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  getSubmissionPreview, submitListing, unpublishListing, withdrawListing,
} from "@/lib/approvals.functions";
import type { ApprovalStatus, HiddenProfileRow } from "@/lib/hidden-profile";
import { cn } from "@/lib/utils";
import { reportPrice } from "@/components/my-business/report-offers";

// Approval is the only source of truth; the legacy status column is never read.
export const approvalOf = (row: HiddenProfileRow | null | undefined): ApprovalStatus =>
  (row?.approval_status as ApprovalStatus) ?? "draft";

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  live: "Live",
  live_edits_pending: "Live · edits pending",
  rejected: "Rejected",
  unpublished: "Unpublished",
};

export const APPROVAL_TONE: Record<ApprovalStatus, string> = {
  draft: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  unpublished: "bg-muted text-muted-foreground",
  in_review: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  changes_requested: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  live_edits_pending: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function useApprovalMutation<I>(fn: (a: { data: I }) => Promise<unknown>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: I) => fn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hidden-profiles"] });
      qc.invalidateQueries({ queryKey: ["marketplace-teasers"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(ok);
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function useApprovalActions() {
  return {
    submit: useApprovalMutation<{ startupId: string }>(useServerFn(submitListing), "Submitted for approval"),
    withdraw: useApprovalMutation<{ startupId: string }>(useServerFn(withdrawListing), "Submission withdrawn"),
    unpublish: useApprovalMutation<{ startupId: string }>(useServerFn(unpublishListing), "Listing unpublished"),
  };
}

/** Notice shown above the panel content on both tabs. */
export function ApprovalNotice({ row, onEditPublic }: { row: HiddenProfileRow | null; onEditPublic: () => void }) {
  const st = approvalOf(row);
  if (!row || st === "draft" || st === "unpublished") return null;
  const box = "mb-4 flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-[13px] leading-relaxed";
  if (st === "in_review")
    return <div className={cn(box, "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200")}><Clock className="mt-0.5 h-4 w-4 shrink-0" /><span>Submitted for approval on {fmt(row.submitted_at)}. Admin usually reviews within 1 business day. You'll get a notification when it's decided.</span></div>;
  if (st === "changes_requested")
    return (
      <div className={cn(box, "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200")}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Admin requested changes on {fmt(row.decided_at)}</div>
          {row.decision_note && <p className="mt-0.5">“{row.decision_note}”</p>}
          {!!row.decision_fields?.length && <p className="mt-1 text-[12px]">Fields to fix: {row.decision_fields.join(" · ")}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={onEditPublic}>Edit public view</Button>
      </div>
    );
  if (st === "live")
    return null;
  if (st === "live_edits_pending") {
    const changed = changedFields(row);
    return (
      <div className={cn(box, "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200")}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          You changed {changed.length || "some"} thing{changed.length === 1 ? "" : "s"} since approval{changed.length ? `: ${changed.join(", ")}` : ""}. Buyers still see the approved version from {fmt(row.published_at)}. Resubmit to publish the changes.
        </span>
      </div>
    );
  }
  return <div className={cn(box, "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200")}><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Rejected on {fmt(row.decided_at)}.</b> {row.decision_note} The listing stays a Draft.</span></div>;
}

const FIELD_LABEL: Record<string, string> = {
  headline: "Headline", description: "Description", product_tags: "Products & services", market_tags: "Markets",
  code_name: "Code name", asking_price: "Asking price", stake_pct: "Stake", deal_type: "Deal type", cover_image_url: "Cover picture",
  highlights: "Highlights", region: "Region", structure: "Structure", reason: "Reason for sale",
};
function changedFields(row: HiddenProfileRow) {
  const live = (row.live ?? {}) as unknown as Record<string, unknown>;
  const cur = row as unknown as Record<string, unknown>;
  return Object.keys(FIELD_LABEL).filter((k) => JSON.stringify(live[k] ?? null) !== JSON.stringify(cur[k] ?? null)).map((k) => FIELD_LABEL[k]);
}

type Missing = { key: string; label: string };

/** Footer bar, identical on the Public and Private view tabs. */
export function ApprovalFooter({
  startupId, row, missing, flagged, blockedReason, onItem, onCreate,
}: {
  startupId: string;
  row: HiddenProfileRow | null;
  missing: Missing[];
  flagged: number;
  blockedReason?: string | null;
  onItem: (k: string) => void;
  onCreate: () => void;
}) {
  const st = approvalOf(row);
  const a = useApprovalActions();
  const [confirm, setConfirm] = useState(false);
  const ready = !!row && missing.length === 0 && flagged === 0 && !blockedReason;
  const submitBtn = (label = "Submit ") => (
    <Button size="sm" disabled={!ready} onClick={() => setConfirm(true)} className="bg-[#1e2a4a] text-white hover:bg-[#1e2a4a]/90">{label}</Button>
  );
  let text: React.ReactNode;
  let action: React.ReactNode;
  if (st === "in_review") {
    text = <>In review since {fmt(row?.submitted_at)}</>;
    action = <Button size="sm" variant="outline" disabled={a.withdraw.isPending} onClick={() => a.withdraw.mutate({ startupId })}>Withdraw submission</Button>;
  } else if (st === "changes_requested") {
    text = <>Admin requested changes on {fmt(row?.decided_at)}. Fix the fields above, then resubmit both views.</>;
    action = submitBtn("Resubmit");
  } else if (st === "live") {
    text = <>Posted on {fmt(row?.published_at)}</>;
    action = <Button size="sm" variant="outline" disabled={a.unpublish.isPending} onClick={() => a.unpublish.mutate({ startupId })}>Delist</Button>;
  } else if (st === "live_edits_pending") {
    text = <>Buyers see the approved version from {fmt(row?.published_at)} until you resubmit.</>;
    action = submitBtn("Resubmit");
  } else if (!row) {
    text = <>Create your Public view before you can submit for approval.</>;
    action = <><Button size="sm" variant="outline" onClick={onCreate}>Create public view</Button>{submitBtn()}</>;
  } else if (!ready) {
    const parts: React.ReactNode[] = missing.map((m) => (
      <button key={m.key} type="button" onClick={() => onItem(m.key)} className="font-semibold text-foreground underline-offset-2 hover:underline">{m.label}</button>
    ));
    if (flagged) parts.push(<span key="id" className="font-semibold text-destructive">Identity check</span>);
    text = blockedReason && !parts.length ? blockedReason : (
      <>{parts.length} required item{parts.length === 1 ? "" : "s"} before you can submit for approval: {parts.map((p, i) => <span key={i}>{i > 0 && " · "}{p}</span>)}. Recommended: verified financial report ({reportPrice("financials")}).</>
    );
    action = submitBtn();
  } else {
    text = <>Everything is ready. Your Public view and Private view are submitted together; Admin usually reviews within 1 business day.</>;
    action = submitBtn(st === "rejected" || st === "unpublished" ? "Resubmit" : "Submit for approval");
  }
  return (
    <>
      <div className="-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-b-[14px] border-t border-border bg-[#FAFAFB] px-5 py-3.5 text-[13px] text-muted-foreground dark:bg-muted/40">
        <span className="min-w-0 flex-1">{text}</span>
        <div className="flex shrink-0 gap-2">{action}</div>
      </div>
      {confirm && (
        <ConfirmSubmitDialog
          startupId={startupId}
          onClose={() => setConfirm(false)}
          onEdit={(k) => { setConfirm(false); onItem(k); }}
          submitting={a.submit.isPending}
          onSubmit={() => a.submit.mutate({ startupId }, { onSuccess: () => setConfirm(false) })}
        />
      )}
    </>
  );
}

function ConfirmSubmitDialog({
  startupId, onClose, onEdit, onSubmit, submitting,
}: { startupId: string; onClose: () => void; onEdit: (k: string) => void; onSubmit: () => void; submitting: boolean }) {
  const fn = useServerFn(getSubmissionPreview);
  const { data, isLoading, error } = useQuery({ queryKey: ["submission-preview", startupId], queryFn: () => fn({ data: { startupId } }) });
  const [ok, setOk] = useState(false);
  const p = (data?.public ?? {}) as Record<string, any>;
  const v = (data?.private ?? {}) as Record<string, any>;
  const list = (x: unknown) => (Array.isArray(x) && x.length ? x.join(", ") : "—");
  const years = ((v.financial_years ?? []) as number[]).sort();
  const pub: [string, React.ReactNode][] = [
    ["Headline", p.headline || "—"],
    ["Description", p.description || "—"],
    ["Products & services", list(p.product_tags ?? v.product_tags)],
    ["Markets", list(p.market_tags ?? v.market_tags)],
    ["Revenue FY25", v.last_year_revenue ? <>{v.last_year_revenue} <span className="text-muted-foreground">(range)</span></> : "—"],
    ["Location", p.region || v.region || "—"],
    ["Type", v.company_type || "—"],
    ["Founded", v.year_founded ? `${Math.floor(v.year_founded / 10) * 10}s` : "—"],
    ["Employees", v.company_size || "—"],
    ["Sector", v.sector || "—"],
    ["Certifications", list([...(v.regulatory_licenses ?? []), ...(v.iso_standards ?? [])])],
    ["Identity check", data?.identity_flags?.length ? <span className="text-destructive">{data.identity_flags.length} flag(s): {data.identity_flags.join(", ")}</span> : <span className="text-emerald-700">Clean · no company, product or people names</span>],
  ];
  const priv: [string, React.ReactNode][] = [
    ["Company", v.registered_name || v.startup_name || "—"],
    ["Registration no.", v.registered_number || "—"],
    ["Website", v.website_url || "—"],
    ["Address", v.headquarters || v.city || "—"],
    ["Founded", v.year_founded ?? "—"],
    ["Staff", v.company_size || "—"],
    ["Revenue FY23–25", years.length ? `Financials for FY${years.join(", FY")}` : "—"],
    ["EBITDA FY25", years.length ? "From your financial statements" : "—"],
    ["Deal terms", [p.deal_type, p.stake_pct != null ? `${p.stake_pct}% stake` : null, p.asking_price ? `Asking ${Number(p.asking_price).toLocaleString()}` : null].filter(Boolean).join(" · ") || "—"],
    ["Founder & key people", list(v.people)],
    ["Photos", v.photos ? `${v.photos} uploaded` : "—"],
    ["Data room", "Not set up yet"],
  ];
  const Section = ({ title, rows, edit }: { title: string; rows: [string, React.ReactNode][]; edit: string }) => (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <button type="button" onClick={() => onEdit(edit)} className="text-[12.5px] font-semibold text-primary hover:underline">Edit</button>
      </div>
      {rows.map(([k, val]) => (
        <div key={k} className="flex gap-3 border-t border-border py-2 text-[13px]">
          <span className="w-[150px] shrink-0 text-muted-foreground">{k}</span>
          <span className="min-w-0 flex-1 break-words">{val}</span>
        </div>
      ))}
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[640px]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <div className="border-b border-border px-6 py-4">
          <DialogTitle>Confirm and submit</DialogTitle>
          <DialogDescription>Admin reviews both views together. Check the details, then submit.</DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : (
            <>
              <Section title="Public view" rows={pub} edit="hidden" />
              <Section title="Private view" rows={priv} edit="private" />
            </>
          )}
        </div>
        <div className="border-t border-border px-6 py-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
            <Checkbox checked={ok} onCheckedChange={(c) => setOk(c === true)} className="mt-0.5" />
            <span>The information is accurate and I'm authorised to list this business. Any change after approval must be resubmitted.</span>
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Back</Button>
            <Button disabled={!ok || submitting || !data || !!data.identity_flags?.length} onClick={onSubmit} className="bg-[#1e2a4a] text-white hover:bg-[#1e2a4a]/90">
              <Check className="mr-1.5 h-4 w-4" />{submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "✓ Approved {date}" chip with the resubmit note in a popover. Shown while an approved version is live. */
export function ApprovedChip({ row }: { row: HiddenProfileRow | null | undefined }) {
  const [open, setOpen] = useState(false);
  const st = approvalOf(row);
  if (!row || (st !== "live" && st !== "live_edits_pending")) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-expanded={open} className="inline-flex h-[22px] items-center gap-1 rounded-full border border-border bg-background px-2 text-xs font-medium text-muted-foreground">
          <Check className="h-3 w-3 text-emerald-600" />Approved {fmt(row.published_at)}
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[300px] rounded-[10px] px-3 py-2.5 text-[13px] leading-snug">
        Any change to the Public or Private view must be resubmitted before buyers see it; the approved version stays live in the meantime.
      </PopoverContent>
    </Popover>
  );
}
