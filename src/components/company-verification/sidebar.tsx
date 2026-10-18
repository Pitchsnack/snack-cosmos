import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {Lock} from 'lucide-react';
import {getMyReportsState} from '@/lib/my-reports.functions';
import {getCompanyVerification} from '@/lib/company-verification.functions';
import type {VerificationState} from '@/lib/company-verification';
import {VerificationBadge} from './verification-badge';
export function useVerificationSidebar(enabled:boolean){
 const getCompanies=useServerFn(getMyReportsState),get=useServerFn(getCompanyVerification);
 const companies=useQuery({queryKey:['my-reports-state'],queryFn:()=>getCompanies(),enabled,staleTime:30000});
 const selected=companies.data?.companies.find(c=>c.id===companies.data?.lastCompanyId)??companies.data?.companies[0];
 return useQuery({queryKey:['company-verification',selected?.id],queryFn:()=>get({data:{companyId:selected?.id??''}}),enabled:enabled&&!!selected,staleTime:30000});
}
export function VerificationSidebarChip({state}:{state?:VerificationState}){if(!state||!['checking','certified','needs_fix'].includes(state.status))return null;return <VerificationBadge status={state.status} company={state.company} checkedAt={state.checkedAt} readyBy={state.readyBy}/>;}
export function VerificationMenuStatus({state,collapsed=false}:{state?:VerificationState;collapsed?:boolean}){
 if(!state)return null;
 if(state.status==='needs_fix')return <span className={`cv-dot ${collapsed?'absolute right-1 top-1':'ml-auto'}`}/>;
 if(!state.included&&['not_ordered','waiting_payment'].includes(state.status))return <span className={collapsed?'absolute right-1 top-0.5':'ml-auto shrink-0'}><Lock className="h-3.5 w-3.5"/></span>;
 return null;
}