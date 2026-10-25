import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, CircleCheck, Clock, EyeOff, FileText, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManagedBadge, useCoverFit } from '@/components/common/managed-badge';
import { useTranslation } from '@/i18n/language';
import { cn } from '@/lib/utils';
import type { CardNdaStatus } from '@/lib/standard-card';

export type StandardFigure = { label: string; value?: string | null; second?: string | null };
export function StandardBrowseCard({ title, subtitle, refNo, place, description, cover, status = 'hidden', newDays, managed, topRight, badges, figures, fit, textRow, more, selected, onOpen, className, sourceType, tag }: {
  title: string; subtitle?: string; refNo: string; place?: string | null; description?: string | null;
  cover: (children: ReactNode) => ReactNode; status?: CardNdaStatus; newDays?: number | null; managed?: boolean;
  topRight?: ReactNode; badges?: { label: string; financial?: boolean }[]; figures: StandardFigure[];
  fit: StandardFigure; textRow: StandardFigure; more?: ReactNode; selected?: boolean; onOpen?: () => void;
  className?: string; sourceType?: string; tag?: ReactNode;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState(false);
  const id = useId();
  const nameRow = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const coverFit = useCoverFit(!!managed, 1);
  useEffect(() => {
    const row = nameRow.current;
    const heading = titleRef.current;
    if (!row || !heading) return;
    const check = () => setCut(!subtitle && !expanded && heading.getBoundingClientRect().bottom - row.getBoundingClientRect().top > 43.3);
    const observer = new ResizeObserver(check);
    observer.observe(row); observer.observe(heading); check();
    return () => observer.disconnect();
  }, [title, subtitle, expanded]);
  const statusLabel = status === 'approved' ? 'NDA approved' : status === 'requested' ? 'NDA requested' : 'Name hidden';
  const StatusIcon = status === 'approved' ? LockOpen : status === 'requested' ? Clock : EyeOff;
  const statusTip = newDays != null ? `${t(statusLabel)} · ${t('New, listed')} ${newDays} ${t(newDays === 1 ? 'day ago' : 'days ago')}` : t(statusLabel);
  const figure = (f: StandardFigure, highlight = false) => <dl className={cn('standard-card-cell', highlight && !!f.value && 'standard-card-fit')}>
    <dt title={t(f.label)}>{t(f.label)}</dt><dd><span className={cn('standard-card-value', !f.value && 'standard-card-empty')} title={f.value ?? undefined}>{f.value || t('Not stated')}</span><span className="standard-card-second" title={f.second ?? undefined}>{f.second || '\u00a0'}</span></dd>
  </dl>;
  return <article data-standard-card data-expanded={expanded} data-connect-source={refNo} data-connect-type={sourceType}
    className={cn('standard-card', expanded && 'standard-card-open', selected && 'standard-card-selected', className)}>
    <div className="standard-card-cover" data-connect-cover={refNo} data-connect-type={sourceType}>
      {cover(<>
        <div ref={coverFit.box} className="pointer-events-none absolute inset-x-0 top-0 h-0" />
        <span ref={coverFit.left as React.RefObject<HTMLSpanElement>} className={cn('standard-card-status', `standard-card-status-${status}`)} title={statusTip}>
          <StatusIcon aria-hidden /><span>{t(statusLabel)}</span>{newDays != null && <span className="standard-card-new">{t('NEW')}</span>}
        </span>
        <div ref={coverFit.right} className="standard-card-tools">{managed && <ManagedBadge size="sm" hatOnly={coverFit.level >= 1} />}{topRight}</div>
        {!!badges?.length && <div className="standard-card-badges">{badges.map((b) => <span key={b.label} className="standard-card-badge">{b.financial ? <FileText aria-hidden /> : <CircleCheck aria-hidden />}{t(b.label)}</span>)}</div>}
      </>)}
    </div>
    <div className="standard-card-body" id={id}>
      <div ref={nameRow} className={cn('standard-card-name', cut && 'standard-card-title-cut', subtitle && 'standard-card-private-name')}>
        <span className="standard-card-ref">{refNo}{place && <> · <b>{place}</b></>}</span>
        <h3 ref={titleRef} title={title} data-card-title>{title}</h3>
        {onOpen && <Button variant="unstyled" size="unstyled" onClick={onOpen} aria-label={title} className="standard-card-title-link" />}
        {subtitle && <p className="standard-card-subtitle" title={subtitle}>{subtitle}</p>}
      </div>
      <p className="standard-card-description" title={description ?? undefined}>{description}</p>
      <div className="standard-card-figures">
        <div className={cn('standard-card-figure-row', figures.length === 1 && 'standard-card-one')}>{figures.map((f) => <div key={f.label}>{figure(f)}</div>)}</div>
        <div className="standard-card-fit-row">{figure(fit, true)}</div>
        <dl className="standard-card-text-row"><dt>{t(textRow.label)}</dt><dd title={textRow.value ?? undefined}>{textRow.value || t('Not stated')}</dd></dl>
      </div>
      {expanded && <div className="standard-card-more">{tag}{more}</div>}
    </div>
    <Button variant="unstyled" size="unstyled" className="standard-card-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((v) => !v)}>{t(expanded ? 'Show less' : 'Show more')}<ChevronDown aria-hidden /></Button>
  </article>;
}

export function StandardCardSection({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  return <section><h4 className="standard-card-caption">{t(label)}</h4>{children}</section>;
}
export function StandardCardChips({ values, market }: { values: string[]; market?: boolean }) {
  return <div className="standard-card-chips">{values.filter(Boolean).map((v, index) => <span key={`${v}-${index}`} className={cn('standard-card-chip', market && 'standard-card-market')}>{v}</span>)}</div>;
}