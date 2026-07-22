import { useCallback, useEffect, useState } from "react";

/**
 * Client-side favorite/bookmark store for startups.
 *
 * UI-only. Persisted in localStorage; syncs across tabs and components via
 * the storage event and an in-page CustomEvent. No backend calls.
 */

const STORAGE_KEY = "sp2:favorites:startups";
const CHANGE_EVENT = "sp2:favorites:startups:change";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useFavoriteStartups() {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setIds(read());
    const sync = () => setIds(read());
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback((id: string) => {
    const next = read();
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = read();
    if (next.delete(id)) write(next);
  }, []);

  return { ids, isFavorite, toggle, remove };
}
