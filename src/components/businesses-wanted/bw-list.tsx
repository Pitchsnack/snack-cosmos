import { Link } from '@tanstack/react-router';
import { Check, Lock, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { localizeCard, fmtDay } from '@/lib/buy-orders';
import { cardValue } from '@/lib/marketplace-contacts';
import type { ApplyContext, BoCard } from '@/lib/buy-orders.functions';
import { ApplyButton, Cover, KindPill, managedCardState, ShareButton, StatusPill, useBw, useSectorName } from './bw-card';
import { BrowseListHeader, BrowseListRow } from '@/components/public-site/browse-views';

type ActionsProps = { card: BoCard; persona: 'seller' | 'buyer' | 'advisor'; applyCtx?: ApplyContext; onApply: () => void; onShare: () => void; onDetails?: () => void };
export function BuyOrderActions({ card, persona, applyCtx, onApply, onShare, onDetails }: ActionsProps) {
  const { c } = useBw();
  const posted = card.status === 'posted';
  const managed = managedCardState(card, applyCtx);
  const applied = managed ? managed === 'applied' : !!card.myApp;
  const n = card.appsNew ?? 0;
  return <div className="bw-view-actions">
    {posted && card.appsTotal != null ? <Link to="/marketplace/pipeline/invitations" search={{ view: 'applications' }} className="bw-btn bw-navy"><Users size={15}/><span className="bw-btn-text">{n ? c('Applications', 'ใบสมัคร') : c(`Applications · ${card.appsTotal}`, `ใบสมัคร · ${card.appsTotal}`)}</span>{n > 0 && <span className="bw-count-pill">{n}</span>}</Link> : posted && persona === 'seller' ? applied ? <span className="bw-btn bw-applied"><Check size={15}/>{c('Applied', 'สมัครแล้ว')}</span> : <ApplyButton ctx={applyCtx} onApply={onApply}/> : null}
    {onDetails && <Button variant="unstyled" className="bw-btn bw-outline" onClick={onDetails}>{c('View details', 'ดูรายละเอียด')}</Button>}
    {posted && !card.yours && !card.client && <ShareButton narrow onShare={onShare}/>}
  </div>;
}

export function BuyOrderList({ cards, persona, applyCtx, onDetails, onApply, onShare }: { cards: BoCard[]; persona: ActionsProps['persona']; applyCtx?: ApplyContext; onDetails: (id: string) => void; onApply: (id: string) => void; onShare: (id: string) => void }) {
  const { c, th } = useBw();
  const sectorName = useSectorName();
  const headings = [c('Buy order', 'ประกาศรับซื้อ'), c('Target revenue', 'รายได้เป้าหมาย'), c('Target company price', 'ราคาบริษัทเป้าหมาย'), c('Closes', 'ปิดรับสมัคร')];
  return <><BrowseListHeader headings={headings}/>{cards.map(raw => {
    const card = localizeCard(raw, th);
    const managed = managedCardState(card, applyCtx);
    const grey = card.status === 'closed' || (persona === 'seller' && (managed ? managed === 'applied' : !!card.myApp));
    return <BrowseListRow key={card.id} id={`bw-list-${card.id}`} grey={grey}>
      <div className="discovery-list-identity"><div className="discovery-list-photo"><Cover card={card} height={72}/></div><div>
        <Button variant="unstyled" className="discovery-list-name" onClick={() => onDetails(card.id)}>{sectorName(card.sector)}</Button>
        <div className="discovery-list-meta">{card.ref} · {cardValue(card.buyerType, th ? 'th' : 'en')} · {cardValue(card.country, th ? 'th' : 'en')}</div>
        {card.client && <div className="bw-client bw-list-client"><Lock size={13}/>{c(`For ${card.client.name ?? '—'} · ${card.client.ref ?? '—'} · only PitchSnack sees this`, `สำหรับ ${card.client.name ?? '—'} · ${card.client.ref ?? '—'} · เห็นเฉพาะ PitchSnack`)}</div>}
        <div className="bw-list-pills"><StatusPill card={card}/>{card.yours && <span className="bw-pill"><User size={12}/>{c('Yours', 'ของคุณ')}</span>}<KindPill kind={card.kind}/>{card.sharedBy && <span className="bw-pill">{c('Shared with you', 'แชร์ให้คุณ')}</span>}</div>
      </div></div>
      {[card.targetRevenue, card.priceRange, fmtDay(card.closesOn ?? card.closedAt, th)].map((value, i) => <div className="discovery-list-value" key={i}><small>{headings[i + 1]}</small>{value || '—'}</div>)}
      <BuyOrderActions card={card} persona={persona} applyCtx={applyCtx} onDetails={() => onDetails(card.id)} onApply={() => onApply(card.id)} onShare={() => onShare(card.id)}/>
    </BrowseListRow>;
  })}</>;
}