import { useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { withdrawDeal, sendWithdrawalFeedback, type PipelineRow, type Withdrawal } from "@/lib/pipeline.functions";
import { HatMark } from "@/components/messages/hat-mark";
import logo from "@/assets/pitchsnack-logo.png.asset.json";

type T = (s: string) => string;

export const SELLER_REASONS: [string, string][] = [
  ["offer_too_low", "The offer is too low"], ["terms", "The terms don't work for us"], ["other_buyer", "We chose another buyer"],
  ["not_selling", "We're not selling for now"], ["other", "Other reason"],
];
export const BUYER_REASONS: [string, string][] = [
  ["price_too_high", "The price is too high"], ["report_concerns", "The reports raised concerns"], ["other_business", "We chose another business"],
  ["plans_changed", "Our plans or budget changed"], ["timing", "The timing doesn't work"], ["other", "Other reason"],
];
const SELLER_FB: [string, string][] = [
  ["concerns_buyer", "Concerns about the buyer"], ["buyer_slow", "The buyer was slow to respond"], ["offer_not_serious", "The offer didn't feel serious"],
  ["buyer_funding", "Doubts about the buyer's funding"], ["hard_to_use", "PitchSnack was hard to use"], ["too_long", "The process took too long"], ["something_else", "Something else"],
];
const BUYER_FB: [string, string][] = [
  ["concerns_seller", "Concerns about the seller"], ["seller_slow", "The seller was slow to respond"], ["figures_mismatch", "The figures didn't match the listing"],
  ["price_unrealistic", "The asking price wasn't realistic"], ["hard_to_use", "PitchSnack was hard to use"], ["too_long", "The process took too long"], ["something_else", "Something else"],
];
export const reasonLabel = (code: string | null) => [...SELLER_REASONS, ...BUYER_REASONS].find(([c]) => c === code)?.[1] ?? code ?? "";

const fmt = (s: string | null, year = false) => s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).replace("Sept", "Sep") : "—";
const fill = (s: string, vars: Record<string, string>) => s.replace(/\{([^}]+)\}/g, (m, k) => vars[k] ?? m);

const CAP = "text-[10.5px] font-bold uppercase tracking-[.04em] text-[#9CA3AF]";
const BOX = "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-48px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[16px] bg-white text-[#111827] shadow-[0_30px_70px_rgba(16,24,40,.28)] focus:outline-none dark:bg-card dark:text-foreground";
const BTN = "h-9 rounded-[9px] px-4 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]";

export function WithdrawnPill({ t = (s) => s }: { t?: T }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full bg-[#F3F4F6] px-[9px] text-[11.5px] font-semibold text-[#4B5563] dark:bg-white/10 dark:text-[#D1D5DB]">
      <LogOut className="h-3 w-3" />{t("Withdrawn")}
    </span>
  );
}

