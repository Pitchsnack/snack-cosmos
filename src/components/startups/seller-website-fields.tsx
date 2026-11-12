import { useRef, useState } from 'react';
import { Check, Circle, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SELLER_DESCRIPTION_LIMITS, type SellerDraft } from '@/lib/seller-wizard';
import { SELLER_SECTOR_EXAMPLES } from '@/lib/seller-sector-examples';
import { useTranslation } from '@/i18n/language';

import { displayedStrengths, fillEmptyStrengths, strengthCount, strengthRows, STRENGTH_MAX, wizardStrengthIdeas } from '@/lib/seller-strengths';
import { Loading } from "@/components/ui/PitchSnackLoader";
import { SectionBand, SectionHeading } from "@/components/setup/section-band";
const readDomainOf = (u: string) => u.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
import type { WebsiteField } from '@/lib/seller-website-enrich';
export type { WebsiteField } from '@/lib/seller-website-enrich';
export type ReadingState = 'waiting' | 'reading' | 'found' | 'empty';
export function AutoFilled() { const th = useTranslation().language === 'th'; return <span className="seller-auto-mark"><Sparkles size={12}/>{th ? 'กรอกอัตโนมัติ' : 'Auto-filled'}</span>; }
function Tags({ label, required, value, onChange, examples, who, where, sector, openSector, auto, th }: {
 label: string; required?: boolean; value: string[]; onChange: (v: string[]) => void; examples: string[]; who?: string[]; where?: string[]; sector: string | null; openSector: () => void; auto?: boolean; th: boolean;
}) {
 const [input, setInput] = useState(''); const root = useRef<HTMLDivElement>(null);
 const L = (en: string, thai: string) => th ? thai : en;
 const available = (list: string[]) => list.filter(x => !value.some(t => t.toLocaleLowerCase() === x.toLocaleLowerCase()));
 const add = (raw: string, example = false) => {
  const tag = raw.trim(); if (!tag || tag.length > 50 || value.length >= 5 || value.some(x => x.toLocaleLowerCase() === tag.toLocaleLowerCase())) return;
  onChange([...value, tag]); setInput('');
  requestAnimationFrame(() => {
   if (value.length === 4) { const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[data-remove-tag]'); buttons?.[buttons.length - 1]?.focus(); }
   else if (example) { const target = root.current?.querySelector<HTMLElement>('[data-example]') ?? root.current?.querySelector<HTMLElement>('input'); target?.focus(); }
  });
 };
 const ex = (list: string[]) => available(list).map(x => <Button key={x} data-example variant="unstyled" size="unstyled" className="seller-tag-example" aria-label={L(`Add ${x}`, `เพิ่ม ${x}`)} onClick={() => add(x, true)}><Plus size={13}/>{x}</Button>);
 const left = available(examples).length + available(who ?? []).length + available(where ?? []).length;
 return <div ref={root} className="seller-tag-section">
  <div className="seller-field-label"><span>{label}{required && <em>*</em>}{auto && <AutoFilled/>}</span><small>{!required && L('Optional · ', 'ไม่บังคับ · ')}{value.length}/5</small></div>
  <p className="seller-field-hint">{required ? L("Up to 5. Don't use your company or brand name.", 'สูงสุด 5 รายการ ห้ามใช้ชื่อบริษัทหรือชื่อแบรนด์') : L('Who you sell to and where.', 'ขายให้ใครและที่ไหน')}</p>
  <div className="seller-tag-input">{value.map(x => <span className="seller-value-tag" key={x}>{x}<Button data-remove-tag variant="unstyled" size="unstyled" aria-label={L(`Remove ${x}`, `ลบ ${x}`)} onClick={() => onChange(value.filter(t => t !== x))}><X size={12}/></Button></span>)}
   {value.length < 5 && <div className="seller-tag-entry"><input aria-label={label} maxLength={50} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); add(input); } }} placeholder={required ? value.length ? L('Add another product or service', 'เพิ่มสินค้าหรือบริการอื่น') : L('Type a product or service then click Add.', 'พิมพ์สินค้าหรือบริการ แล้วคลิก เพิ่ม') : value.length ? L('Add another market', 'เพิ่มตลาดอื่น') : L('Type a market then click Add.', 'พิมพ์ตลาด แล้วคลิก เพิ่ม')}/><Button variant="outline" size="sm" onClick={() => add(input)}>{L('Add','เพิ่ม')}</Button></div>}
  </div>
  {value.length < 5 && (!sector ? <p className="seller-examples">{L('Answer ', 'ตอบคำถาม ')}<Button variant="link" size="unstyled" onClick={openSector}>{L('Sector','กลุ่มอุตสาหกรรม')}</Button>{L(' to see examples for your business.', ' เพื่อดูแท็กแนะนำสำหรับธุรกิจของท่าน')}</p> : left > 0 && <div className="seller-examples" role="group" aria-label={L('Examples','แท็กแนะนำ')}>
   <div className="seller-examples-heading"><b>{required ? L(`Examples for ${sector}`, `แท็กแนะนำสำหรับ ${sector}`) : L('Examples','แท็กแนะนำ')}</b><span>{L('Click one to add it','คลิกเพื่อเพิ่ม')}</span></div>
   {required ? <div className="seller-example-chips">{ex(examples)}</div> : <>{available(who ?? []).length > 0 && <div className="seller-market-row"><b>{L('Who','ลูกค้า')}</b><div className="seller-example-chips">{ex(who ?? [])}</div></div>}{available(where ?? []).length > 0 && <div className="seller-market-row"><b>{L('Where','พื้นที่')}</b><div className="seller-example-chips">{ex(where ?? [])}</div></div>}</>}
  </div>)}
 </div>;
}
function Strengths({d,set,auto,edit,th}: {d:SellerDraft;set:(p:Partial<SellerDraft>)=>void;auto?:boolean;edit:()=>void;th:boolean}) {
 const refs = useRef<(HTMLInputElement | null)[]>([]);
 const L = (en:string,thai:string) => th ? thai : en;
 const shown = displayedStrengths(d,th);
 const count = strengthCount(d,true);
 const placeholders = th ? ['เช่น มีกำไรต่อเนื่องในช่วงห้าปีที่ผ่านมา','เช่น ยอดขายส่วนใหญ่มาจากลูกค้าประจำระยะยาว','เช่น ทีมงานมีประสบการณ์และพร้อมทำงานต่อหลังการขาย','จุดแข็งข้อที่ 4 (ไม่บังคับ)'] : ['e.g. Profitable for the last five years','e.g. Most sales come from long-term repeat customers','e.g. Experienced team that stays on after the sale','Strength 4 (optional)'];
 const suggest = () => {
  try {
   const result=fillEmptyStrengths(d,wizardStrengthIdeas(d,th),th);
   if(result.first < 0) throw new Error(L('No new strengths could be suggested.','ไม่สามารถแนะนำจุดแข็งเพิ่มเติมได้'));
   edit(); set(th ? {highlightsTh:result.rows}:{highlights:result.rows});
   requestAnimationFrame(() => refs.current[result.first]?.focus());
  } catch(error) { toast.error(error instanceof Error ? error.message : L('Could not suggest strengths.','ไม่สามารถแนะนำจุดแข็งได้')); }
 };
 return <section className="seller-tag-section seller-strengths" aria-labelledby="sw-strength-label">
  <div className="seller-field-label"><span id="sw-strength-label">{L('Strength 1, 2 and 3','จุดแข็งที่ 1, 2 และ 3')}<em>*</em>{auto && <AutoFilled/>}</span><div className="seller-strength-tools"><small>{count}/3</small><Button variant="unstyled" size="unstyled" className="seller-strength-suggest" aria-label={L('Suggest key business strengths','แนะนำจุดแข็งหลักของธุรกิจ')} disabled={count===3} onClick={suggest}><Sparkles size={15}/>{L('Suggest','แนะนำ')}</Button></div></div>
  <p className="seller-field-hint" id="sw-strength-hint">{th ? <>บอก<b className="seller-strength-three">สาม</b>สิ่งที่ทำให้ธุรกิจของท่านโดดเด่น โดยเน้นจุดแข็งหรือข้อได้เปรียบที่ผู้ซื้อให้ความสำคัญ</> : <>Share <b className="seller-strength-three">three</b> things that make your business stand out. Focus on the strengths or advantages a buyer would value.</>}</p>
  <div className="seller-strength-rows" role="group" aria-labelledby="sw-strength-label" aria-describedby="sw-strength-hint">{shown.map((value,i)=><label className="seller-strength-row" key={i}><span aria-hidden className={`seller-strength-mark ${value.trim() ? 'is-filled' : i===3 ? 'is-optional' : ''}`}>{value.trim() ? <Check size={13} strokeWidth={3}/> : i+1}</span><input ref={node=>{refs.current[i]=node;}} value={value} maxLength={STRENGTH_MAX} lang={th?'th':'en'} aria-label={i===3 ? L('Strength 4 (optional)','จุดแข็งข้อที่ 4 (ไม่บังคับ)') : L(`Strength ${i+1}`,`จุดแข็งที่ ${i+1}`)} aria-describedby="sw-strength-hint" aria-required={i<3} placeholder={placeholders[i]} onChange={event=>{const rows=strengthRows(th?d.highlightsTh:d.highlights);rows[i]=event.target.value;edit();set(th?{highlightsTh:rows}:{highlights:rows});}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();refs.current[i+1]?.focus();}}}/></label>)}</div>
 </section>;
}
export function SellerWebsiteFields({d, set, marks, edit, reading, readingStates, openSector}: {d: SellerDraft; set: (p: Partial<SellerDraft>) => void; marks: Partial<Record<WebsiteField, boolean>>; edit: (key: WebsiteField) => void; reading: boolean; readingStates?: ReadingState[]; openSector: () => void}) {
 const th = useTranslation().language === 'th'; const L = (en: string, thai: string) => th ? thai : en;
 const sector = SELLER_SECTOR_EXAMPLES.find(x => x.sector === d.sector);
 const pick = (v: [string,string]) => v[th ? 1 : 0];
 const short = th ? d.shortDescriptionTh || d.shortDescription || '' : d.shortDescription || d.shortDescriptionTh || '';
 const long = th ? d.longDescriptionTh || d.longDescription || '' : d.longDescription || d.longDescriptionTh || '';
 const products = th ? d.productTagsTh?.length ? d.productTagsTh : d.productTags ?? [] : d.productTags?.length ? d.productTags : d.productTagsTh ?? [];
 const markets = th ? d.marketTagsTh?.length ? d.marketTagsTh : d.marketTags ?? [] : d.marketTags?.length ? d.marketTags : d.marketTagsTh ?? [];
 if(reading) return <div className="grid min-h-[340px] place-items-center rounded-[12px] bg-muted/60 px-6"><Loading size="lg" message={L(`Reading ${readDomainOf(d.web)}… We'll fill in your description, tags and business highlights.`,`กำลังอ่าน ${readDomainOf(d.web)}… เราจะกรอกคำอธิบาย แท็ก และจุดเด่นของธุรกิจให้คุณ`)}/></div>;
 const text = (key: 'shortDescription'|'longDescription', value: string, label: string, placeholder: string, limit: number, rest?: string) => <div>
  <div className="seller-field-label"><label htmlFor={`sw-${key}`}>{label}{rest && <span className="font-normal text-muted-foreground"> — {rest}</span>}<em>*</em>{marks[key] && <AutoFilled/>}</label><small className={value.length > limit ? 'text-destructive' : ''}>{value.length.toLocaleString('en')}/{limit.toLocaleString('en')}</small></div>
  <textarea id={`sw-${key}`} className={`seller-description ${key === 'longDescription' ? 'is-long' : ''}`} aria-required value={value} placeholder={placeholder} onChange={e => {edit(key); set({[th ? `${key}Th` : key]: e.target.value});}}/>
 </div>;
 const bleed = '-mx-6 sm:-mx-9';
 return <div className="seller-description-fields-grouped">
  <SectionBand bleed={bleed}/>
  <section aria-labelledby="sw-tell-h"><SectionHeading id="sw-tell-h">{L('Tell buyers about your business','บอกผู้ซื้อเกี่ยวกับธุรกิจของคุณ')}</SectionHeading>
   <div className="grid gap-[14px]">
    {text('shortDescription',short,L('Short description','คำอธิบายสั้น'),L('One sentence: what you make or do, and for whom.','หนึ่งประโยค: ท่านผลิตหรือทำอะไร และทำให้ใคร'),SELLER_DESCRIPTION_LIMITS.short,L('a one-line summary','สรุปในหนึ่งบรรทัด'))}
    {text('longDescription',long,L('Long description','คำอธิบายแบบยาว'),L('What the business does, since when, how it sells and who its customers are.','ธุรกิจทำอะไร เริ่มตั้งแต่เมื่อไร ขายอย่างไร และลูกค้าคือใคร'),SELLER_DESCRIPTION_LIMITS.long,L('a fuller overview','ภาพรวมที่ละเอียดขึ้น'))}
   </div>
  </section>
  <SectionBand bleed={bleed}/>
  <section aria-labelledby="sw-tags-h"><SectionHeading id="sw-tags-h">{L('Add keywords that describe your business','เพิ่มคีย์เวิร์ดที่อธิบายธุรกิจของคุณ')}</SectionHeading>
   <div className="grid gap-[14px]">
    <Tags label={L('Product & Service Tags','แท็กสินค้าและบริการ')} required value={products} onChange={v => {edit('productTags');set(th ? {productTagsTh:v}:{productTags:v});}} auto={marks.productTags} examples={sector?.products.map(pick) ?? []} sector={sector ? th ? sector.thai : sector.sector : null} openSector={openSector} th={th}/>
    <Tags label={L('Market Tags','แท็กตลาด')} value={markets} onChange={v => {edit('marketTags');set(th ? {marketTagsTh:v}:{marketTags:v});}} auto={marks.marketTags} examples={[]} who={sector?.who.map(pick) ?? []} where={[L('Thailand','ประเทศไทย'), d.addr.province, L('ASEAN','อาเซียน'),L('Worldwide','ทั่วโลก')].filter(Boolean)} sector={sector ? th ? sector.thai : sector.sector : null} openSector={openSector} th={th}/>
   </div>
  </section>
  <SectionBand bleed={bleed}/>
  <section aria-labelledby="sw-hl-h"><SectionHeading id="sw-hl-h">{L('Business highlights','จุดเด่นของธุรกิจ')}</SectionHeading>
   <Strengths d={d} set={set} auto={marks.highlights} edit={()=>edit('highlights')} th={th}/>
  </section>
 </div>;
}
export function websiteMissing(d: SellerDraft, th: boolean) {
 const missing: string[] = [];
 if (!(d.shortDescription?.trim() || d.shortDescriptionTh?.trim())) missing.push(th ? 'คำอธิบายสั้น' : 'the short description');
 if (!(d.longDescription?.trim() || d.longDescriptionTh?.trim())) missing.push(th ? 'คำอธิบายแบบยาว' : 'the long description');
 if (!(d.productTags?.length || d.productTagsTh?.length)) missing.push(th ? 'แท็กสินค้าและบริการ 1 รายการ' : 'one Product & Service Tag');
 const remaining = 3-strengthCount(d,true);
 if(remaining) missing.push(th ? remaining===3 ? 'จุดแข็งหลักของธุรกิจ 3 ข้อ' : `จุดแข็งหลักของธุรกิจอีก ${remaining} ข้อ` : remaining===3 ? 'three Key Business Strengths' : remaining===2 ? 'two more Key Business Strengths' : 'one more Key Business Strength');
 if (!missing.length) return '';
 const list = missing.length === 1 ? missing[0] : `${missing.slice(0,-1).join(th ? ' ' : ', ')}${th ? ' และ ' : ' and '}${missing[missing.length-1]}`;
 return th ? `หากต้องการไปต่อ กรุณาเพิ่ม${list}` : `To continue, add ${list}.`;
}
