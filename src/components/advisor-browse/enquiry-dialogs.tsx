import { HatMark } from "@/components/messages/hat-mark";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CheckCircle2, FileText, Hourglass, Lock, MessageSquare, Paperclip, Send, Upload, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tr } from "@/i18n/language";
import { serviceOf, newFee, type FeeDetail } from "@/lib/advisor-firm";
import {
  ENQUIRY_EXAMPLES, RATING_LABELS, REASONS, TIMINGS, fmtLong, fmtShort, proposalFeeWords,
  type ClientSide, type EnquiryState, type Me, type ProposalDTO, type Timing,
} from "@/lib/advisor-enquiry";
import {
  acceptAdvisorProposal, completeAdvisorWork, createProposalLetterUpload, declineAdvisorEnquiry, declineAdvisorProposal,
  openProposalLetter, sendAdvisorEnquiry, sendAdvisorProposal,
} from "@/lib/advisor-enquiries.functions";
import { FeeControl } from "@/components/advisor/advisor-firm-fields";

/** Translate, then fill {placeholders}. */
export const tf = (s: string, vars: Record<string, string | number | null | undefined> = {}) =>
  tr(s).replace(/\{([^}]+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));

const NAVY = "bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90 dark:bg-primary dark:text-primary-foreground";
const RED = "bg-[#DC2626] text-white hover:bg-[#B91C1C]";
const chip = (on: boolean) => cn(
  "inline-flex h-9 items-center gap-2 rounded-full border px-[13px] text-[13.5px] transition-colors",
  on ? "border-[#1E2A4A] bg-[#F4F6FA] font-semibold shadow-[inset_0_0_0_1px_#1E2A4A] dark:border-foreground dark:bg-muted dark:shadow-[inset_0_0_0_1px_hsl(var(--foreground))]" : "border-[#DCDFE5] font-medium hover:bg-muted dark:border-border",
);
const box = "w-full rounded-[10px] border border-[#DCDFE5] bg-card px-3 py-2.5 text-[14px] outline-none focus:border-[#1E2A4A] focus:ring-[3px] focus:ring-[#1E2A4A]/15 dark:border-border";
const Label = ({ children, req, opt }: { children: React.ReactNode; req?: boolean; opt?: boolean }) => (
  <div className="mb-2 text-[13.5px] font-semibold">{children}{req && <span className="ml-0.5 text-[12px] text-[#B42318]">*</span>}{opt && <span className="ml-1.5 text-[12.5px] font-normal text-[#9CA3AF]">{tr("optional")}</span>}</div>
);
const ErrLine = ({ m }: { m: string | null }) => (m ? <p className="text-[12.5px] text-[#B42318]">{m}</p> : <span />);

/* ───────────────────────── Status chip (card, panel, list) ───────────────────────── */

export function StatusChip({ s, big }: { s: EnquiryState; big?: boolean }) {
  const map: Record<string, { cls: string; Icon: any; text: string }> = {
    enquiry: { cls: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] dark:border-border dark:bg-muted dark:text-muted-foreground", Icon: Send, text: tf("Enquiry sent · {date}", { date: fmtShort(s.createdAt) }) },
    talking: { cls: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] dark:border-border dark:bg-muted dark:text-muted-foreground", Icon: MessageSquare, text: tr("In conversation") },
    proposal: { cls: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300", Icon: FileText, text: tr("Proposal to review") },
    engaged: { cls: "border-[#BBE8CA] bg-[#E9F6EE] text-[#15803D] dark:border-green-900 dark:bg-green-950/50 dark:text-green-300", Icon: UserCheck, text: tr("Your advisor") },
    done: { cls: "border-[#BBE8CA] bg-[#E9F6EE] text-[#15803D] dark:border-green-900 dark:bg-green-950/50 dark:text-green-300", Icon: Check, text: tf("Work done · {stars} ★", { stars: s.review?.stars ?? "" }) },
  };
  const m = map[s.status];
  if (!m) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border font-semibold", m.cls, big ? "h-[38px] rounded-[10px] px-[13px] text-[13.5px]" : "h-[30px] rounded-[8px] px-2.5 text-[12.5px]")}>
      <m.Icon className={big ? "h-4 w-4" : "h-3.5 w-3.5"} />{m.text}
    </span>
  );
}

/** Whether this company can send a new enquiry to the firm. */
export const canEnquire = (s: EnquiryState | undefined) => !s || ["declined", "closed", "done"].includes(s.status);

