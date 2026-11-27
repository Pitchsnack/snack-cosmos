import {useQuery,useQueryClient} from '@tanstack/react-query';
import {usePersona} from './use-marketplace';
import {pipelineCounts,pipelineOpen} from '@/lib/pipeline-pages';
import {pipelineQueryOptions} from '@/lib/pipeline-queries';
export function usePipelineWorkspace(){
 const {persona}=usePersona();const seller=persona==='seller';const enabled=persona!=='advisor';const qc=useQueryClient();
 const queries=pipelineQueryOptions(seller?'seller':'buyer');
 const deals=useQuery({...queries.deals,enabled});
 const stars=useQuery({...queries.stars,enabled});
 const invites=useQuery({...queries.invites,enabled});
 const approved=(deals.data??[]).filter(p=>pipelineOpen(p)&&!!p.ndaApprovedAt&&(!p.ndaExpiresAt||Date.parse(p.ndaExpiresAt)>Date.now()));
 const reports=useQuery({...queries.reports,enabled});
 const counts=pipelineCounts(deals.data??[],stars.data??[],seller);const newInv=(invites.data??[]).filter(r=>seller?r.status==='waiting':r.status==='new'||r.status==='viewed').length;
 const fresh=Object.values(reports.data??{}).filter(h=>h.waitingCount>0).length;
 const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:['pipeline']}),qc.invalidateQueries({queryKey:['invitations']}),qc.invalidateQueries({queryKey:['reports-hub']}),qc.invalidateQueries({queryKey:['favourites']}),qc.invalidateQueries({queryKey:['seller-favourites']}),qc.invalidateQueries({queryKey:['saved-listings']})]);
 return {seller,persona,deals,stars,invites,reports,approved,counts,newInv,fresh,refresh};
}
