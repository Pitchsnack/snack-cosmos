import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

export type ContactPersonValue = { name: string; position: string; email: string; phone: string };

/** The shared two-row contact-person layout used by all three setup wizards. */
export function ContactPersonFields({
  value, onChange, idPrefix, phoneRequired = false, errors = {}, inputClassName, positionControl, contact = true,
}: {
  value: ContactPersonValue;
  onChange: (key: keyof ContactPersonValue, value: string) => void;
  idPrefix: string;
  phoneRequired?: boolean;
  errors?: Partial<Record<keyof ContactPersonValue, boolean>>;
  inputClassName?: string;
  /** The founder keeps its existing multi-position dropdown. */
  positionControl?: React.ReactNode;
  /** False hides Email address and Phone (e.g. founders after the first). */
  contact?: boolean;
}) {
  const { language } = useTranslation();
  const L = (en: string, th: string) => language === "th" ? th : en;
  const Req = () => <span aria-hidden className="ml-1 text-destructive">*</span>;
  const Optional = () => <span className="ml-1.5 font-normal text-muted-foreground">{L("(optional)", "(ไม่บังคับ)")}</span>;
  const label = "mb-1.5 block text-sm font-semibold text-foreground";
  const input = cn("h-[50px] w-full rounded-[12px] border border-input bg-background px-3.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20", inputClassName);
  const field = (key: keyof ContactPersonValue, text: string, control: React.ReactNode) => (
    <div>
      <label className={label} htmlFor={`${idPrefix}-${key}`}>{text}{key === "name" || key === "email" || key === "phone" && phoneRequired ? <Req /> : <Optional />}</label>
      {control}
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("name", L("Full name", "ชื่อ-นามสกุล"), <input id={`${idPrefix}-name`} data-contact-name aria-required aria-invalid={errors.name || undefined} maxLength={120} className={cn(input, errors.name && "border-destructive")} value={value.name} onChange={(e) => onChange("name", e.target.value)} />)}
      {field("position", L("Current Position", "ตำแหน่งปัจจุบัน"), positionControl ?? <input id={`${idPrefix}-position`} maxLength={120} className={input} value={value.position} onChange={(e) => onChange("position", e.target.value)} />)}
      {contact && field("email", L("Email address", "อีเมล"), <input id={`${idPrefix}-email`} aria-required aria-invalid={errors.email || undefined} type="email" maxLength={200} className={cn(input, errors.email && "border-destructive")} value={value.email} onChange={(e) => onChange("email", e.target.value)} />)}
      {contact && field("phone", L("Phone", "เบอร์โทรศัพท์"), <input id={`${idPrefix}-phone`} aria-required={phoneRequired} aria-invalid={errors.phone || undefined} maxLength={60} className={cn(input, errors.phone && "border-destructive")} value={value.phone} onChange={(e) => onChange("phone", e.target.value)} />)}
    </div>
  );
}
