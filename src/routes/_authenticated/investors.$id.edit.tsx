import {z} from "zod";
import {createFileRoute,redirect} from "@tanstack/react-router";
export const Route=createFileRoute("/_authenticated/investors/$id/edit")({
 validateSearch:z.object({tab:z.string().optional()}),
 head:()=>({meta:[{title:"Edit investor — PitchSnack"},{name:"description",content:"Manage PitchSnack profiles in the shared Edit information pop-up."},{property:"og:title",content:"Edit investor — PitchSnack"},{property:"og:description",content:"PitchSnack profile editing."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),
 beforeLoad:({params,search})=>{throw redirect({to:"/investors/$id",params:{id:params.id},search:{from:"edit",editor:true,...(search.tab ? {tab:search.tab} : {})},replace:true});},
});
