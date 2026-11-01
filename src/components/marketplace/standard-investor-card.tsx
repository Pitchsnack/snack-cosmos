import type { ReactNode } from 'react';
import { BuyerCover, type CardInvestor } from '@/components/marketplace/buyer-browse-card';
import { StandardBrowseCard, StandardCardChips, StandardCardSection, type StandardFigure } from './standard-browse-card';
import { bandOf, INDIVIDUAL_TYPE, typeName } from '@/lib/investor-bands';
import { isCorporateBuyer } from '@/lib/investor-browse';
import { cardNdaStatus } from '@/lib/standard-card';
import { useTranslation } from '@/i18n/language';
import { contactPlace, cardValue } from '@/lib/marketplace-contacts';
import { cn } from '@/lib/utils';
import type { LastLoginStep } from '@/lib/last-login';
import type { SellerFavPrivate } from '@/lib/investor-browse.functions';

/**
 * The buyer card takes the seller card's shape: US$ ranges only on the
 * closed card (one line each), Investment focus as the one-line text row,
 * and Geography plus the baht ranges inside Show more.
 */
export function StandardInvestorCard({ i, privateData, onClick, selected, topRight, className, tag, descriptionContent, hideStatus, exactFigures, lastLoginStep }: {
  i: CardInvestor & { managed?: boolean; coverUrl?: string | null; status?: string; newDays?: number | null; lastLoginStep?: LastLoginStep | null };
  privateData?: Omit<SellerFavPrivate, 'ndaApprovedAt' | 'ndaValidUntil'> | null; onClick?: () => void; selected?: boolean; topRight?: ReactNode; className?: string; tag?: ReactNode;
  hideStatus?: boolean; exactFigures?: { figures: StandardFigure[]; fit: StandardFigure };
  descriptionContent?: ReactNode;
  lastLoginStep?: LastLoginStep | null;
}) {
  const { t, language } = useTranslation();
  const p = privateData;
  const name = p?.investor_name;
  const type = p?.investor_type ?? i.type;
  const sectors = p?.preferred_industries ?? i.sectors;
  const stages = p?.preferred_stages ?? i.stages;
  const geography = (p ? p.investment_focus.join(' · ') : i.geography)?.split(/\s*[,·]\s*/).filter(Boolean).join(' · ');
  const individual = i.relation === 'individual' || i.relation === 'agent' || type === INDIVIDUAL_TYPE || /advis[eo]r|representative/i.test(type ?? '');
  const band = (label: string, key?: string | null): StandardFigure => ({ label, value: bandOf(key)?.label ?? null });
  const baht = (label: string, key?: string | null): StandardFigure => ({ label, value: bandOf(key)?.baht ?? null });
  const secondLabel = isCorporateBuyer(type) ? 'Group revenue' : 'AUM';
  const figures = [band('Ticket size', p?.ticket_band ?? i.ticketBand)];
  if (!individual) figures.push(band(secondLabel, p?.aum_band ?? i.aumBand));
  const photo = p?.media.find((m) => m.image_signed_url)?.image_signed_url;
  const initials = name?.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const cell = (f: StandardFigure) => <div key={f.label}><dl className="standard-card-cell">
    <dt title={t(f.label)}>{t(f.label)}</dt><dd><span className={cn('standard-card-value', !f.value && 'standard-card-empty')} title={f.value ?? undefined}>{f.value || t('Not stated')}</span></dd>
  </dl></div>;
  // Show more opens with Geography, then the baht ranges (exact-figure cards already show exact amounts, so no baht rows there).
  const moreFigures = <div className="standard-card-figures">
    <dl className="standard-card-text-row standard-card-more-row"><dt>{t('Geography')}</dt><dd title={geography ?? undefined}>{cardValue(geography, language) || t('Not stated')}</dd></dl>
    {!exactFigures && <>
      <div className={cn('standard-card-figure-row', individual && 'standard-card-one')}>
        {cell(baht('Ticket size (฿)', p?.ticket_band ?? i.ticketBand))}
        {!individual && cell(baht(`${secondLabel} (฿)`, p?.aum_band ?? i.aumBand))}
      </div>
      <div className="standard-card-plain-row">{cell(baht('Min. target revenue (฿)', p?.revenue_min_band ?? i.revBand))}</div>
    </>}
  </div>;
  return <StandardBrowseCard title={name || cardValue(typeName(type, i.actsFor), language) || ''} subtitle={name ? cardValue(typeName(type, p?.acts_for_types ?? i.actsFor), language) || undefined : undefined}
    refNo={i.refNo} place={contactPlace(p?.city || i.city || p?.country || i.country, language)} description={p ? p.short_description || p.long_description : i.description}
    status={cardNdaStatus(i.status)} hideStatus={hideStatus} newDays={i.newDays} managed={i.managed} topRight={topRight} selected={selected} onOpen={onClick} className={className} sourceType={i.type ?? i.codeName} tag={tag}
    lastLogin={lastLoginStep ?? i.lastLoginStep} lastLoginTooltip={t('When the buyer last logged in to PitchSnack')}
    cover={(children) => p ? <div className="standard-card-private-cover">{photo ? <img src={photo} alt="" /> : <div className="standard-card-logo">{p.logo_signed_url ? <img src={p.logo_signed_url} alt="" /> : initials}</div>}{children}</div> : <BuyerCover type={i.type} src={i.coverUrl}>{children}</BuyerCover>}
    badges={[...(i.verified ? [{ label: 'Verified investor' }] : []), ...(i.proofOfFunds ? [{ label: 'Proof of funds' }] : [])]}
    descriptionContent={descriptionContent} figures={exactFigures?.figures ?? figures} fit={exactFigures?.fit ?? band('Min. target revenue', p?.revenue_min_band ?? i.revBand)}
    textRow={{ label: 'Investment focus', value: cardValue(i.dealTypes.join(' · '), language) }}
    more={<>{moreFigures}{(p?.city ?? i.city) && <StandardCardSection label="Based in">{contactPlace(p?.city ?? i.city, language)}</StandardCardSection>}{!!(sectors.length || stages.length || i.dealTypes.length) && <StandardCardSection label="Focus"><StandardCardChips values={[...sectors, ...stages, ...i.dealTypes]} /></StandardCardSection>}</>} />;
}
