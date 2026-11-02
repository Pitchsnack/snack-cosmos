import { useRef, useState } from 'react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SELLER_DESCRIPTION_LIMITS, type SellerDraft } from '@/lib/seller-wizard';
import { SELLER_SECTOR_EXAMPLES } from '@/lib/seller-sector-examples';
import { useTranslation } from '@/i18n/language';

export type WebsiteField = 'shortDescription' | 'longDescription' | 'productTags' | 'marketTags';
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
export function SellerWebsiteFields({d, set, marks, edit, reading, openSector}: {d: SellerDraft; set: (p: Partial<SellerDraft>) => void; marks: Partial<Record<WebsiteField, boolean>>; edit: (key: WebsiteField) => void; reading: boolean; openSector: () => void}) {
 const th = useTranslation().language === 'th'; const L = (en: string, thai: string) => th ? thai : en;
 const sector = SELLER_SECTOR_EXAMPLES.find(x => x.sector === d.sector);
 const pick = (v: [string,string]) => v[th ? 1 : 0];
 const short = th ? d.shortDescriptionTh || d.shortDescription || '' : d.shortDescription || d.shortDescriptionTh || '';
 const long = th ? d.longDescriptionTh || d.longDescription || '' : d.longDescription || d.longDescriptionTh || '';
 const products = th ? d.productTagsTh?.length ? d.productTagsTh : d.productTags ?? [] : d.productTags?.length ? d.productTags : d.productTagsTh ?? [];
 const markets = th ? d.marketTagsTh?.length ? d.marketTagsTh : d.marketTags ?? [] : d.marketTags?.length ? d.marketTags : d.marketTagsTh ?? [];
 if(reading) return <ul className="seller-reading" aria-live="polite">{[L('Short description','คำอธิบายสั้น'),L('Long description','คำอธิบายแบบยาว'),L('Products and services','สินค้าและบริการ'),L('Markets','ตลาด')].map(label => <li key={label}><Loader2 className="motion-safe:animate-spin" size={18}/>{label}</li>)}</ul>;
 const text = (key: 'shortDescription'|'longDescription', value: string, label: string, placeholder: string, limit: number) => <div>
  <div className="seller-field-label"><label htmlFor={`sw-${key}`}>{label}<em>*</em>{marks[key] && <AutoFilled/>}</label><small className={value.length > limit ? 'text-destructive' : ''}>{value.length.toLocaleString('en')}/{limit.toLocaleString('en')}</small></div>
  <textarea id={`sw-${key}`} className={`seller-description ${key === 'longDescription' ? 'is-long' : ''}`} aria-required value={value} placeholder={placeholder} onChange={e => {edit(key); set({[th ? `${key}Th` : key]: e.target.value});}}/>
 </div>;
 return <div className="seller-description-fields">
  {text('shortDescription',short,L('Short description','คำอธิบายสั้น'),L('One sentence: what you make or do, and for whom.','หนึ่งประโยค: ท่านผลิตหรือทำอะไร และทำให้ใคร'),SELLER_DESCRIPTION_LIMITS.short)}
  {text('longDescription',long,L('Long description','คำอธิบายแบบยาว'),L('What the business does, since when, how it sells and who its customers are.','ธุรกิจทำอะไร เริ่มตั้งแต่เมื่อไร ขายอย่างไร และลูกค้าคือใคร'),SELLER_DESCRIPTION_LIMITS.long)}
  <Tags label={L('Product & Service Tags','แท็กสินค้าและบริการ')} required value={products} onChange={v => {edit('productTags');set(th ? {productTagsTh:v}:{productTags:v});}} auto={marks.productTags} examples={sector?.products.map(pick) ?? []} sector={sector ? th ? sector.thai : sector.sector : null} openSector={openSector} th={th}/>
  <Tags label={L('Market Tags','แท็กตลาด')} value={markets} onChange={v => {edit('marketTags');set(th ? {marketTagsTh:v}:{marketTags:v});}} auto={marks.marketTags} examples={[]} who={sector?.who.map(pick) ?? []} where={[L('Thailand','ประเทศไทย'), d.addr.province, L('ASEAN','อาเซียน'),L('Worldwide','ทั่วโลก')].filter(Boolean)} sector={sector ? th ? sector.thai : sector.sector : null} openSector={openSector} th={th}/>
 </div>;
}
export function websiteMissing(d: SellerDraft, th: boolean) {
 const missing: string[] = [];
 if (!(d.shortDescription?.trim() || d.shortDescriptionTh?.trim())) missing.push(th ? 'คำอธิบายสั้น' : 'the short description');
 if (!(d.longDescription?.trim() || d.longDescriptionTh?.trim())) missing.push(th ? 'คำอธิบายแบบยาว' : 'the long description');
 if (!(d.productTags?.length || d.productTagsTh?.length)) missing.push(th ? 'แท็กสินค้าและบริการ 1 รายการ' : 'one Product & Service Tag');
 if (!missing.length) return '';
 const list = missing.length === 1 ? missing[0] : `${missing.slice(0,-1).join(th ? ' ' : ', ')}${th ? ' และ ' : ' and '}${missing[missing.length-1]}`;
 return th ? `หากต้องการไปต่อ กรุณาเพิ่ม${list}` : `To continue, add ${list}.`;
}
