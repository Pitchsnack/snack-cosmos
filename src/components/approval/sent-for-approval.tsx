import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { approvalDate } from "@/lib/approval-date";
import { useTranslation } from "@/i18n/language";
import type { ApprovalRole } from "@/lib/approval-notices.functions";

/** Sent for approval: the three-step tracker shown right after Register your company. */
export function SentForApprovalDialog({ open, role, onClose }: { open: boolean; role: ApprovalRole; onClose: () => void }) {
  const { t, language } = useTranslation();
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) setTimeout(() => doneRef.current?.focus(), 50); }, [open]);
  const line = role === "seller"
    ? t("Your listing and your company details are with PitchSnack.")
    : t("Your profile and your firm details are with PitchSnack.");
  const until = role === "seller"
    ? t("PitchSnack checks your company and your listing, usually within 1 business day.")
    : role === "advisor"
      ? t("PitchSnack checks your firm and your profile, usually within 1 business day.")
      : t("PitchSnack checks your firm and your public profile, usually within 1 business day.");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[520px] p-0" aria-label={t("Sent for approval")}>
        <div className="ap-sent-top">
          <div className="ap-sent-ic"><Check className="h-7 w-7" strokeWidth={2.6} /></div>
          <h2>{t("Sent for approval")}</h2>
          <p>{line}<br />{t("Sent on")} {approvalDate(new Date().toISOString(), language)}.</p>
          <ol className="ap-stp">
            <li className="ap-done">
              <span className="ap-cw"><span className="ap-c"><Check className="h-4 w-4" strokeWidth={2.6} /></span></span>
              <span className="ap-lb"><span>{t("Step 1:")}</span>{t("Submitted")}</span>
            </li>
            <li className="ap-now" aria-current="step">
              <span className="ap-cw"><span className="ap-c">2</span></span>
              <span className="ap-lb"><span>{t("Step 2:")}</span>{t("PitchSnack checks")}</span>
            </li>
            <li>
              <span className="ap-cw"><span className="ap-c">3</span></span>
              <span className="ap-lb"><span>{t("Step 3:")}</span>{t("Live")}</span>
            </li>
          </ol>
          <p className="ap-sent-until">{until}</p>
        </div>
        <div className="flex justify-center px-8 pb-7 pt-2">
          <button ref={doneRef} type="button" className="ap-btn ap-navy" onClick={onClose}>{t("Done")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
