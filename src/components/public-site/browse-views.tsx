import { forwardRef, type ReactNode } from 'react';
import { Columns3, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type BrowseLayout = 'grid' | 'split' | 'list';

/** Presentation only: callers retain their own filters, access and actions. */
export function BrowseFilters({ search, children }: { search: ReactNode; children: ReactNode }) {
  return <div className="bw-filters">{search}<div className="bw-filter-lists">{children}</div></div>;
}

export function BrowseLayoutSwitch({ layout, onChange, label, names }: { layout: BrowseLayout; onChange: (layout: BrowseLayout) => void; label: string; names: Record<BrowseLayout, string> }) {
  return <div className="discovery-layout" role="group" aria-label={label}>{([{ key: 'grid', Icon: LayoutGrid }, { key: 'split', Icon: Columns3 }, { key: 'list', Icon: List }] as const).map(({ key, Icon }) => <Button key={key} variant="unstyled" aria-pressed={layout === key} aria-label={names[key]} title={names[key]} onClick={() => onChange(key)}><Icon size={14}/><span>{names[key]}</span></Button>)}</div>;
}

export const BrowseSplit = forwardRef<HTMLDivElement, { cards: ReactNode; children: ReactNode; label: string }>(function BrowseSplit({ cards, children, label }, ref) {
  return <div className="discovery-split"><div className="discovery-split-cards">{cards}</div><div ref={ref} className="discovery-panel" aria-label={label}>{children}</div></div>;
});

export function BrowseSelectable({ id, selected, onSelect, children }: { id: string; selected: boolean; onSelect: () => void; children: ReactNode }) {
  return <div id={id} tabIndex={0} aria-current={selected} className="discovery-selectable" onClick={e => { if (!(e.target as HTMLElement).closest('button,a,input,select')) onSelect(); }} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); onSelect(); } }}>{children}</div>;
}

export function BrowseListHeader({ headings }: { headings: string[] }) {
  return <div className="discovery-list-header">{headings.map((heading, i) => <span key={i}>{heading}</span>)}<span/></div>;
}

export function BrowseListRow({ id, children, grey = false }: { id: string; children: ReactNode; grey?: boolean }) {
  return <div id={id} className={`discovery-list-row${grey ? ' bw-list-grey' : ''}`}>{children}</div>;
}