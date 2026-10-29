import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { PlanRecord } from './plan-editor';
import { canShare, canRequestPlan, planRequestText } from './sidebar-plans';
const Lang=z.enum(['en','th']);
export const mySidebarPlans=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {planAccess}=await import('./plan-access.server'); const a=await planAccess(context.userId);
 if(!canShare(a.role))return {role:null,plans:[] as PlanRecord[],current:null as PlanRecord|null};
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await supabaseAdmin.from('plans').select('*').eq('role',a.role as 'seller').eq('status','live').order('sort'); if(error)throw new Error('Plans unavailable');
 const plans=(data??[]) as unknown as PlanRecord[]; const current=a.plan as PlanRecord|null;
 if(current&&!plans.some(p=>p.id===current.id))plans.push(current);
 return {role:a.role,plans:plans.sort((a,b)=>a.sort-b.sort),current};
});
export const requestPlanChange=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({planId:z.string().uuid(),lang:Lang}).parse(d)).handler(async({context,data})=>{
 const {planAccess}=await import('./plan-access.server');const a=await planAccess(context.userId);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const sb=supabaseAdmin as any;const {data:p}=await sb.from('plans').select('*').eq('id',data.planId).maybeSingle();
 if(!p||!canRequestPlan(a.role,a.plan,p))throw new Error('Plan unavailable');
 const now=new Date().toISOString(),key=`a:${context.userId}`;
 const {error}=await sb.from('marketplace_messages').insert({thread_key:key,sender_id:context.userId,body:planRequestText(a.plan,p,data.lang),files:[],created_at:now});if(error)throw new Error('Request failed');
 await sb.from('marketplace_message_reads').upsert({thread_key:key,user_id:context.userId,read_at:now});
 return {ok:true};
});
export const sendShareInvite=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),lang:Lang}).parse(d)).handler(async({context,data})=>{
 const {roleOf}=await import('./plan-access.server'); const role=await roleOf(context.userId);if(!canShare(role))throw new Error('Not available');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const sb=supabaseAdmin as any;
 // A short burst guard prevents accidental automated sends, not a daily invitation allowance.
 const {count}=await sb.from('share_invitations').select('id',{count:'exact',head:true}).eq('sender_user_id',context.userId).is('buy_order_id',null).gte('sent_at',new Date(Date.now()-60000).toISOString());if((count??0)>=5)throw new Error('Please wait before sending again');
 const {data:existing,error:lookupError}=await sb.from('users').select('id').ilike('email',data.email.replace(/[\\%_]/g,'\\$&')).limit(1);if(lookupError)throw new Error('Invitation unavailable');if(existing?.length)return {ok:true};
 // Check Auth too: unconfirmed accounts may not have a public user row yet.
 const {data:found,error:authError}=await sb.rpc('share_email_has_account',{_email:data.email});if(authError)throw new Error('Invitation unavailable');if(found)return {ok:true};
 const {data:me}=await sb.from('users').select('first_name,last_name').eq('id',context.userId).maybeSingle();const name=[me?.first_name,me?.last_name].filter(Boolean).join(' ')||'PitchSnack member';
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const {data:inv,error}=await sb.from('share_invitations').insert({sender_user_id:context.userId,email:data.email,token}).select('id').single();if(error)throw new Error('Invitation unavailable');
 const {sendTemplateEmail}=await import('./email-templates/send-email');
 const {shareEmailCopy}=await import('@/i18n/sidebar-share');
 const base={alert_key:'Share invitation',role,user_id:context.userId,email:data.email,subject:shareEmailCopy.subject[data.lang==='th'?1:0].replace('{name}',name),ref_key:`share-invitation:${inv.id}`};
 try {
 const result=await sendTemplateEmail('share-invitation',data.email,{templateData:{name,email:data.email,lang:data.lang,url:`https://pitchsnack.com/signup?join=${token}`},idempotencyKey:`share-invitation:${inv.id}`});
 await sb.from('email_alert_log').insert({...base,status:result.sent?'sent':'suppressed'});
 } catch(error) {
 await sb.from('email_alert_log').insert({...base,status:'failed',reason:(error instanceof Error?error.message:'Send failed').slice(0,300)});
 throw new Error('Invitation unavailable');
 }
 return {ok:true};
});
