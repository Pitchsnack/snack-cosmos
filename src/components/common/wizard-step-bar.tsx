import { StepBar, MissedNote, type StepItem } from "./step-bar";
import { useTranslation } from "@/i18n/language";

/** Role wizards adapt their own validation into the seller's shared presentation. */
export function WizardStepBar({ steps, lineTo, onPick }: { steps: StepItem[]; lineTo: number; onPick: (key: string) => void }) {
  const th = useTranslation().language === "th";
  const L = (en: string, thai: string) => th ? thai : en;
  const missed = steps.flatMap((s, i) => s.state === "missed" ? [{ key: s.key, n: i + 1, full: s.full }] : []);
  return <div className="mt-[18px]">
    <StepBar missedIcon steps={steps} lineTo={lineTo} onPick={onPick} label={L("Setup steps", "ขั้นตอนการตั้งค่า")}
      stepWord={(n) => L(`Step ${n}`, `ขั้นที่ ${n}`)} missedWord={L("Not answered", "ยังไม่ได้ตอบ")} />
    <MissedNote missed={missed} onPick={onPick} answerNow={L("Answer now", "ตอบเลย")}
      desktop={L(missed.length === 1 ? "1 question not answered. Click the red step to answer it." : `${missed.length} questions not answered. Click a red step to answer it.`, `มี ${missed.length} คำถามที่ยังไม่ได้ตอบ กดวงกลมสีแดงเพื่อตอบ`)}
      row={(n, full) => L(`Step ${n} · ${full}`, `ขั้นที่ ${n} · ${full}`)} />
  </div>;
}