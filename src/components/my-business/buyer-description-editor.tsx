import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { StandardInvestorCard } from '@/components/marketplace/standard-investor-card';
import type { CardInvestor } from '@/components/marketplace/buyer-browse-card';
import { Textarea } from '@/components/ui/textarea';
import { useTr } from '@/components/common/edit-info-popup';
import { buyerDescriptionError, descriptionWords, singleLineDescription } from '@/lib/buyer-description';

export function BuyerDescriptionEditor({ i, leaks, value, onChange, forced }: { i: CardInvestor; leaks: string[]; value: string; onChange: (value: string) => void; forced?: boolean }) {
  const L = useTr();
  const [touched, setTouched] = useState(false);
  const problem = buyerDescriptionError(value);
  const visibleProblem = problem === 'Write at least 10 characters.' && !touched && !forced ? null : problem;
  const message = visibleProblem || (leaks.length ? 'leak' : null);
  const root = useRef<HTMLDivElement>(null);
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
  return <div ref={root} className="buyer-description-layout">
    <div className="buyer-preview-col"><div className="buyer-preview-sticky"><p className="buyer-preview-caption"><Eye aria-hidden />{L('WHAT SELLERS SEE', 'สิ่งที่ผู้ขายเห็น')}</p><StandardInvestorCard i={i} descriptionContent={description} className="buyer-editor-preview" /></div></div>
    <section data-edit-sec="description" className="buyer-description-field">
      <h3>{L('Public Description', 'คำอธิบายสาธารณะ')}</h3>
      <div className="buyer-description-label"><label htmlFor="f-description">{L('Description', 'คำอธิบาย')} <span>{L('(1–2 sentences)', '(1–2 ประโยค)')}</span></label><span className={descriptionWords(value) > 25 ? 'buyer-description-error' : ''}>{descriptionWords(value)} / 25 {L('words','คำ')}</span></div>
      <Textarea id="f-description" value={value} onChange={(e) => onChange(singleLineDescription(e.target.value))} onBlur={() => setTouched(true)} onKeyDown={(e) => {if(e.key === 'Enter') e.preventDefault();}} aria-invalid={!!message} aria-describedby="buyer-description-help buyer-description-message" className="buyer-description-textarea" />
      <p id="buyer-description-help" className="buyer-description-help">{L("Up to 25 words. Leave out your firm's name, website and contact details.", 'ไม่เกิน 25 คำ โปรดอย่าระบุชื่อบริษัท เว็บไซต์ และข้อมูลติดต่อ')}</p>
      <div id="buyer-description-message" aria-live="polite">{message === 'leak' ? <p className="buyer-description-warning">{L('Your description mentions', 'คำอธิบายของท่านกล่าวถึง')} <b>{leaks.join(', ')}</b>{L('. Sellers read it before an NDA, so leave out names, websites and contact details.', ' ผู้ขายจะอ่านก่อนลงนาม NDA โปรดไม่ระบุชื่อ เว็บไซต์ และข้อมูลติดต่อ')}</p> : message ? <p className="buyer-description-error">{message === 'Keep it to 2 sentences.' ? L(message,'โปรดเขียนไม่เกิน 2 ประโยค') : message === 'Keep it to 25 words.' ? L(message,'โปรดเขียนไม่เกิน 25 คำ') : L(message,'โปรดเขียนอย่างน้อย 10 ตัวอักษร')}</p> : null}</div>
    </section>
  </div>;
}