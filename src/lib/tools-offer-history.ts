type Entry = { pathname: string; index: number };
export function offerPageGroup(pathname: string) {
  return pathname === '/my-financials' || pathname === '/my-valuation' ? 'financials-valuation' : pathname;
}
/** Only history entries observed in this app session are eligible return targets. */
export function createOfferHistory(initial: Entry) {
  const entries = new Map<number, string>([[initial.index, initial.pathname]]);
  return {
    record(entry: Entry, action: string) {
      if (action === 'PUSH') for (const index of entries.keys()) if (index >= entry.index) entries.delete(index);
      entries.set(entry.index, entry.pathname);
    },
    backDistance(current: Entry) {
      const group = offerPageGroup(current.pathname);
      for (let index = current.index - 1; index >= 0; index--) {
        const path = entries.get(index);
        if (!path) return null;
        if (offerPageGroup(path) !== group) return current.index - index;
      }
      return null;
    },
  };
}
