import { useState } from 'react';
import type { StartupFinancials } from '@/lib/financials.functions';
import { CASH_FLOW_SECTIONS, INCOME_ROWS, POSITION_ROWS } from '@/lib/financials';
import { financialPdfSections } from '@/lib/financial-report-view';
import { useTranslation } from '@/i18n/language';
import { Button } from '@/components/ui/button';
import { MainTabBar, SubTabRow } from './fin-tabs';
import { StatementTable } from './statement-table';
import { RatiosTable } from './ratios-table';
import { FinancialsOverview } from './financials-overview';
import { CompanyProfileCard } from './company-profile-card';
import { ReportScroll } from '@/components/reports/report-scroll';

/** Same filed data and views in every report host; print includes every section, not just the open tab. */
export function FinancialReportView({ data, report, year, tab: external, onTab }: {
  data: StartupFinancials; report: 'statements' | 'pnl'; year?: number; tab?: string; onTab?: (tab: string) => void;
}) {
  const { language } = useTranslation();
  const c = (en: string, th: string) => language === 'th' ? th : en;
  const [own, setOwn] = useState(report === 'pnl' ? 'overview' : 'income');
  const raw = external ?? own;
  const tab = report === 'pnl' ? raw === 'ratios' ? 'ratios' : 'overview' : ['income', 'position', 'cash-flow'].includes(raw) ? raw : 'income';
  const setTab = (value: string) => { setOwn(value); onTab?.(value); };
  const labels = { income: c('Income Statement', 'งบกำไรขาดทุน'), position: c('Financial Position', 'งบแสดงฐานะการเงิน'), 'cash-flow': c('Cash Flow', 'งบกระแสเงินสด'), overview: c('Overview', 'ภาพรวม'), ratios: c('Financial Ratios', 'อัตราส่วนทางการเงิน') };
  return <div className="financial-report-views rounded-lg border border-border bg-card py-3">
    <div className="financial-screen-controls">
      {report === 'pnl' ? <MainTabBar value={tab} onChange={setTab} tabs={[
        { value: 'overview', label: labels.overview, icon: 'grid' },
        { value: 'ratios', label: labels.ratios, icon: 'percent' },
      ]}/> : <SubTabRow value={tab} onChange={setTab} tabs={[
        { value: 'income', label: labels.income, icon: 'trend' },
        { value: 'position', label: labels.position, icon: 'scales' },
        { value: 'cash-flow', label: labels['cash-flow'], icon: 'flow', ...(data.cashFlow.some(r => r.amount != null) ? {} : { dot: 'grey' as const, dotTitle: c('No data in the filing', 'ไม่มีข้อมูลในงบที่ยื่น') }) },
      ]}/>}
    </div>
    {financialPdfSections(report).map(section => <section key={section} className="financial-report-section space-y-3 px-[18px] pb-[18px] pt-4" data-active={tab === section}>
      {section !== 'overview' && <h3 className="text-base font-semibold text-foreground">{labels[section]}</h3>}
      {section === 'overview' && <FinancialsOverview year={year} years={data.years} currency={data.currency} income={data.income} position={data.position} ratios={data.ratios}/>}
      {section === 'ratios' && <RatiosTable years={data.years} ratios={data.ratios}/>}
      {section === 'income' && <StatementTable years={data.years} rows={INCOME_ROWS} items={data.income}/>}
      {section === 'position' && <StatementTable years={data.years} rows={POSITION_ROWS} items={data.position}/>}
      {section === 'cash-flow' && <StatementTable years={data.years} items={data.cashFlow} sections={CASH_FLOW_SECTIONS.map(s => ({ title: s.title, rows: s.rows }))}/>}
      {report === 'statements' && <div className="flex gap-3 text-xs text-muted-foreground"><span>{c('Remark(s) :', 'หมายเหตุ :')}</span><ol className="list-decimal space-y-1 pl-4">{[
        c('This statement includes only important accounts.', 'งบนี้แสดงเฉพาะรายการบัญชีที่สำคัญ'),
        c('% Change is a year-over-year change of the current fiscal year and the previous fiscal year amount.', '% การเปลี่ยนแปลงเปรียบเทียบยอดปีบัญชีปัจจุบันกับปีบัญชีก่อนหน้า'),
        c('The accounts showing in the statement depend on the accounting format submitted.', 'รายการบัญชีที่แสดงขึ้นอยู่กับรูปแบบบัญชีที่ยื่น'),
      ].map(text => <li key={text}>{text}</li>)}</ol></div>}
    </section>)}
  </div>;
}

export function FinancialReportHeader({ data, report, children, tab, onTab }: { data: StartupFinancials; report: 'statements' | 'pnl'; children?: React.ReactNode; tab?: string; onTab?: (tab: string) => void }) {
  const { language } = useTranslation();
  const th = language === 'th';
  const [year, setYear] = useState<number | undefined>();
  const years = [...data.years].sort((a,b) => a-b);
  const activeYear = year ?? years.at(-1);
  return <article className="space-y-4">
    <header className="flex flex-wrap items-center gap-3 pr-28">
      <div className="min-w-0 flex-1"><h2>{report === 'statements' ? th ? 'งบการเงิน' : 'Financial Statements' : th ? 'การวิเคราะห์กำไรขาดทุน' : 'P&L Analysis'}</h2>
        <p className="text-sm text-muted-foreground">{th ? 'ชื่อนิติบุคคล' : 'Juristic Name'} : {data.legalNameEn || data.legalNameTh || data.registeredName || data.startupName}{years.length ? ` · ${th ? 'สรุปปี' : 'Summary for'} ${years[0]}–${years.at(-1)}` : ''}</p></div>
      <span className="text-sm text-muted-foreground">{th ? 'หน่วย : บาท' : 'Unit : Baht'} ({data.currency})</span>
      <select aria-label={th ? 'ปีบัญชี' : 'Fiscal year'} className="financial-screen-controls rounded-md border border-border bg-card p-2 text-sm" value={activeYear ?? ''} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{th ? y + 543 : y}</option>)}</select>
      <Button className="financial-screen-controls" variant="outline" onClick={() => window.print()}>{th ? 'ส่งออก PDF' : 'Export PDF'}</Button>
    </header>
    <ReportScroll expandHint>
    <CompanyProfileCard data={data} years={years} activeYear={activeYear} onSelectYear={setYear}/>
    <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{th ? 'ข้อมูลการจดทะเบียนและกรรมการอยู่ในรายงานการตรวจสอบบริษัท' : 'Registration and directors are in the Company verification report.'}</p>
    {children}
    <FinancialReportView data={data} report={report} year={activeYear} tab={tab} onTab={onTab}/>
    </ReportScroll>
  </article>;
}