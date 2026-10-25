import {
  ArrowRight, Check, ChevronDown, Clock, Columns2, EyeOff, FileSignature, FileText, FolderOpen, Grid3x3, List, Lock,
  MessageSquare, Route as RouteIcon, Search, ShieldCheck, Star, Store, X,
} from "lucide-react";
import restaurant from "@/assets/buyers/hero-restaurant.jpg.asset.json";
import filmLine from "@/assets/buyers/hero-film-line.jpg.asset.json";
import { HeroSlides } from "./hero-slides";
import { useHomeLang } from "./public-shell";

/** For buyers hero: five drawings of the app, switched with dots. */
const c = (en: string, th: string) => ({ en, th });

const CAPS = [
  c("Browse anonymous listings from verified sellers", "ดูประกาศไม่ระบุชื่อจากผู้ขายที่ผ่านการตรวจสอบ"),
  c("Sign one standard NDA to ask for the full listing", "ลงนาม NDA มาตรฐานฉบับเดียว เพื่อขอดูประกาศฉบับเต็ม"),
  c("When the seller approves, the name and exact figures open", "เมื่อผู้ขายอนุมัติ ชื่อกิจการและตัวเลขจริงจะเปิดให้ท่าน"),
  c("Read the verified report and valuation the seller shares", "อ่านรายงานการเงินที่ตรวจแล้วและการประเมินมูลค่าที่ผู้ขายแชร์"),
  c("Track every deal from NDA to payment in one Pipeline", "ติดตามทุกดีลตั้งแต่ NDA จนถึงการชำระเงินใน Pipeline เดียว"),
];

export function BuyersHeroSlides({ img }: { img: string | null }) {
  return <HeroSlides captions={CAPS} slides={[<P1 key={1} img={img} />, <P2 key={2} />, <P3 key={3} img={img} />, <P4 key={4} />, <P5 key={5} />]} />;
}

