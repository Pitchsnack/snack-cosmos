import {createFileRoute,redirect} from "@tanstack/react-router";
import {z} from "zod";
export const Route=createFileRoute("/_authenticated/my-startups/$id/edit")({
  validateSearch: z.object({
    q: z.string().optional(),
    stage: z.string().optional(),
    industry: z.string().optional(),
    hq: z.string().optional(),
    ct: z.string().optional(),
    ptag: z.string().optional(),
    mtag: z.string().optional(),
    sort: z.enum(["updated_desc", "created_desc", "name_asc", "name_desc"]).optional(),
    view: z.enum(["grid", "split", "list"]).optional(),
    selected: z.string().optional(),
    page: z.coerce.number().int().optional(),
    fav: z.coerce.boolean().optional(),
    tab: z.enum(["edit"]).optional(),
    focus: z.literal("sector").optional(),
    returnTo: z.literal("valuation").optional(),
    section: z.string().regex(/^[a-z-]{2,30}$/).optional(),
  }),
  beforeLoad:({params,search})=>{throw redirect(search.returnTo === "valuation" ? {to:"/my-startups/$id/financials",params:{id:params.id},search:{tab:"valuation",edit:"startup"},replace:true} : {to:"/my-startups",search:{panel:params.id,edit:"startup",view:"private",tab:"images",section:search.section},replace:true});},
  head:()=>({meta:[{title:"Edit my company — PitchSnack"},{name:"description",content:"Edit your PitchSnack company information."},{property:"og:title",content:"Edit my company — PitchSnack"},{property:"og:description",content:"Your private company workspace."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),
});
