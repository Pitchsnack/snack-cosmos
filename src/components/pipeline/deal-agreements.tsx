import { ChevronDown, FileSignature, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/language';
import { agreementDate, agreementTiming, showsAgreements } from '@/lib/agreement-dates';
import type { PipelineRow } from '@/lib/pipeline.functions';
import { useAgreementState } from './agreement-state';

export function DealAgreements({ p, seller, onNda, onLoi }: { p: PipelineRow; seller: boolean; onNda: () => void; onLoi: () => void }) {
  const state = useAgreementState();
  const { language } = useTranslation();
  const th = language === 'th';
  const c = (en: string, thai: string) => th ? thai : en;
  if (!state || state.today === null || !showsAgreements(p, state.today)) return null;
  const { today } = state;
  const expanded = state.expanded.has(p.id);
  const title = c('Agreements protecting this deal', 'ข้อตกลงที่คุ้มครองดีลนี้');
  const fmt = (value: string | null) => value ? agreementDate(value, th) : '—';
  const status = (timing: ReturnType<typeof agreementTiming>, end: string | null) => !timing ? c('End date not recorded', 'ยังไม่ได้บันทึกวันสิ้นสุด') : timing.daysLeft < 0 ? c(`Ended ${fmt(end)}`, `สิ้นสุดแล้ว ${fmt(end)}`) : timing.daysLeft === 0 ? c('Ends today', 'สิ้นสุดวันนี้') : timing.daysLeft <= 14 ? c(`Ends in ${timing.daysLeft} ${timing.daysLeft === 1 ? 'day' : 'days'}`, `สิ้นสุดใน ${timing.daysLeft} วัน`) : c(`Active · ${timing.daysLeft} days left`, `มีผลอยู่ · เหลือ ${timing.daysLeft} วัน`);
  const agreements = [
    { key: 'nda', name: 'NDA', unsigned: false, start: p.ndaApprovedAt, end: p.ndaStoredExpiresAt, subtitle: c('Term 2 years', 'อายุสัญญา 2 ปี'), endLabel: c('In force until', 'มีผลถึง'), Icon: ShieldCheck, onView: onNda },
    { key: 'loi', name: 'LOI', unsigned: !p.loiAcceptedAt, start: p.loiAcceptedAt, end: p.loiAcceptedAt ? p.exclusivityUntil : null, subtitle: !p.loiAcceptedAt ? c('Exclusivity from signing', 'สิทธิ์เจรจาแต่เพียงผู้เดียวเริ่มเมื่อลงนาม') : p.loiExclusivityDays === null ? c('Exclusivity', 'สิทธิ์เจรจาแต่เพียงผู้เดียว') : c(`Exclusivity ${p.loiExclusivityDays} days`, `สิทธิ์เจรจาแต่เพียงผู้เดียว ${p.loiExclusivityDays} วัน`), endLabel: c('Exclusive until', 'เจรจาแต่เพียงผู้เดียวถึง'), Icon: FileSignature, onView: onLoi },
  ].map(a => ({ ...a, timing: agreementTiming(a.start, a.end, today) }));
  const pill = (a: typeof agreements[number]) => <span className="agreement-status" data-tone={a.unsigned ? 'unsigned' : a.timing?.tone ?? 'ended'}>{a.unsigned ? c('Not signed yet', 'ยังไม่ได้ลงนาม') : status(a.timing, a.end)}</span>;
  const protection = (a: typeof agreements[number]) => {
    if (a.unsigned) return seller ? c(`Exclusivity starts on the day you accept ${p.counterparty.name}'s letter of intent.`, `สิทธิ์เจรจาแต่เพียงผู้เดียวเริ่มในวันที่คุณยอมรับหนังสือแสดงเจตจำนงของ ${p.counterparty.name}`) : c(`Exclusivity starts on the day ${p.counterparty.name} accepts your letter of intent.`, `สิทธิ์เจรจาแต่เพียงผู้เดียวเริ่มในวันที่ ${p.counterparty.name} ยอมรับหนังสือแสดงเจตจำนงของคุณ`);
    const ended = a.timing && a.timing.daysLeft < 0;
    if (a.key === 'nda') return ended ? c(`The NDA ended on ${fmt(a.end)}.`, `NDA สิ้นสุดเมื่อ ${fmt(a.end)}`) : c('Everything shared in this deal stays confidential: names, figures, reports and documents. No direct contact with staff, customers or suppliers.', 'ข้อมูลทั้งหมดที่แบ่งปันในดีลนี้เป็นความลับ ทั้งชื่อ ตัวเลข รายงาน และเอกสาร ห้ามติดต่อพนักงาน ลูกค้า หรือซัพพลายเออร์โดยตรง');
    if (ended) return c(`Exclusivity ended on ${fmt(a.end)}. The NDA still protects what was shared.`, `สิทธิ์เจรจาแต่เพียงผู้เดียวสิ้นสุดเมื่อ ${fmt(a.end)} NDA ยังคงคุ้มครองข้อมูลที่แบ่งปันไปแล้ว`);
    return seller ? c(`You don't negotiate this sale with other buyers until ${fmt(a.end)}. The letter stays confidential under the NDA.`, `คุณจะไม่เจรจาขายกิจการนี้กับผู้ซื้อรายอื่นจนถึง ${fmt(a.end)} หนังสือนี้เป็นความลับภายใต้ NDA`) : c(`${p.counterparty.name} doesn't negotiate this sale with other buyers until ${fmt(a.end)}. The letter stays confidential under the NDA.`, `${p.counterparty.name} จะไม่เจรจาขายกิจการนี้กับผู้ซื้อรายอื่นจนถึง ${fmt(a.end)} หนังสือนี้เป็นความลับภายใต้ NDA`);
  };
  return <section className="deal-agreements" data-expanded={expanded} aria-label={title}>
    <div className="agreement-header">
      <ShieldCheck size={15} aria-hidden="true" /><h2>{title}</h2>
      <span className="agreement-live" title={c('The days left update every day', 'จำนวนวันที่เหลืออัปเดตทุกวัน')}><i aria-hidden="true" />{c('Live', 'อัปเดตสด')}</span>
      {!expanded && agreements.map(a => <span className="agreement-summary" key={a.key}><b>{a.name}</b>{pill(a)}</span>)}
      <span className="agreement-spacer" />
      {expanded && <span className="agreement-today">{c('Today', 'วันนี้')} <b>{agreementDate(today * 86_400_000, th)}</b></span>}
      <Button variant="unstyled" className="agreement-toggle" aria-label={expanded ? c('Show less about the NDA and LOI', 'ย่อข้อมูล NDA และ LOI') : c('Show more about the NDA and LOI', 'แสดงข้อมูล NDA และ LOI เพิ่มเติม')} aria-expanded={expanded} aria-controls={`agreements-${p.id}`} onClick={() => state.toggle(p.id)}>{expanded ? c('less', 'ย่อลง') : c('more', 'เพิ่มเติม')}<ChevronDown size={14} aria-hidden="true" /></Button>
    </div>
    <div id={`agreements-${p.id}`} hidden={!expanded}>
      <p className="agreement-intro">{c(`Between you and ${p.counterparty.name}. They protect the sensitive information shared during this deal.`, `ระหว่างคุณและ ${p.counterparty.name} เพื่อคุ้มครองข้อมูลสำคัญที่แบ่งปันกันระหว่างดีลนี้`)}</p>
      <div className="agreement-grid">{agreements.map(a => <div key={a.key} className="agreement-tile" data-tone={a.unsigned ? 'unsigned' : a.timing?.tone ?? 'ended'} role="group" aria-label={a.unsigned ? `${a.name}: ${c('Not signed yet', 'ยังไม่ได้ลงนาม')}. ${protection(a)}` : `${a.name}: ${status(a.timing, a.end)}. ${c('Signed', 'ลงนาม')} ${fmt(a.start)}, ${a.endLabel} ${fmt(a.end)}.`}>
        <div className="agreement-tile-header"><span className="agreement-icon" data-kind={a.key}><a.Icon size={16} aria-hidden="true" /></span><div className="agreement-name"><b>{a.name}</b><small>{a.subtitle}</small></div>{pill(a)}</div>
        {(a.timing || a.unsigned) && <div className="agreement-bar" aria-hidden="true">{!a.unsigned && <><span ref={el => { if (el) el.style.width = `${(a.timing?.progress ?? 0) * 100}%`; }} /><i ref={el => { if (el) el.style.left = `${(a.timing?.progress ?? 0) * 100}%`; }} /></>}</div>}
        <div className="agreement-dates"><span>{c('Signed', 'ลงนาม')} <b>{fmt(a.start)}</b></span><span>{a.endLabel} <b>{fmt(a.end)}</b></span></div>
        <p>{protection(a)}</p>
        {!a.unsigned && <Button variant="unstyled" className="agreement-view" onClick={a.onView}>{c(`View ${a.name}`, `ดู ${a.name}`)}</Button>}
      </div>)}</div>
    </div>
  </section>;
}