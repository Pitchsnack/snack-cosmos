import {useRouterState} from '@tanstack/react-router';
import {GitBranch} from 'lucide-react';
import {WorkspaceSubmenu} from '@/components/marketplace/workspace-submenu';
import {usePipelineWorkspace} from '@/hooks/use-pipeline-workspace';
import {PIPELINE_PAGES} from '@/lib/pipeline-pages';
import {useTranslation} from '@/i18n/language';
export function PipelineSubmenu({collapsed=false}:{collapsed?:boolean}){
 const {seller,counts,newInv,fresh}=usePipelineWorkspace();const {language,t}=useTranslation();const th=language==='th';const path=useRouterState({select:s=>s.location.pathname});const source=useRouterState({select:s=>(s.location.search as {from?:string}).from});const active=path.startsWith('/marketplace/pipeline')||path.startsWith('/my-reports/buyer/');const badge=counts.you+(seller?0:newInv);
 const label=[t('Pipeline'),counts.you?(th?`รอท่านดำเนินการ ${counts.you}`:`${counts.you} waiting on you`):'',!seller&&newInv?(th?`คำเชิญ NDA ใหม่ ${newInv}`:`${newInv} new NDA invitation${newInv===1?'':'s'}`):''].filter(Boolean).join(' · ');
 const values=[newInv,counts.all,counts.watch,counts.you,counts.history,fresh];
 return <WorkspaceSubmenu id="pipeline" label={t('Pipeline')} tooltip={label} heading={th?'ไปป์ไลน์':'PIPELINE'} groupLabel={th?'หน้าไปป์ไลน์':'Pipeline pages'} icon={GitBranch} destination="/marketplace/pipeline/all-deals" active={active} collapsed={collapsed}
   badge={badge>0?<span className="pipeline-count-pill">{badge}</span>:undefined}
   railBadge={badge>0?<span data-mkt-badge data-rail className="pipeline-parent-count">{badge}</span>:undefined}
   items={PIPELINE_PAGES.map(([key,en,thai],i)=>({to:`/marketplace/pipeline/${key}`,label:th?thai:en,current:path.endsWith('/'+key)||path.startsWith('/my-reports/buyer/')&&key===(source??'all-deals'),suffix:(values[i]>0||i===1)?<span className={i===0||i===3||i===5?'pipeline-count-pill':'pipeline-count-number'} data-danger={i===3||undefined}>{values[i]}</span>:undefined}))}/>;
}
