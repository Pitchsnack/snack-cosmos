import { useEffect, useState } from "react";
import { Loading } from "@/components/ui/PitchSnackLoader";
import { useTranslation } from "@/i18n/language";
import logoBlack from "@/assets/pitchsnack-black.png";

/** Shown at once while a setup wizard's data loads: the wizard frame and title, an empty
 *  step-bar space (so nothing jumps), and the hat after 300 ms (message past 3 s). Never blank. */
export function SetupWizardLoading({ title, error, onRetry }: { title: string; error?: unknown; onRetry?: () => void }) {
  const { language: lang } = useTranslation();
  const L = (en: string, th: string) => (lang === "th" ? th : en);
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (error) return; const t = window.setTimeout(() => setSlow(true), 3000); return () => window.clearTimeout(t); }, [error]);
  return (
    <div className="wiz min-h-screen bg-muted text-foreground" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-border bg-card px-5">
        <img src={logoBlack} alt="PitchSnack" className="h-6 w-auto dark:invert" />
        <span className="h-5 w-px bg-border" />
        <span className="text-[13.5px] font-semibold text-muted-foreground">{title}</span>
      </div>
      <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
        <div aria-hidden className="h-[22px]" />
        <div aria-hidden className="mt-3 h-[34px]" />
        <div className="mt-[22px] rounded-[14px] border border-border bg-card px-[18px] pb-5 pt-6 sm:mt-[34px] sm:rounded-[16px] sm:p-10">
          <div className="grid min-h-[340px] place-items-center">
            {error ? (
              <div className="text-center" role="alert">
                <p className="text-[15px] font-semibold">{L("We couldn't open your profile setup.", "ไม่สามารถเปิดการตั้งค่าโปรไฟล์ได้")}</p>
                {onRetry && <button type="button" onClick={onRetry} className="mt-4 h-[44px] rounded-[12px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground">{L("Try again", "ลองอีกครั้ง")}</button>}
              </div>
            ) : (
              <Loading size="lg" message={slow ? L("Opening your profile setup…", "กำลังเปิดการตั้งค่าโปรไฟล์…") : undefined} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
