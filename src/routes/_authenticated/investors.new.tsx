import {createFileRoute,redirect} from "@tanstack/react-router";
export const Route=createFileRoute("/_authenticated/investors/new")({
 head:()=>({meta:[{title:"Add investor — PitchSnack"},{name:"description",content:"Manage PitchSnack profiles in the shared Edit information pop-up."},{property:"og:title",content:"Add investor — PitchSnack"},{property:"og:description",content:"PitchSnack profile editing."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),
 beforeLoad:({params})=>{throw redirect({to:"/investors",search:{adding:true},replace:true});},
});
