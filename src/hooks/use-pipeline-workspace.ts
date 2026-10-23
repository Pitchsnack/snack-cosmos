import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {listPipeline,listDealWatchlist} from '@/lib/pipeline.functions';
import {getReportsHub} from '@/lib/reports-hub.functions';
import {usePersona} from './use-marketplace';
import {pipelineCounts,pipelineOpen} from '@/lib/pipeline-pages';
import type {HubData} from '@/lib/reports-hub';
import {listMyInvitations,listSellerInvitations,type BuyerInvitation,type SellerInvitation} from '@/lib/invitations.functions';
export function usePipelineWorkspace(){
 const {persona}=usePersona();const seller=persona==='seller';const enabled=persona!=='advisor';const list=useServerFn(listPipeline),star=useServerFn(listDealWatchlist),buyerInv=useServerFn(listMyInvitations),sellerInv=useServerFn(listSellerInvitations),hub=useServerFn(getReportsHub);const qc=useQueryClient();
 const deals=useQuery({queryKey:['pipeline',persona],queryFn:()=>list({data:{as:seller?'seller':'buyer'}}),enabled,retry:false});
 const stars=useQuery({queryKey:['pipeline','watchlist',persona],queryFn:()=>star(),enabled,retry:false});
 const invites=useQuery<(BuyerInvitation|SellerInvitation)[]>({queryKey:['invitations',seller?'seller':'buyer'],queryFn:()=>seller?sellerInv():buyerInv(),enabled,retry:false});
 const approved=(deals.data??[]).filter(p=>pipelineOpen(p)&&!!p.ndaApprovedAt&&(!p.ndaExpiresAt||Date.parse(p.ndaExpiresAt)>Date.now()));
 const reports=useQuery<Record<string,HubData>>({queryKey:['reports-hub','pipeline-summary',persona,approved.map(p=>p.id)],queryFn:async()=>{
 const entries=await Promise.all(approved.map(async p=>{try{return [p.id,await hub({data:{mode:seller?'seller':'buyer',pipelineId:p.id}})] as const;}catch{return null;}}));
 return Object.fromEntries(entries.filter((entry):entry is readonly [string,HubData]=>entry!==null));},enabled:enabled&&!!deals.data,retry:false});
 const counts=pipelineCounts(deals.data??[],stars.data??[],seller);const newInv=(invites.data??[]).filter(r=>seller?r.status==='waiting':r.status==='new'||r.status==='viewed').length;
 const fresh=Object.values(reports.data??{}).filter(h=>h&&(seller?h.rows.some(r=>r.audience.some(a=>a.state==='asked')):h.rows.some(r=>r.buyerState==='shared'&&!r.openedAt))).length;
 const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:['pipeline']}),qc.invalidateQueries({queryKey:['invitations']}),qc.invalidateQueries({queryKey:['reports-hub']}),qc.invalidateQueries({queryKey:['favourites']}),qc.invalidateQueries({queryKey:['seller-favourites']}),qc.invalidateQueries({queryKey:['saved-listings']})]);
 return {seller,persona,deals,stars,invites,reports,approved,counts,newInv,fresh,refresh};
}
