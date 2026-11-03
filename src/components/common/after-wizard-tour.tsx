import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTr } from './edit-info-popup';

/** Shared buyer/seller presentation. The URL host owns the one-time flag. */
export function AfterWizardTour({ anchor, onClose, title, text, tone = 'buyer' }: { anchor: HTMLElement | null; onClose: (focusField: boolean) => void; title: string; text: string; tone?: 'buyer' | 'seller' }) {
  const L = useTr();
  const id = useId();
  const pop = useRef<HTMLDivElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const host = anchor?.closest<HTMLElement>('[data-edit-info-body]')?.parentElement ?? null;
  useEffect(() => {
    host?.classList.add('buyer-want-tour-on');
    return () => host?.classList.remove('buyer-want-tour-on');
  }, [host]);
  useEffect(() => {
    if (!anchor) return;
    const measure = () => setRect(anchor.getBoundingClientRect());
    const sc = anchor.closest<HTMLElement>('[data-edit-info-body]');
    if (sc) {
      const tabs = sc.querySelector<HTMLElement>('[data-sticky-tabs]');
      const top = anchor.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (tabs?.offsetHeight ?? 0) - 16;
      sc.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    measure();
    const again = window.setTimeout(measure, 420);
    const observer = new ResizeObserver(measure); observer.observe(anchor);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    return () => { observer.disconnect(); window.clearTimeout(again); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [anchor]);
  useEffect(() => {
    const t = window.setTimeout(() => go.current?.focus({ preventScroll: true }), 200);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(false); } };
    const down = (e: PointerEvent) => { if (!pop.current?.contains(e.target as Node)) onClose(false); };
    window.addEventListener('keydown', key, true); window.addEventListener('pointerdown', down, true);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', down, true); };
  }, [onClose]);
  const positioned = !!rect;
  useEffect(() => { if (positioned) { const t = window.setTimeout(() => go.current?.focus({ preventScroll: true }), 220); return () => window.clearTimeout(t); } }, [positioned]);
  if (!anchor || !rect) return null;
  const hostRect = host?.getBoundingClientRect();
  const ox = hostRect?.left ?? 0, oy = hostRect?.top ?? 0;
  const width = Math.min(420, rect.width + (tone === 'seller' ? 8 : 16));
  const left = Math.max((hostRect?.left ?? 0) + 8, Math.min(rect.left - (tone === 'seller' ? 4 : 12), (hostRect?.right ?? window.innerWidth) - width - 8));
  return createPortal(<>
    <div aria-hidden className={`buyer-want-tour-hole after-wizard-${tone}`} style={{ top: rect.top - 8 - oy, left: rect.left - 8 - ox, width: rect.width + 16, height: rect.height + 16 }} />
    <div ref={pop} role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} className={`buyer-want-tour-pop after-wizard-${tone}`} style={{ top: rect.bottom + 20 - oy, left: left - ox, width }}>
      <Button variant="unstyled" size="unstyled" type="button" className="buyer-want-tour-x" aria-label={L('Close', 'ปิด')} onClick={() => onClose(false)}><X className="h-4 w-4" aria-hidden /></Button>
      <p id={`${id}-title`} className="buyer-want-tour-t">{title}</p><p id={`${id}-text`} className="buyer-want-tour-s">{text}</p>
      <div className="buyer-want-tour-f"><Button variant="unstyled" size="unstyled" type="button" ref={go} className="buyer-want-tour-go" onClick={() => onClose(true)}>{L('Continue', 'ดำเนินการต่อ')}</Button></div>
    </div>
  </>, host ?? document.body);
}