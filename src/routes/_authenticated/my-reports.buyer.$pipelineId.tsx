import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
import {SellerReportsPage} from '@/components/reports/reports-hub';
import {REPORT_KEYS} from '@/lib/reports-hub';
export const Route=createFileRoute('/_authenticated/my-reports/buyer/$pipelineId')({
 head:()=>({meta:[{title:'Buyer report access — PitchSnack'},{name:'description',content:'Review reports shared with one NDA-approved buyer and respond to their requests.'},{property:'og:title',content:'Buyer report access — PitchSnack'},{property:'og:description',content:'Share ready reports and manage access for this buyer.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:z.object({report:z.enum(REPORT_KEYS).optional()}),component:Page,
});
function Page(){const {pipelineId}=Route.useParams();const {report}=Route.useSearch();return <SellerReportsPage pipelineId={pipelineId} initialReport={report}/>;}