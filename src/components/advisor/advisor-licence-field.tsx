import { useRef } from "react";
import { Landmark } from "lucide-react";
import { useTranslation, tr } from "@/i18n/language";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LICENCE_GROUPS, LICENCES, licenceOf, licenceTaken } from "@/lib/advisor-licences";
import { cn } from "@/lib/utils";

export function AdvisorLicenceField({ row, rows, index, onChange, error, compact }: {
  row: { licenceKey?: string; name: string }; rows: { licenceKey?: string }[]; index: number;
  onChange: (patch: { licenceKey: string; name: string; nameTh?: string; status: string }) => void;
  error?: "choice" | "name"; compact?: boolean;
}) {
  const { language } = useTranslation();
  const thai = language === "th";
  const otherRef = useRef<HTMLInputElement>(null);
  const id = `advisor-licence-${index}`;
  const issuer = licenceOf(row.licenceKey)?.[thai ? 5 : 4];
  const fieldClass = cn("w-full min-w-0 text-[14px]", compact ? "h-[38px]" : "h-[42px]");
  const text = (en: string, th: string) => thai ? th : en;
  return <div className="min-w-0">
    <Label htmlFor={id} className="mb-1.5 block">{tr("Licence or credential")}<span className="ml-1 text-destructive" aria-hidden>*</span></Label>
    <Select value={row.licenceKey ?? ""} onValueChange={key => {
      onChange({ licenceKey: key, name: key === "other" ? (row.licenceKey === "other" ? row.name : "") : licenceOf(key)?.[2] ?? "", nameTh: "", status: "pending" });
      if (key === "other") setTimeout(() => otherRef.current?.focus(), 0);
    }}>
      <SelectTrigger id={id} aria-required aria-invalid={error === "choice" || undefined} aria-describedby={error === "choice" ? `${id}-error` : issuer ? `${id}-issuer` : undefined} className={cn(fieldClass, "bg-background", error === "choice" && "advisor-licence-invalid")}>
        <SelectValue placeholder={text("Choose a licence or credential", "เลือกใบอนุญาตหรือใบรับรอง")} />
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-32px)]">
        {LICENCE_GROUPS.map(g => <SelectGroup key={g[0]}>
          <SelectLabel className="text-xs uppercase text-muted-foreground">{g[thai ? 2 : 1]}</SelectLabel>
          {LICENCES.filter(x => x[0] === g[0]).map(x => {
            const taken = licenceTaken(rows, index, x[1]);
            return <SelectItem key={x[1]} value={x[1]} disabled={taken} className="break-words whitespace-normal">{x[thai ? 3 : 2]}{taken ? text(" · added", " · เพิ่มแล้ว") : ""}</SelectItem>;
          })}
        </SelectGroup>)}
      </SelectContent>
    </Select>
    {error === "choice" && <p id={`${id}-error`} className="advisor-licence-error">{text("Choose a licence or credential.", "กรุณาเลือกใบอนุญาตหรือใบรับรอง")}</p>}
    {issuer && <p id={`${id}-issuer`} className="advisor-licence-issuer"><Landmark size={14} className="advisor-licence-landmark shrink-0" aria-hidden /><span>{issuer}</span></p>}
    {row.licenceKey === "other" && <div className="mt-2.5">
      <Label htmlFor={`${id}-name`} className="mb-1.5 block text-[13.5px] font-medium">{text("Name of the licence or credential", "ชื่อใบอนุญาตหรือใบรับรอง")}<span className="ml-1 text-destructive" aria-hidden>*</span></Label>
      <Input ref={otherRef} id={`${id}-name`} aria-required aria-invalid={error === "name" || undefined} aria-describedby={error === "name" ? `${id}-name-error` : undefined} maxLength={120} className={cn(fieldClass, error === "name" && "advisor-licence-invalid")} placeholder={text("e.g. ACCA", "เช่น ACCA")} value={row.name} onChange={e => onChange({ licenceKey: "other", name: e.target.value, status: "pending" })} />
      {error === "name" && <p id={`${id}-name-error`} className="advisor-licence-error">{text("Write the name of the licence or credential.", "กรุณาพิมพ์ชื่อใบอนุญาตหรือใบรับรอง")}</p>}
    </div>}
  </div>;
}