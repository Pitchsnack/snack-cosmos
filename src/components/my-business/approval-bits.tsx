import { useTranslation } from "@/i18n/language";
import { approvalDate } from "@/lib/approval-date";
import { useOpenSellerEdit } from "@/components/my-business/seller-edit-popup";
import { composeFounderBio } from "@/lib/founder-story";
import { handoverLine } from "@/lib/hidden-profile";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resumeListing, submitListing, unpublishListing } from "@/lib/approvals.functions";
import { getStartup } from "@/lib/startups.functions";
import { runIdentityCheck, type EntryFacts, type HiddenDraft, type HiddenProfileRow } from "@/lib/hidden-profile";
import { ReviewCompanyDialog, type ReviewCompanyData } from "@/components/approval/review-company-dialog";
import { SentForApprovalDialog } from "@/components/approval/sent-for-approval";
import { WithdrawDialog } from "@/components/approval/withdraw-dialog";
import { cn } from "@/lib/utils";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Per-listing footer: state note on the left, the one-step action on the right. */
export function ApprovalFooter({ profile }: { profile: HiddenProfileRow }) {
  const { t, language } = useTranslation();
  const openEdit = useOpenSellerEdit();
  const qc = useQueryClient();
  const submit = useServerFn(submitListing);
  const unpublish = useServerFn(unpublishListing);
  const resume = useServerFn(resumeListing);
  const loadStartup = useServerFn(getStartup);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const done = () => { void qc.invalidateQueries({ queryKey: ["my-startups"] }); void qc.invalidateQueries({ queryKey: ["my-hidden-profiles"] }); void qc.invalidateQueries({ queryKey: ["approval-notice"] }); };
  const doSubmit = useMutation({
    mutationFn: () => submit({ data: { listingId: profile.id } }),
    onSuccess: () => { setReviewOpen(false); setFailures([]); setSentOpen(true); done(); },
    onError: (e: Error) => setFailures([e.message]),
  });
  const doUnpublish = useMutation({
    mutationFn: () => unpublish({ data: { startupId: profile.startup_id } }),
    onSuccess: () => { toast.success(t("Removed. Your listing is hidden from buyers.")); done(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doResume = useMutation({
    mutationFn: () => resume({ data: { listingId: profile.id } }),
    onSuccess: () => { toast.success(t("Live again in Browse listings.")); done(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const st = useQuery({
    queryKey: ["review-startup", profile.startup_id],
    queryFn: () => loadStartup({ data: { id: profile.startup_id } }),
    enabled: reviewOpen && !!profile.startup_id,
  });

  const a = profile.approval_status ?? "draft";
  const pub = profile as HiddenDraft;
  const s = st.data as any;
  const facts: EntryFacts = {
    startup_name: s?.startup_name ?? "",
    registered_name: s?.registered_name ?? null,
    website_url: s?.website_url ?? null,
    city: s?.city ?? null,
  };
  const findings = runIdentityCheck({
    ...pub,
    code_name: (profile as any).suggested_listing_name ?? pub.code_name,
    headline: (profile as any).suggested_headline ?? pub.headline,
  }, facts);
  const identityWords = [...new Set(findings.map((f) => f.term))];
  const asking = profile.asking_price_thb ?? profile.asking_price;
  const reviewData: ReviewCompanyData = {
    suggestedName: (profile as any).suggested_listing_name ?? null,
    suggestedHeadline: (profile as any).suggested_headline ?? null,
    listingRows: [
      ["Reference", [profile.ref_no, s?.sector, s?.city].filter(Boolean).join(" · ")],
      ["Description", pub.description ?? ""],
      ["Highlights", (pub.highlights ?? []).filter(Boolean).join(" · ")],
      ["Customer profile", pub.customers_summary ?? ""],
      [`Revenue FY${String(new Date().getFullYear() - 1).slice(2)}`, s?.last_year_revenue ?? ""],
      ["Asking price", asking != null ? `฿${Number(asking).toLocaleString()}` : ""],
      ["Deal type", pub.deal_type ?? ""],
      ["Owner handover", handoverLine(pub.owner_stays, pub.handover_months) ?? ""],
      ["Sector", s?.sector ?? ""],
    ], identityWords, identityApplies: true,
    exclusiveRows: [
      { label: "Company name", value: s?.startup_name ?? "", note: "PitchSnack checks your registration." },
      { label: "Registration number", value: s?.registered_number ?? "", note: null },
      { label: "Address", value: s?.business_address ?? "", note: "PitchSnack checks your registered address." },
      { label: "Year founded", value: s?.year_founded ? String(s.year_founded) : "", note: null },
      { label: `Revenue in ${new Date().getFullYear()-1}`, value: s?.last_year_revenue ?? "", note: "Checked against the accounts your company filed." },
      { label: "Owner", value: [s?.founders?.[0]?.full_name, s?.founders?.[0]?.position].filter(Boolean).join(" · "), note: "Checked against your company's list of directors." },
      { label: "About the owner", value: s?.founders?.[0]?.bio_story?.mode === "lines" ? composeFounderBio(s.founders[0].bio_story, language) : s?.founders?.[0]?.bio ?? "", note: "PitchSnack checks the year founded and the sales against your company's records." },
      { label: "Website", value: s?.website_url ?? "", note: "PitchSnack checks that the link opens." },
      { label: "Email address", value: s?.email ?? "", note: "PitchSnack checks for corporate email." },
      { label: "Contact number", value: s?.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
    ],
  };

  const state = profile.status === "live" && a === "live" ? "live" : a === "unpublished" ? "paused" : a === "in_review" ? "pending" : a === "changes_requested" ? "changes" : a === "rejected" ? "declined" : "draft";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EBEF] bg-[#FAFAFB] px-5 py-3.5 text-[13px] text-[#6A7181]">
      {state === "live"
        ? <span>{t("Live in Browse listings since {date}").replace("{date}", approvalDate(profile.published_at, language))}</span>
        : state === "pending"
          ? <span>{t("Submitted on {date}").replace("{date}", approvalDate(profile.submitted_at, language))} · {t("buyers can't find your listing yet")}</span>
          : state === "changes" || state === "declined"
            ? <span>{t("Fix what PitchSnack asked with Edit information, then register again.")}</span>
            : state === "paused"
              ? <span>{t("Hidden from Browse listings since {date}.").replace("{date}", approvalDate((profile as any).unpublished_at ?? profile.updated_at, language))}</span>
              : <span><b className="font-semibold text-foreground">Draft</b> · not live yet. Register once: PitchSnack checks your company and publishes your listing together.</span>}
      <span className="flex flex-col items-end gap-1">
        {state === "live"
          ? <>
              <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>{t("Remove your company profile from listing (seller)")}</Button>
              <span className="text-[12.5px] text-[#6B7280]">{t("Your profile becomes private, and new buyers can't contact you.")}</span>
            </>
          : state === "pending"
            ? <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 text-[13.5px] font-semibold text-[#1D4ED8]"><Clock className="h-4 w-4" />{t("Pending approval")}</span>
            : state === "paused"
              ? <Button size="sm" className="whitespace-normal bg-[#1E2A4A] text-center text-white hover:bg-[#101d43]" disabled={doResume.isPending} onClick={() => doResume.mutate()}>{t("List my company so that buyers can contact me")}</Button>
              : <Button size="sm" className="bg-[#1E2A4A] text-white hover:bg-[#101d43]" onClick={() => { setFailures([]); setReviewOpen(true); }}><Send className="mr-1.5 h-4 w-4" />{t("Register your company")}</Button>}
      </span>
      <ReviewCompanyDialog open={reviewOpen} role="seller" data={reviewData} failures={failures} submitting={doSubmit.isPending}
        onEdit={(section) => { setReviewOpen(false); openEdit(profile.startup_id, section === "company" ? "private" : "public", section === "company" ? "about" : "description"); }} onSubmit={() => doSubmit.mutate()} onClose={() => setReviewOpen(false)} />
      <SentForApprovalDialog open={sentOpen} role="seller" onClose={() => setSentOpen(false)} />
      <WithdrawDialog open={withdrawOpen} role="seller" busy={doUnpublish.isPending} onClose={() => setWithdrawOpen(false)}
        onConfirm={() => doUnpublish.mutate(undefined, { onSuccess: () => setWithdrawOpen(false) })} />
    </div>
  );
}

// ---- status pill helpers (used by the My Company cards) ----

export function approvalOf(row: HiddenProfileRow | null | undefined): string {
  if (!row) return "missing";
  if (row.status === "live" && row.has_unpublished_changes) return "live_edits_pending";
  return row.approval_status ?? "draft";
}

export const APPROVAL_LABEL: Record<string, string> = {
  draft: "Draft", in_review: "Pending approval", changes_requested: "Changes requested",
  rejected: "Not approved", live: "Live", unpublished: "Paused", live_edits_pending: "Live · edits pending", missing: "Preview",
};

export const APPROVAL_TONE: Record<string, string> = {
  draft: "text-muted-foreground", in_review: "text-[#1D4ED8]", changes_requested: "text-amber-700 dark:text-amber-400",
  rejected: "text-red-700 dark:text-red-400", live: "text-emerald-700 dark:text-emerald-400", unpublished: "text-muted-foreground",
  live_edits_pending: "text-amber-700 dark:text-amber-400", missing: "text-muted-foreground",
};

export function ApprovedChip({ row }: { row: HiddenProfileRow | null | undefined }) {
  const ap = approvalOf(row);
  return <span className={cn("text-[11px] font-semibold", APPROVAL_TONE[ap])}>{useTranslation().t(APPROVAL_LABEL[ap])}</span>;
}
