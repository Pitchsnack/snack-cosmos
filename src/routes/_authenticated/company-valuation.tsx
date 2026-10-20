import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/company-valuation')({
 head:()=>({meta:[{title:'Company valuation — PitchSnack'},{name:'description',content:'Open your company valuation in My reports.'},{property:'og:title',content:'Company valuation — PitchSnack'},{property:'og:description',content:'Open your company valuation in My reports.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:(s:Record<string,unknown>)=>({company:typeof s.company==='string'?s.company:undefined}),
 beforeLoad:({search})=>{throw redirect({to:'/my-reports',search:{company:search.company,report:'valuation'},replace:true});},
});
