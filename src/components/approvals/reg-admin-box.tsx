import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminChangeRegistration, getRegReview } from "@/lib/reg-admin.functions";
import { useTranslation } from "@/i18n/language";

const GREY = "border-border bg-muted text-muted-foreground";
const RESULT: Record<string, { en: string; th: string; cls: string }> = {
  yes: { en: "Yes, this is my company", th: "ใช่ นี่คือบริษัทของฉัน", cls: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  no: { en: "No, not theirs", th: "ไม่ใช่บริษัทของผู้ใช้", cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  not_found: { en: "Not found", th: "ไม่พบบริษัท", cls: GREY }, limit: { en: "Too many checks", th: "ตรวจสอบเกินจำนวนครั้งที่กำหนด", cls: GREY },
  cancelled: { en: "Cancelled", th: "ยกเลิก", cls: GREY }, pending: { en: "Cancelled", th: "ยกเลิก", cls: GREY },
};

/** Admin review: the registration number (locked for users), duplicates on other accounts, and Change registration number. */
export function RegAdminBox({ kind, id, onChanged }: { kind: "seller" | "buyer" | "advisor"; id: string; onChanged?: () => void }) {
  const { t, language } = useTranslation();
  const L = (en: string, th: string) => (language === "th" ? th : en);
  const get = useServerFn(getRegReview);
  const change = useServerFn(adminChangeRegistration);
  const qc = useQueryClient();
  const key = ["reg-review", kind, id];
  const { data } = useQuery({ queryKey: key, queryFn: () => get({ data: { kind, id } }) });
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return null;
  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await change({ data: { kind, id, reg: val } });
      if (!r.ok) setErr(r.error); else { setOpen(false); setVal(""); await qc.invalidateQueries({ queryKey: key }); onChanged?.(); }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="mb-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t("Registration number")}</span>
        <b>{data.reg || t("Not added")}</b>
        {data.locked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock size={12} />{t("Locked for the user")}</span>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setOpen((o) => !o)}>{t("Change registration number")}</Button>
      </div>
      {data.duplicates.map((d) => (
        <p key={d.kind + d.id} className="mt-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><TriangleAlert size={14} />
          {t("Registration number also used by")}{" "}
          <a className="underline" href={d.kind === "seller" ? `/startups/${d.id}` : d.kind === "buyer" ? `/marketplace/investors?open=${d.id}` : `/marketplace/advisors?open=${d.id}`}>{d.ref}</a>
        </p>
      ))}
      <div className="mt-3 border-t pt-3">
        <p className="font-semibold">{L("Numbers tried", "เลขทะเบียนที่ลองกรอก")}</p>
        <p className="text-xs text-muted-foreground">{L("Every registration number entered at sign-up or in + Add, oldest first.", "เลขทะเบียนทั้งหมดที่กรอกตอนสมัครหรือตอนเพิ่มโปรไฟล์ เรียงจากเก่าไปใหม่")}</p>
        {data.tried.length === 0 ? <p className="mt-2 text-muted-foreground">{L("No numbers saved.", "ยังไม่มีเลขทะเบียนที่บันทึกไว้")}</p> : (
          <table className="mt-2 w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase text-muted-foreground"><tr>
              <th className="py-1 pr-3 font-medium">{L("Number", "เลขทะเบียน")}</th><th className="py-1 pr-3 font-medium">{L("Company found", "บริษัทที่พบ")}</th>
              <th className="py-1 pr-3 font-medium">{L("Result", "ผลลัพธ์")}</th><th className="py-1 font-medium">{L("When", "เวลา")}</th></tr></thead>
            <tbody>{(data.tried as { reg: string; company: string | null; result: string; at: string }[]).map((x, i) => {
              const r = RESULT[x.result] ?? RESULT.cancelled!;
              return <tr key={i} className="border-t"><td className="py-1.5 pr-3 tabular-nums">{x.reg}</td><td className="py-1.5 pr-3">{x.company ?? "—"}</td>
                <td className="py-1.5 pr-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${r.cls}`}>{L(r.en, r.th)}</span></td>
                <td className="py-1.5 whitespace-nowrap text-muted-foreground">{new Date(x.at).toLocaleString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}</td></tr>;
            })}</tbody>
          </table>
        )}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <Input aria-label={t("New registration number")} inputMode="numeric" maxLength={13} className="w-48" value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 13))} placeholder={t("13 digits")} />
          <Button size="sm" disabled={busy || val.length !== 13} onClick={() => void save()}>{busy ? t("Saving…") : t("Check and save")}</Button>
          {err && <p className="w-full text-destructive">{t(err)}</p>}
        </div>
      )}
    </div>
  );
}