export function SendEnquiryButton({ onClick, big }: { onClick: () => void; big?: boolean }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold", NAVY, big ? "h-10 rounded-[10px] px-4 text-[14px]" : "h-[30px] rounded-[8px] px-2.5 text-[12.5px]")}>
      <Send className={big ? "h-[15px] w-[15px]" : "h-[13px] w-[13px]"} />{tr("Send enquiry")}
    </button>
  );
}

/* ───────────────────────── Proposal rows ───────────────────────── */

export function ProposalRows({ p }: { p: ProposalDTO }) {
  const letterFn = useServerFn(openProposalLetter);
  const row = (k: string, v: React.ReactNode, bold?: boolean) => (
    <div className="grid grid-cols-[104px_1fr] gap-2 border-b border-[#F0F1F4] px-3 py-2 text-[13px] last:border-0 dark:border-border">
      <span className="text-[#6B7280]">{tr(k)}</span><span className={cn("min-w-0 break-words", bold && "font-bold")}>{v}</span>
    </div>
  );
  return (
    <div className="rounded-[11px] border border-[#DCE3F0] bg-card dark:border-border">
      {row("Service", p.service)}
      {row("Scope", <span className="whitespace-pre-line">{p.scope}</span>)}
      {row("Fee", p.fee, true)}
      {p.timing && row("Timing", p.timing)}
      {row("Valid until", fmtLong(p.validUntil))}
      {p.letter && row("Engagement letter", (
        <button type="button" className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8] hover:underline"
          onClick={async () => { try { const { url } = await letterFn({ data: { proposalId: p.id } }); if (url) window.open(url, "_blank", "noopener"); } catch (e) { toast.error((e as Error).message); } }}>
          <FileText className="h-3.5 w-3.5" />{p.letter.name}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Send enquiry ───────────────────────── */

type FirmLite = { id: string; name: string; services: string[]; managed?: boolean };

export function SendEnquiryDialog({ firm, me, service, onClose, onOpenMessages }: {
  firm: FirmLite; me: Me; service?: string | null; onClose: () => void; onOpenMessages: (key: string) => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(sendAdvisorEnquiry);
  const [svc, setSvc] = useState<string | null>(service ?? (firm.services.length === 1 ? firm.services[0] : null));
  const [text, setText] = useState("");
  const [timing, setTiming] = useState<Timing | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const svcRef = useRef<HTMLDivElement>(null);
  const txtRef = useRef<HTMLTextAreaElement>(null);
  const svcErr = !svc ? tr("Choose a service.") : null;
  const txtErr = text.trim().length < 30 ? tr("Write at least 30 characters.") : null;
  const seller = me.side === "seller";
  const ex = svc ? ENQUIRY_EXAMPLES[svc]?.[seller ? 0 : 1] : null;
  const free = seller ? tr("Free · doesn't use your Connect requests") : tr("Free · doesn't use your NDA requests");

  async function submit() {
    setShow(true);
    if (svcErr) { svcRef.current?.querySelector("button")?.focus(); return; }
    if (txtErr) { txtRef.current?.focus(); return; }
    setBusy(true);
    try {
      const r = await fn({ data: { firmId: firm.id, service: svc!, text: text.trim(), timing } });
      if (!r.ok) { toast.error(r.error); return; }
      setSent(r.conversationKey);
      qc.invalidateQueries({ queryKey: ["browse-advisors"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] overflow-y-auto rounded-[16px] p-[22px_24px]", sent ? "max-w-[640px]" : "max-w-[600px]")}
        onOpenAutoFocus={(e) => { if (sent) return; e.preventDefault(); }}>
        {sent ? (
          <>
            <span className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-[#BBE8CA] bg-[#E9F6EE] px-3 text-[13px] font-semibold text-[#15803D] dark:border-green-900 dark:bg-green-950/50 dark:text-green-300"><Check className="h-3.5 w-3.5" />{tf("Enquiry sent to {firm}", { firm: firm.name })}</span>
            <DialogTitle className="font-heading text-[21px] font-bold">{tr("What's next")}</DialogTitle>
            <DialogDescription className="sr-only">{tr("What's next")}</DialogDescription>
            <ol className="space-y-0">
              {[
                [tf("{firm} gets your enquiry", { firm: firm.name }), tr("By email and in its Messages.")],
                [tr("They reply in Messages"), tr("With questions, or a proposal: the scope, the fee and the timing.")],
                [tr("You accept the proposal"), tf("{firm} becomes your advisor. You can bring them into a deal at Contact M&A.", { firm: firm.name })],
              ].map(([t, l], i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < 2 && <span className="absolute left-[14px] top-[30px] h-[calc(100%-30px)] w-0.5 bg-[#D6DAE3] dark:bg-border" />}
                  <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[13px] font-bold", i === 0 ? "bg-[#1E2A4A] text-white dark:bg-primary" : "bg-card shadow-[inset_0_0_0_2px_#C9CEDA]")}>{i === 0 ? <Check className="h-4 w-4" /> : i + 1}</span>
                  <div><div className="text-[14px] font-semibold">{t}</div><div className="text-[13px] text-muted-foreground">{l}</div></div>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted-foreground">{free}</span>
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 gap-1.5" onClick={() => onOpenMessages(sent)}><MessageSquare className="h-4 w-4" />{tr("Open in Messages")}</Button>
                <Button autoFocus className={cn("h-10", NAVY)} onClick={onClose}>{tr("Done")}</Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogTitle className="font-heading text-[21px] font-bold leading-tight">{tf("Send an enquiry to {firm}", { firm: firm.name })}</DialogTitle>
            <DialogDescription className="text-[14px] text-[#434A5C] dark:text-muted-foreground">{tf("Tell {firm} what you need. They reply in Messages, and can send you a proposal with the scope, the fee and the timing.", { firm: firm.name })}</DialogDescription>
            {firm.managed && (
              <div className="flex items-start gap-2 rounded-[10px] border border-[#E7E9EE] bg-[#F6F7F9] px-3 py-2.5 text-[13px] leading-[1.5] text-[#374151] dark:border-border dark:bg-muted dark:text-muted-foreground">
                <span className="mt-[3px] shrink-0"><HatMark width={16} /></span>
                <span><strong className="font-semibold">{tr("Managed by PitchSnack.")}</strong> {tf("The PitchSnack team reads and answers enquiries for {firm}.", { firm: firm.name })}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <Label req>{tr("Which service do you need?")}</Label>
                <div ref={svcRef} role="radiogroup" className="flex flex-wrap gap-2">
                  {firm.services.map((s) => {
                    const I = serviceOf(s).icon;
                    return (
                      <button key={s} type="button" role="radio" aria-checked={svc === s} onClick={() => setSvc(s)} className={chip(svc === s)}>
                        <span className="-ml-1.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-[#E0F5F2] text-[#0F766E]"><I className="h-3 w-3" /></span>{tr(s)}
                      </button>
                    );
                  })}
                </div>
                {show && <div className="mt-1.5"><ErrLine m={svcErr} /></div>}
              </div>
              <div>
                <Label req>{tr("What do you need help with?")}</Label>
                <textarea ref={txtRef} rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={show && !!txtErr}
                  placeholder={ex ? tr(ex) : tr("Pick a service first, then tell them what you need.")} className={cn(box, show && txtErr && "border-[#B42318]")} />
                <div className="mt-1 flex justify-between gap-2"><ErrLine m={show ? txtErr : null} /><span className="text-[12.5px] text-muted-foreground">{text.length.toLocaleString("en-US")} / 1,000</span></div>
              </div>
              <div>
                <Label opt>{tr("When do you need it?")}</Label>
                <div role="radiogroup" className="flex flex-wrap gap-2">
                  {TIMINGS.map((t) => <button key={t.value} type="button" role="radio" aria-checked={timing === t.value} onClick={() => setTiming(timing === t.value ? null : t.value)} className={chip(timing === t.value)}>{tr(t.label)}</button>)}
                </div>
              </div>
              <div className="rounded-[12px] border border-[#ECEEF2] bg-[#F6F7F9] px-[15px] py-[13px] dark:border-border dark:bg-muted/50">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[#6B7280]">{tf("What {firm} will see", { firm: firm.name })}</div>
                {[
                  ["You", [me.name, me.title].filter(Boolean).join(", ")],
                  ["Company", me.company ?? "—"],
                  ["Contact", [me.email, me.phone].filter(Boolean).join(" · ")],
                  ["As", seller ? tr("Seller on PitchSnack") : tr("Buyer on PitchSnack")],
                ].map(([k, v]) => <div key={k} className="grid grid-cols-[84px_1fr] gap-2 py-0.5 text-[13px]"><span className="text-[#6B7280]">{tr(k)}</span><span className="min-w-0 break-words">{v}</span></div>)}
                <p className="mt-2 flex gap-1.5 text-[12.5px] text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{seller ? tr("Your listing, your deals and your reports stay hidden. Share them in Messages only if you want to.") : tr("Your investor profile, your deals and your reports stay hidden. Share them in Messages only if you want to.")}</p>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted-foreground">{free}</span>
              <div className="flex gap-2">
                <Button variant="outline" className="h-10" onClick={onClose}>{tr("Cancel")}</Button>
                <Button className={cn("h-10 gap-1.5", NAVY)} disabled={busy} onClick={submit}><Send className="h-[15px] w-[15px]" />{tr("Send enquiry")}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Accept / decline proposal ───────────────────────── */

const Tick = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2 text-[13px] text-[#374151] dark:text-foreground"><CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#16A34A]" />{children}</li>
);

export function AcceptProposalDialog({ firm, p, me, onClose }: { firm: string; p: ProposalDTO; me: Me; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(acceptAdvisorProposal);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[640px] overflow-y-auto rounded-[16px]">
        <DialogTitle className="font-heading text-[21px] font-bold">{tf("Engage {firm} for {service}?", { firm, service: tr(p.service) })}</DialogTitle>
        <DialogDescription>{tf("Accepting this proposal makes {firm} your advisor. They're told at once.", { firm })}</DialogDescription>
        <ProposalRows p={p} />
        <ul className="space-y-1.5">
          <Tick>{tf("{firm} becomes your advisor and joins your Contacts.", { firm })}</Tick>
          <Tick>{tf("You pay {firm} directly, under its engagement letter. PitchSnack doesn't charge for this.", { firm })}</Tick>
          <Tick>{tf("When the work is done, you can rate {firm}. Your review shows your role and sector, never your name.", { firm })}</Tick>
        </ul>
        <label className={cn("flex cursor-pointer gap-3 rounded-[12px] border px-3.5 py-3", ok ? "border-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground))]" : "border-[#E5E7EB] dark:border-border")}>
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span><span className="block text-[13.5px] font-semibold">{tf("I accept this proposal on behalf of {company}.", { company: me.company ?? "" })}</span>
            <span className="text-[12.5px] text-muted-foreground">{tf("Accepting as {name}.", { name: [me.name, me.title].filter(Boolean).join(", ") })}</span></span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button>
          <span title={ok ? undefined : tr("Tick the box to accept")}>
            <Button className={cn(NAVY, !ok && "opacity-40")} disabled={!ok || busy} onClick={async () => {
              setBusy(true);
              try {
                const r = await fn({ data: { proposalId: p.id, consent: true } });
                if (!r.ok) { toast.error(r.error); return; }
                toast.success(tf("{firm} is now your advisor. They've been told.", { firm }));
                await qc.invalidateQueries({ queryKey: ["browse-advisors"] }); qc.invalidateQueries({ queryKey: ["messages"] });
                onClose();
              } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
            }}>{tr("Accept proposal")}</Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeclineProposalDialog({ firm, p, onClose }: { firm: string; p: ProposalDTO; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(declineAdvisorProposal);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[540px] rounded-[16px]">
        <DialogTitle className="font-heading text-[20px] font-bold">{tf("Decline the proposal from {firm}?", { firm })}</DialogTitle>
        <DialogDescription>{tf("{firm} is told. You can still message them, and they can send you a new proposal.", { firm })}</DialogDescription>
        <div><Label opt>{tr("Tell them why")}</Label>
          <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={box}
            placeholder={tr("e.g. The fee is above our budget. Could you quote for the valuation only, without the summary?")} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button>
          <Button className={RED} disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const r = await fn({ data: { proposalId: p.id, note: note.trim() || undefined } });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(tf("Proposal declined. {firm} is told.", { firm }));
              await qc.invalidateQueries({ queryKey: ["browse-advisors"] }); qc.invalidateQueries({ queryKey: ["messages"] });
              onClose();
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{tr("Decline proposal")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── The work is done ───────────────────────── */

export function RateDialog({ firm, enquiryId, service, side, detail, onClose }: { firm: string; enquiryId: string; service: string; side: ClientSide; detail: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(completeAdvisorWork);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = hover || stars;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[640px] rounded-[16px]">
        <DialogTitle className="font-heading text-[21px] font-bold">{tf("How was {firm}?", { firm })}</DialogTitle>
        <DialogDescription>{tf("Mark the work on {service} as done and rate it. Your review shows your role and sector, never your name, and {firm} can't edit it.", { firm, service: tr(service) })}</DialogDescription>
        <div>
          <Label req>{tr("Your rating")}</Label>
          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label={tr("Your rating")} className="flex" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ★ ${tr(RATING_LABELS[n - 1])}`}
                  onMouseEnter={() => setHover(n)} onClick={() => setStars(n)} className="grid h-10 w-10 place-items-center">
                  <svg width="30" height="30" viewBox="0 0 24 24" className={n <= v ? "text-[#F59E0B]" : "text-[#D7DBE2] dark:text-muted"} fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></svg>
                </button>
              ))}
            </div>
            {v > 0 && <span className="text-[14px] font-semibold">{tr(RATING_LABELS[v - 1])}</span>}
          </div>
          {show && !stars && <ErrLine m={tr("Choose a rating from 1 to 5 stars.")} />}
        </div>
        <div>
          <Label opt>{tr("Your review")}</Label>
          <textarea rows={4} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={box} placeholder={tr("What went well, and what could be better?")} />
          <div className="mt-1 flex justify-between gap-2 text-[12.5px] text-muted-foreground">
            <span>{tr("Shows as:")} {[side === "seller" ? tr("Seller") : tr("Buyer"), detail, `✓ ${tr("PitchSnack client")}`].filter(Boolean).join(" · ")}</span>
            <span>{text.length} / 500</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button>
          <Button className={NAVY} disabled={busy} onClick={async () => {
            setShow(true);
            if (!stars) return;
            setBusy(true);
            try {
              const r = await fn({ data: { enquiryId, stars, comment: text.trim() || undefined } });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(tf("Thank you. Your review is on {firm}'s profile.", { firm }));
              await qc.invalidateQueries({ queryKey: ["browse-advisors"] }); qc.invalidateQueries({ queryKey: ["messages"] });
              onClose();
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{tr("Submit review")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── The firm: send proposal / decline enquiry ───────────────────────── */

const addDays = (n: number) => fmtLong(new Date(Date.now() + 7 * 3600_000 + n * 86400_000).toISOString());

export function SendProposalDialog({ enquiryId, client, clientName, clientFirst, service, services, fees, onClose }: {
  enquiryId: string; client: string; clientName: string; clientFirst: string; service: string; services: string[]; fees: Record<string, FeeDetail>; onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(sendAdvisorProposal);
  const upFn = useServerFn(createProposalLetterUpload);
  const startSvc = services.includes(service) ? service : services[0] ?? service;
  const feeFor = (s: string): FeeDetail => { const f = fees[s]; return !f || f.type === "quote" ? { ...newFee(), type: "fixed" } : { ...f }; };
  const [svc, setSvc] = useState(startSvc);
  const [scope, setScope] = useState("");
  const [fee, setFee] = useState<FeeDetail>(feeFor(startSvc));
  const [timing, setTiming] = useState("");
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const scopeRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setFee(feeFor(svc)), [svc]);
  const scopeErr = scope.trim().length < 30 ? "Write at least 30 characters." : null;
  const words = proposalFeeWords(fee);

  async function submit() {
    setShow(true);
    if (scopeErr) { scopeRef.current?.focus(); return; }
    if (!words) return;
    setBusy(true);
    try {
      let letter = null;
      if (file) {
        const { path, token } = await upFn({ data: { enquiryId, size: file.size } });
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/startup-media/${path}?token=${token}`, { method: "PUT", headers: { "content-type": "application/pdf" }, body: file });
        if (!res.ok) throw new Error("Could not upload the PDF");
        letter = { path, name: file.name, size: file.size };
      }
      const r = await fn({ data: { enquiryId, service: svc, scope: scope.trim(), fee: fee as any, timing: timing.trim() || undefined, validDays: days, letter } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Proposal sent to ${r.client}.`);
      await qc.invalidateQueries({ queryKey: ["messages"] });
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[700px] overflow-y-auto rounded-[16px]">
        <DialogTitle className="font-heading text-[21px] font-bold">Send a proposal to {client}</DialogTitle>
        <DialogDescription>{clientName} sees it in Messages and can accept it for {client}. Once accepted, you're their advisor.</DialogDescription>
        <div className="space-y-4">
          <div><Label req>Service</Label>
            <select value={svc} onChange={(e) => setSvc(e.target.value)} className={cn(box, "h-10 py-0")}>{services.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><Label req>Scope</Label>
            <textarea ref={scopeRef} rows={4} maxLength={1000} value={scope} onChange={(e) => setScope(e.target.value)} className={cn(box, show && scopeErr && "border-[#B42318]")}
              placeholder="What you will do, for which company and period, and what they get at the end." />
            <div className="mt-1 flex justify-between"><ErrLine m={show ? scopeErr : null} /><span className="text-[12.5px] text-muted-foreground">{scope.length.toLocaleString("en-US")} / 1,000</span></div></div>
          <div><Label req>Fee</Label><FeeControl service={svc} value={fee} onChange={setFee} showErr={show} proposal={{ words: proposalFeeWords }} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label opt>Timing</Label><input maxLength={60} value={timing} onChange={(e) => setTiming(e.target.value)} className={cn(box, "h-10 py-0")} placeholder="e.g. About 3 weeks from the documents" /></div>
            <div><Label>Valid for</Label>
              <select value={days} onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)} className={cn(box, "h-10 py-0")}>
                {[7, 14, 30].map((d) => <option key={d} value={d}>{d} days · until {addDays(d)}</option>)}
              </select></div>
          </div>
          <div><Label opt>Engagement letter</Label>
            <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-dashed border-[#DCDFE5] p-3 dark:border-border">
              <Paperclip className="h-[17px] w-[17px] text-muted-foreground" />
              {file ? <><span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{file.name} <span className="font-normal text-muted-foreground">· {Math.round(file.size / 1024)} KB · PDF</span></span>
                <Button variant="outline" size="sm" onClick={() => setFile(null)}>Remove</Button></>
                : <><span className="min-w-0 flex-1 text-[13px] text-muted-foreground">Your engagement letter, so {clientFirst} can read the terms. PDF, up to 10 MB.</span>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" />Attach a PDF</Button></>}
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) { setFileErr("Choose a PDF file."); return; }
                if (f.size > 10 * 1024 * 1024) { setFileErr("The file must be 10 MB or smaller."); return; }
                setFileErr(null); setFile(f);
              }} />
            </div>
            <ErrLine m={fileErr} /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted-foreground">Proposals never use your contact requests.</span>
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className={cn("gap-1.5", NAVY)} disabled={busy} onClick={submit}><Send className="h-4 w-4" />Send proposal</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeclineEnquiryDialog({ enquiryId, client, clientName, clientFirst, onClose }: { enquiryId: string; client: string; clientName: string; clientFirst: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(declineAdvisorEnquiry);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[540px] rounded-[16px]">
        <DialogTitle className="font-heading text-[20px] font-bold">Decline the enquiry from {client}?</DialogTitle>
        <DialogDescription>{clientName} is told, with your reason, and can enquire with another firm.</DialogDescription>
        <div><Label req>Reason</Label>
          <div role="radiogroup" className="space-y-2">
            {REASONS.map((r) => (
              <button key={r.value} type="button" role="radio" aria-checked={reason === r.value} onClick={() => setReason(r.value)}
                className={cn("flex h-10 w-full items-center gap-2.5 rounded-[10px] border px-3 text-left text-[13.5px]", reason === r.value ? "border-[#1E2A4A] bg-[#F6F7FB] font-semibold shadow-[inset_0_0_0_1px_#1E2A4A] dark:border-foreground dark:bg-muted" : "border-[#DCDFE5] dark:border-border")}>
                <span className={cn("h-4 w-4 rounded-full border-2", reason === r.value ? "border-[#1E2A4A] bg-[#1E2A4A] shadow-[inset_0_0_0_2px_#fff] dark:border-foreground dark:bg-foreground" : "border-[#C9CEDA]")} />{r.label}
              </button>
            ))}
          </div>
          {show && !reason && <ErrLine m="Choose a reason." />}</div>
        <div><Label opt>A note to {clientFirst}</Label>
          <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={box} placeholder="e.g. Another firm on PitchSnack handles this kind of work well." /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className={RED} disabled={busy} onClick={async () => {
            setShow(true);
            if (!reason) return;
            setBusy(true);
            try {
              const r = await fn({ data: { enquiryId, reason: reason as any, note: note.trim() || undefined } });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Enquiry declined. ${r.client} is told.`);
              await qc.invalidateQueries({ queryKey: ["messages"] });
              onClose();
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>Decline enquiry</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Hourglass };
