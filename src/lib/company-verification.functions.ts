import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const input = z.object({companyId:z.string().uuid(),pipelineId:z.string().uuid().optional()});
export const getCompanyVerification=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(d=>input.parse(d)).handler(async({context,data})=>{
  const {data:owner}=await context.supabase.rpc('verification_owner',{_uid:context.userId,_company:data.companyId});
  const {data:nda}=data.pipelineId ? await context.supabase.rpc('verification_pipeline_valid',{_uid:context.userId,_company:data.companyId,_pipeline:data.pipelineId}) : {data:false};
  if(!owner&&!nda) throw new Error('An approved, valid NDA is required');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {verificationState}=await import('./company-verification.server');
  return verificationState(supabaseAdmin,context.userId,data.companyId,data.pipelineId);
});
export const openCompanyVerification=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>input.parse(d)).handler(async({context,data})=>{
  if(!data.pipelineId)throw new Error('An approved, valid NDA is required');
  const {data:nda,error}=await context.supabase.rpc('verification_pipeline_valid',{_uid:context.userId,_company:data.companyId,_pipeline:data.pipelineId});
  if(error||!nda)throw new Error('An approved, valid NDA is required');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error:e}=await supabaseAdmin.rpc('verification_open_pipeline',{_uid:context.userId,_company:data.companyId,_pipeline:data.pipelineId});
  if(e)throw new Error(e.message);
  const {verificationState}=await import('./company-verification.server');
  return verificationState(supabaseAdmin,context.userId,data.companyId,data.pipelineId);
});
export const orderCompanyVerification=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>input.parse(d)).handler(async({context,data})=>{const {data:owner}=await context.supabase.rpc('verification_owner',{_uid:context.userId,_company:data.companyId});if(!owner)throw new Error('Not your company');const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {error}=await (supabaseAdmin as any).rpc('create_verification_report_order',{_uid:context.userId,_company:data.companyId});if(error)throw new Error(error.message);return {ok:true};});