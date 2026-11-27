import {createFileRoute,Outlet,useRouterState} from '@tanstack/react-router';
import {AgreementStateProvider} from '@/components/pipeline/agreement-state';
import {PipelineChatDrafts} from '@/components/messages/chat-drafts';
import {PipelinePageLinks} from '@/components/pipeline/page-links';
import {PIPELINE_PAGES} from '@/lib/pipeline-pages';
import {usePersona} from '@/hooks/use-marketplace';
export const Route=createFileRoute('/_authenticated/marketplace/pipeline')({component:PipelineLayout});
export function PipelineLayout(){
 const path=useRouterState({select:s=>s.location.pathname});const {persona}=usePersona();
 const page=PIPELINE_PAGES.find(([key])=>path.endsWith(`/${key}`))?.[0]??'invitations';
 return <PipelineChatDrafts><AgreementStateProvider><div className="pipeline-workspace" data-mkt-view={persona}>{persona!=='advisor'&&<PipelinePageLinks page={page}/>}<Outlet/></div></AgreementStateProvider></PipelineChatDrafts>;
}
