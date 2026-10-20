import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/credit-risk')({
 head:()=>({meta:[{title:'Credit risk — PitchSnack'},{name:'description',content:'Open your credit risk in My reports.'},{property:'og:title',content:'Credit risk — PitchSnack'},{property:'og:description',content:'Open your credit risk in My reports.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:(s:Record<string,unknown>)=>({company:typeof s.company==='string'?s.company:undefined}),
 beforeLoad:({search})=>{throw redirect({to:'/my-reports',search:{company:search.company,report:'credit'},replace:true});},
});