function Head({ icon: I, eb, title, sub, right }: { icon: typeof Store; eb: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="bw-head">
      <div className="bw-head-l">
        <div className="bw-eb"><I size={11} />{eb}</div>
        <div className="bw-title">{title}</div>
        {sub && <div className="bw-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
const cover = (url: string | null, pos: string) => (url ? { backgroundImage: `url("${url}")`, backgroundPosition: pos } : undefined);

function P1({ img }: { img: string | null }) {
  const { t } = useHomeLang();
  return (
    <div className="bw bw-flush">
      <div className="bw-top">
        <Head icon={Store} eb={t(c("Discover", "สำรวจ"))} title={t(c("Browse listings", "ดูประกาศขายกิจการ"))}
          right={<span className="bw-views"><i className="is-on"><Grid3x3 size={12} /></i><i><Columns2 size={12} /></i><i><List size={12} /></i></span>} />
        <div className="bw-search">
          <span className="bw-in"><Search size={12} /><em>{t(c("Search listings", "ค้นหาประกาศ"))}</em></span>
          <span className="bw-dd">{t(c("All sectors", "ทุกอุตสาหกรรม"))}<ChevronDown size={11} /></span>
        </div>
      </div>
      <div className="bw-row">
        <div className="bw-lc">
          <div className="bw-cv" style={cover(img, "30% 50%")}>
            <span className="bw-pill"><span><Lock size={9} />{t(c("Identity hidden", "ปิดชื่อกิจการ"))}</span><b>{t(c("NEW", "ใหม่"))}</b></span>
            <span className="bw-star"><Star size={12} /></span>
          </div>
          <div className="bw-lb">
            <div className="bw-lt">{t(c("Established Shrink Film Manufacturer Serving B2B Clients", "ผู้ผลิตฟิล์มหดรายเก่าแก่\nให้บริการลูกค้าธุรกิจ"))}</div>
            <span className="bw-nda"><Lock size={9} />{t(c("Identity after NDA", "เปิดชื่อหลังลงนาม NDA"))}</span>
            <div className="bw-rev"><small>{t(c("Revenue FY25", "รายได้ปี 2568"))}</small><b>฿50M – 100M</b><i>{t(c("Range", "ช่วง"))}</i></div>
            <div className="bw-det">{t(c("Packaging · operator · Bangkok · 51–200 employees", "บรรจุภัณฑ์ · ผู้ประกอบการ · กรุงเทพฯ · พนักงาน 51–200 คน"))}</div>
            <div className="bw-chips">{["Shrink Film", "Label Film", "Pouch Packaging"].map((x) => <span key={x}>{x}</span>)}</div>
          </div>
        </div>
        <div className="bw-lc bw-lc2">
          <div className="bw-cv" style={cover(restaurant.url, "40% 80%")}>
            <span className="bw-pill"><span><Lock size={9} />{t(c("Identity hidden", "ปิดชื่อกิจการ"))}</span></span>
          </div>
          <div className="bw-bars"><i /><i /><i /><i /><i /></div>
        </div>
      </div>
    </div>
  );
}

function P2() {
  const { t } = useHomeLang();
  return (
    <div className="bw bw-dark2">
      <Head icon={FileSignature} eb="NDA" title={t(c("Request an NDA", "ขอลงนาม NDA"))} sub={t(c("Project B2B Packaging · PS-1005", "โครงการ B2B Packaging · PS-1005"))}
        right={<span className="bw-x"><X size={15} /></span>} />
      <div className="bw-card bw-ndac">
        <div className="bw-ndat"><span className="bw-tile"><ShieldCheck size={14} /></span><b>{t(c("PitchSnack standard mutual NDA", "NDA มาตรฐานแบบสองฝ่ายของ PitchSnack"))}</b><i>{t(c("2 years", "อายุ 2 ปี"))}</i></div>
        <ul>
          {[c("Keep the seller’s information confidential", "เก็บข้อมูลของผู้ขายเป็นความลับ"), c("Use it only to evaluate this deal", "ใช้ข้อมูลเพื่อพิจารณาดีลนี้เท่านั้น"), c("No direct contact with the seller’s staff, customers or suppliers", "ไม่ติดต่อพนักงาน ลูกค้า หรือซัพพลายเออร์ของผู้ขายโดยตรง")]
            .map((x) => <li key={x.en}><Check size={13} strokeWidth={2.6} />{t(x)}</li>)}
        </ul>
        <div className="bw-ndaf"><span className="bw-agree"><i><Check size={11} /></i>{t(c("I have read the NDA and agree to it", "ฉันอ่าน NDA แล้วและยอมรับ"))}</span><span className="bw-link">{t(c("Read the full NDA", "อ่าน NDA ฉบับเต็ม"))}<ArrowRight size={11} /></span></div>
      </div>
      <div className="bw-card bw-sees">
        <span className="bw-pe">PE</span>
        <div className="bw-sees-t"><small>{t(c("The seller sees", "ผู้ขายจะเห็น"))}</small><b>{t(c("Private Equity · INV-1001", "กองทุนไพรเวทอิควิตี้ · INV-1001"))}</b></div>
        <span className="bw-amber"><EyeOff size={12} />{t(c("Name hidden", "ซ่อนชื่อ"))}</span>
      </div>
      <div className="bw-btns"><span className="bw-btn">{t(c("Cancel", "ยกเลิก"))}</span><span className="bw-btn is-navy">{t(c("Sign and request", "ลงนามและส่งคำขอ"))}</span></div>
      <div className="bw-foot"><Clock size={12} />{t(c("The seller usually replies within 2–3 business days", "ผู้ขายมักตอบภายใน 2–3 วันทำการ"))}</div>
    </div>
  );
}

function P3({ img }: { img: string | null }) {
  const { t } = useHomeLang();
  return (
    <div className="bw bw-glass">
      <Head icon={Star} eb={t(c("Favourites", "รายการโปรด"))} title={t(c("Private view", "มุมมองส่วนตัว"))}
        right={<span className="bw-sw"><i>{t(c("Public view", "มุมมองสาธารณะ"))}</i><i className="is-on">{t(c("Private view", "มุมมองส่วนตัว"))}</i></span>} />
      <div className="bw-col">
        <div className="bw-stack">
          <div className="bw-behind is-far"><div style={cover(filmLine.url, "50% 60%")} /></div>
          <div className="bw-behind is-near"><div style={cover(restaurant.url, "50% 60%")} /></div>
          <div className="bw-main">
            <div className="bw-cv bw-cv84" style={cover(img, "50% 42%")}><span className="bw-gp"><Check size={11} />{t(c("NDA approved", "อนุมัติ NDA แล้ว"))}</span></div>
            <div className="bw-mb">
              <div className="bw-name"><span className="bw-bf">BF</span><div><b>{t(c("Banyan Film & Packaging Co., Ltd.", "บจก. บันยัน ฟิล์ม แอนด์ แพ็กเกจจิ้ง"))}</b><small>{t(c("Bangkok · since 2012 · 140 employees", "กรุงเทพฯ · ก่อตั้ง 2555 · พนักงาน 140 คน"))}</small></div></div>
              <div className="bw-figs">
                <div><small>{t(c("Revenue FY25", "รายได้ปี 2568"))}</small><b>฿78.4M</b><i className="is-tag">{t(c("Exact", "ตัวเลขจริง"))}</i></div>
                <div><small>{t(c("EBITDA FY25", "EBITDA ปี 2568"))}</small><b>฿11.6M</b><i>14.8%</i></div>
                <div><small>{t(c("Asking price", "ราคาขาย"))}</small><b>฿95M</b></div>
                <div><small>{t(c("Stake for sale", "สัดส่วนหุ้นที่ขาย"))}</small><b>100%</b></div>
              </div>
            </div>
          </div>
        </div>
        <div className="bw-btns bw-btns34"><span className="bw-btn"><MessageSquare size={13} />{t(c("Message the seller", "ส่งข้อความถึงผู้ขาย"))}</span><span className="bw-btn is-navy"><FolderOpen size={13} />{t(c("Open data room", "เปิดห้องข้อมูล"))}</span></div>
      </div>
    </div>
  );
}

function P4() {
  const { t } = useHomeLang();
  const bars: [string, number, string][] = [["58.2", 33, "FY21"], ["63.5", 36, "FY22"], ["69.1", 39, "FY23"], ["74.0", 42, "FY24"], ["78.4", 44, "FY25"]];
  return (
    <div className="bw">
      <Head icon={FileText} eb={t(c("Financial & Valuation", "การเงินและมูลค่า"))} title={t(c("Shared with you", "แชร์ให้ท่าน"))} sub="Banyan Film & Packaging" />
      <div className="bw-card bw-rep">
        <div className="bw-spread"><b>{t(c("Verified financial report", "รายงานการเงินที่ตรวจแล้ว"))}</b><span className="bw-badge is-green"><Check size={11} />Verified financials</span></div>
        <div className="bw-line">{t(c("FY2021–2025 · 15 financial ratios · revenue (฿M)", "ปี 2021–2025 · อัตราส่วนทางการเงิน 15 ตัว · รายได้ (฿M)"))}</div>
        <div className="bw-chart">{bars.map(([v, h, y], i) => <div key={y}><small>{v}</small><i style={{ height: h }} className={i === 4 ? "is-last" : undefined} /><em>{y}</em></div>)}</div>
        <div className="bw-cf"><span>{t(c("Income statement and balance sheet", "งบกำไรขาดทุนและงบดุล"))}</span><b>{t(c("View report", "ดูรายงาน"))}</b></div>
      </div>
      <div className="bw-card bw-val">
        <div className="bw-spread"><b>{t(c("Estimated valuation", "การประเมินมูลค่ากิจการ"))}</b><span className="bw-badge is-blue"><Check size={11} />Independent valuation</span></div>
        <div className="bw-vrow"><b>฿93M – 116M</b><span>EV/EBITDA 8–10×</span></div>
        <div className="bw-cf"><span>{t(c("From comparable deals", "จากดีลเทียบเคียง"))}</span><b>{t(c("View report", "ดูรายงาน"))}</b></div>
      </div>
      <div className="bw-foot"><Lock size={12} />{t(c("Shared by the seller on 14 Sep · watermarked with your name", "ผู้ขายแชร์เมื่อ 14 ก.ย. · มีลายน้ำชื่อของท่าน"))}</div>
    </div>
  );
}

function P5() {
  const { t, lang } = useHomeLang();
  const deals: [C2, C2, number, C2, C2, boolean][] = [
    [c("Banyan Film & Packaging", "Banyan Film & Packaging"), c("Packaging · Bangkok", "บรรจุภัณฑ์ · กรุงเทพฯ"), 3, c("Letter of intent", "หนังสือแสดงเจตจำนง"), c("Waiting on you: send your letter of intent", "รอท่าน: ส่งหนังสือแสดงเจตจำนง"), true],
    [c("Project Saffron Table · PS-2431", "โครงการ Saffron Table · PS-2431"), c("Restaurants · Chiang Mai", "ร้านอาหาร · เชียงใหม่"), 1, c("NDA", "NDA"), c("Waiting on the seller: NDA review", "รอผู้ขาย: พิจารณา NDA"), false],
    [c("Rayong Precision Castings", "Rayong Precision Castings"), c("Metal castings · Rayong", "ชิ้นส่วนโลหะหล่อ · ระยอง"), 5, c("Legal", "กฎหมาย"), c("Waiting on the seller: legal questions", "รอผู้ขาย: ตอบคำถามด้านกฎหมาย"), false],
  ];
  return (
    <div className="bw">
      <Head icon={RouteIcon} eb={t(c("My Pipeline", "Pipeline ของฉัน"))} title={t(c("Tracking", "ติดตามดีล"))}
        right={<span className="bw-dd2">{t(c("All deals · 3", "ทุกดีล · 3"))}<ChevronDown size={11} /></span>} />
      <div className="bw-deals">
        {deals.map(([n, l, s, st, w, me]) => (
          <div key={n.en} className="bw-card bw-deal">
            <div className="bw-spread"><b>{t(n)}</b><small>{lang === "th" ? `ขั้นที่ ${s} จาก 7` : `Step ${s} of 7`}</small></div>
            <div className="bw-dl">{t(l)}</div>
            <div className="bw-steps">{Array.from({ length: 7 }, (_, i) => <i key={i} className={i + 1 < s ? "is-done" : i + 1 === s ? "is-cur" : undefined} />)}</div>
            <div className="bw-st"><b>{t(st)}</b><span className={me ? "is-me" : undefined}>{t(w)}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
type C2 = { en: string; th: string };
