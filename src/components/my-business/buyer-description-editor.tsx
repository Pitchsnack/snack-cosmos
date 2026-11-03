import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FieldRow } from '@/components/common/listing-editor-fields';
import { LangTag } from '@/components/common/text-lang';
import { Eye, X } from 'lucide-react';
import { StandardInvestorCard } from '@/components/marketplace/standard-investor-card';
import type { CardInvestor } from '@/components/marketplace/buyer-browse-card';
import { Textarea } from '@/components/ui/textarea';
import { useTr } from '@/components/common/edit-info-popup';
import { buyerDescriptionError, descriptionWords, singleLineDescription } from '@/lib/buyer-description';

export const WANT_BUY_MAX = 80;
export const wantBuyLen = (v: string) => Array.from(v).length;

/** The pop-up that points at What you want to buy, only right after the setup wizard. Fixed overlay, so the dim covers all of Edit information. */
function WantTour({ anchor, onClose }: { anchor: HTMLElement | null; onClose: (focusField: boolean) => void }) {
  const L = useTr();
  const pop = useRef<HTMLDivElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Portal into Edit information's own box, so its focus trap accepts the pop-up's Continue.
  // That box is transformed, so fixed positions are relative to it, not the viewport.
  const host = anchor?.closest<HTMLElement>('[data-edit-info-body]')?.parentElement ?? null;
  useEffect(() => {
    if (!anchor) return;
    const measure = () => setRect(anchor.getBoundingClientRect());
    // Scroll Edit information so the field and the whole pop-up are in view (field near the top on a phone).
    const sc = anchor.closest<HTMLElement>('[data-edit-info-body]');
    if (sc) {
      const tabs = sc.querySelector<HTMLElement>('[data-sticky-tabs]');
      const top = anchor.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (tabs?.offsetHeight ?? 0) - 16;
      sc.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    measure();
    const again = window.setTimeout(measure, 420);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.clearTimeout(again); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [anchor]);
  useEffect(() => {
    // Focus lands on the pop-up's Continue, after Edit information's own auto-focus.
    const t = window.setTimeout(() => go.current?.focus({ preventScroll: true }), 200);
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); e.preventDefault(); onClose(false);
    };
    const down = (e: PointerEvent) => {
      if (pop.current?.contains(e.target as Node)) return;
      onClose(false); // the click itself still does what it normally does
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', down, true);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', down, true); };
  }, [onClose]);
  if (!anchor || !rect) return null;
  const width = Math.min(420, rect.width + 16);
  const left = Math.max(12, Math.min(rect.left - 4 - 8, window.innerWidth - width - 12));
  return createPortal(
    <>
      <div aria-hidden="true" className="buyer-want-tour-hole" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} />
      <div ref={pop} role="dialog" aria-labelledby="buyer-want-tour-t" aria-describedby="buyer-want-tour-s" className="buyer-want-tour-pop" style={{ top: rect.bottom + 8 + 12, left, width }}>
        <button type="button" className="buyer-want-tour-x" aria-label={L('Close', 'ปิด')} onClick={() => onClose(false)}><X className="h-4 w-4" aria-hidden /></button>
        <p id="buyer-want-tour-t" className="buyer-want-tour-t">{L('Last step: Acquisition target company', 'ขั้นตอนสุดท้าย: บริษัทเป้าหมายในการเข้าซื้อกิจการ')}</p>
        <p id="buyer-want-tour-s" className="buyer-want-tour-s">{L('Be specific about the type of company you want to acquire. Sellers will use this information to assess whether their business matches your criteria before deciding to contact you.', 'โปรดระบุประเภทบริษัทที่ท่านต้องการเข้าซื้อกิจการให้ชัดเจน ผู้ขายจะใช้ข้อมูลนี้ประเมินว่าธุรกิจของตนตรงกับเกณฑ์ของท่านหรือไม่ ก่อนตัดสินใจติดต่อท่าน')}</p>
        <div className="buyer-want-tour-f"><button type="button" ref={go} className="buyer-want-tour-go" onClick={() => onClose(true)}>{L('Continue', 'ดำเนินการต่อ')}</button></div>
      </div>
    </>,
    document.body,
  );
}

