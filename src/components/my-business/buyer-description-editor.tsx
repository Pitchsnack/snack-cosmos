import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AfterWizardTour } from '@/components/common/after-wizard-tour';
import { FieldRow } from '@/components/common/listing-editor-fields';
import { LangTag, TextLangSwitch, useTextLang } from '@/components/common/text-lang';
import { Eye } from 'lucide-react';
import { StandardInvestorCard } from '@/components/marketplace/standard-investor-card';
import { AutoFilled } from '@/components/startups/seller-website-fields';
import type { CardInvestor } from '@/components/marketplace/buyer-browse-card';
import { Textarea } from '@/components/ui/textarea';
import { useTr } from '@/components/common/edit-info-popup';
import { buyerDescriptionError, descriptionWords, singleLineDescription } from '@/lib/buyer-description';
import { preferredLanguageText } from '@/lib/bilingual-fields';

export const WANT_BUY_MAX = 80;
export const buyerListingPreviewText = (en: string | null | undefined, th: string | null | undefined, fallbackEn: string, fallbackTh: string, language: string) =>
  preferredLanguageText(en, th, language) || preferredLanguageText(fallbackEn, fallbackTh, language);
export const buyerListingEditorValues = (english: BuyerListingEditorValues, thai: BuyerListingEditorValues, lang: "en" | "th", switchable: boolean): BuyerListingEditorValues => {
  const own = lang === "en" ? english : thai;
  const other = lang === "en" ? thai : english;
  return switchable ? own : {
    description: own.description || other.description,
    headline: own.headline || other.headline,
  };
};
export const wantBuyLen = (v: string) => Array.from(v).length;

function WantTour({ anchor, onClose }: { anchor: HTMLElement | null; onClose: (focusField: boolean) => void }) {
  const L = useTr();
  return <AfterWizardTour anchor={anchor} onClose={onClose} title={L('Last step: Acquisition target company', 'ขั้นตอนสุดท้าย: บริษัทเป้าหมายในการเข้าซื้อกิจการ')} text={L('Be specific about the type of company you want to acquire. Sellers will use this information to assess whether their business matches your criteria before deciding to contact you.', 'โปรดระบุประเภทบริษัทที่ท่านต้องการเข้าซื้อกิจการให้ชัดเจน ผู้ขายจะใช้ข้อมูลนี้ประเมินว่าธุรกิจของตนตรงกับเกณฑ์ของท่านหรือไม่ ก่อนตัดสินใจติดต่อท่าน')} />;
}

function BuyerCardPreviewFrame({ children }: { children: ReactNode }) {
  const L = useTr();
  return <div className="buyer-preview-frame"><p className="buyer-preview-caption"><Eye aria-hidden />{L("What sellers see", "สิ่งที่ผู้ขายเห็น")}</p>{children}</div>;
}

