import {createFileRoute} from '@tanstack/react-router';
import {PipelineWorkspacePage} from '@/components/pipeline/workspace-page';
export const Route=createFileRoute('/_authenticated/marketplace/pipeline/watchlist')({
 validateSearch:(s:Record<string,unknown>):{deal?:string;open?:string;view?:string}=>({deal:typeof s.deal==='string'?s.deal:undefined,open:typeof s.open==='string'?s.open:undefined}),
 head:()=>({meta:[{title:'Deal watchlist — PitchSnack Pipeline'},{name:'description',content:'Deal watchlist for your PitchSnack deals, from NDA to payment.'},{property:'og:title',content:'Deal watchlist — PitchSnack Pipeline'},{property:'og:description',content:'Deal watchlist for your PitchSnack deals, from NDA to payment.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:Page,
});
function Page(){const {deal,open}=Route.useSearch();return <PipelineWorkspacePage page="watchlist" deal={deal} openId={open}/>;}
