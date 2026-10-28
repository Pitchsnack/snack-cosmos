import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resumeListing, submitListing, unpublishListing } from "@/lib/approvals.functions";
import { getMyStartup } from "@/lib/startups.functions";
import { findIdentityWords, type HiddenDraft, type LivePayload } from "@/lib/hidden-profile";
import { ReviewCompanyDialog, type ReviewCompanyData } from "@/components/approval/review-company-dialog";
import { SentForApprovalDialog } from "@/components/approval/sent-for-approval";
import { WithdrawDialog } from "@/components/approval/withdraw-dialog";
import type { HiddenProfile } from "@/hooks/use-my-hidden-profile";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Per-listing footer: state note on the left, the one-step action on the right. */
export function ApprovalFooter({ profile }: { profile: HiddenProfile }) {
  const qc = useQueryClient();
  const submit = useServerFn(submitListing);
  const unpublish = useServerFn(unpublishListing);
  const resume = useServerFn(resumeListing);
  const getStartup = useServerFn(getMyStartup);
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
    onSuccess: () => { toast.success("Removed. Your listing is hidden from buyers."); done(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doResume = useMutation({
    mutationFn: () => resume({ data: { listingId: profile.id } }),
    onSuccess: () => { toast.success("Live again in Browse listings."); done(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const st = useQuery({
    queryKey: ["review-startup", profile.startup_id],
    queryFn: () => getStartup({ data: { id: profile.startup_id } }),
    enabled: reviewOpen && !!profile.startup_id,
  });

  const a = profile.approval_status ?? "draft";
  const live = (profile.live ?? null) as LivePayload | null;
  const pub = ((live?.public ?? {}) ?? {}) as HiddenDraft;
  const s = st.data as any;
  const company = s?.startup_name ?? "";
  const identityWords = findIdentityWords({
    name: (profile as any).suggested_listing_name ?? "",
    headline: (profile as any).suggested_headline ?? "",
    description: pub.description ?? "",
    highlights: pub.highlights ?? "",
    customerProfile: pub.customerProfile ?? "",
  }, company);
  const reviewData: ReviewCompanyData = {
    suggestedName: (profile as any).suggested_listing_name ?? null,
    suggestedHeadline: (profile as any).suggested_headline ?? null,
    listingRows: [
      ["Sector", pub.sector ?? ""],
      ["Revenue range", pub.revenueRange ?? ""],
      ["Profit range", pub.profitRange ?? ""],
      ["Asking price", pub.askingPrice ?? ""],
      ["Location", pub.location ?? ""],
      ["Headline", (profile as any).suggested_headline ?? ""],
      ["Description", (pub.description ?? "").slice(0, 400)],
    ],
    identityWords,
    identityApplies: true,
    exclusiveRows: [
      { label: "Company name", value: company, note: null },
      { label: "Registration Number", value: s?.registered_number ?? "", note: null },
      { label: "Registered address", value: [s?.address_city_district, s?.address_province_state].filter(Boolean).join(", "), note: null },
      { label: "Year founded", value: s?.year_founded != null ? String(s.year_founded) : "", note: null },
      { label: "Website", value: s?.website_url ?? "", note: "Not shown publicly" },
      { label: "Contact number", value: s?.contact_number ?? "", note: "Not shown publicly" },
      { label: "Registration check", value: s?.registration_verified_at ? "Verified with the Department of Business Development" : "", note: s?.registration_verified_at ? null : "PitchSnack checks this with the Department of Business Development" },
    ],
  };

  const state = profile.status === "live" && a === "live" ? "live" : a === "unpublished" ? "paused" : a === "in_review" ? "pending" : a === "changes_requested" ? "changes" : a === "rejected" ? "declined" : "draft";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EBEF] bg-[#FAFAFB] px-5 py-3.5 text-[13px] text-[#6A7181]">
      {state === "live"
        ? <span>Live in Browse listings since {fmt(profile.published_at)}</span>
        : state === "pending"
          ? <span>Submitted on {fmt(profile.submitted_at)} · buyers can't find your listing yet</span>
          : state === "changes" || state === "declined"
            ? <span>Fix what PitchSnack asked with Edit information, then register again.</span>
            : state === "paused"
              ? <span>Hidden from Browse listings since {fmt((profile as any).unpublished_at ?? profile.updated_at)}.</span>
              : <span><b className="font-semibold text-foreground">Draft</b> · not live yet. Register once: PitchSnack checks your company and publishes your listing together.</span>}
      <span className="flex flex-col items-end gap-1">
        {state === "live"
          ? <>
              <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>Remove your company profile from listing</Button>
              <span className="text-[12.5px] text-[#6B7280]">Your profile becomes private, and new buyers can't contact you.</span>
            </>
          : state === "pending"
            ? <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 text-[13.5px] font-semibold text-[#1D4ED8]"><Clock className="h-4 w-4" />Pending approval</span>
            : state === "paused"
              ? <Button size="sm" className="whitespace-normal bg-[#1E2A4A] text-center text-white hover:bg-[#101d43]" disabled={doResume.isPending} onClick={() => doResume.mutate()}>List my company so that buyers can contact me</Button>
              : <Button size="sm" className="bg-[#1E2A4A] text-white hover:bg-[#101d43]" onClick={() => { setFailures([]); setReviewOpen(true); }}><Send className="mr-1.5 h-4 w-4" />Register your company</Button>}
      </span>
      <ReviewCompanyDialog open={reviewOpen} role="seller" data={reviewData} failures={failures} submitting={doSubmit.isPending}
        onEdit={() => setReviewOpen(false)} onSubmit={() => doSubmit.mutate()} onClose={() => setReviewOpen(false)} />
      <SentForApprovalDialog open={sentOpen} role="seller" onClose={() => setSentOpen(false)} />
      <WithdrawDialog open={withdrawOpen} role="seller" busy={doUnpublish.isPending} onClose={() => setWithdrawOpen(false)}
        onConfirm={() => doUnpublish.mutate(undefined, { onSuccess: () => setWithdrawOpen(false) })} />
    </div>
  );
}
