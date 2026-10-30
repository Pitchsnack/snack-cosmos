import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, EyeOff, Lock, Send, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { placeOf, coverOf } from "@/lib/buy-orders";
import { citiesDisplay } from "@/lib/buy-order-defaults";
import { sendBuyOrderShare, type BoCard } from "@/lib/buy-orders.functions";
import { useBw } from "./bw-card";
import { sectorIcon } from "./bw-icons";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog({ card, onClose }: { card: BoCard; onClose: () => void }) {
  const { c, th } = useBw();
  const send = useServerFn(sendBuyOrderShare);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const Icon = sectorIcon(card.sector);

  const submit = async () => {
    if (busy) return;
    const v = email.trim();
    setSent(null);
    if (!v) { setErr(c("Enter an email address.", "กรุณากรอกอีเมล")); return; }
    if (!EMAIL.test(v)) { setErr(c("Enter a valid email address, like name@company.com.", "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@company.com")); return; }
    setErr(null); setBusy(true);
    try {
      await send({ data: { id: card.id, email: v, lang: th ? "th" : "en" } });
      setSent(v); setEmail("");
    } catch {
      setErr(c("Couldn't send the invitation. Please try again.", "ส่งคำเชิญไม่สำเร็จ กรุณาลองอีกครั้ง"));
    } finally { setBusy(false); ref.current?.focus(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bw-dialog bw-share" onOpenAutoFocus={(e) => { e.preventDefault(); ref.current?.focus(); }}>
        <div className="bw-share-h">
          <span className="bw-share-tile"><Share2 className="h-5 w-5" /></span>
          <div>
            <DialogTitle className="bw-share-t">{c("Share this buyer request", "แชร์ความต้องการของผู้ซื้อ")}</DialogTitle>
            <DialogDescription className="bw-share-d">{c("Know a business owner who may be interested in selling? Send them this opportunity.", "รู้จักเจ้าของธุรกิจที่อาจสนใจขายหรือไม่? ส่งโอกาสนี้ให้เขา")}</DialogDescription>
          </div>
        </div>
        <div className="bw-share-body">
        <div className="bw-share-lab">{c("BUY ORDER", "ประกาศซื้อ")}</div>
        <div className="bw-share-box">
          <span className="bw-share-sec" style={{ background: coverOf(card.sector).gradient }}><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="bw-share-name"><b>{card.name}</b> <span>· {card.ref}</span></div>
            <div className="bw-share-meta">{placeOf(citiesDisplay(card.cities, th), card.location)} · {c("Target revenue", "รายได้เป้าหมาย")} {card.targetRevenue} · {c("Target company price range", "ช่วงราคาบริษัทเป้าหมาย")} {card.priceRange}</div>
            <span className="bw-pill bw-share-hidden"><EyeOff className="h-3 w-3" />{c("Buyer’s name hidden", "ไม่แสดงชื่อผู้ซื้อ")}</span>
          </div>
        </div>
        <div className="bw-share-lock"><Lock className="h-3.5 w-3.5" />{c("The buyer’s and seller’s names stay confidential.", "ชื่อของผู้ซื้อและผู้ขายจะถูกเก็บเป็นความลับ")}</div>
        <label className="bw-share-fl" htmlFor="bw-share-email">{c("Email address", "อีเมล")}</label>
        <form className="bw-share-row" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <input id="bw-share-email" ref={ref} type="email" placeholder="name@company.com" value={email} aria-invalid={!!err} aria-describedby={err ? "bw-share-err" : undefined}
            onChange={(e) => { setEmail(e.target.value); if (err) setErr(null); }} className={err ? "bad" : ""} />
          <Button variant="unstyled" type="submit" className="bw-share-send" disabled={busy}><Send className="h-4 w-4" />{c("Send invitation", "ส่งคำเชิญ")}</Button>
        </form>
        {err && <p id="bw-share-err" role="alert" className="bw-share-err">{err}</p>}
        {sent && <p role="status" className="bw-share-ok"><CircleCheck className="h-4 w-4" />{c("Invitation sent to", "ส่งคำเชิญไปที่")} <b>{sent}</b>.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
