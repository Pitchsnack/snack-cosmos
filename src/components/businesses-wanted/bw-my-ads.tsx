import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { myBuyOrders, sendBuyOrder, type BoCard } from "@/lib/buy-orders.functions";
import { BuyOrderCard, useBw } from "./bw-card";
import { BuyOrderDetails } from "./bw-details";
import { BuyOrderForm } from "./bw-form";
import "@/styles/businesses-wanted.css";

export const MY_ADS_QUERY = ["buy-orders", "mine"] as const;

/** Advertisement › My advertisements (buyers), or PitchSnack Control's sealed buy orders (admins, Buyer tab). */
export function MyAdvertisementsPage() {
  const { c } = useBw();
  const qc = useQueryClient();
  const fn = useServerFn(myBuyOrders);
  const send = useServerFn(sendBuyOrder);
  const q = useQuery({ queryKey: MY_ADS_QUERY, queryFn: () => fn() });
  const [form, setForm] = useState<{ editing: BoCard | null } | null>(null);
  const [details, setDetails] = useState<BoCard | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const control = q.data?.control ?? false;
  const cards = q.data?.cards ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["buy-orders"] });
  const sendNow = async (card: BoCard) => {
    setBusy(card.id);
    try { await send({ data: { id: card.id } }); toast.success(c("Sent to Admin.", "ส่งให้แอดมินแล้ว")); }
    catch (e) { const m = String((e as Error).message); toast.error(m.startsWith("BO_CHANGED") ? c("This buy order has changed. Refresh and try again.", "ประกาศนี้มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง") : m); }
    finally { setBusy(null); refresh(); }
  };
  const n = cards.length;
  return (
    <div className="bw-page mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[760px]">
          <div className="bw-eyebrow"><Megaphone className="h-3.5 w-3.5" />{c("ADVERTISEMENT", "ประกาศ")}</div>
          <h1 className="bw-title">{c("My advertisements", "ประกาศของฉัน")}</h1>
          <p className="bw-sub">{control
            ? c("Sealed buy orders you write for the buyers PitchSnack looks after. Admin checks each one before it’s posted. Sellers who apply show in Pipeline › NDA Invitations › Applications.", "ประกาศซื้อแบบปิดผนึกที่คุณเขียนให้ผู้ซื้อที่ PitchSnack ดูแล แอดมินจะตรวจทุกประกาศก่อนลง ผู้ขายที่สมัครจะแสดงใน ดีล › คำเชิญ NDA › ใบสมัคร")
            : c("Post an advertisement for a business you want to buy. Sellers find it in Businesses Wanted and apply with their listing, and you review them.", "ลงประกาศสำหรับธุรกิจที่คุณต้องการซื้อ ผู้ขายจะพบในธุรกิจที่ผู้ซื้อต้องการ และสมัครด้วยประกาศของตน แล้วคุณพิจารณา")}</p>
        </div>
        <button type="button" className="bw-btn bw-navy flex-none px-4" disabled={q.isPending} onClick={() => setForm({ editing: null })}>
          <Plus className="h-4 w-4" />{control ? c("Write a sealed buy order", "เขียนประกาศซื้อแบบปิดผนึก") : c("Post an advertisement", "ลงประกาศ")}
        </button>
      </div>
      {q.isPending ? <p className="mt-6 text-sm text-[#6B7280]">{c("Loading…", "กำลังโหลด…")}</p>
        : q.error ? <p role="alert" className="mt-6 text-sm">{(q.error as Error).message}</p>
        : <>
          <p className="mt-6 text-[13px] text-[#6B7280]">{control
            ? (n === 1 ? c("1 buy order", "1 ประกาศซื้อ") : c(`${n} buy orders`, `${n} ประกาศซื้อ`))
            : (n === 1 ? c("1 advertisement", "1 ประกาศ") : c(`${n} advertisements`, `${n} ประกาศ`))}</p>
          {n === 0
            ? <div className="bw-empty mt-4"><b>{control ? c("No buy orders yet.", "ยังไม่มีประกาศซื้อ") : c("No advertisements yet.", "ยังไม่มีประกาศ")}</b>
                <span>{control ? c("Click Write a sealed buy order to post one for a buyer PitchSnack looks after.", "กด เขียนประกาศซื้อแบบปิดผนึก เพื่อลงประกาศให้ผู้ซื้อที่ PitchSnack ดูแล") : c("Click Post an advertisement to tell sellers which business you want to buy.", "กด ลงประกาศ เพื่อบอกผู้ขายว่าคุณต้องการซื้อธุรกิจแบบใด")}</span></div>
            : <div className="bw-grid mt-3">{cards.map((card) => (
                <BuyOrderCard key={card.id} card={card} persona="buyer" mode="mine" busy={busy === card.id}
                  onDetails={() => setDetails(card)} onApply={() => {}} onShare={() => {}}
                  onEdit={() => setForm({ editing: card })} onSend={() => sendNow(card)} />
              ))}</div>}
        </>}
      {form && q.data && <BuyOrderForm control={control} clients={q.data.clients} me={q.data.me} editing={form.editing}
        onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      {details && <BuyOrderDetails card={details} persona="buyer" onClose={() => setDetails(null)} onApply={() => {}} onShare={() => {}} />}
    </div>
  );
}
