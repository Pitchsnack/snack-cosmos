import { Building2, Calendar, Users, MapPin, Globe, ExternalLink, FileText, LineChart, Coins, Briefcase, Package } from 'lucide-react';
import { Section, ChipRow } from '@/components/investors/investor-detail-panel';
import { PairedSection } from '@/components/shared/paired-section';
import { useTranslation } from '@/i18n/language';
import { fmtThb } from '@/lib/asking-price';
import type { Favourite } from '@/lib/favourites.functions';
import type { ReactNode } from 'react';

export function ProfileRows({ rows }: {rows: [string, ReactNode][]}) {
  return <dl className="full-profile-rows">{rows.filter(([,v])=>v!==null && v!==undefined && v!=='').map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}
export function FullListingBody({ f }: {f: Favourite}) {
  const {t,language}=useTranslation(); const p=f.priv; if(!p)return null;
  const l=f.listing; const year=p.fy==null?'':String(p.fy).slice(-2);
  const money=(v:number|null|undefined)=>v==null?null:fmtThb(v);
  const web=p.website ? (/^https?:/i.test(p.website)?p.website:`https://${p.website}`):null;
  const facts=[
    p.founded && {icon:Calendar,value:`${t('Est.')} ${p.founded}`},
    l.sector && {icon:Building2,value:l.sector},
    l.location && {icon:MapPin,value:l.location},
    p.employees && {icon:Users,value:language==='th'?`พนักงาน ${p.employees} คน`:`${p.employees} employees`},
    web && {icon:Globe,value:<a href={web} target="_blank" rel="noreferrer">{t('Website')} →</a>},
  ].filter((v):v is {icon:typeof Calendar;value:ReactNode}=>!!v);
  const figures=[{icon:LineChart,title:`${t('Revenue')}${year?` FY${year}`:''}`,value:money(p.revenue)},{icon:Coins,title:t('Asking price'),value:money(f.askingPrice)},{icon:Briefcase,title:t('Deal type'),value:f.dealType}].filter(v=>v.value);
  const terms:[string,ReactNode][]=[[t('Owner handover'),f.handover??null]];
  const financial:[string,ReactNode][]=[[t('Net profit'),money(p.netProfit)],[t('Revenue growth'),p.growthPct!=null && p.fy!=null?`${p.growthPct>=0?'+':''}${p.growthPct.toFixed(1)}% ${t('vs')} FY${String(p.fy-1).slice(-2)}`:null],[t('Verified by'),l.hasFinancials?<span className="full-profile-ok">✓ PitchSnack {t('analysts')}</span>:null]];
  const pair=(left:{icon:typeof Calendar;title:string;content:ReactNode}|null,right:typeof left)=>left&&right?<PairedSection left={left} right={right}/>:left?<Section icon={left.icon} title={left.title}>{left.content}</Section>:right?<Section icon={right.icon} title={right.title}>{right.content}</Section>:null;
  return <div className="full-listing-body space-y-[14px]">
    {p.photoUrl&&<img className="full-profile-cover" src={p.photoUrl} alt=""/>}
    {(l.headline||p.description)&&<div className="full-profile-about">{l.headline&&<p className="full-profile-headline">{l.headline}</p>}{p.description&&<p className="full-profile-description">{p.description}</p>}</div>}
    {facts.length>0&&<div className="full-profile-facts">{facts.map(({icon:Icon,value},k)=><div key={k}><Icon size={18}/><span>{value}</span></div>)}</div>}
    {figures.length>0&&<section className="full-profile-figures">{figures.map(({icon:Icon,title,value})=><div key={title}><h3><Icon size={16}/>{title}</h3><ChipRow tags={[String(value)]} tone="primary"/></div>)}</section>}
    {pair(terms.some(([,v])=>v!=null)?{icon:FileText,title:t('Deal terms'),content:<ProfileRows rows={terms}/>} : null,financial.some(([,v])=>v!=null)?{icon:LineChart,title:`${t('Financials')}${year?` · FY${year}`:''}`,content:<ProfileRows rows={financial}/>} : null)}
    {pair(l.productTags.length?{icon:Package,title:t('Products & services'),content:<ChipRow tags={l.productTags} tone="primary"/>}:null,l.marketTags.length?{icon:Globe,title:t('Markets'),content:<ChipRow tags={l.marketTags} tone="primary"/>}:null)}
    {(p.legalNameEn||p.legalNameTh||p.regNo||p.location)&&<Section icon={Building2} title={t('Company')}><ProfileRows rows={[[t('Legal name'),p.legalNameEn||p.legalNameTh?<>{p.legalNameEn??p.legalNameTh}{p.legalNameEn&&p.legalNameTh&&<div className="text-sm text-muted-foreground">{p.legalNameTh}</div>}</>:null],[t('Registration no.'),p.regNo],[t('Location'),p.location]]}/></Section>}
  </div>;
}