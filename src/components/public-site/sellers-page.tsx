import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChartNoAxesColumn, EyeOff, LogOut, Scale, ShieldCheck, Target, Users } from "lucide-react";
import { getHomeHeroImages } from "@/lib/home-hero.functions";
import { PLANS } from "./home-copy";
import { S_BUYERS, S_CLOSE, S_FAQ, S_HERO, S_LOCK, S_PLANS, S_PRIVACY, S_PROMISES, S_REPORTS } from "./sellers-copy";
import { Head } from "./public-home";
import { PublicPlanCards } from "@/components/plans/plan-card";
import { HeroSlides } from "./hero-slides";
import { SELLER_HERO_PICS } from "./sellers-hero-pics";
import peCover from "@/assets/sellers/hero-pe-cover.jpg.asset.json";
import filmLine from "@/assets/sellers/sector-film-line.jpg.asset.json";
import { PublicShell, Rich, useHomeLang } from "./public-shell";
import { BigFigureCards, IconCard, Ladder, PromiseCards, ReportCard, Ticks } from "./shared-parts";

const SIGNUP = "/signup?role=seller";
type Imgs = { seller: string | null; investor: string | null };

export function SellersPage({ initial }: { initial?: Imgs }) {
  const fetchImgs = useServerFn(getHomeHeroImages);
  const [imgs, setImgs] = useState<Imgs>(initial ?? { seller: null, investor: null });
  useEffect(() => { if (!initial?.seller) fetchImgs().then(setImgs).catch(() => {}); }, [fetchImgs, initial]);
  return (
    <PublicShell current="sellers" talkHref="#start">
      <Hero img={imgs.seller} />
      <Promises />
      <Privacy />
      <Lock />
      <Reports />
      <Buyers />
      <Plans />
      <Faq />
      <Close />
    </PublicShell>
  );
}

const c = (en: string, th: string) => ({ en, th });
const CAPS = [
  c("Browse verified buyers and investors", "ดูรายชื่อผู้ซื้อและนักลงทุนที่ผ่านการตรวจสอบ"),
  c("Buyers see an anonymous profile, never your name", "ผู้ซื้อเห็นเพียงโปรไฟล์ไม่ระบุชื่อ ไม่เห็นชื่อของท่าน"),
  c("A verified buyer asks, and you approve before your name is shared", "ผู้ซื้อที่ผ่านการตรวจสอบขอข้อมูล และท่านอนุมัติก่อนเปิดเผยชื่อ"),
  c("Verified financials and a valuation, for a one-time fee", "รายงานการเงินที่ตรวจแล้วและการประเมินมูลค่า ชำระครั้งเดียว"),
  c("Talk to several buyers at once and follow each deal", "พูดคุยกับผู้ซื้อหลายรายพร้อมกัน และติดตามแต่ละดีล"),
];
const SLIDES = SELLER_HERO_PICS.map((h, i) => (
  <div key={i} className="ps-shero" dangerouslySetInnerHTML={{ __html: h.replaceAll("{{IMG0}}", peCover.url).replaceAll("{{IMG1}}", filmLine.url) }} />
));

function Hero(_: { img: string | null }) {
  const { t } = useHomeLang();
  return (
    <section id="top" className="ph-hero ps-sellers-hero">
      <div className="ph-hero-bg" aria-hidden />
      <div className="ph-wrap ph-hero-grid">
        <p className="ph-chip"><Rich s={t(S_HERO.chip)} /></p>
        <div className="ph-hero-copy">
          <h1><Rich s={t(S_HERO.h1)} /></h1>
          <p className="ph-hero-intro">{t(S_HERO.intro)}</p>
          <div className="ph-btns">
            <a href={SIGNUP} className="ph-red">{t(S_HERO.red)}</a>
            <a href="#plans" className="ph-outline ph-outline-lg">{t(S_HERO.outline)}</a>
          </div>
        </div>
        <HeroSlides captions={CAPS} slides={SLIDES} />
      </div>
    </section>
  );
}

function Promises() {
  return (
    <section id="promises" className="ph-sec ph-white">
      <div className="ph-wrap">
        <PromiseCards h2={S_PROMISES.h2} intro={S_PROMISES.intro} cards={S_PROMISES.cards} icons={[EyeOff, ShieldCheck, LogOut, ChartNoAxesColumn]} />
      </div>
    </section>
  );
}

