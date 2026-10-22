import type { PipelineRow } from './pipeline.functions';
import {currentStep,stepDates,waitState} from './pipeline-state';
export const PIPELINE_PAGES=[['invitations','NDA Invitations','คำเชิญ NDA'],['all-deals','All deals','ดีลทั้งหมด'],['watchlist','Deal watchlist','ดีลที่ติดตาม'],['status','Deal status','สถานะดีล'],['history','History','ประวัติ'],['reports','Reports','รายงาน']] as const;
export type PipelinePageKey=typeof PIPELINE_PAGES[number][0];
export const pipelineOpen=(p:PipelineRow)=>!['ended','declined','withdrawn','revoked'].includes(p.status);
export const pipelineStep=(p:PipelineRow)=>Math.min(6,currentStep(p));
export function waitingSince(p:PipelineRow){return [p.updatedAt,...stepDates(p),p.ndaRequestedAt].filter((x):x is string=>!!x).sort().at(-1)??p.ndaRequestedAt;}
export function waitingDays(p:PipelineRow,now=Date.now()){return Math.max(0,Math.floor((now-Date.parse(waitingSince(p)))/86400000));}
export function pipelineCounts(rows:PipelineRow[],stars:string[],seller:boolean){const open=rows.filter(pipelineOpen);return {all:open.length,watch:open.filter(p=>stars.includes(p.id)).length,you:open.filter(p=>waitState(p,seller).onYou).length,history:rows.filter(p=>p.status==='ended').length};}
