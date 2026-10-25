import { Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/i18n/language";

/** Company Type values; "Startup" stays hidden until the startup part opens. */
export const COMPANY_TYPE_VALUES = ["SME", "Corporate Enterprise", "Individual"] as const;
export type CompanyType = (typeof COMPANY_TYPE_VALUES)[number];

/** The account rule: seller → SME; buyer corporate/agent → Corporate Enterprise; individual → Individual. */
export function companyTypeForRelation(rel: string | null | undefined): CompanyType | null {
  if (rel === "individual") return "Individual";
  if (rel === "corporate" || rel === "agent") return "Corporate Enterprise";
  return null;
}

/** Locked box for users; dropdown + "Reset to account type" for Admin. */
export function CompanyTypeField({ value, source, admin, onChange, onReset }: {
  value: string | null; source: string; admin: boolean;
  onChange?: (v: CompanyType) => void; onReset?: () => void;
}) {
  const { language } = useTranslation();
  const th = language === "th";
  const label = (v: string) => (th && v === "Individual" ? "บุคคลธรรมดา" : v);
  const fromAdmin = source === "admin";
  return (
    <div className="space-y-1.5">
      <Label>{th ? "ประเภทบริษัท" : "Company Type"}</Label>
      {admin ? (
        <>
          <Select value={value ?? ""} onValueChange={(v) => onChange?.(v as CompanyType)}>
            <SelectTrigger><SelectValue placeholder={th ? "เลือกประเภทบริษัท" : "Choose a company type"} /></SelectTrigger>
            <SelectContent>
              {COMPANY_TYPE_VALUES.map((v) => <SelectItem key={v} value={v}>{label(v)}</SelectItem>)}
            </SelectContent>
          </Select>
          {fromAdmin && (
            <p className="text-xs text-muted-foreground">
              {th ? "แก้ไขโดย Admin · " : "Changed by Admin · "}
              <button type="button" className="font-semibold underline" onClick={onReset}>{th ? "คืนค่าตามประเภทบัญชี" : "Reset to account type"}</button>
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex h-10 items-center justify-between rounded-md border border-[#E5E7EB] bg-[#F7F8FA] px-3 text-sm dark:border-border dark:bg-muted">
            <span>{value ? label(value) : "—"}</span><Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-xs text-[#6B7280]">{fromAdmin ? (th ? "กำหนดโดย PitchSnack" : "Set by PitchSnack") : (th ? "กำหนดจากประเภทบัญชีของท่าน" : "Set from your account type")}</p>
        </>
      )}
    </div>
  );
}
