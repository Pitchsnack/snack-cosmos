import { useEffect, useState } from "react";
import { Check, Lock, Pencil, Send, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/language";
import type { ApprovalRole } from "@/lib/approval-notices.functions";

/** The data the parent assembles for "Review your company data". */
export type ReviewCompanyData = {
  suggestedName: string | null;
  suggestedHeadline: string | null;
  /** Listing view rows (label, value). */
  listingRows: [string, string][];
  /** Identity check findings; empty = clean. */
  identityWords: string[];
  identityApplies: boolean;
  /** Exclusive view rows with an optional grey note under the value. */
  exclusiveRows: { label: string; value: string; note: string | null }[];
};

/**
 * Register your company's review pop-up: three numbered sections, a tick box,
 * Back to edit and Register your company.
 */
export function ReviewCompanyDialog({ open, role, data, failures, submitting, onEdit, onSubmit, onClose }: {
  open: boolean;
  role: ApprovalRole;
  data: ReviewCompanyData | null;
  /** Red "Before you register: …" failures from the last submit attempt. */
  failures: string[];
  submitting?: boolean;
  onEdit: (section?: "description" | "company") => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const label = (value: string) => {
    const revenue = value.match(/^Revenue in (\d{4})$/);
    if (revenue) return t("Revenue in {year}").replace("{year}", String(Number(revenue[1]) + (language === "th" ? 543 : 0)));
    return t(value);
  };
  const [tick, setTick] = useState(false);
  useEffect(() => { if (open) setTick(false); }, [open]);

  const seeLabel = role === "seller" ? t("what buyers will see") : role === "advisor" ? t("what sellers and buyers will see") : t("what sellers will see");
  const decl = role === "seller"
    ? t("The information is accurate and I'm authorised to list this business.")
    : t("The information is accurate and I'm authorised to act for this firm.");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-64px)] max-w-[880px] flex-col overflow-hidden p-0" aria-label={t("Review your company data")}>
        <div className="ap-dh">
          <DialogTitle asChild><h2>{t("Review your company data")}</h2></DialogTitle>
          <button type="button" className="ap-x" onClick={onClose} aria-label={t("Close")}><X className="h-4 w-4" /></button>
        </div>
        <div className="ap-db overflow-y-auto">
          {/* 1 · Listing name and headline */}
          <section>
            <div className="ap-dbh">
              <span className="ap-stepn" aria-hidden>1</span>
              <span className="ap-cap">{t("Listing name and headline")} · {t("your suggestion")}</span>
              <button type="button" onClick={() => onEdit("description")}>{t("Edit")}</button>
            </div>
            <div className="ap-rows">
              <div className="ap-rw"><span>{t("Listing name")}</span><span>{data?.suggestedName?.trim() || t("Not added")}</span></div>
              <div className="ap-rw"><span>{t("Headline")}</span><span>{data?.suggestedHeadline?.trim() || t("Not added")}</span></div>
              <div className="ap-rw">
                <span aria-hidden />
                <span className="ap-sm" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <Pencil className="mt-0.5 h-3 w-3 shrink-0" />
                  {t("We adjusted your listing name and headline to reduce duplication and make your listing easier to distinguish.")}
                </span>
              </div>
            </div>
          </section>

          {/* 2 · Listing view */}
          <section>
            <div className="ap-dbh">
              <span className="ap-stepn" aria-hidden>2</span>
              <span className="ap-cap">{t("Listing view")} · {seeLabel}</span>
              <button type="button" onClick={() => onEdit("description")}>{t("Edit")}</button>
            </div>
            <div className="ap-rows">
              {(data?.listingRows ?? []).map(([l, v]) => (
                <div className="ap-rw" key={l}><span>{t(l)}</span><span>{v ? t(v) : t("Not added")}</span></div>
              ))}
              {data?.identityApplies && (
                <div className="ap-rw">
                  <span>{t("Identity check")}</span>
                  <span>
                    {data.identityWords.length ? (
                      <span className="ap-warnline"><TriangleAlert className="h-3.5 w-3.5" />{t("Mentions")} {data.identityWords.join(", ")}. {t("Leave out names, websites and contact details.")}</span>
                    ) : (
                      <span className="ap-ok"><Check className="h-3.5 w-3.5" />{t("Clean")} · {role === "seller" ? t("no name, website or contact in the listing name, headline, description, highlights or customer profile") : t("no name, website or contact in the listing name, headline or description")}</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 3 · Exclusive view */}
          <section>
            <div className="ap-dbh">
              <span className="ap-stepn" aria-hidden>3</span>
              <span className="ap-cap" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {role === "advisor" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {role === "advisor" ? t("What PitchSnack checks") : <>{t("Exclusive view")} · {t("what PitchSnack checks")}</>}
              </span>
              <button type="button" onClick={() => onEdit("company")}>{t("Edit")}</button>
            </div>
            <div className="ap-rows">
              {(data?.exclusiveRows ?? []).map((r) => (
                <div className="ap-rw" key={r.label}>
                  <span>{label(r.label)}</span>
                  <span>
                    {r.label === "Year founded" && language === "th" && /^\d{4}$/.test(r.value) ? String(Number(r.value)+543) : r.value?.trim() ? t(r.value) : t("Not added")}
                    {r.note && <span className="ap-sm">{t(r.note)}</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="ap-df">
          {!!failures.length && <p className="ap-fail">{t("Before you register:")} {failures.join(" · ")}.</p>}
          <label className="ap-dec">
            <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} />
            <span>{decl}</span>
          </label>
          <div className="ap-btnrow">
            <button type="button" className="ap-btn ap-line" onClick={() => onEdit("description")}><Pencil className="h-4 w-4" />{t("Back to edit")}</button>
            <button type="button" className="ap-btn ap-navy" disabled={!tick || submitting} onClick={onSubmit}>
              <Send className="h-4 w-4" />{t("Register your company")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
