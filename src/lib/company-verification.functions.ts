import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const input = z.object({companyId:z.string().uuid()});
export const getCompanyVerification=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(d=>input.parse(d)).handler(async({context,data})=>{
  const {data:owner}=await context.supabase.rpc('verification_owner',{_uid:context.userId,_company:data.companyId});
  const {data:nda}=await context.supabase.rpc('verification_nda_valid',{_uid:context.userId,_company:data.companyId});
  if(!owner&&!nda) throw new Error('An approved, valid NDA is required');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {verificationState}=await import('./company-verification.server');
  return verificationState(supabaseAdmin,context.userId,data.companyId);
});
export const openCompanyVerification=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>input.parse(d)).handler(async({context,data})=>{
  const {data:nda,error}=await context.supabase.rpc('verification_nda_valid',{_uid:context.userId,_company:data.companyId});
  if(error||!nda)throw new Error('An approved, valid NDA is required');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error:e}=await supabaseAdmin.rpc('verification_open',{_uid:context.userId,_company:data.companyId});
  if(e)throw new Error(e.message);
  const {verificationState}=await import('./company-verification.server');
  return verificationState(supabaseAdmin,context.userId,data.companyId);
});