import { CircleCheck } from "lucide-react";

/** Green box over fields the website read filled in. */
export function FilledFrom({ domain, L }: { domain: string; L: (en: string, th: string) => string }) {
  return (
    <p className="mb-[26px] flex items-start gap-2 rounded-[12px] border border-[var(--seller-strength-success-ink)]/30 bg-[var(--seller-strength-success-bg)] px-4 py-3 text-[14px] text-[var(--seller-strength-success-ink)]">
      <CircleCheck className="mt-[2px] h-4 w-4 flex-none" />
      {L(`We filled these in from ${domain}. Check them and change anything.`, `เรากรอกข้อมูลเหล่านี้จาก ${domain} แล้ว กรุณาตรวจสอบและแก้ไขได้ตามต้องการ`)}
    </p>
  );
}
