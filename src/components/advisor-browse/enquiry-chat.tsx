import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, FileText, Hourglass, Lock } from "lucide-react";
import { tr } from "@/i18n/language";
import { cn } from "@/lib/utils";
import { fmtLong, type Me } from "@/lib/advisor-enquiry";
import type { EnquiryThread } from "@/lib/messages.functions";
import { ServiceChip } from "@/components/advisor/advisor-firm-card";
import { AcceptProposalDialog, DeclineEnquiryDialog, DeclineProposalDialog, ProposalRows, SendProposalDialog, tf } from "./enquiry-dialogs";

/** "{status}" words in the Messages list and header, for each side. */
export function enqStatusLabel(status: string, isFirm: boolean, isNew = false) {
  if (isFirm) return ({ enquiry: isNew ? "New enquiry" : "Enquiry", talking: "Talking", proposal: "Proposal sent", engaged: "Your client", done: "Work done", declined: "Enquiry declined", closed: "Closed" } as Record<string, string>)[status] ?? status;
  return tr(({ enquiry: "Enquiry sent", talking: "Talking", proposal: "Proposal to review", engaged: "Your advisor", done: "Work done", declined: "Declined", closed: "Closed" } as Record<string, string>)[status] ?? status);
}

const frame = "w-full max-w-[440px] overflow-hidden rounded-[14px] border border-[#DCE3F0] bg-card dark:border-border";
const head = "flex items-center justify-between gap-2 border-b border-[#EEF0F3] bg-[#FAFBFC] px-3.5 py-2.5 dark:border-border dark:bg-muted/40";
const cap = "text-[10.5px] font-bold uppercase tracking-[.07em] text-[#0F766E]";

