import { useCallback, useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import type { RouterHistory } from '@tanstack/history';
import { createOfferHistory } from '@/lib/tools-offer-history';
const histories = new WeakMap<RouterHistory, ReturnType<typeof createOfferHistory>>();
export function trackToolsOfferHistory(history: RouterHistory | undefined) {
  if (!history || histories.has(history)) return;
  const tracker = createOfferHistory({ pathname: history.location.pathname, index: history.location.state.__TSR_index });
  histories.set(history, tracker);
  history.subscribe(({ location, action }) => tracker.record({ pathname: location.pathname, index: location.state.__TSR_index }, action.type));
}
export function useToolsOfferClose(visible: boolean, windowOpen = false) {
  const router = useRouter();
  const close = useCallback(() => {
    const location = router.history.location;
    const distance = histories.get(router.history)?.backDistance({ pathname: location.pathname, index: location.state.__TSR_index });
    if (distance) router.history.go(-distance);
    else void router.navigate({ to: '/my-startups' });
  }, [router]);
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || windowOpen) return;
      // Capture before an overlay's own Escape handler removes it.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-mobile="true"][data-state="open"]')) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [visible, windowOpen, close]);
  return close;
}
