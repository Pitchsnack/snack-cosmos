import { useEffect, useState } from 'react';
import { CircleCheck, Pencil, Sparkles } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { SellerWordingCount, SellerWordingInput, SellerWordingMessage } from '@/components/hidden-profile/seller-wording-field';
import { BuyerPreview } from '@/components/hidden-profile/public-view-fields';
import { pickDraft } from '@/lib/hidden-profile';
import { sellerListingFindings, type SellerDraft } from '@/lib/seller-wizard';
import { checkListingName } from '@/lib/hidden-profiles.functions';
import { sellerListingSource } from '@/lib/seller-listing-text';
import { suggestHeadline } from '@/lib/public-listing';
import { isTranslatedListingText, withoutListingTextTranslation } from '@/lib/listing-text-translations';
import { DescriptionStoryEditor } from './description-story-editor';
import { isDescriptionStoryTranslated } from '@/lib/description-story';

export function SellerListingIdentity({ d, set, th, refNo, cover, startupId }: { d: SellerDraft; set: (patch: Partial<SellerDraft>) => void; th: boolean; refNo?: string; cover?: string | null; startupId?: string }) {
  const L = (en: string, thai: string) => th ? thai : en;
  const language = th ? 'th' : 'en';
  const headline = th ? d.headlineTh || d.headline || '' : d.headline || d.headlineTh || '';
  const description = th ? d.descriptionTh || d.description || '' : d.description || d.descriptionTh || '';
  const findings = sellerListingFindings(d);
  const privacy = L('Remove company names, websites and contact details from this wording.', 'กรุณาลบชื่อบริษัท เว็บไซต์ และข้อมูลติดต่อออกจากข้อความนี้');
  const source = sellerListingSource({ ...d, city: d.addr.province || d.city });
  const check = useServerFn(checkListingName);
  const [nameState, setNameState] = useState<'idle' | 'checking' | 'available' | 'taken'>(d.nameOk ? 'available' : 'idle');

  useEffect(() => {
    const name = d.listingName?.trim() ?? '';
    if (!name) { setNameState('idle'); return; }
    if (!startupId) { setNameState('available'); return; }
    setNameState('checking');
    let live = true;
    const timer = window.setTimeout(() => {
      check({ data: { name, startupId } }).then((result) => {
        if (!live) return;
        setNameState(result.available ? 'available' : 'taken');
        if (d.nameOk !== result.available) set({ nameOk: result.available });
      }).catch(() => { if (live) setNameState('idle'); });
    }, 300);
    return () => { live = false; window.clearTimeout(timer); };
  }, [d.listingName, startupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setText = (field: 'headline' | 'description', value: string) => {
    const target = th ? 'th' : 'en';
    set({
      ...(field === 'headline' ? (th ? { headlineTh: value } : { headline: value }) : (th ? { descriptionTh: value } : { description: value })),
      listingTextTranslations: withoutListingTextTranslation(d.listingTextTranslations, field, target),
    });
  };
  const translated = (field: 'headline' | 'description') => {
    const automatic = field === 'description' && d.descriptionStory && d.descriptionStoryTh
      ? isDescriptionStoryTranslated({ en: d.descriptionStory, th: d.descriptionStoryTh }, language)
      : isTranslatedListingText({
        headline: d.headline, headlineTh: d.headlineTh, description: d.description, descriptionTh: d.descriptionTh,
        translations: d.listingTextTranslations,
      }, field, language);
    return automatic ? <span className="lang-tag">{L('Translated', 'แปลอัตโนมัติ')}</span> : null;
  };

  return <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
    <div className="min-w-0 space-y-5">
      <div>
        <div className="seller-field-label"><label htmlFor="sw-listing-name">{L('Listing name', 'ชื่อประกาศ')} <em>*</em></label><small><SellerWordingCount value={d.listingName ?? ''} kind="name" language={language}/></small></div>
        <div className="relative">
          <SellerWordingInput id="sw-listing-name" value={d.listingName ?? ''} kind="name" language={language} placeholder={L('e.g. Established Regional Logistics Network', 'เช่น เครือข่ายโลจิสติกส์ระดับภูมิภาคที่ก่อตั้งมายาวนาน')} onChange={listingName => { setNameState('idle'); set({ listingName, nameOk: undefined }); }}/>
          {nameState === 'available' && <span className="pointer-events-none absolute right-3 top-2 flex items-center gap-1 text-[13px] font-semibold text-primary"><CircleCheck size={15} aria-hidden />{L('Available', 'ใช้ได้')}</span>}
        </div>
        <SellerWordingMessage value={d.listingName ?? ''} kind="name" language={language}/>
        {nameState === 'taken' && <p className="seller-wording-error" role="alert">{L('That listing name is already used by another listing.', 'ชื่อประกาศนี้มีประกาศอื่นใช้แล้ว')}</p>}
        {findings.name && <p className="seller-wording-error" role="alert">{privacy}</p>}
      </div>
      <div>
        <div className="seller-field-label"><label htmlFor="sw-listing-headline">{L('Headline', 'หัวข้อ')} <em>*</em>{translated('headline')}</label><small className="flex items-center gap-3"><SellerWordingCount value={headline} kind="headline" language={language}/><button type="button" className="listing-suggest" onClick={() => setText('headline', suggestHeadline(source, { language }))}><Sparkles aria-hidden />{L('Suggest', 'แนะนำ')}</button></small></div>
        <SellerWordingInput id="sw-listing-headline" value={headline} kind="headline" language={language} placeholder={L('e.g. Profitable logistics firm with its own fleet and warehouses in five main cities', 'เช่น บริษัทโลจิสติกส์ที่มีกำไร มีรถขนส่งและคลังสินค้าของตนเองในห้าเมืองหลัก')} onChange={value => setText('headline', value)}/>
        <SellerWordingMessage value={headline} kind="headline" language={language}/>
        {findings.headline && <p className="seller-wording-error" role="alert">{privacy}</p>}
      </div>
      <div>
        <div className="seller-field-label"><label htmlFor="sw-listing-description">{L('Description', 'คำอธิบาย')} <em>*</em>{translated('description')}</label><small>{description.length}/420</small></div>
        <DescriptionStoryEditor
          id="sw-listing-description"
          large
          lang={language}
          description={d.description ?? ''}
          descriptionTh={d.descriptionTh ?? ''}
          story={d.descriptionStory}
          storyTh={d.descriptionStoryTh}
          source={source}
          handover={{ stays: d.stays, months: d.months }}
          tr={L}
          onChange={value => {
            const nextText = th ? value.texts.th : value.texts.en;
            const currentText = th ? d.descriptionTh ?? '' : d.description ?? '';
            set({
              description: value.texts.en,
              descriptionTh: value.texts.th,
              descriptionStory: value.stories.en,
              descriptionStoryTh: value.stories.th,
              listingTextTranslations: nextText !== currentText ? withoutListingTextTranslation(d.listingTextTranslations, 'description', language) : d.listingTextTranslations,
            });
          }}
        />
      </div>
      <p className="seller-wording-note"><Pencil size={14} aria-hidden/>{L('PitchSnack may refine your wording before publishing to make it clear and professional, while ensuring it does not reveal your company’s identity.', 'PitchSnack อาจปรับถ้อยคำของท่านก่อนเผยแพร่ให้ชัดเจนและเป็นมืออาชีพ โดยจะไม่เปิดเผยว่าเป็นบริษัทของท่าน')}</p>
    </div>
    <BuyerPreview wizard d={{ ...pickDraft({}), code_name: d.listingName ?? '', headline: d.headline ?? '', headline_th: d.headlineTh ?? '', description: d.description ?? '', description_th: d.descriptionTh ?? '' }} sector={d.sector} refNo={refNo} pickedImage={cover} source={{ ...source, product_tags_th: d.productTagsTh, market_tags_th: d.marketTagsTh }}/>
  </div>;
}
