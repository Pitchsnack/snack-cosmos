import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { ConfirmRegDialog, FoundDialog, NotFoundDialog, SetupRequest, SimpleDialog, VerifyingDialog } from "@/components/login/signup-reg-parts";
import { RegCopyContext, R_ADD, type SetupReason } from "@/components/login/signup-reg-copy";
import { BusinessStep, bizStepName, businessSteps, companySetupReason, useBusinessAnswers, type BizStep } from "@/components/login/business-steps";
import { S } from "@/components/login/signup-copy";
import { answerAddCheck, getAddContactDefaults, runAddCheck, sendAddSetupRequest, type AddAnswersInput, type AddCheck } from "@/lib/add-company-check.functions";
import type { RegCompany } from "@/lib/signup-reg.functions";
import { REG_CHANGES } from "@/lib/thai-reg";
import { useTranslation } from "@/i18n/language";
import "@/styles/login-page.css";
import "@/styles/signup-page.css";

type Kind = "seller" | "buyer" | "advisor";
type Lang = "en" | "th";
const sessionKey = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) + "-add";
/** The same browser id sign-up uses for the 5-a-day device limit. */
function deviceId() {
  try {
    let id = localStorage.getItem("ps-device-id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ps-device-id", id); }
    return id;
  } catch { return "no-storage-" + Math.random().toString(36).slice(2, 12); }
}

export type AddCheckYes = { attemptId: string; session: string; company: RegCompany; answers: AddAnswersInput };
type Dlg = null | "confirm" | "verifying" | "found" | "nf" | "limit" | "contact" | "unavailable";

/**
 * + Add My Business / Investor Profile / Firm Profile: sign-up's own business steps (BusinessStep) in a
 * pop-up, without Role, Account and Confirm email, then sign-up's check pop-ups. Nothing is created
 * before "Yes"; `onYes` creates the draft and saves every answer.
 */
