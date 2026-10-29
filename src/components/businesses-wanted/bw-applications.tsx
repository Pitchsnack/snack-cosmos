import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, Lock, Megaphone, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NdaKeyTerms, FullNda } from "@/components/pipeline/nda-approval";
import { coverOf, fmtDay } from "@/lib/buy-orders";
import { applicationsToCheck, decideApplication, listApplications, type AppRow, type BoCard } from "@/lib/buy-orders.functions";
import { BuyOrderCard, useBw, useSectorName } from "./bw-card";
import { BuyOrderDetails } from "./bw-details";
import { sectorIcon } from "./bw-icons";
import { cn } from "@/lib/utils";

export const APPS_QUERY = ["buy-order-apps"] as const;

/** The Applications tab's count: applications waiting for a decision (buyers and PitchSnack Control). */
export function useApplicationsToCheck(enabled: boolean) {
  const fn = useServerFn(applicationsToCheck);
  return useQuery({ queryKey: [...APPS_QUERY, "count"], queryFn: () => fn(), enabled, staleTime: 60_000 }).data?.n ?? 0;
}

export function applicationsLine(seller: boolean, control: boolean, c: (e: string, t: string) => string) {
  if (seller) return c("Buy orders you applied to in Businesses Wanted, and where each application is.", "ประกาศซื้อที่คุณสมัครในธุรกิจที่ผู้ซื้อต้องการ และสถานะของแต่ละใบสมัคร");
  return control
    ? c("Sellers who applied to your sealed buy orders. Open their listing, then Request NDA or Not a fit.", "ผู้ขายที่สมัครประกาศซื้อแบบปิดผนึกของคุณ เปิดดูประกาศ แล้วขอ NDA หรือแจ้งว่าไม่เหมาะ")
    : c("Sellers who applied to your advertisements. Open their listing, then Request NDA or Not a fit.", "ผู้ขายที่สมัครประกาศของคุณ เปิดดูประกาศ แล้วขอ NDA หรือแจ้งว่าไม่เหมาะ");
}

export function ApplicationsTab({ seller }: { seller: boolean }) {
  const { c } = useBw();
  const fn = useServerFn(listApplications);
  const q = useQuery({ queryKey: [...APPS_QUERY, seller ? "seller" : "buyer"], queryFn: () => fn({ data: { as: seller ? "seller" : "buyer" } }) });
  const [details, setDetails] = useState<BoCard | null>(null);
  if (q.isPending) return <p className="pipeline-empty">{c("Loading…", "กำลังโหลด…")}</p>;
  if (q.error) return <p role="alert" className="pipeline-empty">{(q.error as Error).message}</p>;
  const d = q.data!;
  if (d.mode === "seller") {
    if (!d.cards.length) return <div className="bw-empty mt-4"><b>{c("You haven’t applied to a buy order yet.", "คุณยังไม่ได้สมัครประกาศซื้อ")}</b><span>{c("Find one in Businesses Wanted and click Apply.", "ค้นหาในธุรกิจที่ผู้ซื้อต้องการ แล้วกดสมัคร")}</span></div>;
    return (
      <>
        <div className="bw-grid mt-4">
          {d.cards.map((x) => <BuyOrderCard key={x.id} card={x} persona="seller" mode="applications" onDetails={() => setDetails(x)} onApply={() => {}} onShare={() => navigator.clipboard?.writeText(`${window.location.origin}/marketplace/businesses-wanted?bo=${x.ref}`).then(() => toast.success(c("Link copied.", "คัดลอกลิงก์แล้ว")))} />)}
        </div>
        {details && <BuyOrderDetails card={details} persona="seller" onClose={() => setDetails(null)} onApply={() => {}} onShare={() => {}} />}
      </>
    );
  }
  return <ReviewList rows={d.rows} />;
}

