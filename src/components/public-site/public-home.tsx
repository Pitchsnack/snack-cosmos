import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, ChartNoAxesColumn, ChevronDown, CircleCheck, ClipboardList, Database, EyeOff, FileText, Loader, Lock, MapPin, Shield, Star, User, Users,
} from "lucide-react";
import { getHomeHeroImages } from "@/lib/home-hero.functions";
import { BADGES, CLOSE, CONNECT, FAQ, FIT, HERO, HOW, PLANS, ROLE, WHY, type Plan } from "./home-copy";
import { PublicShell, Rich, useHomeLang } from "./public-shell";

export function PublicHome() {
  return (
    <PublicShell current="home">
      <Hero />
      <Connect />
      <How />
      <Badges />
      <Why />
      <Fit />
      <Plans />
      <Role />
      <Faq />
      <Close />
    </PublicShell>
  );
}

export function Head({ h, intro, center }: { h: string; intro?: string; center?: boolean }) {
  return (
    <div className={`ph-head${center ? " is-center" : ""}`}>
      <h2><Rich s={h} /></h2>
      {intro && <p><Rich s={intro} /></p>}
    </div>
  );
}
function Buttons() {
  const { t } = useHomeLang();
  return (
    <div className="ph-btns">
      <a href="/sellers" className="ph-red">{t(HERO.own)}</a>
      <a href="/buyers" className="ph-outline ph-outline-lg">{t(HERO.acquire)}</a>
    </div>
  );
}

/* --------------------------------- Hero --------------------------------- */

function Hero() {
  const { t } = useHomeLang();
  return (
    <section id="top" className="ph-hero">
      <div className="ph-hero-bg" aria-hidden />
      <div className="ph-wrap ph-hero-grid">
        <p className="ph-chip"><Rich s={t(HERO.chip)} /></p>
        <div className="ph-hero-copy">
          <h1><Rich s={t(HERO.h1)} /></h1>
          <p className="ph-hero-intro">{t(HERO.intro)}</p>
          <Buttons />
        </div>
        <HeroArt />
        <p className="ph-fine">{t(HERO.fine)}</p>
      </div>
    </section>
  );
}

