import {createFileRoute,Outlet} from '@tanstack/react-router';
import {AgreementStateProvider} from '@/components/pipeline/agreement-state';
import {PipelineChatDrafts} from '@/components/messages/chat-drafts';
export const Route=createFileRoute('/_authenticated/marketplace/pipeline')({component:()=> <PipelineChatDrafts><AgreementStateProvider><Outlet/></AgreementStateProvider></PipelineChatDrafts>});
