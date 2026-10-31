import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {getReportPrices} from '@/lib/report-pricing.functions';
import {freePeriod,type ReportPrice} from '@/lib/report-pricing';
import {useSessionContext} from '@/hooks/use-session-context';
export function useReportPrices(){const fn=useServerFn(getReportPrices),session=useSessionContext();const q=useQuery({queryKey:['report-prices'],queryFn:()=>fn()});return (kind:string)=>{if(kind==='bundle')return '฿22,000';const row=q.data?.find(r=>r.report_key===(kind==='financials'?'statements':kind));if(!row)return '—';if(freePeriod(row as ReportPrice,session.data?.accountRole??'seller'))return 'Free';return row.price_type==='on_request'?'On request':`฿${Number(row.price_thb).toLocaleString('en-US')}`;};}