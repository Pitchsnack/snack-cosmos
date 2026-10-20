import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/my-verification')({
 head:()=>({meta:[{title:'Company verification report — PitchSnack'},{name:'description',content:'Your private company registration, directors and signing authority report, checked against official records.'},{property:'og:title',content:'Company verification report — PitchSnack'},{property:'og:description',content:'Company registration, directors and signing authority checked by PitchSnack.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:(s:Record<string,unknown>)=>({company:typeof s.company==='string'?s.company:undefined}),
 beforeLoad:({search})=>{throw redirect({to:'/my-reports',search:{company:search.company,report:'verification'},replace:true});},
});