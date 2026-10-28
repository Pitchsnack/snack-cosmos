import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { approvalDate } from "@/lib/approval-date";
import { useTranslation } from "@/i18n/language";
import { useApprovalNotice } from "./approval-banners";
import { setApprovalNoticeState } from "@/lib/approval-notices.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { APPROVAL_NOTICE_KEY } from "./approval-banners";

/**
 * The approved pop-up: shown once per user, the first time they open PitchSnack
 * after Verify and publish. Start browsing (or ×/Escape) marks it seen; the
 * green banner stays at step 1.
 */
export function ApprovedPopup() {
  const { notice, isAdmin } = useApprovalNotice();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const fn = useServerFn(setApprovalNoticeState);
  const qc = useQueryClient();
  const startRef = useRef<HTMLButtonElement>(null);
  const open = !!notice && !isAdmin && notice.state === "live" && !notice.popupSeenAt;
  useEffect(() => { if (open) setTimeout(() => startRef.current?.focus(), 60); }, [open]);
  if (!open || !notice) return null;
  const seen = () => {
    void fn({ data: { itemType: notice.itemType, itemId: notice.itemId, patch: { popupSeen: true } } })
      .then(() => void qc.invalidateQueries({ queryKey: APPROVAL_NOTICE_KEY }));
  };
  const start = () => { seen(); navigate({ to: "/marketplace/browse" }); };
  const title = notice.role === "seller" ? t("Your listing is approved") : t("Your profile is approved");
  const body = notice.role === "seller"
    ? t("Admin verified your company and published your listing. Buyers can now find it in Browse listings, and you can connect with buyers.")
    : notice.role === "advisor"
      ? t("Admin verified your firm and published your profile. Sellers and buyers can now find you in Browse advisors.")
      : t("Admin verified your account and published your investor profile. Sellers can now find your firm in Browse investors, and you can request NDAs.");
  const rows: [string, string][] = [
    [t("Listing name"), notice.publishedName ?? "—"],
    [t("Headline"), notice.publishedHeadline ?? "—"],
    [t("Verified"), approvalDate(notice.decidedAt, language)],
  ];
  return (
    <Dialog open onOpenChange={(v) => !v && seen()}>
      <DialogContent className="max-w-[520px] p-0" aria-label={title}>
        <div className="ap-sent-top" style={{ textAlign: "left", padding: "26px 30px 10px" }}>
          <div className="ap-sent-ic" style={{ margin: "0 0 14px" }}><Check className="h-7 w-7" strokeWidth={2.6} /></div>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <div className="px-[30px]">
          <div className="ap-rows">
            {rows.map(([l, v]) => (
              <div className="ap-rw" key={l}><span>{l}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
        <div className="flex justify-end px-[30px] pb-6 pt-4">
          <button ref={startRef} type="button" className="ap-btn ap-navy" onClick={start}>{t("Start browsing")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
