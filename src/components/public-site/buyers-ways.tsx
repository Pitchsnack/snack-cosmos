import { BadgeCheck, Check, EyeOff, Flag, Lock, ShieldCheck } from "lucide-react";
import { B_PROMISES } from "./buyers-copy";
import { useHomeLang } from "./public-shell";

/** For buyers § 4: four wide cards, each with an illustrated badge and a drawn example of the app's card. */
const c = (en: string, th: string) => ({ en, th });
const SEALS = [Lock, ShieldCheck, Flag, BadgeCheck];

export function BuyersWays() {
  const { t } = useHomeLang();
  return (
    <section id="promises" className="ph-sec ph-white">
      <div className="ph-wrap">
        <div className="pb-phead"><h2>{t(B_PROMISES.h2)}</h2><p>{t(B_PROMISES.intro)}</p></div>
        <div className="bwy-grid">
          {B_PROMISES.cards.map((card, i) => {
            const Seal = SEALS[i]!;
            return (
              <div key={i} className={`bwy-card is-${i + 1}`}>
                <div className="bwy-badge" aria-hidden="true">
                  <BadgeArt n={i + 1} />
                  <span className="bwy-seal"><Seal size={19} strokeWidth={2.2} /></span>
                </div>
                <div className="bwy-text"><h3>{t(card.h)}</h3><p>{t(card.x)}</p></div>
                <div className="bwy-panel" aria-hidden="true"><div className="bwy-stage"><Drawing n={i + 1} /></div></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BadgeArt({ n }: { n: number }) {
  const H = "var(--bwy-hi)", T = "var(--bwy-tint)";
  return (
    <svg viewBox="0 0 104 104" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {n === 1 && <>
        <path d="M16 52c9-15 22-23 36-23s27 8 36 23c-9 15-22 23-36 23S25 67 16 52Z" fill="currentColor" fillOpacity=".14" />
        <path d="M16 52c9-15 22-23 36-23s27 8 36 23c-9 15-22 23-36 23S25 67 16 52Z" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="52" cy="52" r="12" fill="currentColor" /><circle cx="48" cy="48" r="3.5" fill={H} />
        <path d="M27 25 79 79" stroke={T} strokeWidth="10" /><path d="M27 25 79 79" stroke="currentColor" strokeWidth="3.5" />
      </>}
      {n === 2 && <>
        <path d="M30 16h30l16 16v52a5 5 0 0 1-5 5H30a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5Z" fill="currentColor" fillOpacity=".14" />
        <path d="M30 16h30l16 16v52a5 5 0 0 1-5 5H30a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="3.5" />
        <path d="M60 16v11a5 5 0 0 0 5 5h11" stroke="currentColor" strokeWidth="3.5" />
        <path d="M34 40h24M34 50h32M34 60h28M34 70h18" stroke="currentColor" strokeWidth="3.5" strokeOpacity=".55" />
      </>}
      {n === 3 && <>
        <path d="M22 82c0-22 30-14 30-32s30-10 30-32" fill="currentColor" fillOpacity=".14" />
        <path d="M22 82c0-22 30-14 30-32s30-10 30-32" stroke="currentColor" strokeWidth="4.5" strokeDasharray="1 9.5" />
        <circle cx="22" cy="82" r="6" fill="currentColor" />
        <circle cx="82" cy="18" r="7" fill={H} stroke="currentColor" strokeWidth="3.5" />
        <circle cx="35" cy="63" r="3" fill="currentColor" fillOpacity=".55" /><circle cx="52" cy="50" r="3" fill="currentColor" fillOpacity=".55" /><circle cx="69" cy="37" r="3" fill="currentColor" fillOpacity=".55" />
      </>}
      {n === 4 && <>
        <path d="M18 84h68" stroke="currentColor" strokeWidth="3.5" strokeOpacity=".55" />
        <rect x="22" y="58" width="11" height="22" rx="3" fill="currentColor" fillOpacity=".32" />
        <rect x="38" y="48" width="11" height="32" rx="3" fill="currentColor" fillOpacity=".32" />
        <rect x="54" y="52" width="11" height="28" rx="3" fill="currentColor" fillOpacity=".32" />
        <rect x="70" y="34" width="11" height="46" rx="3" fill="currentColor" />
        <path d="M27 46 43 35l16 6 17-19" stroke="currentColor" strokeWidth="3.5" />
      </>}
    </svg>
  );
}

function Drawing({ n }: { n: number }) {
  const { t } = useHomeLang();
  if (n === 1) return <>
    <i className="bwy-back" />
    <div className="bwy-ex">
      <div className="bwy-r1"><span className="bwy-pe">PE</span><div><span className="bwy-hidden"><Lock size={9} /></span><b>{t(c("Private Equity · INV-1001", "กองทุนไพรเวทอิควิตี้ · INV-1001"))}</b></div></div>
      <div className="bwy-kv"><span>{t(c("Ticket size", "ขนาดเงินลงทุน"))}</span><b>US$10M – 25M</b></div>
      <div className="bwy-kv"><span>{t(c("Geography", "ภูมิภาค"))}</span><b>{t(c("Thailand · SEA", "ไทย · อาเซียน"))}</b></div>
    </div>
    <div className="bwy-side"><span className="bwy-eye"><EyeOff size={28} /></span><em>{t(c("What the seller sees", "สิ่งที่ผู้ขายเห็น"))}</em></div>
  </>;
  if (n === 2) return <>
    <i className="bwy-back is-page" />
    <div className="bwy-ex is-page">
      <div className="bwy-nh"><ShieldCheck size={16} /><b>{t(c("Mutual NDA", "NDA แบบสองฝ่าย"))}</b></div>
      {[c("Keep it confidential", "เก็บข้อมูลเป็นความลับ"), c("Use it for this deal only", "ใช้เพื่อดีลนี้เท่านั้น"), c("No contact with staff or clients", "ไม่ติดต่อพนักงานหรือลูกค้า")].map((x) => <div key={x.en} className="bwy-nl"><Check size={11} strokeWidth={3} />{t(x)}</div>)}
      <div className="bwy-sig">
        <svg viewBox="0 0 90 26" width="76" height="22"><path d="M2 19c5-9 9-14 12-10s-3 12 2 12 8-15 12-14-1 12 3 12 6-9 10-8 3 7 7 6 6-5 9-6 6 2 9 1" fill="none" stroke="#1E3A8A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>{t(c("Signed 8 Oct 2026", "ลงนาม 8 ต.ค. 2569"))}</span>
      </div>
    </div>
    <div className="bwy-side"><span className="bwy-stamp"><i>{t(c("Signed", "ลงนาม"))}</i><b>2</b><i>{t(c("years", "ปี"))}</i></span></div>
  </>;
  if (n === 3) return <>
    <svg className="bwy-road" viewBox="0 0 150 140" overflow="visible">
      <path d="M8 132C34 126 30 96 62 88S112 70 116 40 132 22 138 16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeDasharray=".5 8.5" />
      <circle cx="8" cy="132" r="5" fill="currentColor" />
      <path d="M138 34V4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M138 5h18l-5 6 5 6h-18z" fill="currentColor" />
    </svg>
    <i className="bwy-back" />
    <div className="bwy-ex">
      <b className="bwy-deal">{t(c("Project B2B Packaging", "โครงการ B2B Packaging"))}</b>
      <div className="bwy-step">{t(c("Step 3 of 7 · Letter of intent", "ขั้นที่ 3 จาก 7 · หนังสือแสดงเจตจำนง"))}</div>
      <div className="bwy-dots">{[1, 2, 3, 4, 5, 6, 7].map((k) => <span key={k} className={k < 3 ? "is-done" : k === 3 ? "is-cur" : undefined}>{k < 3 ? <Check size={10} strokeWidth={3.4} /> : k}</span>)}</div>
      <div className="bwy-ends"><span>NDA</span><span>{t(c("Payment", "ชำระเงิน"))}</span></div>
    </div>
  </>;
  return <>
    <i className="bwy-back" />
    <div className="bwy-ex">
      <b className="bwy-deal">{t(c("Shrink film manufacturer", "ผู้ผลิตฟิล์มหดรายเก่าแก่"))}</b>
      <div className="bwy-vl">{t(c("Revenue FY21–25", "รายได้ ปี 2021–2025"))}</div>
      <div className="bwy-bars">{[34, 47, 59, 74, 100].map((h, i) => <i key={i} style={{ height: `${h}%` }} className={i === 4 ? "is-last" : undefined} />)}</div>
      <div className="bwy-bdg"><span className="is-g"><Check size={10} />Verified company</span><span className="is-v"><Check size={10} />Verified financials</span></div>
    </div>
    <div className="bwy-side">
      <svg viewBox="0 0 80 100" width="64" height="80" overflow="visible">
        <path d="M26 52 18 94l12-8 8 12 4-40M54 52l8 42-12-8-8 12-4-40" fill="currentColor" opacity=".85" />
        <polygon points="40.0,5.0 45.8,9.1 52.6,7.5 56.4,13.5 63.3,14.7 64.5,21.6 70.5,25.4 68.9,32.2 73.0,38.0 68.9,43.8 70.5,50.6 64.5,54.4 63.3,61.3 56.4,62.5 52.6,68.5 45.8,66.9 40.0,71.0 34.2,66.9 27.4,68.5 23.6,62.5 16.7,61.3 15.5,54.4 9.5,50.6 11.1,43.8 7.0,38.0 11.1,32.2 9.5,25.4 15.5,21.6 16.7,14.7 23.6,13.5 27.4,7.5 34.2,9.1" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="40" cy="38" r="22" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="2 3" opacity=".8" />
        <path d="M29 38.5l7.5 7.5L52 31" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <em className="bwy-ros">DBD FY21–25</em>
    </div>
  </>;
}
