import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {listPipeline} from '@/lib/pipeline.functions';
import {listMyInvitations,listSellerInvitations,type BuyerInvitation,type SellerInvitation} from '@/lib/invitations.functions';
import {pipelineOpen} from '@/lib/pipeline-pages';
import {useIsMarketplace,usePersona,type Persona} from '@/hooks/use-marketplace';
import {PipelineReviewAlert} from './review-alert';

export function showPipelineReviewAlert(isMarket:boolean,locked:Persona|null,persona:Persona){
 return persona!=='advisor'&&(isMarket||locked==='seller'||locked==='buyer');
}

export function GlobalPipelineReviewAlert(){
 const isMarket=useIsMarketplace();const {persona,locked}=usePersona();const seller=persona==='seller';const enabled=showPipelineReviewAlert(isMarket,locked,persona);
 const list=useServerFn(listPipeline),buyerInv=useServerFn(listMyInvitations),sellerInv=useServerFn(listSellerInvitations);
 const deals=useQuery({queryKey:['pipeline',persona],queryFn:()=>list({data:{as:seller?'seller':'buyer'}}),enabled,retry:false,refetchInterval:5000});
 const invites=useQuery<(BuyerInvitation|SellerInvitation)[]>({queryKey:['invitations',seller?'seller':'buyer'],queryFn:()=>seller?sellerInv():buyerInv(),enabled,retry:false,refetchInterval:5000});
 if(!enabled)return null;
 return <PipelineReviewAlert key={persona} rows={(deals.data??[]).filter(pipelineOpen)} invitations={invites.data??[]} seller={seller}/>;
}
