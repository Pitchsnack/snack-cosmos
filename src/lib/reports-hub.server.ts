import { accessibleCount,buyerReportState,hubNdaActive,HUB_NAMES,REPORT_KEYS,sellerHubRoleAllowed,type HubData,type HubKey,type HubMode,type HubRow,type Audience,type HubContent,type ShareholderContent } from './reports-hub';
import {typeName} from './investor-bands';
import { currentStep,STEPS } from './pipeline-state';
import { planAccess,requireRole } from './plan-access.server';

export async function hubScope(ctx:any, mode:HubMode, companyId?:string,pipelineId?:string) {
  let p:any=null;
  if(pipelineId){const {data,error}=await ctx.supabase.from('deal_pipelines').select('*').eq('id',pipelineId).maybeSingle();if(error||!data)throw new Error('Deal unavailable');p=data;companyId=p.startup_id;}
  if(!companyId)throw new Error('Choose a company');
  if(mode==='admin') {const {data}=await ctx.supabase.rpc('is_control',{_user_id:ctx.userId});if(!data)throw new Error('Control Admin only');}
  else if(mode==='buyer'){await requireRole(ctx.userId,['buyer']);if(!p||p.buyer_user_id!==ctx.userId||!hubNdaActive(p))throw new Error('An approved active NDA is required');}
  else {if(!sellerHubRoleAllowed(await requireRole(ctx.userId,['seller'])))throw new Error('Seller view unavailable');const {data}=await ctx.supabase.rpc('verification_owner',{_uid:ctx.userId,_company:companyId});if(!data)throw new Error('Not your company');const {scopeStartupIds}=await import('./workspace-scope.server');if(!(await scopeStartupIds(ctx.userId,[companyId])).includes(companyId))throw new Error('Not in your workspace');}
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');return {sb:supabaseAdmin as any,companyId,p};
}
const getRows=async(q:any)=>{const {data,error}=await q;if(error){console.error('[reports-hub] query failed',error.message);throw new Error('Report data could not be loaded');}return data??[];};
const text=(x:any):string|null=>typeof x==='string'&&x.trim()?x:null;
const num=(x:any):number|null=>typeof x==='number'&&Number.isFinite(x)?x:null;