export function AddCompanyCheck({ kind, open, onClose, onYes }: { kind: Kind; open: boolean; onClose: () => void; onYes: (y: AddCheckYes) => Promise<void> }) {
  const { language } = useTranslation();
  const lang: Lang = language === "th" ? "th" : "en";
  const run = useServerFn(runAddCheck);
  const answerFn = useServerFn(answerAddCheck);
  const sendReq = useServerFn(sendAddSetupRequest);
  const contactFn = useServerFn(getAddContactDefaults);
  const me = useQuery({ queryKey: ["add-contact-defaults"], queryFn: () => contactFn(), staleTime: 5 * 60_000 });
  const session = useRef(sessionKey());
  const b = useBusinessAnswers(kind);
  const order = businessSteps(kind, b.answer);
  const [step, setStep] = useState<BizStep>("about");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [res, setRes] = useState<AddCheck | null>(null);
  const [tried, setTried] = useState<string[]>([]);
  const [checks, setChecks] = useState(0);
  const [busy, setBusy] = useState(false);
  const [setupCard, setSetupCard] = useState<null | "check_failed" | "too_many">(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const attempt = useRef(0);
  const changes = Math.max(0, checks - 1);
  const changesLeft = Math.max(0, REG_CHANGES - changes);

  const assistedInline = companySetupReason(kind, b.answer, b.country, b.noNumber);
  useEffect(() => { if (!dlg) titleRef.current?.focus({ preventScroll: true }); }, [step, assistedInline, setupCard]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (k: BizStep) => { b.setPickErr(false); setStep(k); };
  const idx = Math.max(0, order.indexOf(step));
  const back = () => { if (idx === 0) void close(); else go(order[idx - 1]!); };
  const answers = (): AddAnswersInput => {
    const h = b.held();
    return { answer: b.answer ?? "", types: b.types, company: h.company!, sector: (h.sector ?? {}) as never, logo: h.logo ?? null };
  };

  async function close() {
    ++attempt.current;
    if (res?.status === "found" && dlg === "found") await answerFn({ data: { attemptId: res.attemptId, result: "cancelled" } }).catch(() => {});
    onClose();
  }
  /** After the last business step (or a corrected number): sign-up's check. */
  async function check() {
    const n = ++attempt.current;
    setDlg("verifying");
    let r: AddCheck;
    try { r = await run({ data: { kind, reg: b.reg, session: session.current, deviceId: deviceId() } }); }
    catch (e) { r = { status: "unavailable" }; console.error(e); }
    if (n !== attempt.current) return;
    setRes(r);
    if (r.status === "found" || r.status === "not_found") {
      setChecks((n) => n + 1);
      setTried((l) => Array.from(new Set([...l, r.reg])));
      b.setFix(null); b.setRegLocked(true);
    }
    if (r.status === "found") setDlg("found");
    else if (r.status === "not_found") setDlg(r.changesLeft > 0 ? "nf" : "contact");
    else if (r.status === "limit") setDlg(r.why === "changes" ? "contact" : "limit");
    else setDlg("unavailable");
  }
  function openFix(why: "no" | "nf" | "unavailable", co?: RegCompany) {
    b.setFix({ why, old: b.reg, co }); b.setRegLocked(false); b.setErr5({}); setDlg(null); setStep("company");
    setTimeout(() => { b.regRef.current?.focus(); b.regRef.current?.select(); }, 60);
  }
  async function answerNo() {
    if (res?.status !== "found") return;
    const co = res.company;
    await answerFn({ data: { attemptId: res.attemptId, result: "no" } }).catch(() => {});
    if (changesLeft <= 0) { setDlg("contact"); return; }
    openFix("no", co);
  }
  async function answerYes() {
    if (res?.status !== "found" || busy) return;
    setBusy(true);
    try { await onYes({ attemptId: res.attemptId, session: session.current, company: res.company, answers: answers() }); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }
  /** The number is confirmed: a correction checks at once; otherwise the next steps come first. */
  function confirmNumber() {
    b.setRegLocked(true);
    if (b.fix) { void check(); return; }
    setDlg(null);
    const nx = order[idx + 1];
    if (nx) go(nx); else void check();
  }
  const next = (from: BizStep) => {
    const i = order.indexOf(from);
    const nx = order[i + 1];
    if (nx) go(nx); else void check();
  };
  const init = { name: me.data?.name ?? "", email: me.data?.email ?? "", phone: me.data?.phone ?? "", company: b.coName, country: kind === "seller" ? "Thailand" : b.country };
  const onSend = async (reason: SetupReason, v: { name: string; email: string; phone: string; company: string | null; country: string; note: string | null }) => {
    await sendReq({ data: { kind, reason, lang, session: session.current, ...v } });
  };

  function backFromSetupCard() {
    setSetupCard(null); setDlg(null); setStep("company");
    if (!b.fix && res?.status === "found") b.setFix({ why: "no", old: res.reg, co: res.company });
    else if (!b.fix && res?.status === "not_found") b.setFix({ why: "nf", old: res.reg });
    b.setRegLocked(false);
  }

  const main = open && !dlg;
  return (
    <RegCopyContext.Provider value={R_ADD}>
      <DialogPrimitive.Root open={main} onOpenChange={(o) => { if (!o) void close(); }}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content aria-describedby={undefined} data-testid="add-company-flow"
            className="lg su su-pop fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl shadow-lg"
            data-lang={lang} onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}>
            <DialogPrimitive.Title className="sr-only">{setupCard || assistedInline ? R_ADD.sTitle[lang] : bizStepName(step, kind, R_ADD)[lang]}</DialogPrimitive.Title>
            <div className="lg-card su-card">
              {setupCard ? (
                <div className="su-step">
                  <SetupRequest lang={lang} reason={setupCard} init={init} tried={tried} titleRef={titleRef} onBackToFields={backFromSetupCard} onSend={(v) => onSend(setupCard, v)} />
                </div>
              ) : <>
                {!assistedInline && <div className="su-prog">
                  <div className="su-prow"><b>{bizStepName(step, kind, R_ADD)[lang]}</b><span>{S.progress[lang].replace("{n}", String(idx + 1)).replace("{N}", String(order.length))}</span></div>
                  <div className="su-bars" style={{ gridTemplateColumns: `repeat(${order.length},1fr)` }}>{order.map((n, k) => <i key={n} className={k <= idx ? "on" : ""} />)}</div>
                </div>}
                <div className={`su-step${step === "sector" ? " su-wide" : ""}`} key={step}>
                  <BusinessStep step={step} role={kind} b={b} lang={lang} busy={busy} titleRef={titleRef}
                    go={go} back={back} next={next} onConfirmNeeded={() => setDlg("confirm")} changesLeft={changesLeft}
                    setup={{ init, onSend }} />
                </div>
              </>}
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 grid h-[38px] w-[38px] place-items-center rounded-full hover:bg-muted" aria-label={R_ADD.close[lang]}>
              <X size={18} />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>
      <ConfirmRegDialog open={open && dlg === "confirm"} lang={lang} reg={b.reg} change={b.fix ? changes + 1 : 0} onCancel={() => setDlg(null)} onConfirm={confirmNumber} />
      <VerifyingDialog open={open && dlg === "verifying"} lang={lang} reg={b.reg} onCancel={() => { ++attempt.current; setDlg(null); }} />
      {res?.status === "found" && <FoundDialog open={open && dlg === "found"} lang={lang} reg={res.reg} co={res.company} noChangeLeft={changesLeft <= 0} busy={busy}
        onClose={() => void close()} onNo={() => void answerNo()} onYes={() => void answerYes()} />}
      <NotFoundDialog open={open && dlg === "nf"} lang={lang} reg={b.reg} onEdit={() => openFix("nf")} onContact={() => { setDlg(null); setSetupCard("check_failed"); }} />
      <SimpleDialog open={open && dlg === "limit"} lang={lang} kind="limit" onMain={() => { setDlg(null); setSetupCard("too_many"); }} />
      <SimpleDialog open={open && dlg === "contact"} lang={lang} kind="contact" count={tried.length} onMain={() => { setDlg(null); setSetupCard("check_failed"); }} />
      <SimpleDialog open={open && dlg === "unavailable"} lang={lang} kind="unavailable" onMain={() => void check()} onEdit={changesLeft > 0 ? () => openFix("unavailable") : undefined} />
    </RegCopyContext.Provider>
  );
}
