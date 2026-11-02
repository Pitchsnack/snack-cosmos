import {beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({startup:{id:'11111111-1111-4111-8111-111111111111',tenant_id:'tenant',short_description:'Own description',long_description:'Own operations',product_tags:['Services'],market_tags:[],setup_reached:'size'} as Record<string,unknown>,updates:[] as {table:string;row:Record<string,unknown>}[],allowed:true}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const q={middleware:()=>q,inputValidator:()=>q,handler:(fn:unknown)=>fn};return q;}}));
vi.mock('../../src/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
vi.mock('../../src/lib/seller-setup.server',()=>({assertCanSetup:async()=>{if(!f.allowed)throw new Error('Not your business');}}));
vi.mock('../../src/integrations/supabase/client.server',()=>({supabaseAdmin:{from:(table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,in:()=>q,update:(row:Record<string,unknown>)=>{f.updates.push({table,row});return q;},delete:()=>q,insert:()=>q,single:async()=>({data:table==='startups'?f.startup:{id:'founder-1'},error:null}),maybeSingle:async()=>({data:table==='startups'?f.startup:null,error:null}),then:(resolve:(v:unknown)=>void)=>resolve({data:table==='startup_founders'?[{id:'founder-1'}]:null,error:null})};return q;}}}));
import {saveSellerSetup,applySellerEnrich} from '../../src/lib/seller-setup.functions';
type Handler=(p:{data:Record<string,unknown>;context:Record<string,unknown>})=>Promise<unknown>;
const context={userId:'owner',supabase:{}};
const draft=()=>({id:f.startup.id,role:null,name:'Company',reg:'',web:'',year:'2014',city:'',rev:null,size:'11-50',sector:'Packaging',licences:[],iso:[],shortDescription:'Own description',longDescription:'Own operations',productTags:['Services'],marketTags:[]});
beforeEach(()=>{f.updates=[];f.allowed=true;f.startup.setup_reached='size';});
describe('seller setup server rules',()=>{
 it('keeps active business access checks before writes',async()=>{f.allowed=false;await expect((saveSellerSetup as unknown as Handler)({data:draft(),context})).rejects.toThrow('Not your business');expect(f.updates).toHaveLength(0);});
 it('requires a named founder on completion',async()=>{await expect((saveSellerSetup as unknown as Handler)({data:{...draft(),done:true,founders:[{full_name:''}]},context})).rejects.toThrow('founder name');expect(f.updates).toHaveLength(0);});
 it('requires descriptions and product tags on completion',async()=>{await expect((saveSellerSetup as unknown as Handler)({data:{...draft(),done:true,shortDescription:'',founders:[{full_name:'Owner'}]},context})).rejects.toThrow('descriptions');expect(f.updates).toHaveLength(0);});
 it('maps stored size progress to founded without moving back',async()=>{await (saveSellerSetup as unknown as Handler)({data:{...draft(),reached:'web'},context});expect(f.updates[0]?.row.setup_reached).toBe('founded');});
 it('later enrichment leaves all four completed Website fields unchanged including empty optional markets',async()=>{await (applySellerEnrich as unknown as Handler)({data:{id:f.startup.id,r:{shortDescription:'New',longDescription:'New',productTags:['New'],marketTags:['New']}},context});expect(f.updates).toHaveLength(0);});
 it('updates existing founder ID instead of deleting/recreating it',async()=>{await (saveSellerSetup as unknown as Handler)({data:{...draft(),founders:[{id:'founder-1',full_name:'Owner'}]},context});const row=f.updates.find(x=>x.table==='startup_founders');expect(row?.row.full_name).toBe('Owner');});
});