export async function hubData(ctx:any,mode:HubMode,companyId?:string,pipelineId?:string):Promise<HubData>{
  const {sb,companyId:cid,p}=await hubScope(ctx,mode,companyId,pipelineId);
  const [sts,hps,cis,records,orders,vs,vos,fs,ps,shares,access,requests,va] = await Promise.all([
    getRows(sb.from('startups').select('id,startup_name,registered_name,registered_number,industry,address_province_state,status,run_by').eq('id',cid)),
    getRows(sb.from('hidden_profiles').select('code_name,ref_no,approval_status').eq('startup_id',cid)),
    getRows(sb.from('company_info_th').select('legal_name_en,legal_name_th,registration_number,legal_entity_status_th').eq('startup_id',cid)),
    getRows(sb.from('company_report_records').select('report_key,status,generated_at,authorised_at,ready_by').eq('company_id',cid)),
    getRows(sb.from('report_orders').select('id,kind,status,ordered_by,paid_at,amount,generated_at,delivered_at,due_at').eq('startup_id',cid).not('status','in','(cancelled,refunded)')),
    getRows(sb.from('company_verifications').select('status,checked_at,ready_by,included,started_at').eq('company_id',cid)),
    getRows(sb.from('verification_orders').select('status,paid_at,total,ordered_by').eq('company_id',cid)),
    getRows(sb.from('financial_statements').select('fiscal_year,created_at,retrieved_at').eq('startup_id',cid)),
    getRows(sb.from('deal_pipelines').select('*').eq('startup_id',cid)),
    getRows(sb.from('report_shares').select('*').eq('business_id',cid).is('revoked_at',null)),
    getRows(sb.from('buyer_report_access').select('*').eq('company_id',cid)),
    getRows(sb.from('report_share_requests').select('*').eq('company_id',cid).order('requested_at',{ascending:false})),
    getRows(sb.from('verification_access').select('buyer_account_id,via,opened_at,open_until').eq('company_id',cid)),
  ]);
  const s=sts[0];if(!s)throw new Error('Company unavailable');const hp=hps[0],ci=cis[0],v=vs[0];
  const ids=[...new Set(ps.map((d:any)=>d.buyer_user_id))] as string[];
  const [bps,owners,sellerUsers]=await Promise.all([
    ids.length?getRows(sb.from('buyer_profiles').select('user_id,investor_id,ref_no,city,investors(investor_name,investor_type,legal_name,acts_for_types)').in('user_id',ids)):[],
    getRows(sb.from('startup_ownership').select('owning_agent_user_id').eq('startup_id',cid)),
    getRows(sb.from('startup_users').select('user_id').eq('startup_id',cid)),
  ]);
  const userIds=[...new Set([...ids,...owners.map((o:any)=>o.owning_agent_user_id),...sellerUsers.map((o:any)=>o.user_id)])].filter(Boolean);
  const users=userIds.length?await getRows(sb.from('users').select('id,first_name,last_name').in('id',userIds)):[];
  const buyerFor=(id:string)=>{const bp=bps.find((b:any)=>b.user_id===id),u=users.find((u:any)=>u.id===id);return {id,name:bp?.investors?.legal_name??bp?.investors?.investor_name??([u?.first_name,u?.last_name].filter(Boolean).join(' ')||'Buyer'),sub:[typeName(bp?.investors?.investor_type,bp?.investors?.acts_for_types),bp?.city].filter(Boolean).join(' · '),ref:bp?.ref_no??null,contact:[u?.first_name,u?.last_name].filter(Boolean).join(' ')||null};};
  const a=mode==='buyer'?await planAccess(ctx.userId):null;
  const [planRows,uses,rates]=await Promise.all([
    a?.plan&&!a.ended?getRows(sb.from('plan_reports').select('*').eq('plan_id',a.plan.id)):[],
    a?.termStart?getRows(sb.from('plan_usage').select('kind,ref').eq('user_id',ctx.userId).eq('term_start',a.termStart)):[],
    getRows(sb.from('plans').select('verification_price_thb').eq('role','seller').eq('status','live').eq('verification_mode','paid').order('sort').limit(1)),
  ]);
  const verificationUses=a?.termStart?await getRows(sb.from('verification_usage').select('id').eq('buyer_account_id',ctx.userId).eq('term_start',a.termStart).is('returned_at',null)):[];
  const catalog=(await import('@/config/report-catalog.json')).default;
  const yearCount=new Set(fs.map((r:any)=>r.fiscal_year)).size;const years=yearCount>=5?5:yearCount>=3?3:1;
  const rows:HubRow[]=REPORT_KEYS.map(key=>{
    const r=records.find((r:any)=>r.report_key===key);const kind=key==='statements'?'financials':key;
    const o=orders.find((o:any)=>o.kind===kind||(['statements','valuation'].includes(key)&&o.kind==='bundle'));
    let authorisedAt=r?.authorised_at??o?.delivered_at??null;
    let generatedAt=r?.generated_at??o?.generated_at??null;
    let readyBy=r?.ready_by??o?.due_at??null;
    let status:HubRow['status']=authorisedAt?'ready':o||r?.status==='in_progress'?'in_progress':'not_ordered';
    if(key==='verification'){authorisedAt=['certified','needs_fix'].includes(v?.status)?v.checked_at:null;generatedAt=authorisedAt;readyBy=v?.ready_by??null;status=authorisedAt?'ready':v&&v.status!=='not_ordered'?'in_progress':'not_ordered';}
    if(key==='statements'&&fs.length&&!generatedAt)generatedAt=fs.map((f:any)=>f.retrieved_at??f.created_at).filter(Boolean).sort().at(-1)??null;
    if(key==='pnl'&&!o&&!r){const f=orders.find((o:any)=>['financials','bundle'].includes(o.kind));authorisedAt=f?.delivered_at??null;generatedAt=f?.generated_at??null;status=authorisedAt?'ready':f?'in_progress':'not_ordered';}
    // Persisted grant metadata is distinct from report readiness: ordering never fabricates content.
    const planKey=key==='statements'?`fs${years}`:key;const pr=planRows.find((r:any)=>r.report_key===planKey);const total=pr?.mode==='number'?pr.per_term:null;const used=key==='verification'?verificationUses.length:uses.filter((u:any)=>u.kind===`report:${planKey}`).length;const left=total==null?null:Math.max(0,total-used);const inPlan=!!pr&&pr.mode!=='none'&&(pr.mode!=='number'||(left??0)>0);
    const audience:Audience[]=[];
    for(const d of ps){if(!hubNdaActive(d))continue;const b=buyerFor(d.buyer_user_id);const sh=shares.find((s:any)=>s.pipeline_id===d.id);const keys=sh?.report_keys??[];const shared=!!sh&&(keys.includes(key)||(key==='statements'&&sh.financials)||(key==='valuation'&&sh.valuation));const own=access.find((x:any)=>x.buyer_id===d.buyer_user_id&&x.report_key===key)??(key==='verification'?va.find((x:any)=>x.buyer_account_id===d.buyer_user_id&&(x.via==='paid'||x.via==='contract'||x.open_until&&Date.parse(x.open_until)>Date.now())):null);const req=requests.find((x:any)=>x.buyer_id===d.buyer_user_id&&x.report_key===key&&x.status==='open');
      if(shared&&status==='ready')audience.push({pipelineId:d.id,buyerId:b.id,name:b.name,sub:b.sub,ref:b.ref,contact:b.contact,state:'shared',at:sh.shared_at,openedAt:sh.report_opened_at?.[key]??(key==='statements'?d.report_viewed_at:null),allowDownload:!!sh.allow_download});
      else if(own)audience.push({pipelineId:d.id,buyerId:b.id,name:b.name,sub:b.sub,ref:b.ref,contact:b.contact,state:'yours',at:own.opened_at,openedAt:own.last_opened_at??own.opened_at,allowDownload:true});
      if(req&&!shared)audience.push({pipelineId:d.id,buyerId:b.id,name:b.name,sub:b.sub,ref:b.ref,contact:b.contact,state:'asked',at:req.requested_at,openedAt:null,allowDownload:false});
    }
    const mine=p?audience.filter(x=>x.pipelineId===p.id):[];const sh=mine.find(x=>x.state==='shared'),own=mine.find(x=>x.state==='yours'),asked=mine.find(x=>x.state==='asked');const declined=p?requests.find((x:any)=>x.pipeline_id===p.id&&x.report_key===key&&x.status==='declined'):null;
    if(mode==='buyer'&&own&&generatedAt)status='ready';
    const price=key==='verification'?num(Number(rates[0]?.verification_price_thb)):(catalog.prices as Record<string,number>)[key==='pnl'?'financials':kind]??null;
    return {key,planKey,years:key==='statements'?years:0,name:HUB_NAMES[key],status,generatedAt,authorisedAt,readyBy,orderId:o?.id??null,paidAt:o?.paid_at??(key==='verification'?vos.find((o:any)=>o.status==='paid')?.paid_at:null),paidAmount:o?Number(o.amount):null,price,buyerState:buyerReportState({shared:!!sh,yours:!!own,asked:!!asked,ready:status==='ready',inPlan}),openedAt:sh?.openedAt??own?.openedAt??null,askedAt:asked?.at??null,declinedAt:declined?.resolved_at??null,inPlan,left,total,included:key==='verification'&&!!v?.included,audience:mode==='buyer'?[]:p?mine:audience,allowDownload:sh?.allowDownload??!!own};
  });
  const step=p?Math.min(6,currentStep({ndaApprovedAt:p.nda_approved_at,reportSharedAt:p.report_shared_at,loiAcceptedAt:p.loi_accepted_at,contactAt:p.contact_at,legalAt:p.legal_at,spaAt:p.spa_at,paymentAt:p.payment_at} as any)):0;
  const ownerIds=[...owners.map((x:any)=>x.owning_agent_user_id),...sellerUsers.map((x:any)=>x.user_id)];const owner=users.filter((u:any)=>ownerIds.includes(u.id)).map((u:any)=>[u.first_name,u.last_name].filter(Boolean).join(' ')).filter(Boolean).join(', ')||null;
  return {mode,companyId:cid,pipelineId:p?.id??null,company:ci?.legal_name_en??s.registered_name??ci?.legal_name_th??s.startup_name??hp?.ref_no??'Company',companyTh:ci?.legal_name_th??null,code:hp?.code_name??null,ref:hp?.ref_no??null,registration:ci?.registration_number??s.registered_number??null,sector:s.industry?.join(' · ')??null,province:s.address_province_state??null,companyStatus:s.status??null,fiscalYear:fs.length?Math.max(...fs.map((x:any)=>x.fiscal_year)):null,owner,runBy:s.run_by??null,buyer:p?buyerFor(p.buyer_user_id):null,ndaAt:p?.nda_approved_at??null,step,stepName:STEPS[step]??'NDA',rows,count:mode==='buyer'?accessibleCount(rows):rows.filter(r=>r.status==='ready').length,waiting:rows.filter(r=>r.orderId&&r.status!=='ready').length,fresh:rows.some(r=>r.status==='ready'&&['shared','yours','plan'].includes(r.buyerState)&&(!r.openedAt||!!r.generatedAt&&r.generatedAt>r.openedAt))};
}

