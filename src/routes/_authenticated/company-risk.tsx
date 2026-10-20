import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/company-risk')({
 head:()=>({meta:[{title:'Company risk — PitchSnack'},{name:'description',content:'Open your company risk in My reports.'},{property:'og:title',content:'Company risk — PitchSnack'},{property:'og:description',content:'Open your company risk in My reports.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:(s:Record<string,unknown>)=>({company:typeof s.company==='string'?s.company:undefined}),
 beforeLoad:({search})=>{throw redirect({to:'/my-reports',search:{company:search.company,report:'risk'},replace:true});},
});
