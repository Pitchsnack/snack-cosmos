import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, EyeOff, FileText, Lock, MessageSquare, Scale, ShieldCheck, Star } from "lucide-react";
import { getHomeHeroImages } from "@/lib/home-hero.functions";
import { PLANS } from "./home-copy";
import { B_CARD, B_CLOSE, B_DEAL, B_FAQ, B_HERO, B_HOW, B_MANDATE, B_NUMBERS, B_PLANS, B_PROFILE, B_PROMISES } from "./buyers-copy";
import { Head, PlanCard } from "./public-home";
import { PublicShell, Rich, useHomeLang } from "./public-shell";
import { BigFigureCards, IconCard, Ladder, ReportCard, Ticks } from "./shared-parts";
import { BuyersHeroSlides } from "./buyers-hero";
import { BuyersWays } from "./buyers-ways";

const SIGNUP = "/signup?role=buyer";

type Imgs = { seller: string | null; investor: string | null };

export function BuyersPage({ initial }: { initial?: Imgs }) {
  const fetchImgs = useServerFn(getHomeHeroImages);
  const [imgs, setImgs] = useState<Imgs>(initial ?? { seller: null, investor: null });
  useEffect(() => { if (!initial?.seller) fetchImgs().then(setImgs).catch(() => {}); }, [fetchImgs, initial]);
  return (
    <PublicShell current="buyers" talkHref="#start">
      <Hero img={imgs.seller} />
      <BuyersWays />
      <How />
      <Mandate />
      <Numbers />
      <Deal />
      <Profile img={imgs.investor} />
      <Plans />
      <Faq />
      <Close />
    </PublicShell>
  );
}

function Hero({ img }: { img: string | null }) {
  const { t } = useHomeLang();
  return (
    <section id="top" className="ph-hero">
      <div className="ph-hero-bg" aria-hidden />
      <div className="ph-wrap ph-hero-grid">
        <p className="ph-chip"><Rich s={t(B_HERO.chip)} /></p>
        <div className="ph-hero-copy">
          <h1><Rich s={t(B_HERO.h1)} /></h1>
          <p className="ph-hero-intro">{t(B_HERO.intro)}</p>
          <div className="ph-btns">
            <a href={SIGNUP} className="ph-red">{t(B_HERO.red)}</a>
            <a href="#how" className="ph-outline ph-outline-lg">{t(B_HERO.outline)}</a>
          </div>
        </div>
        <BuyersHeroSlides img={img} />
      </div>
    </section>
  );
}

function How() {
  const { t } = useHomeLang();
  return (
    <section id="how" className="ph-sec ph-grey">
      <div className="ph-wrap pb-two">
        <div className="pb-text">
          <div className="pb-eyebig">{t(B_HOW.eyebrow)}</div>
          <h2>{t(B_HOW.h2)}</h2>
          <p className="pb-intro">{t(B_HOW.intro)}</p>
          <Ticks items={B_HOW.ticks} />
        </div>
        <Ladder steps={B_HOW.steps} />
      </div>
    </section>
  );
}

function Mandate() {
  const { t } = useHomeLang();
  return (
    <section id="mandate" className="ph-sec ph-navy">
      <div className="ph-wrap">
        <Head h={t(B_MANDATE.h2)} intro={t(B_MANDATE.intro)} />
        <BigFigureCards cards={B_MANDATE.cards} />
      </div>
    </section>
  );
}

function Numbers() {
  const { t } = useHomeLang();
  return (
    <section id="numbers" className="ph-sec ph-white">
      <div className="ph-wrap pb-two pb-numbers">
        <div className="pb-ncards">
          {B_NUMBERS.cards.map((c) => <ReportCard key={c.kind} kind={c.kind} tag={c.tag} fig={c.fig} cap={<>{t(c.cap)}<span>{t(c.capTag)}</span></>} h={c.h} line={c.line} points={c.points} />)}
        </div>
        <div className="pb-text">
          <div className="ph-eyebrow pb-muted">{t(B_NUMBERS.eyebrow)}</div>
          <h2>{t(B_NUMBERS.h2)}</h2>
          <p className="pb-intro">{t(B_NUMBERS.intro)}</p>
          <p className="pb-note">{t(B_NUMBERS.note)}</p>
        </div>
      </div>
    </section>
  );
}

const TOOL_ICONS = [FileText, MessageSquare, Scale];

function Deal() {
  const { t } = useHomeLang();
  return (
    <section id="deal" className="ph-sec ph-grey">
      <div className="ph-wrap">
        <Head h={t(B_DEAL.h2)} intro={t(B_DEAL.intro)} center />
        <ol className="pb-deal">
          {B_DEAL.steps.map(([h, x], i) => (
            <li key={i} className={i === 0 ? "is-done" : undefined}>
              <span className="pb-circle">{i + 1}</span>
              <div><b>{t(h)}</b><p>{t(x)}</p></div>
            </li>
          ))}
        </ol>
        <div className="pb-tools">
          {B_DEAL.tools.map(([h, x], i) => <IconCard key={i} icon={TOOL_ICONS[i]!} h={h} x={x} />)}
        </div>
      </div>
    </section>
  );
}

