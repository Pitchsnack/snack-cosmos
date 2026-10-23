import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { bangkokDay, nextBangkokMidnight } from '@/lib/agreement-dates';

const AgreementState = createContext<{ today: number | null; expanded: Set<string>; toggle: (id: string) => void } | null>(null);

/** Lives above Pipeline child routes; no private deal data is stored in the browser. */
export function AgreementStateProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = Date.now();
      setToday(bangkokDay(now));
      clearTimeout(timer);
      timer = setTimeout(update, Math.max(1, nextBangkokMidnight(now) - now));
    };
    update();
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', update); };
  }, []);
  const toggle = (id: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <AgreementState.Provider value={{ today, expanded, toggle }}>{children}</AgreementState.Provider>;
}

export function useAgreementState() { return useContext(AgreementState); }