function Privacy() {
  const { t } = useHomeLang();
  return (
    <section id="privacy" className="ph-sec ph-grey">
      <div className="ph-wrap pb-two">
        <div className="pb-text">
          <div className="ph-eyebrow pb-crim">{t(S_PRIVACY.eyebrow)}</div>
          <h2>{t(S_PRIVACY.h2)}</h2>
          <p className="pb-intro">{t(S_PRIVACY.intro)}</p>
          <Ticks items={S_PRIVACY.ticks} />
        </div>
        <Ladder steps={S_PRIVACY.steps} />
      </div>
    </section>
  );
}

function Lock() {
  const { t } = useHomeLang();
  return (
    <section id="no-lock-in" className="ph-sec ph-navy">
      <div className="ph-wrap">
        <Head h={t(S_LOCK.h2)} intro={t(S_LOCK.intro)} />
        <BigFigureCards cards={S_LOCK.cards} />
      </div>
    </section>
  );
}

function Reports() {
  const { t } = useHomeLang();
  return (
    <section id="reports" className="ph-sec ph-white">
      <div className="ph-wrap pb-two pb-numbers">
        <div className="pb-ncards">
          {S_REPORTS.cards.map((c) => <ReportCard key={c.kind} kind={c.kind} tag={c.tag} fig={c.fig} cap={<em className="pb-unit">{t(c.unit)}</em>} h={c.h} line={c.line} points={c.points} />)}
        </div>
        <div className="pb-text">
          <div className="ph-eyebrow pb-muted">{t(S_REPORTS.eyebrow)}</div>
          <h2>{t(S_REPORTS.h2)}</h2>
          <p className="pb-intro">{t(S_REPORTS.intro)}</p>
          <p className="pb-note">{t(S_REPORTS.note)}</p>
        </div>
      </div>
    </section>
  );
}

function Buyers() {
  const { t } = useHomeLang();
  return (
    <section id="buyers" className="ph-sec ph-grey">
      <div className="ph-wrap">
        <Head h={t(S_BUYERS.h2)} intro={t(S_BUYERS.intro)} center />
        <div className="ps-match">
          <div className="ps-bcards">
            {S_BUYERS.cards.map(([h, x], i) => <IconCard key={i} icon={[Users, ChartNoAxesColumn, ShieldCheck][i]!} h={h} x={x} />)}
          </div>
          <div className="ps-panel">
            <div className="ph-eyebrow">{t(S_BUYERS.panel)}</div>
            {S_BUYERS.rows.map(([h, x], i) => {
              const I = [Target, Bell, Scale][i]!;
              return <div key={i} className="ps-prow"><span><I size={21} /></span><div><b>{t(h)}</b><p>{t(x)}</p></div></div>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  const { t } = useHomeLang();
  return (
    <section id="plans" className="ph-sec ph-white">
      <div className="ph-wrap">
        <div className="ph-group pb-group0"><h3>{t(S_PLANS.h)}</h3><p>{t(PLANS.ownersLine)}</p></div>
        <div className="ph-owners"><PublicPlanCards role="seller" /></div>
        <div className="ph-pfine"><span>{t(PLANS.fine)}</span><a href="/plans">{t(PLANS.link)}</a></div>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-grey">
      <div className="ph-wrap">
        <Head h={t(S_FAQ.h2)} />
        <div className="ph-faq">{S_FAQ.items.map(([q, a], i) => <div key={i}><h3>{t(q)}</h3><p>{t(a)}</p></div>)}</div>
      </div>
    </section>
  );
}

function Close() {
  const { t } = useHomeLang();
  return (
    <section id="start" className="ph-sec ph-navy ph-close">
      <div className="ph-wrap">
        <h2><Rich s={t(S_CLOSE.h2)} /></h2>
        <p>{t(S_CLOSE.x)}</p>
        <div className="ph-btns">
          <a href={SIGNUP} className="ph-red">{t(S_CLOSE.red)}</a>
          <a href="/#close" className="ph-outline ph-outline-lg">{t(S_CLOSE.outline)}</a>
        </div>
      </div>
    </section>
  );
}