/** The red link (or the grey Payment link) in a Tracking card's footer. */
export function WithdrawLink({ p, seller, t, onDone }: { p: PipelineRow; seller: boolean; t: T; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (p.status === "ended" || !p.ndaApprovedAt) return <span />;
  if (p.spaAt) {
    return <a href="/marketplace/messages" className="text-[12.5px] font-semibold text-[#6B7280] hover:underline">{t("Contact PitchSnack to stop this deal")}</a>;
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded text-[12.5px] font-semibold text-[#B91C1C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C] dark:text-[#F87171]">
        <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />{t("Withdraw from deal")}
      </button>
      {open && <WithdrawFlow p={p} seller={seller} t={t} onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  );
}

function WithdrawFlow({ p, seller, t, onClose, onDone }: { p: PipelineRow; seller: boolean; t: T; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const other = p.counterparty.name;
  const close = () => { if (step > 1) onDone(); onClose(); };
  return (
    <D.Root open onOpenChange={(o) => !o && close()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgba(17,24,39,.45)]" />
        {step === 1 && <Step1 p={p} seller={seller} other={other} t={t} onCancel={onClose} onDone={() => { setStep(2); onDone(); }} />}
        {step === 2 && <Step2 p={p} seller={seller} other={other} t={t} onSkip={close} onSent={() => setStep(3)} />}
        {step === 3 && <Thanks t={t} onDone={close} />}
      </D.Portal>
    </D.Root>
  );
}

function CloseX({ dark }: { dark?: boolean }) {
  return (
    <D.Close aria-label="Close" className={cn("absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-[8px]", dark ? "text-[#C5CAD6] hover:bg-white/10" : "text-[#6B7280] hover:bg-[#F3F4F6] dark:hover:bg-white/10")}>
      <X className="h-4 w-4" />
    </D.Close>
  );
}

function Step1({ p, seller, other, t, onCancel, onDone }: { p: PipelineRow; seller: boolean; other: string; t: T; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(withdrawDeal);
  const reasons = seller ? SELLER_REASONS : BUYER_REASONS;
  const needComment = reason === "other" && !comment.trim();
  const ready = !!reason && !needComment;
  const v = { "other side": other, "NDA expiry": fmt(p.ndaExpiresAt, true) };
  const happens = seller
    ? ["The deal moves to Ended for both of you, as a record. {other side} can no longer open your reports, and the letter of intent and the chat close.", "The NDA stays in force until {NDA expiry}: what you each learned stays confidential."]
    : ["The deal moves to Ended for both of you, as a record. You can no longer open the reports, and your letter of intent and the chat close.", "The NDA stays in force until {NDA expiry}: keep what you learned confidential."];
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try { await fn({ data: { id: p.id, reason: reason!, comment, shared } }); onDone(); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  };
  return (
    <D.Content className={cn(BOX, "sm:w-[560px]")} aria-describedby="wd-desc">
      <div className="relative shrink-0 px-6 pr-16 pt-5">
        <div className={CAP}>{fill(t("Step 1 of 2 · what {other side} sees"), v)}</div>
        <D.Title className="mt-1 text-[17px] font-bold leading-[1.35]">{fill(t("Withdraw from the deal with {other side}?"), v)}</D.Title>
        <p id="wd-desc" className="mt-[5px] text-[13px] leading-[1.45] text-[#6B7280]">{fill(t("{other side} gets a notification and an email. You can't undo this."), v)}</p>
        <CloseX />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-[18px]">
        <div className={CAP}>{t("Why are you withdrawing?")} <span className="text-[#B91C1C]">*</span></div>
        <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-2">
          {reasons.map(([code, label], i) => {
            const on = reason === code;
            return (
              <button key={code} type="button" role="radio" aria-checked={on} autoFocus={i === 0} onClick={() => setReason(code)}
                className={cn("flex min-h-[38px] items-center rounded-[10px] border px-3 text-left text-[13.5px]",
                  on ? "border-[#111827] bg-[#FAFAFB] font-semibold dark:border-[#F3F4F6] dark:bg-[#F3F4F6] dark:text-[#111827]" : "border-[#E5E7EB] hover:border-[#9CA3AF] dark:border-white/15")}>
                <span className={cn("mr-[9px] grid h-4 w-4 shrink-0 place-items-center rounded-full border", on ? "border-[5px] border-[#111827]" : "border-[#D1D5DB]")} />
                {t(label)}
              </button>
            );
          })}
        </div>
        <label className="mt-[18px] block">
          <span className={CAP}>{fill(t("Comment for {other side}"), v)} {reason === "other"
            ? <span className="font-semibold normal-case text-[#B45309]">{t("(required)")}</span>
            : <span className="font-medium normal-case">{t("(optional)")}</span>}</span>
          <textarea value={comment} maxLength={500} rows={2} onChange={(e) => setComment(e.target.value)} placeholder={t("For example, what would change your mind.")}
            className="mt-2 block min-h-[64px] w-full resize-y rounded-[10px] border border-[#D1D5DB] bg-transparent px-3 py-2.5 text-[13.5px] leading-[1.5] focus:border-[#111827] focus:outline-none focus:ring-[3px] focus:ring-[rgba(17,24,39,.08)] dark:border-white/15" />
          <span className="mt-1 block text-right text-[11.5px] text-[#9CA3AF]">{comment.length} / 500</span>
        </label>
        <label className="mt-2 flex cursor-pointer gap-2.5">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded-[4px] accent-[#111827]" />
          <span>
            <span className="block text-[13.5px] font-semibold">{fill(t("Share my reason and comment with {other side}"), v)}</span>
            <span className="block text-[12.5px] text-[#6B7280]">{fill(t("Untick to keep them private: {other side} then only sees that you withdrew."), v)}</span>
          </span>
        </label>
        <div className="mt-[14px] rounded-[12px] border border-[#EEF0F3] bg-[#F8F9FB] px-[14px] py-3 dark:border-white/10 dark:bg-white/5">
          <div className={CAP}>{t("What happens")}</div>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12.5px] leading-[1.5] text-[#4B5563] dark:text-[#D1D5DB]">
            {happens.map((h) => <li key={h}>{fill(t(h), v)}</li>)}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#EEF0F3] bg-[#FAFAFB] px-6 py-[14px] dark:border-white/10 dark:bg-white/5">
        <span className="mr-auto text-[12.5px] text-[#B45309] dark:text-[#F87171]">
          {!reason ? t("Choose a reason to continue.") : needComment ? t("Add a comment to explain your reason.") : ""}
        </span>
        <button type="button" onClick={onCancel} className={cn(BTN, "border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] dark:border-white/15 dark:bg-transparent")}>{t("Cancel")}</button>
        <button type="button" disabled={!ready || busy} onClick={submit} className={cn(BTN, "bg-[#DC2626] text-white hover:bg-[#B91C1C]")}>{t("Withdraw from deal")}</button>
      </div>
    </D.Content>
  );
}

function Step2({ p, seller, other, t, onSkip, onSent }: { p: PipelineRow; seller: boolean; other: string; t: T; onSkip: () => void; onSent: () => void }) {
  const [opts, setOpts] = useState<string[]>([]);
  const [more, setMore] = useState("");
  const [improve, setImprove] = useState("");
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(sendWithdrawalFeedback);
  const list = seller ? SELLER_FB : BUYER_FB;
  const ready = opts.length > 0 || !!more.trim() || !!improve.trim();
  const send = async () => {
    setBusy(true);
    try { await fn({ data: { id: p.id, options: opts, more, improve } }); onSent(); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  };
  const field = "mt-2 block min-h-[72px] w-full resize-y rounded-[10px] border border-[#C9CFE0] bg-white px-3 py-2.5 text-[13.5px] leading-[1.5] focus:border-[#192957] focus:outline-none focus:ring-[3px] focus:ring-[rgba(25,41,87,.12)] dark:border-white/15 dark:bg-transparent";
  return (
    <D.Content className={cn(BOX, "sm:w-[560px]")} aria-describedby={undefined}>
      <div role="status" className="flex shrink-0 items-center gap-2 border-b border-[#BBF7D0] bg-[#ECFDF3] px-6 py-[11px] text-[13px] font-semibold text-[#15803D]">
        <Check className="h-[15px] w-[15px]" />{fill(t("You withdrew from the deal with {other side}"), { "other side": other })}
      </div>
      <div className="relative flex shrink-0 items-center gap-3 border-b border-white/[.08] bg-[#151A28] px-6 pb-[18px] pr-16 pt-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-white/[.08] [&_svg]:!fill-white"><HatMark width={24} /></span>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-[#F6A823]">{t("Feedback for PitchSnack")}</div>
          <D.Title className="text-[17px] font-bold text-white">{t("Tell us how it went")}</D.Title>
        </div>
        <CloseX dark />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F5F6FA] px-6 pb-5 pt-[18px] dark:bg-transparent">
        <div className="flex items-start gap-2.5 rounded-[12px] border border-[#E3E6EE] bg-white px-[14px] py-3 text-[13px] text-[#374151] dark:border-white/10 dark:bg-white/5 dark:text-[#D1D5DB]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#192957] dark:text-[#93A4D8]" />{t("Your feedback is private to PitchSnack and will not affect your account.")}
        </div>
        <div className="mt-[18px] text-[14px] font-semibold">{t("What really happened?")} <span className="text-[12.5px] font-medium text-[#6B7280]">{t("(pick any)")}</span></div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {list.map(([code, label]) => {
            const on = opts.includes(code);
            return (
              <button key={code} type="button" aria-pressed={on} onClick={() => setOpts(on ? opts.filter((o) => o !== code) : [...opts, code])}
                className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px]",
                  on ? "border-[#192957] bg-[#192957] font-semibold text-white dark:border-[#F3F4F6] dark:bg-[#F3F4F6] dark:text-[#111827]" : "border-[#C9CFE0] bg-white font-medium text-[#374151] hover:border-[#8A93AE] dark:border-white/15 dark:bg-transparent dark:text-[#D1D5DB]")}>
                {on && <Check className="h-[13px] w-[13px]" />}{t(label)}
              </button>
            );
          })}
        </div>
        <label className="mt-4 block">
          <span className="text-[14px] font-semibold">{t("Tell us more")} <span className="text-[12.5px] font-medium text-[#6B7280]">{t("(optional)")}</span></span>
          <textarea value={more} maxLength={1000} onChange={(e) => setMore(e.target.value)} placeholder={t("Anything else about what happened. Be as honest as you like.")} className={field} />
        </label>
        <label className="mt-4 block">
          <span className="text-[14px] font-semibold">{t("How could PitchSnack improve your journey?")} <span className="text-[12.5px] font-medium text-[#6B7280]">{t("(optional)")}</span></span>
          <textarea value={improve} maxLength={1000} onChange={(e) => setImprove(e.target.value)} placeholder={t("What was missing, confusing or slow?")} className={field} />
        </label>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#EEF0F3] bg-white px-6 py-[14px] dark:border-white/10 dark:bg-card">
        <span className="mr-auto text-[12.5px] text-[#6B7280]">{t("This step is optional.")}</span>
        <button type="button" onClick={onSkip} className={cn(BTN, "border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] dark:border-white/15 dark:bg-transparent")}>{t("Skip")}</button>
        <button type="button" disabled={!ready || busy} onClick={send} className={cn(BTN, "bg-[#192957] text-white hover:bg-[#0F1B3D]")}>{t("Send to PitchSnack")}</button>
      </div>
    </D.Content>
  );
}

function Thanks({ t, onDone }: { t: T; onDone: () => void }) {
  return (
    <D.Content className={cn(BOX, "px-5 pb-5 pt-[18px] sm:w-[400px]")} aria-describedby="wd-thanks">
      <div className="flex items-center justify-between">
        <img src={logo.url} alt="PitchSnack" className="h-4 w-auto dark:invert" />
        <D.Close aria-label="Close" className="grid h-7 w-7 place-items-center rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-4 w-4" /></D.Close>
      </div>
      <div className="mt-[22px] flex gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ECFDF3]"><Check className="h-4 w-4 text-[#16A34A]" /></span>
        <div>
          <D.Title className="text-[16px] font-bold leading-7">{t("Thank you for your feedback")}</D.Title>
          <p id="wd-thanks" className="text-[13px] leading-[1.5] text-[#6B7280]">{t("The PitchSnack team will review your feedback and use it to improve the experience.")}</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" autoFocus onClick={onDone} className="h-[34px] rounded-[9px] bg-[#192957] px-[18px] text-[13.5px] font-semibold text-white hover:bg-[#0F1B3D]">{t("Done")}</button>
      </div>
    </D.Content>
  );
}

/** The grey box at the top of an ended card. */
export function EndedBox({ w, p, seller, t }: { w: Withdrawal; p: PipelineRow; seller: boolean; t: T }) {
  const other = p.counterparty.name;
  const by = w.side === "seller" ? t("The seller") : t("The buyer");
  const exp = fmt(p.ndaExpiresAt, true);
  return (
    <div className="mx-5 mb-[14px] mt-1 rounded-[12px] border border-[#E5E7EB] bg-[#F8F9FB] px-4 py-[14px] dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-[#111827] dark:text-foreground">
        <LogOut className="h-4 w-4 text-[#6B7280]" />
        {w.mine ? `${t("You withdrew from this deal on")} ${fmt(w.at, true)}` : `${by} ${t("withdrew from this deal on")} ${fmt(w.at, true)}`}
      </div>
      <div className="mt-1.5 pl-6 text-[13px] leading-[1.5]">
        {w.reason ? (
          <div className="grid grid-cols-[72px_1fr] gap-x-2">
            <span className="text-[#6B7280]">{t("Reason")}</span><span className="font-semibold text-[#111827] dark:text-foreground">{t(reasonLabel(w.reason))}</span>
            {w.comment && <><span className="text-[#6B7280]">{t("Comment")}</span><span className="text-[#374151] dark:text-[#D1D5DB]">"{w.comment}"</span></>}
          </div>
        ) : (
          <div className="text-[#6B7280]">{by} {t("didn't share a reason.")}</div>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <Lock className="h-3 w-3 shrink-0" />
          {w.mine
            ? `${w.shared ? t("Shared with") : t("Not shared with")} ${other} · ${fill(t("The NDA stays in force until {NDA expiry}."), { "NDA expiry": exp })}`
            : fill(t("The NDA stays in force until {NDA expiry}: keep what you learned confidential."), { "NDA expiry": exp })}
        </div>
        {w.feedbackSent && (
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B7280]"><Check className="h-3 w-3 text-[#15803D]" />{t("Your feedback went to the PitchSnack team only.")}</div>
        )}
      </div>
      {!seller && null}
    </div>
  );
}

export const withdrewText = (w: Withdrawal, t: T) =>
  `${w.mine ? t("you withdrew on") : w.side === "seller" ? t("the seller withdrew on") : t("the buyer withdrew on")} ${fmt(w.at)}`;
export const closedWhen = (w: Withdrawal, t: T) =>
  w.mine ? t("closed when you withdrew") : w.side === "seller" ? t("closed when the seller withdrew") : t("closed when the buyer withdrew");
