import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, CircleCheck, Clock, EyeOff, FileText, LockOpen, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManagedBadge, useCoverFit } from '@/components/common/managed-badge';
import { useTranslation } from '@/i18n/language';
import { cn } from '@/lib/utils';
import type { CardNdaStatus } from '@/lib/standard-card';
import { LAST_LOGIN_LABEL, type LastLoginStep } from '@/lib/last-login';
import { cardValue } from '@/lib/marketplace-contacts';

export type StandardFigure = { label: string; value?: string | null; second?: string | null; /** Replaces the value text (e.g. a value with a "+n" badge). */ node?: ReactNode };
export function StandardBrowseCard({ title, subtitle, refNo, place, description, cover, status = 'hidden', hideStatus, newDays, managed, topRight, badges, figures, fit, focusRow, descriptionContent, afterName, beforeName, figureLabel, footerDate, textRow, more, selected, onOpen, className, sourceType, tag, lastLogin, lastLoginTooltip, hideRef, subtitleContent, titleContent, defaultExpanded, style }: {
  title: string; subtitle?: string; refNo: string; place?: string | null; description?: string | null;
  cover: (children: ReactNode) => ReactNode; status?: CardNdaStatus; newDays?: number | null; managed?: boolean;
  topRight?: ReactNode; badges?: { label: string; financial?: boolean }[]; figures: StandardFigure[];
  fit: StandardFigure; textRow: StandardFigure; more?: ReactNode; selected?: boolean; onOpen?: () => void;
  focusRow?: StandardFigure; descriptionContent?: ReactNode;
  /** Optional line between the name row and the description (the buyer editor's "Wants to buy" preview). */
  afterName?: ReactNode;
  beforeName?: ReactNode; figureLabel?: string; footerDate?: string;
  className?: string; sourceType?: string; tag?: ReactNode; hideStatus?: boolean;
  /** Owner's last-login bucket on the left of Show more (browse/watchlist only; previews omit it). */
  lastLogin?: LastLoginStep | null; lastLoginTooltip?: string;
  /** Leave "{ref} · {place}" off the cover (the advisor cover draws its own). */
  hideRef?: boolean; subtitleContent?: ReactNode; titleContent?: ReactNode; defaultExpanded?: boolean; style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [cut, setCut] = useState(false);
  const [twoLines, setTwoLines] = useState(!!subtitle);
  const article = useRef<HTMLElement>(null);
  const id = useId();
  const nameRow = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const coverFit = useCoverFit(!!managed, 1);
  useEffect(() => {
    const row = nameRow.current;
    const heading = titleRef.current;
    if (!row || !heading) return;
    const check = () => { setTwoLines(!!subtitle || heading.getBoundingClientRect().height > 30); setCut(!subtitle && !expanded && heading.getBoundingClientRect().bottom - row.getBoundingClientRect().top > 43.3); };
    const observer = new ResizeObserver(check);
    observer.observe(row); observer.observe(heading); check();
    return () => observer.disconnect();
  }, [title, subtitle, expanded]);
  const textBox = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [lines, setLines] = useState<number | null>(null);
  // The closed text block has a fixed height; the description shows the whole lines left under the name.
  useEffect(() => {
    const box = textBox.current, d = descRef.current;
    if (!box || !d || expanded) { setLines(null); return; }
    const fit = () => setLines(Math.max(0, Math.floor((box.getBoundingClientRect().bottom - d.getBoundingClientRect().top + 0.5) / 21)));
    const observer = new ResizeObserver(fit);
    observer.observe(box); if (nameRow.current) observer.observe(nameRow.current); fit();
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [expanded, title, subtitle, description]);
  const statusLabel = status === 'approved' ? 'NDA approved' : status === 'requested' ? 'NDA requested' : 'Name hidden';
  const StatusIcon = status === 'approved' ? LockOpen : status === 'requested' ? Clock : EyeOff;
  const statusTip = newDays != null ? `${t(statusLabel)} · ${t('New, listed')} ${newDays} ${t(newDays === 1 ? 'day ago' : 'days ago')}` : t(statusLabel);
  const figure = (f: StandardFigure, highlight = false) => <dl className={cn('standard-card-cell', highlight && !!f.value && 'standard-card-fit')}>
    <dt title={t(f.label)}>{t(f.label)}</dt><dd>{f.node ?? <span className={cn('standard-card-value', !f.value && 'standard-card-empty')} title={f.value ?? undefined}>{f.value || t('Not stated')}</span>}{f.second && <span className="standard-card-second" title={f.second}>{f.second}</span>}</dd>
  </dl>;
  const openFromCard = (e: React.MouseEvent<HTMLElement>) => {
    if (!onOpen) return;
    const target = e.target as HTMLElement;
    if (target.closest('.standard-card-title-link')) return;
    if (target.closest('button, a, input, select, textarea, [role="tab"], [role="button"], .standard-card-tools, .standard-card-badges, .standard-card-toggle')) return;
    if (window.getSelection()?.toString()) return;
    e.currentTarget.querySelector<HTMLElement>('.standard-card-title-link')?.focus({ preventScroll: true });
    onOpen();
  };
  return <article ref={article} data-standard-card data-expanded={expanded} data-connect-source={refNo} data-connect-type={sourceType}
    onClick={openFromCard}
    style={style}
    className={cn('standard-card', onOpen && 'standard-card-clickable', expanded && 'standard-card-open', selected && 'standard-card-selected', className)}>
    <div className="standard-card-cover" data-connect-cover={refNo} data-connect-type={sourceType}>
      {cover(<>
        <div ref={coverFit.box} className="pointer-events-none absolute inset-x-0 top-0 h-0" />
        <div className="standard-card-top">
          {!hideStatus && <span ref={coverFit.left as React.RefObject<HTMLSpanElement>} className={cn('standard-card-status', `standard-card-status-${status}`)} title={statusTip}>
            <StatusIcon aria-hidden /><span>{t(statusLabel)}</span>{newDays != null && <span className="standard-card-new">{t('NEW')}</span>}
          </span>}
          {!hideRef && <span className="standard-card-ref" title={[refNo, place].filter(Boolean).join(' · ')}><span className="standard-card-ref-no">{refNo}</span>{place && <><span className="standard-card-ref-no">&nbsp;·&nbsp;</span><span className="standard-card-ref-place">{place}</span></>}</span>}
          <div ref={coverFit.right} className="standard-card-tools">{managed && <ManagedBadge size="sm" hatOnly={coverFit.level >= 1} />}{topRight}</div>
        </div>
        {!!badges?.length && <div className="standard-card-badges">{badges.map((b) => <span key={b.label} className="standard-card-badge">{b.financial ? <FileText aria-hidden /> : <CircleCheck aria-hidden />}{t(b.label)}</span>)}</div>}
      </>)}
    </div>
    <div className="standard-card-body" id={id}>
      <div ref={textBox} className="standard-card-text" data-card-text>
      {beforeName}
      <div ref={nameRow} className={cn('standard-card-name', cut && 'standard-card-title-cut', subtitle && 'standard-card-private-name')}>
        <h3 ref={titleRef} title={title} data-card-title>{titleContent ?? title}</h3>
        {onOpen && <Button variant="unstyled" size="unstyled" onClick={onOpen} aria-label={title} className="standard-card-title-link" />}
        {subtitle && <p className="standard-card-subtitle" title={subtitle}>{subtitleContent ?? subtitle}</p>}
      </div>
      {afterName}
      <p ref={descRef} className={cn('standard-card-description', lines == null && (twoLines ? 'standard-card-desc-3' : 'standard-card-desc-4'))} style={lines != null && !expanded ? (lines ? { WebkitLineClamp: lines } : { display: 'none' }) : undefined} title={description ?? undefined}>{descriptionContent ?? description}</p>
      </div>
      {figureLabel && <div className="standard-card-caption">{figureLabel}</div>}
      <div className="standard-card-figures">
        <div className={cn('standard-card-figure-row', figures.length === 1 && 'standard-card-one')}>{figures.map((f) => <div key={f.label}>{figure(f)}</div>)}</div>
        <div className="standard-card-fit-row">{figure(fit, true)}</div>
        {focusRow && <dl className="standard-card-focus-row"><dt>{t(focusRow.label)}</dt><dd>{focusRow.value || t('Not stated')}</dd></dl>}
        <dl className="standard-card-text-row"><dt>{t(textRow.label)}</dt><dd title={textRow.value ?? undefined}>{textRow.node ?? (textRow.value || t('Not stated'))}</dd></dl>
      </div>
      {expanded && <div className="standard-card-more">{tag}{more}</div>}
      {lastLogin || footerDate ? (
        <div className="standard-card-foot">
          <span className="standard-card-last-login" title={lastLoginTooltip}>{lastLogin ? <><LogIn aria-hidden />{t(LAST_LOGIN_LABEL[lastLogin])}</> : footerDate}</span>
          <Button variant="unstyled" size="unstyled" className="standard-card-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((v) => !v)}>{t(expanded ? 'Show less' : 'Show more')}<ChevronDown aria-hidden /></Button>
        </div>
      ) : (
        <Button variant="unstyled" size="unstyled" className="standard-card-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((v) => !v)}>{t(expanded ? 'Show less' : 'Show more')}<ChevronDown aria-hidden /></Button>
      )}
    </div>
  </article>;
}

export function StandardCardSection({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  return <section><h4 className="standard-card-caption">{t(label)}</h4>{children}</section>;
}
export function StandardCardChips({ values, market }: { values: string[]; market?: boolean }) {
  const {language}=useTranslation();
  return <div className="standard-card-chips">{values.filter(Boolean).map((v, index) => <span key={`${v}-${index}`} className={cn('standard-card-chip', market && 'standard-card-market')}>{cardValue(v,language)}</span>)}</div>;
}