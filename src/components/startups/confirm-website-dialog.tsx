import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CircleCheck, ExternalLink, Info, Loader2, Lock } from "lucide-react";
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
        <p className="text-[12px] font-bold uppercase tracking-[.06em] text-[#B91C1C] dark:text-red-400">{L("Important", "สำคัญ")}</p>
        <h3 id="cw-t" className="mt-1.5 text-[20px] font-bold" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>
          {hasWeb ? L("Confirm your website", "ยืนยันเว็บไซต์ของท่าน") : L("Continue without a website?", "ไปต่อโดยไม่มีเว็บไซต์ใช่ไหม")}
        </h3>
        <p id="cw-d" className="mt-2 text-[14.5px] leading-[1.55] text-[#434A5C] dark:text-muted-foreground">
          {hasWeb
            ? L("Auto-fill reads it to pre-fill your company description and corporate information. If it's wrong, correct it here.", "ระบบกรอกข้อมูลอัตโนมัติจะอ่านเว็บไซต์นี้ เพื่อกรอกคำอธิบายบริษัทและข้อมูลบริษัทให้ หากไม่ถูกต้อง แก้ไขได้ที่นี่")
            : L("Auto-fill needs your website to pre-fill your company description and corporate information. Without it, you'll fill them in yourself.", "ระบบกรอกข้อมูลอัตโนมัติต้องใช้เว็บไซต์ของท่าน เพื่อกรอกคำอธิบายบริษัทและข้อมูลบริษัทให้ หากไม่มีเว็บไซต์ ท่านจะต้องกรอกเอง")}
        </p>
        <div className="relative mt-[18px]">
          <input id="cw-web" ref={inputRef} value={val} maxLength={2048} placeholder="www.yourcompany.com"
            aria-labelledby="cw-t" aria-describedby="cw-ans" aria-invalid={err || undefined}
            onChange={(e) => { setVal(e.target.value); setErr(false); setAnswer(null); setChecking(false); run.current++; }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            className={`h-[52px] w-full rounded-[12px] border bg-white pl-4 pr-[100px] text-[17px] text-[#1D4ED8] no-underline outline-none placeholder:text-[#9CA3AF] sm:pr-[160px] dark:bg-background dark:text-[#93C5FD] ${err ? "border-[#B42318] ring-2 ring-[#B42318]/20" : "border-[#DCDFE5] focus:border-[#1e2a4a] focus:ring-2 focus:ring-[#1e2a4a]/15 dark:border-border"}`} />
          <button type="button" onClick={doCheck} aria-disabled={!valid || checking ? "true" : undefined}
            aria-label={checking ? L("Checking…", "กำลังตรวจสอบ…") : L("Check website (opens in a new tab)", "ตรวจสอบเว็บไซต์ (เปิดในแท็บใหม่)")}
            className={`absolute right-2 top-1/2 inline-flex h-9 -translate-y-1/2 items-center gap-1.5 rounded-[9px] border border-[#DCDFE5] bg-white px-3 text-[13.5px] font-semibold dark:border-border dark:bg-transparent ${valid ? "text-[#1E2A4A] hover:bg-[#F3F5F9] dark:text-foreground dark:hover:bg-muted" : "cursor-not-allowed text-[#9CA3AF]"}`}>
            {checking ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <ExternalLink className="h-[15px] w-[15px]" />}
            <span className={checking ? "max-sm:hidden" : ""}>
              {checking ? L("Checking…", "กำลังตรวจสอบ…") : <><span className="max-sm:hidden">{L("Check website", "ตรวจสอบเว็บไซต์")}</span><span className="sm:hidden">{L("Check", "ตรวจสอบ")}</span></>}
            </span>
          </button>
        </div>
        <div id="cw-ans" aria-live="polite" className="text-[13.5px] leading-[1.45]">
          {err ? <p className="mt-2 text-[#B42318] dark:text-red-400">{L("Enter a valid website address, e.g. www.yourcompany.com", "กรุณากรอกที่อยู่เว็บไซต์ที่ถูกต้อง เช่น www.yourcompany.com")}</p>
          : answer?.kind === "working" ? (
            <p className="mt-2 flex items-start gap-1.5 font-semibold text-[#15803D] dark:text-emerald-400"><CircleCheck className="mt-px h-4 w-4 shrink-0" />
              {answer.title ? L(`Website is working: ${answer.title}`, `เว็บไซต์ใช้งานได้: ${answer.title}`) : L("Website is working", "เว็บไซต์ใช้งานได้")}</p>
          ) : answer?.kind === "not_working" ? (
            <p className="mt-2 flex items-start gap-1.5 font-medium text-[#B45309] dark:text-amber-400"><AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              {L("We couldn't open this website. Check that the address is right.", "เปิดเว็บไซต์นี้ไม่ได้ ตรวจสอบว่าที่อยู่ถูกต้อง")}</p>
          ) : answer?.kind === "unchecked" ? (
            <p className="mt-2 flex items-start gap-1.5 font-medium text-[#6B7280] dark:text-muted-foreground"><Info className="mt-px h-4 w-4 shrink-0" />
              {L("We couldn't check the website right now. You can still continue.", "ตรวจสอบเว็บไซต์ไม่ได้ในขณะนี้ ท่านยังไปต่อได้")}</p>
          ) : !hasWeb ? (
            <p className="mt-2 flex items-start gap-1.5 text-[#434A5C] dark:text-muted-foreground"><Lock className="mt-px h-4 w-4 shrink-0" />{L("Buyers can't see your website until you approve their NDA.", "ผู้ซื้อจะไม่เห็นเว็บไซต์ของท่าน จนกว่าท่านจะอนุมัติ NDA ของผู้ซื้อ")}</p>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2.5 max-[599px]:flex-col-reverse">
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
