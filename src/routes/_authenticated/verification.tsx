import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/verification')({
 head:()=>({meta:[{title:'Company verification — PitchSnack'},{name:'description',content:'Open your company verification in My reports.'},{property:'og:title',content:'Company verification — PitchSnack'},{property:'og:description',content:'Open your company verification in My reports.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:(s:Record<string,unknown>)=>({company:typeof s.company==='string'?s.company:undefined}),
 beforeLoad:({search})=>{throw redirect({to:'/my-reports',search:{company:search.company,report:'verification'},replace:true});},
});
