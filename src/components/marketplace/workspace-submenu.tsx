import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { RailTip } from '@/components/marketplace/rail-tip';
import { usePersona } from '@/hooks/use-marketplace';

type SubmenuItem = { to: string; label: string; current: boolean; suffix?: ReactNode };
type Props = {
  id: string; label: string; heading: string; groupLabel: string; icon: LucideIcon;
  destination: string; active: boolean; items: SubmenuItem[]; collapsed?: boolean;
  tooltip?: string; badge?: ReactNode; railBadge?: ReactNode; company?: boolean;
  focusSelector?: string;
};

/** Shared Pipeline/My Company navigation, including inline, drawer and rail states. */
export function WorkspaceSubmenu({ id, label, heading, groupLabel, icon: Icon, destination, active,
  items, collapsed = false, tooltip = label, badge, railBadge, company = false,
  focusSelector = '[data-pipeline-title]',
}: Props) {
  const path = useRouterState({ select: s => s.location.pathname });
  const { persona } = usePersona();
  const [open, setOpen] = useState(active);
  const [fly, setFly] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const groupId = `${id}-pages`;
  const flyId = `${id}-flyout`;

  useEffect(() => { setOpen(active); setFly(false); }, [path, active, destination]);
  useEffect(() => { if (open) root.current?.scrollIntoView({ block: 'nearest' }); }, [open]);
  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setFly(false);
    };
    window.addEventListener('ps-workspace-flyout', closeOther);
    return () => window.removeEventListener('ps-workspace-flyout', closeOther);
  }, [id]);
  const quietFly = useRef(false);
  const flightClosePending = useRef(false);
  const flyEl = useRef<HTMLDivElement>(null);
  // NDA request flight (Pipeline only): open the sub-menu or flyout so NDA Invitations is showing.
  useEffect(() => {
    if (id !== 'pipeline') return;
    const onFlight = (event: Event) => {
      const what = (event as CustomEvent<string>).detail;
      if (what === 'open') {
        flightClosePending.current = false;
        if (collapsed) { quietFly.current = true; window.dispatchEvent(new CustomEvent('ps-workspace-flyout', { detail: id })); setFly(true); }
        else setOpen(true);
      } else if (what === 'close' && collapsed) {
        flightClosePending.current = true;
        const el = flyEl.current;
        if (el && (el.matches(':hover') || el.contains(document.activeElement))) return;
        setFly(false);
      }
    };
    window.addEventListener('ps-flight-pipeline', onFlight);
    return () => window.removeEventListener('ps-flight-pipeline', onFlight);
  }, [id, collapsed]);
  const changeFly = (next: boolean) => {
    if (next) window.dispatchEvent(new CustomEvent('ps-workspace-flyout', { detail: id }));
    setFly(next);
  };
  const focusPage = (to: string) => {
    // Existing Pipeline navigation signal also closes the Marketplace drawer.
    window.dispatchEvent(new Event('ps-pipeline-navigate'));
    const focus = () => {
      const title = document.querySelector<HTMLElement>(focusSelector);
      if (!title) return false;
      if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
      return true;
    };
    if (path.replace(/\/$/, '') === to.replace(/\/$/, '')) {
      window.setTimeout(focus, 150);
      return;
    }
    const unsubscribe = router.subscribe('onResolved', () => {
      unsubscribe();
      window.setTimeout(focus, 150);
    });
    window.setTimeout(unsubscribe, 10000);
  };
  const links = (flyout = false) => <div id={flyout ? flyId : groupId} role="group" aria-label={groupLabel}
    className={flyout ? 'pipeline-fly-links' : 'pipeline-sub-links'}
    onKeyDown={event => {
      if (!flyout) return;
      const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
      }
      if (event.key === 'Tab' || event.key === 'Escape') {
        event.preventDefault(); setFly(false); trigger.current?.focus();
      }
    }}>
    {items.map(item => <Link key={item.to} to={item.to} className="pipeline-sub-link"
      data-flight-target={id === 'pipeline' && item.to.endsWith('/invitations') ? 'invitations' : undefined}
      aria-current={item.current ? 'page' : undefined}
      onClick={() => { setFly(false); focusPage(item.to); }}><span>{item.label}</span>{item.suffix}</Link>)}
  </div>;
  const content = <><Icon className="h-4 w-4 shrink-0" />{collapsed ? railBadge : <>
    <span className="flex-1 text-left">{label}</span>{!open && badge}
    <ChevronDown size={16} className={open ? 'pipeline-chevron is-open' : 'pipeline-chevron'} />
  </>}</>;
  if (collapsed) return <Popover open={fly} onOpenChange={changeFly}>
    <RailTip label={tooltip} disabled={fly}><PopoverTrigger asChild>
      <Button ref={trigger} variant="ghost" className={`pipeline-parent is-rail${company ? ' company-parent' : ''}`}
        data-active={company && active || undefined} aria-label={tooltip} aria-expanded={fly}
        aria-controls={flyId} data-keep-sidebar>{content}</Button>
    </PopoverTrigger></RailTip>
    <PopoverContent side="right" align="start" sideOffset={12} collisionPadding={8}
      className={`pipeline-flyout${company ? ' company-flyout' : ''}`} data-mkt-view={persona}
      ref={flyEl}
      onPointerLeave={() => { if (flightClosePending.current && !flyEl.current?.contains(document.activeElement)) setFly(false); }}
      onBlurCapture={event => { if (flightClosePending.current && !event.currentTarget.contains(event.relatedTarget as Node | null) && !event.currentTarget.matches(':hover')) setFly(false); }}
      onOpenAutoFocus={event => {
        event.preventDefault();
        if (quietFly.current) { quietFly.current = false; return; }
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${flyId} [aria-current="page"], #${flyId} a`)?.focus());
      }}>
      <div className="pipeline-fly-heading"><Icon size={15} />{heading}</div>{links(true)}
    </PopoverContent>
  </Popover>;
  return <div ref={root} className={company ? 'company-submenu' : undefined}>
    <Button variant="ghost" className={`pipeline-parent${company ? ' company-parent' : ''}`}
      data-active={active && !open || undefined} data-current={company && active && open || undefined}
      aria-expanded={open} aria-controls={groupId}
      onClick={() => {
        if (active) setOpen(!open);
        else { setOpen(true); void navigate({ to: destination }); }
      }}>{content}</Button>{open && links()}
  </div>;
}