import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {ShieldCheck,PieChart,FileText,Calculator,BarChart3,TriangleAlert,TrendingUp} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {ReportsHub} from '@/components/reports/reports-hub';
import {HubShareAccessDialog} from '@/components/reports/hub-share-dialog';
import {useHubCopy} from '@/components/reports/hub-copy';
import {openHubWithPlan,askHubReport,resolveHubRequest} from '@/lib/reports-hub.functions';
import {reportReadyToView} from '@/lib/pipeline-report-state';
import type {HubData,HubRow,HubKey,Audience} from '@/lib/reports-hub';
const ICONS={verification:ShieldCheck,shareholders:PieChart,statements:FileText,valuation:Calculator,pnl:BarChart3,risk:TriangleAlert,credit:TrendingUp};
export function FinancialReports({hub,seller,onFold}:{hub?:HubData;seller:boolean;onFold:()=>void}){
 const {c,name,date}=useHubCopy();const qc=useQueryClient();const plan=useServerFn(openHubWithPlan),ask=useServerFn(askHubReport),decline=useServerFn(resolveHubRequest);
 const [selected,setSelected]=useState<HubKey|null>(null),[share,setShare]=useState<{key:HubKey;buyer:Audience}|null>(null),[busy,setBusy]=useState(false);
 const run=async(f:()=>Promise<unknown>)=>{setBusy(true);try{await f();await Promise.all([qc.invalidateQueries({queryKey:['reports-hub']}),qc.invalidateQueries({queryKey:['pipeline']})]);}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}};
 if(!hub)return <div className="pipeline-financial-reports" role="status">{c('Reports are not available for this account or deal.','บัญชีหรือดีลนี้ยังเปิดรายงานไม่ได้')}</div>;
 const priceLine=(r:HubRow)=>r.freePeriod&&!r.freeUntil?c('Free period','ช่วงฟรี'):r.freePeriod?c(`Free until ${date(r.freeUntil??null)}`,`ฟรีถึง ${date(r.freeUntil??null)}`):r.inPlan?c(`Free with your plan, ${r.left??'∞'} of ${r.total??'∞'} left`,`ฟรีตามแพ็กเกจของท่าน เหลือ ${r.left??'∞'} จาก ${r.total??'∞'}`):'';
 const render=(r:HubRow)=>{
  const Icon=ICONS[r.key],ready=reportReadyToView(r,seller),shared=r.audience.find(a=>a.state==='shared'),requested=r.audience.find(a=>a.state==='asked'),own=r.audience.find(a=>a.state==='yours');
  const buyer=hub.buyer;const forShare:Audience|null=buyer&&hub.pipelineId?{pipelineId:hub.pipelineId,buyerId:buyer.id,name:buyer.name,sub:buyer.sub,ref:buyer.ref,contact:buyer.contact,state:'asked',at:r.askedAt??'',openedAt:null,allowDownload:false}:null;
  let line='';
  if(seller){line=shared?shared.openedAt?c(`Shared · opened ${date(shared.openedAt)}`,`แชร์แล้ว · เปิดดูเมื่อ ${date(shared.openedAt)}`):c('Shared · not opened yet','แชร์แล้ว · ยังไม่ได้เปิดดู'):requested&&ready?c(`${buyer?.name} asked for it on ${date(requested.at)}`,`${buyer?.name} ขอรายงานนี้เมื่อ ${date(requested.at)}`):own&&ready?c('The buyer has this report','ผู้ซื้อมีรายงานนี้แล้ว'):ready?c(`Not shared with ${buyer?.name} yet`,`ยังไม่ได้แชร์ให้ ${buyer?.name}`):r.status==='in_progress'?c(`In progress · ready on ${date(r.readyBy)}`,`กำลังจัดทำ · พร้อมวันที่ ${date(r.readyBy)}`):r.price===null?c('Not ordered yet · priced by an analyst','ยังไม่ได้สั่งซื้อ · นักวิเคราะห์เป็นผู้เสนอราคา'):[c('Not ordered yet','ยังไม่ได้สั่งซื้อ'),priceLine(r)].filter(Boolean).join(' · ');}
  else{line=ready?r.buyerState==='shared'?[c('Shared by the seller','ผู้ขายแชร์แล้ว'),r.openedAt?c(`opened ${date(r.openedAt)}`,`เปิดดูเมื่อ ${date(r.openedAt)}`):''].filter(Boolean).join(' · '):c(`Yours · opened ${date(r.openedAt)}`,`ของท่าน · เปิดดูเมื่อ ${date(r.openedAt)}`):r.buyerState==='yours'?c(`Ordered · ready by ${date(r.readyBy)}`,`สั่งซื้อแล้ว · พร้อมภายใน ${date(r.readyBy)}`):r.price===null?c('Priced by an analyst','นักวิเคราะห์เป็นผู้เสนอราคา'):[r.askedAt?c(`You asked the seller on ${date(r.askedAt)}`,`ท่านขอให้ผู้ขายแชร์เมื่อ ${date(r.askedAt)}`):r.status!=='ready'?c('Not prepared yet · ready within 1 business day','ยังไม่ได้จัดทำ · พร้อมภายใน 1 วันทำการ'):'',priceLine(r)].filter(Boolean).join(' · ')||c('Not included in your plan','ไม่รวมในแพ็กเกจ');}
  const orderText=r.inPlan?c(seller?'Order free with your plan':'Order for free',seller?'สั่งฟรีด้วยแพ็กเกจ':'สั่งฟรี'):c(`Order · ฿${r.price?.toLocaleString('en-US')}`,`สั่งซื้อ · ฿${r.price?.toLocaleString('en-US')}`);
  return <div className="pipeline-financial-item" key={r.key}><span className="pipeline-financial-icon"><Icon size={16}/></span><div className="pipeline-financial-copy"><b>{name(r.key)}{r.key==='statements'?` · ${r.years} ${c(r.years===1?'year':'years','ปี')}`:''}</b><small>{line}</small></div><div className="pipeline-financial-actions">
   {ready&&(!seller||shared||own)&&<Button data-report-outline variant="outline" onClick={()=>setSelected(r.key)}>{c('View','ดู')}</Button>}
   {seller&&ready&&!shared&&!own&&forShare&&<><Button onClick={()=>setShare({key:r.key,buyer:requested??forShare})}>{c('Share','แชร์')}</Button>{requested&&<Button data-report-outline variant="outline" disabled={busy} onClick={()=>void run(()=>decline({data:{pipelineId:hub.pipelineId??'',key:r.key}}))}>{c('Decline','ปฏิเสธ')}</Button>}</>}
   {!ready&&r.price!==null&&(seller?r.status==='not_ordered':r.buyerState!=='yours')&&<Button disabled={busy} onClick={()=>!seller&&r.inPlan?void run(()=>plan({data:{pipelineId:hub.pipelineId??'',key:r.key}})):setSelected(r.key)}>{orderText}</Button>}
   {!seller&&!ready&&!r.askedAt&&r.buyerState!=='yours'&&r.price!==null&&<Button data-report-outline variant="outline" disabled={busy} onClick={()=>void run(()=>ask({data:{pipelineId:hub.pipelineId??'',key:r.key}}))}>{c('Ask the seller','ขอให้ผู้ขายแชร์')}</Button>}
  </div></div>;
 };
 return <div className="pipeline-financial-reports" role="group" aria-label={seller?c(`Your reports, for ${hub.buyer?.name}`,`รายงานของท่าน สำหรับ ${hub.buyer?.name}`):c(`Reports on ${hub.company}`,`รายงานของ ${hub.company}`)} onClick={e=>{if(!(e.target as HTMLElement).closest('button,a,[role=dialog]')&&!window.getSelection()?.toString())onFold();}}>
  {[true,false].map(ready=>{const rows=hub.rows.filter(r=>reportReadyToView(r,seller)===ready);return rows.length?<section key={String(ready)}><h3>{ready?c('Ready to view','พร้อมให้ดู'):c('Can be ordered','สั่งซื้อได้')} · {rows.length}</h3>{rows.map(render)}</section>:null;})}
  {selected&&<Dialog open onOpenChange={o=>{if(!o){setSelected(null);void qc.invalidateQueries({queryKey:['reports-hub']});}}}><DialogContent className="pipeline-report-dialog" aria-describedby={undefined}><DialogTitle className="sr-only">{name(selected)}</DialogTitle><ReportsHub mode={seller?'seller':'buyer'} pipelineId={hub.pipelineId??undefined} initialReport={selected}/></DialogContent></Dialog>}
  {share&&<HubShareAccessDialog hub={hub} buyer={share.buyer} selected={share.key} onClose={()=>setShare(null)}/>}
 </div>;
}