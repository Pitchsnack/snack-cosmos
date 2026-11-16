import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ConfirmRegDialog, FoundDialog, NotFoundDialog, SimpleDialog, SrDialog, VerifyingDialog, CompanyRows } from "@/components/login/signup-reg-parts";
import { R } from "@/components/login/signup-reg-copy";
import { answerAddCheck, runAddCheck, sendAddSetupRequest, type AddCheck } from "@/lib/add-company-check.functions";
import type { RegCompany } from "@/lib/signup-reg.functions";
import { isValidThaiReg } from "@/lib/thai-reg";
import { useTranslation } from "@/i18n/language";

type Kind = "seller" | "buyer" | "advisor";
type Lang = "en" | "th";
const c = (th: string, en: string) => ({ th, en });
/** Texts only for + Add (sign-up's say "your account"). */
export const A = {
  title: { seller: c("ชื่อบริษัทและเลขทะเบียนนิติบุคคล", "What is your company's name and registration number?"), firm: c("ชื่อบริษัทและเลขทะเบียนนิติบุคคลของท่านคืออะไร?", "What is your firm's name and registration number?") },
  line: { seller: c("ตรวจสอบว่าชื่อตรงกับข้อมูลจดทะเบียนของบริษัท", "Check that the name matches your company registration."), firm: c("ตรวจสอบว่าชื่อตรงกับข้อมูลจดทะเบียนของบริษัท", "Check that the name matches your firm's registration.") },
  coName: c("ชื่อบริษัท", "Company name"), firmName: c("ชื่อบริษัท", "Firm name"),
  nfA: c("เราไม่พบบริษัทที่ใช้เลขทะเบียนนี้ จึงยังไม่สามารถสร้างโปรไฟล์นี้ได้", "We couldn't find a company with this registration number, so we can't create this profile yet."),
  nfB: c("กรุณาตรวจสอบเลขทะเบียนแล้วลองอีกครั้ง หรือติดต่อทีม PitchSnack แล้วเราจะช่วยตั้งค่าโปรไฟล์นี้ให้ท่าน", "Check the number and try again or contact the PitchSnack team and we'll help set up this profile."),
  noneA: c("ต้องใช้เลขทะเบียนนิติบุคคลไทยในการสร้างโปรไฟล์นี้", "A Thai company registration number is needed to create this profile."),
  noneB: c("หากไม่มี ผู้ดูแลระบบของ PitchSnack จะตั้งค่าโปรไฟล์ให้ และเชิญเจ้าของมารับโปรไฟล์ต่อ", "Without one, PitchSnack Admin sets the profile up and invites its owner to take it over."),
  noneBuyer: c("เช่น บริษัทลงทุนที่อยู่นอกประเทศไทย และนักลงทุนรายบุคคลที่ไม่มีบริษัท", "This is the case for investment firms outside Thailand and Individual Investors without a company."),
  noneAdvisor: c("เช่น บริษัทที่ปรึกษาที่อยู่นอกประเทศไทย", "This is the case for advisory firms outside Thailand."),
  reason: c("เหตุผล", "Reason"), foreign: c("บริษัทนอกประเทศไทย", "Firm outside Thailand"), individual: c("นักลงทุนรายบุคคลที่ไม่มีบริษัท", "Individual Investor without a company"), other: c("อื่น ๆ", "Other"),
  sent: c("ขอบคุณ เราได้รับคำขอของท่านแล้ว ทีมของเราจะติดต่อท่านภายใน 1 วันทำการ", "Thanks. We've got your request. Our team will contact you within 1 business day."),
  back: c("ย้อนกลับ", "Back"), cont: c("ดำเนินการต่อ", "Continue"), creating: c("กำลังสร้างโปรไฟล์…", "Creating the profile…"),
  limitA: c("ท่านแก้ไขเลขทะเบียนครบ 2 ครั้งแล้ว กรุณาติดต่อทีม PitchSnack", "You've used both changes. Please contact the PitchSnack team."),
};
const tx = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((o, [k, x]) => o.split(`{${k}}`).join(String(x)), s);
const sessionKey = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) + "-add";

