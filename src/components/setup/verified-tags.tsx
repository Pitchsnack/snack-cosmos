import { useTranslation } from "@/i18n/language";

/** Review-step tags for facts confirmed by the company check (+ Add or sign-up). */
export function VerifiedTag() {
  const th = useTranslation().language === "th";
  return <span className="ml-2 inline-block rounded bg-success/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-success">✓ {th ? "ยืนยันแล้ว" : "Verified"}</span>;
}
export function LockedTag() {
  const th = useTranslation().language === "th";
  return <span className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">🔒 {th ? "ล็อกแล้ว" : "Locked"}</span>;
}
export function RegisteredAddrNote() {
  const th = useTranslation().language === "th";
  return <span className="mt-1 block text-[12.5px] font-normal text-muted-foreground">{th ? "ที่อยู่ที่จดทะเบียน ท่านแก้ไขได้ภายหลังใน Edit information" : "The registered address. You can change it later in Edit information."}</span>;
}
/** Wraps a Review value with its check tag when the fact came from the company check. */
export function checked(v: React.ReactNode, fs: string[] | undefined, key: "name" | "year" | "address" | "reg") {
  if (!fs?.includes(key) || !v) return v;
  return <>{v}{key === "reg" ? <LockedTag /> : <VerifiedTag />}{key === "address" && <RegisteredAddrNote />}</>;
}