function ReviewList({ rows }: { rows: AppRow[] }) {
  const { c, th } = useBw();
  const sectorName = useSectorName();
  const qc = useQueryClient();
  const decide = useServerFn(decideApplication);
  const [sign, setSign] = useState<AppRow | null>(null);
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: APPS_QUERY }); qc.invalidateQueries({ queryKey: ["buy-orders"] }); qc.invalidateQueries({ queryKey: ["pipeline"] }); qc.invalidateQueries({ queryKey: ["invitations"] }); };
  const run = async (r: AppRow, action: "nda" | "not_a_fit", consent?: string) => {
    setBusy(true);
    try {
      await decide({ data: { id: r.id, action, consent } });
      toast.success(action === "nda" ? c("NDA requested. The seller approves it in Pipeline.", "ขอ NDA แล้ว ผู้ขายจะอนุมัติในดีล") : c("Marked not a fit. The seller sees you won’t take it further.", "บันทึกว่าไม่เหมาะแล้ว ผู้ขายจะเห็นว่าคุณไม่ดำเนินการต่อ"));
      setSign(null);
    } catch (e) {
      const m = String((e as Error).message);
      toast.error(m.startsWith("BO_CHANGED") ? c("This buy order has changed. Refresh and try again.", "ประกาศนี้มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง") : m);
    } finally { setBusy(false); refresh(); }
  };
  const control = rows.some((r) => r.client);
  if (!rows.length)
    return <div className="bw-empty mt-4"><b>{c("No applications yet.", "ยังไม่มีใบสมัคร")}</b><span>{control ? c("Sellers who apply to your sealed buy orders show here.", "ผู้ขายที่สมัครประกาศแบบปิดผนึกของคุณจะแสดงที่นี่") : c("Sellers who apply to your advertisements show here.", "ผู้ขายที่สมัครประกาศของคุณจะแสดงที่นี่")}</span></div>;
  const names = { industry: c("Industry", "อุตสาหกรรม"), location: c("Location", "ที่ตั้ง"), revenue: c("Target revenue", "รายได้เป้าหมาย"), deal: c("Deal type", "รูปแบบดีล") };
  const consent = c("I have read the NDA and agree to its terms.", "ข้าพเจ้าได้อ่าน NDA และตกลงตามเงื่อนไข");
  return (
    <div className="bw-apps">
      {rows.map((r) => {
        const Icon = sectorIcon(r.listing.sector);
        const n = r.match.filter((m) => m.ok).length;
        return (
          <div key={r.id} className={cn("bw-app", r.status === "new" && "bw-app-new")}>
            <span className="bw-ltile" style={{ background: coverOf(r.listing.sector).mid }}><Icon className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px]"><b>{r.listing.codeName ?? "—"}</b> · {r.listing.ref}</div>
              <div className="text-[12.5px] text-[#6B7280]">{[sectorName(r.listing.sector), r.listing.province, r.listing.revenue && c(`Revenue FY25 ${r.listing.revenue}`, `รายได้ปี 2568 ${r.listing.revenue}`)].filter(Boolean).join(" · ")}</div>
              <div className="mt-1 flex items-center gap-1 text-[12.5px]"><Megaphone className="h-3 w-3" />{c("Applied to", "สมัคร")} <b>{r.bo.name}</b> · {r.bo.ref} · {fmtDay(r.appliedAt, th, false)}</div>
              {r.client && <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[#6B7280]"><Lock className="h-3 w-3" />{c(`For ${r.client.name ?? "—"} · ${r.client.ref ?? "—"} · only PitchSnack sees this`, `สำหรับ ${r.client.name ?? "—"} · ${r.client.ref ?? "—"} · เห็นเฉพาะ PitchSnack`)}</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="bw-mpill">{c(`${n} of 4 match`, `ตรง ${n} จาก 4`)}</span>
                {r.match.map((m) => <span key={m.key} className={cn("bw-mpill", m.ok ? "bw-mok" : "bw-mno")}>{m.ok ? "✓" : "✗"} {names[m.key]}</span>)}
              </div>
              {r.note && <div className="bw-quote">“{r.note}”</div>}
              <button type="button" className="bw-viewlink" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}><Eye className="h-[15px] w-[15px]" />{c("View listing", "ดูประกาศ")}</button>
              {open === r.id && (
                <div className="bw-listing-view">
                  {r.listing.headline && <b className="block text-[14.5px]">{r.listing.headline}</b>}
                  {r.listing.description && <p className="mt-1 text-[13.5px] text-[#4B5563]">{r.listing.description}</p>}
                  {r.listing.highlights.length > 0 && <ul className="bw-list mt-2">{r.listing.highlights.map((h) => <li key={h}><Check className="h-4 w-4 text-[#16A34A]" />{h}</li>)}</ul>}
                  {r.listing.dealType && <p className="mt-2 text-[12.5px] text-[#6B7280]">{c("Deal type", "รูปแบบดีล")}: {r.listing.dealType}</p>}
                  <div className="bw-aboutline"><Lock className="h-3.5 w-3.5 shrink-0" /><span>{r.client
                    ? c("This is the seller’s Listing view, as buyers see it in Browse listings. Their company’s name, website and exact figures show after they approve the NDA you sign for the client.", "นี่คือมุมมองประกาศของผู้ขาย แบบที่ผู้ซื้อเห็นในเลือกดูประกาศ ชื่อบริษัท เว็บไซต์ และตัวเลขจริงจะแสดงหลังผู้ขายอนุมัติ NDA ที่คุณลงนามให้ลูกค้า")
                    : c("This is the seller’s Listing view, as buyers see it in Browse listings. Their company’s name, website and exact figures show after they approve your NDA.", "นี่คือมุมมองประกาศของผู้ขาย แบบที่ผู้ซื้อเห็นในเลือกดูประกาศ ชื่อบริษัท เว็บไซต์ และตัวเลขจริงจะแสดงหลังผู้ขายอนุมัติ NDA ของคุณ")}</span></div>
                </div>
              )}
            </div>
            <div className="bw-app-actions">
              {r.status === "new" ? <>
                <button type="button" className="bw-btn bw-navy" disabled={busy} onClick={() => { setTick(false); setSign(r); }}><Send className="h-4 w-4" />{c("Request NDA", "ขอ NDA")}</button>
                <button type="button" className="bw-btn bw-outline" disabled={busy} onClick={() => run(r, "not_a_fit")}>{c("Not a fit", "ไม่เหมาะ")}</button>
              </> : r.status === "nda_requested"
                ? <span className="bw-decided bw-mok"><Check className="h-4 w-4" />{c(`NDA requested · ${fmtDay(r.decidedAt, false, false)}`, `ขอ NDA แล้ว · ${fmtDay(r.decidedAt, true, false)}`)}</span>
                : <span className="bw-decided bw-grey-pill"><X className="h-4 w-4" />{c("Not a fit", "ไม่เหมาะ")}</span>}
            </div>
          </div>
        );
      })}
      {sign && (
        <Dialog open onOpenChange={(o) => !o && setSign(null)}>
          <DialogContent className="max-h-[calc(100dvh-48px)] overflow-y-auto">
            <DialogTitle>{c("Sign the NDA and send your request", "ลงนาม NDA และส่งคำขอ")}</DialogTitle>
            <DialogDescription>{sign.client
              ? c(`PitchSnack’s standard mutual NDA, for 2 years. You sign it for ${sign.client.name ?? "the client"}. The seller sees “PitchSnack, for a private client” and approves it.`, `NDA แบบร่วมกันมาตรฐานของ PitchSnack อายุ 2 ปี คุณลงนามแทน ${sign.client.name ?? "ลูกค้า"} ผู้ขายจะเห็น “PitchSnack ในนามลูกค้าส่วนตัว” และอนุมัติ`)
              : c("PitchSnack’s standard mutual NDA, for 2 years. The seller sees your profile and approves it.", "NDA แบบร่วมกันมาตรฐานของ PitchSnack อายุ 2 ปี ผู้ขายจะเห็นโปรไฟล์ของท่านและอนุมัติ")}</DialogDescription>
            <NdaKeyTerms side="buyer" parties={sign.client
              ? c(`${sign.listing.codeName ?? "—"} (${sign.listing.ref ?? ""}) and PitchSnack, for a private client`, `${sign.listing.codeName ?? "—"} (${sign.listing.ref ?? ""}) และ PitchSnack ในนามลูกค้าส่วนตัว`)
              : c(`${sign.listing.codeName ?? "—"} (${sign.listing.ref ?? ""}) and you`, `${sign.listing.codeName ?? "—"} (${sign.listing.ref ?? ""}) และท่าน`)} />
            <FullNda />
            <label className="flex items-start gap-3"><Checkbox checked={tick} onCheckedChange={(v) => setTick(v === true)} />{consent}</label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSign(null)}>{c("Cancel", "ยกเลิก")}</Button>
              <Button disabled={!tick || busy} onClick={() => run(sign, "nda", consent)}>{c("Sign and request NDA", "ลงนามและขอ NDA")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