function HeroArt() {
  const { t } = useHomeLang();
  const fetchImgs = useServerFn(getHomeHeroImages);
  const [imgs, setImgs] = useState<{ seller: string | null; investor: string | null }>({ seller: null, investor: null });
  const [open, setOpen] = useState<"s" | "i" | null>(null);
  useEffect(() => { fetchImgs().then(setImgs).catch(() => {}); }, [fetchImgs]);
  const tap = (k: "s" | "i") => (e: React.MouseEvent) => {
    if (!window.matchMedia("(hover: none)").matches) return;
    e.preventDefault();
    setOpen((v) => (v === k ? null : k));
  };
  const chev = <span className="ph-chev"><ChevronDown size={13} /></span>;
  return (
    <div className="ph-art" aria-hidden>
      <svg className="ph-art-line" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M31 30 C31 43 50 37 50 50 C50 63 69 57 69 70" /></svg>
      <div className="ph-orbit" /><div className="ph-pulse" />
      <div className="ph-tile"><img src="/img/pitchsnack-hat.svg" alt="" /></div>
      <div className="ph-report">
        <b>{t(HERO.reportTitle)}</b>
        <span className="ph-dots"><i /><i /><i /><i /><i /><i className="is-red" /></span>
        <small>{t(HERO.reportLine)}</small>
      </div>
      <div className="ph-pills"><span className="ph-pill1">{t(HERO.pill1)}</span><span className="ph-pill2">{t(HERO.pill2)}</span></div>
      <p className="ph-hint"><span className="ph-hint-m">{t(HERO.hintMouse)}</span><span className="ph-hint-t">{t(HERO.hintTouch)}</span></p>

      <div className={`ph-card ph-card-s${open === "s" ? " is-open" : ""}`} onClick={tap("s")}>
        <div className="ph-photo" style={imgs.seller ? { backgroundImage: `url("${imgs.seller}")` } : undefined}>
          <span className="ph-pchip"><Lock size={11} />{t(HERO.sChip)}<em>{t(HERO.sTag)}</em></span>
          <span className="ph-star"><Star size={13} /></span>
        </div>
        <div className="ph-body">
          <div className="ph-ctitle">{t(HERO.sTitle)}</div>
          <div className="ph-rev"><small>{t(HERO.sRev)}</small><b>฿250M – 500M</b><span className="ph-rtag">{t(HERO.sRange)}</span>{chev}</div>
          <div className="ph-more"><div>
            <p className="ph-details">{t(HERO.sDetails)}</p>
            <p className="ph-cfoot">{t(HERO.sFooter)} · PS-1005</p>
          </div></div>
        </div>
      </div>

      <div className={`ph-card ph-card-i${open === "i" ? " is-open" : ""}`} onClick={tap("i")}>
        <div className="ph-photo" style={imgs.investor ? { backgroundImage: `url("${imgs.investor}")` } : undefined}>
          <span className="ph-pchip"><EyeOff size={11} />{t(HERO.iChip)}</span>
          <span className="ph-star"><Star size={13} /></span>
        </div>
        <div className="ph-body">
          <div className="ph-itop"><b>{t(HERO.iType)}</b><small>INV-1001</small></div>
          <div className="ph-more"><div>
            <div className="ph-cells">
              <div><small>{t(HERO.iTicket)}</small><b>US$10M – 25M</b><small>(฿300M – 800M)</small></div>
              <div><small>AUM</small><b>US$250M – 500M</b><small>(฿8B – 15B)</small></div>
            </div>
          </div></div>
          <div className="ph-minbox"><small>{t(HERO.iMin)}</small><div><b>US$8M – 15M</b><small>(฿250M – 500M)</small>{chev}</div></div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Sections ------------------------------- */

function Connect() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-white">
      <div className="ph-wrap">
        <Head h={t(CONNECT.h2)} intro={t(CONNECT.intro)} />
        <div className="ph-connect">
          {CONNECT.cards.map((c) => (
            <div key={c.kind} className={`ph-ccard is-${c.kind}`}>
              <div className="ph-eyebrow ph-ccard-label">{t(c.label)}</div>
              <h3>{t(c.h)}</h3>
              <ul>{c.ticks.map((x, i) => <li key={i}><span>✓</span>{t(x)}</li>)}</ul>
              <a href={c.to} className="ph-cbtn">{t(CONNECT.more)}<ArrowRight size={16} /></a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEP_ICONS = [
  <svg key="1" viewBox="0 0 24 24" fill="none" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" overflow="visible"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="var(--g)" fillOpacity=".16" stroke="var(--g)" /><path d="m8.7 12.2 2.3 2.3 4.6-4.8" stroke="var(--g)" strokeWidth="1.75" /></svg>,
  <svg key="2" viewBox="0 0 24 24" fill="none" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" overflow="visible"><circle cx="7.6" cy="7.8" r="3.1" fill="var(--g)" fillOpacity=".16" stroke="var(--g)" /><path d="M1.8 20.5c0-3.9 2.6-6.6 5.8-6.6s5.8 2.7 5.8 6.6" fill="var(--g)" fillOpacity=".16" stroke="var(--g)" /><path d="M10.6 20.5c0-3.9 2.6-6.6 5.8-6.6s5.8 2.7 5.8 6.6V22H10.6z" fill="var(--node-bg)" /><circle cx="16.4" cy="7.8" r="3.1" fill="var(--b)" fillOpacity=".16" stroke="var(--b)" /><path d="M10.6 20.5c0-3.9 2.6-6.6 5.8-6.6s5.8 2.7 5.8 6.6" fill="var(--b)" fillOpacity=".16" stroke="var(--b)" /></svg>,
  <svg key="3" viewBox="0 0 24 24" fill="none" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" overflow="visible"><path d="M13.4 2.8H6.6a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h8.9a2 2 0 0 0 2-2V6.9z" fill="var(--v)" fillOpacity=".16" stroke="var(--v)" /><path d="M13.4 2.8v4.1h4.1" stroke="var(--v)" /><path d="M7.8 9.6h5.2M7.8 12.6h3.2" stroke="var(--v)" strokeOpacity=".6" /><circle cx="15.4" cy="15.7" r="4.3" fill="var(--node-bg)" /><circle cx="15.4" cy="15.7" r="4.3" fill="var(--v)" fillOpacity=".16" stroke="var(--v)" strokeWidth="1.75" /><path d="m18.6 18.9 2.9 2.9" stroke="var(--v)" strokeWidth="2.2" /></svg>,
  <svg key="4" viewBox="0 0 24 24" fill="none" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" overflow="visible"><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" stroke="var(--g)" /><path d="M3 4h8" stroke="var(--g)" /><path d="m11 17 2 2a1 1 0 1 0 3-3" stroke="var(--g)" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" stroke="var(--b)" /><path d="m21 3 1 11h-2z" fill="var(--b)" fillOpacity=".16" stroke="var(--b)" /></svg>,
  <svg key="5" viewBox="0 0 24 24" fill="none" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" overflow="visible"><path d="M14.2 21.2H6.5a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2h7l4 4v2.7" fill="var(--t)" fillOpacity=".16" stroke="var(--t)" /><path d="M13.5 2.8v4h4" stroke="var(--t)" /><path d="M7.6 9h4.6M7.6 12h3" stroke="var(--t)" strokeOpacity=".6" /><path d="M7.2 17.5c.9-1.5 1.6-1.6 2-.4.3.9.9 1 1.5-.1.4-.7.9-.7 1.5.1" stroke="var(--t)" /><path d="M19.3 9.9a1.8 1.8 0 0 1 2.6 2.6l-6.5 6.5-3.4.9.9-3.4z" fill="var(--node-bg)" /><path d="M19.3 9.9a1.8 1.8 0 0 1 2.6 2.6l-6.5 6.5-3.4.9.9-3.4z" fill="var(--a)" fillOpacity=".16" stroke="var(--a)" /></svg>,
];
const HUES = ["g", "b", "v", "t", "t"];

function How() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-grey">
      <div className="ph-wrap">
        <Head h={t(HOW.h2)} intro={t(HOW.intro)} center />
        <div className="ph-how">
          <svg className="ph-lanes" viewBox="0 0 1000 188" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="ps-fade-screen" gradientUnits="userSpaceOnUse" x1="525" y1="0" x2="615" y2="0"><stop offset="0" stopColor="var(--b)" /><stop offset="1" stopColor="var(--b)" stopOpacity="0" /></linearGradient>
              <linearGradient id="ps-fade-match" gradientUnits="userSpaceOnUse" x1="325" y1="0" x2="415" y2="0"><stop offset="0" stopColor="var(--b)" /><stop offset="1" stopColor="var(--b)" stopOpacity="0" /></linearGradient>
            </defs>
            <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="url(#ps-fade-match)" strokeWidth="3" d="M14 176H415" />
              <path stroke="url(#ps-fade-screen)" strokeWidth="3" d="M14 164H615" />
              <path stroke="var(--g)" d="M14 12H540C603 12 597 82 660 82" />
              <path stroke="var(--b)" d="M14 152H540C603 152 597 82 660 82" />
              <path stroke="var(--t)" d="M660 82H984" />
              <path stroke="var(--t)" d="M975 72 988 82 975 92" />
            </g>
          </svg>
          <div className="ph-lane-pills"><span className="ph-lp-owner">{t(HOW.owner)}</span><span className="ph-lp-buyers">{t(HOW.buyers)}</span></div>
          <ol className="ph-steps">
            {HOW.steps.map((s, i) => (
              <li key={i} className={`ph-step s${i + 1}`}>
                <div className="ph-node" tabIndex={0} style={{ ["--hue" as string]: `var(--${HUES[i]})` }} aria-label={t(s.tip)}>
                  {STEP_ICONS[i]}
                  <span className="ph-tip" role="tooltip">{t(s.tip)}</span>
                </div>
                {i === 3 && <svg className="ph-join" viewBox="0 0 80 50" aria-hidden><path stroke="var(--g)" d="M3.5 0C3.5 27 40 23 40 50" /><path stroke="var(--b)" d="M76.5 0C76.5 27 40 23 40 50" /></svg>}
                <div className="ph-step-tx">
                  <span className="ph-num">0{i + 1}</span>
                  <b>{t(s.t)}</b>
                  <p>{t(s.x)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const TILE_ICONS = [
  <svg key="1" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27" stroke="#21B729" strokeWidth="5" /><path d="M20 33l8 8 16-17" stroke="#21B729" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="2" viewBox="0 0 64 64" fill="none"><path d="M17 7h22l10 10v38a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z" stroke="#1786FF" strokeWidth="4" strokeLinejoin="round" /><path d="M39 7v10h10" stroke="#1786FF" strokeWidth="4" strokeLinejoin="round" /><path d="M22 28h20M22 37h20M22 46h13" stroke="#1786FF" strokeWidth="4" strokeLinecap="round" /></svg>,
  <svg key="3" viewBox="0 0 64 64" fill="none"><ellipse cx="32" cy="54" rx="17" ry="5" stroke="#E31B17" strokeWidth="3.5" /><path d="M32 52S14 34.5 14 23a18 18 0 0 1 36 0c0 11.5-18 29-18 29z" fill="#E31B17" /><circle cx="32" cy="23" r="7" fill="#fff" /></svg>,
  <svg key="4" viewBox="0 0 64 64" fill="none"><rect x="10" y="6" width="38" height="48" rx="2" stroke="#333" strokeWidth="3.5" fill="#fff" /><rect x="15" y="15" width="28" height="8" fill="#6BD224" /><text x="29" y="21.2" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="5.6" fontWeight="700" fill="#fff">LICENCE</text><path d="M17 31h24M17 38h18" stroke="#9AA3AF" strokeWidth="3" strokeLinecap="round" /><circle cx="47" cy="50" r="10" fill="#35C929" stroke="#fff" strokeWidth="2.5" /><path d="M42.5 50.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="5" viewBox="0 0 64 64"><path d="M32 5l8.3 17.4 19 2.4-14 13.2 3.6 18.9L32 47.6 15.1 56.9l3.6-18.9-14-13.2 19-2.4z" fill="#E19A00" /></svg>,
];
const SELLER_ICONS = [CircleCheck, FileText, Users, Shield, MapPin];
const BUYER_ICONS = [User, ClipboardList, Database, ChartNoAxesColumn];

function Badges() {
  const { t } = useHomeLang();
  const panel = (p: typeof BADGES.seller, icons: typeof SELLER_ICONS, kind: string) => (
    <div className={`ph-panel is-${kind}`}>
      <div className="ph-panel-label">{t(p.label)}</div>
      <h3>{t(p.h)}</h3>
      <i className="ph-panel-bar" />
      {p.rows.map(([n, x], i) => {
        const I = icons[i]!;
        return (
          <div key={i} className="ph-prow">
            <span className="ph-picon"><I size={18} fill={kind === "seller" && i === 0 ? "currentColor" : "none"} color={kind === "seller" && i === 0 ? undefined : "currentColor"} className={kind === "seller" && i === 0 ? "ph-filled" : undefined} /></span>
            <span><b>{t(n)}</b><small>{t(x)}</small></span>
          </div>
        );
      })}
    </div>
  );
  return (
    <section id="badges" className="ph-sec ph-badges">
      <div className="ph-wrap">
        <h2 className="ph-bh2">{t(BADGES.h2)}</h2>
        <p className="ph-bintro">{t(BADGES.intro)}</p>
        <div className="ph-tiles">
          {BADGES.tiles.map((b, i) => (
            <div key={b.name} className="ph-btile">
              <div className="ph-bicon">{TILE_ICONS[i]}{i === 4 && <span className="ph-paid">PAID</span>}</div>
              <b>{b.name}</b>
              <i />
              <p><Rich s={t(b.x)} /></p>
            </div>
          ))}
        </div>
        <div className="ph-panels">
          {panel(BADGES.seller, SELLER_ICONS, "seller")}
          {panel(BADGES.buyer, BUYER_ICONS, "buyer")}
        </div>
      </div>
    </section>
  );
}

function Why() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-grey">
      <div className="ph-wrap">
        <Head h={t(WHY.h2)} intro={t(WHY.intro)} />
        <div className="ph-stats">
          {WHY.cards.map(([n, x]) => <div key={n} className="ph-stat"><b>{n}</b><p>{t(x)}</p></div>)}
        </div>
        <p className="ph-sources">{t(WHY.sources)}</p>
      </div>
    </section>
  );
}

function Fit() {
  const { t } = useHomeLang();
  return (
    <section id="fit" className="ph-sec ph-white">
      <div className="ph-wrap">
        <Head h={t(FIT.h2)} intro={t(FIT.intro)} />
        <div className="ph-fit">
          {FIT.cards.map(([w, h, x], i) => <div key={i} className="ph-stat is-fit"><b>{t(w)}</b><h3>{t(h)}</h3><p>{t(x)}</p></div>)}
        </div>
        <p className="ph-sectors-l">{t(FIT.sectorsLabel)}</p>
        <div className="ph-sectors">{FIT.sectors.map((s, i) => <span key={i}>{t(s)}</span>)}</div>
      </div>
    </section>
  );
}

export function PlanCard({ p, owner }: { p: Plan; owner: boolean }) {
  const { t } = useHomeLang();
  const price = typeof p.price === "string" ? p.price : t(p.price);
  return (
    <div className={`ph-plan is-${p.id}`}>
      <span className="ph-pbadge">{p.id === "promo" && <Loader size={12} />}{t(p.badge)}</span>
      <div className="ph-pname">{p.name}</div>
      <div className="ph-pprice">{price}{p.unit && <small> {t(p.unit)}</small>}</div>
      {owner && p.fee && <div className="ph-pfee"><b>{p.fee}</b> {t(PLANS.fee)}</div>}
      <p className="ph-pintent">{t(p.intent)}</p>
      <ul className="ph-ppoints">{p.points.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
      <div className="ph-plimit">{t(p.limit)}</div>
    </div>
  );
}

function Plans() {
  const { t } = useHomeLang();
  return (
    <section id="plans-brief" className="ph-sec ph-grey">
      <div className="ph-wrap">
        <div className="ph-plans-head">
          <div className="ph-plans-l">
            <span className="ph-epill">{t(PLANS.eyebrow)}</span>
            <h2>{t(PLANS.h2)}</h2>
            <p>{t(PLANS.intro)}</p>
          </div>
          <div className="ph-note"><b>{t(PLANS.noteT)}</b><p>{t(PLANS.noteX)}</p></div>
        </div>
        <div className="ph-principles">{PLANS.principles.map(([h, x], i) => <div key={i}><b>{t(h)}</b><p>{t(x)}</p></div>)}</div>
        <div className="ph-group"><h3>{t(PLANS.ownersH)}</h3><p>{t(PLANS.ownersLine)}</p></div>
        <div className="ph-owners">{PLANS.owners.map((p) => <PlanCard key={p.id} p={p} owner />)}</div>
        <div className="ph-group"><h3>{t(PLANS.buyersH)}</h3><p>{t(PLANS.buyersLine)}</p></div>
        <div className="ph-buyers">{PLANS.buyers.map((p) => <PlanCard key={p.id} p={p} owner={false} />)}</div>
        <div className="ph-navybox">
          <div><h3>{t(PLANS.boxH)}</h3><p>{t(PLANS.boxX)}</p></div>
          <div className="ph-navychip"><b>{t(PLANS.chipT)}</b><p>{t(PLANS.chipX)}</p></div>
        </div>
        <div className="ph-pfine"><span>{t(PLANS.fine)}</span><a href="/plans">{t(PLANS.link)}</a></div>
      </div>
    </section>
  );
}

function Role() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-navy">
      <div className="ph-wrap">
        <Head h={t(ROLE.h2)} intro={t(ROLE.intro)} />
        <div className="ph-roles">{ROLE.cards.map(([h, x], i) => <div key={i} className="ph-role"><b>{t(h)}</b><p>{t(x)}</p></div>)}</div>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useHomeLang();
  return (
    <section className="ph-sec ph-white">
      <div className="ph-wrap">
        <Head h={t(FAQ.h2)} />
        <div className="ph-faq">{FAQ.items.map(([q, a], i) => <div key={i}><h3>{t(q)}</h3><p>{t(a)}</p></div>)}</div>
      </div>
    </section>
  );
}

function Close() {
  const { t } = useHomeLang();
  return (
    <section id="close" className="ph-sec ph-navy ph-close">
      <div className="ph-wrap">
        <h2><Rich s={t(CLOSE.h2)} /></h2>
        <p>{t(CLOSE.x)}</p>
        <Buttons />
      </div>
    </section>
  );
}

export function ComingSoon({ title, nav }: { title: { en: string; th: string }; nav: Parameters<typeof PublicShell>[0]["current"] }) {
  return (
    <PublicShell current={nav}>
      <SoonBody title={title} />
    </PublicShell>
  );
}
function SoonBody({ title }: { title: { en: string; th: string } }) {
  const { t } = useHomeLang();
  return (
    <section className="ph-soon">
      <div className="ph-wrap">
        <h1>{t(title)}</h1>
        <p>{t({ en: "This page is coming soon.", th: "หน้านี้กำลังจะเปิดให้บริการเร็ว ๆ นี้" })}</p>
        <a href="/">{t({ en: "← Back to the homepage", th: "← กลับไปหน้าแรก" })}</a>
      </div>
    </section>
  );
}
