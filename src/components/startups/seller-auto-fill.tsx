import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { tr, useTranslation } from "@/i18n/language";
import { normalizeUrl } from "@/lib/seller-wizard";
import { useWebsiteEnrichment } from "@/components/setup/use-website-enrichment";
import { Loading } from "@/components/ui/PitchSnackLoader";

/** Shows the one background website read; finishing never starts a second read. */
export function SellerAutoFill({ id, web, onDone }: { id: string; web: string; onDone: () => void }) {
  const { language } = useTranslation();
  const th = language === "th";
  const L = (en: string, t: string) => (th ? t : en);
  const url = normalizeUrl(web);
  const domain = url.replace(/^https?:\/\//, "").split("/")[0];
  const enrichment = useWebsiteEnrichment("seller", id, web, false);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && enrichment.state.status === "idle" && web.trim()) {
      started.current = true;
      void enrichment.start(web);
    }
  }, [enrichment.state.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = enrichment.state.status === "done" || enrichment.state.status === "failed";
  useEffect(() => { if (done) onDone(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows: [string, string][] = [
    [L("Your website", "เว็บไซต์ของท่าน"), domain],
    [L("Exclusive view", "มุมมองพิเศษ"), L("Company details, description, licences, founders", "ข้อมูลบริษัท คำอธิบาย ใบอนุญาต ผู้ก่อตั้ง")],
    [L("Listing view", "มุมมองรายการ"), L("Anonymous headline, summary and tags", "หัวข้อ สรุป และแท็กแบบไม่ระบุตัวตน")],
  ];
  return (
    <div className="mx-auto max-w-[690px] px-4 pb-16 pt-8 sm:pt-10">
      <div className="rounded-[14px] border border-border bg-card px-6 pb-7 pt-8 sm:px-9 sm:pt-9">
        <h1 className="text-[21px] font-bold sm:text-[24px]" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>
          {!done ? tr("Filling in your profile") : L("Your profile is filled in", "กรอกโปรไฟล์ของท่านแล้ว")}
        </h1>
        <p className="mb-6 mt-1.5 text-[15px] text-muted-foreground">
          {!done ? L(`We're reading ${domain}. This takes a few seconds.`, `กำลังอ่าน ${domain} ใช้เวลาสักครู่`) : L("Check your profile in the next step.", "ตรวจสอบโปรไฟล์ของท่านในขั้นถัดไป")}
        </p>
        {!done && <div className="mb-6 grid min-h-[240px] place-items-center rounded-[12px] bg-muted/60 px-6"><Loading size="lg" message={L(`We're reading ${domain} and public records. This takes a few seconds.`, `กำลังอ่าน ${domain} และข้อมูลสาธารณะ ใช้เวลาสักครู่`)} /></div>}
        <div className="rounded-[12px] border border-border">
          {rows.map(([t, sub]) => (
            <div key={t} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
              {done ? <Check className="h-5 w-5 text-success" /> : <span className="h-5 w-5" aria-hidden />}
              <div className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold">{t}</b><span className="text-[12.5px] text-muted-foreground">{sub}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
