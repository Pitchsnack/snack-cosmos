import type { ReactNode } from 'react';
import { BuyerCover, type CardInvestor } from '@/components/marketplace/buyer-browse-card';
import { StandardBrowseCard, StandardCardChips, StandardCardSection } from './standard-browse-card';
import { bandOf, INDIVIDUAL_TYPE, typeName } from '@/lib/investor-bands';
import { isCorporateBuyer } from '@/lib/investor-browse';
import { cardNdaStatus } from '@/lib/standard-card';
import type { SellerFavPrivate } from '@/lib/investor-browse.functions';

export function StandardInvestorCard({ i, privateData, onClick, selected, topRight, className, tag }: {
  i: CardInvestor & { managed?: boolean; coverUrl?: string | null; status?: string; newDays?: number | null };
  privateData?: SellerFavPrivate | null; onClick?: () => void; selected?: boolean; topRight?: ReactNode; className?: string; tag?: ReactNode;
}) {
  const p = privateData;
  const name = p?.investor_name;
  const type = p?.investor_type ?? i.type;
  const sectors = p?.preferred_industries ?? i.sectors;
  const stages = p?.preferred_stages ?? i.stages;
  const geography = (p ? p.investment_focus.join(' · ') : i.geography)?.split(/\s*[,·]\s*/).filter(Boolean).join(' · ');
  const individual = i.relation === 'individual' || i.relation === 'agent' || type === INDIVIDUAL_TYPE || /advis[eo]r|representative/i.test(type ?? '');
  const band = (label: string, key?: string | null) => { const b = bandOf(key); return { label, value: b?.label, second: b ? `(${b.baht})` : null }; };
  const figures = [band('Ticket size', p?.ticket_band ?? i.ticketBand)];
  if (!individual) figures.push(band(isCorporateBuyer(type) ? 'Group revenue' : 'AUM', p?.aum_band ?? i.aumBand));
  const photo = p?.media.find((m) => m.image_signed_url)?.image_signed_url;
  const initials = name?.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <StandardBrowseCard title={name || typeName(type, i.actsFor)} subtitle={name ? typeName(type, p?.acts_for_types ?? i.actsFor) : undefined}
    refNo={i.refNo} place={p?.country ?? i.country} description={p ? p.short_description || p.long_description : i.description}
    status={cardNdaStatus(i.status)} newDays={i.newDays} managed={i.managed} topRight={topRight} selected={selected} onOpen={onClick} className={className} sourceType={i.type ?? i.codeName} tag={tag}
    cover={(children) => p ? <div className="standard-card-private-cover">{photo ? <img src={photo} alt="" /> : <div className="standard-card-logo">{p.logo_signed_url ? <img src={p.logo_signed_url} alt="" /> : initials}</div>}{children}</div> : <BuyerCover type={i.type} src={i.coverUrl}>{children}</BuyerCover>}
    badges={[...(i.verified ? [{ label: 'Verified investor' }] : []), ...(i.proofOfFunds ? [{ label: 'Proof of funds' }] : [])]}
    figures={figures} fit={band('Min. target revenue', p?.revenue_min_band ?? i.revBand)} textRow={{ label: 'Geography', value: geography }}
    more={<>{(p?.city ?? i.city) && <StandardCardSection label="Based in">{p?.city ?? i.city}</StandardCardSection>}{!!(sectors.length || stages.length || i.dealTypes.length) && <StandardCardSection label="Focus"><StandardCardChips values={[...sectors, ...stages, ...i.dealTypes]} /></StandardCardSection>}</>} />;
}