import { useId } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "@/i18n/language";
import { useTextLang } from "./text-lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanyNameFields({ name, nameLabel, thaiName, englishName, onThaiName, onEnglishName, onChangeCompany }: {
  name: string; nameLabel: string; thaiName: string; englishName: string;
  onThaiName: (name: string) => void; onEnglishName: (name: string) => void; onChangeCompany: () => void;
}) {
  const id = useId();
  const { language } = useTranslation();
  const { lang } = useTextLang();
  const thai = language === "th";
  const english = lang === "th";
  return <div className="company-name-fields grid min-w-0 grid-cols-1 gap-4 min-[641px]:grid-cols-2">
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Label htmlFor={`${id}-legal`}>{thai ? "ชื่อนิติบุคคล" : "Legal name (Eng)"}<span className="ml-1 text-destructive">*</span></Label>
        <Button type="button" variant="unstyled" size="unstyled" className="text-xs font-medium text-link hover:underline" onClick={onChangeCompany}>
          {thai ? "แก้ไขในแท็บเกี่ยวกับบริษัท" : "Change in About Company"}
        </Button>
      </div>
      <div className="relative">
        <Input id={`${id}-legal`} value={name} readOnly aria-readonly="true" aria-describedby={`${id}-help`} className="company-name-copy cursor-not-allowed pr-[42px]" />
        <Lock size={16} aria-hidden="true" className="company-name-lock pointer-events-none absolute right-[15px] top-1/2 -translate-y-1/2" />
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{thai ? "คัดลอกมาจากชื่อบริษัทในแท็บเกี่ยวกับบริษัท แก้ไขได้ที่แท็บนั้นเท่านั้น" : `Copied from ${nameLabel} in About Company. Change it there.`}</p>
    </div>
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={`${id}-other`}>{english ? "English Name" : thai ? "ชื่อภาษาไทย" : "Thai Name"}<span className="ml-1.5 font-normal text-muted-foreground">{thai ? "ไม่บังคับ" : "optional"}</span></Label>
      <Input id={`${id}-other`} lang={english ? "en" : "th"} maxLength={200} value={english ? englishName : thaiName} onChange={(e) => (english ? onEnglishName : onThaiName)(e.target.value)} placeholder={english ? (thai ? "เช่น ABC Trading Co., Ltd." : "e.g. ABC Trading Co., Ltd.") : "บริษัท ... จำกัด"} />
      <p className="text-xs text-muted-foreground">{english ? (thai ? "ชื่อบริษัทเป็นภาษาอังกฤษ หากต้องการเพิ่ม" : "Your company name in English, if you'd like to add it.") : (thai ? "ชื่อตามที่จดทะเบียนเป็นภาษาไทย หากต้องการเพิ่ม" : "As registered in Thai, if you'd like to add it.")}</p>
    </div>
  </div>;
}