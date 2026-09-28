import { useEffect, useState } from "react";

/** Locally remembered bookmarks (listings, investors) for the signed-in browser. */
export function useSavedIds(key: string) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setIds(JSON.parse(raw) as string[]);
    } catch {
      /* noop */
    }
  }, [key]);
  const toggle = (id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };
  return { ids: new Set(ids), toggle };
}
