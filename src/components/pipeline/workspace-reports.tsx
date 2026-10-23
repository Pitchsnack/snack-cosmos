import {useEffect,useRef,useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';
import {useTranslation} from '@/i18n/language';
import {usePipelineWorkspace} from '@/hooks/use-pipeline-workspace';
import {pipelineOpen,pipelineStep} from '@/lib/pipeline-pages';
import {STEPS} from '@/lib/pipeline-state';
import {ReportsHub} from '@/components/reports/reports-hub';
import {useHubCopy} from '@/components/reports/hub-copy';
import type {PipelineRow} from '@/lib/pipeline.functions';
import type {HubData} from '@/lib/reports-hub';

/** Reports waiting on this user: buyer = shared reports not opened yet; seller = buyer requests. */
function waiting(p:PipelineRow,seller:boolean,hub:HubData|undefined){
 if(!hub)return 0;
 return seller?hub.rows.filter(r=>r.audience.some(a=>a.state==='asked')).length:hub.rows.filter(r=>r.buyerState==='shared'&&!r.openedAt).length;
}

function DealSelector({deals,seller,reports,value,onPick}:{deals:PipelineRow[];seller:boolean;reports:Record<string,HubData>;value:string;onPick:(id:string)=>void}){
 const {t}=useTranslation();const {c}=useHubCopy();
 const [open,setOpen]=useState(false);const [active,setActive]=useState(0);
 const btn=useRef<HTMLButtonElement>(null);const box=useRef<HTMLDivElement>(null);
 const selIdx=Math.max(0,deals.findIndex(p=>p.id===value));const sel=deals[selIdx];
 useEffect(()=>{if(!open)return;setActive(selIdx);box.current?.focus();
  const onDown=(e:MouseEvent)=>{if(box.current?.contains(e.target as Node)||btn.current?.contains(e.target as Node))return;setOpen(false);};
  document.addEventListener('mousedown',onDown);return()=>document.removeEventListener('mousedown',onDown);},[open,selIdx]);
 const pick=(id:string)=>{setOpen(false);btn.current?.focus();if(id!==value)onPick(id);};
 const onKey=(e:React.KeyboardEvent)=>{
  if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(deals.length-1,a+1));}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1));}
  else if(e.key==='Home'){e.preventDefault();setActive(0);}
  else if(e.key==='End'){e.preventDefault();setActive(deals.length-1);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();const p=deals[active];if(p)pick(p.id);}
  else if(e.key==='Escape'){e.preventDefault();setOpen(false);btn.current?.focus();}
 };
 const pill=(p:PipelineRow)=>{const n=waiting(p,seller,reports[p.id]);if(!n)return null;
  return <span className="hub-deal-pill" data-kind={seller?'request':'new'}>{seller?c(n===1?'1 request':`${n} requests`,n===1?'คำขอ 1':`คำขอ ${n}`):c(`${n} new`,`ใหม่ ${n}`)}</span>;};
 const stepLine=(p:PipelineRow)=>`${t('Step')} ${pipelineStep(p)+1} · ${t(STEPS[pipelineStep(p)])}`;
 const label=seller?c('Buyer','ผู้ซื้อ'):c('Deal','ดีล');
 return <div className="hub-deal-selector">
  <span className="hub-deal-selector-label">{label}</span>
  <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} className="hub-deal-btn"
   onClick={()=>setOpen(o=>!o)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);}}}>
   <span className="hub-deal-btn-text"><b>{sel.counterparty.name}</b><small>{stepLine(sel)}</small></span>
   {pill(sel)}
   <ChevronDown size={16} aria-hidden className={open?'rotate-180':''}/>
  </button>
  {open&&<div ref={box} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`deal-opt-${deals[active]?.id}`} onKeyDown={onKey} className="hub-deal-list">
   {deals.map((p,i)=>{const chosen=p.id===value;return <div key={p.id} id={`deal-opt-${p.id}`} role="option" aria-selected={chosen} data-active={i===active||undefined}
    onClick={()=>pick(p.id)} onMouseEnter={()=>setActive(i)} className="hub-deal-opt">
    <span className="hub-deal-tile" aria-hidden>{p.counterparty.name.slice(0,2)}</span>
    <span className="hub-deal-btn-text"><b>{p.counterparty.name}</b><small>{stepLine(p)}</small></span>
    {pill(p)}
    <Check size={16} aria-hidden className={chosen?'':'invisible'}/>
   </div>;})}
  </div>}
 </div>;
}

/** Pipeline › Reports: one deal at a time, in the report layout of My reports. */
export function PipelineReports(){
 const w=usePipelineWorkspace();const {seller,approved,reports}=w;const {c}=useHubCopy();
 const deals=approved.slice().sort((a,b)=>pipelineStep(b)-pipelineStep(a)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
 const [picked,setPicked]=useState<string|null>(null);
 useEffect(()=>{if(!deals.length)return;if(picked&&deals.some(p=>p.id===picked))return;
  const first=deals.find(p=>waiting(p,seller,reports.data?.[p.id])>0)??deals[0];setPicked(first.id);},[deals,reports.data,picked,seller]);
 const deal=deals.find(p=>p.id===picked)??null;
 const pendingNda=(w.deals.data??[]).filter(p=>pipelineOpen(p)&&!p.ndaApprovedAt).length;
 const extra=pendingNda>0?seller?c(` A buyer shows here once you approve their NDA (${pendingNda} waiting).`,` ผู้ซื้อจะแสดงที่นี่เมื่อท่านอนุมัติ NDA ของเขา (รออยู่ ${pendingNda} รายการ)`):c(` A deal shows here once the seller approves your NDA (${pendingNda} waiting).`,` ดีลจะแสดงที่นี่เมื่อผู้ขายอนุมัติ NDA ของท่าน (รออยู่ ${pendingNda} รายการ)`):undefined;
 if(!deals.length)return <>
  <div className="pipeline-empty"><b>{c('No deals here yet','ยังไม่มีดีลที่นี่')}</b></div>
  <p className="hub-footer">{seller?c("Sharing is free for the buyer and doesn't use their plan. You can stop sharing at any time; reports the buyer bought stay theirs.",'การแชร์ไม่มีค่าใช้จ่ายสำหรับผู้ซื้อ และไม่ใช้สิทธิ์ในแพ็กเกจ ท่านหยุดแชร์ได้ทุกเมื่อ รายงานที่ผู้ซื้อซื้อเองยังเป็นของผู้ซื้อ'):c("The seller sees which reports you open. Reports are prepared by PitchSnack analysts from public company filings; the seller's own documents stay in the data room.",'ผู้ขายเห็นว่าท่านเปิดรายงานใด รายงานจัดทำโดยนักวิเคราะห์ PitchSnack จากข้อมูลที่บริษัทยื่นต่อหน่วยงานรัฐ เอกสารของผู้ขายเองยังอยู่ในห้องข้อมูล')}{extra}</p>
 </>;
 return <>
  <DealSelector deals={deals} seller={seller} reports={reports.data??{}} value={deal?.id??''} onPick={setPicked}/>
  {deal&&<div className="hub-page hub-embed"><ReportsHub key={deal.id} mode={seller?'seller':'buyer'} pipelineId={deal.id} pipelinePage footerExtra={extra}/></div>}
 </>;
}
