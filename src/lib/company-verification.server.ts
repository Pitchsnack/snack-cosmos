import { verificationNdaValid, type VerificationRecord, type VerificationState } from './company-verification';
import { planAccess } from './plan-access.server';

export async function verificationScope(sb: any, userId: string, companyId: string, pipelineId?:string) {
  const { data: owner, error } = await sb.rpc('verification_owner', { _uid: userId, _company: companyId });
  if (error) throw new Error('Company access could not be checked');
  if (owner) return { buyer: false };
  if(!pipelineId)throw new Error('An approved, valid NDA is required');
  const { data: p, error: e } = await sb.from('deal_pipelines').select('status,nda_approved_at,nda_expires_at').eq('id',pipelineId).eq('buyer_user_id',userId).eq('startup_id',companyId).maybeSingle();
  if (e || !verificationNdaValid(p)) throw new Error('An approved, valid NDA is required');
  return { buyer: true };
}

const text = (x: unknown): string | null => typeof x === 'string' && x.trim() ? x : typeof x === 'number' ? String(x) : null;
export async function verificationState(sb: any, userId: string, companyId: string,pipelineId?:string, hubShared = false): Promise<VerificationState> {
  const { buyer } = await verificationScope(sb,userId,companyId,pipelineId);
  const plan = await planAccess(userId);
  const {data:me}=await sb.from('users').select('account_role').eq('id',userId).maybeSingle();
  const isAdmin=me?.account_role==='admin';
  const {data:quote,error:quoteError}=await sb.rpc('report_quote',{_uid:userId,_key:'verification'});if(quoteError)throw new Error('Report price unavailable');
  const [{data:s,error:se},{data:v,error:ve},{data:hp},{data:u},{data:a},{data:orders},{data:rate},{data:report},{data:uses},{data:bp}] = await Promise.all([
    sb.from('startups').select('id,startup_name,registered_name,registered_number,logo_url').eq('id',companyId).single(),
    sb.from('company_verifications').select('*').eq('company_id',companyId).maybeSingle(),
    sb.from('hidden_profiles').select('code_name,ref_no').eq('startup_id',companyId).maybeSingle(),
    sb.from('users').select('first_name,last_name,email').eq('id',userId).maybeSingle(),
    sb.from('verification_access').select('*').eq('company_id',companyId).eq('buyer_account_id',userId).maybeSingle(),
    sb.from('verification_orders').select('id,status,total,ref,paid_at,created_at').eq('company_id',companyId).eq('ordered_by',userId).order('created_at',{ascending:false}).limit(1),
    sb.from('plans').select('verification_business_days,verification_recheck_business_days').eq('status','live').eq('role','seller').order('sort').limit(1).maybeSingle(),
    Promise.resolve({data:null}),
    Promise.resolve({data:[]}),
    buyer ? sb.from('buyer_profiles').select('investor_id,investors(investor_name)').eq('user_id',userId).maybeSingle() : Promise.resolve({data:null}),
  ]);
  if (se || ve || !s) throw new Error('Company report unavailable');
  const {data:canRead,error:ce} = await sb.rpc('verification_can_read',{_uid:userId,_company:companyId});
  if (ce) throw new Error('Report access could not be checked');
  const status = v?.status ?? 'not_ordered';
  let record: VerificationRecord | null = null;
  let checks: VerificationState['checks'] = [];
  let hubAllowed=false;
  if(buyer&&hubShared&&pipelineId){const [{data:grant},{data:share}]=await Promise.all([sb.from('buyer_report_access').select('id').eq('company_id',companyId).eq('buyer_id',userId).eq('report_key','verification').maybeSingle(),sb.from('report_shares').select('report_keys').eq('pipeline_id',pipelineId).eq('buyer_id',userId).is('revoked_at',null).maybeSingle()]);hubAllowed=!!grant||share?.report_keys?.includes('verification')===true;}
  // Admin preview: Admins see stored record data and any partial checks before certification.
  if (((!buyer || canRead || hubAllowed) && ['certified','needs_fix'].includes(status)) || (isAdmin && !buyer)) {
    const [{data:ci,error:ciError},{data:ds,error:dsError},{data:business},{data:cs,error:csError}] = await Promise.all([
      sb.from('company_info_th').select('id,legal_name_th,legal_name_en,registration_number,legal_entity_type_th,legal_entity_status_th,registration_date_th_raw,registered_capital_th_raw,business_size,head_office_address_th,authorized_signatory_th').eq('startup_id',companyId).maybeSingle(),
      sb.from('company_director_th').select('director_name_th,display_order').eq('startup_id',companyId).eq('is_active',true).order('display_order'),
      sb.from('company_registered_business_th').select('business_code,business_description_th,business_objective_th').eq('startup_id',companyId).maybeSingle(),
      sb.from('company_verification_checks').select('key,result,values,source_label').eq('verification_id',v?.id??'00000000-0000-0000-0000-000000000000').order('key'),
    ]);
    if (ciError || dsError || csError) throw new Error('The company record could not be loaded');
    // Deliberately whitelist every field. Shareholders and arbitrary analyst JSON never cross this boundary.
    const x = v?.record_details ?? {};
    record = { nameTh:ci?.legal_name_th??null,nameEn:ci?.legal_name_en??null,profileName:s.registered_name??null,registration:ci?.registration_number??s.registered_number??null,type:ci?.legal_entity_type_th??null,status:ci?.legal_entity_status_th??null,registeredDate:ci?.registration_date_th_raw??null,capital:ci?.registered_capital_th_raw??null,size:ci?.business_size??null,formerName:text(x.former_name),nameChangedOn:text(x.name_changed_on),shares:text(x.shares),par:text(x.par_value),fiscalYearEnd:text(x.fiscal_year_end),businessType:business?.business_description_th??null,tsic:business?.business_code??null,objective:business?.business_objective_th??null,address:ci?.head_office_address_th??null,auditor:text(x.auditor),latestFiling:text(x.latest_filing),signingTh:ci?.authorized_signatory_th??null,signingEn:text(x.signing_rule_en),sellerRole:text(x.seller_role),directors:(ds??[]).map((d:any,i:number)=>{const extra=Array.isArray(x.directors)?x.directors.find((e:any)=>e.name_th===d.director_name_th):null;return {nameTh:d.director_name_th,nameEn:text(extra?.name_en),role:text(extra?.role),canSignAlone:extra?.can_sign_alone===true,isSeller:extra?.is_seller===true};}) };
    checks=(cs??[]).map((c:any)=>({key:c.key,result:c.result,detail:text(c.values?.detail),source:text(c.source_label)?.replace(/DBD/gi,'Company record')??null}));
  }
  let logo: string|null=null;
  if (s.logo_url && !/^https?:/.test(s.logo_url)) { const {data:l}=await sb.storage.from('startup-media').createSignedUrl(s.logo_url,3600); logo=l?.signedUrl??null; } else logo=s.logo_url??null;
  const o=orders?.[0]; const valid=!!canRead;
  return {companyId,company:s.startup_name||hp?.ref_no||'Company',code:hp?.code_name??null,ref:hp?.ref_no??null,logo,status,included:quote.method==='Plan'||quote.method==='Free period',startedAt:v?.started_at??null,readyBy:v?.ready_by??null,checkedAt:v?.checked_at??null,affidavitOn:v?.affidavit_issued_on??null,buyer,plan:plan.plan?.name??null,mode:quote.method==='Plan'||quote.method==='Free period'?'number':'paid',allowance:quote.total,left:quote.left,termEnd:plan.sub?.term_end??null,price:quote.price==null?null:Number(quote.price),vatPct:7,businessDays:rate?.verification_business_days??plan.plan?.verification_business_days??2,recheckDays:rate?.verification_recheck_business_days??1,access:buyer&&a&&valid?{via:a.via,openedAt:a.opened_at,requestedAt:a.requested_at,until:a.open_until}:null,payment:o?{status:o.status,total:Number(o.total),ref:o.ref,at:o.paid_at??o.created_at}:null,email:u?.email??null,viewer:[u?.first_name,u?.last_name].filter(Boolean).join(' '),firm:bp?.investors?.investor_name??'',record,checks,isAdmin};
}