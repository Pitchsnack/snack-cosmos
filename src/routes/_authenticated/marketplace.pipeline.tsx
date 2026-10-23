import {createFileRoute,Outlet} from '@tanstack/react-router';
import {AgreementStateProvider} from '@/components/pipeline/agreement-state';
export const Route=createFileRoute('/_authenticated/marketplace/pipeline')({component:()=> <AgreementStateProvider><Outlet/></AgreementStateProvider>});