export async function hubContent(ctx:any,mode:HubMode,cid:string,pipelineId:string|undefined,key:HubKey,allowUngenerated=false):Promise<HubContent>{
  const data=await hubData(ctx,mode,cid,pipelineId);const row=data.rows.find(r=>r.key===key);if(!row)throw new Error('Report unavailable');
  if(mode!=='admin'&&(row.status!=='ready'||(mode==='buyer'&&!['shared','yours'].includes(row.buyerState))))throw new Error('Open or order this report first');
  if(mode==='admin'&&!allowUngenerated&&!row.generatedAt){
    // Stored-data Admin preview is read-only; it never grants seller readiness or fabricates analyst content.
    const {sb}=await hubScope(ctx,mode,cid,pipelineId);
    const [companies,infos,filings,orders]=await Promise.all([
      getRows(sb.from('startups').select('registered_number').eq('id',cid)),
      getRows(sb.from('company_info_th').select('registration_number').eq('startup_id',cid)),
      getRows(sb.from('financial_statements').select('registration_number').eq('startup_id',cid)),
      getRows(sb.from('report_orders').select('id').eq('startup_id',cid).limit(1)),
    ]);
    const norm=(value:unknown)=>String(value??'').replace(/\D/g,'');
    const reg=norm(companies[0]?.registered_number);
    const linked=reg.length===13&&[...infos,...filings].some(r=>norm(r.registration_number)===reg);
    const stored=linked&&!orders.length?await getRows(sb.from('dbd_company_records').select('registration_number').eq('registration_number',reg)):[];
    if(!stored.length)throw new Error('No report has been generated yet');
  }
  const {sb}=await hubScope(ctx,mode,cid,pipelineId);
  if(key==='verification'){
    const {verificationState}=await import('./company-verification.server');const state=await verificationState(sb,ctx.userId,cid,pipelineId,mode==='buyer'&&['shared','yours'].includes(row.buyerState));
    // Shared verification is authorised by the hub, but the canonical private reader is still enforced.
    if(mode==='buyer'&&!state.record)throw new Error('Company verification access unavailable');
    return {verification:state};
  }
  if(key==='shareholders'||key==='credit'){
    const records=await getRows(sb.from('company_report_records').select('content,source_filed_on,checked_on').eq('company_id',cid).eq('report_key',key));const r=records[0];if(!r?.content)throw new Error('An analyst has not recorded this report yet');const x=r.content;
    if(key==='credit')return {credit:(Array.isArray(x.sections)?x.sections:[]).slice(0,20).map((s:any)=>({title:text(s.title)??'',text:text(s.text)??''}))};
    const s:ShareholderContent={capital:num(x.capital),shares:num(x.shares),par:num(x.par),fullyPaid:typeof x.fully_paid==='boolean'?x.fully_paid:null,thaiPct:num(x.thai_pct),ultimateOwner:text(x.ultimate_owner),ultimatePct:num(x.ultimate_pct),holders:(Array.isArray(x.holders)?x.holders:[]).map((h:any)=>({name:text(h.name)??'',registration:text(h.registration),role:text(h.role),type:text(h.type)??'',nationality:text(h.nationality)??'',shares:num(h.shares),pct:Math.max(0,Math.min(100,num(h.pct)??0))})),chains:(Array.isArray(x.chains)?x.chains:[]).map((c:any)=>({description:text(c.description)??'',effective:text(c.effective)??''})),notes:(Array.isArray(x.notes)?x.notes:[]).slice(0,3).map((c:any)=>({title:text(c.title)??'',text:text(c.text)??''})),sources:(Array.isArray(x.sources)?x.sources:[]).filter((s:any)=>typeof s==='string'),filedOn:r.source_filed_on,checkedOn:r.checked_on};return {shareholders:s};
  }
  const [ss,ci,inc,pos,cf,rat]=await Promise.all([getRows(sb.from('startups').select('startup_name,registered_name,registered_number').eq('id',cid)),getRows(sb.from('company_info_th').select('legal_name_th,legal_name_en,legal_entity_status_th,registration_number').eq('startup_id',cid)),getRows(sb.from('income_statement_items').select('*').eq('startup_id',cid)),getRows(sb.from('financial_position_items').select('*').eq('startup_id',cid)),getRows(sb.from('cash_flow_items').select('*').eq('startup_id',cid)),getRows(sb.from('financial_ratios').select('*').eq('startup_id',cid))]);
  const years=[...new Set(inc.map((i:any)=>i.fiscal_year))].sort((a:any,b:any)=>a-b).slice(-(key==='statements'?row.years:5)) as number[];
  const items=(xs:any[])=>xs.filter(x=>years.includes(x.fiscal_year)).map(x=>({fiscal_year:x.fiscal_year,item_code:x.item_code,item_label:x.item_label,amount:x.amount==null?null:Number(x.amount),percent_change:x.percent_change==null?null:Number(x.percent_change),display_order:x.display_order,is_total:!!x.is_total,section:x.section??null}));
  const valuation=key==='valuation'?await hubValuation(sb,cid,years.at(-1)):undefined;
  return {valuation,financials:{startupId:cid,startupName:data.company,registeredName:ss[0]?.registered_name??null,legalNameTh:ci[0]?.legal_name_th??null,legalNameEn:ci[0]?.legal_name_en??null,logoUrl:null,profile:{registeredType:null,status:ci[0]?.legal_entity_status_th??null,registeredDate:null,registeredCapital:null,registeredNumber:data.registration,businessSize:null},currency:'THB',years,statements:[],income:items(inc),position:items(pos),cashFlow:items(cf),ratios:rat.filter((x:any)=>years.includes(x.fiscal_year)).map((x:any)=>({fiscal_year:x.fiscal_year,ratio_category:x.ratio_category,ratio_code:x.ratio_code,ratio_label:x.ratio_label,value:x.value==null?null:Number(x.value),unit:x.unit,display_order:x.display_order}))}};
}
async function hubValuation(sb:any,cid:string,year:number|undefined):Promise<import('./reports-hub').HubValuation>{
 const {DEFAULT_VALUATION_SETTINGS}=await import('./valuation-adjustments');
 const companies='id,name,ticker,market,revenue_thb_m,ebitda_margin_pct,ev_ebitda,pe,pbv,gross_margin_pct,net_margin_pct,roe_pct,debt_equity,revenue_growth_pct,statement_period';
 const [sts,chosen,adjustments,settings]=await Promise.all([
  getRows(sb.from('startups').select('sector,business_model,peer_basis').eq('id',cid)),
  getRows(sb.from('startup_peer_selections').select(`chosen_at,listed_companies(${companies})`).eq('startup_id',cid)),
  year?getRows(sb.from('valuation_adjustments').select('id,description,type,filing_line,amount,discount_pct,costs_amount,recurs').eq('startup_id',cid).eq('fiscal_year',year)):[],
  year?getRows(sb.from('valuation_settings').select('stake,tax_rate,benchmark_peer_company_id').eq('startup_id',cid).eq('fiscal_year',year)):[],
 ]);
 const s=sts[0],sector=s?.sector??null,model=s?.business_model??null;
 const sets=sector?await getRows(sb.from('peer_sets').select('id,sector,business_model,is_baseline,last_refreshed_at').eq('sector',sector)):[];
 const exact=model?sets.find((x:any)=>x.business_model===model):null;const set=exact??sets.find((x:any)=>!x.business_model);
 const members=set?await getRows(sb.from('peer_set_members').select(`listed_companies(${companies})`).eq('peer_set_id',set.id)):[];
 const toPeer=(x:any):import('./peer-comparables').Peer=>({id:x.id,listedCompanyId:x.id,companyName:x.name,ticker:x.ticker,market:x.market,revenueThbM:num(x.revenue_thb_m==null?null:Number(x.revenue_thb_m)),ebitdaMarginPct:num(x.ebitda_margin_pct==null?null:Number(x.ebitda_margin_pct)),evEbitda:num(x.ev_ebitda==null?null:Number(x.ev_ebitda)),pe:num(x.pe==null?null:Number(x.pe)),pbv:num(x.pbv==null?null:Number(x.pbv)),grossMarginPct:num(x.gross_margin_pct==null?null:Number(x.gross_margin_pct)),netMarginPct:num(x.net_margin_pct==null?null:Number(x.net_margin_pct)),roePct:num(x.roe_pct==null?null:Number(x.roe_pct)),debtEquity:num(x.debt_equity==null?null:Number(x.debt_equity)),revenueGrowthPct:num(x.revenue_growth_pct==null?null:Number(x.revenue_growth_pct)),statementPeriod:x.statement_period});
 const peers=members.map((x:any)=>x.listed_companies).filter(Boolean).map(toPeer);
 const setting=settings[0];
 return {match:{state:!sector?'no-sector':exact?'exact':set?'sector-only':'no-peer-set',sector,businessModel:model,applied:set?{sector,businessModel:set.business_model,peerCount:peers.length,lastRefreshedAt:set.last_refreshed_at}:null,narrower:null},peerSet:{exists:!!set,id:set?.id??null,sector:sector??'',businessModel:set?.business_model??null,isBaseline:!!set?.is_baseline,lastRefreshedAt:set?.last_refreshed_at??null,ownerName:null,peers},selection:{basis:s?.peer_basis??'sector',peers:chosen.map((x:any)=>x.listed_companies).filter(Boolean).map(toPeer),chosenAt:chosen[0]?.chosen_at??null,chosenByName:null},adjustments:{settings:setting?{stake:setting.stake,taxRate:Number(setting.tax_rate),benchmarkPeerId:setting.benchmark_peer_company_id}:DEFAULT_VALUATION_SETTINGS,adjustments:adjustments.map((x:any)=>({id:x.id,description:x.description,type:x.type,filingLine:x.filing_line,amount:Number(x.amount),discountPct:x.discount_pct==null?null:Number(x.discount_pct),costsAmount:x.costs_amount==null?null:Number(x.costs_amount),recurs:x.recurs}))}};
}
