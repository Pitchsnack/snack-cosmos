import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/language";
import type { ApprovalRole } from "@/lib/approval-notices.functions";

/** Withdraw from the Marketplace? — the live state's remove pop-up. */
export function WithdrawDialog({ open, role, busy, onClose, onConfirm }: {
  open: boolean; role: ApprovalRole; busy?: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) setTimeout(() => stayRef.current?.focus(), 50); }, [open]);
  const line = role === "seller"
    ? t("Your profile becomes private, and new buyers can't contact you.")
    : role === "advisor"
      ? t("Your profile becomes private, and new sellers and buyers can't contact you.")
      : t("Your profile becomes private, and new sellers can't contact you.");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[440px] p-6" aria-label={t("Withdraw from the Marketplace?")}>
        <DialogTitle className="text-[18px] font-bold">{t("Withdraw from the Marketplace?")}</DialogTitle>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{line}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{t("You can change your mind and list your company again at any time.")}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button ref={stayRef} type="button" className="ap-btn ap-line" onClick={onClose}>{t("Stay listed")}</button>
          <button type="button" className="ap-btn ap-navy" disabled={busy} onClick={onConfirm}>{t("Withdraw")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
