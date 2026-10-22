import {createFileRoute} from '@tanstack/react-router';
import {PipelineWorkspacePage} from '@/components/pipeline/workspace-page';
export const Route=createFileRoute('/_authenticated/marketplace/pipeline/reports')({
 validateSearch:(s:Record<string,unknown>):{deal?:string;open?:string;view?:string}=>({deal:typeof s.deal==='string'?s.deal:undefined,open:typeof s.open==='string'?s.open:undefined}),
 head:()=>({meta:[{title:'Reports — PitchSnack Pipeline'},{name:'description',content:'Reports for your PitchSnack deals, from NDA to payment.'},{property:'og:title',content:'Reports — PitchSnack Pipeline'},{property:'og:description',content:'Reports for your PitchSnack deals, from NDA to payment.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:Page,
});
function Page(){const {deal,open}=Route.useSearch();return <PipelineWorkspacePage page="reports" deal={deal} openId={open}/>;}
