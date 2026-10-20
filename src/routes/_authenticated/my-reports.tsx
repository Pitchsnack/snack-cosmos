import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
import {SellerReportsPage} from '@/components/reports/reports-hub';
import {REPORT_KEYS} from '@/lib/reports-hub';
export const Route=createFileRoute('/_authenticated/my-reports')({
 head:()=>({meta:[{title:'My reports — PitchSnack'},{name:'description',content:'Manage company reports and share ready reports with NDA-approved buyers.'},{property:'og:title',content:'My reports — PitchSnack'},{property:'og:description',content:'Seven company reports: verification, shareholders, financial statements, valuation, P&L, company risk and credit risk.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 validateSearch:z.object({company:z.string().uuid().optional(),report:z.enum(REPORT_KEYS).optional()}),component:Page,
});
function Page(){const s=Route.useSearch();return <SellerReportsPage companyId={s.company} initialReport={s.report}/>;}