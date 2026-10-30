import { localizeCard } from "@/lib/buy-orders";
import { useRef, useState } from "react";
import { Check, EyeOff, Lock, Send, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { coverOf, fmtDay, matchOf } from "@/lib/buy-orders";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyToBuyOrder, type ApplyContext, type BoCard } from "@/lib/buy-orders.functions";
import { sectorIcon } from "./bw-icons";
import { useBw, useSectorName } from "./bw-card";

export function ApplyDialog({ card: rawCard, ctx, onClose, onDone }: { card: BoCard; ctx: ApplyContext; onClose: () => void; onDone: (changed: boolean) => void }) {
  const { c, th } = useBw();
  const card = localizeCard(rawCard, th);
  const sectorName = useSectorName();
  const apply = useServerFn(applyToBuyOrder);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [pickError, setPickError] = useState(false);
  const picker = useRef<HTMLButtonElement>(null);
  const l = ctx.managed ? ctx.companies?.find((x) => x.listing.id === businessId)?.listing ?? null : ctx.listing;
  const sealed = card.kind === "sealed";
  const m = l ? matchOf(l, { sector: card.sector, location: card.location, target_revenue: card.targetRevenue, deal_types: card.dealTypes }) : null;
  const Icon = sectorIcon(l?.sector);
  const names = { industry: c("Industry", "อุตสาหกรรม"), location: c("Location", "ที่ตั้ง"), revenue: c("Target revenue", "รายได้เป้าหมาย"), deal: c("Deal type", "รูปแบบดีล") };
  const values = {
    industry: sectorName(l?.sector) || "—",
    location: [l?.country, l?.province].filter(Boolean).join(" · ") || "—",
    revenue: l?.revenue ? c(`${l.revenue} (revenue FY25)`, `${l.revenue} (รายได้ปี 2568)`) : "—",
    deal: l?.dealType ?? "—",
  };
  const submit = async () => {
    if (!l) { setPickError(true); picker.current?.focus(); return; }
    setBusy(true);
    try {
      await apply({ data: { id: card.id, businessId: ctx.managed ? l.id : undefined, note: note.trim() || null } });
      toast.success(sealed
        ? c("Applied. PitchSnack will check the fit, usually within 5 business days. Follow it in Pipeline › NDA Invitations › Applications.", "สมัครแล้ว PitchSnack จะตรวจความเหมาะสม โดยปกติภายใน 5 วันทำการ ติดตามได้ที่ ดีล › คำเชิญ NDA › การสมัคร")
        : c("Applied. Your application is with the buyer. Follow it in Pipeline › NDA Invitations › Applications.", "สมัครแล้ว ใบสมัครของคุณส่งถึงผู้ซื้อแล้ว ติดตามได้ที่ ดีล › คำเชิญ NDA › การสมัคร"));
      onDone(false);
    } catch (e) {
      const changed = String((e as Error).message).startsWith("BO_CHANGED");
      toast.error(changed ? c("This buy order has changed. Refresh and try again.", "ประกาศนี้มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง") : (e as Error).message);
      if (changed) onDone(true);
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bw-dialog bw-apply" onOpenAutoFocus={(e) => { if (ctx.managed) { e.preventDefault(); picker.current?.focus(); } }}>
        <div className="bw-apply-body">
          <DialogTitle className="text-[19px] font-bold">{c("Expression of interest", "แสดงความสนใจ")}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">{card.name} · {card.ref} · {card.buyerType}{card.country ? ` · ${card.country}` : ""}</DialogDescription>
          {ctx.managed && <div className="mt-4">
            <label id="bw-company-label" className="bw-label block">{c("For which company", "สำหรับบริษัทใด")}</label>
            <Select value={businessId} onValueChange={(v) => { setBusinessId(v); setPickError(false); }}>
              <SelectTrigger ref={picker} aria-labelledby="bw-company-label" aria-invalid={pickError} aria-describedby={pickError ? "bw-company-error" : undefined} className="bw-company-select"><SelectValue placeholder={c("Pick one.", "เลือกหนึ่งรายการ")} /></SelectTrigger>
              <SelectContent>{(ctx.companies ?? []).map((company) => {
                const applied = card.managedApps?.find((a) => a.businessId === company.listing.id);
                return <SelectItem key={company.listing.id} value={company.listing.id} disabled={!!applied}>{company.name} · {company.listing.ref ?? "—"}{applied ? ` · ${c("Applied", "สมัครเมื่อ")} ${fmtDay(applied.appliedAt, th, false)}` : ""}</SelectItem>;
              })}</SelectContent>
            </Select>
            {pickError && <p id="bw-company-error" role="alert" className="mt-1 text-[12.5px] text-destructive">{c("Pick one.", "เลือกหนึ่งรายการ")}</p>}
          </div>}
          {l && m && <>
          <div className="bw-label mt-4">{c("Your listing", "ประกาศของคุณ")}</div>
          <div className="bw-listing">
            <span className="bw-ltile" style={{ background: coverOf(l.sector).mid }}><Icon className="h-6 w-6" /></span>
            <div className="min-w-0">
              <div className="text-[14px]"><b>{l.codeName ?? "—"}</b> · {l.ref}</div>
              <div className="text-[12.5px] text-[#6B7280]">{[sectorName(l.sector), l.province, l.revenue && c(`Revenue FY25 ${l.revenue}`, `รายได้ปี 2568 ${l.revenue}`)].filter(Boolean).join(" · ")}</div>
              <span className="bw-hidden-pill"><EyeOff className="h-3 w-3" />{c("Identity hidden", "ซ่อนตัวตน")}</span>
            </div>
          </div>
          <div className="bw-label mt-4 flex items-center gap-2">{c("How your listing matches", "ประกาศของคุณตรงกันแค่ไหน")}<span className="bw-npill">{c(`${m.n} of 4`, `${m.n} จาก 4`)}</span></div>
          <ul className="bw-match">
            {m.rows.map((r) => (
              <li key={r.key}>
                {r.ok ? <Check className="h-4 w-4 text-[#16A34A]" /> : <AlertTriangle className="h-4 w-4 text-[#D97706]" />}
                <span><b>{names[r.key]}</b> {values[r.key]}{!r.ok && c(" · doesn’t match this buy order", " · ไม่ตรงกับประกาศนี้")}</span>
              </li>
            ))}
          </ul>
          {m.n < 4 && <p className="text-[12.5px] text-[#6B7280]">{sealed ? c("You can still apply. PitchSnack decides whether it fits.", "คุณยังสมัครได้ PitchSnack จะพิจารณาว่าเหมาะหรือไม่") : c("You can still apply. The buyer decides whether it fits.", "คุณยังสมัครได้ ผู้ซื้อจะพิจารณาว่าเหมาะหรือไม่")}</p>}
          </>}
          <label className="mt-4 block text-[13.5px] font-semibold" htmlFor="bw-note">
            {sealed ? c("A note for PitchSnack", "ข้อความถึง PitchSnack") : c("A note for the buyer", "ข้อความถึงผู้ซื้อ")} <span className="font-normal text-[#9CA3AF]">{c("optional", "ไม่บังคับ")}</span>
          </label>
          <textarea id="bw-note" autoFocus={!ctx.managed} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="bw-note"
            placeholder={c("Why your business fits, for example your licences, plant or customers.", "ทำไมธุรกิจของคุณจึงเหมาะ เช่น ใบอนุญาต โรงงาน หรือลูกค้า")} />
          <div className="flex justify-between text-[12px] text-[#6B7280]"><span>{sealed ? c("Only PitchSnack reads it.", "เฉพาะ PitchSnack ที่อ่านได้") : c("The buyer reads it with your listing.", "ผู้ซื้อจะอ่านพร้อมประกาศของคุณ")}</span><span>{note.length} / 500</span></div>
          <div className="bw-lockline"><Lock className="h-3.5 w-3.5 shrink-0" />{sealed
            ? c("PitchSnack checks the fit and, if it fits, requests an NDA for its client. Your company’s name stays hidden until you approve it.", "PitchSnack จะตรวจความเหมาะสม และหากเหมาะจะขอ NDA ให้ลูกค้า ชื่อบริษัทของคุณถูกซ่อนจนกว่าคุณจะอนุมัติ")
            : c("Your application goes straight to the buyer, with your Listing view only. Your company’s name stays hidden until you approve the buyer’s NDA.", "ใบสมัครของคุณส่งตรงถึงผู้ซื้อพร้อมมุมมองประกาศเท่านั้น ชื่อบริษัทของคุณถูกซ่อนจนกว่าคุณจะอนุมัติ NDA ของผู้ซื้อ")}</div>
        </div>
        <div className="bw-dfoot">
          <Button variant="unstyled" type="button" className="bw-btn bw-outline flex-none px-4" onClick={onClose}>{c("Cancel", "ยกเลิก")}</Button>
          <Button variant="unstyled" type="button" disabled={busy} className="bw-btn bw-amber flex-none px-4" onClick={submit}><Send className="h-4 w-4" />{c("Apply", "สมัคร")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