export function BuyerDescriptionEditor({ i, leaks, value, onChange, forced, children, suggest, source, lang, want, onWant, wantLeaks = [], tour }: { i: CardInvestor; leaks: string[]; value: string; onChange: (value: string) => void; forced?: boolean; children?: ReactNode; suggest?: () => void; source?: ReactNode; lang?: 'en' | 'th'; want: string; onWant: (value: string) => void; wantLeaks?: string[]; tour?: { open: boolean; close: (focusField: boolean) => void } }) {
  const L = useTr();
  const [touched, setTouched] = useState(false);
  const problem = buyerDescriptionError(value);
  const visibleProblem = problem === 'Write at least 10 characters.' && !touched && !forced ? null : problem;
  const message = visibleProblem || (leaks.length ? 'leak' : null);
  const root = useRef<HTMLDivElement>(null);
  // State, not a ref, so the tour re-renders once the anchor exists on first mount.
  const [wantAnchor, setWantAnchor] = useState<HTMLDivElement | null>(null);
  const wantBox = useRef<HTMLTextAreaElement>(null);
  const wantN = wantBuyLen(want);
  const wantOver = wantN > WANT_BUY_MAX;
  // One line that grows with the text; two lines on a phone come from CSS min-height.
  useEffect(() => {
    const el = wantBox.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [want]);
  const previous = useRef([value, i.ticketBand, i.aumBand, i.revBand, i.dealTypes.join('|'), i.geography]);
  useEffect(() => {
    const values = [value, i.ticketBand, i.aumBand, i.revBand, i.dealTypes.join('|'), i.geography];
    const selectors = ['.standard-card-description', '.standard-card-figure-row > div:first-child', '.standard-card-figure-row > div:nth-child(2)', '.standard-card-fit-row', '.standard-card-focus-row', '.standard-card-text-row'];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) values.forEach((v, index) => {
      if (v === previous.current[index]) return;
      const el = root.current?.querySelector<HTMLElement>(selectors[index]);
      if (!el) return;
      el.classList.remove('buyer-preview-hit'); void el.offsetWidth; el.classList.add('buyer-preview-hit');
    });
    previous.current = values;
  }, [value, i.ticketBand, i.aumBand, i.revBand, i.dealTypes.join('|'), i.geography]);
  const escaped = [...leaks].sort((a,b) => b.length-a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = escaped.length ? new RegExp(`(${escaped.join('|')})`, 'gi') : null;
  const description = !value.trim() ? <span className="buyer-preview-empty">{L('Your description shows here.', 'คำอธิบายของท่านจะแสดงที่นี่')}</span> : pattern ? value.split(pattern).map((part, index) => leaks.some((word) => word.toLowerCase() === part.toLowerCase()) ? <mark key={index}>{part}</mark> : part) : value;
  const wantLine = want.trim()
    ? <p className="standard-card-want" title={`${L('Wants to buy:', 'ต้องการซื้อ:')} ${want.trim()}`}><b>{L('Wants to buy:', 'ต้องการซื้อ:')}</b> {want.trim()}</p>
    : <p className="standard-card-want standard-card-want-empty"><b>{L('Wants to buy:', 'ต้องการซื้อ:')}</b> {L('what you want to buy', 'สิ่งที่ท่านต้องการซื้อ')}</p>;
  return <div ref={root} className="buyer-description-layout">
    <div className="buyer-preview-col"><div className="buyer-preview-sticky"><p className="buyer-preview-caption"><Eye aria-hidden />{L('What sellers see', 'สิ่งที่ผู้ขายเห็น')}</p><StandardInvestorCard i={i} descriptionContent={description} wantBuy={wantLine} className="buyer-editor-preview" /></div></div>
    <div className="buyer-description-fields"><section data-edit-sec="want" className="buyer-description-field buyer-want-field">
      <div ref={setWantAnchor} className="buyer-want-anchor">
      <FieldRow htmlFor="f-suggested_headline" label={L('What you want to buy', 'สิ่งที่ท่านต้องการซื้อ')} after={!source && <LangTag />} right={<span className={wantOver ? 'text-destructive font-semibold' : ''}>{wantN} / {WANT_BUY_MAX}</span>}>
      <textarea ref={wantBox} id="f-suggested_headline" lang={lang} rows={1} value={want} autoComplete="off"
        placeholder={L('e.g. Profitable logistics firm with its own distribution channel in main cities', 'เช่น บริษัทโลจิสติกส์ที่มีกำไร และมีช่องทางจัดจำหน่ายของตนเองในเมืองหลัก')}
        onChange={(e) => onWant(singleLineDescription(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        aria-invalid={wantOver || !!wantLeaks.length} aria-describedby="buyer-want-help buyer-want-message"
        className={`buyer-want-input ${wantOver ? 'buyer-want-invalid' : ''}`} />
      </FieldRow>
      </div>
      <p id="buyer-want-help" className="buyer-description-help" style={tour?.open ? { visibility: 'hidden' } : undefined}>{L("Sellers see it on your card in Browse investors. Admin reviews it before it's published.", 'ผู้ขายจะเห็นข้อความนี้บนการ์ดของท่านในหน้าค้นหานักลงทุน ผู้ดูแลระบบจะตรวจสอบก่อนเผยแพร่')}</p>
      <div id="buyer-want-message" aria-live="polite">{wantOver ? <p className="buyer-description-error">{L('Keep it to 80 characters.', 'โปรดเขียนไม่เกิน 80 ตัวอักษร')}</p> : wantLeaks.length ? <p className="buyer-description-warning">{L('It mentions', 'ข้อความกล่าวถึง')} <b>{wantLeaks.join(', ')}</b>{L('. Sellers read it before an NDA, so leave out names, websites and contact details.', ' ผู้ขายจะอ่านก่อนลงนาม NDA โปรดไม่ระบุชื่อ เว็บไซต์ และข้อมูลติดต่อ')}</p> : null}</div>
      {tour?.open && <WantTour anchor={wantAnchor} onClose={tour.close} />}
    </section><section data-edit-sec="description" className="buyer-description-field">
      <FieldRow htmlFor="f-description" label={<>{L('Description', 'คำอธิบาย')} <span className="buyer-label-explanation">{L('(1–2 sentences)', '(1–2 ประโยค)')}</span></>} after={!source && <LangTag />} source={source} suggest={suggest} right={<span className={descriptionWords(value) > 25 ? 'text-destructive font-semibold' : ''}>{descriptionWords(value)} / 25 {L('words','คำ')}</span>}>
      <Textarea id="f-description" lang={lang} value={value} onChange={(e) => onChange(singleLineDescription(e.target.value))} onBlur={() => setTouched(true)} onKeyDown={(e) => {if(e.key === 'Enter') e.preventDefault();}} aria-invalid={!!message} aria-describedby="buyer-description-help buyer-description-message" className="buyer-description-textarea" />
      </FieldRow>
      <p id="buyer-description-help" className="buyer-description-help">{L("Up to 25 words. Leave out your firm's name, website and contact details.", 'ไม่เกิน 25 คำ โปรดอย่าระบุชื่อบริษัท เว็บไซต์ และข้อมูลติดต่อ')}</p>
      <div id="buyer-description-message" aria-live="polite">{message === 'leak' ? <p className="buyer-description-warning">{L('Your description mentions', 'คำอธิบายของท่านกล่าวถึง')} <b>{leaks.join(', ')}</b>{L('. Sellers read it before an NDA, so leave out names, websites and contact details.', ' ผู้ขายจะอ่านก่อนลงนาม NDA โปรดไม่ระบุชื่อ เว็บไซต์ และข้อมูลติดต่อ')}</p> : message ? <p className="buyer-description-error">{message === 'Keep it to 2 sentences.' ? L(message,'โปรดเขียนไม่เกิน 2 ประโยค') : message === 'Keep it to 25 words.' ? L(message,'โปรดเขียนไม่เกิน 25 คำ') : L(message,'โปรดเขียนอย่างน้อย 10 ตัวอักษร')}</p> : null}</div>
    </section>{children}</div>
  </div>;
}
