import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ExternalLink, Globe, Info, Loader2, Lock } from "lucide-react";
import { checkWebsiteReachable } from "@/lib/website-check.functions";
import { isValidUrl, normalizeUrl } from "@/lib/seller-wizard";

type Answer = { kind: "working"; title: string | null } | { kind: "not_working" } | { kind: "unchecked" } | null;
const bare = (u: string) => u.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");

/**
 * "Continue to auto-fill" pop-up: confirm the website auto-fill will read, or warn when there's none.
 * onDone(url) runs with a valid website, or with "" for Continue without website.
 */
export function ConfirmWebsiteDialog({ initial, L, onCancel, onDone }: {
  initial: string;
  L: (en: string, th: string) => string;
  onCancel: () => void;
  onDone: (url: string) => void;
}) {
  const hasWeb = !!initial.trim();
  const [val, setVal] = useState(bare(initial));
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const run = useRef(0);
  const check = useServerFn(checkWebsiteReachable);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const valid = isValidUrl(val);

  useEffect(() => {
    window.setTimeout(() => (hasWeb ? primaryRef.current : inputRef.current)?.focus(), 30);
    return () => { run.current++; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function doCheck() {
    if (!valid || checking) return;
    const url = normalizeUrl(val);
    window.open(url, "_blank", "noopener,noreferrer");
    const id = ++run.current;
    setChecking(true); setAnswer(null);
    const timeout = new Promise<null>((r) => window.setTimeout(() => r(null), 15000));
    Promise.race([check({ data: { url } }), timeout])
      .then((r) => {
        if (id !== run.current) return;
        setAnswer(!r || r.status === "unchecked" ? { kind: "unchecked" } : r.status === "working" ? { kind: "working", title: r.title } : { kind: "not_working" });
      })
      .catch(() => { if (id === run.current) setAnswer({ kind: "unchecked" }); })
      .finally(() => { if (id === run.current) setChecking(false); });
  }
  function submit() {
    if (!valid) { setErr(true); inputRef.current?.focus(); return; }
    onDone(normalizeUrl(val));
  }

  const btn2 = "h-11 rounded-[10px] border border-[#DCDFE5] bg-white px-4 font-semibold text-[#374151] dark:border-border dark:bg-transparent dark:text-foreground";
  const btn1 = "h-11 rounded-[10px] bg-[#1e2a4a] px-4 font-semibold text-white";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,24,39,.45)] p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="cw-t" aria-describedby="cw-d"
        className="w-full max-w-[520px] rounded-[16px] bg-white p-6 shadow-xl dark:bg-card" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
          if (e.key === "Tab") {
            const f = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input,button"));
            const i = f.indexOf(document.activeElement as HTMLElement);
            e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length]?.focus();
          }
        }}>
        {hasWeb ? (
          <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#F4F9FF] dark:bg-[#16283A]"><Globe className="h-[22px] w-[22px] text-[#2563EB] dark:text-[#8CBFF0]" /></span>
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#FEF3C7] dark:bg-amber-950"><AlertTriangle className="h-[22px] w-[22px] text-[#B45309] dark:text-amber-400" /></span>
        )}
        <h3 id="cw-t" className="mt-3.5 text-[20px] font-bold" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>
          {hasWeb ? L("Confirm your website", "ยืนยันเว็บไซต์ของท่าน") : L("Continue without a website?", "ไปต่อโดยไม่มีเว็บไซต์ใช่ไหม")}
        </h3>
        <p id="cw-d" className="mt-2 text-[14.5px] leading-[1.55] text-[#434A5C] dark:text-muted-foreground">
          {hasWeb
            ? L("Auto-fill reads this website to pre-fill your company description and corporate information. If it's wrong, that information won't be pre-filled.", "ระบบกรอกข้อมูลอัตโนมัติจะอ่านเว็บไซต์นี้เพื่อกรอกคำอธิบายบริษัทและข้อมูลบริษัทให้ล่วงหน้า หากเว็บไซต์ไม่ถูกต้อง ข้อมูลเหล่านี้จะไม่ถูกกรอกให้")
            : L("Auto-fill needs your website to pre-fill your company description and corporate information. Without it, they won't be pre-filled, and you'll fill them in yourself.", "ระบบกรอกข้อมูลอัตโนมัติต้องใช้เว็บไซต์ของท่านเพื่อกรอกคำอธิบายบริษัทและข้อมูลบริษัทให้ล่วงหน้า หากไม่มีเว็บไซต์ ข้อมูลเหล่านี้จะไม่ถูกกรอกให้ และท่านจะต้องกรอกเอง")}
        </p>
        <label htmlFor="cw-web" className="mt-4 mb-1.5 block text-[14px] font-semibold text-[#374151] dark:text-foreground">{L("Company website", "เว็บไซต์บริษัท")}</label>
        <div className="relative">
          <input id="cw-web" ref={inputRef} value={val} maxLength={2048} placeholder="www.yourcompany.com"
            aria-describedby="cw-ans" aria-invalid={err || undefined}
            onChange={(e) => { setVal(e.target.value); setErr(false); setAnswer(null); setChecking(false); run.current++; }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            className={`h-11 w-full rounded-[10px] border bg-white pl-3 pr-[112px] text-[15px] outline-none sm:pr-[170px] dark:bg-background ${err ? "border-[#B42318]" : "border-[#DCDFE5] focus:border-[#1e2a4a] dark:border-border"}`} />
          <button type="button" onClick={doCheck} aria-disabled={!valid || checking ? "true" : undefined}
            aria-label={checking ? L("Checking…", "กำลังตรวจสอบ…") : L("Check website (opens in a new tab)", "ตรวจสอบเว็บไซต์ (เปิดในแท็บใหม่)")}
            className={`absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-[8px] border border-[#DCDFE5] bg-white px-3 text-[13.5px] font-semibold dark:border-border dark:bg-transparent ${valid ? "text-[#1E2A4A] hover:bg-[#F3F5F9] dark:text-foreground dark:hover:bg-muted" : "cursor-not-allowed text-[#9CA3AF]"}`}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            <span className={checking ? "max-sm:hidden" : ""}>
              {checking ? L("Checking…", "กำลังตรวจสอบ…") : <><span className="max-sm:hidden">{L("Check website", "ตรวจสอบเว็บไซต์")}</span><span className="sm:hidden">{L("Check", "ตรวจสอบ")}</span></>}
            </span>
          </button>
        </div>
        <div id="cw-ans" aria-live="polite" className="text-[13px] leading-[1.45]">
          {err && <p className="mt-1.5 text-[#B42318]">{L("Enter a valid website address, e.g. www.yourcompany.com", "กรุณากรอกที่อยู่เว็บไซต์ที่ถูกต้อง เช่น www.yourcompany.com")}</p>}
          {answer?.kind === "working" && (
            <p className="mt-1.5 flex items-start gap-1.5 font-semibold text-[#15803D] dark:text-emerald-400"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {answer.title ? L(`Website is working: ${answer.title}`, `เว็บไซต์ใช้งานได้: ${answer.title}`) : L("Website is working", "เว็บไซต์ใช้งานได้")}</p>
          )}
          {answer?.kind === "not_working" && (
            <p className="mt-1.5 flex items-start gap-1.5 font-medium text-[#B45309] dark:text-amber-400"><AlertTriangle className="mt-0.5 h-[15px] w-[15px] shrink-0" />
              {L(`We couldn't open ${bare(val)}. Check the address. If it's right, you can still continue.`, `เปิด ${bare(val)} ไม่ได้ ตรวจสอบที่อยู่อีกครั้ง หากถูกต้องแล้ว ท่านยังไปต่อได้`)}</p>
          )}
          {answer?.kind === "unchecked" && (
            <p className="mt-1.5 flex items-start gap-1.5 font-medium text-[#6B7280] dark:text-muted-foreground"><Info className="mt-0.5 h-[15px] w-[15px] shrink-0" />
              {L("We couldn't check the website right now. You can still continue.", "ตรวจสอบเว็บไซต์ไม่ได้ในขณะนี้ ท่านยังไปต่อได้")}</p>
          )}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[13px] text-[#434A5C] dark:text-muted-foreground"><Lock className="mt-0.5 h-[15px] w-[15px] shrink-0" />{L("Buyers can't see your website until you approve their NDA.", "ผู้ซื้อจะไม่เห็นเว็บไซต์ของท่าน จนกว่าท่านจะอนุมัติ NDA ของผู้ซื้อ")}</p>
        <div className="mt-[22px] flex justify-end gap-2.5 max-[599px]:flex-col-reverse">
          {hasWeb ? (
            <>
              <button type="button" onClick={onCancel} className={btn2}>{L("Cancel", "ยกเลิก")}</button>
              <button type="button" ref={primaryRef} onClick={submit} className={btn1}>{L("Confirm and continue", "ยืนยันและไปต่อ")}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onDone("")} className={btn2}>{L("Continue without website", "ไปต่อโดยไม่มีเว็บไซต์")}</button>
              <button type="button" ref={primaryRef} onClick={submit} className={btn1}>{L("Add website and continue", "เพิ่มเว็บไซต์และไปต่อ")}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