export function BuyerDescriptionEditor({ i, value, onChange, forced, children, suggest, source, lang, want, onWant, tour, stacked = false, wantSource, hidePreview = false, onWantSuggest, idPrefix = "f-", wantRequired = false, wantMissing = false }: { i: CardInvestor; value: string; onChange: (value: string) => void; forced?: boolean; children?: ReactNode; suggest?: () => void; source?: ReactNode; lang?: 'en' | 'th'; want: string; onWant: (value: string) => void; tour?: { open: boolean; close: (focusField: boolean) => void }; stacked?: boolean; wantSource?: ReactNode; hidePreview?: boolean; onWantSuggest?: () => void; idPrefix?: string; /** Shows the required mark (Edit information, Review & complete). */ wantRequired?: boolean; /** Empty in both languages: shows the Missing line. */ wantMissing?: boolean }) {
  const L = useTr();
  const [touched, setTouched] = useState(false);
  const problem = buyerDescriptionError(value);
  const visibleProblem = problem === 'Write at least 10 characters.' && !touched && !forced ? null : problem;
  const message = visibleProblem;
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
  const description = !value.trim() ? <span className="buyer-preview-empty">{L('Your description shows here.', 'คำอธิบายของท่านจะแสดงที่นี่')}</span> : value;
  const wantLine = want.trim()
    ? <p className="standard-card-want" title={`${L('Wants to buy:', 'ต้องการซื้อ:')} ${want.trim()}`}><b>{L('Wants to buy:', 'ต้องการซื้อ:')}</b> {want.trim()}</p>
    : <p className="standard-card-want standard-card-want-empty"><b>{L('Wants to buy:', 'ต้องการซื้อ:')}</b> {L('what you want to buy', 'สิ่งที่ท่านต้องการซื้อ')}</p>;
  return <div ref={root} className={stacked ? "buyer-description-layout buyer-description-layout-stacked" : "buyer-description-layout"}>
    {!hidePreview && <div className="buyer-preview-col"><div className="buyer-preview-sticky"><BuyerCardPreviewFrame><StandardInvestorCard i={i} descriptionContent={description} wantBuy={wantLine} className="buyer-editor-preview" /></BuyerCardPreviewFrame></div></div>}
    <div className="buyer-description-fields"><section data-edit-sec="want" className="buyer-description-field buyer-want-field">
      <div ref={setWantAnchor} className="buyer-want-anchor">
      <FieldRow htmlFor={`${idPrefix}suggested_headline`} label={<>{L('What you want to buy', 'สิ่งที่ท่านต้องการซื้อ')}{wantRequired && <span className="ml-[3px] text-[12px] font-semibold text-[#B42318] relative -top-0.5" aria-hidden>*</span>}</>} after={<LangTag lang={lang} />} source={wantSource} suggest={onWantSuggest} right={<span className={wantOver ? 'text-destructive font-semibold' : ''}>{wantN} / {WANT_BUY_MAX}</span>}>
      <textarea ref={wantBox} id={`${idPrefix}suggested_headline`} lang={lang} rows={1} value={want} autoComplete="off"
        placeholder={L('e.g. Profitable logistics firm with its own distribution channel in main cities', 'เช่น บริษัทโลจิสติกส์ที่มีกำไร และมีช่องทางจัดจำหน่ายของตนเองในเมืองหลัก')}
        onChange={(e) => onWant(singleLineDescription(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        aria-invalid={wantOver || wantMissing} aria-required={wantRequired || undefined} aria-describedby="buyer-want-help buyer-want-message"
        className={`buyer-want-input ${wantOver ? 'buyer-want-invalid' : ''}`} />
      </FieldRow>
      </div>
      <p id="buyer-want-help" className="buyer-description-help" style={tour?.open ? { visibility: 'hidden' } : undefined}>{L("Sellers see it on your card in Browse investors. Admin reviews it before it's published.", 'ผู้ขายจะเห็นข้อความนี้บนการ์ดของท่านในหน้าค้นหานักลงทุน ผู้ดูแลระบบจะตรวจสอบก่อนเผยแพร่')}</p>
      <div id="buyer-want-message" aria-live="polite">{wantOver ? <p className="buyer-description-error">{L('Keep it to 80 characters.', 'โปรดเขียนไม่เกิน 80 ตัวอักษร')}</p> : wantMissing ? <p className="buyer-description-error">{L('⚠ Missing: What you want to buy', '⚠ ยังขาด: สิ่งที่ท่านต้องการซื้อ')}</p> : null}</div>
      {tour?.open && <WantTour anchor={wantAnchor} onClose={tour.close} />}
    </section><section data-edit-sec="description" className="buyer-description-field buyer-description-main-field">
      <FieldRow htmlFor={`${idPrefix}description`} label={<>{L('Description', 'คำอธิบาย')} <span className="buyer-label-explanation">{L('(1–2 sentences)', '(1–2 ประโยค)')}</span></>} after={<LangTag lang={lang} />} source={source} suggest={suggest} right={<span className={descriptionWords(value) > 25 ? 'text-destructive font-semibold' : ''}>{descriptionWords(value)} / 25 {L('words','คำ')}</span>}>
      <Textarea id={`${idPrefix}description`} lang={lang} value={value} onChange={(e) => onChange(singleLineDescription(e.target.value))} onBlur={() => setTouched(true)} onKeyDown={(e) => {if(e.key === 'Enter') e.preventDefault();}} aria-invalid={!!message} aria-describedby="buyer-description-help buyer-description-message" className="buyer-description-textarea" />
      </FieldRow>
      <p id="buyer-description-help" className="buyer-description-help">{L("Up to 25 words. Leave out your firm's name, website and contact details.", 'ไม่เกิน 25 คำ โปรดอย่าระบุชื่อบริษัท เว็บไซต์ และข้อมูลติดต่อ')}</p>
      <div id="buyer-description-message" aria-live="polite">{message ? <p className="buyer-description-error">{message === 'Keep it to 2 sentences.' ? L(message,'โปรดเขียนไม่เกิน 2 ประโยค') : message === 'Keep it to 25 words.' ? L(message,'โปรดเขียนไม่เกิน 25 คำ') : L(message,'โปรดเขียนอย่างน้อย 10 ตัวอักษร')}</p> : null}</div>
    </section></div>
    {children && <div className="buyer-description-children">{children}</div>}
  </div>;
}

export type BuyerListingEditorValues = { description: string; headline: string };
export type BuyerListingEditorSources = Record<"description" | "headline" | "descriptionTh" | "headlineTh", "auto" | "translated" | "user">;

/** One selected language editor with a shared live buyer-card preview. */
export function BuyerListingTextEditor({ english, thai, sources, onChange, onRefresh, preview }: {
  english: BuyerListingEditorValues; thai: BuyerListingEditorValues;
  sources: BuyerListingEditorSources;
  onChange: (field: "description" | "headline", lang: "en" | "th", value: string) => void;
  onRefresh: (field: "description" | "headline", lang: "en" | "th") => void;
  preview: CardInvestor;
}) {
  const L = useTr();
  const { lang, switchable } = useTextLang();
  const badge = (kind: "auto" | "translated" | "user") => kind === "auto" ? <AutoFilled /> : kind === "translated" ? <span className="seller-auto-mark">{L("Translated", "แปลอัตโนมัติ")}</span> : null;
  const values = buyerListingEditorValues(english, thai, lang, switchable);
  const editor = <BuyerDescriptionEditor
    i={preview} value={values.description} want={values.headline} lang={lang} stacked hidePreview idPrefix={`buyer-listing-${lang}-`}
    source={badge(lang === "en" ? sources.description : sources.descriptionTh)}
    wantSource={badge(lang === "en" ? sources.headline : sources.headlineTh)}
    onChange={(value) => onChange("description", lang, value)} onWant={(value) => onChange("headline", lang, value)}
    suggest={() => onRefresh("description", lang)} onWantSuggest={() => onRefresh("headline", lang)}
  />;
  const descriptionText = buyerListingPreviewText(preview.description, preview.descriptionTh, english.description, thai.description, lang);
  const description = descriptionText
    ? <>{descriptionText}</>
    : <span className="buyer-preview-empty">{L("Your description shows here.", "คำอธิบายของท่านจะแสดงที่นี่")}</span>;
  const want = buyerListingPreviewText(preview.publishedHeadline, preview.publishedHeadlineTh, english.headline, thai.headline, lang);
  return <div className="buyer-listing-bilingual">
    <div className="buyer-listing-preview"><BuyerCardPreviewFrame>
      <StandardInvestorCard i={preview} descriptionContent={description} className="buyer-editor-preview"
        wantBuy={<p className={`standard-card-want ${want ? "" : "standard-card-want-empty"}`}><b>{L("Wants to buy:", "ต้องการซื้อ:")}</b> {want || L("what you want to buy", "สิ่งที่ท่านต้องการซื้อ")}</p>} />
    </BuyerCardPreviewFrame></div>
    {switchable && <div className="buyer-listing-language"><TextLangSwitch /></div>}
    {editor}
  </div>;
}