export function EnquiryCardView({ t, card, seen }: { t: EnquiryThread; card: EnquiryThread["enquiries"][number]; seen: boolean }) {
  return (
    <div className={cn("my-2 flex flex-col gap-1", t.isFirm ? "items-start" : "items-end")}>
      <div className={frame}>
        <div className={head}><span className={cap}>{t.isFirm ? "Enquiry" : tr("Enquiry")}</span><ServiceChip name={card.service} /></div>
        <div className="space-y-2 px-3.5 py-3 text-[13.5px]">
          <p className="whitespace-pre-line">{card.text}</p>
          <p className="text-[12.5px] text-muted-foreground">{t.isFirm ? "When:" : tr("When:")} {card.timing ? tr(card.timing) : tr("Not said")}</p>
          {card.client ? (
            <div className="rounded-[11px] border border-[#DCE3F0] dark:border-border">
              {[["From", [card.client.name, card.client.title].filter(Boolean).join(", ")], ["Company", card.client.company], ["Email", card.client.email ?? "—"], ["Phone", card.client.phone ?? "—"], ["On PitchSnack", card.client.side === "seller" ? "Seller" : "Buyer"]].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[104px_1fr] gap-2 border-b border-[#F0F1F4] px-3 py-1.5 text-[13px] last:border-0 dark:border-border"><span className="text-[#6B7280]">{k}</span><span className="min-w-0 break-words">{v}</span></div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Lock className="h-3 w-3" />{tf("Shared with {firm}: your name, company, email and phone.", { firm: t.firm.name })}</p>
          )}
        </div>
      </div>
      {!t.isFirm && <div className="text-[11px] text-[#9CA3AF]">{seen ? tr("Seen") : tr("Sent")}</div>}
    </div>
  );
}

export function ProposalCardView({ t, p, me }: { t: EnquiryThread; p: EnquiryThread["proposals"][number]; me: Me | null }) {
  const [dlg, setDlg] = useState<null | "accept" | "decline">(null);
  const foot = p.status === "open" ? null
    : p.status === "accepted" ? <span className="font-semibold text-[#15803D]">✓ {tf("Accepted on {date}", { date: fmtLong(p.answeredAt) })}</span>
    : p.status === "declined" ? tf("Declined on {date}", { date: fmtLong(p.answeredAt) })
    : p.status === "expired" ? tf("Expired on {date}", { date: fmtLong(p.validUntil) })
    : tr("Replaced by a newer proposal");
  return (
    <div className={cn("my-2 flex", t.isFirm ? "justify-end" : "justify-start")}>
      <div className={frame}>
        <div className={head}><span className={cap}>{tr("Proposal")}</span><ServiceChip name={p.service} /></div>
        <div className="p-3"><ProposalRows p={p} /></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF0F3] px-3.5 py-2.5 text-[12.5px] text-muted-foreground dark:border-border">
          {foot ?? <span>{tf("Valid until {date}", { date: fmtLong(p.validUntil) })}</span>}
          {!foot && !t.isFirm && me && (
            <span className="flex gap-2">
              <button type="button" onClick={() => setDlg("decline")} className="h-[30px] rounded-[8px] border border-[#F3C5C0] px-2.5 text-[12.5px] font-semibold text-[#B42318] hover:bg-[#FEF2F2] dark:border-red-900 dark:hover:bg-red-950/40">{tr("Decline")}</button>
              <button type="button" onClick={() => setDlg("accept")} className="h-[30px] rounded-[8px] bg-[#1E2A4A] px-2.5 text-[12.5px] font-semibold text-white dark:bg-primary dark:text-primary-foreground">{tr("Accept proposal")}</button>
            </span>
          )}
        </div>
      </div>
      {dlg === "accept" && me && <AcceptProposalDialog firm={t.firm.name} p={p} me={me} onClose={() => setDlg(null)} />}
      {dlg === "decline" && <DeclineProposalDialog firm={t.firm.name} p={p} onClose={() => setDlg(null)} />}
    </div>
  );
}

/** Right side of the chat header. */
export function EnquiryHeaderActions({ t }: { t: EnquiryThread }) {
  const [dlg, setDlg] = useState<null | "propose" | "decline">(null);
  if (!t.isFirm) {
    return (
      <Link to="/marketplace/advisors" search={{ firm: t.firm.id } as any}
        className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] font-medium hover:bg-muted">
        <Building2 className="h-[15px] w-[15px]" /><span className="max-[759px]:hidden">{tr("Advisor profile")}</span>
      </Link>
    );
  }
  const greenChip = "inline-flex h-[30px] items-center rounded-full border border-[#BBE8CA] bg-[#E9F6EE] px-2.5 text-[12.5px] font-semibold text-[#15803D] dark:border-green-900 dark:bg-green-950/50 dark:text-green-300";
  return (
    <>
      {(t.status === "enquiry" || t.status === "talking") && t.enquiryId && (
        <span className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setDlg("decline")} className="h-[30px] rounded-[8px] border border-border px-2.5 text-[12.5px] font-semibold hover:bg-muted">Decline enquiry</button>
          <button type="button" onClick={() => setDlg("propose")} className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] bg-[#1E2A4A] px-2.5 text-[12.5px] font-semibold text-white dark:bg-primary dark:text-primary-foreground"><FileText className="h-3.5 w-3.5" />Send proposal</button>
        </span>
      )}
      {t.status === "proposal" && <span className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[12.5px] font-semibold text-[#1D4ED8] dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"><Hourglass className="h-3.5 w-3.5" />Waiting for {t.client.first} to accept</span>}
      {t.status === "engaged" && <span className={greenChip}>Your client</span>}
      {t.status === "done" && <span className={greenChip}>Work done{t.stars ? ` · ${t.stars} ★` : ""}</span>}
      {dlg === "propose" && t.enquiryId && <SendProposalDialog enquiryId={t.enquiryId} client={t.client.company} clientName={t.client.name} clientFirst={t.client.first} service={t.service} services={t.firmServices} fees={t.firmFees} onClose={() => setDlg(null)} />}
      {dlg === "decline" && t.enquiryId && <DeclineEnquiryDialog enquiryId={t.enquiryId} client={t.client.company} clientName={t.client.name} clientFirst={t.client.first} onClose={() => setDlg(null)} />}
    </>
  );
}
