import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { SectorArt } from '@/components/hidden-profile/bits';
import { useMediaUrl, type ListingDeal } from '@/components/hidden-profile/public-listing-card';
import { useTranslation } from '@/i18n/language';
import type { PublicListing } from '@/lib/public-listing';
import { cardAskingPrice, cardNdaStatus, publicRevenueLabel } from '@/lib/standard-card';
import { StandardBrowseCard, StandardCardChips, StandardCardSection } from './standard-browse-card';
import { fmtThb } from '@/lib/asking-price';
import { contactPlace, cardValue } from '@/lib/marketplace-contacts';
import type { FavPrivate } from '@/lib/favourites.functions';

export function StandardListingCard({ l, deal, privateData, publicOnly, status, hideStatus, selected, onSelect, topRight, tag, className }: {
  l: PublicListing; deal?: ListingDeal; privateData?: Omit<FavPrivate, 'ndaApprovedAt' | 'ndaValidUntil'> | null; publicOnly?: boolean; status?: string | null; hideStatus?: boolean;
  selected?: boolean; onSelect?: () => void; topRight?: ReactNode; tag?: ReactNode; className?: string;
}) {
  const { t, language } = useTranslation();
  const p = privateData;
  const logo = useMediaUrl(p?.logoPath ?? null);
  const exact = !!p || (!publicOnly && status === 'approved');
  const price = cardAskingPrice(deal, exact, language === 'th');
  const year = p?.fy != null ? String(p.fy).slice(-2) : p ? null : '25';
  const date = l.publishedAt ? new Date(l.publishedAt).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const initials = p?.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <StandardBrowseCard title={p?.companyName || l.headline} subtitle={p ? l.headline : undefined} refNo={l.refNo} place={contactPlace(p?.location || l.location?.replace(/, Thailand$/, ''),language)}
    description={p ? p.description : l.description} status={cardNdaStatus(status)} hideStatus={hideStatus} newDays={l.newDays} managed={l.managed} topRight={topRight} tag={tag} selected={selected} onOpen={onSelect} className={className}
    cover={(children) => p ? <div className="standard-card-private-cover">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : <div className="standard-card-logo">{logo ? <img src={logo} alt="" /> : initials}</div>}{children}</div> : <SectorArt src={l.coverUrl} art={l.coverArt ?? l.sector} sector={l.sector} imageId={l.publicImageId}>{children}</SectorArt>}
    badges={[...(l.certified ? [{ label: 'Certified' }] : []), ...(l.verified ? [{ label: 'Verified company' }] : []), ...(l.hasFinancials ? [{ label: 'Verified financials', financial: true }] : [])]}
    figures={[{ label: language==='th' && year ? `รายได้ปี ${Number(p?.fy || `20${year}`)+543}` : `${t('Revenue')}${year ? ` FY${year}` : ''}`, value: p ? (p.revenue != null ? fmtThb(p.revenue) : null) : publicRevenueLabel(l.revenueBand) }, { label: 'Deal type', value: deal?.dealType ? t(deal.dealType) : null }]}
    fit={{ label: 'Asking price', value: price, second: price ? t(exact ? (p ? 'Exact' : 'NDA approved') : 'Range') : null }} textRow={{ label: 'Sector', value: cardValue(l.sector,language) }}
    more={<>
      {!!l.highlights?.length && <StandardCardSection label="Highlights"><ul className="standard-card-highlights">{l.highlights.filter((v) => v.trim()).map((h, index) => <li key={index}><Check aria-hidden /><span>{h}</span></li>)}</ul></StandardCardSection>}
      {!!l.productTags.length && <StandardCardSection label="Products & services"><StandardCardChips values={l.productTags} /></StandardCardSection>}
      {!!l.marketTags.length && <StandardCardSection label="Markets"><StandardCardChips values={l.marketTags} market /></StandardCardSection>}
      {(p?.employees || l.employees) && <StandardCardSection label="Company size">{p?.employees || l.employees}</StandardCardSection>}
      {!!l.certifications.length && <StandardCardSection label="Licences">{l.certifications.join(' · ')}</StandardCardSection>}
      {l.customerProfile && <StandardCardSection label="Customer profile"><p className="whitespace-pre-line">{l.customerProfile}</p></StandardCardSection>}
      {(l.codeName || date) && <div className="standard-card-meta">{[l.codeName, date ? `${t('Posted')} ${date}` : null].filter(Boolean).join(' · ')}</div>}
    </>} />;
}