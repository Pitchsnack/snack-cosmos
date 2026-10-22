import {useTranslation} from '@/i18n/language';
import {Users} from 'lucide-react';
import {InvestorDetailPanel,Section,type InvestorDetail} from '@/components/investors/investor-detail-panel';
import type {SellerFavourite} from '@/lib/investor-browse.functions';
export function PrivateInvestorPanel({f}:{f:SellerFavourite}){const {t}=useTranslation();const p=f.priv;if(!p)return null;const data={id:f.id,...p,ticket_size:null,status:null,visibility:null,media:[],linked_startups:[],portfolio_investors:[]} as unknown as InvestorDetail;return <InvestorDetailPanel id={f.id} showEdit={false} onSelectStartup={()=>{}} buyer={{data,afterPortfolio:p.people.length?<Section icon={Users} title={t("Decision makers")}><div className="space-y-2">{p.people.map((m,k)=><div key={k} className="flex flex-wrap gap-3 text-sm"><div className="flex-1"><b>{m.name}</b><div>{m.role}</div></div><div>{m.email}<br/>{m.phone}</div></div>)}</div></Section>:undefined}}/>;}
