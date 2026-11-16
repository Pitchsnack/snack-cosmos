import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck, Info, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/i18n/language";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** One note at the top of the identity section: amber before the DBD check, green once locked, blue for Admin. */
export function IdentityLockNote({ lockedAt, adminEdit }: { lockedAt?: string | null; adminEdit?: boolean }) {
  const th = useTranslation().language === "th";
  if (adminEdit) {
    if (!lockedAt) return null;
    return <Note tone="info" icon={<Info size={16} />}>{th ? "คุณกำลังแก้ไขในฐานะผู้ดูแลระบบ คุณแก้ไขข้อมูลที่ล็อกไว้ได้ ทุกการเปลี่ยนแปลงจะถูกบันทึกพร้อมชื่อและวันที่" : "You're editing as Admin. You can change the locked details. Every change is recorded with your name and the date."}</Note>;
  }
  if (!lockedAt) return <Note tone="warning" icon={<AlertTriangle size={16} />}>{th ? "โปรดตรวจสอบเลขทะเบียนนิติบุคคล ชื่อบริษัท และปีที่ก่อตั้งให้ถูกต้อง ข้อมูลเหล่านี้จะถูกล็อกเมื่อยืนยันกับข้อมูล DBD แล้ว" : "Check the registration number, company name and year founded carefully. They lock once they're confirmed with the DBD record."}</Note>;
  return <Note tone="success" icon={<ShieldCheck size={16} />}>
    {th ? "ข้อมูลเหล่านี้ยืนยันกับข้อมูลทางการของกรมพัฒนาธุรกิจการค้า (DBD) แล้ว จึงถูกล็อกไว้ แก้ไขได้โดยผู้ดูแลระบบ PitchSnack เท่านั้น" : "These details are confirmed with the official DBD record, so they're locked. Only PitchSnack Admin can change them."}{" "}
    <Link to="/contact" target="_blank" className="font-semibold underline">{th ? "ต้องการแก้ไข? ติดต่อ PitchSnack" : "Need a correction? Contact PitchSnack"}</Link>
  </Note>;
}

const TONES = {
  warning: "border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning",
  success: "border-success/40 bg-success/10 text-foreground [&>svg]:text-success",
  info: "border-info/40 bg-info/10 text-foreground [&>svg]:text-info",
} as const;

function Note({ tone, icon, children }: { tone: keyof typeof TONES; icon: ReactNode; children: ReactNode }) {
  return <div role="note" data-identity-note={tone} className={cn("identity-lock-note flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px] leading-snug", TONES[tone])}>
    {icon}<p className="min-w-0">{children}</p>
  </div>;
}

/** Small green tag beside a locked field's label. */
export function FromDbdTag({ show }: { show: boolean }) {
  const th = useTranslation().language === "th";
  if (!show) return null;
  return <span data-from-dbd className="ml-1.5 rounded bg-success/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-success">{th ? "จาก DBD" : "From DBD"}</span>;
}

/** The editable input, or a read-only grey copy with the lock icon once locked. */
export function LockableInput({ locked, className, onChange, onBlur, ...props }: React.ComponentProps<typeof Input> & { locked: boolean }) {
  if (!locked) return <Input className={className} onChange={onChange} onBlur={onBlur} {...props} />;
  return <div className="relative">
    <Input {...props} readOnly aria-readonly="true" tabIndex={0} className={cn(className, "cursor-not-allowed bg-muted/50 pr-[42px]")} />
    <Lock size={16} aria-hidden="true" className="pointer-events-none absolute right-[15px] top-1/2 -translate-y-1/2 text-muted-foreground" />
  </div>;
}

/** For raw wizard inputs: wraps the box and adds the lock icon once locked. */
export function LockWrap({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return <div className="relative">{children}<Lock size={16} aria-hidden="true" className="pointer-events-none absolute right-[15px] top-1/2 -translate-y-1/2 text-muted-foreground" /></div>;
}
export const LOCKED_INPUT = "cursor-not-allowed !bg-muted/50 pr-[42px]";
