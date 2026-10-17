import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const getAdminAnalytics=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {requireHelpAdmin}=await import('./admin-help.server');await requireHelpAdmin(context);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {readAnalytics}=await import('./analytics.server');return readAnalytics(supabaseAdmin);
});
export const recordSignInDay=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.rpc('record_sign_in_day');if(error)throw new Error('Unable to record sign-in day');return {recorded:data,day:new Date(Date.now()+7*3600000).toISOString().slice(0,10)};
});
export const resendAnalyticsConfirmation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid()}).parse(d)).handler(async({context,data})=>{
 const {requireHelpAdmin}=await import('./admin-help.server');await requireHelpAdmin(context);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:target,error}=await supabaseAdmin.from('users').select('email,account_role').eq('id',data.id).single();if(error||!target||!['seller','buyer','advisor'].includes(target.account_role??''))throw new Error('Person unavailable');
 const {data:auth,error:ae}=await supabaseAdmin.auth.admin.getUserById(data.id);if(ae||auth.user.email_confirmed_at)throw new Error('This email is already confirmed');
 const {error:sendError}=await supabaseAdmin.auth.resend({type:'signup',email:target.email});if(sendError)throw new Error('Unable to send a new confirmation email');return {email:target.email};
});