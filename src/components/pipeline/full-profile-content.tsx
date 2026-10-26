import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { LockOpen, X } from 'lucide-react';
import { invitationPrivateProfile } from '@/lib/invitations.functions';
import { PrivateInvestorPanel } from '@/components/marketplace/private-investor-panel';
import { CompanyProfileIdentity } from '@/components/shared/company-profile-parts';
import { DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/language';
import { FullListingBody } from './full-listing-body';
import { useMediaUrl } from '@/components/hidden-profile/public-listing-card';

export function FullProfileContent({pipelineId,side,onClose,approvedAt,endAt}:{pipelineId:string;side:'seller'|'buyer';onClose:()=>void;approvedAt?:string|null;endAt?:string|null}) {
  const get=useServerFn(invitationPrivateProfile); const {t,language}=useTranslation();
  const {data,error,isPending}=useQuery({queryKey:['pipeline','full-profile',pipelineId,side],queryFn:()=>get({data:{pipelineId,as:side}}),staleTime:0,retry:false});
  const title=useRef<HTMLHeadingElement>(null);const [scrolled,setScrolled]=useState(false);
  const seller=data?.seller; const buyer=data?.buyer; const p=seller?.priv??buyer?.priv;
  const buyerLogo=useMediaUrl(buyer?.priv?.logoPath??null);
  const name=seller?.priv?.investor_name??buyer?.priv?.companyName??t('Profile');
  const date=(v:string)=>new Date(v).toLocaleDateString(language==='th'?'th-TH':'en-GB',{day:'numeric',month:'short',year:'numeric'}).replace('Sept','Sep');
  useEffect(()=>{if(!isPending)title.current?.focus();},[isPending]);
  const ref=seller?.refNo??buyer?.listing.refNo;
  const nda=p?<><LockOpen size={15}/><span><b>{language==='th'?'อนุมัติ NDA แล้ว':'NDA approved'}</b> <span className="full-profile-nowrap">{date(approvedAt??p.ndaApprovedAt)}</span><span aria-hidden> · </span><span className="full-profile-nowrap">{language==='th'?'มีผลถึง':'valid until'} {endAt===null?'—':date(endAt??p.ndaValidUntil)}</span>{ref&&<><span aria-hidden> · </span><span className="full-profile-nowrap">{ref}</span></>}</span></>:null;
  const meta=seller?.priv?[seller.priv.country,seller.priv.investor_type].filter(Boolean).join(' · '):buyer?[buyer.listing.sector,buyer.listing.location].filter(Boolean).join(' · '):'';
  return <><header className="full-profile-header" data-scrolled={scrolled||undefined}>
    <CompanyProfileIdentity expanded name={isPending?t('Loading…'):name} logo={seller?.priv?.logo_signed_url??buyerLogo} meta={meta} line={nda} title={DialogTitle} titleRef={title}/>
    <Button variant="ghost" size="icon" className="pbox-x" aria-label={t('Close')} title={t('Close')} onClick={onClose}><X size={18}/></Button>
  </header><div className="full-profile-body" onScroll={e=>setScrolled(e.currentTarget.scrollTop>2)}>
    {error?<p role="alert" className="text-destructive">{t('Private profile unavailable.')}</p>:isPending?<p>{t('Loading…')}</p>:seller?.priv?<PrivateInvestorPanel f={{...seller,priv:{...seller.priv,people:[]}}} hideHeader pipeline/>:buyer?.priv?<FullListingBody f={buyer}/>:<p role="alert">{t('Private profile unavailable.')}</p>}
  </div></>;
}