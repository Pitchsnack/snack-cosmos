import { Pencil } from 'lucide-react';
import { SellerWordingCount, SellerWordingInput, SellerWordingMessage } from '@/components/hidden-profile/seller-wording-field';
import { BuyerPreview } from '@/components/hidden-profile/public-view-fields';
import { pickDraft } from '@/lib/hidden-profile';
import { sellerListingFindings, type SellerDraft } from '@/lib/seller-wizard';

export function SellerListingIdentity({ d, set, th, refNo, cover }: { d: SellerDraft; set: (patch: Partial<SellerDraft>) => void; th: boolean; refNo?: string; cover?: string | null }) {
  const L = (en: string, thai: string) => th ? thai : en;
  const language = th ? 'th' : 'en';
  const headline = th ? d.headlineTh || d.headline || '' : d.headline || d.headlineTh || '';
  const findings = sellerListingFindings(d);
  const privacy = L('Remove company names, websites and contact details from this wording.', 'กรุณาลบชื่อบริษัท เว็บไซต์ และข้อมูลติดต่อออกจากข้อความนี้');
  return <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
    <div className="min-w-0 space-y-5">
      <div>
        <div className="seller-field-label"><label htmlFor="sw-listing-name">{L('Listing name', 'ชื่อประกาศ')} <em>*</em></label><small><SellerWordingCount value={d.listingName ?? ''} kind="name" language={language}/></small></div>
        <SellerWordingInput id="sw-listing-name" value={d.listingName ?? ''} kind="name" language={language} placeholder={L('e.g. Established Regional Logistics Network', 'เช่น เครือข่ายโลจิสติกส์ระดับภูมิภาคที่ก่อตั้งมายาวนาน')} onChange={listingName => set({ listingName, nameOk: undefined })}/>
        <SellerWordingMessage value={d.listingName ?? ''} kind="name" language={language}/>
        {findings.name && <p className="seller-wording-error" role="alert">{privacy}</p>}
      </div>
      <div>
        <div className="seller-field-label"><label htmlFor="sw-listing-headline">{L('Headline', 'หัวข้อ')} <em>*</em></label><small><SellerWordingCount value={headline} kind="headline" language={language}/></small></div>
        <SellerWordingInput id="sw-listing-headline" value={headline} kind="headline" language={language} placeholder={L('e.g. Profitable logistics firm with its own fleet and warehouses in five main cities', 'เช่น บริษัทโลจิสติกส์ที่มีกำไร มีรถขนส่งและคลังสินค้าของตนเองในห้าเมืองหลัก')} onChange={value => set(th ? { headlineTh: value } : { headline: value })}/>
        <SellerWordingMessage value={headline} kind="headline" language={language}/>
        {findings.headline && <p className="seller-wording-error" role="alert">{privacy}</p>}
      </div>
      <p className="seller-wording-note"><Pencil size={14} aria-hidden/>{L('PitchSnack may refine your wording before publishing to make it clear and professional, while ensuring it does not reveal your company’s identity.', 'PitchSnack อาจปรับถ้อยคำของท่านก่อนเผยแพร่ให้ชัดเจนและเป็นมืออาชีพ โดยจะไม่เปิดเผยว่าเป็นบริษัทของท่าน')}</p>
    </div>
    <BuyerPreview wizard d={{ ...pickDraft({}), code_name: d.listingName ?? '', headline: d.headline ?? '', headline_th: d.headlineTh ?? '' }} sector={d.sector} refNo={refNo} pickedImage={cover} source={{ startup_name: d.name, city: d.addr.province || d.city, last_year_revenue: d.rev, product_tags: d.productTags, market_tags: d.marketTags }}/>
  </div>;
}