export type AddCheckYes = { attemptId: string; name: string; session: string; company: RegCompany };

/**
 * + Add's company question, confirm, check and "Is this your company?" for every account.
 * Nothing is created here; `onYes` creates the profile and applies the verified facts.
 */
export function AddCompanyCheck({ kind, open, onClose, onYes }: { kind: Kind; open: boolean; onClose: () => void; onYes: (y: AddCheckYes) => Promise<void> }) {
  const { language } = useTranslation();
  const lang: Lang = language === "th" ? "th" : "en";
  const run = useServerFn(runAddCheck);
  const answer = useServerFn(answerAddCheck);
  const sendReq = useServerFn(sendAddSetupRequest);
  const session = useRef(sessionKey());
  const [name, setName] = useState("");
  const [reg, setReg] = useState("");
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState<"q" | "none" | "confirm" | "ver" | "found" | "nf" | "limit">("q");
  const [res, setRes] = useState<AddCheck | null>(null);
  const [rejected, setRejected] = useState<{ reg: string; co: RegCompany } | null>(null);
  const [tried, setTried] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<"foreign" | "individual" | "other">(kind === "buyer" ? "foreign" : "foreign");
  const [sent, setSent] = useState(false);
  const firm = kind === "seller" ? "seller" : "firm";
  const word = kind === "seller" ? "company" : "firm";
  const bad = reg.length === 13 && !isValidThaiReg(reg);
  const changesUsed = Math.max(0, tried.length - 1);
  const changesLeft = Math.max(0, 2 - changesUsed);
  const canGo = name.trim().length >= 2 && reg.length === 13 && !bad;
  const isNewNumber = !tried.includes(reg);
  const blocked = isNewNumber && tried.length >= 3;

  const close = async () => {
    if (res?.status === "found" && step === "found") await answer({ data: { attemptId: res.attemptId, result: "cancelled" } }).catch(() => {});
    setStep("q"); onClose();
  };
  const check = async () => {
    setStep("ver");
    try {
      const r = await run({ data: { kind, reg, session: session.current } });
      if (!tried.includes(reg)) setTried((t) => [...t, reg]);
      setRes(r);
      setStep(r.status === "found" ? "found" : r.status === "not_found" ? "nf" : "limit");
    } catch (e) { toast((e as Error).message); setStep("q"); }
  };
  const no = async () => {
    if (res?.status !== "found") return;
    await answer({ data: { attemptId: res.attemptId, result: "no" } }).catch(() => {});
    setRejected({ reg: res.reg, co: res.company }); setStep("q");
  };
  const yes = async () => {
    if (res?.status !== "found") return;
    setBusy(true);
    try { await onYes({ attemptId: res.attemptId, name: name.trim(), session: session.current, company: res.company }); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };

  const inp = "w-full rounded-[10px] border border-input bg-card px-3.5 py-3 text-[15.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <>
      <SrDialog open={open && (step === "q" || step === "none")} onClose={() => void close()} closable title={A.title[firm][lang]} lang={lang}>
        <h2>{A.title[firm][lang]}<span className="sr-req">*</span></h2>
        <p className="sr-lead">{A.line[firm][lang]}</p>
        {step === "none" ? (
          <div className="sr-warn" style={{ background: "var(--sr-amber-bg)" }} data-testid="no-thai-number">
            <b>{A.noneA[lang]}</b> {A.noneB[lang]}
            {kind === "buyer" && <p className="sr-p" style={{ marginTop: 6 }}>{A.noneBuyer[lang]}</p>}
            {kind === "advisor" && <p className="sr-p" style={{ marginTop: 6 }}>{A.noneAdvisor[lang]}</p>}
            {sent ? <p className="sr-p" role="status">{A.sent[lang]}</p> : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {kind !== "seller" && (
                  <label className="text-[13px] font-semibold">{A.reason[lang]}{" "}
                    <select className="ml-1 rounded-md border border-input bg-card px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                      <option value="foreign">{A.foreign[lang]}</option>
                      {kind === "buyer" && <option value="individual">{A.individual[lang]}</option>}
                      <option value="other">{A.other[lang]}</option>
                    </select></label>
                )}
                <button type="button" className="sr-btn" disabled={busy} onClick={async () => {
                  setBusy(true);
                  try { await sendReq({ data: { kind, reason: kind === "seller" ? "other" : reason, company: name.trim(), lang, session: session.current } }); setSent(true); }
                  catch (e) { toast((e as Error).message); } finally { setBusy(false); }
                }}>{R.contact[lang]}</button>
              </div>
            )}
            <button type="button" className="sr-link block" onClick={() => setStep("q")}>{R.haveAfter[lang]}</button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {rejected && (
              <div className="sr-warn" role="alert">
                <b>{R.fixA[lang]}</b> {R.fixNo[word][lang]}
                <p className="sr-p" style={{ marginTop: 8 }}>{tx(R.boxNo[lang], { number: rejected.reg })}</p>
                <CompanyRows lang={lang} co={rejected.co} />
                <p className="sr-p" style={{ marginTop: 8 }}>{R.boxLeft[lang]} <b>{changesLeft === 1 ? R.left1[lang] : tx(R.left[lang], { k: changesLeft })}</b></p>
              </div>
            )}
            <div><label className="mb-[7px] block text-[13px] font-semibold" htmlFor="ac-name">{kind === "seller" ? A.coName[lang] : A.firmName[lang]}<span className="sr-req">*</span></label>
              <input id="ac-name" className={inp} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="mb-[7px] block text-[13px] font-semibold" htmlFor="ac-reg">{R.regLabel.en}<span className="sr-req">*</span></label>
              <input id="ac-reg" className={inp} inputMode="numeric" maxLength={13} value={reg} placeholder={R.regPh[lang]} aria-invalid={bad}
                onBlur={() => setTouched(true)} onChange={(e) => setReg(e.target.value.replace(/\D/g, "").slice(0, 13))} />
              <p className={`sr-hint${bad && touched ? " bad" : ""}`}>{bad ? R.regBad[lang] : tx(R.regHint[word][lang], { n: reg.length })}</p>
              {blocked && <p className="sr-hint bad">{A.limitA[lang]}</p>}
              <button type="button" className="sr-link" onClick={() => setStep("none")}>{R.noReg[lang]}</button>
            </div>
          </div>
        )}
        <div className="sr-btns">
          <button type="button" className="sr-btn" onClick={() => void close()}>{A.back[lang]}</button>
          <button type="button" className="sr-btn navy" disabled={step === "none" || !canGo || blocked || (!!rejected && reg === rejected.reg)} onClick={() => setStep("confirm")}>{A.cont[lang]}</button>
        </div>
      </SrDialog>
      <ConfirmRegDialog open={open && step === "confirm"} lang={lang} reg={reg} change={rejected ? changesUsed + 1 : 0} onCancel={() => setStep("q")} onConfirm={() => void check()} />
      <VerifyingDialog open={open && step === "ver"} lang={lang} reg={reg} onCancel={() => setStep("q")} />
      {res?.status === "found" && <FoundDialog open={open && step === "found"} lang={lang} reg={res.reg} co={res.company} noChangeLeft={changesLeft === 0} busy={busy}
        onClose={() => void close()} onNo={() => void (changesLeft === 0 ? close() : no())} onYes={() => void yes()} />}
      <NotFoundDialog open={open && step === "nf"} lang={lang} reg={reg} onEdit={() => setStep("q")} onContact={() => setStep("none")} nfA={A.nfA[lang]} nfB={A.nfB[lang]} />
      <SimpleDialog open={open && step === "limit"} lang={lang} kind="limit" onMain={() => setStep("none")} />
    </>
  );
}
