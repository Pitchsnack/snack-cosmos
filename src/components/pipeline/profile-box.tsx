import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Linkedin, Lock, LockOpen, Mail, MessageSquare, Phone, User, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/language";
import { getProfileBox, type ProfileBox as Box } from "@/lib/profile-box.functions";
import { Button } from '@/components/ui/button';
import { FullProfileContent } from './full-profile-content';

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/** Pipeline › Investor profile (seller) / Seller profile (buyer): read-only box about the other side of the deal. */
export function ProfileBox({ pipelineId, asSide, onClose, onReview, fullProfile=false, approvedAt, endAt }: { pipelineId: string; asSide: "seller" | "buyer"; onClose: () => void; onReview?: () => void; fullProfile?: boolean; approvedAt?:string|null; endAt?:string|null }) {
  const get = useServerFn(getProfileBox);
  const { language } = useTranslation();
  const th = language === "th";
  const c = (en: string, thai: string) => (th ? thai : en);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [badLogo, setBadLogo] = useState(false);
  const [full,setFull]=useState(false);
  const opener=useRef<HTMLElement|null>(null);
  const { data, error } = useQuery({ queryKey: ["pipeline", "profile-box", pipelineId, asSide], queryFn: () => get({ data: { id: pipelineId, as: asSide } }), staleTime: 0 });
  const rowLabel = (k: string) => ({
    "Ticket size": c("Ticket size", "ขนาดเงินลงทุน"), Sectors: c("Sectors", "กลุ่มอุตสาหกรรม"), "Deal types": c("Deal types", "ประเภทดีล"),
    Website: c("Website", "เว็บไซต์"), "Listed as": c("Listed as", "ประกาศในชื่อ"), Founded: c("Founded", "ก่อตั้ง"), "Deal type": c("Deal type", "ประเภทดีล"),
  } as Record<string, string>)[k] ?? k;
  const rowValue = (v: string) => v.replace(/\{n\}:(.+)$/, (_, n) => (th ? `พนักงาน ${n} คน` : `${n} employees`));

  const Head = ({ children }: { children: React.ReactNode }) => <header className="pbox-head">{children}<button type="button" className="pbox-x" aria-label={c("Close", "ปิด")} title={c("Close", "ปิด")} onClick={onClose}><X size={18} /></button></header>;

  let head: React.ReactNode = <Head><span className="pbox-avatar" data-tone="muted" /><div><DialogTitle ref={titleRef} tabIndex={-1} className="pbox-name">{error ? c("Profile", "โปรไฟล์") : c("Loading…", "กำลังโหลด…")}</DialogTitle><DialogDescription className="pbox-sub">{error ? (error as Error).message : " "}</DialogDescription></div></Head>;
  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  if (data?.kind === "private") {
    const seller = data.side === "seller";
    const p = data.person;
    const contacts = [
      p.email && { k: "email", icon: Mail, label: c("Email", "อีเมล"), value: p.email, href: `mailto:${p.email}` },
      p.phone && { k: "phone", icon: Phone, label: c("Phone", "เบอร์โทรศัพท์"), value: p.phone, href: `tel:${p.phone.replace(/\s+/g, "")}` },
      p.linkedin && { k: "linkedin", icon: Linkedin, label: "LinkedIn", value: p.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), href: /^https?:/.test(p.linkedin) ? p.linkedin : `https://${p.linkedin}`, ext: true },
    ].filter(Boolean) as { k: string; icon: typeof Mail; label: string; value: string; href: string; ext?: boolean }[];
    head = (
      <Head>
        {p.avatarUrl ? <img className="pbox-avatar" src={p.avatarUrl} alt="" /> : <span className="pbox-avatar" data-tone={seller ? "buyer" : "seller"}>{initials(p.name)}</span>}
        <div className="min-w-0">
          <DialogTitle ref={titleRef} tabIndex={-1} className="pbox-name">{p.name}</DialogTitle>
          <DialogDescription className="pbox-sub">{[p.title, p.organisation].filter(Boolean).join(" · ") || " "}</DialogDescription>
          {p.verified && <span className="pbox-pill" data-tone="ok"><Check size={12} />{seller ? c("Verified buyer", "ผู้ซื้อที่ยืนยันแล้ว") : c("Verified seller", "ผู้ขายที่ยืนยันแล้ว")}</span>}
        </div>
      </Head>
    );
    body = (
      <>
        {p.bio && <p className="pbox-bio">{p.bio}</p>}
        {contacts.length > 0 && <div className="pbox-contacts">{contacts.map((x) => (
          <div key={x.k} className="pbox-contact" data-k={x.k}>
            <span className="pbox-icon"><x.icon size={15} /></span>
            <div className="min-w-0"><div className="pbox-clabel">{x.label}</div>
              <a className="pbox-link" href={x.href} title={x.value} {...(x.ext ? { target: "_blank", rel: "noreferrer" } : {})}><span className="truncate">{x.value}</span>{x.ext && <ExternalLink size={13} className="shrink-0" />}</a>
            </div>
          </div>))}
        </div>}
        <div className="pbox-org">
          <div className="pbox-orghead">
            {data.org.logoUrl && !badLogo ? <img className="pbox-logo" src={data.org.logoUrl} alt="" onError={() => setBadLogo(true)} /> : <span className="pbox-logo" data-tone="tile">{initials(data.org.name)}</span>}
            <div className="min-w-0"><div className="pbox-orgname">{data.org.name}</div>{data.org.line && <div className="pbox-orgline">{data.org.line}</div>}</div>
          </div>
          {data.org.rows.map((r) => (
            <div key={r.key} className="pbox-row"><span>{rowLabel(r.key)}</span>
              {r.href ? <a className="pbox-link" href={r.href} target="_blank" rel="noreferrer" title={r.value}><span className="truncate">{r.value}</span><ExternalLink size={13} className="shrink-0" /></a> : <span>{rowValue(r.value)}</span>}
            </div>))}
        </div>
      </>
    );
    foot = (
      <footer className="pbox-foot">
        <p className="pbox-line"><LockOpen size={14} className="pbox-okicon" />{seller ? c("Shared because you approved the NDA.", "แสดงเพราะท่านอนุมัติ NDA แล้ว") : c("Shared because your NDA is approved.", "แสดงเพราะ NDA ของท่านได้รับอนุมัติแล้ว")}</p>
        <div className="pbox-buttons">
          <a className="pbox-btn" href={`/marketplace/messages?thread=p:${pipelineId}`}><MessageSquare size={15} />{seller ? c("Message buyer", "ส่งข้อความถึงผู้ซื้อ") : c("Message seller", "ส่งข้อความถึงผู้ขาย")}</a>
          {fullProfile ? <Button className="pbox-btn" data-primary onClick={()=>setFull(true)}>{seller?c("Open full profile", "เปิดโปรไฟล์ฉบับเต็ม"):c("Open full listing", "เปิดประกาศฉบับเต็ม")}</Button> : <a className="pbox-btn" data-primary href={seller?'/marketplace/my-contact':`/marketplace/browse?company=${data.listingId??''}`}>{seller?c("Open full profile", "เปิดโปรไฟล์ฉบับเต็ม"):c("Open full listing", "เปิดประกาศฉบับเต็ม")}</a>}
        </div>
      </footer>
    );
  } else if (data?.kind === "public") {
    const rows = [
      data.range && { k: "Ticket size", v: <>{data.range} <span className="pbox-tag">{c("Range", "ช่วง")}</span></> },
      data.sectors && { k: "Sectors", v: data.sectors },
      data.dealTypes && { k: "Deal types", v: data.dealTypes },
    ].filter(Boolean) as { k: string; v: React.ReactNode }[];
    head = (
      <Head>
        <span className="pbox-avatar" data-tone="muted"><User size={24} /></span>
        <div className="min-w-0">
          <DialogTitle ref={titleRef} tabIndex={-1} className="pbox-name">{data.type}</DialogTitle>
          <DialogDescription className="pbox-sub">{[data.ref, data.country].filter(Boolean).join(" · ") || " "}</DialogDescription>
          <span className="pbox-pill" data-tone="muted"><Lock size={12} />{c("Name hidden until you approve the NDA", "ซ่อนชื่อจนกว่าท่านจะอนุมัติ NDA")}</span>
        </div>
      </Head>
    );
    body = (
      <>
        <div className="pbox-hidden"><Lock size={16} className="shrink-0" />{c("Their name, photo, firm and contact details show here once you approve the NDA.", "ชื่อ รูปภาพ บริษัท และข้อมูลติดต่อของผู้ซื้อจะแสดงที่นี่เมื่อท่านอนุมัติ NDA")}</div>
        <div className="pbox-caption">{c("Public profile, as in Browse investors", "โปรไฟล์สาธารณะ เหมือนในหน้าดูรายชื่อนักลงทุน")}</div>
        {rows.map((r) => <div key={r.k} className="pbox-row"><span>{rowLabel(r.k)}</span><span>{r.v}</span></div>)}
      </>
    );
    foot = data.pending && onReview ? (
      <footer className="pbox-foot">
        <p className="pbox-line">{c("Approving shares your company's name, figures and contacts with this buyer.", "การอนุมัติจะแชร์ชื่อ ตัวเลข และข้อมูลติดต่อของกิจการท่านกับผู้ซื้อรายนี้")}</p>
        <div className="pbox-buttons"><button type="button" className="pbox-btn" data-primary onClick={() => { onClose(); onReview(); }}>{c("Review request", "ตรวจสอบคำขอ")}</button></div>
      </footer>
    ) : null;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={full?'pbox full-profile':'pbox'} aria-describedby={full?undefined:undefined} onOpenAutoFocus={(e) => { e.preventDefault(); opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null; requestAnimationFrame(() => titleRef.current?.focus()); }} onCloseAutoFocus={e=>{e.preventDefault();opener.current?.focus();}}>
        {full?<FullProfileContent pipelineId={pipelineId} side={asSide} onClose={onClose} approvedAt={approvedAt} endAt={endAt}/>:<>{head}<div className="pbox-body">{body}</div>{foot}</>}
      </DialogContent>
    </Dialog>
  );
}
