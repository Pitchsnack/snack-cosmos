import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { tr, useTranslation } from "@/i18n/language";
import { enrichStartupFromUrl } from "@/lib/auto-enrich/auto-enrich.functions";
import { applySellerEnrich } from "@/lib/seller-setup.functions";
import { normalizeUrl } from "@/lib/seller-wizard";

/** Seller wizard's Auto Enrich step: reads the website, fills empty Private fields and drafts the Public headline. */
export function SellerAutoFill({ id, web, onDone }: { id: string; web: string; onDone: () => void }) {
  const { language } = useTranslation();
  const th = language === "th";
  const L = (en: string, t: string) => (th ? t : en);
  const read = useServerFn(enrichStartupFromUrl);
  const apply = useServerFn(applySellerEnrich);
  const [state, setState] = useState<"running" | "done" | "failed">("running");
  const [found, setFound] = useState(0);
  const started = useRef(false);
  const url = normalizeUrl(web);
  const domain = url.replace(/^https?:\/\//, "").split("/")[0];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const r = await read({ data: { websiteUrl: url } });
        const { _debug, ...rest } = r as Record<string, unknown>;
        void _debug;
        const res = await apply({ data: { id, r: rest as never } });
        setFound(res.found);
        setState("done");
      } catch {
        setState("failed");
      }
    })();
  }, [id, url, read, apply]);

  const done = state !== "running";
  const rows: [string, string][] = [
    [L("Your website", "เว็บไซต์ของท่าน"), domain],
    [L("Exclusive view", "มุมมองพิเศษ"), L("Company details, description, licences, founders", "ข้อมูลบริษัท คำอธิบาย ใบอนุญาต ผู้ก่อตั้ง")],
    [L("Listed view", "มุมมองที่ประกาศ"), L("Anonymous headline, summary and tags", "หัวข้อ สรุป และแท็กแบบไม่ระบุตัวตน")],
  ];
  return (
    <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
      <div className="rounded-[14px] border border-[#e5e7eb] bg-white px-6 pb-7 pt-8 sm:px-9 sm:pt-9 dark:border-border dark:bg-card">
        <h1 className="text-[21px] font-bold sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>
          {!done ? tr("Filling in your profile") : state === "failed" ? L("We couldn't read your website", "อ่านเว็บไซต์ของท่านไม่ได้") : L("Your profile is filled in", "กรอกโปรไฟล์ของท่านแล้ว")}
        </h1>
        <p className="mb-6 mt-1.5 text-[15px] text-[#6B7280]">
          {!done
            ? L(`We're reading ${domain}. This takes a few seconds.`, `กำลังอ่าน ${domain} ใช้เวลาสักครู่`)
            : state === "failed"
              ? L("You can fill in the details yourself in the next step.", "ท่านกรอกข้อมูลเองได้ในขั้นถัดไป")
              : found
                ? L(`We added ${found} detail${found === 1 ? "" : "s"}. Check them in the next step.`, `เพิ่มข้อมูล ${found} รายการ ตรวจสอบได้ในขั้นถัดไป`)
                : tr("Nothing new to add. Check your profile in the next step.")}
        </p>
        <div className="rounded-[12px] border border-[#E9EBF0] dark:border-border">
          {rows.map(([t, sub]) => (
            <div key={t} className="flex items-center gap-3 border-b border-[#F0F1F4] px-4 py-3 last:border-0 dark:border-border">
              {done ? <Check className="h-5 w-5 text-[#15803D]" /> : <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />}
              <div className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold">{t}</b><span className="text-[12.5px] text-[#6B7280]">{sub}</span></div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-end">
          <button type="button" disabled={!done} onClick={onDone}
            className="rounded-[10px] bg-[#1e2a4a] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c9ced9]">
            {tr("Review & complete")}
          </button>
        </div>
      </div>
    </div>
  );
}
