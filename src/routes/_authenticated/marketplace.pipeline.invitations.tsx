import {createFileRoute} from '@tanstack/react-router';
import {PipelineWorkspacePage} from '@/components/pipeline/workspace-page';
export const Route=createFileRoute('/_authenticated/marketplace/pipeline/invitations')({
 validateSearch:(s:Record<string,unknown>):{deal?:string;open?:string;view?:string}=>({deal:typeof s.deal==='string'?s.deal:undefined,open:typeof s.open==='string'?s.open:undefined,view:s.view==='sent'||s.view==='received'||s.view==='applications'?s.view:undefined}),
 head:()=>({meta:[{title:'NDA Invitations — PitchSnack Pipeline'},{name:'description',content:'NDA Invitations for your PitchSnack deals, from NDA to payment.'},{property:'og:title',content:'NDA Invitations — PitchSnack Pipeline'},{property:'og:description',content:'NDA Invitations for your PitchSnack deals, from NDA to payment.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:Page,
});
function Page(){const {deal,open}=Route.useSearch();return <PipelineWorkspacePage page="invitations" deal={deal} openId={open}/>;}
