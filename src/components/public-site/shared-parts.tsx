/** Parts shared by the public For buyers and For sellers pages. */
import { useState, type ComponentType, type ReactNode } from "react";
import { Briefcase, Lock, Star } from "lucide-react";
import { B_CARD } from "./buyers-copy";
import { useHomeLang } from "./public-shell";

type C = { en: string; th: string };
type Icon = ComponentType<{ size?: number }>;

/** Sample listing card (picture only, hidden from screen readers), shown at 64%. */
export function ListingCard({ img }: { img: string | null }) {
  const { t } = useHomeLang();
  const [open, setOpen] = useState(true);
  return (
    <div className="pb-lstack" aria-hidden>
      <div className="pb-lzoom">
        <i className="pb-ghost pb-ghost-far" /><i className="pb-ghost pb-ghost-near" />
        <div className="pb-lcard">
          <div className="pb-lphoto" style={img ? { backgroundImage: `url("${img}")` } : undefined}>
            <span className="pb-lchip"><span><Lock size={14} />{t(B_CARD.chip)}</span><em>{t(B_CARD.tag)}</em></span>
            <span className="pb-lstar"><Star size={17} /></span>
          </div>
          <div className="pb-lbody">
            <div className="pb-ltitle">{t(B_CARD.title)}</div>
            <span className="pb-lnda"><Lock size={14} />{t(B_CARD.nda)}</span>
            <div className="pb-lrev"><small>{t(B_CARD.rev)}</small><b>฿50M – 100M</b><span>{t(B_CARD.range)}</span></div>
            <p className="pb-ldet">{t(B_CARD.details)}</p>
            {open && (
              <div className="pb-lmore">
                <p className="pb-ldesc">{t(B_CARD.desc)}</p>
                <div className="pb-lrow"><small>{t(B_CARD.products)}</small><div>{B_CARD.productChips.map((x) => <span key={x} className="pb-chip-p">{x}</span>)}</div></div>
                <div className="pb-lrow"><small>{t(B_CARD.markets)}</small><div>{B_CARD.marketChips.map((x) => <span key={x.en} className="pb-chip-m">{t(x)}</span>)}</div></div>
                <div className="pb-ldeal"><Briefcase size={17} />{t(B_CARD.deal)}</div>
              </div>
            )}
            <div className="pb-lfoot">
              <span>{t(B_CARD.footer)} · PS-1005</span>
              <button type="button" tabIndex={-1} onClick={() => setOpen((v) => !v)}>{t(open ? B_CARD.less : B_CARD.more)}<i className={open ? "is-up" : undefined} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PromiseCards({ h2, intro, cards, icons }: { h2: C; intro: C; cards: { img: string; h: C; x: C }[]; icons: Icon[] }) {
  const { t } = useHomeLang();
  return (
    <>
      <div className="pb-phead"><h2>{t(h2)}</h2><p>{t(intro)}</p></div>
      <div className="pb-promises">
        {cards.map((c, i) => {
          const I = icons[i]!;
          return (
            <div key={i} className={`pb-promise is-${i + 1}`}>
              <div className="pb-promise-pic" style={{ backgroundImage: `url("${c.img}")` }} aria-hidden />
              <span className="pb-ptile"><I size={25} /></span>
              <h3>{t(c.h)}</h3>
              <p>{t(c.x)}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Ticks({ items }: { items: C[] }) {
  const { t } = useHomeLang();
  return <ul className="pb-ticks">{items.map((x, i) => <li key={i}><span>✓</span>{t(x)}</li>)}</ul>;
}

/** Numbered ladder; the last step's circle is green. */
export function Ladder({ steps }: { steps: (readonly [C, C])[] }) {
  const { t } = useHomeLang();
  return (
    <ol className="pb-ladder">
      {steps.map(([h, x], i) => (
        <li key={i} className={i === steps.length - 1 ? "is-last" : undefined}>
          <span className="pb-circle">{i + 1}</span>
          <div><b>{t(h)}</b><p>{t(x)}</p></div>
        </li>
      ))}
    </ol>
  );
}

/** Navy cards each starting with a big figure. */
export function BigFigureCards({ cards }: { cards: (readonly [C, C, C])[] }) {
  const { t } = useHomeLang();
  return (
    <div className="pb-mandate">
      {cards.map(([n, h, x], i) => <div key={i} className="ph-role"><span className="pb-big">{t(n)}</span><b>{t(h)}</b><p>{t(x)}</p></div>)}
    </div>
  );
}

/** Report-style card: tag, big figure with a caption, title, line and dotted points. */
export function ReportCard({ kind, tag, fig, cap, h, line, points }: { kind: string; tag: C; fig: string; cap: ReactNode; h: C; line: C; points: C[] }) {
  const { t } = useHomeLang();
  return (
    <div className={`pb-ncard is-${kind}`}>
      <span className="pb-ntag">{t(tag)}</span>
      <div className="pb-nfig">{fig}</div>
      <div className="pb-ncap">{cap}</div>
      <b>{t(h)}</b>
      <p>{t(line)}</p>
      <ul>{points.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
    </div>
  );
}

/** Small card with a blue icon tile. */
export function IconCard({ icon: I, h, x }: { icon: Icon; h: C; x: C }) {
  const { t } = useHomeLang();
  return <div className="pb-tool"><span><I size={21} /></span><div><b>{t(h)}</b><p>{t(x)}</p></div></div>;
}
