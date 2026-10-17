import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Eye, Lock, Pencil } from "lucide-react";
import { myHandover, setPartCheck, submitHandover } from "@/lib/profile-handover.functions";
import { submitListing } from "@/lib/approvals.functions";
import { PARTS, type HandoverKind, type PartDef } from "@/lib/handover-parts";
import { useTranslation } from "@/i18n/language";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/styles/handover.css";

const C = {
  title: { en: "Check your profile", th: "ตรวจโปรไฟล์ของคุณ" },
  lead: { en: (by: string, d: string) => `${by} prepared this profile on ${d}. Check each part — edit anything that's wrong — then send it for approval.`, th: (by: string, d: string) => `${by} เตรียมโปรไฟล์นี้เมื่อ ${d} ตรวจแต่ละส่วน แก้ไขสิ่งที่ไม่ถูกต้อง แล้วส่งให้อนุมัติ` },
  count: { en: (a: number, b: number) => `${a} of ${b} checked`, th: (a: number, b: number) => `ตรวจแล้ว ${a} จาก ${b}` },
  ok: { en: "Looks right", th: "ถูกต้อง" }, undo: { en: "Undo", th: "ยกเลิก" }, edit: { en: "Edit", th: "แก้ไข" },
  changed: { en: "You changed this", th: "คุณแก้ไขส่วนนี้แล้ว" },
  pub: { en: "Public", th: "สาธารณะ" }, priv: { en: "Private", th: "ส่วนตัว" },
  declare: { en: "I confirm this information is correct and I may publish it for this company.", th: "ฉันยืนยันว่าข้อมูลนี้ถูกต้อง และฉันมีสิทธิ์เผยแพร่ในนามบริษัทนี้" },
  send: { en: "Send for approval", th: "ส่งให้อนุมัติ" },
  left: { en: (n: number) => `Check ${n} more part${n === 1 ? "" : "s"} first`, th: (n: number) => `ตรวจอีก ${n} ส่วนก่อน` },
  sent: { en: "Sent. PitchSnack will review it and let you know by email.", th: "ส่งแล้ว ทีม PitchSnack จะตรวจและแจ้งคุณทางอีเมล" },
  waiting: { en: (d: string) => `Sent for approval on ${d}. We'll email you when it's reviewed.`, th: (d: string) => `ส่งให้อนุมัติเมื่อ ${d} เราจะแจ้งทางอีเมลเมื่อตรวจเสร็จ` },
};

/** Owner-side check after a handover (brief: My Company box). Renders nothing unless the user accepted a handover for this profile. */
export function OwnerHandoverBox({ kind, id, onEdit }: { kind: HandoverKind; id: string; onEdit: (p: PartDef) => void }) {
  const { language } = useTranslation();
  const L = language === "th" ? "th" : "en";
  const qc = useQueryClient();
  const get = useServerFn(myHandover);
  const setCheck = useServerFn(setPartCheck);
  const submit = useServerFn(submitHandover);
  const listing = useServerFn(submitListing);
  const key = ["my-handover", kind, id];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { kind, id } }), staleTime: 10_000 });
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  if (!d) return null;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(L === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

  if (d.submittedAt) return <div className="ho-owner ho-owner--sent" role="status">{C.waiting[L](fmt(d.submittedAt))}</div>;

  const done = d.parts.filter((p) => p.checked).length;
  const total = d.parts.length;
  const left = total - done;
  const toggle = async (part: string, checked: boolean) => {
    try { await setCheck({ data: { kind, id, part, checked } }); await qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error((e as Error).message); }
  };
  const send = async () => {
    setBusy(true);
    try {
      await submit({ data: { kind, id, declared: true } });
      if (kind === "startup") await listing({ data: { startupId: id } });
      toast.success(C.sent[L]);
      await qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="ho-owner" aria-labelledby={`ho-${id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`ho-${id}`} className="text-[15px] font-semibold">{C.title[L]}</h3>
        <span className="text-xs font-semibold text-muted-foreground">{C.count[L](done, total)}</span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{C.lead[L](d.preparedBy, fmt(d.preparedAt))}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>
      <ul className="mt-3 divide-y divide-border rounded-lg border bg-card">
        {d.parts.map((p) => {
          const def = PARTS[kind].find((x) => x.key === p.key)!;
          const changed = !!p.changedField;
          return (
            <li key={p.key} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", p.checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{p.checked && <Check className="h-3 w-3" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                  {def[L]}
                  {p.view !== "open" && <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 text-[10.5px] font-semibold text-muted-foreground">{p.view === "public" ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{p.view === "public" ? C.pub[L] : C.priv[L]}</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{changed ? C.changed[L] : p.summary || "—"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => onEdit(def)}><Pencil className="h-3.5 w-3.5" />{C.edit[L]}</Button>
                {!changed && (p.checked
                  ? <Button size="sm" variant="ghost" className="h-8" onClick={() => toggle(p.key, false)}>{C.undo[L]}</Button>
                  : <Button size="sm" variant="outline" className="h-8" onClick={() => toggle(p.key, true)}>{C.ok[L]}</Button>)}
              </div>
            </li>
          );
        })}
      </ul>
      <label className="mt-3 flex items-start gap-2 text-[13px]">
        <input type="checkbox" className="mt-0.5" checked={declared} onChange={(e) => setDeclared(e.target.checked)} disabled={left > 0} />
        {C.declare[L]}
      </label>
      <Button className="mt-3 w-full sm:w-auto" disabled={busy || left > 0 || !declared} onClick={send}>{left > 0 ? C.left[L](left) : C.send[L]}</Button>
    </section>
  );
}