function Profile({ img }: { img: string | null }) {
  const { t } = useHomeLang();
  return (
    <section id="profile" className="ph-sec ph-white">
      <div className="ph-wrap pb-two">
        <div className="pb-text">
          <div className="ph-eyebrow pb-muted">{t(B_PROFILE.eyebrow)}</div>
          <h2>{t(B_PROFILE.h2)}</h2>
          <p className="pb-intro">{t(B_PROFILE.intro)}</p>
          <Ticks items={B_PROFILE.ticks} />
          <p className="pb-typel">{t(B_PROFILE.chipsLabel)}</p>
          <div className="pb-types">{B_PROFILE.types.map((x) => <span key={x}>{x}</span>)}</div>
        </div>
        <InvestorCard img={img} />
      </div>
    </section>
  );
}

function InvestorCard({ img }: { img: string | null }) {
  const { t } = useHomeLang();
  const [open, setOpen] = useState(false);
  const [star, setStar] = useState(false);
  const P = B_PROFILE;
  return (
    <div className="pb-icol">
      <div className="pb-icap"><span>{t(P.role)}</span>{t(P.caption)}</div>
      <div className="pb-icard">
        <div className="pb-icover" style={img ? { backgroundImage: `url("${img}")` } : undefined}>
          <span className="pb-ipill"><EyeOff size={12} />{t(P.pill)}</span>
          <button type="button" className={`pb-istar${star ? " is-on" : ""}`} aria-pressed={star} aria-label="Star" onClick={() => setStar((v) => !v)}><Star size={15} /></button>
        </div>
        <div className="pb-ibody">
          <div className="pb-itop"><b>{t(P.name)}</b><span>INV-1001<i>·</i><em>{t(P.country)}</em></span></div>
          <p className="pb-idesc">{t(P.desc)}</p>
          <div className="pb-ipanel">
            <div className="pb-icell"><small>{t(P.ticket)}</small><b>US$10M – 25M</b><small>(฿300M – 800M)</small></div>
            <div className="pb-icell"><small>{t(P.aum)}</small><b>US$250M – 500M</b><small>(฿8B – 15B)</small></div>
            <div className="pb-icell is-full is-min"><small>{t(P.min)}</small><b>US$8M – 15M</b><small>(฿250M – 500M)</small></div>
            <div className="pb-icell is-full"><small>{t(P.geo)}</small><span>{t(P.geoV)}</span></div>
            {open && <>
              <div className="pb-icell"><small>{t(P.deals)}</small><span>{t(P.dealsV)}</span></div>
              <div className="pb-icell"><small>{t(P.stages)}</small><span>{t(P.stagesV)}</span></div>
              <div className="pb-icell"><small>{t(P.verif)}</small><span className="is-ok"><ShieldCheck size={12} />{t(P.verifV)}</span></div>
              <div className="pb-icell"><small>{t(P.firm)}</small><span className="is-lock"><Lock size={12} />{t(P.firmV)}</span></div>
            </>}
          </div>
        </div>
        <button type="button" className="pb-imore" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {t(open ? P.less : P.more)}<ChevronDown size={12} className={open ? "ph-rot" : undefined} />
        </button>
      </div>
    </div>
  );
}

function Plans() {
  const { t } = useHomeLang();
  return (
    <section id="plans" className="ph-sec ph-grey">
      <div className="ph-wrap">
        <div className="ph-group pb-group0"><h3>{t(PLANS.buyersH)}</h3><p>{t(PLANS.buyersLine)}</p></div>
        <div className="ph-buyers">{PLANS.buyers.map((p) => <PlanCard key={p.id} p={p} owner={false} />)}</div>
        <div className="ph-pfine"><span>{t(B_PLANS.fine)}</span><a href="/plans">{t(B_PLANS.link)}</a></div>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-white">
      <div className="ph-wrap">
        <Head h={t(B_FAQ.h2)} />
        <div className="ph-faq">{B_FAQ.items.map(([q, a], i) => <div key={i}><h3>{t(q)}</h3><p>{t(a)}</p></div>)}</div>
      </div>
    </section>
  );
}

function Close() {
  const { t } = useHomeLang();
  return (
    <section id="start" className="ph-sec ph-navy ph-close">
      <div className="ph-wrap">
        <h2><Rich s={t(B_CLOSE.h2)} /></h2>
        <p>{t(B_CLOSE.x)}</p>
        <div className="ph-btns">
          <a href={SIGNUP} className="ph-red">{t(B_CLOSE.red)}</a>
          <a href="/#close" className="ph-outline ph-outline-lg">{t(B_CLOSE.outline)}</a>
        </div>
      </div>
    </section>
  );
}
