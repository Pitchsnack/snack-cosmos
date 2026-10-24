import {createFileRoute,redirect} from "@tanstack/react-router";
export const Route=createFileRoute("/_authenticated/startups/$id/edit")({
 head:()=>({meta:[{title:"Edit startup — PitchSnack"},{name:"description",content:"Manage PitchSnack profiles in the shared Edit information pop-up."},{property:"og:title",content:"Edit startup — PitchSnack"},{property:"og:description",content:"PitchSnack profile editing."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),
 beforeLoad:({params})=>{throw redirect({to:"/startups",search:{editor:params.id,selected:params.id},replace:true});},
});
